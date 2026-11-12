import * as THREE from 'three';
import type { CompareTransmissionId } from '../../data/compare';
import { disposeObject3D } from '../../scene/SceneManager';
import { createAtTransmissionModel } from '../systems/transmissions/at';
import { createCvtTransmissionModel } from '../systems/transmissions/cvt';
import { createDctTransmissionModel } from '../systems/transmissions/dct';
import { createManualTransmissionModel } from '../systems/transmissions/manual';
import type { SystemModelInstance } from '../systems/types';

export interface CompareTransmissionsInstance {
  update: (dt: number, throttle: number, playing: boolean, reduceMotion: boolean) => void;
  render: (
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    mobileActive: CompareTransmissionId,
    thirdSlotId: 'cvt' | 'dct',
  ) => void;
  dispose: () => void;
}

function makeCompareStage(envTexture: THREE.Texture | null, bgHex: string): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(bgHex);
  s.environment = envTexture;

  s.add(new THREE.HemisphereLight('#ffffff', '#d6d3cb', 1.15));
  const key = new THREE.DirectionalLight('#fffaf0', 2.0);
  key.position.set(3.2, 5.5, 4.0);
  s.add(key);
  const rim = new THREE.DirectionalLight('#94a3b8', 0.85);
  rim.position.set(-4.0, 2.5, -3.5);
  s.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 48),
    new THREE.MeshStandardMaterial({ color: '#ecebe5', roughness: 0.92, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.19, 2.21, 48),
    new THREE.MeshBasicMaterial({ color: '#c8c6be', side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  s.add(floor, ring);
  return s;
}

export function createCompareTransmissions(
  envTexture: THREE.Texture | null,
): CompareTransmissionsInstance {
  const paneCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);

  const entries: Record<
    CompareTransmissionId,
    { scene: THREE.Scene; model: SystemModelInstance }
  > = {
    manual: {
      scene: makeCompareStage(envTexture, '#f9f9f6'),
      model: createManualTransmissionModel(),
    },
    at: {
      scene: makeCompareStage(envTexture, '#f5f4ef'),
      model: createAtTransmissionModel(),
    },
    cvt: {
      scene: makeCompareStage(envTexture, '#f1f0ea'),
      model: createCvtTransmissionModel(),
    },
    dct: {
      scene: makeCompareStage(envTexture, '#f1f0ea'),
      model: createDctTransmissionModel(),
    },
  };

  for (const e of Object.values(entries)) {
    e.model.root.scale.setScalar(0.85);
    e.model.root.position.y = -0.35;
    e.scene.add(e.model.root);
  }

  return {
    update: (dt, throttle, playing, reduceMotion) => {
      const speed = 0.65 + throttle * 1.4;
      for (const e of Object.values(entries)) {
        e.model.update(dt, {
          playing,
          speed,
          explode: 0,
          xray: false,
          reduceMotion,
          throttle,
        });
      }
    },
    render: (renderer, camera, width, height, mobileActive, thirdSlotId) => {
      const isMobile = width <= 768;
      renderer.setScissorTest(true);

      const topReserve = isMobile ? 226 : 132;
      const bottomReserve = isMobile ? Math.round(height * 0.43) : 295;
      const viewH = Math.max(150, height - topReserve - bottomReserve);
      const yBottom = bottomReserve;

      paneCamera.position.copy(camera.position);
      paneCamera.quaternion.copy(camera.quaternion);

      if (isMobile) {
        paneCamera.fov = 54;
        paneCamera.aspect = width / viewH;
        paneCamera.updateProjectionMatrix();
        renderer.setViewport(0, yBottom, width, viewH);
        renderer.setScissor(0, yBottom, width, viewH);
        renderer.render(entries[mobileActive].scene, paneCamera);
        return;
      }

      paneCamera.fov = 42;
      const slots: CompareTransmissionId[] = ['manual', 'at', thirdSlotId];
      const paneW = Math.floor(width / 3);
      for (let i = 0; i < 3; i++) {
        const x = i * paneW;
        const w = i === 2 ? width - x : paneW;
        paneCamera.aspect = w / viewH;
        paneCamera.updateProjectionMatrix();
        renderer.setViewport(x, yBottom, w, viewH);
        renderer.setScissor(x, yBottom, w, viewH);
        renderer.render(entries[slots[i]].scene, paneCamera);
      }
    },
    dispose: () => {
      for (const e of Object.values(entries)) {
        e.model.dispose();
        disposeObject3D(e.scene);
      }
    },
  };
}

