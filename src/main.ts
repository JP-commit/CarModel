import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';

import * as THREE from 'three';
import {
  loadCarsManifest,
  preloadCarThumbnails,
  resolveCarFromManifest,
  type CarManifestEntry,
} from './data/cars';
import type { DrivetrainId } from './data/compare';
import { getSystemMetadata } from './data/systems';
import { getTourSteps } from './data/tour';
import { loadCarFromManifest, type CarRig } from './models/CarLoader';
import type { CompareRigInstance } from './models/compare/drivetrains';
import { loadSystemModule } from './models/systems/registry';
import type { SystemModelInstance, SystemSimulationState } from './models/systems/types';
import { CameraRig } from './scene/CameraRig';
import { LabelProjector, type ProjectedLabelEntry } from './scene/LabelProjector';
import { createLightingStage } from './scene/LightingStage';
import { detectWebGLSupport, SceneManager } from './scene/SceneManager';
import { appStore, type RenderMode, type SystemId } from './state/appState';
import { createCarPicker, createModelErrorCard } from './ui/CarPicker';
import { createCompareOverlay } from './ui/CompareOverlay';
import { createGlossaryDrawer } from './ui/GlossaryDrawer';
import { createHeaderBar } from './ui/HeaderBar';
import { createHomeOverlay } from './ui/HomeOverlay';
import { createLessonPanel } from './ui/LessonPanel';
import { createQuizModal } from './ui/QuizModal';
import { createTourOverlay } from './ui/TourOverlay';
import { renderWebGLFallback } from './ui/WebGLFallback';

