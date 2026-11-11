import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  cloneDocument,
  dedup,
  draco,
  flatten,
  getBounds,
  normals,
  prune,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(PROJECT_ROOT, 'public', 'models');
const INCOMING_DIR = path.join(DEFAULT_OUT_DIR, 'incoming');

function parseArgs(argv) {
  const args = {
    input: null,
    id: null,
    name: null,
    powertrain: 'petrol',
    style: 'realistic',
    bodyType: '4-Door Vehicle',
    outDir: DEFAULT_OUT_DIR,
    maxMb: 4.9,
    flipFront: false,
    writeManifestJson: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--') && !args.input) {
      args.input = token;
    } else if (token === '--id' && argv[i + 1]) {
      args.id = argv[++i].trim().toLowerCase();
    } else if (token === '--name' && argv[i + 1]) {
      args.name = argv[++i];
    } else if (token === '--powertrain' && argv[i + 1]) {
      args.powertrain = argv[++i];
    } else if (token === '--style' && argv[i + 1]) {
      args.style = argv[++i];
    } else if (token === '--body-type' && argv[i + 1]) {
      args.bodyType = argv[++i];
    } else if (token === '--out-dir' && argv[i + 1]) {
      args.outDir = path.resolve(argv[++i]);
    } else if (token === '--max-mb' && argv[i + 1]) {
      args.maxMb = Number(argv[++i]) || 4.9;
    } else if (token === '--flip-front') {
      args.flipFront = true;
    } else if (token === '--manifest-out' && argv[i + 1]) {
      args.writeManifestJson = path.resolve(argv[++i]);
    }
  }

  return args;
}

function getMeshStats(doc) {
  let verts = 0;
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) verts += pos.getCount();
      const idx = prim.getIndices();
      tris += idx ? Math.floor(idx.getCount() / 3) : pos ? Math.floor(pos.getCount() / 3) : 0;
    }
  }
  return { verts, tris, meshes: doc.getRoot().listMeshes().length };
}

function getMeshBox(node) {
  const mesh = node.getMesh();
  const box = new THREE.Box3();
  if (!mesh) return box;
  const mat = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const min = pos.getMin([]);
    const max = pos.getMax([]);
    const pb = new THREE.Box3(
      new THREE.Vector3(min[0], min[1], min[2]),
      new THREE.Vector3(max[0], max[1], max[2]),
    ).applyMatrix4(mat);
    box.union(pb);
  }
  return box;
}

function sanitizeNodeSlug(name, fallbackIdx) {
  const cleaned = (name || `Part_${fallbackIdx}`)
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
  return cleaned || `Part_${fallbackIdx}`;
}

function detectFrontFlipNeeded(doc, bounds) {
  const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  const centerZ = (bounds.min[2] + bounds.max[2]) * 0.5;
  const minY = bounds.min[1];
  const height = Math.max(bounds.max[1] - minY, 0.001);

  let frontScoreZ = 0;
  let frontWeight = 0;
  let rearScoreZ = 0;
  let rearWeight = 0;

  for (const node of nodes) {
    const matNames = node
      .getMesh()
      .listPrimitives()
      .map((p) => p.getMaterial()?.getName() || '')
      .join(' ');
    const label = `${node.getName()} ${matNames}`;
    const box = getMeshBox(node);
    if (box.isEmpty()) continue;
    const cz = (box.min.z + box.max.z) * 0.5;

    if (/(whitelight|headlight|headlamp|engine)/i.test(label)) {
      frontScoreZ += cz * 3;
      frontWeight += 3;
    } else if (/(hood|bonnet|capot)/i.test(label)) {
      frontScoreZ += cz;
      frontWeight += 1;
    }
    if (/(redlight|taillight|tail|rear|trunk|exhaust|muffler)/i.test(label)) {
      rearScoreZ += cz * 3;
      rearWeight += 3;
    }
  }

  if (frontWeight > 0 && rearWeight > 0) {
    return frontScoreZ / frontWeight < rearScoreZ / rearWeight;
  }

  // Fallback by cabin/greenhouse mass asymmetry: upper body crown is biased slightly toward rear (-Z)
  let upperZSum = 0;
  let upperCount = 0;
  for (const node of nodes) {
    const box = getMeshBox(node);
    if (box.isEmpty()) continue;
    const cy = (box.min.y + box.max.y) * 0.5;
    if (cy > minY + height * 0.58) {
      upperZSum += (box.min.z + box.max.z) * 0.5;
      upperCount += 1;
    }
  }
  if (upperCount > 0) {
    const avgUpperZ = upperZSum / upperCount;
    return avgUpperZ > centerZ + 0.05;
  }
  return false;
}

