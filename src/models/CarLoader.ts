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
import type {
  GraphicsQuality,
  IsolationMode,
  LayerVisibility,
  RenderMode,
  SystemId,
} from '../state/appState';
import { createFlowStream } from './ProceduralHelpers';
import { buildCarInnerRig, type RigPartLabelEntry, type RigPartMetadata } from './rig';

export interface CarRig {
  car: CarManifestEntry;
  availableSystems: SystemId[];
  root: THREE.Group;
  anchors: Partial<Record<SystemId, THREE.Vector3>>;
  systemAnchorObjects: Partial<Record<SystemId, THREE.Object3D>>;
  outwardNormals: Partial<Record<SystemId, THREE.Vector3>>;
  hotspotMeshes: THREE.Mesh[];
  rigPickMeshes: THREE.Mesh[];
  setXRay: (enabled: boolean, reduceMotion: boolean) => void;
  setIsolationMode: (mode: IsolationMode, reduceMotion: boolean) => void;
  setRenderMode: (
    mode: RenderMode,
    layers: LayerVisibility,
    xray: boolean,
    reduceMotion: boolean,
  ) => void;
  setLayers: (layers: LayerVisibility) => void;
  setPaintColor: (colorHex: string) => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setResolution: (width: number, height: number) => void;
  setExplode: (amount: number) => void;
  setTourFlow: (enabled: boolean, phase: number) => void;
  highlightSystem: (systemId: SystemId | null) => void;
  hoverPart: (systemId: SystemId | null, partId: string | null) => void;
  selectPart: (systemId: SystemId | null, partId: string | null) => void;
  getRigPartInfo: (systemId: SystemId, partId: string) => RigPartMetadata | null;
  getExplodedPartLabels: (systemId: SystemId) => RigPartLabelEntry[];
  getExplodeFocusSphere: () => THREE.Sphere | null;
  replaceSystemVariant: (systemId: SystemId, variant?: string) => Promise<void>;
  getSystemBayWarning: (systemId: SystemId) => string | undefined;
  updateActiveSystem: (
    systemId: SystemId,
    dt: number,
    playing: boolean,
    reduceMotion: boolean,
  ) => void;
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
  clonedSolidMaterial: THREE.Material | THREE.Material[] | null;
  outlineFillMaterial: THREE.Material;
  isShell: boolean;
  systemIds: Set<SystemId>;
  outlineLine: LineSegments2 | null;
  silhouetteHull: THREE.Mesh | null;
  accentHighlightLine: LineSegments2 | null;
  solidRimHull: THREE.Mesh | null;
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
  initialIsolationMode: IsolationMode = 'ghost',
  initialPaintColor = 'original',
  initialQuality: GraphicsQuality = 'high',
  initialVariants?: Partial<Record<SystemId, string>>,
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
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outlineGhostFillMat = new THREE.MeshBasicMaterial({
    color: '#e5e4dd',
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const solidGhostShellMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.52,
    metalness: 0.14,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const ghostInkMat = new LineMaterial({
    color: 0x1c1b19,
    linewidth: 1.4 * Math.min(window.devicePixelRatio || 1, 1.5),
    transparent: true,
    opacity: 0.2,
    depthTest: true,
    depthWrite: false,
    resolution: new THREE.Vector2(800, 600),
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

  // Faint depth-tested accent tint (no depthTest: false flat boxes)
  const outlineAccentTintMat = new THREE.MeshBasicMaterial({
    color: '#d93a1e',
    transparent: true,
    opacity: 0.14,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
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
  ghostInkMat.resolution.copy(drawBufSize);

  const silhouetteHullMat = createSilhouetteHullMaterial('#1c1b19', 1.65, drawBufSize);
  const solidRimHullMat = createSilhouetteHullMaterial('#d93a1e', 2.4, drawBufSize);

  const activeAccentLineMat = new LineMaterial({
    color: 0xd93a1e,
    linewidth: 2.8 * dpr,
    transparent: false,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
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

  const nm = car.nodeMap;
  const nmShellSet = new Set<string>([
    ...(nm?.shell ?? []),
    ...(nm?.doors ?? []),
    ...(nm?.hood ? [nm.hood] : []),
  ]);
  const nmGlassSet = new Set<string>(nm?.glass ?? []);
  const nmWheelSet = new Set<string>(
    [nm?.wheels?.fl, nm?.wheels?.fr, nm?.wheels?.rl, nm?.wheels?.rr].filter(
      (x): x is string => Boolean(x),
    ),
  );

  const isNodeOrAncestorInSet = (obj: THREE.Object3D, set: Set<string>): boolean => {
    if (set.size === 0) return false;
    let cur: THREE.Object3D | null = obj;
    while (cur && cur !== model) {
      if (cur.name && set.has(cur.name)) return true;
      cur = cur.parent;
    }
    return false;
  };

  const fallbackShellPattern = /(BodyHood|BodyRoof|BodyDoor|BodyPanels|BodyRearPanels|BodyPillars|BodyTaillightsPanels|BodySide|BodyFrontBumper|BodyRearBumper|BodyFrontGrille|BodyUnderside|BodyShell)/i;
  const glassPattern = /(Windshield|Window|Rearwindow|Glass)/i;
  const wheelTrimPattern = /(Wheel|Tire|Axle|Brake|InteriorSteering|Pedal|Grille|Bumper|EVBatteryPack|EVDriveUnit|RoofRail|rim|tire|rotor)/i;
  const skipEdgePattern =
    /(Gasket|Wipers|BodyHoodInterior|InteriorSeats|InteriorFloor|InteriorDash|InteriorCage|InteriorDoor|^Interior_)/i;

  let currentQuality: GraphicsQuality = initialQuality;
  let currentPaintColor = initialPaintColor;
  const paintMaterialEntries: { mat: THREE.MeshPhysicalMaterial; factoryColor: THREE.Color }[] = [];
  const glassMaterials: THREE.MeshPhysicalMaterial[] = [];
  const normalizedMatCache = new Map<string, THREE.Material>();
  const retiredOriginalMats = new Set<THREE.Material>();

  const toPhysicalClone = (src: THREE.Material): THREE.MeshPhysicalMaterial => {
    if (src instanceof THREE.MeshPhysicalMaterial) {
      return src.clone();
    }
    const std = src as THREE.MeshStandardMaterial;
    const phys = new THREE.MeshPhysicalMaterial({
      name: src.name,
      color: std.color ? std.color.clone() : new THREE.Color('#ffffff'),
      map: std.map ?? null,
      normalMap: std.normalMap ?? null,
      roughnessMap: std.roughnessMap ?? null,
      metalnessMap: std.metalnessMap ?? null,
      aoMap: std.aoMap ?? null,
      emissive: std.emissive ? std.emissive.clone() : new THREE.Color(0x000000),
      emissiveMap: std.emissiveMap ?? null,
      emissiveIntensity: std.emissiveIntensity ?? 1,
      roughness: std.roughness ?? 0.4,
      metalness: std.metalness ?? 0.1,
      side: src.side,
      transparent: src.transparent,
      opacity: src.opacity,
      alphaTest: src.alphaTest,
    });
    return phys;
  };

  const nonPaintShellRe =
    /(grille|bumper|gasket|wiper|light|headlight|taillight|turnsignal|license|badge|emblem|underside|interior|seat|dash|carpet|floor|carbon|base_mat|coloured|color2|col2|window|handle0|roofrail|tire|tyre|rotor|rim|brake|caliper|pipe|exhaust|muffler)/i;
  const chromeTrimRe = /(chrome|^mirror$|badge|emblem|hardware)/i;
  const tireRe = /(tire|tyre|tiretread|tireside)/i;
  const rimRe = /(rim|spoke)/i;

  const meshRecords: MeshStyleRecord[] = [];

  for (const mesh of sourceMeshes) {
    // Hide primitive low-poly beveled/box Engine placeholder in CarConcept.glb; real rig supplies engine
    const posCount = mesh.geometry?.attributes.position?.count ?? 0;
    if (/^Engine$/i.test(mesh.name) && posCount <= 256) {
      mesh.visible = false;
      continue;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hasTransmissive = origMats.some(
      (m) => m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0,
    );
    const isGlass =
      isNodeOrAncestorInSet(mesh, nmGlassSet) ||
      glassPattern.test(mesh.name) ||
      hasTransmissive;

    const isWheelFromMap = isNodeOrAncestorInSet(mesh, nmWheelSet);
    const isWheelOrMech = isWheelFromMap || wheelTrimPattern.test(mesh.name);
    const isShellFromMap = nm ? isNodeOrAncestorInSet(mesh, nmShellSet) : fallbackShellPattern.test(mesh.name);
    const isShell = isShellFromMap && !isGlass && !isWheelFromMap;
    const skipEdges = skipEdgePattern.test(mesh.name);
    const sysSet = meshNameToSystems.get(mesh.name) ?? new Set<SystemId>();

    // Normalize Solid-mode PBR materials once per material role
    const normalizedMats = origMats.map((srcMat) => {
      if (!srcMat) return srcMat;
      const combinedLabel = `${mesh.name} ${srcMat.name || ''}`;
      let role: 'glass' | 'tire' | 'rim' | 'chrome' | 'paint' | 'trim' = 'trim';

      if (isGlass) {
        role = 'glass';
      } else if (tireRe.test(combinedLabel)) {
        role = 'tire';
      } else if (isWheelFromMap && !/(brake|rotor|disc|caliper|pad)/i.test(combinedLabel)) {
        // Inside wheel assembly: distinguish dark rubber tire vs metallic rim by luminance or name
        const col = (srcMat as THREE.MeshStandardMaterial).color;
        const lum = col ? col.r * 0.299 + col.g * 0.587 + col.b * 0.114 : 0.5;
        role = !rimRe.test(combinedLabel) && lum < 0.06 && !srcMat.name?.includes('015') ? 'tire' : 'rim';
      } else if (rimRe.test(combinedLabel)) {
        role = 'rim';
      } else if (chromeTrimRe.test(srcMat.name || mesh.name) && !/color1/i.test(combinedLabel)) {
        role = 'chrome';
      } else if (isShell && !nonPaintShellRe.test(combinedLabel)) {
        const std = srcMat as THREE.MeshStandardMaterial;
        const col = std.color;
        const maxC = col ? Math.max(col.r, col.g, col.b) : 0.5;
        const minC = col ? Math.min(col.r, col.g, col.b) : 0.5;
        const isBlackCladding =
          !std.map &&
          !/paint/i.test(srcMat.name || '') &&
          maxC < 0.08 &&
          maxC - minC < 0.03;
        role = isBlackCladding ? 'trim' : 'paint';
      }

      const cacheKey = `${srcMat.uuid}:${role}`;
      const existing = normalizedMatCache.get(cacheKey);
      if (existing) {
        if (existing !== srcMat) retiredOriginalMats.add(srcMat);
        return existing;
      }

      if (role === 'glass') {
        const phys = toPhysicalClone(srcMat);
        phys.transmission = Math.max(phys.transmission || 0, 0.72);
        phys.ior = 1.5;
        phys.thickness = 0.04;
        phys.roughness = 0.06;
        phys.metalness = 0;
        phys.envMapIntensity = 1.4;
        phys.attenuationColor = new THREE.Color('#2c3e52');
        phys.attenuationDistance = 0.55;
        phys.color.set('#a8bcd0');
        phys.transparent = true;
        phys.opacity = 0.9;
        phys.depthWrite = false;
        phys.needsUpdate = true;
        glassMaterials.push(phys);
        normalizedMatCache.set(cacheKey, phys);
        if (phys !== srcMat) retiredOriginalMats.add(srcMat);
        return phys;
      }

      if (role === 'paint') {
        const phys = toPhysicalClone(srcMat);
        const factoryColor = phys.color.clone();
        // Brighten near-black default paint only on procedural/metallic coats named Paint 1
        phys.clearcoat = 1.0;
        phys.clearcoatRoughness = 0.07;
        phys.roughness = 0.1;
        phys.metalness = 0.32;
        phys.ior = 1.5;
        phys.reflectivity = 0.9;
        phys.envMapIntensity = 1.38;
        if (currentPaintColor !== 'original') {
          phys.color.set(currentPaintColor);
        }
        phys.needsUpdate = true;
        paintMaterialEntries.push({ mat: phys, factoryColor });
        normalizedMatCache.set(cacheKey, phys);
        if (phys !== srcMat) retiredOriginalMats.add(srcMat);
        return phys;
      }

      if (role === 'tire') {
        const phys = toPhysicalClone(srcMat);
        phys.clearcoat = 0;
        phys.roughness = 0.86;
        phys.metalness = 0.04;
        phys.envMapIntensity = 0.55;
        if (!phys.map && phys.color.r > 0.4) {
          phys.color.set('#1a1c20');
        }
        phys.needsUpdate = true;
        normalizedMatCache.set(cacheKey, phys);
        if (phys !== srcMat) retiredOriginalMats.add(srcMat);
        return phys;
      }

      if (role === 'rim') {
        const phys = toPhysicalClone(srcMat);
        phys.clearcoat = 0.18;
        phys.clearcoatRoughness = 0.25;
        phys.roughness = 0.24;
        phys.metalness = 0.88;
        phys.envMapIntensity = 1.3;
        phys.needsUpdate = true;
        normalizedMatCache.set(cacheKey, phys);
        if (phys !== srcMat) retiredOriginalMats.add(srcMat);
        return phys;
      }

      if (role === 'chrome') {
        const phys = toPhysicalClone(srcMat);
        phys.clearcoat = 0.35;
        phys.roughness = 0.06;
        phys.metalness = 0.96;
        phys.envMapIntensity = 1.55;
        phys.needsUpdate = true;
        normalizedMatCache.set(cacheKey, phys);
        if (phys !== srcMat) retiredOriginalMats.add(srcMat);
        return phys;
      }

      normalizedMatCache.set(cacheKey, srcMat);
      return srcMat;
    });

    mesh.material = Array.isArray(mesh.material) ? normalizedMats : normalizedMats[0];

    // Clone solid material only on meshes referenced by system meshNames for non-leaking Solid highlight tint
    let clonedSolidMaterial: THREE.Material | THREE.Material[] | null = null;
    if (sysSet.size > 0) {
      if (Array.isArray(mesh.material)) {
        clonedSolidMaterial = mesh.material.map((m) => m.clone());
      } else if (mesh.material) {
        clonedSolidMaterial = mesh.material.clone();
      }
    }

    const outlineFillMaterial = isGlass
      ? outlineGlassMat
      : isWheelOrMech
        ? outlineTrimMat
        : outlineBodyMat;

    let outlineLine: LineSegments2 | null = null;
    let silhouetteHull: THREE.Mesh | null = null;
    let accentHighlightLine: LineSegments2 | null = null;
    let solidRimHull: THREE.Mesh | null = null;

    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }
    const meshRadius = mesh.geometry.boundingSphere?.radius ?? 1;
    const microDetail = sourceMeshes.length > 35 && meshRadius < 0.045 && !sysSet.size;

    if (!skipEdges && !microDetail) {
      const veryDenseMesh = posCount > 9000;
      const highPolyMesh = posCount > 4000;
      const thresholdAngle = veryDenseMesh ? 52 : highPolyMesh ? 44 : isWheelOrMech ? 34 : 25;
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
          accLine.renderOrder = 8;
          accLine.visible = false;
          mesh.add(accLine);
          accentHighlightLine = accLine;
        }
      }
    }

    if (isShell && mesh.geometry.attributes.normal && meshRadius > 0.25) {
      const hull = new THREE.Mesh(mesh.geometry, silhouetteHullMat);
      hull.name = `${mesh.name}_Silhouette`;
      hull.userData.isOutlineChild = true;
      hull.userData.isSilhouetteHull = true;
      hull.userData.baseLinewidthPx = 1.65;
      hull.renderOrder = 1;
      mesh.add(hull);
      silhouetteHull = hull;
    }

    if (sysSet.size > 0 && mesh.geometry.attributes.normal) {
      const rim = new THREE.Mesh(mesh.geometry, solidRimHullMat);
      rim.name = `${mesh.name}_SolidAccentRim`;
      rim.userData.isOutlineChild = true;
      rim.userData.isSilhouetteHull = true;
      rim.userData.baseLinewidthPx = 2.4;
      rim.renderOrder = 4;
      rim.visible = false;
      mesh.add(rim);
      solidRimHull = rim;
    }

    meshRecords.push({
      mesh,
      originalMaterial: mesh.material,
      clonedSolidMaterial,
      outlineFillMaterial,
      isShell,
      systemIds: sysSet,
      outlineLine,
      silhouetteHull,
      accentHighlightLine,
      solidRimHull,
    });
  }

  // Manifest-driven whole-car shell explode nodes (supports local parent space & prevents duplicate transforms)
  const explodableNodes: ExplodableNode[] = [];
  const seenExplodableObjs = new Set<THREE.Object3D>();
  const tempQuat = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const addWorldExplodable = (nodeNames: string[], worldOffset: [number, number, number]) => {
    for (const name of nodeNames) {
      const obj = model.getObjectByName(name);
      if (obj && !seenExplodableObjs.has(obj)) {
        seenExplodableObjs.add(obj);
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

  for (const part of car.shell ?? []) {
    const dir = new THREE.Vector3(
      part.direction[0],
      part.direction[1],
      part.direction[2] * frontSign,
    );
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(part.distance);
      addWorldExplodable(part.nodeNames, [dir.x, dir.y, dir.z]);
    }
  }

  const hoodNodeName = car.nodeMap ? car.nodeMap.hood : 'BodyHood';
  const hoodObj = hoodNodeName ? model.getObjectByName(hoodNodeName) : undefined;
  const hoodBasePos = hoodObj ? hoodObj.position.clone() : new THREE.Vector3();
  const hoodWorldUpLocal = new THREE.Vector3(0, 0.36, 0);
  if (hoodObj?.parent) {
    hoodObj.parent.getWorldQuaternion(tempQuat);
    hoodObj.parent.getWorldScale(tempScale);
    hoodWorldUpLocal
      .applyQuaternion(tempQuat.invert())
      .divide(new THREE.Vector3(Math.max(tempScale.x, 0.001), Math.max(tempScale.y, 0.001), Math.max(tempScale.z, 0.001)));
  }

  // Build detailed inner-system rig assemblies from src/models/systems/*.ts (replaces box placeholders)
  onProgress(94, `Fitting ${car.name} inner systems rig…`);
  const innerRig = await buildCarInnerRig(
    availableSystems,
    car.powertrain,
    anchors,
    finalBox,
    carSize,
    frontSign,
    drawBufSize,
    initialVariants,
  );
  root.add(innerRig.root);

  // Guided Tour animated energy flow path adapted to car powertrain
  const aEngine = anchors.engine ?? getBoundingBoxApproxAnchor('engine', finalBox, frontSign);
  const aBrakes = anchors.brakes ?? getBoundingBoxApproxAnchor('brakes', finalBox, frontSign);
  const aSusp = anchors.suspension ?? getBoundingBoxApproxAnchor('suspension', finalBox, frontSign);
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
  let currentIsolation: IsolationMode = initialIsolationMode;
  let isXRayOn = false;
  let currentExplode = 0;
  let activeSystem: SystemId | null = null;
  let hoveredPart: { systemId: SystemId; partId: string } | null = null;
  let selectedPart: { systemId: SystemId; partId: string } | null = null;

  // Pre-compile X-ray & rig materials once for smooth runtime transitions
  for (const rec of meshRecords) {
    if (rec.isShell) rec.mesh.material = solidXrayShellMat;
  }
  innerRig.root.visible = true;
  renderer.compile(scene, camera);

  const shouldLiftHood = (xrayEnabled: boolean) =>
    activeSystem === null
      ? xrayEnabled
      : currentIsolation === 'all' && (xrayEnabled || activeSystem === 'engine');

  const applyHoodOffset = (xrayEnabled: boolean, explodeAmt: number, reduceMotion: boolean) => {
    if (!hoodObj) return;
    const explodeRec = activeSystem === null ? explodableNodes.find((n) => n.obj === hoodObj) : undefined;
    const targetPos = hoodBasePos.clone();
    if (explodeRec) {
      targetPos.addScaledVector(explodeRec.localOffset, explodeAmt);
    }
    if (shouldLiftHood(xrayEnabled)) {
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

  const applySolidTint = (mat: THREE.Material, active: boolean) => {
    if (mat instanceof THREE.MeshStandardMaterial) {
      if (active) {
        mat.emissive.set('#d93a1e');
        mat.emissiveIntensity = 0.24;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  };

  const syncVisuals = (reduceMotion: boolean) => {
    const isOutline = currentRenderMode === 'outline';
    const hasSelectedSystem = activeSystem !== null;
    const iso: IsolationMode = hasSelectedSystem ? currentIsolation : 'all';

    // When exploding an isolated/selected system, smoothly fade remaining shell & sibling systems out
    const explodeFade =
      hasSelectedSystem && currentExplode > 0.02
        ? Math.max(0, 1 - currentExplode * 1.45)
        : 1;
    const ghostFade = iso === 'isolate' ? 0 : explodeFade;
    const useGhostLook = iso === 'ghost' || (iso === 'all' && hasSelectedSystem && currentExplode > 0.04);

    outlineGhostFillMat.opacity = 0.06 * ghostFade;
    solidGhostShellMat.opacity = 0.06 * ghostFade;
    ghostInkMat.opacity = 0.2 * ghostFade;

    for (const rec of meshRecords) {
      const meshActive = activeSystem !== null && rec.systemIds.has(activeSystem);

      if (activeSystem !== null && !meshActive && (iso === 'isolate' || ghostFade <= 0.015)) {
        rec.mesh.visible = false;
        if (rec.outlineLine) rec.outlineLine.visible = false;
        if (rec.silhouetteHull) rec.silhouetteHull.visible = false;
        if (rec.accentHighlightLine) rec.accentHighlightLine.visible = false;
        if (rec.solidRimHull) rec.solidRimHull.visible = false;
        continue;
      }

      rec.mesh.visible = true;

      if (useGhostLook && !meshActive) {
        if (rec.outlineLine) {
          rec.outlineLine.visible = isOutline && currentLayers.outline;
          rec.outlineLine.material = ghostInkMat;
        }
        if (rec.silhouetteHull) rec.silhouetteHull.visible = false;
        if (rec.accentHighlightLine) rec.accentHighlightLine.visible = false;
        if (rec.solidRimHull) rec.solidRimHull.visible = false;
        rec.mesh.material = isOutline ? outlineGhostFillMat : solidGhostShellMat;
        continue;
      }

      // Full / X-Ray / Active Highlight rendering
      if (rec.outlineLine) {
        rec.outlineLine.material = primaryInkMat;
        rec.outlineLine.visible = isOutline && currentLayers.outline && !meshActive;
      }
      if (rec.silhouetteHull) {
        rec.silhouetteHull.visible =
          isOutline && currentLayers.outline && currentLayers.mesh && !isXRayOn;
      }
      if (rec.accentHighlightLine) {
        rec.accentHighlightLine.visible = isOutline && meshActive;
      }
      if (rec.solidRimHull) {
        rec.solidRimHull.visible = !isOutline && meshActive;
      }

      if (isOutline) {
        if (meshActive) {
          rec.mesh.material = outlineAccentTintMat;
        } else if (!currentLayers.mesh) {
          rec.mesh.material = outlineHiddenFillMat;
        } else if (
          (isXRayOn || (iso === 'all' && activeSystem !== null && SYSTEM_MAP[activeSystem]?.prefersXray)) &&
          rec.isShell
        ) {
          rec.mesh.material = outlineXrayShellMat;
        } else {
          rec.mesh.material = rec.outlineFillMaterial;
        }
      } else if (isXRayOn && rec.isShell) {
        rec.mesh.material = solidXrayShellMat;
      } else if (meshActive && rec.clonedSolidMaterial) {
        if (Array.isArray(rec.clonedSolidMaterial)) {
          rec.clonedSolidMaterial.forEach((m) => applySolidTint(m, true));
        } else {
          applySolidTint(rec.clonedSolidMaterial, true);
        }
        rec.mesh.material = rec.clonedSolidMaterial;
      } else {
        rec.mesh.material = rec.originalMaterial;
      }
    }

    const showRig = hasSelectedSystem
      ? true
      : isOutline
        ? currentLayers.innerSystems || currentExplode > 0.02
        : isXRayOn || currentExplode > 0.02;
    innerRig.root.visible = showRig;

    if (showRig) {
      const visibleSystems = new Set<SystemId>();
      const ghostedSystems = new Set<SystemId>();

      if (activeSystem !== null) {
        if (iso === 'isolate' || (useGhostLook && ghostFade <= 0.015)) {
          visibleSystems.add(activeSystem);
        } else {
          for (const sysId of availableSystems) visibleSystems.add(sysId);
          if (useGhostLook) {
            for (const sysId of availableSystems) {
              if (sysId !== activeSystem) ghostedSystems.add(sysId);
            }
          }
        }
      } else {
        for (const sysId of availableSystems) visibleSystems.add(sysId);
      }

      innerRig.setVisualState({
        renderMode: currentRenderMode,
        activeSystem,
        hoveredPart,
        selectedPart,
        visibleSystems,
        ghostedSystems,
        ghostFade,
      });
    }

    gsap.killTweensOf(solidXrayShellMat);
    if (!isOutline && isXRayOn && !useGhostLook) {
      solidXrayShellMat.opacity = reduceMotion ? 0.16 : 0.55;
      gsap.to(solidXrayShellMat, {
        opacity: 0.16,
        duration: reduceMotion ? 0.01 : 0.3,
        ease: 'power2.out',
      });
    }
  };

  syncVisuals(true);

  const setXRay = (enabled: boolean, reduceMotion: boolean) => {
    isXRayOn = enabled;
    syncVisuals(reduceMotion);
    applyHoodOffset(enabled, currentExplode, reduceMotion);
  };

  const setIsolationMode = (mode: IsolationMode, reduceMotion: boolean) => {
    currentIsolation = mode;
    syncVisuals(reduceMotion);
    applyHoodOffset(isXRayOn, currentExplode, reduceMotion);
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

  const setPaintColor = (colorHex: string) => {
    currentPaintColor = colorHex;
    for (const entry of paintMaterialEntries) {
      if (colorHex === 'original') {
        entry.mat.color.copy(entry.factoryColor);
      } else {
        entry.mat.color.set(colorHex);
      }
      entry.mat.needsUpdate = true;
    }
  };

  const setGraphicsQuality = (quality: GraphicsQuality) => {
    currentQuality = quality;
    for (const glassMat of glassMaterials) {
      glassMat.transmission = quality === 'high' ? 0.74 : 0.45;
      glassMat.needsUpdate = true;
    }
  };

  const setResolution = (width: number, height: number) => {
    const cap = currentQuality === 'high' ? 2 : 1;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    primaryInkMat.resolution.set(width * ratio, height * ratio);
    primaryInkMat.linewidth = 1.9 * ratio;
    ghostInkMat.resolution.set(width * ratio, height * ratio);
    ghostInkMat.linewidth = 1.4 * ratio;
    activeAccentLineMat.resolution.set(width * ratio, height * ratio);
    activeAccentLineMat.linewidth = 2.8 * ratio;
    innerRig.setResolution(width, height);
    updateOutlineResolution(root, width, height);
  };

  const applyCurrentExplodeTransforms = () => {
    if (hoodObj) gsap.killTweensOf(hoodObj.position);
    for (const item of explodableNodes) {
      item.obj.position
        .copy(item.basePos)
        .addScaledVector(item.localOffset, currentExplode * 1.85);
      if (item.obj === hoodObj && shouldLiftHood(isXRayOn)) {
        item.obj.position.add(hoodWorldUpLocal);
      }
    }
    innerRig.setExplodeForSystem(null, currentExplode, outwardNormals);
  };

  const setExplode = (amount: number) => {
    currentExplode = Math.max(0, Math.min(1, amount));
    applyCurrentExplodeTransforms();
    syncVisuals(true);
  };

  const highlightSystem = (systemId: SystemId | null) => {
    activeSystem = systemId;
    if (selectedPart && selectedPart.systemId !== systemId) {
      selectedPart = null;
    }
    if (hoveredPart && hoveredPart.systemId !== systemId) {
      hoveredPart = null;
    }
    applyCurrentExplodeTransforms();
    syncVisuals(true);
    applyHoodOffset(isXRayOn, currentExplode, true);
  };

  const hoverPart = (systemId: SystemId | null, partId: string | null) => {
    const next = systemId && partId ? { systemId, partId } : null;
    if (
      hoveredPart?.systemId === next?.systemId &&
      hoveredPart?.partId === next?.partId
    ) {
      return;
    }
    hoveredPart = next;
    syncVisuals(true);
  };

  const selectPart = (systemId: SystemId | null, partId: string | null) => {
    selectedPart = systemId && partId ? { systemId, partId } : null;
    syncVisuals(true);
  };

  const getRigPartInfo = (systemId: SystemId, partId: string) =>
    innerRig.getPartMetadata(systemId, partId);

  const getExplodedPartLabels = (systemId: SystemId) =>
    innerRig.getExplodedPartLabels(systemId);

  const getExplodeFocusSphere = (): THREE.Sphere | null => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    return box.isEmpty() ? null : box.getBoundingSphere(new THREE.Sphere());
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
    const distanceScale = isPortrait ? 1.98 : 1.15;
    const mobileVerticalShift = isPortrait ? -0.62 : 0;

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
    systemAnchorObjects: innerRig.systemAnchorObjects,
    outwardNormals,
    hotspotMeshes,
    rigPickMeshes: innerRig.pickMeshes,
    setXRay,
    setIsolationMode,
    setRenderMode,
    setLayers,
    setPaintColor,
    setGraphicsQuality,
    setResolution,
    setExplode,
    setTourFlow: (enabled: boolean, phase: number) => {
      tourFlowGroup.visible = enabled;
      if (enabled) tourStream.update(phase);
    },
    highlightSystem,
    hoverPart,
    selectPart,
    getRigPartInfo,
    getExplodedPartLabels,
    getExplodeFocusSphere,
    replaceSystemVariant: innerRig.replaceSystemVariant,
    getSystemBayWarning: innerRig.getSystemBayWarning,
    updateActiveSystem: innerRig.updateActiveSystem,
    getSystemFocus,
    dispose: () => {
      gsap.killTweensOf(solidXrayShellMat);
      if (hoodObj) gsap.killTweensOf(hoodObj.position);
      solidXrayShellMat.dispose();
      outlineXrayShellMat.dispose();
      outlineGhostFillMat.dispose();
      solidGhostShellMat.dispose();
      ghostInkMat.dispose();
      outlineBodyMat.dispose();
      outlineTrimMat.dispose();
      outlineGlassMat.dispose();
      outlineHiddenFillMat.dispose();
      outlineAccentTintMat.dispose();
      silhouetteHullMat.dispose();
      solidRimHullMat.dispose();
      primaryInkMat.dispose();
      activeAccentLineMat.dispose();
      for (const m of retiredOriginalMats) {
        m.dispose();
      }
      for (const rec of meshRecords) {
        rec.mesh.material = rec.originalMaterial;
        if (Array.isArray(rec.clonedSolidMaterial)) {
          rec.clonedSolidMaterial.forEach((m) => m.dispose());
        } else {
          rec.clonedSolidMaterial?.dispose();
        }
      }
      innerRig.dispose();
      disposeObject3D(root);
    },
  };
}
