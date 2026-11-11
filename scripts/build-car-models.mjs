globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
};

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const OUT_DIR = '/home/jp/Documents/Car Model/public/models';
fs.mkdirSync(OUT_DIR, { recursive: true });

function makeBodyShellGeometry(spec, depth, bevel = 0.04) {
  const shape = new THREE.Shape();
  const { rearZ, frontZ, clearance, axleRearZ, axleFrontZ, wheelRadius, beltY } = spec;
  const archR = wheelRadius + 0.075;
  const wheelY = wheelRadius;

  // Bottom silhouette from rear bumper -> rear wheel arch -> rocker -> front wheel arch -> front lip
  shape.moveTo(rearZ + 0.06, clearance + 0.06);
  shape.lineTo(axleRearZ - archR, clearance);
  shape.absarc(axleRearZ, wheelY, archR, Math.PI + 0.25, -0.25, true);
  shape.lineTo(axleFrontZ - archR, clearance);
  shape.absarc(axleFrontZ, wheelY, archR, Math.PI + 0.25, -0.25, true);
  shape.lineTo(frontZ - 0.06, clearance);

  // Upper beltline perimeter back from nose to tail
  for (const [z, y] of spec.upperDeck) {
    shape.lineTo(z, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function makeExtrudedProfile(points, depth, bevel = 0.045) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 14,
  });
  // Extrude spans X,Y in side-view; center depth across Z, then rotate so length runs along +Z (front +Z)
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function addWheelAssembly(parent, x, y, z, radius, width, sideName, discMat, caliperMat, tireMat, rimMat) {
  const group = new THREE.Group();
  group.name = `Wheel${sideName}`;
  group.position.set(x, y, z);

  // Outer rubber tire with smooth circular rim & ventilated rotor behind spokes
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.name = `Tire${sideName}`;

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.015, 28), rimMat);
  rim.rotation.z = Math.PI / 2;
  rim.name = `Wheel${sideName}Rim`;

  // 5 alloy wheel spokes
  const spokeSign = x >= 0 ? 1 : -1;
  const spokeGeo = new THREE.BoxGeometry(0.025, radius * 1.15, 0.045);
  for (let s = 0; s < 5; s++) {
    const sp = new THREE.Mesh(spokeGeo, rimMat);
    const a = (s / 5) * Math.PI * 2;
    sp.position.set(spokeSign * (width * 0.5 + 0.006), Math.cos(a) * radius * 0.14, Math.sin(a) * radius * 0.14);
    sp.rotation.x = a;
    sp.name = `Wheel${sideName}Spoke${s}`;
    group.add(sp);
  }

  // Visible brake disc + caliper behind rim spokes
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, 0.036, 28), discMat);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = -spokeSign * 0.02;
  disc.name = `Wheel${sideName}BrakeDisc`;

  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.075, radius * 0.28, radius * 0.24), caliperMat);
  pad.position.set(-spokeSign * 0.015, radius * 0.34, radius * 0.18);
  pad.name = `Wheel${sideName}BrakePad`;

  group.add(tire, rim, disc, pad);
  parent.add(group);
  return group;
}

function addAnchor(parent, name, x, y, z) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

/**
 * Generates an authentic multi-part 3-box car silhouette with wheel wells,
 * glazed cabin, mirrors, lights, wheels/brakes, axles, and named system anchors.
 */