function detectUpsideDownFlipNeeded(doc, bounds) {
  const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  const minY = bounds.min[1];
  const maxY = bounds.max[1];
  const midY = (minY + maxY) * 0.5;
  const height = Math.max(maxY - minY, 0.001);

  let wheelYSum = 0;
  let wheelCount = 0;
  let upperYSum = 0;
  let upperCount = 0;

  for (const node of nodes) {
    const matNames = node
      .getMesh()
      .listPrimitives()
      .map((p) => p.getMaterial()?.getName() || '')
      .join(' ');
    const label = `${node.getName()} ${matNames}`;
    const box = getMeshBox(node);
    if (box.isEmpty()) continue;
    const cy = (box.min.y + box.max.y) * 0.5;

    if (/(tire|tyre|wheel|rim|rotor)/i.test(label) && !/steering/i.test(label)) {
      wheelYSum += cy;
      wheelCount += 1;
    }
    if (/(windshield|windscreen|window_|roof|hood|bonnet)/i.test(label) && !/inside/i.test(label)) {
      upperYSum += cy;
      upperCount += 1;
    }
  }

  const avgWheelY = wheelCount > 0 ? wheelYSum / wheelCount : midY;
  const avgUpperY = upperCount > 0 ? upperYSum / upperCount : midY;

  if (wheelCount > 0 && avgWheelY > midY + height * 0.04) return true;
  if (upperCount > 0 && avgUpperY < midY - height * 0.06) return true;
  if (wheelCount > 0 && upperCount > 0 && avgWheelY > avgUpperY) return true;
  return false;
}

