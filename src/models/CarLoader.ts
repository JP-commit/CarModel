import gsap from 'gsap';
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarManifestEntry } from '../data/cars';
import { SYSTEM_MAP } from '../data/systems';
import {
  createMeshOutline,
  createSilhouetteHullMaterial,
  updateOutlineResolution,
} from '../scene/OutlineBuilder';
import { disposeObject3D } from '../scene/SceneManager';
import type { LayerVisibility, RenderMode, SystemId } from '../state/appState';
import { createFlowStream } from './ProceduralHelpers';

export interface CarRig {
  car: CarManifestEntry;
  availableSystems: SystemId[];
  root: THREE.Group;
  anchors: Partial<Record<SystemId, THREE.Vector3>>;
  outwardNormals: Partial<Record<SystemId, THREE.Vector3>>;
  hotspotMeshes: THREE.Mesh[];
  setXRay: (enabled: boolean, reduceMotion: boolean) => void;
  setRenderMode: (
    mode: RenderMode,
    layers: LayerVisibility,
    xray: boolean,
    reduceMotion: boolean,
  ) => void;
  setLayers: (layers: LayerVisibility) => void;
  setResolution: (width: number, height: number) => void;
  setExplode: (amount: number) => void;
  setTourFlow: (enabled: boolean, phase: number) => void;
  highlightSystem: (systemId: SystemId | null) => void;
  getSystemFocus: (
    systemId: SystemId,
    aspect: number,
    customOffset?: [number, number, number],
  ) => { target: THREE.Vector3; cameraPos: THREE.Vector3 };
  dispose: () => void;
}

interface MeshStyleRecord {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  outlineFillMaterial: THREE.Material;
  isShell: boolean;
  systemIds: Set<SystemId>;
  outlineLine: LineSegments2 | null;
  silhouetteHull: THREE.Mesh | null;
  accentHighlightLine: LineSegments2 | null;
}

interface InternalSystemRecord {
  systemId: SystemId;
  mesh: THREE.Mesh;
  dashedLine: LineSegments2 | null;
  solidAccentLine: LineSegments2 | null;
}

interface ExplodableNode {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  localOffset: THREE.Vector3;
}

// In-memory model binary buffer cache so re-selecting a car skips network transfers
const modelBufferCache = new Map<string, ArrayBuffer>();

