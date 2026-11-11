import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

export interface EdgeOutlineOptions {
  color: string;
  linewidthPx: number;
  thresholdAngle?: number;
  dashed?: boolean;
  dashSize?: number;
  gapSize?: number;
  dashScale?: number;
  opacity?: number;
  depthTest?: boolean;
  renderOrder?: number;
  resolution?: THREE.Vector2;
}

/**
 * Precomputes an EdgesGeometry-backed LineSegments2 once per source mesh so
 * crisp consistent-width ink or dashed technical lines render at 60fps.
 */
export function createMeshOutline(
  mesh: THREE.Mesh,
  opts: EdgeOutlineOptions,
): LineSegments2 | null {
  if (!mesh.geometry || !mesh.geometry.attributes.position) {
    return null;
  }

  const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, opts.thresholdAngle ?? 26);
  const posAttr = edgesGeo.attributes.position;
  if (!posAttr || posAttr.count < 2) {
    edgesGeo.dispose();
    return null;
  }

  const lineGeo = new LineSegmentsGeometry().fromEdgesGeometry(edgesGeo);
  edgesGeo.dispose();

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const res = opts.resolution ?? new THREE.Vector2(window.innerWidth * dpr, window.innerHeight * dpr);

  const lineMat = new LineMaterial({
    color: new THREE.Color(opts.color).getHex(),
    linewidth: opts.linewidthPx * dpr,
    dashed: Boolean(opts.dashed),
    dashScale: opts.dashScale ?? 1,
    dashSize: opts.dashSize ?? 0.045,
    gapSize: opts.gapSize ?? 0.032,
    transparent: (opts.opacity ?? 1) < 1 || !opts.depthTest,
    opacity: opts.opacity ?? 1,
    depthTest: opts.depthTest ?? true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    resolution: res,
  });

  const line = new LineSegments2(lineGeo, lineMat);
  line.name = `${mesh.name || 'Mesh'}_Outline`;
  line.renderOrder = opts.renderOrder ?? 2;
  line.userData.isOutlineChild = true;
  line.userData.baseLinewidthPx = opts.linewidthPx;
  if (opts.dashed) {
    line.computeLineDistances();
  }
  return line;
}

/**
 * Creates a screen-space inverted-hull silhouette ShaderMaterial (zero extra geometry)
 * so smooth curved car panels (hood, fenders, bumpers) keep a crisp contour against white.
 */
export function createSilhouetteHullMaterial(
  color: string,
  linewidthPx: number,
  resolution: THREE.Vector2,
): THREE.ShaderMaterial {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uLinewidth: { value: linewidthPx * dpr },
      uResolution: { value: resolution.clone() },
    },
    vertexShader: `
      uniform vec2 uResolution;
      uniform float uLinewidth;
      void main() {
        vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec4 clipNormal = projectionMatrix * vec4(viewNormal, 0.0);
        vec2 dir = clipNormal.xy;
        float len = length(dir);
        if (len > 0.0001) {
          dir /= len;
        }
        clipPos.xy += dir * (uLinewidth * 2.0 / max(uResolution, vec2(1.0))) * clipPos.w;
        gl_Position = clipPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
  });
}

/**
 * Keeps fat-line and silhouette-hull resolution & DPR widths synced on viewport resize.
 */
export function updateOutlineResolution(
  root: THREE.Object3D,
  width: number,
  height: number,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const bufW = Math.max(1, width * dpr);
  const bufH = Math.max(1, height * dpr);

  root.traverse((obj) => {
    const line = obj as LineSegments2;
    if (line.isLineSegments2) {
      line.material.resolution.set(bufW, bufH);
      const basePx = line.userData.baseLinewidthPx as number | undefined;
      if (basePx !== undefined) {
        line.material.linewidth = basePx * dpr;
      }
      return;
    }

    const mesh = obj as THREE.Mesh;
    if (mesh.userData.isSilhouetteHull && mesh.material instanceof THREE.ShaderMaterial) {
      mesh.material.uniforms.uResolution?.value.set(bufW, bufH);
      const basePx = mesh.userData.baseLinewidthPx as number | undefined;
      if (basePx !== undefined && mesh.material.uniforms.uLinewidth) {
        mesh.material.uniforms.uLinewidth.value = basePx * dpr;
      }
    }
  });
}