async function normalizeAndBakeTransforms(doc, forceFlipFront) {
  await doc.transform(flatten());

  const scene = doc.getRoot().listScenes()[0];
  // Capture accumulated world transforms before modifying any node/mesh references
  const worldMatrices = new Map();
  for (const node of doc.getRoot().listNodes()) {
    worldMatrices.set(node, new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  }

  // Unshare any multi-referenced meshes and vertex attribute accessors before baking transforms
  const seenMeshes = new Set();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (seenMeshes.has(mesh)) {
      node.setMesh(mesh.clone());
    } else {
      seenMeshes.add(mesh);
    }
  }
  const seenAccessors = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) {
        const acc = prim.getAttribute(sem);
        if (!acc) continue;
        if (seenAccessors.has(acc)) {
          prim.setAttribute(sem, acc.clone());
        } else {
          seenAccessors.add(acc);
        }
      }
    }
  }

  // Compute raw pre-rotation size along world axes
  const preBakeBox = new THREE.Box3();
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    preBakeBox.union(getMeshBox(node));
  }
  const rawSize = [
    preBakeBox.max.x - preBakeBox.min.x,
    preBakeBox.max.y - preBakeBox.min.y,
    preBakeBox.max.z - preBakeBox.min.z,
  ];

  // Rotate +90 deg around Y if vehicle length runs along X instead of Z
  const rotateQuat = new THREE.Quaternion();
  if (rawSize[0] > rawSize[2] * 1.15) {
    rotateQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  }

  // Bake each mesh node's captured world transform + axis alignment directly into its unique vertices
  const axisMat = new THREE.Matrix4().makeRotationFromQuaternion(rotateQuat);
  const meshNodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  for (const node of meshNodes) {
    const mesh = node.getMesh();
    const worldMat = worldMatrices.get(node) ?? new THREE.Matrix4();
    const combined = new THREE.Matrix4().multiplyMatrices(axisMat, worldMat);
    transformMesh(mesh, combined.elements);
    node.getParentNode()?.removeChild(node);
    scene.removeChild(node);
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    scene.addChild(node);
  }
  // Drop leftover empty transform wrapper nodes so hierarchy stays flat and unambiguous
  for (const node of [...doc.getRoot().listNodes()]) {
    if (!node.getMesh() && node.listChildren().length === 0) {
      node.dispose();
    }
  }

  let bounds = getBounds(scene);
  const upsideDown = detectUpsideDownFlipNeeded(doc, bounds);
  if (upsideDown) {
    const flipZ = new THREE.Matrix4().makeRotationZ(Math.PI);
    for (const node of meshNodes) {
      transformMesh(node.getMesh(), flipZ.elements);
    }
    bounds = getBounds(scene);
  }
  const autoFlip = detectFrontFlipNeeded(doc, bounds);
  const doFlip = forceFlipFront ? !autoFlip : autoFlip;

  const sizeX = Math.max(bounds.max[0] - bounds.min[0], 0.001);
  const sizeZ = Math.max(bounds.max[2] - bounds.min[2], 0.001);
  const maxHoriz = Math.max(sizeX, sizeZ);
  const scaleFactor = 4.25 / maxHoriz;
  const cx = (bounds.min[0] + bounds.max[0]) * 0.5;
  const cz = (bounds.min[2] + bounds.max[2]) * 0.5;
  const minY = bounds.min[1];

  const normMat = new THREE.Matrix4();
  const sMat = new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);
  const tCenter = new THREE.Matrix4().makeTranslation(-cx, -minY, -cz);
  normMat.multiplyMatrices(sMat, tCenter);
  if (doFlip) {
    const flipY = new THREE.Matrix4().makeRotationY(Math.PI);
    normMat.premultiply(flipY);
  }

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    transformMesh(mesh, normMat.elements);
  }

  const finalBounds = getBounds(scene);
  return {
    autoFlipped180: doFlip,
    rotated90: rawSize[0] > rawSize[2] * 1.15,
    size: [
      finalBounds.max[0] - finalBounds.min[0],
      finalBounds.max[1] - finalBounds.min[1],
      finalBounds.max[2] - finalBounds.min[2],
    ],
    bounds: finalBounds,
  };
}

