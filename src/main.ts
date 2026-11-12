import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';

import * as THREE from 'three';
import {
  loadCarsManifest,
  preloadCarThumbnails,
  resolveCarEngine,
  resolveCarFromManifest,
  resolveCarTransmission,
  type CarManifestEntry,
} from './data/cars';
import type { CompareCategory, CompareTransmissionId, DrivetrainId } from './data/compare';
import { getSystemMetadata } from './data/systems';
import { getTourSteps } from './data/tour';
import { loadCarFromManifest, type CarRig } from './models/CarLoader';
import type { CompareRigInstance } from './models/compare/drivetrains';
import type { CompareTransmissionsInstance } from './models/compare/transmissions';
import {
  createLessonOutlineController,
  type LessonOutlineController,
} from './models/systems/OutlineDecorator';
import { loadSystemModule } from './models/systems/registry';
import type { SystemModelInstance, SystemSimulationState } from './models/systems/types';
import { CameraRig } from './scene/CameraRig';
import { LabelProjector, type ProjectedLabelEntry } from './scene/LabelProjector';
import { createLightingStage } from './scene/LightingStage';
import { detectWebGLSupport, SceneManager } from './scene/SceneManager';
import {
  appStore,
  getActiveSystemVariant,
  hasUrlVariantOverride,
  type EngineLayout,
  type RenderMode,
  type SystemId,
  type TransmissionType,
} from './state/appState';
import { EngineAudioSynth } from './audio/engineSynth';
import { createCarPicker, createModelErrorCard } from './ui/CarPicker';
import { createCompareOverlay } from './ui/CompareOverlay';
import { createCreditsModal } from './ui/CreditsModal';
import { createGlossaryDrawer } from './ui/GlossaryDrawer';
import { createHeaderBar } from './ui/HeaderBar';
import { createHomeOverlay } from './ui/HomeOverlay';
import {
  buildShareableViewUrl,
  createDeveloperDebugHud,
  CrossSectionController,
  exportCanvasPng,
  MeasureRulerTool,
} from './ui/InspectTools';
import { createLearningLabModal } from './ui/LearningLabModal';
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
    sceneManager = new SceneManager(
      canvas,
      stageEl,
      () => {
        appStore.update({ webglSupported: false });
        renderWebGLFallback(uiRoot, 'The 3D WebGL context was interrupted.');
      },
      appStore.getSnapshot().graphicsQuality,
    );
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
  let lastHomeLabelSignature: string | null = null;
  let activeLessonModel: SystemModelInstance | null = null;
  let activeLessonOutline: LessonOutlineController | null = null;
  let selectedPartId: string | null = null;
  let tourFlowPhase = 0;
  let isInitialCarBoot = true;

  let compareRig: CompareRigInstance | null = null;
  let compareTransRig: CompareTransmissionsInstance | null = null;
  let compareCategory: CompareCategory = 'drivetrains';
  let compareThrottle = 0.45;
  let comparePlaying = true;
  let compareMobileTab: DrivetrainId = 'petrol';
  let compareTransMobileTab: CompareTransmissionId = 'manual';
  let compareThirdSlot: 'cvt' | 'dct' = 'cvt';

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
  const creditsModal = createCreditsModal(uiRoot, []);
  const errorCard = createModelErrorCard(uiRoot);
  const engineAudio = new EngineAudioSynth();
  const crossSection = new CrossSectionController();
  const measureRuler = new MeasureRulerTool(sceneManager.scene);
  const devDebugHud = createDeveloperDebugHud(uiRoot);

  const liveCaptionBar = document.createElement('div');
  liveCaptionBar.className = 'live-caption-bar';
  liveCaptionBar.hidden = true;
  uiRoot.appendChild(liveCaptionBar);

  const shareToast = document.createElement('div');
  shareToast.className = 'share-toast';
  shareToast.hidden = true;
  uiRoot.appendChild(shareToast);

  const showToast = (msg: string) => {
    shareToast.textContent = msg;
    shareToast.hidden = false;
    window.setTimeout(() => {
      shareToast.hidden = true;
    }, 2400);
  };

  const learningLab = createLearningLabModal(uiRoot, {
    onOpenSystemLesson: (sysId, faultId) => {
      lessonSim.faultId = faultId ?? null;
      void enterLesson(sysId, false, faultId ?? null);
    },
    onDriveUpdate: (d) => {
      lessonSim.rpmOverride = d.rpm;
      lessonSim.throttle = d.throttle;
      lessonSim.brake = d.brake;
      engineAudio.update({
        rpm: d.rpm,
        throttle: d.throttle,
        cylinders: appStore.getSnapshot().selectedEngineConfig === 'v8' ? 8 : 4,
        isEv: appStore.getSnapshot().activePowertrain === 'ev',
      });
    },
  });

  const cleanupActiveSubMode = () => {
    crossSection.clear();
    measureRuler.setActive(false);
    liveCaptionBar.hidden = true;
    if (activeLessonOutline) {
      activeLessonOutline.dispose();
      activeLessonOutline = null;
    }
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
    if (compareTransRig) {
      sceneManager.setCustomRenderCallback(null);
      compareTransRig.dispose();
      compareTransRig = null;
    }
    compareOverlay.close();
  };

  const selectRenderMode = (mode: RenderMode) => {
    if (mode === 'solid' && carRig?.car.quality === 'outline-only' && appStore.getSnapshot().viewMode !== 'lesson') {
      return;
    }
    const quality = appStore.getSnapshot().graphicsQuality;
    sceneManager.renderer.shadowMap.enabled = mode === 'solid' && quality === 'high';
    stage.setRenderState(mode, quality);
    appStore.update({ renderMode: mode });
    const snap = appStore.getSnapshot();
    carRig?.setRenderMode(mode, snap.layers, snap.xrayCar, snap.reduceMotion);
    activeLessonOutline?.setRenderMode(mode);
  };

  const toggleQuality = () => {
    const snap = appStore.getSnapshot();
    const nextQuality = snap.graphicsQuality === 'high' ? 'low' : 'high';
    appStore.update({ graphicsQuality: nextQuality });
    sceneManager.setQuality(nextQuality);
    sceneManager.renderer.shadowMap.enabled = snap.renderMode === 'solid' && nextQuality === 'high';
    stage.setRenderState(snap.renderMode, nextQuality);
    carRig?.setGraphicsQuality(nextQuality);
    const vp = sceneManager.getViewportSize();
    carRig?.setResolution(vp.width, vp.height);
  };

  const selectSystem = (id: SystemId, initialPartId: string | null = null) => {
    appStore.update({
      selectedSystem: id,
      selectedPartId: initialPartId,
      hintDismissed: true,
    });
    if (!carRig) return;

    const snap = appStore.getSnapshot();
    carRig.highlightSystem(id);
    carRig.selectPart(initialPartId ? id : null, initialPartId);
    syncHomeLabels(true);

    if (snap.homeExplode > 0.04) {
      const sphere = carRig.getExplodeFocusSphere();
      if (sphere) {
        cameraRig.fitBoundingSphere(sphere, {
          desktopRightPanel: true,
          reduceMotion: snap.reduceMotion,
          duration: 0.55,
          margin: 1.42,
        });
        return;
      }
    }
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
      selectedPartId: null,
      xrayCar: false,
      homeExplode: 0,
    });
    carRig?.setExplode(0);
    carRig?.selectPart(null, null);
    carRig?.hoverPart(null, null);
    carRig?.highlightSystem(null);
    carRig?.setXRay(false, appStore.getSnapshot().reduceMotion);
    restoreCarLabels();
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

  const loadCompareCategory = async (cat: CompareCategory) => {
    compareCategory = cat;
    if (compareRig) {
      compareRig.dispose();
      compareRig = null;
    }
    if (compareTransRig) {
      compareTransRig.dispose();
      compareTransRig = null;
    }
    if (cat === 'transmissions') {
      const { createCompareTransmissions } = await import('./models/compare/transmissions');
      compareTransRig = createCompareTransmissions(sceneManager.scene.environment);
      cameraRig.focusAt(
        new THREE.Vector3(0.05, 0.72, 0),
        new THREE.Vector3(1.65, 1.48, 3.05),
        appStore.getSnapshot().reduceMotion,
      );
      sceneManager.setCustomRenderCallback((renderer, width, height) => {
        compareTransRig?.render(
          renderer,
          sceneManager.camera,
          width,
          height,
          compareTransMobileTab,
          compareThirdSlot,
        );
      });
    } else {
      const { createCompareDrivetrains } = await import('./models/compare/drivetrains');
      compareRig = createCompareDrivetrains(sceneManager.scene.environment);
      cameraRig.focusAt(
        new THREE.Vector3(0, 0.48, 0),
        new THREE.Vector3(0.45, 1.38, 2.85),
        appStore.getSnapshot().reduceMotion,
      );
      sceneManager.setCustomRenderCallback((renderer, width, height) => {
        compareRig?.render(renderer, sceneManager.camera, width, height, compareMobileTab);
      });
    }
  };

  const enterCompare = async (initialCat: CompareCategory = 'drivetrains') => {
    cleanupActiveSubMode();
    appStore.update({
      viewMode: 'compare',
      activeLesson: null,
      selectedSystem: null,
      loadingPercent: 30,
      loadingLabel: 'Loading side-by-side comparison…',
      carReady: false,
    });

    if (carRig) {
      carRig.root.visible = false;
    }
    stage.setShowroomPropsVisible(false);
    labelProjector.clear();
    labelLayer.innerHTML = '';

    try {
      await loadCompareCategory(initialCat);
      compareOverlay.open(initialCat);
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
      activeLessonOutline?.setXRay(lessonSim.xray);
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

  const syncVariantToUrl = (systemId: SystemId, variant: string) => {
    try {
      const nextUrl = new URL(window.location.href);
      if (systemId === 'transmission') nextUrl.searchParams.set('trans', variant);
      else if (systemId === 'engine') nextUrl.searchParams.set('engine', variant);
      window.history.replaceState(null, '', nextUrl.toString());
    } catch {
      // Ignore URL update error
    }
  };

  const handleVariantChange = async (systemId: SystemId, nextVariant: string) => {
    if (systemId === 'transmission') {
      appStore.update({ selectedTransmission: nextVariant as TransmissionType });
    } else if (systemId === 'engine') {
      appStore.update({ selectedEngineConfig: nextVariant as EngineLayout });
    }
    syncVariantToUrl(systemId, nextVariant);

    const activeCar =
      carsManifest.find((c) => c.id === appStore.getSnapshot().selectedCarId) ?? carRig?.car ?? null;

    if (carRig) {
      await carRig.replaceSystemVariant(systemId, nextVariant);
      if (systemId === 'engine') {
        await Promise.all([
          carRig.replaceSystemVariant('cooling', nextVariant),
          carRig.replaceSystemVariant('exhaust', nextVariant),
        ]);
      }
      carRig.setExplode(appStore.getSnapshot().homeExplode);
      homeOverlay.setAvailableSystems(
        carRig.availableSystems,
        carRig.car.powertrain,
        activeCar,
      );
      if (appStore.getSnapshot().viewMode === 'home') {
        syncHomeLabels(true);
      }
    }

    if (appStore.getSnapshot().viewMode === 'lesson' && appStore.getSnapshot().activeLesson === systemId) {
      await enterLesson(systemId, true);
    }
  };

  const lessonPanel = createLessonPanel(uiRoot, labelLayer, {
    onBackToCar: () => exitLesson(),
    onSelectPart: (partId) => {
      selectedPartId = partId;
      activeLessonModel?.highlightPart(partId);
      activeLessonOutline?.highlightPart(partId);
      lessonPanel.highlightPartUI(partId);
    },
    onSimChange: (patch) => {
      Object.assign(lessonSim, patch);
      if (patch.explode !== undefined && activeLessonModel) {
        activeLessonModel.root.position.y = patch.explode * 0.55;
        activeLessonModel.setExplode(patch.explode);
      }
      if (patch.xray !== undefined) {
        activeLessonModel?.setXRay(patch.xray);
        activeLessonOutline?.setXRay(patch.xray);
      }
    },
    onChangeVariant: (sysId, nextVar) => {
      void handleVariantChange(sysId, nextVar);
    },
    onChangeClip: (axis, ratio) => {
      crossSection.apply(axis, ratio);
    },
    onToggleRuler: (active) => {
      measureRuler.setActive(active);
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
    onChangeCategory: (cat) => {
      void loadCompareCategory(cat);
    },
    onSelectMobileTransTab: (id) => {
      compareTransMobileTab = id;
    },
    onChangeThirdTransSlot: (slot) => {
      compareThirdSlot = slot;
    },
    onExitCompare: resetHome,
  });

  const enterLesson = async (
    systemId: SystemId,
    preserveCameraAndPart = false,
    faultId: string | null = null,
  ) => {
    const prevPartId = preserveCameraAndPart ? selectedPartId : null;
    const prevSim = preserveCameraAndPart ? { ...lessonSim } : null;
    const snapBefore = appStore.getSnapshot();
    const powertrain = snapBefore.activePowertrain;
    const variant = getActiveSystemVariant(snapBefore, systemId);
    const activeCar =
      carsManifest.find((c) => c.id === snapBefore.selectedCarId) ?? carRig?.car ?? null;
    const meta = getSystemMetadata(systemId, powertrain, variant);

    if (preserveCameraAndPart && activeLessonModel && !snapBefore.reduceMotion) {
      canvas.style.opacity = '0.35';
    }

    cleanupActiveSubMode();
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
      const model = await loadSystemModule(systemId, powertrain, variant);
      activeLessonModel = model;

      if (prevSim) {
        Object.assign(lessonSim, prevSim);
      } else {
        const curSnap = appStore.getSnapshot();
        lessonSim.playing = true;
        lessonSim.speed = 1;
        lessonSim.explode = 0;
        lessonSim.xray = false;
        lessonSim.reduceMotion = curSnap.reduceMotion;
        lessonSim.rpmOverride = null;
        lessonSim.aspiration = curSnap.engineAspiration;
        lessonSim.injection = curSnap.engineInjection;
        lessonSim.hybrid = curSnap.engineHybrid;
        lessonSim.brakeType = curSnap.brakeType;
        lessonSim.suspensionType = curSnap.suspensionType;
        lessonSim.steeringType = curSnap.steeringType;
        lessonSim.drivetrainLayout = curSnap.drivetrainLayout;
        lessonSim.differentialMode = curSnap.differentialMode;
        lessonSim.brake = 0;
        lessonSim.roadBump = 1;
        lessonSim.faultId = faultId;
      }

      model.root.position.y = lessonSim.explode * 0.55;
      model.setExplode(lessonSim.explode);
      model.setXRay(lessonSim.xray);
      sceneManager.scene.add(model.root);
      crossSection.attach(model.root);

      const vp = sceneManager.getViewportSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const xrayPartIds =
        systemId === 'engine'
          ? ['cylinder-block']
          : systemId === 'transmission'
            ? ['casing']
            : systemId === 'brakes'
              ? ['caliper']
              : ['engine-jacket', 'thermostat', 'battery', 'alternator', 'catalytic-converter', 'muffler', 'steering-rack', 'shock-damper'];
      activeLessonOutline = createLessonOutlineController(
        model.root,
        new THREE.Vector2(vp.width * dpr, vp.height * dpr),
        xrayPartIds,
      );
      activeLessonOutline.setRenderMode(appStore.getSnapshot().renderMode);
      activeLessonOutline.setXRay(lessonSim.xray);

      // Keep selected part if it still exists in the swapped variant
      const partExists =
        prevPartId !== null &&
        (model.labelAnchors.some((a) => a.partId === prevPartId) ||
          model.partObjects.some((o) => o.userData.partId === prevPartId));
      selectedPartId = partExists ? prevPartId : null;
      model.highlightPart(selectedPartId);
      activeLessonOutline.highlightPart(selectedPartId);

      const partPins = lessonPanel.open(
        systemId,
        lessonSim,
        model.labelAnchors,
        activeCar,
        preserveCameraAndPart,
      );
      if (selectedPartId) {
        lessonPanel.highlightPartUI(selectedPartId);
      }
      labelProjector.setVisible(true);
      labelProjector.setEntries(partPins);

      if (!preserveCameraAndPart) {
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
          target.y -= lessonPanel.isMobileCollapsed() ? 0.16 : 0.65;
          camPos.multiplyScalar(1.32);
        }
        cameraRig.focusAt(target, camPos, appStore.getSnapshot().reduceMotion);
      }

      appStore.update({ carReady: true, loadingPercent: 100, loadingLabel: 'Ready' });
    } catch (err) {
      console.error('Failed to load lesson module:', err);
      exitLesson();
    } finally {
      canvas.style.opacity = '1';
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
    onOpenLab: () => {
      if (learningLab.isOpen()) learningLab.close();
      else learningLab.open();
    },
    onToggleAudio: () => {
      const next = !appStore.getSnapshot().audioEnabled;
      appStore.update({ audioEnabled: next });
      engineAudio.setEnabled(next);
    },
    onShareView: () => {
      const shareUrl = buildShareableViewUrl(sceneManager.camera, cameraRig.controls.target);
      window.history.replaceState(null, '', shareUrl);
      void navigator.clipboard?.writeText(shareUrl).catch(() => {});
      exportCanvasPng(
        sceneManager.renderer,
        sceneManager.scene,
        sceneManager.camera,
        `howcarswork-${appStore.getSnapshot().selectedCarId}.png`,
      );
      showToast('Share URL copied & PNG snapshot saved');
    },
    onResetView: resetHome,
    onToggleXRay: toggleXRay,
    onToggleReduceMotion: toggleReduceMotion,
    onToggleQuality: toggleQuality,
  });

  const homeOverlay = createHomeOverlay(uiRoot, labelLayer, {
    onSelectSystem: (id) => selectSystem(id),
    onResetHome: resetHome,
    onChangeExplode: (amount) => {
      appStore.update({ homeExplode: amount });
      if (!carRig) return;
      carRig.setExplode(amount);
      syncHomeLabels();

      const snap = appStore.getSnapshot();
      if (snap.selectedSystem) {
        if (amount <= 0.01) {
          const aspect = stageEl.clientWidth / Math.max(stageEl.clientHeight, 1);
          const { target, cameraPos } = carRig.getSystemFocus(snap.selectedSystem, aspect);
          cameraRig.focusAt(target, cameraPos, snap.reduceMotion);
        } else {
          const sphere = carRig.getExplodeFocusSphere();
          if (sphere) {
            cameraRig.fitBoundingSphere(sphere, {
              desktopRightPanel: true,
              reduceMotion: snap.reduceMotion,
              duration: 0.35,
              margin: 1.42,
            });
          }
        }
      } else if (amount <= 0.01) {
        cameraRig.resetHome(snap.reduceMotion);
      } else {
        const sphere = carRig.getExplodeFocusSphere();
        if (sphere) {
          cameraRig.fitBoundingSphere(sphere, {
            desktopRightPanel: false,
            reduceMotion: snap.reduceMotion,
            duration: 0.38,
            margin: 1.32,
          });
        }
      }
    },
    onChangeIsolation: (mode) => {
      appStore.update({ isolationMode: mode });
      carRig?.setIsolationMode(mode, appStore.getSnapshot().reduceMotion);
    },
    onResetExplode: () => {
      appStore.update({ homeExplode: 0 });
      carRig?.setExplode(0);
      syncHomeLabels(true);
      cameraRig.resetHome(appStore.getSnapshot().reduceMotion);
    },
    onSelectExplodedPart: (sysId, partId) => {
      const prev = appStore.getSnapshot().selectedPartId;
      const next = prev === partId ? null : partId;
      appStore.update({ selectedPartId: next });
      carRig?.selectPart(next ? sysId : null, next);
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
    onChangeVariant: (sysId, nextVar) => {
      void handleVariantChange(sysId, nextVar);
    },
    onStartTour: () => {
      enterTour(0);
    },
    onDismissHint: () => {
      appStore.update({ hintDismissed: true });
    },
    onChangePaintColor: (colorHex) => {
      appStore.update({ paintColor: colorHex });
      carRig?.setPaintColor(colorHex);
    },
    onOpenCredits: () => {
      if (creditsModal.isOpen()) creditsModal.close();
      else creditsModal.open();
    },
    getSelectedPartInfo: (systemId, partId) => carRig?.getRigPartInfo(systemId, partId) ?? null,
    getSystemBayWarning: (systemId) => carRig?.getSystemBayWarning(systemId),
    onClearSelectedPart: () => {
      appStore.update({ selectedPartId: null });
      carRig?.selectPart(null, null);
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

  function syncHomeLabels(force = false): void {
    if (!carRig) return;
    const snap = appStore.getSnapshot();
    if (snap.viewMode !== 'home') return;
    // Home Exploded slider explodes car parts rather than sub-parts, so keep car system pins active
    const sig = 'hotspots';
    if (!force && sig === lastHomeLabelSignature) return;
    lastHomeLabelSignature = sig;
    homePinEntries = homeOverlay.createHotspotPins(
      carRig.anchors,
      carRig.outwardNormals,
      carRig.systemAnchorObjects,
    );
    labelProjector.setVisible(true);
    labelProjector.setEntries(homePinEntries);
  }

  function restoreCarLabels(): void {
    if (!carRig) return;
    carRig.root.visible = true;
    stage.setShowroomPropsVisible(true);
    syncHomeLabels(true);
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
    const isOutlineOnly = car.quality === 'outline-only';
    headerBar.setSolidEnabled(
      !isOutlineOnly,
      isOutlineOnly ? 'Outline only — no full textured model yet' : undefined,
    );
    if (isOutlineOnly && appStore.getSnapshot().renderMode === 'solid') {
      appStore.update({ renderMode: 'outline' });
    }
    carPicker.setActiveCarId(car.id);
    cameraRig.setHomeCamera(car.defaultCamera);

    try {
      const snap = appStore.getSnapshot();
      const urlOverride = isInitialCarBoot ? hasUrlVariantOverride() : { trans: false, engine: false };
      isInitialCarBoot = false;
      const nextTrans = resolveCarTransmission(
        car,
        urlOverride.trans ? snap.selectedTransmission : undefined,
      );
      const nextEngine = resolveCarEngine(
        car,
        urlOverride.engine ? snap.selectedEngineConfig : undefined,
      );
      appStore.update({
        selectedTransmission: nextTrans,
        selectedEngineConfig: nextEngine,
      });

      const effectiveMode = isOutlineOnly ? 'outline' : snap.renderMode;
      sceneManager.renderer.shadowMap.enabled =
        effectiveMode === 'solid' && snap.graphicsQuality === 'high';
      stage.setRenderState(effectiveMode, snap.graphicsQuality);
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
        effectiveMode,
        snap.layers,
        snap.isolationMode,
        snap.paintColor,
        snap.graphicsQuality,
        {
          transmission: car.powertrain === 'ev' ? 'ev-reducer' : nextTrans,
          engine: nextEngine,
          cooling: nextEngine,
          exhaust: nextEngine,
        },
      );

      if (token !== carSwitchToken) {
        sceneManager.scene.remove(loadedRig.root);
        loadedRig.dispose();
        return;
      }

      carRig = loadedRig;
      const vp = sceneManager.getViewportSize();
      carRig.setResolution(vp.width, vp.height);

      homeOverlay.setAvailableSystems(carRig.availableSystems, car.powertrain, car);

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
      carRig.selectPart(null, null);
      carRig.hoverPart(null, null);
      homeOverlay.setHoverPart(null);
      carRig.highlightSystem(preservedSystem);

      appStore.update({
        selectedCarId: car.id,
        activePowertrain: car.powertrain,
        selectedSystem: preservedSystem,
        selectedPartId: null,
        carReady: true,
        loadingPercent: 100,
        loadingLabel: 'Ready',
      });
      syncHomeLabels(true);

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

  // 3D raycasting for car hotspots / rig parts (Home/Tour) or mechanical sub-parts (Lesson)
  const raycaster = new THREE.Raycaster();
  const pointerDownPos = { x: 0, y: 0 };

  const isObjectVisible = (obj: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  };

  const getHomeRigPickTargets = (): THREE.Mesh[] => {
    if (!carRig) return [];
    const snap = appStore.getSnapshot();
    if (!snap.layers.innerSystems) return [];
    if (snap.selectedSystem) {
      return carRig.rigPickMeshes.filter(
        (m) => (m.userData.systemId as SystemId | undefined) === snap.selectedSystem,
      );
    }
    return carRig.rigPickMeshes;
  };

  const setRaycasterFromPointer = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, sceneManager.camera);
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
  });

  canvas.addEventListener('pointermove', (e) => {
    const snap = appStore.getSnapshot();
    if (
      e.buttons !== 0 ||
      e.target !== canvas ||
      snap.viewMode !== 'home' ||
      !carRig ||
      carPicker.isOpen() ||
      quizModal.isOpen() ||
      glossaryDrawer.isOpen()
    ) {
      carRig?.hoverPart(null, null);
      homeOverlay.setHoverPart(null);
      canvas.style.cursor = '';
      return;
    }

    setRaycasterFromPointer(e.clientX, e.clientY);
    const rigHits = raycaster
      .intersectObjects(getHomeRigPickTargets(), false)
      .filter((h) => isObjectVisible(h.object));

    if (rigHits.length > 0) {
      const hitObj = rigHits[0].object;
      const sysId = hitObj.userData.systemId as SystemId | undefined;
      const partId = hitObj.userData.partId as string | undefined;
      if (sysId && partId) {
        carRig.hoverPart(sysId, partId);
        const info = carRig.getRigPartInfo(sysId, partId);
        homeOverlay.setHoverPart(
          info ? { name: info.name, x: e.clientX, y: e.clientY } : null,
        );
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    carRig.hoverPart(null, null);
    homeOverlay.setHoverPart(null);
    const hotspotHits = raycaster
      .intersectObjects(carRig.hotspotMeshes, false)
      .filter((h) => isObjectVisible(h.object));
    canvas.style.cursor = hotspotHits.length > 0 ? 'pointer' : '';
  });

  canvas.addEventListener('pointerleave', () => {
    carRig?.hoverPart(null, null);
    homeOverlay.setHoverPart(null);
    canvas.style.cursor = '';
  });

  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.hypot(dx, dy) > 6) return;

    const snap = appStore.getSnapshot();
    const mode = snap.viewMode;
    if (mode === 'compare') return;

    setRaycasterFromPointer(e.clientX, e.clientY);

    if (mode === 'lesson' && activeLessonModel) {
      const hits = raycaster.intersectObjects(activeLessonModel.partObjects, true);
      if (hits.length > 0) {
        if (measureRuler.isActive()) {
          const msg = measureRuler.recordPoint(hits[0].point);
          if (msg) lessonPanel.setRulerStatus(msg);
          return;
        }
        const partId = hits[0].object.userData.partId as string | undefined;
        if (partId) {
          const nextId = selectedPartId === partId ? null : partId;
          selectedPartId = nextId;
          activeLessonModel.highlightPart(nextId);
          activeLessonOutline?.highlightPart(nextId);
          lessonPanel.highlightPartUI(nextId);
        }
      }
      return;
    }

    if (carRig && mode === 'home') {
      const rigHits = raycaster
        .intersectObjects(getHomeRigPickTargets(), false)
        .filter((h) => isObjectVisible(h.object));

      if (rigHits.length > 0 && snap.selectedSystem) {
        const hitObj = rigHits[0].object;
        const sysId = hitObj.userData.systemId as SystemId | undefined;
        const partId = hitObj.userData.partId as string | undefined;
        if (sysId && partId) {
          const nextPartId = snap.selectedPartId === partId ? null : partId;
          appStore.update({ selectedPartId: nextPartId, hintDismissed: true });
          carRig.selectPart(nextPartId ? sysId : null, nextPartId);
          return;
        }
      }

      const hotspotHits = raycaster
        .intersectObjects(carRig.hotspotMeshes, false)
        .filter((h) => isObjectVisible(h.object));
      if (hotspotHits.length > 0) {
        const sysId = hotspotHits[0].object.userData.systemId as SystemId | undefined;
        if (sysId) {
          selectSystem(sysId);
          return;
        }
      }

      if (rigHits.length > 0) {
        const hitObj = rigHits[0].object;
        const sysId = hitObj.userData.systemId as SystemId | undefined;
        const partId = hitObj.userData.partId as string | undefined;
        if (sysId && partId) {
          selectSystem(sysId, partId);
        }
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      devDebugHud.toggle();
      return;
    }
    if (e.key === 'Escape') {
      if (learningLab.isOpen()) {
        learningLab.close();
        return;
      }
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
      lessonPanel.setPhaseStatus(status);
      if (state.renderMode === 'outline') {
        activeLessonOutline?.syncDynamicGeometries();
      }
      if (state.audioEnabled) {
        engineAudio.update({
          rpm: status.rpm ?? 1800,
          throttle: lessonSim.throttle ?? 0.35,
          cylinders: state.selectedEngineConfig === 'v8' ? 8 : 4,
          isEv: state.activePowertrain === 'ev',
        });
      }
      if (state.captionsEnabled) {
        liveCaptionBar.hidden = false;
        const parts: string[] = [];
        if (status.statusText) parts.push(status.statusText);
        if (status.activeGear) parts.push(`Gear: ${status.activeGear}`);
        if (status.rpm) parts.push(`${Math.round(status.rpm)} RPM`);
        liveCaptionBar.textContent = parts.join(' · ') || 'System animation active';
      } else {
        liveCaptionBar.hidden = true;
      }
    } else if (
      state.viewMode === 'home' &&
      carRig &&
      state.selectedSystem &&
      state.layers.innerSystems &&
      state.homeExplode <= 0.01
    ) {
      carRig.updateActiveSystem(state.selectedSystem, dt, true, state.reduceMotion);
    }

    const partCount =
      state.viewMode === 'lesson' && activeLessonModel
        ? activeLessonModel.partObjects.length
        : carRig
          ? carRig.rigPickMeshes.length
          : 0;
    devDebugHud.recordFrame(dt, sceneManager.renderer, partCount);

    if (state.viewMode === 'tour' && carRig) {
      tourFlowPhase += dt * (state.reduceMotion ? 0.12 : 0.34);
      carRig.setTourFlow(true, tourFlowPhase);
    } else if (state.viewMode === 'compare' && compareCategory === 'drivetrains' && compareRig) {
      compareRig.update(dt, compareThrottle, comparePlaying, state.reduceMotion);
    } else if (state.viewMode === 'compare' && compareCategory === 'transmissions' && compareTransRig) {
      compareTransRig.update(dt, compareThrottle, comparePlaying, state.reduceMotion);
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
            (state.viewMode === 'lesson' && !lessonPanel.isMobileCollapsed()) ||
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
    activeLessonOutline?.setResolution(width, height);
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

  (
    window as Window & {
      __hcwDebug?: { getMemory: () => { geometries: number; textures: number } };
    }
  ).__hcwDebug = {
    getMemory: () => ({
      geometries: sceneManager.renderer.info.memory.geometries,
      textures: sceneManager.renderer.info.memory.textures,
    }),
  };

  const bootstrapManifestAndInitialCar = async () => {
    try {
      carsManifest = await loadCarsManifest();
      preloadCarThumbnails(carsManifest);
      carPicker.setCars(carsManifest);
      creditsModal.setCars(carsManifest);

      const initialCar = resolveCarFromManifest(
        carsManifest,
        appStore.getSnapshot().selectedCarId,
      );
      await switchCar(initialCar, { preserveSystem: false, updateUrl: false });

      // Restore deep-linked system / lesson / explode / camera pose if present in URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlMode = urlParams.get('mode');
      if (urlMode === 'outline' || urlMode === 'solid') {
        selectRenderMode(urlMode);
      }
      const urlLesson = urlParams.get('lesson') as SystemId | null;
      const urlSys = urlParams.get('sys') as SystemId | null;
      const urlExp = Number(urlParams.get('exp'));
      if (Number.isFinite(urlExp) && urlExp > 0) {
        const clampedExp = Math.max(0, Math.min(1, urlExp));
        appStore.update({ homeExplode: clampedExp });
        carRig?.setExplode(clampedExp);
      }
      if (urlLesson && carRig?.availableSystems.includes(urlLesson)) {
        await enterLesson(urlLesson);
      } else if (urlSys && carRig?.availableSystems.includes(urlSys)) {
        selectSystem(urlSys);
      }
      const camStr = urlParams.get('cam');
      if (camStr) {
        const nums = camStr.split(',').map(Number);
        if (nums.length === 6 && nums.every(Number.isFinite)) {
          cameraRig.focusAt(
            new THREE.Vector3(nums[3], nums[4], nums[5]),
            new THREE.Vector3(nums[0], nums[1], nums[2]),
            true,
          );
        }
      }
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
