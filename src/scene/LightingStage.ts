import * as THREE from 'three';

export interface StudioStageHandle {
  group: THREE.Group;
  setShowroomPropsVisible: (visible: boolean) => void;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w / 2, h / 2, 18, w / 2, h / 2, w * 0.56);
  grad.addColorStop(0, 'rgba(28, 27, 25, 0.28)');
  grad.addColorStop(0.55, 'rgba(28, 27, 25, 0.11)');
  grad.addColorStop(1, 'rgba(28, 27, 25, 0)');

  ctx.save();
  ctx.scale(1, 1.85);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(w / 2, h / 3.7, w * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createLightingStage(scene: THREE.Scene): StudioStageHandle {
  const group = new THREE.Group();
  group.name = 'OutlineDraftingStage';

  // Neutral daylight studio rig for Solid mode & mechanical cutaways
  const hemiLight = new THREE.HemisphereLight('#ffffff', '#e6e4dd', 1.15);
  group.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#fffef9', 1.9);
  keyLight.position.set(3.8, 7.5, 4.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.bias = -0.0005;
  group.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#f8fafc', 0.9);
  rimLight.position.set(-5.2, 3.6, -4.4);
  group.add(rimLight);

  const fillLight = new THREE.DirectionalLight('#fff5eb', 0.65);
  fillLight.position.set(4.5, 1.6, -3.2);
  group.add(fillLight);

  // Subtle ground shadow + crisp thin ground line under the vehicle (no turntable, no horizon)
  const carPropsGroup = new THREE.Group();
  carPropsGroup.name = 'GroundDraftingProps';

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 4.95), contactShadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.001;
  carPropsGroup.add(contactShadow);

  const baselineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.35, 0.002, 0),
    new THREE.Vector3(1.35, 0.002, 0),
    new THREE.Vector3(0, 0.002, -2.55),
    new THREE.Vector3(0, 0.002, 2.55),
  ]);
  const baselineMat = new THREE.LineBasicMaterial({
    color: '#d2d0c9',
    transparent: true,
    opacity: 0.72,
  });
  const groundLine = new THREE.LineSegments(baselineGeo, baselineMat);
  carPropsGroup.add(groundLine);

  group.add(carPropsGroup);
  scene.add(group);

  return {
    group,
    setShowroomPropsVisible: (visible: boolean) => {
      carPropsGroup.visible = visible;
    },
  };
}