function classifyAndRenameParts(doc, normInfo) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const [carW, carH, carL] = normInfo.size;

  const meshNodes = root.listNodes().filter((n) => n.getMesh());

  const glass = [];
  const hoodNodes = [];
  const doorNodes = [];
  const shell = [];
  const usedNodeNames = new Set();
  const makeUniqueName = (base) => {
    let candidate = base;
    let suffix = 2;
    while (usedNodeNames.has(candidate)) {
      candidate = `${base}_${suffix++}`;
    }
    usedNodeNames.add(candidate);
    return candidate;
  };

  const interior = [];
  const mergedNonWheelNames = [];

  // 1. Identify glass & corner-separable wheels first
  const wheelCandidates = [];
  const remaining = [];

  for (let idx = 0; idx < meshNodes.length; idx++) {
    const node = meshNodes[idx];
    const origName = node.getName() || `Node_${idx}`;
    const prims = node.getMesh().listPrimitives();
    const matNames = prims.map((p) => p.getMaterial()?.getName() || '').join(' ');
    const hasGlassMat = prims.some((p) => {
      const m = p.getMaterial();
      if (!m) return false;
      const alpha = m.getBaseColorFactor?.()?.[3] ?? 1;
      const trExt = m.getExtension?.('KHR_materials_transmission');
      return (
        m.getAlphaMode() === 'BLEND' ||
        alpha < 0.9 ||
        Boolean(trExt && trExt.getTransmissionFactor() > 0.05) ||
        /(glass|window|windshield|windscreen|vitre)/i.test(m.getName())
      );
    });

    const box = getMeshBox(node);
    const sz = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    const combinedLabel = `${origName} ${matNames}`;

    if (
      (/(glass|window|windshield|windscreen|vitre)/i.test(combinedLabel) || hasGlassMat) &&
      sz.length() > 0.12 &&
      !/interiorwindowinside/i.test(matNames.replace(/\s+/g, ''))
    ) {
      const newName = makeUniqueName(`Glass_${sanitizeNodeSlug(origName, idx)}`);
      node.setName(newName);
      glass.push(newName);
      continue;
    }

    const spansBothSides = sz.x > carW * 0.55;
    const spansFrontBack = sz.z > carL * 0.42;
    const isWheelNamed = /(wheel|tire|tyre|rim|rotor|caliper|disc|brake)/i.test(combinedLabel);
    const isWheelShaped =
      sz.y > 0.34 &&
      sz.y < 0.92 &&
      sz.z > 0.34 &&
      sz.z < 0.92 &&
      Math.abs(sz.y - sz.z) / Math.max(sz.y, sz.z) < 0.25 &&
      sz.x < carW * 0.4 &&
      ctr.y < carH * 0.46 &&
      Math.abs(ctr.x) > carW * 0.24 &&
      Math.abs(ctr.z) > carL * 0.18;

    if (!spansBothSides && !spansFrontBack && (isWheelNamed || isWheelShaped) && ctr.y < carH * 0.52) {
      wheelCandidates.push({ node, idx, origName, box, sz, ctr, combinedLabel });
      continue;
    }

    if (/(tire|tyre|wheel|rotor)/i.test(combinedLabel) && (spansBothSides || spansFrontBack)) {
      mergedNonWheelNames.push(origName);
    }

    remaining.push({ node, idx, origName, box, sz, ctr, combinedLabel });
  }

  // Cluster wheel candidates into 4 corners (fl, fr, rl, rr)
  const corners = { fl: [], fr: [], rl: [], rr: [] };
  for (const cand of wheelCandidates) {
    if (cand.ctr.x >= 0 && cand.ctr.z >= 0) corners.fl.push(cand);
    else if (cand.ctr.x < 0 && cand.ctr.z >= 0) corners.fr.push(cand);
    else if (cand.ctr.x >= 0 && cand.ctr.z < 0) corners.rl.push(cand);
    else corners.rr.push(cand);
  }

  // Also absorb small lugnuts/hub details inside each corner wheel bounding box
  const cornerMainBoxes = {};
  for (const key of ['fl', 'fr', 'rl', 'rr']) {
    const list = corners[key];
    if (list.length > 0) {
      const b = new THREE.Box3();
      for (const c of list) b.union(c.box);
      b.expandByScalar(0.08);
      cornerMainBoxes[key] = b;
    }
  }

  const stillRemaining = [];
  for (const item of remaining) {
    let absorbed = false;
    if (item.sz.x < 0.35 && item.sz.y < 0.38 && item.sz.z < 0.38 && item.ctr.y < carH * 0.5) {
      for (const key of ['fl', 'fr', 'rl', 'rr']) {
        const b = cornerMainBoxes[key];
        if (b && b.containsPoint(item.ctr)) {
          corners[key].push(item);
          absorbed = true;
          break;
        }
      }
    }
    if (!absorbed) stillRemaining.push(item);
  }

  // Validate that corners look like actual wheels (not just detached rims when tires were merged!)
  const hasMergedTires = mergedNonWheelNames.some((n) => /(tire|tyre)/i.test(n));
  const wheels = { fl: null, fr: null, rl: null, rr: null };
  const cornerCenters = {};
  const wheelPivotNames = {
    fl: 'WheelFrontL',
    fr: 'WheelFrontR',
    rl: 'WheelRearL',
    rr: 'WheelRearR',
  };

  const allCornersPopulated = ['fl', 'fr', 'rl', 'rr'].every((k) => corners[k].length > 0);
  if (allCornersPopulated && !hasMergedTires) {
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      const list = corners[key];
      const cornerBox = new THREE.Box3();
      for (const item of list) cornerBox.union(item.box);
      const center = cornerBox.getCenter(new THREE.Vector3());
      cornerCenters[key] = center;

      const groupNode = doc.createNode(wheelPivotNames[key]);
      groupNode.setTranslation([center.x, center.y, center.z]);
      scene.addChild(groupNode);

      list.forEach((item, subIdx) => {
        const mesh = item.node.getMesh();
        // Shift mesh geometry into pivot-relative space cleanly
        const invT = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
        transformMesh(mesh, invT.elements);
        item.node.setName(`${wheelPivotNames[key]}_Part${subIdx}`);
        scene.removeChild(item.node);
        groupNode.addChild(item.node);
      });

      wheels[key] = wheelPivotNames[key];
    }
  } else {
    // Keep as static shell/chassis parts if tires/wheels cannot be exploded cleanly as full wheels
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      for (const item of corners[key]) stillRemaining.push(item);
      if (corners[key].length > 0) {
        const b = new THREE.Box3();
        for (const c of corners[key]) b.union(c.box);
        cornerCenters[key] = b.getCenter(new THREE.Vector3());
      }
    }
  }

  // 2. Detect Hood, Doors, Interior, and Exterior Shell among remaining nodes
  let hoodAssigned = false;
  for (const item of stillRemaining) {
    const { node, idx, origName, sz, ctr, combinedLabel } = item;

    if (/(seat|carpet|floor|steering|pedal|dash|console|interior)/i.test(combinedLabel)) {
      const name = makeUniqueName(`Interior_${sanitizeNodeSlug(origName, idx)}`);
      node.setName(name);
      interior.push(name);
      continue;
    }

    const isHoodName = /(hood|bonnet|capot)/i.test(combinedLabel);
    const isHoodByPos =
      !hoodAssigned &&
      ctr.z > carL * 0.16 &&
      ctr.y > carH * 0.34 &&
      sz.z > carL * 0.14 &&
      sz.z < carL * 0.44 &&
      sz.x > carW * 0.36 &&
      sz.y < carH * 0.28;

    if (isHoodName || isHoodByPos) {
      const name = makeUniqueName(hoodAssigned ? `BodyHood_Extra` : 'BodyHood');
      hoodAssigned = true;
      node.setName(name);
      hoodNodes.push(name);
      continue;
    }

    const isDoorName = /(^|[^a-z])door([^a-z]|$)|porte/i.test(combinedLabel);
    const isDoorByPos =
      Math.abs(ctr.x) > carW * 0.34 &&
      ctr.y > carH * 0.24 &&
      sz.x < carW * 0.25 &&
      sz.z > carL * 0.15 &&
      sz.z < carL * 0.48 &&
      sz.y > carH * 0.2;

    if (isDoorName || isDoorByPos) {
      const side = ctr.x >= 0 ? 'L' : 'R';
      const name = makeUniqueName(`BodyDoor${side}_${sanitizeNodeSlug(origName, idx)}`);
      node.setName(name);
      doorNodes.push(name);
      continue;
    }

    const name = makeUniqueName(`BodyShell_${sanitizeNodeSlug(origName, idx)}`);
    node.setName(name);
    shell.push(name);
  }

  // 3. Create 8 standardized Anchor_* nodes (EV can ignore exhaust at runtime)
  const { min, max } = normInfo.bounds;
  const frac = (fx, fy, fz) => [
    fx * (max[0] - min[0]),
    min[1] + fy * (max[1] - min[1]),
    fz * (max[2] - min[2]),
  ];

  const flCenter = cornerCenters.fl;
  const rlCenter = cornerCenters.rl;

  const anchorPositions = {
    Anchor_engine: frac(0, 0.42, 0.32),
    Anchor_transmission: frac(0, 0.3, 0.14),
    Anchor_brakes: flCenter ? [flCenter.x * 0.9, flCenter.y, flCenter.z] : frac(0.42, 0.28, 0.3),
    Anchor_suspension: rlCenter ? [rlCenter.x * 0.9, rlCenter.y + 0.12, rlCenter.z] : frac(0.42, 0.4, -0.3),
    Anchor_steering: frac(0.18, 0.58, 0.14),
    Anchor_electrical: frac(-0.24, 0.44, 0.24),
    Anchor_cooling: frac(0, 0.36, 0.43),
    Anchor_exhaust: frac(0.18, 0.2, -0.42),
  };

  for (const [anchorName, pos] of Object.entries(anchorPositions)) {
    const existing = root.listNodes().find((n) => n.getName() === anchorName);
    if (existing) {
      existing.setTranslation(pos);
    } else {
      const node = doc.createNode(anchorName).setTranslation(pos);
      scene.addChild(node);
    }
  }

  const missing = [];
  if (!wheels.fl || !wheels.fr || !wheels.rl || !wheels.rr) {
    missing.push('4 separable wheels (tires/hubs merged)');
  }
  if (hoodNodes.length === 0) missing.push('separable hood');
  if (doorNodes.length === 0) missing.push('separable doors');
  if (glass.length === 0) missing.push('transparent glass');

  const explodeLimited = missing.some((m) => /wheel|hood|door/i.test(m));

  return {
    nodeMap: {
      shell,
      glass,
      wheels,
      hood: hoodNodes[0] ?? null,
      doors: doorNodes,
    },
    interior,
    anchorsCreated: Object.keys(anchorPositions),
    missing,
    explodeLimited,
  };
}

