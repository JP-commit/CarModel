import * as THREE from 'three';
import type { DrivetrainId } from '../../data/compare';
import { disposeObject3D } from '../../scene/SceneManager';
import { createFlowStream, createGearGeometry } from '../ProceduralHelpers';

export interface CompareRigInstance {
  update: (dt: number, throttle: number, playing: boolean, reduceMotion: boolean) => void;
  render: (
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    mobileActive: DrivetrainId,
  ) => void;
  dispose: () => void;
}

function makeSubScene(envTexture: THREE.Texture | null, bgHex: string): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(bgHex);
  s.environment = envTexture;

  s.add(new THREE.HemisphereLight('#ffffff', '#d6d3cb', 1.1));
  const key = new THREE.DirectionalLight('#fffaf0', 2.0);
  key.position.set(3.2, 5.5, 4.0);
  s.add(key);
  const rim = new THREE.DirectionalLight('#94a3b8', 0.85);
  rim.position.set(-4.0, 2.5, -3.5);
  s.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 48),
    new THREE.MeshStandardMaterial({
      color: '#ecebe5',
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.34, 2.36, 48),
    new THREE.MeshBasicMaterial({ color: '#c8c6be', side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;

  s.add(floor, ring);
  return s;
}

function buildWheelsAndAxle(parent: THREE.Object3D, xPos: number, wheelMat: THREE.Material, steelMat: THREE.Material): THREE.Group {
  const axleGroup = new THREE.Group();
  axleGroup.position.set(xPos, 0.36, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.15, 14), steelMat);
  shaft.rotation.x = Math.PI / 2;
  axleGroup.add(shaft);

  for (const zOff of [-0.56, 0.56]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 26), wheelMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.z = zOff;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.17, 16), steelMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.z = zOff;
    axleGroup.add(tire, rim);
  }
  parent.add(axleGroup);
  return axleGroup;
}