function buildStructuredCar(spec) {
  const root = new THREE.Group();
  root.name = `${spec.id}Scene`;

  const paintMat = new THREE.MeshStandardMaterial({
    color: spec.paintColor,
    metalness: 0.42,
    roughness: 0.28,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#262626',
    metalness: 0.15,
    roughness: 0.72,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#334155',
    metalness: 0.1,
    roughness: 0.08,
    transmission: 0.55,
    transparent: true,
    opacity: 0.48,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.22 });
  const discMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.26 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.4, roughness: 0.38 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1c1c1e', metalness: 0.05, roughness: 0.86 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#fef3c7', emissiveIntensity: 0.35 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#991b1b', emissiveIntensity: 0.35 });

  // Lower beltline hull with crisp curved wheel-arch cutouts
  const hull = new THREE.Mesh(makeBodyShellGeometry(spec, spec.width - 0.08, 0.045), paintMat);
  hull.name = 'BodyPanels';
  root.add(hull);

  // Separate front hood & rear deck/boot lid panels for clean panel lines & explode animation
  const hood = new THREE.Mesh(makeExtrudedProfile(spec.hoodProfile, spec.width * 0.88, 0.025), paintMat);
  hood.name = 'BodyHood';
  root.add(hood);

  if (spec.trunkProfile) {
    const trunk = new THREE.Mesh(makeExtrudedProfile(spec.trunkProfile, spec.width * 0.86, 0.025), paintMat);
    trunk.name = 'BodyRearPanels';
    root.add(trunk);
  }

  // Cabin upper greenhouse & roof cap
  const cabinRoof = new THREE.Mesh(makeExtrudedProfile(spec.roofProfile, spec.cabinWidth, 0.03), paintMat);
  cabinRoof.name = 'BodyRoofPanel';
  root.add(cabinRoof);

  // Translucent glazed greenhouse inset slightly cleanly for windshield + windows
  const glass = new THREE.Mesh(makeExtrudedProfile(spec.glassProfile, spec.cabinWidth * 0.95, 0.015), glassMat);
  glass.name = 'BodyWindshield';
  root.add(glass);

  // Lower rocker skirts & front/rear bumpers
  const bumperFront = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width + 0.04, spec.bumperH, 0.22),
    trimMat,
  );
  bumperFront.position.set(0, spec.clearance + spec.bumperH * 0.5, spec.frontZ - 0.06);
  bumperFront.name = 'BodyFrontBumper';

  const bumperRear = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width + 0.04, spec.bumperH, 0.22),
    trimMat,
  );
  bumperRear.position.set(0, spec.clearance + spec.bumperH * 0.5, spec.rearZ + 0.06);
  bumperRear.name = 'BodyRearBumper';
  root.add(bumperFront, bumperRear);

  // Door side mirrors
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.14), paintMat);
    mirror.position.set(s * (spec.width * 0.5 + 0.09), spec.beltY + 0.06, spec.mirrorZ);
    mirror.name = s > 0 ? 'BodyDoorLMirror' : 'BodyDoorRMirror';
    root.add(mirror);
  }

  // Headlights & Taillights
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.08), headMat);
    hl.position.set(s * (spec.width * 0.34), spec.beltY - 0.14, spec.frontZ + 0.01);
    hl.name = s > 0 ? 'BodyHeadlightL' : 'BodyHeadlightR';

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.08), tailMat);
    tl.position.set(s * (spec.width * 0.33), spec.beltY - 0.1, spec.rearZ - 0.01);
    tl.name = s > 0 ? 'BodyTaillightL' : 'BodyTaillightR';
    root.add(hl, tl);
  }

  // Front Grille (or sleek blank aero panel on EV)
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.44, spec.grilleH, 0.05),
    spec.powertrain === 'ev' ? paintMat : trimMat,
  );
  grille.position.set(0, spec.clearance + spec.bumperH + spec.grilleH * 0.45, spec.frontZ + 0.02);
  grille.name = 'BodyFrontGrille';
  root.add(grille);

  // Optional 2-box Hatch / SUV Rear Tailgate Panel
  if (spec.tailgateProfile) {
    const tailgate = new THREE.Mesh(
      makeExtrudedProfile(spec.tailgateProfile, spec.width * 0.78, 0.02),
      paintMat,
    );
    tailgate.name = 'BodyRearPanels';
    root.add(tailgate);
  }

  // Optional SUV Roof Rails
  if (spec.roofRails) {
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.045, spec.roofRails.length),
        trimMat,
      );
      rail.position.set(s * (spec.cabinWidth * 0.44), spec.roofRails.y, spec.roofRails.z);
      rail.name = s > 0 ? 'BodyRoofRailL' : 'BodyRoofRailR';
      root.add(rail);
    }
  }

  // EV-specific visible underfloor battery skateboard + compact front drive unit
  if (spec.powertrain === 'ev') {
    const batPack = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.68, 0.09, (spec.axleFrontZ - spec.axleRearZ) * 0.72),
      trimMat,
    );
    batPack.position.set(0, spec.clearance + 0.04, (spec.axleFrontZ + spec.axleRearZ) * 0.5);
    batPack.name = 'EVBatteryPack';
    root.add(batPack);

    const driveUnit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.42, 18),
      discMat,
    );
    driveUnit.rotation.z = Math.PI / 2;
    driveUnit.position.set(0, spec.wheelRadius + 0.04, spec.axleFrontZ);
    driveUnit.name = 'EVDriveUnit';
    root.add(driveUnit);
  }

  // Steering wheel visible inside glass cabin
  const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 10, 22), trimMat);
  swRing.position.set(0.34, spec.beltY + 0.1, spec.steerZ);
  swRing.rotation.x = -0.35;
  swRing.name = 'InteriorSteeringWheel01';
  root.add(swRing);

  // Four wheel assemblies + solid axles
  const { wheelRadius, wheelWidth, axleFrontZ, axleRearZ } = spec;
  const xTrack = spec.width * 0.5 - wheelWidth * 0.35;
  addWheelAssembly(root, xTrack, wheelRadius, axleFrontZ, wheelRadius, wheelWidth, 'FrontL', discMat, caliperMat, tireMat, rimMat);
  addWheelAssembly(root, -xTrack, wheelRadius, axleFrontZ, wheelRadius, wheelWidth, 'FrontR', discMat, caliperMat, tireMat, rimMat);
  addWheelAssembly(root, xTrack, wheelRadius, axleRearZ, wheelRadius, wheelWidth, 'RearL', discMat, caliperMat, tireMat, rimMat);
  addWheelAssembly(root, -xTrack, wheelRadius, axleRearZ, wheelRadius, wheelWidth, 'RearR', discMat, caliperMat, tireMat, rimMat);

  const axleGroup = new THREE.Group();
  axleGroup.name = 'Axles';
  const fAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, xTrack * 1.9, 10), discMat);
  fAxle.rotation.z = Math.PI / 2;
  fAxle.position.set(0, wheelRadius, axleFrontZ);
  fAxle.name = 'FrontAxle';
  const rAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, xTrack * 1.9, 10), discMat);
  rAxle.rotation.z = Math.PI / 2;
  rAxle.position.set(0, wheelRadius, axleRearZ);
  rAxle.name = 'RearAxle';
  axleGroup.add(fAxle, rAxle);
  root.add(axleGroup);

  // System anchors from spec (+Z is forward!)
  for (const [sysId, pos] of Object.entries(spec.anchors)) {
    addAnchor(root, `Anchor_${sysId}`, pos[0], pos[1], pos[2]);
  }

  return root;
}