async function fetchModelBufferWithProgress(
  url: string,
  onProgress: (percent: number, label: string) => void,
): Promise<ArrayBuffer> {
  const cached = modelBufferCache.get(url);
  if (cached) {
    onProgress(78, 'Loading cached 3D vehicle…');
    return cached;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} loading ${url}`);
  }

  const contentLength = Number(res.headers.get('content-length') ?? 0);
  if (!res.body || contentLength <= 0) {
    const buf = await res.arrayBuffer();
    modelBufferCache.set(url, buf);
    onProgress(82, 'Parsing 3D car geometry…');
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const pct = Math.min(82, Math.max(10, Math.round((loaded / contentLength) * 72) + 10));
    onProgress(pct, 'Streaming 3D car mesh…');
  }

  const combined = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }
  const buffer = combined.buffer;
  modelBufferCache.set(url, buffer);
  return buffer;
}

function getBoundingBoxApproxAnchor(
  systemId: SystemId,
  box: THREE.Box3,
  frontSign: number,
): THREE.Vector3 {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const minY = box.min.y;

  const frac = (fx: number, fy: number, fzFront: number) =>
    new THREE.Vector3(
      center.x + fx * size.x,
      minY + fy * size.y,
      center.z + frontSign * fzFront * size.z,
    );

  switch (systemId) {
    case 'engine':
      return frac(0, 0.42, 0.31);
    case 'transmission':
      return frac(0, 0.3, 0.15);
    case 'brakes':
      return frac(0.45, 0.28, 0.28);
    case 'suspension':
      return frac(0.45, 0.42, -0.28);
    case 'steering':
      return frac(0.18, 0.62, 0.14);
    case 'electrical':
      return frac(-0.26, 0.44, 0.23);
    case 'cooling':
      return frac(0, 0.34, 0.46);
    case 'exhaust':
      return frac(0.2, 0.2, -0.42);
  }
}

function getSystemOutwardNormal(systemId: SystemId, frontSign: number): THREE.Vector3 {
  switch (systemId) {
    case 'engine':
      return new THREE.Vector3(0.15, 0.85, frontSign * 0.5).normalize();
    case 'transmission':
      return new THREE.Vector3(0.7, 0.35, frontSign * 0.3).normalize();
    case 'brakes':
      return new THREE.Vector3(1, 0.15, 0.1).normalize();
    case 'suspension':
      return new THREE.Vector3(0.95, 0.3, -frontSign * 0.15).normalize();
    case 'steering':
      return new THREE.Vector3(0.2, 0.85, frontSign * 0.45).normalize();
    case 'electrical':
      return new THREE.Vector3(-0.65, 0.65, frontSign * 0.35).normalize();
    case 'cooling':
      return new THREE.Vector3(0, 0.25, frontSign).normalize();
    case 'exhaust':
      return new THREE.Vector3(0.4, 0.2, -frontSign).normalize();
  }
}

export async function loadCarFromManifest(
  car: CarManifestEntry,
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  onProgress: (percent: number, label: string) => void,
  initialRenderMode: RenderMode = 'outline',
  initialLayers: LayerVisibility = { outline: true, mesh: true, innerSystems: true },
): Promise<CarRig> {
  onProgress(6, `Loading ${car.name}…`);

  const glbBuffer = await fetchModelBufferWithProgress(car.modelFile, onProgress);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/libs/draco/');

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const gltf = await new Promise<GLTF>((resolve, reject) => {
    gltfLoader.parse(glbBuffer, '/', resolve, reject);
  });
  dracoLoader.dispose();

  onProgress(90, `Preparing ${car.name} outlines & hotspots…`);

  const root = new THREE.Group();
  root.name = `CarRoot_${car.id}`;

  const model = gltf.scene;
  root.add(model);

  // Normalize car dimensions cleanly so longest horizontal axis ~4.25m, resting on Y = 0
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
  const scaleFactor = 4.25 / maxDim;
  model.scale.setScalar(scaleFactor);

  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
  model.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(model);
  const carSize = finalBox.getSize(new THREE.Vector3());

  // Determine front orientation (+Z or -Z) from engine/cooling manifest anchor or default +1
  const resolveNodeWorldCenter = (nodeName: string | undefined): THREE.Vector3 | null => {
    if (!nodeName) return null;
    const obj = model.getObjectByName(nodeName);
    if (!obj) return null;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      return obj.getWorldPosition(new THREE.Vector3());
    }
    return box.getCenter(new THREE.Vector3());
  };

  const hintFrontPos =
    resolveNodeWorldCenter(car.systems.engine?.anchorNode) ??
    resolveNodeWorldCenter(car.systems.cooling?.anchorNode);
  const frontSign = hintFrontPos && hintFrontPos.z < -0.1 ? -1 : 1;

  const availableSystems = Object.keys(car.systems) as SystemId[];
  const anchors: Partial<Record<SystemId, THREE.Vector3>> = {};
  const outwardNormals: Partial<Record<SystemId, THREE.Vector3>> = {};

  for (const sysId of availableSystems) {
    const sysCfg = car.systems[sysId];
    const resolved = resolveNodeWorldCenter(sysCfg?.anchorNode);
    if (resolved) {
      anchors[sysId] = resolved;
    } else {
      console.warn(
        `[HowCarsWork] Car "${car.id}" lacks anchor node "${sysCfg?.anchorNode ?? '(none)'}" for system "${sysId}" — falling back to body bounding box.`,
      );
      anchors[sysId] = getBoundingBoxApproxAnchor(sysId, finalBox, frontSign);
    }
    outwardNormals[sysId] = getSystemOutwardNormal(sysId, frontSign);
  }

  // Materials for Outline Mode vs Solid Mode + X-Ray
  const solidXrayShellMat = new THREE.MeshPhysicalMaterial({
    color: '#64748b',
    roughness: 0.36,
    metalness: 0.14,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outlineXrayShellMat = new THREE.MeshStandardMaterial({
    color: '#f2f1ec',
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outlineBodyMat = new THREE.MeshStandardMaterial({
    color: '#f5f4ef',
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const outlineTrimMat = new THREE.MeshStandardMaterial({
    color: '#e8e6df',
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const outlineGlassMat = new THREE.MeshStandardMaterial({
    color: '#e5e4dd',
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const outlineHiddenFillMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });

  const outlineActiveFillMat = new THREE.MeshBasicMaterial({
    color: '#d93a1e',
    transparent: true,
    opacity: 0.24,
    depthTest: false,
    depthWrite: false,
  });

  const drawBufSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const primaryInkMat = new LineMaterial({
    color: 0x1c1b19,
    linewidth: 1.9 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    resolution: drawBufSize.clone(),
  });

  const silhouetteHullMat = createSilhouetteHullMaterial('#1c1b19', 1.65, drawBufSize);

  const activeAccentLineMat = new LineMaterial({
    color: 0xd93a1e,
    linewidth: 2.8 * dpr,
    transparent: false,
    depthTest: false,
    depthWrite: false,
    resolution: drawBufSize.clone(),
  });

  // Invert manifest meshNames list for O(1) system highlighting lookup
  const meshNameToSystems = new Map<string, Set<SystemId>>();
  for (const sysId of availableSystems) {
    const names = car.systems[sysId]?.meshNames ?? [];
    for (const mName of names) {
      const set = meshNameToSystems.get(mName) ?? new Set<SystemId>();
      set.add(sysId);
      meshNameToSystems.set(mName, set);
    }
  }

  const sourceMeshes: THREE.Mesh[] = [];
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData.isOutlineChild) {
      sourceMeshes.push(mesh);
    }
  });

  const shellPattern = /(BodyHood|BodyRoof|BodyDoor|BodyPanels|BodyRearPanels|BodyPillars|BodyTaillightsPanels|BodySide)/i;
  const glassPattern = /(Windshield|Window|Rearwindow|Glass)/i;
  const wheelTrimPattern = /(Wheel|Tire|Axle|Brake|InteriorSteering|Pedal|Grille|Bumper|EVBatteryPack|EVDriveUnit|RoofRail)/i;
  const skipEdgePattern =
    /(Gasket|Wipers|BodyHoodInterior|InteriorSeats|InteriorFloor|InteriorDash|InteriorCage|InteriorDoor)/i;

  const meshRecords: MeshStyleRecord[] = [];

  for (const mesh of sourceMeshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isGlass = glassPattern.test(mesh.name);
    for (const mat of mats) {
      if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0) {
        isGlass = true;
        mat.transmission = 0;
        mat.transparent = true;
        mat.color.set('#334155');
        mat.opacity = 0.42;
        mat.roughness = 0.08;
        mat.envMapIntensity = 0.65;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    }

    const isShell = shellPattern.test(mesh.name);
    const skipEdges = skipEdgePattern.test(mesh.name);
    const isWheelOrMech = wheelTrimPattern.test(mesh.name);
    const sysSet = meshNameToSystems.get(mesh.name) ?? new Set<SystemId>();

    const outlineFillMaterial = isGlass
      ? outlineGlassMat
      : isWheelOrMech
        ? outlineTrimMat
        : outlineBodyMat;

    let outlineLine: LineSegments2 | null = null;
    let silhouetteHull: THREE.Mesh | null = null;
    let accentHighlightLine: LineSegments2 | null = null;

    if (!skipEdges) {
      const thresholdAngle = isWheelOrMech ? 34 : 25;
      const tmpLine = createMeshOutline(mesh, {
        color: '#1c1b19',
        linewidthPx: 1.9,
        thresholdAngle,
        resolution: drawBufSize.clone(),
      });
      if (tmpLine) {
        tmpLine.material.dispose();
        tmpLine.material = primaryInkMat;
        tmpLine.userData.baseLinewidthPx = 1.9;
        mesh.add(tmpLine);
        outlineLine = tmpLine;

        if (sysSet.size > 0) {
          const accLine = new LineSegments2(tmpLine.geometry, activeAccentLineMat);
          accLine.name = `${mesh.name}_AccentOutline`;
          accLine.userData.isOutlineChild = true;
          accLine.userData.baseLinewidthPx = 2.8;
          accLine.renderOrder = 9;
          accLine.visible = false;
          mesh.add(accLine);
          accentHighlightLine = accLine;
        }
      }
    }

    if (isShell && mesh.geometry.attributes.normal) {
      const hull = new THREE.Mesh(mesh.geometry, silhouetteHullMat);
      hull.name = `${mesh.name}_Silhouette`;
      hull.userData.isOutlineChild = true;
      hull.userData.isSilhouetteHull = true;
      hull.userData.baseLinewidthPx = 1.65;
      hull.renderOrder = 1;
      mesh.add(hull);
      silhouetteHull = hull;
    }

    meshRecords.push({
      mesh,
      originalMaterial: mesh.material,
      outlineFillMaterial,
      isShell,
      systemIds: sysSet,
      outlineLine,
      silhouetteHull,
      accentHighlightLine,
    });
  }

  // Transform world-space explode directions cleanly into any glTF node's local parent coordinate space
  const explodableNodes: ExplodableNode[] = [];
  const tempQuat = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const addWorldExplodable = (nodeNames: string[], worldOffset: [number, number, number]) => {
    for (const name of nodeNames) {
      const obj = model.getObjectByName(name);
      if (obj) {
        const localOffset = new THREE.Vector3(...worldOffset);
        if (obj.parent) {
          obj.parent.getWorldQuaternion(tempQuat);
          obj.parent.getWorldScale(tempScale);
          localOffset.applyQuaternion(tempQuat.invert());
          localOffset.divide(
            new THREE.Vector3(
              Math.max(Math.abs(tempScale.x), 0.001),
              Math.max(Math.abs(tempScale.y), 0.001),
              Math.max(Math.abs(tempScale.z), 0.001),
            ),
          );
        }
        explodableNodes.push({
          obj,
          basePos: obj.position.clone(),
          localOffset,
        });
      }
    }
  };

  addWorldExplodable(['BodyHood'], [0, 0.34, frontSign * 0.38]);
  addWorldExplodable(['BodyRoofPanel'], [0, 0.36, 0]);
  addWorldExplodable(['BodyRearPanels', 'BodyRearPanelsColor1'], [0, 0.28, -frontSign * 0.32]);
  addWorldExplodable(['WheelFrontL', 'WheelRearL'], [0.35, 0, 0]);
  addWorldExplodable(['WheelFrontR', 'WheelRearR'], [-0.35, 0, 0]);

  const hoodObj = model.getObjectByName('BodyHood');
  const hoodBasePos = hoodObj ? hoodObj.position.clone() : new THREE.Vector3();
  const hoodWorldUpLocal = new THREE.Vector3(0, 0.14, 0);
  if (hoodObj?.parent) {
    hoodObj.parent.getWorldQuaternion(tempQuat);
    hoodObj.parent.getWorldScale(tempScale);
    hoodWorldUpLocal
      .applyQuaternion(tempQuat.invert())
      .divide(new THREE.Vector3(Math.max(tempScale.x, 0.001), Math.max(tempScale.y, 0.001), Math.max(tempScale.z, 0.001)));
  }

  // Internal schematic assemblies adapted dynamically to the car's dimensions, anchors & powertrain
  const internalGroup = new THREE.Group();
  internalGroup.name = 'InternalXRaySystems';
  root.add(internalGroup);

  const dashedLineMat = new LineMaterial({
    color: 0x45413a,
    linewidth: 1.25 * dpr,
    dashed: true,
    dashScale: 1,
    dashSize: 0.055,
    gapSize: 0.036,
    transparent: true,
    opacity: 0.56,
    depthTest: false,
    depthWrite: false,
    resolution: drawBufSize.clone(),
  });

  const internalRecords: InternalSystemRecord[] = [];
  const registerInternalPart = (
    id: SystemId,
    geo: THREE.BufferGeometry,
    pos: THREE.Vector3,
    rot?: [number, number, number],
  ) => {
    const solidMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      emissive: '#d93a1e',
      emissiveIntensity: 0.08,
      roughness: 0.34,
      metalness: 0.55,
      transparent: true,
      opacity: 0.52,
    });
    const mesh = new THREE.Mesh(geo, solidMat);
    mesh.position.copy(pos);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.userData.solidMaterial = solidMat;
    internalGroup.add(mesh);

    const dashedLine = createMeshOutline(mesh, {
      color: '#45413a',
      linewidthPx: 1.25,
      thresholdAngle: 48,
      dashed: true,
      dashSize: 0.055,
      gapSize: 0.036,
      opacity: 0.56,
      depthTest: false,
      renderOrder: 6,
      resolution: drawBufSize.clone(),
    });
    if (dashedLine) {
      dashedLine.material.dispose();
      dashedLine.material = dashedLineMat;
      dashedLine.computeLineDistances();
      dashedLine.renderOrder = 6;
      mesh.add(dashedLine);
    }

    const solidAccentLine = createMeshOutline(mesh, {
      color: '#d93a1e',
      linewidthPx: 2.8,
      thresholdAngle: 48,
      depthTest: false,
      renderOrder: 9,
      resolution: drawBufSize.clone(),
    });
    if (solidAccentLine) {
      solidAccentLine.material.dispose();
      solidAccentLine.material = activeAccentLineMat;
      solidAccentLine.renderOrder = 9;
      solidAccentLine.visible = false;
      mesh.add(solidAccentLine);
    }

    internalRecords.push({
      systemId: id,
      mesh,
      dashedLine,
      solidAccentLine,
    });
  };

  const has = (id: SystemId) => Boolean(anchors[id]);
  const aEngine = anchors.engine ?? getBoundingBoxApproxAnchor('engine', finalBox, frontSign);
  const aBrakes = anchors.brakes ?? getBoundingBoxApproxAnchor('brakes', finalBox, frontSign);
  const aSusp = anchors.suspension ?? getBoundingBoxApproxAnchor('suspension', finalBox, frontSign);
  const aSteer = anchors.steering ?? getBoundingBoxApproxAnchor('steering', finalBox, frontSign);

  if (has('engine')) {
    if (car.powertrain === 'ev') {
      // Compact front EV cylindrical traction drive unit + top inverter fin housing
      registerInternalPart(
        'engine',
        new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12),
        anchors.engine!,
        [0, 0, Math.PI / 2],
      );
      registerInternalPart(
        'engine',
        new THREE.BoxGeometry(0.32, 0.12, 0.24),
        anchors.engine!.clone().add(new THREE.Vector3(0, 0.16, 0)),
      );
    } else {
      registerInternalPart('engine', new THREE.BoxGeometry(0.46, 0.28, 0.48), anchors.engine!);
      registerInternalPart(
        'engine',
        new THREE.BoxGeometry(0.32, 0.11, 0.44),
        anchors.engine!.clone().add(new THREE.Vector3(0, 0.18, 0)),
      );
    }
  }

  if (has('transmission')) {
    registerInternalPart(
      'transmission',
      new THREE.BoxGeometry(0.28, 0.24, 0.44),
      anchors.transmission!,
    );
    if (car.powertrain !== 'ev') {
      registerInternalPart(
        'transmission',
        new THREE.BoxGeometry(0.055, 0.055, Math.abs(aEngine.z - aSusp.z) * 0.7),
        new THREE.Vector3(0, finalBox.min.y + carSize.y * 0.24, (aEngine.z + aSusp.z) * 0.5),
      );
    }
  }

  if (has('brakes')) {
    registerInternalPart(
      'brakes',
      new THREE.CylinderGeometry(0.17, 0.17, 0.045, 10),
      aBrakes,
      [0, 0, Math.PI / 2],
    );
  }

  if (has('suspension')) {
    registerInternalPart(
      'suspension',
      new THREE.BoxGeometry(0.09, 0.28, 0.09),
      aSusp.clone().add(new THREE.Vector3(-0.08, 0.14, 0)),
    );
  }

  if (has('steering')) {
    registerInternalPart(
      'steering',
      new THREE.BoxGeometry(carSize.x * 0.62, 0.045, 0.045),
      new THREE.Vector3(0, aBrakes.y, aBrakes.z),
    );
    const steerColMid = aSteer.clone().lerp(new THREE.Vector3(0, aBrakes.y, aBrakes.z), 0.5);
    registerInternalPart(
      'steering',
      new THREE.BoxGeometry(0.04, 0.04, 0.54),
      steerColMid,
      [Math.PI / 4, 0, 0],
    );
  }

  if (has('electrical')) {
    if (car.powertrain === 'ev') {
      // Underfloor EV HV skateboard battery tray + orange inverter box
      registerInternalPart(
        'electrical',
        new THREE.BoxGeometry(carSize.x * 0.56, 0.1, carSize.z * 0.44),
        new THREE.Vector3(0, finalBox.min.y + 0.24, 0),
      );
    } else {
      registerInternalPart(
        'electrical',
        new THREE.BoxGeometry(0.24, 0.15, 0.18),
        anchors.electrical!,
      );
    }
  }

  if (has('cooling')) {
    registerInternalPart(
      'cooling',
      new THREE.BoxGeometry(0.56, 0.28, 0.06),
      anchors.cooling!,
    );
  }

  if (has('exhaust') && car.powertrain !== 'ev') {
    const aExh = anchors.exhaust!;
    const exhLen = Math.abs(aEngine.z - aExh.z);
    registerInternalPart(
      'exhaust',
      new THREE.BoxGeometry(0.05, 0.05, exhLen),
      new THREE.Vector3(aExh.x, finalBox.min.y + 0.2, (aEngine.z + aExh.z) * 0.5),
    );
    registerInternalPart(
      'exhaust',
      new THREE.BoxGeometry(0.16, 0.12, 0.36),
      aExh,
    );
  }

  // Guided Tour animated energy flow path adapted to car powertrain
  const flowPts =
    car.powertrain === 'ev'
      ? [
          new THREE.Vector3(-0.3, 0.26, -frontSign * 0.8),
          new THREE.Vector3(0, 0.26, 0.2),
          aEngine.clone(),
          aBrakes.clone().setX(0.4),
          aSusp.clone().setX(0.4),
        ]
      : [
          new THREE.Vector3(-0.2, 0.28, -frontSign * 1.15),
          aEngine.clone(),
          anchors.transmission ?? getBoundingBoxApproxAnchor('transmission', finalBox, frontSign),
          aBrakes.clone().setX(0.45),
          anchors.exhaust ?? getBoundingBoxApproxAnchor('exhaust', finalBox, frontSign),
        ];

  const tourFlowCurve = new THREE.CatmullRomCurve3(flowPts);
  const tourPipe = new THREE.Mesh(
    new THREE.TubeGeometry(tourFlowCurve, 64, 0.014, 8, false),
    new THREE.MeshBasicMaterial({ color: '#d93a1e', transparent: true, opacity: 0.36 }),
  );
  const tourStream = createFlowStream(tourFlowCurve, 14, '#d93a1e', 0.026, 0.08);
  const tourFlowGroup = new THREE.Group();
  tourFlowGroup.add(tourPipe, tourStream.mesh);
  tourFlowGroup.visible = false;
  root.add(tourFlowGroup);

  // Invisible 3D raycast hit spheres for available car systems
  const hotspotMeshes: THREE.Mesh[] = [];
  const hotspotGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const hotspotHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (const sysId of availableSystems) {
    const sphere = new THREE.Mesh(hotspotGeo, hotspotHitMat);
    sphere.position.copy(anchors[sysId]!);
    sphere.userData.systemId = sysId;
    sphere.name = `Hotspot_${sysId}`;
    root.add(sphere);
    hotspotMeshes.push(sphere);
  }

  scene.add(root);

  let currentRenderMode: RenderMode = initialRenderMode;
  let currentLayers: LayerVisibility = { ...initialLayers };
  let isXRayOn = false;
  let currentExplode = 0;
  let activeSystem: SystemId | null = null;

  // Pre-compile X-ray materials once for smooth runtime transitions
  for (const rec of meshRecords) {
    if (rec.isShell) rec.mesh.material = solidXrayShellMat;
  }
  internalGroup.visible = true;
  renderer.compile(scene, camera);

  const applyHoodOffset = (xrayEnabled: boolean, explodeAmt: number, reduceMotion: boolean) => {
    if (!hoodObj) return;
    const explodeRec = explodableNodes.find((n) => n.obj === hoodObj);
    const targetPos = hoodBasePos.clone();
    if (explodeRec) {
      targetPos.addScaledVector(explodeRec.localOffset, explodeAmt);
    }
    if (xrayEnabled) {
      targetPos.add(hoodWorldUpLocal);
    }
    const duration = reduceMotion ? 0.01 : 0.3;
    gsap.killTweensOf(hoodObj.position);
    gsap.to(hoodObj.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration,
      ease: 'power2.out',
    });
  };

  const syncVisuals = (reduceMotion: boolean) => {
    const isOutline = currentRenderMode === 'outline';

    for (const rec of meshRecords) {
      const meshActive = isOutline && activeSystem !== null && rec.systemIds.has(activeSystem);

      if (rec.outlineLine) {
        rec.outlineLine.visible = isOutline && currentLayers.outline && !meshActive;
      }
      if (rec.silhouetteHull) {
        rec.silhouetteHull.visible =
          isOutline && currentLayers.outline && currentLayers.mesh && !isXRayOn;
      }
      if (rec.accentHighlightLine) {
        rec.accentHighlightLine.visible = meshActive;
      }

      if (isOutline) {
        if (meshActive) {
          rec.mesh.material = outlineActiveFillMat;
        } else if (!currentLayers.mesh) {
          rec.mesh.material = outlineHiddenFillMat;
        } else if (isXRayOn && rec.isShell) {
          rec.mesh.material = outlineXrayShellMat;
        } else {
          rec.mesh.material = rec.outlineFillMaterial;
        }
      } else {
        rec.mesh.material = isXRayOn && rec.isShell ? solidXrayShellMat : rec.originalMaterial;
      }
    }

    internalGroup.visible = isOutline
      ? currentLayers.innerSystems
      : isXRayOn || currentExplode > 0.05;

    for (const rec of internalRecords) {
      const isActive = rec.systemId === activeSystem;
      if (isOutline) {
        rec.mesh.material = isActive ? outlineActiveFillMat : outlineHiddenFillMat;
        rec.mesh.renderOrder = isActive ? 7 : 1;
        if (rec.dashedLine) rec.dashedLine.visible = !isActive;
        if (rec.solidAccentLine) rec.solidAccentLine.visible = isActive;
      } else {
        const solidMat = rec.mesh.userData.solidMaterial as THREE.MeshStandardMaterial;
        solidMat.color.set(isActive ? '#d93a1e' : '#cbd5e1');
        solidMat.emissive.set('#d93a1e');
        solidMat.emissiveIntensity = isActive ? 0.9 : 0.08;
        solidMat.opacity = isActive ? 0.96 : 0.48;
        rec.mesh.material = solidMat;
        rec.mesh.renderOrder = 2;
        if (rec.dashedLine) rec.dashedLine.visible = false;
        if (rec.solidAccentLine) rec.solidAccentLine.visible = false;
      }
    }

    gsap.killTweensOf(solidXrayShellMat);
    if (!isOutline && isXRayOn) {
      solidXrayShellMat.opacity = reduceMotion ? 0.16 : 0.55;
      gsap.to(solidXrayShellMat, {
        opacity: 0.16,
        duration: reduceMotion ? 0.01 : 0.3,
        ease: 'power2.out',
      });
    }

    dashedLineMat.opacity = isXRayOn ? 0.78 : 0.54;
  };

  syncVisuals(true);

  const setXRay = (enabled: boolean, reduceMotion: boolean) => {
    isXRayOn = enabled;
    syncVisuals(reduceMotion);
    applyHoodOffset(enabled, currentExplode, reduceMotion);
  };

  const setRenderMode = (
    mode: RenderMode,
    layers: LayerVisibility,
    xray: boolean,
    reduceMotion: boolean,
  ) => {
    currentRenderMode = mode;
    currentLayers = { ...layers };
    isXRayOn = xray;
    syncVisuals(reduceMotion);
    applyHoodOffset(xray, currentExplode, reduceMotion);
  };

  const setLayers = (layers: LayerVisibility) => {
    currentLayers = { ...layers };
    syncVisuals(true);
  };

  const setResolution = (width: number, height: number) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    primaryInkMat.resolution.set(width * ratio, height * ratio);
    primaryInkMat.linewidth = 1.9 * ratio;
    dashedLineMat.resolution.set(width * ratio, height * ratio);
    dashedLineMat.linewidth = 1.25 * ratio;
    activeAccentLineMat.resolution.set(width * ratio, height * ratio);
    activeAccentLineMat.linewidth = 2.8 * ratio;
    updateOutlineResolution(root, width, height);
  };

  const setExplode = (amount: number) => {
    currentExplode = Math.max(0, Math.min(1, amount));
    if (hoodObj) gsap.killTweensOf(hoodObj.position);
    for (const item of explodableNodes) {
      item.obj.position
        .copy(item.basePos)
        .addScaledVector(item.localOffset, currentExplode);
      if (item.obj === hoodObj && isXRayOn) {
        item.obj.position.add(hoodWorldUpLocal);
      }
    }
    syncVisuals(true);
  };

  const highlightSystem = (systemId: SystemId | null) => {
    activeSystem = systemId;
    syncVisuals(true);
  };

  const getSystemFocus = (
    systemId: SystemId,
    aspect: number,
    customOffset?: [number, number, number],
  ) => {
    const meta = SYSTEM_MAP[systemId];
    const sysManifest = car.systems[systemId];
    const anchor = anchors[systemId] ?? getBoundingBoxApproxAnchor(systemId, finalBox, frontSign);
    const isPortrait = aspect < 0.95;
    const distanceScale = isPortrait ? 1.82 : 1.15;
    const mobileVerticalShift = isPortrait ? -0.44 : 0;

    const tgtOff = sysManifest?.cameraTarget ?? meta.targetOffset;
    const target = anchor
      .clone()
      .add(new THREE.Vector3(tgtOff[0], tgtOff[1] + mobileVerticalShift, tgtOff[2]));

    const camOff = customOffset ?? sysManifest?.cameraOffset ?? meta.cameraOffset;
    const offset = new THREE.Vector3(
      camOff[0] * distanceScale,
      camOff[1] * distanceScale,
      camOff[2] * frontSign * distanceScale,
    );
    const cameraPos = anchor.clone().add(offset);

    if (!isPortrait) {
      const forward = target.clone().sub(cameraPos).normalize();
      const camRight = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      target.addScaledVector(camRight, 0.36);
    }

    return { target, cameraPos };
  };

  onProgress(100, 'Ready');

  return {
    car,
    availableSystems,
    root,
    anchors,
    outwardNormals,
    hotspotMeshes,
    setXRay,
    setRenderMode,
    setLayers,
    setResolution,
    setExplode,
    setTourFlow: (enabled: boolean, phase: number) => {
      tourFlowGroup.visible = enabled;
      if (enabled) tourStream.update(phase);
    },
    highlightSystem,
    getSystemFocus,
    dispose: () => {
      gsap.killTweensOf(solidXrayShellMat);
      if (hoodObj) gsap.killTweensOf(hoodObj.position);
      solidXrayShellMat.dispose();
      outlineXrayShellMat.dispose();
      outlineBodyMat.dispose();
      outlineTrimMat.dispose();
      outlineGlassMat.dispose();
      outlineHiddenFillMat.dispose();
      outlineActiveFillMat.dispose();
      silhouetteHullMat.dispose();
      primaryInkMat.dispose();
      dashedLineMat.dispose();
      activeAccentLineMat.dispose();
      for (const rec of meshRecords) {
        rec.mesh.material = rec.originalMaterial;
      }
      disposeObject3D(root);
    },
  };
}