async function bootstrap(): Promise<void> {
  const uiRoot = document.getElementById('ui-root')!;
  const stageEl = document.getElementById('canvas-stage')!;
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const labelLayer = document.getElementById('label-layer')!;

  if (!detectWebGLSupport()) {
    appStore.update({ webglSupported: false });
    renderWebGLFallback(uiRoot, 'Your browser or graphics driver does not support WebGL.');
    return;
  }

  let sceneManager: SceneManager;
  try {
    sceneManager = new SceneManager(canvas, stageEl, () => {
      appStore.update({ webglSupported: false });
      renderWebGLFallback(uiRoot, 'The 3D WebGL context was interrupted.');
    });
  } catch {
    appStore.update({ webglSupported: false });
    renderWebGLFallback(uiRoot, 'Unable to initialize the 3D WebGL renderer.');
    return;
  }

  const stage = createLightingStage(sceneManager.scene);
  const cameraRig = new CameraRig(sceneManager.camera, canvas);
  const labelProjector = new LabelProjector();

  let carRig: CarRig | null = null;
  let homePinEntries: ProjectedLabelEntry[] = [];
  let activeLessonModel: SystemModelInstance | null = null;
  let selectedPartId: string | null = null;
  let tourFlowPhase = 0;

  let compareRig: CompareRigInstance | null = null;
  let compareThrottle = 0.45;
  let comparePlaying = true;
  let compareMobileTab: DrivetrainId = 'petrol';

  const lessonSim: SystemSimulationState = {
    playing: true,
    speed: 1,
    explode: 0,
    xray: false,
    reduceMotion: appStore.getSnapshot().reduceMotion,
  };

  cameraRig.setReduceMotion(appStore.getSnapshot().reduceMotion);

  let carsManifest: CarManifestEntry[] = [];
  let carSwitchToken = 0;

  const quizModal = createQuizModal(uiRoot);
  const glossaryDrawer = createGlossaryDrawer(uiRoot);
  const errorCard = createModelErrorCard(uiRoot);

  const cleanupActiveSubMode = () => {
    if (activeLessonModel) {
      sceneManager.scene.remove(activeLessonModel.root);
      activeLessonModel.dispose();
      activeLessonModel = null;
    }
    selectedPartId = null;
    lessonPanel.close();

    carRig?.setTourFlow(false, 0);
    tourOverlay.close();

    if (compareRig) {
      sceneManager.setCustomRenderCallback(null);
      compareRig.dispose();
      compareRig = null;
    }
    compareOverlay.close();
  };

  const selectRenderMode = (mode: RenderMode) => {
    appStore.update({ renderMode: mode });
    const snap = appStore.getSnapshot();
    carRig?.setRenderMode(mode, snap.layers, snap.xrayCar, snap.reduceMotion);
  };

  const selectSystem = (id: SystemId) => {
    appStore.update({ selectedSystem: id, hintDismissed: true });
    if (!carRig) return;

    const snap = appStore.getSnapshot();
    const meta = getSystemMetadata(id, snap.activePowertrain);
    const shouldXray = snap.xrayCar || (snap.renderMode === 'solid' && meta.prefersXray);
    if (shouldXray !== snap.xrayCar) {
      appStore.update({ xrayCar: shouldXray });
      carRig.setXRay(shouldXray, snap.reduceMotion);
    }

    carRig.highlightSystem(id);
    const aspect = stageEl.clientWidth / Math.max(stageEl.clientHeight, 1);
    const { target, cameraPos } = carRig.getSystemFocus(id, aspect);
    cameraRig.focusAt(target, cameraPos, snap.reduceMotion);
  };

  const resetHome = () => {
    cleanupActiveSubMode();
    appStore.update({
      viewMode: 'home',
      activeLesson: null,
      selectedSystem: null,
      xrayCar: false,
      homeExplode: 0,
    });
    restoreCarLabels();
    carRig?.setExplode(0);
    carRig?.highlightSystem(null);
    carRig?.setXRay(false, appStore.getSnapshot().reduceMotion);
    cameraRig.resetHome(appStore.getSnapshot().reduceMotion);
  };

  const applyTourStep = (index: number) => {
    const snap = appStore.getSnapshot();
    const steps = getTourSteps(snap.activePowertrain, carRig?.availableSystems);
    const step = steps[index];
    if (!step) return;
    tourOverlay.setStep(index);
    appStore.update({ selectedSystem: step.systemId, xrayCar: step.requiresXray });
    if (carRig) {
      carRig.setXRay(step.requiresXray, snap.reduceMotion);
      carRig.highlightSystem(step.systemId);
      const aspect = stageEl.clientWidth / Math.max(stageEl.clientHeight, 1);
      const { target, cameraPos } = carRig.getSystemFocus(step.systemId, aspect, step.cameraOffset);
      cameraRig.focusAt(target, cameraPos, snap.reduceMotion);
    }
  };

  const enterTour = (startIndex = 0) => {
    cleanupActiveSubMode();
    restoreCarLabels();
    carRig?.setExplode(0);
    const snap = appStore.getSnapshot();
    appStore.update({ viewMode: 'tour', activeLesson: null, homeExplode: 0, hintDismissed: true });
    tourOverlay.open(startIndex, snap.activePowertrain, carRig?.availableSystems);
    applyTourStep(startIndex);
  };

  const enterCompare = async () => {
    cleanupActiveSubMode();
    appStore.update({
      viewMode: 'compare',
      activeLesson: null,
      selectedSystem: null,
      loadingPercent: 30,
      loadingLabel: 'Loading Petrol vs Diesel vs Electric drivetrains…',
      carReady: false,
    });

    if (carRig) {
      carRig.root.visible = false;
    }
    stage.setShowroomPropsVisible(false);
    labelProjector.clear();
    labelLayer.innerHTML = '';

    try {
      const { createCompareDrivetrains } = await import('./models/compare/drivetrains');
      compareRig = createCompareDrivetrains(sceneManager.scene.environment);
      compareOverlay.open();
      cameraRig.focusAt(
        new THREE.Vector3(0, 0.48, 0),
        new THREE.Vector3(0.45, 1.38, 2.85),
        appStore.getSnapshot().reduceMotion,
      );
      sceneManager.setCustomRenderCallback((renderer, width, height) => {
        compareRig?.render(renderer, sceneManager.camera, width, height, compareMobileTab);
      });
      appStore.update({ carReady: true, loadingPercent: 100, loadingLabel: 'Ready' });
    } catch (err) {
      console.error('Failed to load Compare mode:', err);
      resetHome();
    }
  };

  const toggleXRay = () => {
    if (appStore.getSnapshot().viewMode === 'lesson' && activeLessonModel) {
      lessonSim.xray = !lessonSim.xray;
      activeLessonModel.setXRay(lessonSim.xray);
      return;
    }
    const next = !appStore.getSnapshot().xrayCar;
    appStore.update({ xrayCar: next });
    carRig?.setXRay(next, appStore.getSnapshot().reduceMotion);
  };

  const toggleReduceMotion = () => {
    const next = !appStore.getSnapshot().reduceMotion;
    appStore.update({ reduceMotion: next });
    lessonSim.reduceMotion = next;
    cameraRig.setReduceMotion(next);
  };

  const lessonPanel = createLessonPanel(uiRoot, labelLayer, {
    onBackToCar: () => exitLesson(),
    onSelectPart: (partId) => {
      selectedPartId = partId;
      activeLessonModel?.highlightPart(partId);
      lessonPanel.highlightPartUI(partId);
    },
    onSimChange: (patch) => {
      Object.assign(lessonSim, patch);
      if (patch.explode !== undefined) {
        activeLessonModel?.setExplode(patch.explode);
      }
      if (patch.xray !== undefined) {
        activeLessonModel?.setXRay(patch.xray);
      }
    },
    onToggleLabels: (visible) => {
      labelProjector.setVisible(visible);
    },
    onOpenQuiz: (systemId) => {
      quizModal.open(systemId);
    },
    onOpenGlossary: (termId) => {
      glossaryDrawer.open(termId);
    },
  });

  const tourOverlay = createTourOverlay(uiRoot, {
    onSelectStep: applyTourStep,
    onExitTour: resetHome,
  });

  const compareOverlay = createCompareOverlay(uiRoot, {
    onThrottleChange: (val) => {
      compareThrottle = val;
    },
    onTogglePlay: (playing) => {
      comparePlaying = playing;
    },
    onSelectMobileTab: (id) => {
      compareMobileTab = id;
    },
    onExitCompare: resetHome,
  });

  const enterLesson = async (systemId: SystemId) => {
    cleanupActiveSubMode();
    const powertrain = appStore.getSnapshot().activePowertrain;
    const meta = getSystemMetadata(systemId, powertrain);
    appStore.update({
      viewMode: 'lesson',
      activeLesson: systemId,
      loadingPercent: 25,
      loadingLabel: `Loading ${meta.name} cutaway…`,
      carReady: false,
    });

    if (carRig) {
      carRig.root.visible = false;
    }
    stage.setShowroomPropsVisible(false);
    labelProjector.clear();
    labelLayer.innerHTML = '';

    try {
      const model = await loadSystemModule(systemId, powertrain);
      activeLessonModel = model;
      selectedPartId = null;

      lessonSim.playing = true;
      lessonSim.speed = 1;
      lessonSim.explode = appStore.getSnapshot().homeExplode;
      lessonSim.xray = false;
      lessonSim.reduceMotion = appStore.getSnapshot().reduceMotion;

      model.setExplode(lessonSim.explode);
      sceneManager.scene.add(model.root);

      const partPins = lessonPanel.open(systemId, lessonSim, model.labelAnchors);
      labelProjector.setVisible(true);
      labelProjector.setEntries(partPins);

      const isDesktop = stageEl.clientWidth > 768;
      const target = new THREE.Vector3(...model.defaultCamera.target);
      const camPos = new THREE.Vector3(...model.defaultCamera.position);
      if (isDesktop) {
        const forward = target.clone().sub(camPos).normalize();
        const camRight = new THREE.Vector3()
          .crossVectors(forward, new THREE.Vector3(0, 1, 0))
          .normalize();
        target.addScaledVector(camRight, 0.62);
        camPos.addScaledVector(camRight, 0.35);
      } else {
        target.y -= 0.32;
        camPos.multiplyScalar(1.25);
      }
      cameraRig.focusAt(target, camPos, appStore.getSnapshot().reduceMotion);

      appStore.update({ carReady: true, loadingPercent: 100, loadingLabel: 'Ready' });
    } catch (err) {
      console.error('Failed to load lesson module:', err);
      exitLesson();
    }
  };

  function exitLesson(): void {
    cleanupActiveSubMode();
    appStore.update({ viewMode: 'home', activeLesson: null, carReady: true });
    restoreCarLabels();

    if (carRig) {
      const activeSys = appStore.getSnapshot().selectedSystem;
      if (activeSys) {
        const aspect = stageEl.clientWidth / Math.max(stageEl.clientHeight, 1);
        const { target, cameraPos } = carRig.getSystemFocus(activeSys, aspect);
        cameraRig.focusAt(target, cameraPos, appStore.getSnapshot().reduceMotion);
      } else {
        cameraRig.resetHome(appStore.getSnapshot().reduceMotion);
      }
    }
  }

  const headerBar = createHeaderBar(uiRoot, {
    onSelectMode: (mode) => {
      const current = appStore.getSnapshot().viewMode;
      if (mode === 'home') {
        if (current === 'lesson') {
          exitLesson();
        } else if (current !== 'home') {
          resetHome();
        }
      } else if (mode === 'tour') {
        enterTour(0);
      } else if (mode === 'compare') {
        void enterCompare();
      }
    },
    onSelectRenderMode: selectRenderMode,
    onToggleCarPicker: () => {
      carPicker.toggle();
    },
    onOpenGlossary: () => {
      if (glossaryDrawer.isOpen()) glossaryDrawer.close();
      else glossaryDrawer.open();
    },
    onResetView: resetHome,
    onToggleXRay: toggleXRay,
    onToggleReduceMotion: toggleReduceMotion,
  });

  const homeOverlay = createHomeOverlay(uiRoot, labelLayer, {
    onSelectSystem: selectSystem,
    onResetHome: resetHome,
    onChangeExplode: (amount) => {
      appStore.update({ homeExplode: amount });
      carRig?.setExplode(amount);
    },
    onToggleLayer: (layer, visible) => {
      const nextLayers = {
        ...appStore.getSnapshot().layers,
        [layer]: visible,
      };
      appStore.update({ layers: nextLayers });
      carRig?.setLayers(nextLayers);
    },
    onStartAnimation: (id) => {
      void enterLesson(id);
    },
    onStartTour: () => {
      enterTour(0);
    },
    onDismissHint: () => {
      appStore.update({ hintDismissed: true });
    },
  });

  const carPicker = createCarPicker(uiRoot, [], {
    onSelectCar: (selectedCar) => {
      if (appStore.getSnapshot().selectedCarId === selectedCar.id && carRig) {
        return;
      }
      void switchCar(selectedCar, { preserveSystem: true, updateUrl: true });
    },
    onVisibilityChange: (open) => {
      headerBar.setCarPickerExpanded(open);
    },
  });

  function restoreCarLabels(): void {
    if (!carRig) return;
    carRig.root.visible = true;
    stage.setShowroomPropsVisible(true);
    labelLayer.innerHTML = '';
    homePinEntries = homeOverlay.createHotspotPins(carRig.anchors, carRig.outwardNormals);
    labelProjector.setVisible(true);
    labelProjector.setEntries(homePinEntries);
  }

  async function switchCar(
    car: CarManifestEntry,
    options: { preserveSystem?: boolean; updateUrl?: boolean } = {},
  ): Promise<void> {
    const token = ++carSwitchToken;
    errorCard.hide();
    carPicker.close(false);

    if (appStore.getSnapshot().viewMode !== 'home') {
      cleanupActiveSubMode();
      stage.setShowroomPropsVisible(true);
      appStore.update({ viewMode: 'home', activeLesson: null });
    }

    const prevSnap = appStore.getSnapshot();
    const hadPreviousCar = carRig !== null;
    if (hadPreviousCar && !prevSnap.reduceMotion) {
      canvas.style.opacity = '0';
      await new Promise<void>((resolve) => window.setTimeout(resolve, 140));
      if (token !== carSwitchToken) return;
    }

    appStore.update({
      carReady: false,
      loadingPercent: 6,
      loadingLabel: `Loading ${car.name}…`,
    });

    if (carRig) {
      sceneManager.scene.remove(carRig.root);
      carRig.dispose();
      carRig = null;
    }
    labelProjector.clear();
    labelLayer.innerHTML = '';

    headerBar.setCarSummary(car.name, car.thumbnail);
    carPicker.setActiveCarId(car.id);
    cameraRig.setHomeCamera(car.defaultCamera);

    try {
      const snap = appStore.getSnapshot();
      const loadedRig = await loadCarFromManifest(
        car,
        sceneManager.scene,
        sceneManager.camera,
        sceneManager.renderer,
        (percent, label) => {
          if (token === carSwitchToken) {
            appStore.update({ loadingPercent: percent, loadingLabel: label });
          }
        },
        snap.renderMode,
        snap.layers,
      );

      if (token !== carSwitchToken) {
        sceneManager.scene.remove(loadedRig.root);
        loadedRig.dispose();
        return;
      }

      carRig = loadedRig;
      const vp = sceneManager.getViewportSize();
      carRig.setResolution(vp.width, vp.height);

      homeOverlay.setAvailableSystems(carRig.availableSystems, car.powertrain);
      homePinEntries = homeOverlay.createHotspotPins(carRig.anchors, carRig.outwardNormals);
      labelProjector.setVisible(true);
      labelProjector.setEntries(homePinEntries);

      const postSnap = appStore.getSnapshot();
      const preservedSystem =
        options.preserveSystem &&
        postSnap.selectedSystem &&
        carRig.availableSystems.includes(postSnap.selectedSystem)
          ? postSnap.selectedSystem
          : null;

      cameraRig.resetHome(postSnap.reduceMotion);
      carRig.setExplode(postSnap.homeExplode);
      carRig.setXRay(postSnap.xrayCar, postSnap.reduceMotion);
      carRig.highlightSystem(preservedSystem);

      appStore.update({
        selectedCarId: car.id,
        activePowertrain: car.powertrain,
        selectedSystem: preservedSystem,
        carReady: true,
        loadingPercent: 100,
        loadingLabel: 'Ready',
      });

      if (options.updateUrl) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('car', car.id);
        window.history.replaceState(null, '', nextUrl.toString());
      }
    } catch (err) {
      if (token !== carSwitchToken) return;
      console.error(`Failed to load car model "${car.id}":`, err);
      appStore.update({
        carReady: false,
        loadingLabel: `Could not load ${car.name}`,
        loadingPercent: 0,
      });

      const defaultCar = carsManifest[0] ?? car;
      const canFallback = defaultCar.id !== car.id;
      errorCard.show({
        carName: car.name,
        message: canFallback
          ? 'The 3D vehicle file could not be loaded. Retry or fall back to the default car.'
          : 'The 3D vehicle file could not be loaded. Check your connection and retry.',
        canFallback,
        onRetry: () => {
          void switchCar(car, options);
        },
        onFallback: () => {
          void switchCar(defaultCar, { preserveSystem: false, updateUrl: true });
        },
      });
    } finally {
      if (token === carSwitchToken) {
        canvas.style.opacity = '1';
      }
    }
  }

  // Forward wheel events landing on floating dots/labels to the 3D canvas
  labelLayer.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          bubbles: false,
          cancelable: true,
        }),
      );
    },
    { passive: false },
  );

  // 3D raycasting for car hotspots (Home/Tour) or mechanical sub-parts (Lesson)
  const raycaster = new THREE.Raycaster();
  const pointerDownPos = { x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
  });

  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.hypot(dx, dy) > 6) return;

    const mode = appStore.getSnapshot().viewMode;
    if (mode === 'compare') return;

    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, sceneManager.camera);

    if (mode === 'lesson' && activeLessonModel) {
      const hits = raycaster.intersectObjects(activeLessonModel.partObjects, true);
      if (hits.length > 0) {
        const partId = hits[0].object.userData.partId as string | undefined;
        if (partId) {
          const nextId = selectedPartId === partId ? null : partId;
          selectedPartId = nextId;
          activeLessonModel.highlightPart(nextId);
          lessonPanel.highlightPartUI(nextId);
        }
      }
      return;
    }

    if (carRig && mode === 'home') {
      const hits = raycaster.intersectObjects(carRig.hotspotMeshes, false);
      if (hits.length > 0) {
        const sysId = hits[0].object.userData.systemId as SystemId | undefined;
        if (sysId) selectSystem(sysId);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (carPicker.isOpen()) {
        carPicker.close(true);
        return;
      }
      if (quizModal.isOpen()) {
        quizModal.close();
        return;
      }
      if (glossaryDrawer.isOpen()) {
        glossaryDrawer.close();
        return;
      }
      const mode = appStore.getSnapshot().viewMode;
      if (mode === 'lesson') {
        exitLesson();
        return;
      }
      if (mode === 'tour' || mode === 'compare') {
        resetHome();
        return;
      }
      if (appStore.getSnapshot().selectedSystem !== null) {
        resetHome();
        return;
      }
    }

    if (document.activeElement === canvas) {
      const step = appStore.getSnapshot().reduceMotion ? 0.16 : 0.1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cameraRig.nudgeOrbit(step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cameraRig.nudgeOrbit(-step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cameraRig.nudgeOrbit(0, -step * 0.7);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        cameraRig.nudgeOrbit(0, step * 0.7);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        cameraRig.nudgeZoom(0.88);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        cameraRig.nudgeZoom(1.14);
      }
    }
  });

  sceneManager.setFrameCallback((dt) => {
    cameraRig.update();
    const state = appStore.getSnapshot();
    if (state.viewMode === 'lesson' && activeLessonModel) {
      const status = activeLessonModel.update(dt, lessonSim);
      lessonPanel.setPhaseStatus(status.phaseIndex);
    } else if (state.viewMode === 'tour' && carRig) {
      tourFlowPhase += dt * (state.reduceMotion ? 0.12 : 0.34);
      carRig.setTourFlow(true, tourFlowPhase);
    } else if (state.viewMode === 'compare' && compareRig) {
      compareRig.update(dt, compareThrottle, comparePlaying, state.reduceMotion);
    }

    if (state.viewMode !== 'compare') {
      labelProjector.update(
        sceneManager.camera,
        stageEl.clientWidth,
        stageEl.clientHeight,
        {
          rightPanelOpen:
            state.viewMode === 'lesson' || (state.viewMode === 'home' && state.selectedSystem !== null),
          mobileExpanded:
            state.viewMode === 'lesson' ||
            (state.viewMode === 'home' &&
              state.selectedSystem !== null &&
              !homeOverlay.isMobileCollapsed()),
        },
      );
    }
  });

  let wasPortrait = stageEl.clientWidth < Math.max(stageEl.clientHeight, 1) * 0.95;
  sceneManager.setResizeCallback((width, height) => {
    carRig?.setResolution(width, height);
    const isPortraitNow = width < Math.max(height, 1) * 0.95;
    if (isPortraitNow !== wasPortrait) {
      wasPortrait = isPortraitNow;
      const snap = appStore.getSnapshot();
      if (snap.viewMode === 'home' && snap.selectedSystem === null && carRig) {
        cameraRig.resetHome(true);
      }
    }
  });

  sceneManager.start();

  const bootstrapManifestAndInitialCar = async () => {
    try {
      carsManifest = await loadCarsManifest();
      preloadCarThumbnails(carsManifest);
      carPicker.setCars(carsManifest);

      const initialCar = resolveCarFromManifest(
        carsManifest,
        appStore.getSnapshot().selectedCarId,
      );
      await switchCar(initialCar, { preserveSystem: false, updateUrl: false });
    } catch (err) {
      console.error('Failed to initialize vehicle manifest:', err);
      appStore.update({
        carReady: false,
        loadingLabel: 'Could not load vehicle catalog',
        loadingPercent: 0,
      });
      errorCard.show({
        carName: 'Vehicle Catalog',
        message: 'Unable to fetch the vehicle manifest. Check your connection and retry.',
        canFallback: false,
        onRetry: () => {
          void bootstrapManifestAndInitialCar();
        },
        onFallback: () => {},
      });
    }
  };

  await bootstrapManifestAndInitialCar();
}

bootstrap();