const SEDAN_SPEC = {
  id: 'sedan',
  powertrain: 'petrol',
  paintColor: '#2d4a6d',
  width: 1.76,
  cabinWidth: 1.44,
  clearance: 0.2,
  beltY: 0.88,
  bumperH: 0.24,
  grilleH: 0.22,
  frontZ: 2.22,
  rearZ: -2.22,
  mirrorZ: 0.72,
  steerZ: 0.56,
  wheelRadius: 0.34,
  wheelWidth: 0.23,
  axleFrontZ: 1.4,
  axleRearZ: -1.36,
  // Upper deck silhouette points from front lip up over hood/waistline to rear bumper top
  upperDeck: [
    [2.22, 0.54],
    [2.05, 0.76],
    [1.06, 0.87],
    [-1.4, 0.9],
    [-2.14, 0.86],
    [-2.22, 0.58],
  ],
  hoodProfile: [
    [1.06, 0.83],
    [2.12, 0.74],
    [2.12, 0.8],
    [1.06, 0.9],
  ],
  trunkProfile: [
    [-2.16, 0.82],
    [-1.44, 0.88],
    [-1.44, 0.94],
    [-2.14, 0.88],
  ],
  roofProfile: [
    [-1.45, 0.89],
    [-0.95, 1.38],
    [0.42, 1.38],
    [1.05, 0.87],
    [0.95, 0.87],
    [0.36, 1.3],
    [-0.88, 1.3],
    [-1.36, 0.89],
  ],
  glassProfile: [
    [-1.34, 0.91],
    [-0.86, 1.31],
    [0.35, 1.31],
    [0.92, 0.91],
  ],
  anchors: {
    engine: [0, 0.62, 1.56],
    transmission: [0, 0.42, 0.88],
    brakes: [0.8, 0.34, 1.4],
    suspension: [0.76, 0.52, -1.36],
    steering: [0.34, 0.94, 0.56],
    electrical: [-0.46, 0.64, 1.24],
    cooling: [0, 0.48, 2.08],
    exhaust: [0.36, 0.26, -1.96],
  },
};

