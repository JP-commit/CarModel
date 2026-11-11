import * as THREE from 'three';

export interface GearOptions {
  teeth: number;
  pitchRadius: number;
  thickness: number;
  boreRadius?: number;
  toothDepth?: number;
  bevel?: boolean;
}

/**
 * Generates an extruded mechanical spur gear with an optional center bore hole.
 */
export function createGearGeometry(opts: GearOptions): THREE.ExtrudeGeometry {
  const {
    teeth,
    pitchRadius,
    thickness,
    boreRadius = pitchRadius * 0.25,
    toothDepth = Math.min(pitchRadius * 0.18, (2 * Math.PI * pitchRadius) / (teeth * 2.1)),
    bevel = true,
  } = opts;

  const outerR = pitchRadius + toothDepth * 0.55;
  const rootR = Math.max(boreRadius + 0.02, pitchRadius - toothDepth * 0.45);
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.18;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.54;
    const a4 = a0 + step * 0.7;

    const p0x = Math.cos(a0) * rootR;
    const p0y = Math.sin(a0) * rootR;
    if (i === 0) {
      shape.moveTo(p0x, p0y);
    } else {
      shape.lineTo(p0x, p0y);
    }
    shape.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
  }
  shape.closePath();

  if (boreRadius > 0.005) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel,
    bevelThickness: bevel ? Math.min(0.012, thickness * 0.12) : 0,
    bevelSize: bevel ? Math.min(0.01, toothDepth * 0.15) : 0,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.center();
  return geo;
}

/**
 * Generates a helical coil spring TubeGeometry centered along the Y axis.
 */
export function createCoilSpringGeometry(
  radius: number,
  height: number,
  turns: number,
  wireRadius: number,
  segments = 88,
): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    points.push(
      new THREE.Vector3(Math.cos(angle) * radius, (t - 0.5) * height, Math.sin(angle) * radius),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segments, wireRadius, 10, false);
}

export interface FlowStreamHandle {
  mesh: THREE.InstancedMesh;
  update: (phase: number, colorFn?: (t: number, targetColor: THREE.Color) => void) => void;
}

/**
 * Creates an instanced stream of capsules gliding smoothly along a 3D curve.
 */
export function createFlowStream(
  curve: THREE.Curve<THREE.Vector3>,
  count: number,
  color: string,
  radius = 0.026,
  length = 0.075,
): FlowStreamHandle {
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 8);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.1,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const pos = new THREE.Vector3();
  const lookAtPos = new THREE.Vector3();
  const tempColor = new THREE.Color(color);

  const update = (phase: number, colorFn?: (t: number, out: THREE.Color) => void) => {
    for (let i = 0; i < count; i++) {
      const t = ((i / count + phase) % 1 + 1) % 1;
      curve.getPointAt(t, pos);
      const nextT = Math.min(1, t + 0.01);
      curve.getPointAt(nextT === t ? Math.max(0, t - 0.01) : nextT, lookAtPos);
      dummy.position.copy(pos);
      if (nextT !== t) {
        dummy.lookAt(lookAtPos);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (colorFn) {
        colorFn(t, tempColor);
        mesh.setColorAt(i, tempColor);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colorFn && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };

  update(0);
  return { mesh, update };
}

export interface ExplodableEntry {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

/**
 * Applies an explosion factor (0..1) relative to each part's base position.
 * Useful when parts also animate around their animated pivot or local origin.
 */
export function applyExplodeOffsets(entries: ExplodableEntry[], amount: number): void {
  for (const entry of entries) {
    entry.object.position
      .copy(entry.basePosition)
      .addScaledVector(entry.explodeOffset, amount);
  }
}

/**
 * Assigns a logical part ID to a Three.js object and all its descendant meshes
 * so raycasting any child mesh selects the semantic part cleanly.
 */
export function tagInteractivePart(obj: THREE.Object3D, partId: string): void {
  obj.userData.partId = partId;
  obj.traverse((child) => {
    child.userData.partId = partId;
  });
}

/**
 * Attaches a child Object3D at a local offset to serve as a 3D projected label anchor.
 */
export function makePartAnchor(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Object3D {
  const node = new THREE.Object3D();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

export interface PartController {
  highlightPart: (partId: string | null) => void;
  setPartsXRay: (partIds: string[], enabled: boolean, opacity?: number) => void;
}

/**
 * Clones MeshStandardMaterials per semantic part so highlighting or X-raying one
 * sub-assembly never leaks onto shared metal materials in unrelated parts.
 */
export function createPartController(
  partMap: Record<string, THREE.Object3D>,
  skipMaterials: THREE.Material[] = [],
): PartController {
  const skipSet = new Set(skipMaterials);
  const partMats = new Map<string, THREE.MeshStandardMaterial[]>();
  const origEmissive = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; intensity: number }>();

  for (const [partId, obj] of Object.entries(partMap)) {
    tagInteractivePart(obj, partId);
    const matsForPart: THREE.MeshStandardMaterial[] = [];
    const clonedCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();

    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      if (skipSet.has(mesh.material) || !(mesh.material instanceof THREE.MeshStandardMaterial)) {
        return;
      }
      let cloned = clonedCache.get(mesh.material);
      if (!cloned) {
        cloned = mesh.material.clone();
        clonedCache.set(mesh.material, cloned);
        matsForPart.push(cloned);
        origEmissive.set(cloned, {
          color: cloned.emissive.clone(),
          intensity: cloned.emissiveIntensity,
        });
      }
      mesh.material = cloned;
    });
    partMats.set(partId, matsForPart);
  }

  return {
    highlightPart: (partId: string | null) => {
      for (const [id, mats] of partMats.entries()) {
        const active = id === partId;
        for (const mat of mats) {
          const orig = origEmissive.get(mat);
          if (active) {
            mat.emissive.set('#d93a1e');
            mat.emissiveIntensity = 0.55;
          } else if (orig) {
            mat.emissive.copy(orig.color);
            mat.emissiveIntensity = orig.intensity;
          }
        }
      }
    },
    setPartsXRay: (partIds: string[], enabled: boolean, opacity = 0.22) => {
      for (const id of partIds) {
        const mats = partMats.get(id) ?? [];
        for (const mat of mats) {
          mat.transparent = enabled;
          mat.opacity = enabled ? opacity : 1;
          mat.depthWrite = !enabled;
          mat.needsUpdate = true;
        }
      }
    },
  };
}


