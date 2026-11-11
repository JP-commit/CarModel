import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface HomeCameraSpec {
  position: [number, number, number];
  target: [number, number, number];
  mobilePosition?: [number, number, number];
  mobileTarget?: [number, number, number];
}

export class CameraRig {
  readonly controls: OrbitControls;
  private readonly camera: THREE.PerspectiveCamera;
  private homeDesktopPos = new THREE.Vector3(3.75, 1.85, 4.15);
  private homeDesktopTarget = new THREE.Vector3(0, 0.52, 0);
  private homeMobilePos = new THREE.Vector3(7.6, 3.0, 8.5);
  private homeMobileTarget = new THREE.Vector3(0, -0.18, 0);
  private activeTween: gsap.core.Timeline | null = null;
  private autoRotateWanted = true;
  private reduceMotion = false;
  private userInteracting = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = true;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 14.5;
    this.controls.minPolarAngle = 0.16;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 1.35;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    const initialPos = this.getResponsiveHomePos();
    this.controls.target.copy(this.getResponsiveHomeTarget());
    this.camera.position.copy(initialPos);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.userInteracting = true;
      this.killTween();
      this.syncAutoRotate();
    });

    this.controls.addEventListener('end', () => {
      this.userInteracting = false;
      this.syncAutoRotate();
    });

    this.syncAutoRotate();
  }

  setHomeCamera(spec: HomeCameraSpec): void {
    this.homeDesktopPos.set(...spec.position);
    this.homeDesktopTarget.set(...spec.target);
    if (spec.mobilePosition) {
      this.homeMobilePos.set(...spec.mobilePosition);
    } else {
      this.homeMobilePos.copy(this.homeDesktopPos).multiplyScalar(1.95);
    }
    if (spec.mobileTarget) {
      this.homeMobileTarget.set(...spec.mobileTarget);
    } else {
      this.homeMobileTarget.copy(this.homeDesktopTarget).setY(-0.18);
    }
  }

  private getResponsiveHomeTarget(): THREE.Vector3 {
    const isPortrait = this.camera.aspect < 0.95;
    return isPortrait ? this.homeMobileTarget : this.homeDesktopTarget;
  }

  private getResponsiveHomePos(): THREE.Vector3 {
    const isPortrait = this.camera.aspect < 0.95;
    return isPortrait ? this.homeMobilePos : this.homeDesktopPos;
  }

  setReduceMotion(reduce: boolean): void {
    this.reduceMotion = reduce;
    this.controls.enableDamping = !reduce;
    this.syncAutoRotate();
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotateWanted = enabled;
    this.syncAutoRotate();
  }

  private syncAutoRotate(): void {
    this.controls.autoRotate =
      this.autoRotateWanted && !this.reduceMotion && !this.userInteracting;
    this.controls.autoRotateSpeed = 0.55;
  }

  focusAt(
    target: THREE.Vector3,
    cameraPos: THREE.Vector3,
    reduceMotion = this.reduceMotion,
  ): void {
    this.killTween();
    this.setAutoRotate(false);

    if (reduceMotion) {
      this.camera.position.copy(cameraPos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    const tl = gsap.timeline({
      onUpdate: () => {
        this.controls.update();
      },
    });
    tl.to(
      this.camera.position,
      {
        x: cameraPos.x,
        y: cameraPos.y,
        z: cameraPos.z,
        duration: 0.9,
        ease: 'power2.inOut',
      },
      0,
    ).to(
      this.controls.target,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 0.9,
        ease: 'power2.inOut',
      },
      0,
    );
    this.activeTween = tl;
  }

  fitBoundingSphere(
    sphere: THREE.Sphere,
    options: {
      desktopRightPanel?: boolean;
      reduceMotion?: boolean;
      duration?: number;
      margin?: number;
    } = {},
  ): void {
    const reduce = options.reduceMotion ?? this.reduceMotion;
    const isPortrait = this.camera.aspect < 0.95;
    const margin = options.margin ?? (isPortrait ? 1.85 : 1.38);

    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * Math.max(this.camera.aspect, 0.35));
    const halfFov = Math.max(0.15, Math.min(vFov, hFov) * 0.5);
    const radius = Math.max(0.25, sphere.radius);
    const neededDist = (radius / Math.sin(halfFov)) * margin;
    const dist = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, neededDist),
    );

    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-4) {
      dir.set(0.65, 0.45, 0.72);
    }
    dir.normalize();

    const target = sphere.center.clone();
    if (isPortrait) {
      target.y -= Math.max(0.28, radius * 0.78);
    } else if (options.desktopRightPanel) {
      const forward = dir.clone().negate();
      const camRight = new THREE.Vector3()
        .crossVectors(forward, new THREE.Vector3(0, 1, 0))
        .normalize();
      target.addScaledVector(camRight, Math.min(0.42, dist * 0.14));
    }

    const cameraPos = target.clone().addScaledVector(dir, dist);
    cameraPos.y = Math.max(0.28, cameraPos.y);

    this.killTween();
    this.setAutoRotate(false);

    if (reduce) {
      this.camera.position.copy(cameraPos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    const duration = options.duration ?? 0.45;
    const tl = gsap.timeline({
      onUpdate: () => {
        this.controls.update();
      },
    });
    tl.to(
      this.camera.position,
      {
        x: cameraPos.x,
        y: cameraPos.y,
        z: cameraPos.z,
        duration,
        ease: 'power2.out',
      },
      0,
    ).to(
      this.controls.target,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        duration,
        ease: 'power2.out',
      },
      0,
    );
    this.activeTween = tl;
  }

  resetHome(reduceMotion = this.reduceMotion): void {
    this.focusAt(this.getResponsiveHomeTarget(), this.getResponsiveHomePos(), reduceMotion);
    this.setAutoRotate(true);
  }

  nudgeOrbit(deltaAzimuth: number, deltaPolar: number): void {
    this.killTween();
    this.setAutoRotate(false);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += deltaAzimuth;
    spherical.phi = Math.max(
      this.controls.minPolarAngle,
      Math.min(this.controls.maxPolarAngle, spherical.phi + deltaPolar),
    );
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  nudgeZoom(scale: number): void {
    this.killTween();
    this.setAutoRotate(false);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = offset.length();
    const nextDist = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, dist * scale),
    );
    offset.setLength(nextDist);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  update(): void {
    this.controls.update();
  }

  private killTween(): void {
    if (this.activeTween) {
      this.activeTween.kill();
      this.activeTween = null;
    }
  }

  dispose(): void {
    this.killTween();
    this.controls.dispose();
  }
}