const SUV_SPEC = {
  id: 'suv',
  powertrain: 'diesel',
  paintColor: '#3f5244',
  width: 1.9,
  cabinWidth: 1.56,
  clearance: 0.28,
  beltY: 1.02,
  bumperH: 0.28,
  grilleH: 0.28,
  frontZ: 2.26,
  rearZ: -2.2,
  mirrorZ: 0.72,
  steerZ: 0.52,
  wheelRadius: 0.39,
  wheelWidth: 0.26,
  axleFrontZ: 1.44,
  axleRearZ: -1.4,
  roofRails: { y: 1.67, z: -0.58, length: 1.72 },
  upperDeck: [
    [2.26, 0.62],
    [2.16, 0.96],
    [1.04, 1.05],
    [-1.92, 1.05],
    [-2.18, 0.98],
    [-2.2, 0.64],
  ],
  hoodProfile: [
    [1.04, 1.0],
    [2.18, 0.94],
    [2.18, 1.01],
    [1.04, 1.08],
  ],
  tailgateProfile: [
    [-2.15, 0.95],
    [-1.78, 1.62],
    [-1.68, 1.62],
    [-2.04, 0.95],
  ],
  roofProfile: [
    [-2.05, 1.02],
    [-1.74, 1.64],
    [0.38, 1.64],
    [1.05, 1.04],
    [0.92, 1.04],
    [0.32, 1.54],
    [-1.65, 1.54],
    [-1.95, 1.02],
  ],
  glassProfile: [
    [-1.92, 1.06],
    [-1.62, 1.55],
    [0.31, 1.55],
    [0.88, 1.06],
  ],
  anchors: {
    engine: [0, 0.74, 1.62],
    transmission: [0, 0.48, 0.88],
    brakes: [0.86, 0.39, 1.44],
    suspension: [0.82, 0.64, -1.4],
    steering: [0.36, 1.08, 0.52],
    electrical: [-0.5, 0.76, 1.28],
    cooling: [0, 0.6, 2.12],
    exhaust: [0.42, 0.32, -1.98],
  },
};