function buildShellExplodeConfig(nodeMap) {
  const parts = [];
  if (nodeMap.hood) {
    parts.push({ nodeNames: [nodeMap.hood], direction: [0, 0.72, 0.75], distance: 0.6 });
  }
  const leftDoors = nodeMap.doors.filter((n) => /^BodyDoorL/i.test(n));
  const rightDoors = nodeMap.doors.filter((n) => /^BodyDoorR/i.test(n));
  if (leftDoors.length > 0) {
    parts.push({ nodeNames: leftDoors, direction: [1, 0.14, 0], distance: 0.55 });
  }
  if (rightDoors.length > 0) {
    parts.push({ nodeNames: rightDoors, direction: [-1, 0.14, 0], distance: 0.55 });
  }
  if (nodeMap.wheels.fl) parts.push({ nodeNames: [nodeMap.wheels.fl], direction: [1, 0.08, 0.16], distance: 0.48 });
  if (nodeMap.wheels.fr) parts.push({ nodeNames: [nodeMap.wheels.fr], direction: [-1, 0.08, 0.16], distance: 0.48 });
  if (nodeMap.wheels.rl) parts.push({ nodeNames: [nodeMap.wheels.rl], direction: [1, 0.08, -0.16], distance: 0.48 });
  if (nodeMap.wheels.rr) parts.push({ nodeNames: [nodeMap.wheels.rr], direction: [-1, 0.08, -0.16], distance: 0.48 });
  if (nodeMap.glass.length > 0) {
    parts.push({ nodeNames: nodeMap.glass, direction: [0, 1, 0], distance: 0.42 });
  }
  if (nodeMap.shell.length > 0) {
    parts.push({ nodeNames: nodeMap.shell, direction: [0, 0.35, 0], distance: 0.24 });
  }
  return parts;
}

