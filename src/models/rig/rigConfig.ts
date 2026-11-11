import * as THREE from 'three';
import type { Powertrain, SystemId } from '../../state/appState';

export interface RigPlacementResult {
  position: THREE.Vector3;
  rotationY: number;
  targetExtent: number;
}

export const RIG_TARGET_EXTENTS: Record<SystemId, number> = {
  engine: 0.6,
  transmission: 0.78,
  brakes: 0.48,
  suspension: 0.54,
  steering: 1.02,
  electrical: 0.54,
  cooling: 0.5,
  exhaust: 1.65,
};

/**
 * Computes auto-fitted scale target, anatomical orientation, and world placement
 * inside a normalized vehicle bounding box for each mechanical rig assembly.
 */
export function computeRigSystemPlacement(
  systemId: SystemId,
  powertrain: Powertrain,
  anchor: THREE.Vector3,
  anchors: Partial<Record<SystemId, THREE.Vector3>>,
  carBox: THREE.Box3,
  carSize: THREE.Vector3,
  frontSign: number,
): RigPlacementResult {
  const lengthScale = Math.max(0.75, Math.min(1.35, carSize.z / 4.25));
  let baseExtent = RIG_TARGET_EXTENTS[systemId];
  if (powertrain === 'ev') {
    if (systemId === 'engine') baseExtent = 0.56;
    if (systemId === 'electrical') baseExtent = 1.15;
    if (systemId === 'transmission') baseExtent = 0.58;
  }
  const targetExtent = baseExtent * lengthScale;

  let rotationY = frontSign > 0 ? 0 : Math.PI;
  const position = anchor.clone();

  switch (systemId) {
    case 'engine':
      // Longitudinal crank axis along +Z (timing gear forward, flywheel rear)
      rotationY = frontSign > 0 ? 0 : Math.PI;
      position.y = Math.max(position.y, carBox.min.y + carSize.y * 0.34);
      break;

    case 'transmission':
      // Clutch (-X) toward engine (+Z * frontSign), differential (+X) toward rear
      rotationY = frontSign * (Math.PI / 2);
      position.y = Math.max(position.y, carBox.min.y + carSize.y * 0.25);
      break;

    case 'brakes':
      // Rotate caliper/disc plane outward (+X/+Z front-left wheel arch)
      rotationY = -frontSign * (Math.PI / 2);
      position.x = anchor.x > 0 ? Math.max(0.25, anchor.x - 0.16) : Math.min(-0.25, anchor.x + 0.16);
      position.y = Math.max(carBox.min.y + 0.28, anchor.y + 0.04);
      break;

    case 'suspension':
      // Hub (+X) outward toward rear-left wheel, control arm inward (-X)
      rotationY = anchor.x >= 0 ? 0 : Math.PI;
      position.x = anchor.x >= 0 ? Math.max(0.32, anchor.x - 0.16) : Math.min(-0.32, anchor.x + 0.16);
      position.y = Math.max(carBox.min.y + 0.34, anchor.y);
      break;

    case 'steering':
      // Rack spans laterally across X; wheel & column angle back into cabin (-Z * frontSign)
      rotationY = frontSign > 0 ? Math.PI : 0;
      position.x = 0;
      position.y = Math.max(carBox.min.y + carSize.y * 0.36, anchor.y - 0.16);
      position.z = anchor.z + frontSign * 0.14;
      break;

    case 'electrical':
      if (powertrain === 'ev') {
        rotationY = frontSign > 0 ? 0 : Math.PI;
        position.set(0, carBox.min.y + carSize.y * 0.22, 0);
      } else {
        rotationY = frontSign * (Math.PI / 2);
      }
      break;

    case 'cooling': {
      // Cooling model radiator core & fan shroud lie in XY facing +/-Z, so keep transverse across X
      rotationY = frontSign > 0 ? 0 : Math.PI;
      position.x = 0;
      position.y = Math.max(carBox.min.y + carSize.y * 0.36, anchor.y + 0.04);
      const aEng = anchors.engine;
      position.z = aEng ? aEng.z * 0.35 + anchor.z * 0.65 : anchor.z - frontSign * 0.24;
      break;
    }

    case 'exhaust': {
      // Manifold (-X) connects under engine; muffler/tailpipe (+X) exits rear
      rotationY = frontSign * (Math.PI / 2);
      const aEngine = anchors.engine;
      const aExh = anchor;
      const midZ = aEngine ? (aEngine.z + aExh.z) * 0.5 : anchor.z + frontSign * 0.72;
      position.set(anchor.x * 0.45, carBox.min.y + carSize.y * 0.18, midZ);
      break;
    }
  }

  return { position, rotationY, targetExtent };
}