const HATCHBACK_SPEC = {
  id: 'hatchback',
  powertrain: 'petrol',
  paintColor: '#b45309',
  width: 1.72,
  cabinWidth: 1.4,
  clearance: 0.18,
  beltY: 0.86,
  bumperH: 0.22,
  grilleH: 0.2,
  frontZ: 1.98,
  rearZ: -1.86,
  mirrorZ: 0.6,
  steerZ: 0.44,
  wheelRadius: 0.32,
  wheelWidth: 0.21,
  axleFrontZ: 1.26,
  axleRearZ: -1.2,
  upperDeck: [
    [1.98, 0.5],
    [1.86, 0.72],
    [0.92, 0.86],
    [-1.62, 0.9],
    [-1.84, 0.84],
    [-1.86, 0.54],
  ],
  hoodProfile: [
    [0.92, 0.82],
    [1.88, 0.7],
    [1.88, 0.77],
    [0.92, 0.89],
  ],
  tailgateProfile: [
    [-1.8, 0.84],
    [-1.34, 1.4],
    [-1.24, 1.4],
    [-1.68, 0.84],
  ],
  roofProfile: [
    [-1.72, 0.88],
    [-1.3, 1.42],
    [0.34, 1.42],
    [0.92, 0.86],
    [0.82, 0.86],
    [0.28, 1.33],
    [-1.2, 1.33],
    [-1.62, 0.88],
  ],
  glassProfile: [
    [-1.6, 0.91],
    [-1.18, 1.34],
    [0.27, 1.34],
    [0.78, 0.91],
  ],
  anchors: {
    engine: [0, 0.58, 1.42],
    transmission: [0, 0.4, 0.82],
    brakes: [0.78, 0.32, 1.26],
    suspension: [0.74, 0.5, -1.2],
    steering: [0.32, 0.92, 0.44],
    electrical: [-0.44, 0.62, 1.12],
    cooling: [0, 0.46, 1.84],
    exhaust: [0.34, 0.24, -1.66],
  },
};

const EV_SPEC = {
  id: 'ev',
  powertrain: 'ev',
  paintColor: '#475569',
  width: 1.82,
  cabinWidth: 1.46,
  clearance: 0.17,
  beltY: 0.86,
  bumperH: 0.22,
  grilleH: 0.16,
  frontZ: 2.24,
  rearZ: -2.2,
  mirrorZ: 0.72,
  steerZ: 0.56,
  wheelRadius: 0.35,
  wheelWidth: 0.24,
  axleFrontZ: 1.46,
  axleRearZ: -1.42,
  upperDeck: [
    [2.24, 0.48],
    [2.12, 0.72],
    [1.12, 0.86],
    [-1.82, 0.92],
    [-2.14, 0.86],
    [-2.2, 0.56],
  ],
  hoodProfile: [
    [1.12, 0.81],
    [2.14, 0.7],
    [2.14, 0.76],
    [1.12, 0.88],
  ],
  trunkProfile: [
    [-2.16, 0.84],
    [-1.62, 0.92],
    [-1.62, 0.98],
    [-2.14, 0.9],
  ],
  roofProfile: [
    [-1.88, 0.89],
    [-0.82, 1.38],
    [0.36, 1.38],
    [1.1, 0.86],
    [1.0, 0.86],
    [0.3, 1.3],
    [-0.76, 1.3],
    [-1.76, 0.89],
  ],
  glassProfile: [
    [-1.74, 0.91],
    [-0.76, 1.31],
    [0.29, 1.31],
    [0.96, 0.91],
  ],
  anchors: {
    engine: [0, 0.46, 1.46],
    transmission: [0, 0.42, 1.1],
    brakes: [0.82, 0.35, 1.46],
    suspension: [0.78, 0.52, -1.42],
    steering: [0.34, 0.92, 0.56],
    electrical: [0, 0.28, 0.05],
    cooling: [0, 0.44, 2.08],
  },
};

async function exportGlb(filename, group) {
  const exporter = new GLTFExporter();
  const ab = await exporter.parseAsync(group, { binary: true });
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(ab));
  console.log(`Generated ${outPath} (${(ab.byteLength / 1024).toFixed(1)} KB)`);
}

await exportGlb('Sedan.glb', buildStructuredCar(SEDAN_SPEC));
await exportGlb('SUV.glb', buildStructuredCar(SUV_SPEC));
await exportGlb('Hatchback.glb', buildStructuredCar(HATCHBACK_SPEC));
await exportGlb('EV.glb', buildStructuredCar(EV_SPEC));