async function compressUnderBudget(baseDoc, io, initialVerts, maxMb) {
  const maxBytes = maxMb * 1024 * 1024;
  let simplifyRatio =
    initialVerts > 1200000
      ? 0.09
      : initialVerts > 500000
        ? 0.18
        : initialVerts > 180000
          ? 0.42
          : 0.78;
  let texMaxDim = 1024;
  let webpQuality = 82;

  for (let attempt = 0; attempt < 5; attempt++) {
    const workDoc = await cloneDocument(baseDoc);
    const hasTextures = workDoc.getRoot().listTextures().length > 0;
    const stats = getMeshStats(workDoc);
    const splitDenseCad = !hasTextures && stats.verts > 500000 && stats.verts > stats.tris * 1.4;

    if (splitDenseCad) {
      for (const mesh of workDoc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          prim.setAttribute('TEXCOORD_0', null);
          prim.setAttribute('NORMAL', null);
        }
      }
    }

    await workDoc.transform(
      dedup(),
      weld(),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: simplifyRatio,
        error: attempt === 0 ? 0.015 : attempt === 1 ? 0.03 : 0.055,
      }),
      ...(splitDenseCad ? [normals({ overwrite: true })] : []),
      prune(),
    );

    if (hasTextures) {
      await workDoc.transform(
        textureCompress({
          encoder: sharp,
          targetFormat: 'webp',
          resize: [texMaxDim, texMaxDim],
          quality: webpQuality,
        }),
      );
    }

    await workDoc.transform(draco({ method: 'edgebreaker' }));
    const outBuffer = await io.writeBinary(workDoc);
    if (outBuffer.byteLength <= maxBytes || attempt === 4) {
      return {
        doc: workDoc,
        buffer: outBuffer,
        simplifyRatio,
        texMaxDim,
        sizeMb: outBuffer.byteLength / 1048576,
      };
    }

    console.log(
      `  Attempt ${attempt + 1}: ${(outBuffer.byteLength / 1048576).toFixed(2)} MB > ${maxMb} MB target; tightening compression…`,
    );
    simplifyRatio = Math.max(0.035, simplifyRatio * 0.62);
    texMaxDim = Math.max(512, Math.round(texMaxDim * 0.75));
    webpQuality = Math.max(66, webpQuality - 8);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(INCOMING_DIR, { recursive: true });
  await fs.mkdir(args.outDir, { recursive: true });

  if (!args.input) {
    console.error('Usage: npm run import-car -- <path/to/model.glb> --id <car-id>');
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  const rawBase = path.basename(inputPath, path.extname(inputPath));
  const carId = args.id || rawBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const outPath = path.join(args.outDir, `${carId}.glb`);

  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const encoderModule = await draco3d.createEncoderModule();
  const decoderModule = await draco3d.createDecoderModule();

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': encoderModule,
    'draco3d.decoder': decoderModule,
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptSimplifier,
  });

  const inputStat = await fs.stat(inputPath);
  const doc = await io.read(inputPath);
  const beforeStats = getMeshStats(doc);
  const origExtras = { ...(doc.getRoot().getAsset().extras || {}) };

  console.log(`\nImporting "${rawBase}" -> public/models/${carId}.glb`);
  console.log(
    `Source: ${(inputStat.size / 1048576).toFixed(2)} MB | ${beforeStats.verts.toLocaleString()} verts | ${beforeStats.tris.toLocaleString()} tris | ${doc.getRoot().listTextures().length} textures`,
  );

  const normInfo = await normalizeAndBakeTransforms(doc, args.flipFront);
  const detection = classifyAndRenameParts(doc, normInfo);

  // Preserve attribution metadata cleanly on normalized asset
  doc.getRoot().getAsset().extras = origExtras;

  const compressed = await compressUnderBudget(doc, io, beforeStats.verts, args.maxMb);
  await fs.writeFile(outPath, compressed.buffer);
  const afterStats = getMeshStats(compressed.doc);

  const shellConfig = buildShellExplodeConfig(detection.nodeMap);
  const displayName =
    args.name ||
    (origExtras.title ? String(origExtras.title).replace(/^Free Hyper-Realistic Model of /i, '').trim() : carId.toUpperCase());

  const manifestEntry = {
    id: carId,
    name: displayName,
    bodyType: args.bodyType,
    powertrain: args.powertrain,
    style: args.style,
    quality: 'full',
    modelFile: `/models/${carId}.glb`,
    thumbnail: `/thumbnails/${carId === 'ev' || args.powertrain === 'ev' ? 'ev' : carId === 'suv' ? 'suv' : carId === 'hatchback' ? 'hatchback' : 'sedan'}.svg`,
    defaultCamera: {
      position: [3.9, 1.9, 4.3],
      target: [0, 0.56, 0],
      mobilePosition: [7.8, 3.1, 8.6],
      mobileTarget: [0, -0.16, 0],
    },
    systems: {
      engine: { anchorNode: 'Anchor_engine', cameraTarget: [0, 0.04, 0], cameraOffset: [1.55, 0.96, 1.45], meshNames: [] },
      transmission: { anchorNode: 'Anchor_transmission', cameraTarget: [0, 0, 0], cameraOffset: [1.85, 0.88, 0.5], meshNames: [] },
      brakes: { anchorNode: 'Anchor_brakes', cameraTarget: [0, 0, 0], cameraOffset: [1.35, 0.45, 0.78], meshNames: [] },
      suspension: { anchorNode: 'Anchor_suspension', cameraTarget: [0, 0.02, 0], cameraOffset: [1.45, 0.58, -0.82], meshNames: [] },
      steering: { anchorNode: 'Anchor_steering', cameraTarget: [0, -0.04, 0], cameraOffset: [1.18, 1.08, 0.9], meshNames: [] },
      electrical: { anchorNode: 'Anchor_electrical', cameraTarget: [0, 0.04, 0], cameraOffset: [-1.45, 0.94, 1.3], meshNames: [] },
      cooling: { anchorNode: 'Anchor_cooling', cameraTarget: [0, 0.02, 0], cameraOffset: [0.92, 0.62, 1.72], meshNames: [] },
      ...(args.powertrain === 'ev'
        ? {}
        : {
            exhaust: {
              anchorNode: 'Anchor_exhaust',
              cameraTarget: [0, 0.02, 0],
              cameraOffset: [1.5, 0.56, -1.42],
              meshNames: [],
            },
          }),
    },
    nodeMap: detection.nodeMap,
    shell: shellConfig,
    credits: {
      author: String(origExtras.author || 'Supplied Model Author'),
      license: String(origExtras.license || 'Check source license'),
      source: String(origExtras.source || rawBase),
    },
  };

  if (args.writeManifestJson) {
    await fs.writeFile(args.writeManifestJson, JSON.stringify(manifestEntry, null, 2));
  }

  console.log('\n--- IMPORT REPORT ---');
  console.log(`Output:         ${path.relative(PROJECT_ROOT, outPath)} (${compressed.sizeMb.toFixed(2)} MB)`);
  console.log(`Dimensions:     ${normInfo.size.map((n) => n.toFixed(2) + 'm').join(' × ')} (flipped180=${normInfo.autoFlipped180}, rot90=${normInfo.rotated90})`);
  console.log(`Geometry:       ${beforeStats.tris.toLocaleString()} -> ${afterStats.tris.toLocaleString()} tris (simplify ratio ${compressed.simplifyRatio.toFixed(3)} + Draco)`);
  console.log(`Detected Parts: shell=${detection.nodeMap.shell.length}, glass=${detection.nodeMap.glass.length}, doors=${detection.nodeMap.doors.length}, hood=${detection.nodeMap.hood ?? 'none'}, wheels=${JSON.stringify(detection.nodeMap.wheels)}`);
  console.log(`Anchors:        ${detection.anchorsCreated.join(', ')}`);
  console.log(`Missing:        ${detection.missing.length > 0 ? detection.missing.join('; ') : 'None (full separable parts detected)'}`);
  if (detection.explodeLimited) {
    console.log('NOTICE:         Lacks separable wheels/hood/doors — whole-car explode will be limited for this model.');
  }
  console.log('---------------------');
  console.log('\nManifest entry preview:\n' + JSON.stringify(manifestEntry, null, 2));
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