export function createCompareDrivetrains(envTexture: THREE.Texture | null): CompareRigInstance {
  const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.88, roughness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.72, roughness: 0.38 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.1, roughness: 0.85 });
  const glassBlockMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.5,
    roughness: 0.3,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#d93a1e', metalness: 0.38, roughness: 0.36 });
  const copperMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.85, roughness: 0.25 });

  // 1. PETROL SCENE
  const petrolScene = makeSubScene(envTexture, '#f9f9f6');
  const pRoot = new THREE.Group();
  petrolScene.add(pRoot);

  const pBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.42), glassBlockMat);
  pBlock.position.set(-0.75, 0.58, 0);
  pRoot.add(pBlock);

  const pPistons: THREE.Mesh[] = [];
  const pSparks: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const px = -0.99 + i * 0.16;
    const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 14), steelMat);
    pMesh.position.set(px, 0.58, 0);
    pRoot.add(pMesh);
    pPistons.push(pMesh);

    const spMat = new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0 });
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), spMat);
    sp.position.set(px, 0.8, 0);
    pRoot.add(sp);
    pSparks.push(spMat);
  }

  const pGearbox = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.46, 18), darkMat);
  pGearbox.rotation.z = Math.PI / 2;
  pGearbox.position.set(-0.14, 0.44, 0);
  const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.86, 12), steelMat);
  pShaft.rotation.z = Math.PI / 2;
  pShaft.position.set(0.5, 0.36, 0);
  const pFuelTank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.56), accentMat);
  pFuelTank.position.set(0.45, 0.26, -0.34);
  pRoot.add(pGearbox, pShaft, pFuelTank);

  const pFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45, 0.3, -0.34),
    new THREE.Vector3(-0.3, 0.44, -0.15),
    new THREE.Vector3(-0.75, 0.72, 0),
  ]);
  const pFlow = createFlowStream(pFlowCurve, 6, '#f59e0b', 0.018, 0.05);
  pRoot.add(pFlow.mesh);
  const pAxle = buildWheelsAndAxle(pRoot, 0.94, tireMat, steelMat);

  // 2. DIESEL SCENE
  const dieselScene = makeSubScene(envTexture, '#f5f5f1');
  const dRoot = new THREE.Group();
  dieselScene.add(dRoot);

  const dBlock = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 0.46), glassBlockMat);
  dBlock.position.set(-0.74, 0.64, 0);
  dRoot.add(dBlock);

  const dPistons: THREE.Mesh[] = [];
  const dGlows: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const px = -1.01 + i * 0.18;
    const dMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 14), steelMat);
    dMesh.position.set(px, 0.62, 0);
    dRoot.add(dMesh);
    dPistons.push(dMesh);

    const glMat = new THREE.MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0 });
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.08, 12), glMat);
    gl.position.set(px, 0.86, 0);
    dRoot.add(gl);
    dGlows.push(glMat);
  }

  // Turbocharger snail on side of diesel engine
  const turbo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 10, 22), accentMat);
  turbo.position.set(-0.74, 0.72, 0.28);
  const turboSpin = new THREE.Mesh(
    createGearGeometry({ teeth: 10, pitchRadius: 0.08, thickness: 0.03, boreRadius: 0.02 }),
    steelMat,
  );
  turboSpin.position.set(-0.74, 0.72, 0.31);
  const dGearbox = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.52, 18), darkMat);
  dGearbox.rotation.z = Math.PI / 2;
  dGearbox.position.set(-0.08, 0.44, 0);
  const dShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.82, 12), steelMat);
  dShaft.rotation.z = Math.PI / 2;
  dShaft.position.set(0.52, 0.36, 0);
  dRoot.add(turbo, turboSpin, dGearbox, dShaft);
  const dAxle = buildWheelsAndAxle(dRoot, 0.94, tireMat, steelMat);

  // 3. ELECTRIC SCENE
  const electricScene = makeSubScene(envTexture, '#f9f9f6');
  const eRoot = new THREE.Group();
  electricScene.add(eRoot);

  // Underfloor Lithium Battery Pack (InstancedMesh cells!)
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.92), darkMat);
  tray.position.set(-0.18, 0.24, 0);
  eRoot.add(tray);

  const cellGeo = new THREE.BoxGeometry(0.2, 0.09, 0.38);
  const cellMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.4, roughness: 0.35 });
  const cellInst = new THREE.InstancedMesh(cellGeo, cellMat, 10);
  const cd = new THREE.Object3D();
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    cd.position.set(-0.72 + col * 0.27, 0.29, row === 0 ? -0.22 : 0.22);
    cd.updateMatrix();
    cellInst.setMatrixAt(i, cd.matrix);
  }
  cellInst.instanceMatrix.needsUpdate = true;
  eRoot.add(cellInst);

  // Power Inverter + Compact Single-Speed Motor on Rear Axle
  const inverter = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.34), accentMat);
  inverter.position.set(0.45, 0.46, 0);
  const eMotorCase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 22), glassBlockMat);
  eMotorCase.rotation.x = Math.PI / 2;
  eMotorCase.position.set(0.94, 0.36, 0);
  const eRotor = new THREE.Mesh(
    createGearGeometry({ teeth: 18, pitchRadius: 0.16, thickness: 0.24, boreRadius: 0.05 }),
    copperMat,
  );
  eRotor.position.set(0.94, 0.36, 0);
  eRoot.add(inverter, eMotorCase, eRotor);

  const eCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.6, 0.34, 0),
    new THREE.Vector3(0.0, 0.38, 0),
    new THREE.Vector3(0.45, 0.46, 0),
    new THREE.Vector3(0.94, 0.44, 0),
  ]);
  const ePipe = new THREE.Mesh(new THREE.TubeGeometry(eCurve, 28, 0.018, 8, false), accentMat);
  const eFlow = createFlowStream(eCurve, 10, '#d93a1e', 0.025, 0.06);
  eRoot.add(ePipe, eFlow.mesh);
  const eAxle = buildWheelsAndAxle(eRoot, 0.94, tireMat, steelMat);

  let phase = 0;
  let flowPhase = 0;
  const firingOffsets = [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5];
  const paneCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);

  return {
    update: (dt: number, throttle: number, playing: boolean, reduceMotion: boolean) => {
      const speedFactor = (0.35 + throttle * 1.9) * (reduceMotion ? 0.35 : 1);
      if (playing) {
        phase += dt * 4.5 * speedFactor;
        flowPhase += dt * (0.4 + throttle * 1.3) * (reduceMotion ? 0.4 : 1);
      }

      // Petrol kinematics
      for (let i = 0; i < 4; i++) {
        const a = phase * 1.2 + firingOffsets[i];
        pPistons[i].position.y = 0.56 + Math.sin(a) * 0.12;
        const sparkPeak = Math.max(0, Math.sin(a) - 0.85) * 6.5;
        pSparks[i].opacity = sparkPeak;
      }
      pShaft.rotation.x = phase * 0.85;
      pAxle.rotation.z = -phase * 0.72;
      pFlow.update(flowPhase);

      // Diesel kinematics (slower RPM, heavier compression glow)
      for (let i = 0; i < 4; i++) {
        const a = phase * 0.85 + firingOffsets[i];
        dPistons[i].position.y = 0.6 + Math.sin(a) * 0.14;
        const compPeak = Math.max(0, Math.sin(a) - 0.75) * 3.8;
        dGlows[i].opacity = compPeak;
      }
      turboSpin.rotation.z = -phase * (1.8 + throttle * 4.5);
      dShaft.rotation.x = phase * 0.75;
      dAxle.rotation.z = -phase * 0.78;

      // Electric kinematics (instant proportional response, zero pistons)
      const evSpin = phase * (1.0 + throttle * 1.1);
      eRotor.rotation.z = -evSpin;
      eAxle.rotation.z = -evSpin;
      eFlow.update(flowPhase * 1.35);
    },
    render: (
      renderer: THREE.WebGLRenderer,
      camera: THREE.PerspectiveCamera,
      width: number,
      height: number,
      mobileActive: DrivetrainId,
    ) => {
      const isMobile = width <= 768;
      renderer.setScissorTest(true);

      // Reserve bottom area for comparison table/cards and top area for header/toolbar
      const topReserve = isMobile ? 226 : 132;
      const bottomReserve = isMobile ? Math.round(height * 0.43) : 295;
      const viewH = Math.max(150, height - topReserve - bottomReserve);
      const yBottom = bottomReserve;

      paneCamera.position.copy(camera.position);
      paneCamera.quaternion.copy(camera.quaternion);

      if (isMobile) {
        const targetScene =
          mobileActive === 'petrol'
            ? petrolScene
            : mobileActive === 'diesel'
              ? dieselScene
              : electricScene;
        paneCamera.fov = 54;
        paneCamera.aspect = width / viewH;
        paneCamera.updateProjectionMatrix();
        renderer.setViewport(0, yBottom, width, viewH);
        renderer.setScissor(0, yBottom, width, viewH);
        renderer.render(targetScene, paneCamera);
        return;
      }

      paneCamera.fov = 42;
      const scenes = [petrolScene, dieselScene, electricScene];
      const paneW = Math.floor(width / 3);
      for (let i = 0; i < 3; i++) {
        const x = i * paneW;
        const w = i === 2 ? width - x : paneW;
        paneCamera.aspect = w / viewH;
        paneCamera.updateProjectionMatrix();
        renderer.setViewport(x, yBottom, w, viewH);
        renderer.setScissor(x, yBottom, w, viewH);
        renderer.render(scenes[i], paneCamera);
      }
    },
    dispose: () => {
      disposeObject3D(petrolScene);
      disposeObject3D(dieselScene);
      disposeObject3D(electricScene);
    },
  };
}

