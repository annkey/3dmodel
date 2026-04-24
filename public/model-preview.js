import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { KStereoEffect } from "/vendor/kmax/KStereoEffect.js";
import { KStylusRaycaster } from "/vendor/kmax/KStylusRaycaster.js";
import { WSTrack } from "/vendor/kmax/ws-track.js";
import {
  DEFAULT_PANORAMA_NAME,
  DEFAULT_PANORAMA_URL,
  GENERATED_TASK_STORAGE_KEY,
  GENERATOR_PROVIDER_CONFIG,
  OPTIMIZER_PROVIDER_CONFIG,
  PREVIEW_TASK_STORAGE_LIMIT,
  RECENT_STORAGE_KEY,
  STEREO_CONFIG
} from "/model-preview-config.js";
import {
  buildAssetProxyUrl,
  escapeHtml,
  formatBytes,
  formatNumber,
  formatPreviewError,
  formatStatus,
  formatTimeLabel,
  getDisplayProgress,
  getFileNameFromUrl,
  getPreviewModelUrl,
  getTaskStageLabel,
  getTaskStatusLabel,
  inferFormatFromUrl,
  normalizeProviderValue,
  parseStoredJson,
  resolvePlayableModel,
  sanitizeDownloadName,
  sanitizeGenerationText,
  stripExtension
} from "/model-preview-utils.js";
import {
  loadStoredGeneratedTasks,
  renderGeneratedTaskListView,
  saveStoredGeneratedTasks,
  sortGeneratedTaskRecords,
  updateTaskProgressOverlayView,
  upsertGeneratedTaskRecord
} from "/model-preview-task-list.js";

THREE.Cache.enabled = true;

const uploadCard = document.getElementById("upload-card");
const fileInput = document.getElementById("model-files");
const entryFileSelect = document.getElementById("entry-file");
const themeSelect = document.getElementById("theme-select");
const lightRange = document.getElementById("light-range");
const lightValue = document.getElementById("light-value");
const loadButton = document.getElementById("load-model");
const resetCameraButton = document.getElementById("reset-camera");
const autoRotateButton = document.getElementById("toggle-autorotate");
const wireframeButton = document.getElementById("toggle-wireframe");
const gridButton = document.getElementById("toggle-grid");
const explodeButton = document.getElementById("toggle-explode");
const explodeStrengthWrap = document.getElementById("explode-strength-wrap");
const explodeStrengthInput = document.getElementById("explode-strength");
const panoramaTrigger = document.getElementById("panorama-trigger");
const panoramaFileInput = document.getElementById("panorama-file");
const stereoButton = document.getElementById("toggle-stereo-3d");
const fullscreenButton = document.getElementById("toggle-fullscreen");
const exportButton = document.getElementById("export-image");
const submodelSelect = document.getElementById("submodel-select");
const openGeneratorModalButton = document.getElementById("open-generator-modal");
const openOptimizerModalButton = document.getElementById("open-optimizer-modal");
const openModelListModalButton = document.getElementById("open-model-list-modal");
const fileList = document.getElementById("file-list");
const recentList = document.getElementById("recent-list");
const stereoDeviceBadge = document.getElementById("stereo-device-badge");
const stereoStatusDetail = document.getElementById("stereo-status-detail");
const statusText = document.getElementById("status-text");
const fileCount = document.getElementById("file-count");
const formatStat = document.getElementById("format-stat");
const meshStat = document.getElementById("mesh-stat");
const partStat = document.getElementById("part-stat");
const triangleStat = document.getElementById("triangle-stat");
const vertexStat = document.getElementById("vertex-stat");
const animationStat = document.getElementById("animation-stat");
const fileSizeStat = document.getElementById("file-size-stat");
const sizeStat = document.getElementById("size-stat");
const modelName = document.getElementById("model-name");
const modelMeta = document.getElementById("model-meta");
const viewerHost = document.getElementById("viewer");
const viewerShell = document.getElementById("viewer-shell");
const metricsCard = document.querySelector(".metrics-card");
const meshMetric = document.getElementById("mesh-metric");
const generatorModal = document.getElementById("generator-modal");
const optimizerModal = document.getElementById("optimizer-modal");
const modelListModal = document.getElementById("model-list-modal");
const generatorForm = document.getElementById("generator-form");
const generatorModeSelect = document.getElementById("generator-mode");
const generatorConfigSummary = document.getElementById("generator-config-summary");
const generatorPromptField = document.getElementById("generator-prompt-field");
const generatorPromptInput = document.getElementById("generator-prompt");
const generatorImageField = document.getElementById("generator-image-field");
const generatorImageInput = document.getElementById("generator-image");
const generatorTextureQualitySelect = document.getElementById("generator-texture-quality");
const generatorGeometryQualitySelect = document.getElementById("generator-geometry-quality");
const generatorNegativePromptInput = document.getElementById("generator-negative-prompt");
const generatorSubmitButton = document.getElementById("generator-submit");
const generatorFormNote = document.getElementById("generator-form-note");
const optimizerForm = document.getElementById("optimizer-form");
const optimizerCurrentModel = document.getElementById("optimizer-current-model");
const optimizerOperationSelect = document.getElementById("optimizer-operation");
const optimizerRetextureFields = document.getElementById("optimizer-retexture-fields");
const optimizerSplitFields = document.getElementById("optimizer-split-fields");
const optimizerTexturePromptInput = document.getElementById("optimizer-texture-prompt");
const optimizerStyleImageInput = document.getElementById("optimizer-style-image");
const optimizerPreserveUvInput = document.getElementById("optimizer-preserve-uv");
const optimizerEnablePbrInput = document.getElementById("optimizer-enable-pbr");
const optimizerRemoveLightingInput = document.getElementById("optimizer-remove-lighting");
const optimizerSplitPromptInput = document.getElementById("optimizer-split-prompt");
const optimizerSplitStrategySelect = document.getElementById("optimizer-split-strategy");
const optimizerFormNote = document.getElementById("optimizer-form-note");
const optimizerSubmitButton = document.getElementById("optimizer-submit");
const optimizerResultCard = document.getElementById("optimizer-result-card");
const optimizerResultTitle = document.getElementById("optimizer-result-title");
const optimizerResultStatus = document.getElementById("optimizer-result-status");
const optimizerResultMeta = document.getElementById("optimizer-result-meta");
const optimizerResultFill = document.getElementById("optimizer-result-fill");
const optimizerResultActions = document.getElementById("optimizer-result-actions");
const optimizerPlayResultButton = document.getElementById("optimizer-play-result");
const optimizerDownloadResultButton = document.getElementById("optimizer-download-result");
const modelListItems = document.getElementById("model-list-items");
const modelListEmpty = document.getElementById("model-list-empty");
const taskProgressOverlay = document.getElementById("task-progress-overlay");
const taskProgressTitle = document.getElementById("task-progress-title");
const taskProgressMeta = document.getElementById("task-progress-meta");
const taskProgressFill = document.getElementById("task-progress-fill");
const taskProgressPercent = document.getElementById("task-progress-percent");
const taskProgressCloseButton = document.getElementById("task-progress-close");
const taskProgressOpenListButton = document.getElementById("task-progress-open-list");
const modelPlaybackLoading = document.getElementById("model-playback-loading");
const modelPlaybackLoadingTitle = document.getElementById("model-playback-loading-title");
const modelPlaybackLoadingFilename = document.getElementById("model-playback-loading-filename");
const modelPlaybackLoadingFill = document.getElementById("model-playback-loading-fill");
const modelPlaybackLoadingPercent = document.getElementById("model-playback-loading-percent");
const localModelPickerTriggers = Array.from(document.querySelectorAll('[for="model-files"]'));

const resourceMap = new Map();

let currentObject = null;
let animationMixer = null;
let dragDepth = 0;
let isWireframe = false;
let isGridVisible = true;
let isStereoEnabled = true;
let isStereoDisplayActive = false;
let stereoEffect = null;
let stereoTracker = null;
let stylusRaycaster = null;
let stereoTrackingData = null;
let stereoBaseCameraPosition = null;
let stereoBaseTarget = new THREE.Vector3();
let isPointerModelRotating = false;
let activePointerId = null;
let pointerStart = { x: 0, y: 0 };
let modelRotationOnPointerStart = new THREE.Euler(0, 0, 0, "YXZ");
let lastPenPose = null;
let wasPenPressed = false;
let smoothedEyeOffset = new THREE.Vector3();
let lastStylusIntersections = [];
let isPenGrabbingModel = false;
let isPenGrabbingExplodePart = false;
let penGrabbedExplodePart = null;
let penGrabStartPose = null;
let penGrabStartPosition = new THREE.Vector3();
let penGrabStartQuaternion = new THREE.Quaternion();
let penGrabStartScale = new THREE.Vector3(1, 1, 1);
let penGrabStartRotation = null;
let penGrabHitPointLocal = null;
let penExplodePartGrabHitPointLocal = null;
let penExplodePartGrabStartPose = null;
const penExplodePartGrabStartStylusLocal = new THREE.Vector3();
const penExplodePartGrabStartDragOffset = new THREE.Vector3();
let currentObjectSource = "local";
let currentRemoteModelUrl = "";
let currentPanoramaTexture = null;
let currentPanoramaEnvironment = null;
let currentPanoramaName = "";
let apiConfig = null;
let generatedTasks = [];
let activeTaskPollers = new Map();
let activeOptimizationPoller = null;
let activeOptimizationTask = null;
let activeOptimizationPlayable = null;
let activeGeneratingTaskId = "";
let dismissedTaskProgressId = "";
let autoPlayingGeneratedTaskId = "";
let modelLoadRequestId = 0;
let activePlaybackLoadingTaskId = "";
let playbackLoadTimeoutId = null;
let playbackLoadProgressPercent = 0;
let playbackLoadKnownTotalBytes = 0;
let currentModelFileSizeBytes = 0;
let explodeParts = [];
let explodeProgress = 0;
let explodeTarget = 0;
let explodeMode = "none";
let explodeIntensity = 0.65;
let selectedExplodePart = null;
let selectedExplodeSourceMaterials = null;
let selectedExplodeSourceScale = null;
const pointerSelectionRaycaster = new THREE.Raycaster();
const pointerSelectionCoords = new THREE.Vector2();
let pointerDownScreen = null;
let isDraggingSelectedPart = false;
let draggingExplodePart = null;
let suppressNextViewerClick = false;
let selectedPartDragStartScreen = null;
const selectedPartDragStartOffsetWorld = new THREE.Vector3();
const selectedPartDragCameraRight = new THREE.Vector3();
const selectedPartDragCameraUp = new THREE.Vector3();
const selectedPartDragPullDirection = new THREE.Vector3();
let isDraggingWholeModelPointer = false;
let wholeModelDragPointerId = null;
let wholeModelDragStartScreen = null;
const wholeModelDragStartPosition = new THREE.Vector3();
const wholeModelDragCameraRightLocal = new THREE.Vector3();
const wholeModelDragCameraUpLocal = new THREE.Vector3();
let wholeModelDragScreenScale = 0.002;

const MODEL_PLAYBACK_TIMEOUT_MS = 120000;
const EXPLODE_DISTANCE_SCALE = 0.32;
const EXPLODE_ANIMATION_SPEED = 8;

const animationClock = new THREE.Clock();

const scene = new THREE.Scene();
const previewRoot = new THREE.Group();
scene.add(previewRoot);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const stereoCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
camera.position.set(3.5, 2.2, 5.5);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
viewerHost.appendChild(renderer.domElement);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.autoRotate = false;
controls.autoRotateSpeed = 1;

const hemiLight = new THREE.HemisphereLight(0xfff4dd, 0xc98f66, 1.45);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
keyLight.position.set(6, 10, 8);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffd9bf, 1.05);
fillLight.position.set(-6, 5, -6);
scene.add(fillLight);

const grid = new THREE.GridHelper(20, 20, 0xd7b08f, 0xe7d6c7);
grid.position.y = -0.001;
grid.visible = true;
previewRoot.add(grid);

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4ece1,
  transparent: true,
  opacity: 0.95
});
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 64), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.002;
ground.receiveShadow = true;
ground.visible = true;
previewRoot.add(ground);

const panoramaShadowMaterial = new THREE.ShadowMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.24
});
const panoramaShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 64), panoramaShadowMaterial);
panoramaShadow.rotation.x = -Math.PI / 2;
panoramaShadow.position.y = -0.003;
panoramaShadow.receiveShadow = true;
panoramaShadow.visible = false;
previewRoot.add(panoramaShadow);

let activeThemeKey = "studio";

const THEME_SETTINGS = {
  studio: {
    shellClass: "theme-studio",
    background: 0xe8ecef,
    fogNear: 20,
    fogFar: 50,
    ground: 0xe7eaee,
    gridCenter: 0xcad4dd,
    gridLine: 0xe3e9ef,
    hemiSky: 0xf7fbff,
    hemiGround: 0xb7c5d4,
    keyColor: 0xffffff,
    fillColor: 0xdce7f3,
    keyIntensity: 1.05,
    fillIntensity: 0.56
  },
  warm: {
    shellClass: "theme-warm",
    background: 0xf7efe4,
    fogNear: 18,
    fogFar: 44,
    ground: 0xf4ece1,
    gridCenter: 0xd7b08f,
    gridLine: 0xe7d6c7,
    hemiSky: 0xfff4dd,
    hemiGround: 0xc98f66,
    keyColor: 0xffffff,
    fillColor: 0xffd9bf,
    keyIntensity: 1.02,
    fillIntensity: 0.54
  },
  dark: {
    shellClass: "theme-dark",
    background: 0x20242b,
    fogNear: 20,
    fogFar: 55,
    ground: 0x323843,
    gridCenter: 0x506070,
    gridLine: 0x2d3641,
    hemiSky: 0x9caec2,
    hemiGround: 0x1f2937,
    keyColor: 0xd8e2f0,
    fillColor: 0x64748b,
    keyIntensity: 0.92,
    fillIntensity: 0.46,
    metricsTone: "light"
  },
  cyber: {
    shellClass: "theme-cyber",
    background: 0x08121d,
    fogNear: 18,
    fogFar: 48,
    ground: 0x071b26,
    gridCenter: 0x00d6ff,
    gridLine: 0x11344f,
    hemiSky: 0x79f0ff,
    hemiGround: 0x041829,
    keyColor: 0x8defff,
    fillColor: 0x355dff,
    keyIntensity: 1.95,
    fillIntensity: 1.15,
    metricsTone: "light"
  },
  hologram: {
    shellClass: "theme-hologram",
    background: 0xe8f8ff,
    fogNear: 18,
    fogFar: 46,
    ground: 0xdff3fb,
    gridCenter: 0x7bd2ff,
    gridLine: 0xc9ecff,
    hemiSky: 0xf7feff,
    hemiGround: 0x80b9d9,
    keyColor: 0xffffff,
    fillColor: 0x80d8ff,
    keyIntensity: 0.98,
    fillIntensity: 0.54
  },
  blueprint: {
    shellClass: "theme-blueprint",
    background: 0x102139,
    fogNear: 20,
    fogFar: 52,
    ground: 0x122a47,
    gridCenter: 0x89c4ff,
    gridLine: 0x244b76,
    hemiSky: 0xb8dfff,
    hemiGround: 0x0f2038,
    keyColor: 0xc7e2ff,
    fillColor: 0x4d89cb,
    keyIntensity: 1.88,
    fillIntensity: 1,
    metricsTone: "light"
  },
  sunset: {
    shellClass: "theme-sunset",
    background: 0x3c2644,
    fogNear: 18,
    fogFar: 46,
    ground: 0x473248,
    gridCenter: 0xffc176,
    gridLine: 0x7f4e63,
    hemiSky: 0xffd2a3,
    hemiGround: 0x56344d,
    keyColor: 0xffe0b6,
    fillColor: 0xff8f70,
    keyIntensity: 1.78,
    fillIntensity: 1.02,
    metricsTone: "light"
  },
  forest: {
    shellClass: "theme-forest",
    background: 0x233a31,
    fogNear: 18,
    fogFar: 48,
    ground: 0x30453b,
    gridCenter: 0x8cbf87,
    gridLine: 0x405f4f,
    hemiSky: 0xdff0ce,
    hemiGround: 0x33483e,
    keyColor: 0xf1f5cf,
    fillColor: 0x6faa7e,
    keyIntensity: 1.7,
    fillIntensity: 0.98,
    metricsTone: "light"
  },
  museum: {
    shellClass: "theme-museum",
    background: 0x2f271f,
    fogNear: 18,
    fogFar: 46,
    ground: 0x3d3228,
    gridCenter: 0xdab178,
    gridLine: 0x6a5740,
    hemiSky: 0xf8e1c3,
    hemiGround: 0x5a4535,
    keyColor: 0xffefd2,
    fillColor: 0xc49b68,
    keyIntensity: 1.74,
    fillIntensity: 0.96,
    metricsTone: "light"
  },
  panorama: {
    shellClass: "theme-panorama",
    background: 0x0f172a,
    fogNear: 24,
    fogFar: 72,
    ground: 0x172033,
    gridCenter: 0xaec3da,
    gridLine: 0x415268,
    hemiSky: 0xffffff,
    hemiGround: 0x415268,
    keyColor: 0xffffff,
    fillColor: 0xaec3da,
    keyIntensity: 0.84,
    fillIntensity: 0.42,
    metricsTone: "light"
  }
};

bootstrap();

async function bootstrap() {
  stereoEffect = new KStereoEffect(renderer);
  stereoEffect.setSize(window.innerWidth, window.innerHeight);
  stereoEffect.setViewScale(1);
  stereoEffect.setCameraFrustum = applyStereoCameraFrustum;
  stylusRaycaster = new KStylusRaycaster(scene);
  stylusRaycaster.line.visible = false;
  stylusRaycaster.helper.visible = false;
  if (panoramaTrigger) {
    panoramaTrigger.dataset.label = "上传全景图";
    panoramaTrigger.title = "上传全景图";
    themeSelect?.insertAdjacentElement("afterend", panoramaTrigger);
  }

  bindLocalModelPickerTriggers();
  fileInput.addEventListener("change", handleLocalFileInputChange);
  fileInput.addEventListener("input", handleLocalFileInputChange);
  panoramaFileInput?.addEventListener("change", () => {
    const file = panoramaFileInput.files?.[0];
    if (file) {
      void handlePanoramaSelected(file);
    }
  });
  entryFileSelect.addEventListener("change", () => {
    highlightSelectedEntry();
    if (entryFileSelect.value) {
      void handleLoadModel();
    }
  });
  themeSelect.addEventListener("change", async () => {
    if (themeSelect.value === "panorama") {
      await ensureDefaultPanoramaLoaded();
    }
    applyTheme(themeSelect.value);
  });
  lightRange.addEventListener("input", () => updateLightStrength(Number(lightRange.value)));
  loadButton.addEventListener("click", () => void handleLoadModel());
  resetCameraButton.addEventListener("click", resetCameraView);
  autoRotateButton.addEventListener("click", toggleAutoRotate);
  wireframeButton.addEventListener("click", toggleWireframe);
  gridButton.addEventListener("click", toggleGrid);
  explodeButton?.addEventListener("click", toggleExplodedView);
  explodeStrengthInput?.addEventListener("input", handleExplodeStrengthInput);
  stereoButton.addEventListener("click", toggleStereoMode);
  fullscreenButton.addEventListener("click", () => void toggleFullscreen());
  exportButton.addEventListener("click", exportPng);
  submodelSelect?.addEventListener("change", () => {
    const selected = submodelSelect.value;
    if (!selected) {
      return;
    }
    entryFileSelect.value = selected;
    highlightSelectedEntry();
    void handleLoadModel();
  });
  openGeneratorModalButton.addEventListener("click", () => openModal(generatorModal));
  openOptimizerModalButton?.addEventListener("click", () => {
    syncOptimizerFormState();
    openModal(optimizerModal);
  });
  openModelListModalButton.addEventListener("click", () => {
    renderGeneratedTaskList();
    openModal(modelListModal);
  });
  taskProgressOpenListButton.addEventListener("click", () => {
    renderGeneratedTaskList();
    openModal(modelListModal);
  });
  taskProgressCloseButton?.addEventListener("click", dismissTaskProgressOverlay);
  generatorModeSelect.addEventListener("change", syncGeneratorModeFieldState);
  optimizerOperationSelect?.addEventListener("change", syncOptimizerFormState);
  generatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleGeneratorSubmit();
  });
  optimizerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleOptimizerSubmit();
  });
  optimizerPlayResultButton?.addEventListener("click", () => void playOptimizationResult());
  optimizerDownloadResultButton?.addEventListener("click", downloadOptimizationResult);
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(button.dataset.closeModal || "");
      closeModal(modal);
    });
  });
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("resize", handleResize);
  renderer.domElement.addEventListener("pointerdown", handleViewerPointerDown);
  renderer.domElement.addEventListener("pointermove", handleViewerPointerMove);
  renderer.domElement.addEventListener("pointerup", handleViewerPointerUp);
  renderer.domElement.addEventListener("click", handleViewerClick);
  renderer.domElement.addEventListener("pointercancel", handleViewerPointerUp);
  renderer.domElement.addEventListener("lostpointercapture", handleViewerPointerUp);
  window.addEventListener("kmax-module-ready", () => {
    syncStereoRuntimeParams();
    if (isStereoEnabled && document.fullscreenElement === viewerShell) {
      maybeActivateStereoDisplay();
    }
    updateStereoButton();
    if (isStereoEnabled && !isStereoDisplayActive) {
      setStatus("裸眼 3D 引擎已就绪，进入全屏后生效");
    }
  });
  window.addEventListener("error", (event) => {
    setStatus("脚本错误");
    modelMeta.textContent = formatPreviewError(event.error || event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    setStatus("加载错误");
    modelMeta.textContent = formatPreviewError(event.reason);
  });

  bindDragAndDrop();
  setupStereoTracking();
  loadRecentEntries();
  loadGeneratedTasks();
  if (themeSelect.value === "panorama") {
    await ensureDefaultPanoramaLoaded();
  }
  applyTheme(themeSelect.value);
  updateLightStrength(Number(lightRange.value || 1.4));
  explodeIntensity = THREE.MathUtils.clamp(Number(explodeStrengthInput?.value || 65) / 100, 0, 1);
  controls.addEventListener("change", handleControlsChange);
  handleResize();
  animate();

  setStatus("准备就绪");
  modelName.textContent = "尚未加载模型";
  modelMeta.textContent = "上传本地模型文件后，即可在浏览器中预览。";
  setMetricsVisibility(false);
  updateAutoRotateButton();
  updateWireframeButton();
  updateGridButton();
  updateExplodeButton();
  updateExplodeStrengthVisibility();
  updateStereoButton();
  updateFullscreenButton();
  updateTaskProgressOverlay(null);

  try {
    apiConfig = await fetchJson("/api/config");
  } catch (error) {
    apiConfig = null;
    setStatus(error.message || "服务配置读取失败");
  }

  syncGeneratorFormForProvider();
  syncGeneratorModeFieldState();
  syncOptimizerFormState();
  resumePendingGeneratedTasks();
}

function setupStereoTracking() {
  try {
    stereoTracker = new WSTrack();
    stereoTracker.ondata = (data) => {
      stereoTrackingData = data;
    };

    stereoTracker.ws?.addEventListener("open", () => {
      if (isStereoEnabled && document.fullscreenElement === viewerShell) {
        maybeActivateStereoDisplay();
      }
      updateStereoButton();
      if (isStereoEnabled && !isStereoDisplayActive) {
        setStatus("检测到裸眼 3D 设备服务，进入全屏后将启用立体显示");
      }
    });

    stereoTracker.ws?.addEventListener("close", () => {
      stereoTrackingData = null;
      if (isStereoDisplayActive) {
        deactivateStereoDisplay();
      }
      updateStereoButton();
    });

    stereoTracker.ws?.addEventListener("error", () => {
      updateStereoButton();
    });
  } catch {
    stereoTracker = null;
    updateStereoButton();
  }
}

function bindDragAndDrop() {
  if (!uploadCard) {
    return;
  }

  const prevent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((type) => {
    uploadCard.addEventListener(type, prevent);
  });

  uploadCard.addEventListener("dragenter", () => {
    dragDepth += 1;
    uploadCard.classList.add("drag-active");
  });

  uploadCard.addEventListener("dragover", () => {
    uploadCard.classList.add("drag-active");
  });

  uploadCard.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      uploadCard.classList.remove("drag-active");
    }
  });

  uploadCard.addEventListener("drop", (event) => {
    dragDepth = 0;
    uploadCard.classList.remove("drag-active");
    const files = Array.from(event.dataTransfer?.files || []);
    syncFileInput(files);
    applySelectedFiles(files);
  });
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  closeModal(generatorModal);
  closeModal(optimizerModal);
  closeModal(modelListModal);
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
}

function dismissTaskProgressOverlay() {
  if (!activeGeneratingTaskId) {
    updateTaskProgressOverlay(null);
    return;
  }

  dismissedTaskProgressId = activeGeneratingTaskId;
  updateTaskProgressOverlay(null);
  setStatus("生成任务仍在后台进行，可在 3D 模型列表里继续查看进度");
}

function fillSelectOptions(select, options, selectedValue) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    if (option.value === selectedValue) {
      element.selected = true;
    }
    select.appendChild(element);
  }
}

function bindLocalModelPickerTriggers() {
  for (const trigger of localModelPickerTriggers) {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openLocalModelPicker();
    });
  }
}

function openLocalModelPicker() {
  if (!fileInput) {
    setStatus("本地文件选择器不可用");
    return;
  }

  fileInput.value = "";

  if (typeof fileInput.showPicker === "function") {
    try {
      fileInput.showPicker();
      return;
    } catch {}
  }

  fileInput.click();
}

function handleLocalFileInputChange(event) {
  const files = Array.from(event.target?.files || []);
  if (!files.length) {
    return;
  }

  applySelectedFiles(files);
}

function getActiveGeneratorConfig() {
  const providers = apiConfig?.providers || {};
  const configuredProvider = normalizeProviderValue(apiConfig?.generatorSettings?.provider);
  const fallbackProvider = providers[configuredProvider]?.enabled
    ? configuredProvider
    : providers.meshy?.enabled
      ? "meshy"
      : "tripo";
  const provider = providers[fallbackProvider] ? fallbackProvider : "tripo";
  const providerConfig = GENERATOR_PROVIDER_CONFIG[provider];
  const providerApiConfig = providers[provider] || {};

  return {
    provider,
    providerName: apiConfig?.generatorSettings?.providerName || providerApiConfig.name || providerConfig.name,
    modelVersion: apiConfig?.generatorSettings?.modelVersion || providerApiConfig.defaultModelVersion || providerConfig.defaultModelVersion,
    enabled: providerApiConfig.enabled !== false
  };
}

function syncGeneratorFormForProvider() {
  const activeConfig = getActiveGeneratorConfig();
  const providerConfig = GENERATOR_PROVIDER_CONFIG[activeConfig.provider];
  fillSelectOptions(
    generatorTextureQualitySelect,
    providerConfig.textureOptions,
    providerConfig.defaultTextureQuality
  );
  fillSelectOptions(
    generatorGeometryQualitySelect,
    providerConfig.geometryOptions,
    providerConfig.defaultGeometryQuality
  );

  generatorImageInput.accept = providerConfig.imageAccept;
  generatorPromptInput.placeholder = providerConfig.textPlaceholder;
  if (generatorConfigSummary) {
    generatorConfigSummary.textContent = "";
  }
  generatorFormNote.textContent = "";
}

function getActiveOptimizerConfig() {
  const providers = apiConfig?.optimization?.providers || {};
  const operation = optimizerOperationSelect?.value === "split" ? "split" : "retexture";
  const preferredProvider = operation === "retexture" ? "meshy" : "tripo";
  const fallbackProvider = providers[preferredProvider]
    ? preferredProvider
    : providers.meshy
      ? "meshy"
      : "tripo";
  const provider = providers[fallbackProvider] ? fallbackProvider : preferredProvider;
  const providerConfig = OPTIMIZER_PROVIDER_CONFIG[provider] || OPTIMIZER_PROVIDER_CONFIG.meshy;
  const providerApiConfig = providers[provider] || {};

  return {
    provider,
    providerName: providerApiConfig.name || providerConfig.name,
    modelVersion: providerApiConfig.defaultModelVersion
      || PROVIDER_CONFIG_FALLBACK(provider).defaultModelVersion,
    modelVersions: providerApiConfig.modelVersions
      || PROVIDER_CONFIG_FALLBACK(provider).modelVersions,
    operations: providerApiConfig.operations || {}
  };
}

function PROVIDER_CONFIG_FALLBACK(provider) {
  return provider === "tripo" ? GENERATOR_PROVIDER_CONFIG.tripo : GENERATOR_PROVIDER_CONFIG.meshy;
}

function sanitizeOptimizerText(text, fallback = "") {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized
    .replace(/Meshy\s*AI贴图任务/g, "AI贴图任务")
    .replace(/Meshy\s*贴图阶段/g, "AI贴图阶段")
    .replace(/Meshy\s*预览阶段/g, "预览阶段")
    .replace(/Meshy\s*图片生成阶段/g, "图片生成阶段")
    .replace(/Meshy\s*生成任务/g, "生成任务")
    .replace(/Meshy/g, "")
    .replace(/Tripo3D/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[:：\s-]+|[:：\s-]+$/g, "")
    || fallback;
}

function describeCurrentOptimizationTarget() {
  if (!currentObject) {
    return {
      ready: false,
      text: "当前还没有正在播放的模型，请先加载模型。",
      note: "AI模型优化针对当前预览对象工作。"
    };
  }

  if (currentObjectSource === "remote" && currentRemoteModelUrl) {
    const fileName = getFileNameFromUrl(currentRemoteModelUrl) || modelName.textContent || "远程模型";
    return {
      ready: true,
      sourceType: "remote",
      modelUrl: currentRemoteModelUrl,
      label: fileName,
      extension: getExtension(fileName),
      text: "",
      note: ""
    };
  }

  const selectedName = entryFileSelect.value;
  const modelFile = resourceMap.get(selectedName);
  if (!modelFile) {
    return {
      ready: false,
      text: "当前模型来源无法识别，请重新加载一次模型后再试。",
      note: ""
    };
  }

  const extension = getExtension(modelFile.name);
  const multiFileHint = ["gltf", "obj"].includes(extension)
    ? "当前为多文件格式，优化服务通常更适合 GLB / FBX / STL；如果结果异常，建议先转换成单文件格式。"
    : "";

  return {
    ready: true,
    sourceType: "local",
    modelFile,
    label: modelFile.name,
    extension,
    text: "",
    note: multiFileHint
  };
}

function syncOptimizerFormState() {
  if (!optimizerOperationSelect) {
    return;
  }

  if (optimizerOperationSelect.value === "split") {
    optimizerOperationSelect.value = "retexture";
  }

  const operation = optimizerOperationSelect.value === "split" ? "split" : "retexture";
  const target = describeCurrentOptimizationTarget();

  optimizerRetextureFields?.classList.toggle("hidden", operation !== "retexture");
  optimizerSplitFields?.classList.toggle("hidden", operation !== "split");

  if (optimizerCurrentModel) {
    optimizerCurrentModel.textContent = target.ready ? "" : target.text;
    optimizerCurrentModel.classList.toggle("hidden", target.ready);
  }

  optimizerFormNote.textContent = "";
  optimizerSubmitButton.textContent = operation === "split" ? "开始优化当前模型" : "开始优化当前模型";

  if (!target.ready) {
    optimizerSubmitButton.disabled = true;
    return;
  }

  optimizerSubmitButton.disabled = false;
}

function syncGeneratorModeFieldState() {
  const mode = generatorModeSelect.value === "image" ? "image" : "text";
  generatorPromptField.classList.toggle("hidden", mode !== "text");
  generatorImageField.classList.toggle("hidden", mode !== "image");
}

async function handleGeneratorSubmit() {
  const activeConfig = getActiveGeneratorConfig();
  const provider = activeConfig.provider;
  const providerConfig = GENERATOR_PROVIDER_CONFIG[provider];
  const mode = generatorModeSelect.value === "image" ? "image" : "text";
  const prompt = generatorPromptInput.value.trim();
  const negativePrompt = generatorNegativePromptInput?.value.trim() || "";
  const imageFile = generatorImageInput.files?.[0] || null;

  if (mode === "text") {
    if (!prompt) {
      setStatus("请输入生成提示词");
      generatorPromptInput.focus();
      return;
    }
  } else {
    if (!imageFile) {
      setStatus("请先选择一张参考图片");
      generatorImageInput.focus();
      return;
    }
  }

  generatorSubmitButton.disabled = true;
  generatorSubmitButton.textContent = "正在提交...";
  closeModal(generatorModal);

  dismissedTaskProgressId = "";
  activeGeneratingTaskId = "creating";
  updateTaskProgressOverlay({
    id: "creating",
    provider,
    providerName: activeConfig.providerName,
    prompt: prompt || (generatorImageInput.files?.[0]?.name || "图片生成"),
    status: "queued",
    statusText: "正在创建任务",
    stageText: "正在提交生成请求",
    progress: 2,
    finalized: false
  });
  setStatus("正在提交生成请求，请稍候...");

  try {
    const result = await submitGeneratorTask({
      provider,
      mode,
      prompt,
      negativePrompt,
      imageFile,
      modelVersion: activeConfig.modelVersion,
      textureQuality: generatorTextureQualitySelect.value,
      geometryQuality: generatorGeometryQualitySelect.value
    });

    if (!result.taskId) {
      throw createDetailedError(`${activeConfig.providerName} 没有返回任务 ID。`, result);
    }

    const createdTask = upsertGeneratedTask({
      id: result.taskId,
      taskId: result.taskId,
      provider,
      providerName: result.providerName || activeConfig.providerName,
      mode,
      prompt: prompt || (imageFile?.name || "图片生成"),
      displayModelVersion: result.displayModelVersion || getGeneratorDefaults(provider).modelVersion,
      textureQuality: generatorTextureQualitySelect.value,
      geometryQuality: generatorGeometryQualitySelect.value,
      fileSizeBytes: 0,
      status: "queued",
      statusText: "任务已创建，等待生成",
      stageText: "任务创建成功",
      progress: 5,
      finalized: false,
      preferredModelUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (dismissedTaskProgressId === "creating") {
      dismissedTaskProgressId = createdTask.id;
    }
    activeGeneratingTaskId = createdTask.id;
    updateTaskProgressOverlay(createdTask);
    renderGeneratedTaskList();
    setStatus("已提交生成请求，正在等待模型生成");
    await pollGeneratedTask(createdTask.id, provider);
  } catch (error) {
    clearTaskProgressOverlay();
    setStatus(error.message || "模型生成提交失败");
    generatorFormNote.textContent = error.message || "模型生成提交失败";
    openModal(generatorModal);
  } finally {
    generatorSubmitButton.disabled = false;
    generatorSubmitButton.textContent = "开始生成";
  }
}

async function handleOptimizerSubmit() {
  const activeConfig = getActiveOptimizerConfig();
  const provider = activeConfig.provider;
  const operation = optimizerOperationSelect.value === "split" ? "split" : "retexture";
  const target = describeCurrentOptimizationTarget();

  if (!target.ready) {
    setStatus(target.text);
    syncOptimizerFormState();
    return;
  }

  if (operation === "retexture") {
    const texturePrompt = optimizerTexturePromptInput.value.trim();
    const styleImage = optimizerStyleImageInput.files?.[0] || null;

    if (!texturePrompt && !styleImage) {
      setStatus("AI贴图至少需要提示词或一张风格参考图");
      optimizerTexturePromptInput.focus();
      return;
    }
  }

  optimizerSubmitButton.disabled = true;
  optimizerSubmitButton.textContent = "正在提交...";
  renderOptimizerTaskState({
    title: "正在创建优化任务",
    status: "提交中",
    meta: "正在接收当前模型...",
    progress: 6,
    finalized: false
  });
  setStatus("正在提交模型优化请求，请稍候...");

  try {
    const result = await submitOptimizerTask({
      provider,
      operation,
      target,
      modelVersion: activeConfig.modelVersion
    });

    if (!result.taskId) {
      throw createDetailedError("优化任务没有返回任务 ID。", result);
    }

    activeOptimizationTask = {
      id: result.taskId,
      provider: result.provider || provider,
      operation: result.operation || operation,
      providerName: result.providerName || activeConfig.providerName,
      displayModelVersion: result.displayModelVersion || activeConfig.modelVersion
    };
    activeOptimizationPlayable = null;

    renderOptimizerTaskState({
      title: operation === "split" ? "AI拆模型已提交" : "AI贴图已提交",
      status: "处理中",
      meta: `任务 ID：${result.taskId}`,
      progress: 10,
      finalized: false
    });

    await pollOptimizerTask(result.taskId, activeOptimizationTask.provider, activeOptimizationTask.operation);
  } catch (error) {
    renderOptimizerTaskState({
      title: "优化提交失败",
      status: "失败",
      meta: error.message || "模型优化提交失败",
      progress: 0,
      finalized: true
    });
    optimizerFormNote.textContent = error.message || "模型优化提交失败";
    setStatus(error.message || "模型优化提交失败");
  } finally {
    optimizerSubmitButton.disabled = false;
    optimizerSubmitButton.textContent = "开始优化当前模型";
  }
}

async function submitOptimizerTask({ provider, operation, target, modelVersion }) {
  const payload = new FormData();
  payload.append("provider", provider);
  payload.append("operation", operation);
  payload.append("modelVersion", modelVersion);
  payload.append("target", "preview");
  payload.append("saveMode", "new_revision");

  if (target.sourceType === "remote" && target.modelUrl) {
    payload.append("modelUrl", target.modelUrl);
  } else if (target.modelFile) {
    payload.append("modelFile", target.modelFile);
  }

  if (operation === "retexture") {
    payload.append("texturePrompt", optimizerTexturePromptInput.value.trim());
    payload.append("preserveUv", String(optimizerPreserveUvInput.checked));
    payload.append("enablePbr", String(optimizerEnablePbrInput.checked));
    payload.append("removeLighting", String(optimizerRemoveLightingInput.checked));

    const styleImage = optimizerStyleImageInput.files?.[0] || null;
    if (styleImage) {
      payload.append("styleImage", styleImage);
    }
  } else {
    payload.append("splitPrompt", optimizerSplitPromptInput.value.trim());
    payload.append("splitStrategy", optimizerSplitStrategySelect.value);
  }

  return fetchJson("/api/model-optimize", {
    method: "POST",
    body: payload
  });
}

async function pollOptimizerTask(taskId, provider, operation) {
  clearOptimizerPoller();

  const run = async () => {
    try {
      const task = await fetchJson(
        `/api/model-optimize/task/${taskId}?provider=${encodeURIComponent(provider)}&operation=${encodeURIComponent(operation)}`
      );
      const progress = clampProgress(task.progress);
      const playable = resolvePlayableModel(task);
      const finished = Boolean(task.finalized);
      activeOptimizationPlayable = playable?.url ? { ...playable, task } : null;

      renderOptimizerTaskState({
        title: task.operation === "split" ? "AI拆模型" : "AI贴图",
        status: formatStatus(task.statusText || task.status),
        meta: sanitizeOptimizerText(task.stageText || task.statusText || "处理中", "处理中"),
        progress,
        finalized: finished,
        playable: Boolean(activeOptimizationPlayable)
      });

      if (finished) {
        clearOptimizerPoller();
        setStatus(task.status === "success" ? "模型优化已完成" : (task.statusText || "模型优化已结束"));
      }
    } catch (error) {
      clearOptimizerPoller();
      renderOptimizerTaskState({
        title: "优化查询失败",
        status: "失败",
        meta: error.message || "优化任务状态查询失败",
        progress: 0,
        finalized: true
      });
      setStatus(error.message || "优化任务状态查询失败");
    }
  };

  await run();
  activeOptimizationPoller = window.setInterval(run, 4000);
}

function renderOptimizerTaskState({ title, status, meta, progress, finalized, playable = false }) {
  optimizerResultCard?.classList.remove("hidden");
  optimizerResultTitle.textContent = title || "AI模型优化";
  optimizerResultStatus.textContent = status || "处理中";
  optimizerResultMeta.textContent = meta || "";
  optimizerResultFill.style.width = `${Math.max(0, Math.min(100, progress || 0))}%`;
  optimizerResultActions.classList.toggle("hidden", !(finalized && playable));
}

function clearOptimizerPoller() {
  if (activeOptimizationPoller) {
    clearInterval(activeOptimizationPoller);
    activeOptimizationPoller = null;
  }
}

async function playOptimizationResult() {
  if (!activeOptimizationPlayable?.url) {
    setStatus("当前优化任务还没有可播放的模型");
    return;
  }

  if (activePlaybackLoadingTaskId) {
    setStatus("已有模型正在加载中，请等待当前加载完成后再切换");
    return;
  }

  const task = {
    id: activeOptimizationTask?.id || `optimization-${Date.now()}`,
    prompt: optimizerResultTitle?.textContent || "优化结果",
    preferredModelUrl: activeOptimizationPlayable.url
  };

  closeModal(optimizerModal);
  beginPlaybackLoading(task);
  const assetMetaPromise = readRemoteAssetMetadata(activeOptimizationPlayable.url).then((assetMeta) => assetMeta);

  try {
    const loaded = await loadRemoteModel(activeOptimizationPlayable.url, {
      name: stripExtension(getFileNameFromUrl(activeOptimizationPlayable.url)) || "optimized-model",
      formatHint: activeOptimizationPlayable.format,
      timeoutMs: MODEL_PLAYBACK_TIMEOUT_MS,
      taskId: task.id,
      assetMetaPromise
    });

    if (!loaded) {
      setStatus("优化结果加载失败，请稍后重试");
    }
  } finally {
    endPlaybackLoading();
  }
}

function downloadOptimizationResult() {
  if (!activeOptimizationPlayable?.url) {
    setStatus("当前优化任务还没有可下载的模型");
    return;
  }

  const extension = getExtension(activeOptimizationPlayable.format || inferFormatFromUrl(activeOptimizationPlayable.url) || "glb") || "glb";
  const safeName = sanitizeDownloadName(`${modelName.textContent || "current-model"}-optimized`);
  const link = document.createElement("a");
  link.href = buildAssetProxyUrl(activeOptimizationPlayable.url);
  link.download = `${safeName}.${extension}`;
  link.click();
  setStatus("优化模型下载已开始");
}

function getGeneratorDefaults(provider) {
  const normalizedProvider = normalizeProviderValue(provider);
  const providerConfig = GENERATOR_PROVIDER_CONFIG[normalizedProvider];
  const providerApiConfig = apiConfig?.providers?.[normalizedProvider] || {};
  const activeConfig = getActiveGeneratorConfig();

  return {
    modelVersion: activeConfig.provider === normalizedProvider
      ? activeConfig.modelVersion
      : providerApiConfig.defaultModelVersion || providerConfig.defaultModelVersion,
    textureQuality: providerConfig.defaultTextureQuality,
    geometryQuality: providerConfig.defaultGeometryQuality
  };
}

async function submitGeneratorTask({
  provider,
  mode,
  prompt,
  negativePrompt,
  imageFile,
  modelVersion,
  textureQuality,
  geometryQuality
}) {
  const defaults = getGeneratorDefaults(provider);
  const payload = new FormData();
  payload.append("provider", provider);
  payload.append("mode", mode);
  payload.append("modelVersion", modelVersion || defaults.modelVersion);
  payload.append("textureQuality", textureQuality || defaults.textureQuality);
  payload.append("geometryQuality", geometryQuality || defaults.geometryQuality);
  payload.append("negativePrompt", negativePrompt || "");

  if (mode === "text") {
    payload.append("prompt", prompt);
  } else if (imageFile) {
    payload.append("image", imageFile);
  }

  return fetchJson("/api/generate", {
    method: "POST",
    body: payload
  });
}

function loadGeneratedTasks() {
  generatedTasks = loadStoredGeneratedTasks({
    storageKey: GENERATED_TASK_STORAGE_KEY,
    parseStoredJson
  });
  renderGeneratedTaskList();
}

function saveGeneratedTasks() {
  generatedTasks = saveStoredGeneratedTasks({
    storageKey: GENERATED_TASK_STORAGE_KEY,
    tasks: generatedTasks,
    limit: PREVIEW_TASK_STORAGE_LIMIT
  });
}

function sortGeneratedTasks() {
  generatedTasks = sortGeneratedTaskRecords(generatedTasks);
}

function upsertGeneratedTask(task) {
  const nextState = upsertGeneratedTaskRecord(generatedTasks, task);
  generatedTasks = nextState.tasks;
  saveGeneratedTasks();
  return nextState.task;
}

function renderGeneratedTaskList() {
  renderGeneratedTaskListView({
    tasks: generatedTasks,
    modelListItems,
    modelListEmpty,
    activePlaybackLoadingTaskId,
    onPlay(taskId) {
      void playGeneratedTask(taskId);
    },
    onDownload(taskId) {
      downloadGeneratedTask(taskId);
    },
    onDelete(taskId) {
      deleteGeneratedTask(taskId);
    },
    onRefresh(taskId) {
      const task = generatedTasks.find((item) => item.id === taskId);
      if (task) {
        void pollGeneratedTask(task.id, task.provider, true);
      }
    },
    escapeHtml,
    formatBytes,
    formatStatus,
    formatTimeLabel,
    getDisplayProgress,
    getTaskStageLabel,
    resolvePlayableModel
  });
}

function updateTaskProgressOverlay(task) {
  updateTaskProgressOverlayView({
    task,
    activeGeneratingTaskId,
    dismissedTaskProgressId,
    overlay: taskProgressOverlay,
    title: taskProgressTitle,
    meta: taskProgressMeta,
    fill: taskProgressFill,
    percent: taskProgressPercent,
    getDisplayProgress,
    getTaskStageLabel,
    getTaskStatusLabel
  });
}

function clearTaskProgressOverlay(taskId = "") {
  if (taskId && activeGeneratingTaskId && activeGeneratingTaskId !== taskId) {
    return;
  }

  dismissedTaskProgressId = "";
  activeGeneratingTaskId = "";
  updateTaskProgressOverlay(null);
}

function resumePendingGeneratedTasks() {
  for (const task of generatedTasks) {
    if (!task.finalized && task.taskId && task.provider) {
      void pollGeneratedTask(task.id, task.provider, true);
    }
  }
}

async function pollGeneratedTask(taskId, provider, force = false) {
  if (activeTaskPollers.has(taskId)) {
    if (!force) {
      return;
    }
    stopTaskPolling(taskId);
  }

  const run = async () => {
    try {
      const task = await fetchJson(`/api/task/${taskId}?provider=${encodeURIComponent(provider)}`);
      return await handleGeneratedTaskUpdate(taskId, provider, task);
    } catch (error) {
      const current = generatedTasks.find((item) => item.id === taskId);
      if (current) {
        const failedTask = upsertGeneratedTask({
          ...current,
          status: "failed",
          statusText: error.message || "任务查询失败",
          finalized: true,
          updatedAt: new Date().toISOString()
        });
        if (activeGeneratingTaskId === taskId) {
          updateTaskProgressOverlay(failedTask);
        }
      }
      stopTaskPolling(taskId);
      return false;
    }
  };

  const shouldContinuePolling = await run();
  if (!shouldContinuePolling) {
    return;
  }
  const intervalId = window.setInterval(run, 4000);
  activeTaskPollers.set(taskId, intervalId);
}

function stopTaskPolling(taskId) {
  const intervalId = activeTaskPollers.get(taskId);
  if (intervalId) {
    clearInterval(intervalId);
    activeTaskPollers.delete(taskId);
  }
}

async function handleGeneratedTaskUpdate(requestTaskId, provider, task) {
  if (task.transition?.nextTaskId && task.transition.nextTaskId !== requestTaskId) {
    const currentTask = generatedTasks.find((item) => item.id === requestTaskId) || {};
    stopTaskPolling(requestTaskId);

    const transitionedTask = upsertGeneratedTask({
      ...currentTask,
      id: task.transition.nextTaskId,
      taskId: task.transition.nextTaskId,
      provider,
      providerName: task.providerName || currentTask.providerName,
      mode: task.mode || currentTask.mode,
      displayModelVersion: task.displayModelVersion || currentTask.displayModelVersion,
      prompt: currentTask.prompt || task.input?.prompt || currentTask.id,
      status: "running",
      statusText: task.transition.statusText || task.statusText || "正在进入下一阶段",
      stageText: task.transition.stageText || task.stageText || "处理中",
      progress: typeof task.progress === "number" ? task.progress : 0,
      finalized: false,
      updatedAt: new Date().toISOString()
    });

    generatedTasks = generatedTasks.filter((item) => item.id !== requestTaskId);
    saveGeneratedTasks();
    renderGeneratedTaskList();

    if (activeGeneratingTaskId === requestTaskId) {
      activeGeneratingTaskId = transitionedTask.id;
      if (dismissedTaskProgressId === requestTaskId) {
        dismissedTaskProgressId = transitionedTask.id;
      }
      updateTaskProgressOverlay(transitionedTask);
    }

    await pollGeneratedTask(transitionedTask.id, provider, true);
    return false;
  }

  const currentTask = generatedTasks.find((item) => item.id === requestTaskId) || {};
  const nextTask = upsertGeneratedTask({
    ...currentTask,
    id: task.taskId || requestTaskId,
    taskId: task.taskId || requestTaskId,
    provider,
    providerName: task.providerName || currentTask.providerName || provider,
    mode: task.mode || currentTask.mode || "text",
    displayModelVersion: task.displayModelVersion || currentTask.displayModelVersion || "",
    textureQuality: task.textureQuality || currentTask.textureQuality || "",
    geometryQuality: task.geometryQuality || currentTask.geometryQuality || "",
    fileSizeBytes: Number(task.fileSizeBytes || currentTask.fileSizeBytes || 0),
    prompt: currentTask.prompt || task.input?.prompt || currentTask.id,
    status: task.status,
    statusText: task.statusText || task.status,
    stageText: task.stageText || "",
    progress: typeof task.progress === "number" ? task.progress : 0,
    finalized: Boolean(task.finalized),
    preferredModelUrl: getPreviewModelUrl(task) || currentTask.preferredModelUrl || "",
    renderedImage: task.renderedImage || currentTask.renderedImage || "",
    modelUrls: task.modelUrls || currentTask.modelUrls || null,
    output: task.output || currentTask.output || null,
    updatedAt: new Date().toISOString()
  });

  renderGeneratedTaskList();
  if (activeGeneratingTaskId === nextTask.id || activeGeneratingTaskId === requestTaskId) {
    activeGeneratingTaskId = nextTask.id;
    updateTaskProgressOverlay(nextTask);
  }

  if (nextTask.finalized) {
    stopTaskPolling(nextTask.id);

    if (nextTask.status === "success" && nextTask.preferredModelUrl) {
      setStatus("模型生成成功，可直接播放");
      if (
        activeGeneratingTaskId === nextTask.id
        && dismissedTaskProgressId !== nextTask.id
        && autoPlayingGeneratedTaskId !== nextTask.id
      ) {
        autoPlayingGeneratedTaskId = nextTask.id;
        window.setTimeout(() => {
          void playGeneratedTask(nextTask.id);
        }, 200);
      }
    } else if (nextTask.status !== "success") {
      setStatus(nextTask.statusText || "模型生成失败");
    }

    if (activeGeneratingTaskId === nextTask.id) {
      window.setTimeout(() => clearTaskProgressOverlay(nextTask.id), 1200);
    }
  }

  return !nextTask.finalized;
}

async function playGeneratedTask(taskId) {
  if (activePlaybackLoadingTaskId) {
    setStatus(
      activePlaybackLoadingTaskId === taskId
        ? "模型正在加载中，请稍候..."
        : "已有模型正在加载中，请等待当前加载完成后再切换"
    );
    return;
  }

  const task = generatedTasks.find((item) => item.id === taskId);
  if (!task) {
    setStatus("没有找到要播放的模型");
    return;
  }

  const playable = resolvePlayableModel(task);
  if (!playable?.url) {
    setStatus("当前任务还没有可播放的模型文件");
    return;
  }

  closeModal(modelListModal);
  beginPlaybackLoading(task);
  const assetMetaPromise = readRemoteAssetMetadata(playable.url).then((assetMeta) => {
    if (activePlaybackLoadingTaskId !== task.id) {
      return assetMeta;
    }

    if (assetMeta.sizeBytes > 0) {
      upsertGeneratedTask({
        ...task,
        fileSizeBytes: assetMeta.sizeBytes
      });
      renderGeneratedTaskList();
    }
    return assetMeta;
  });

  try {
    const loaded = await loadRemoteModel(playable.url, {
      name: task.prompt || `${task.providerName || task.provider} 生成模型`,
      formatHint: playable.format,
      timeoutMs: MODEL_PLAYBACK_TIMEOUT_MS,
      taskId: task.id,
      assetMetaPromise
    });

    if (!loaded) {
      setStatus("模型加载失败，请稍后重试");
    }
  } finally {
    endPlaybackLoading();
  }
}

function downloadGeneratedTask(taskId) {
  const task = generatedTasks.find((item) => item.id === taskId);
  if (!task) {
    setStatus("没有找到要下载的模型");
    return;
  }

  const playable = resolvePlayableModel(task);
  if (!playable?.url) {
    setStatus("当前任务还没有可下载的模型文件");
    return;
  }

  const extension = getExtension(playable.format || inferFormatFromUrl(playable.url) || "glb") || "glb";
  const safeName = sanitizeDownloadName(task.prompt || task.taskId || "generated-model");
  const link = document.createElement("a");
  link.href = buildAssetProxyUrl(playable.url);
  link.download = `${safeName}.${extension}`;
  link.click();
  setStatus("模型下载已开始");
}

function deleteGeneratedTask(taskId) {
  if (!taskId) {
    return;
  }

  if (activePlaybackLoadingTaskId === taskId) {
    setStatus("当前模型正在加载中，请稍后再删除记录");
    return;
  }

  stopTaskPolling(taskId);
  if (activeGeneratingTaskId === taskId) {
    clearTaskProgressOverlay(taskId);
  }
  generatedTasks = generatedTasks.filter((item) => item.id !== taskId);
  saveGeneratedTasks();
  renderGeneratedTaskList();
  setStatus("模型记录已删除");
}

function applySelectedFiles(files) {
  resourceMap.clear();
  currentObjectSource = "local";
  currentRemoteModelUrl = "";

  if (files.length > 0) {
    beginLocalSelectionLoading(files);
  } else {
    endLocalSelectionLoading();
  }

  for (const file of files) {
    resourceMap.set(file.name, file);
  }

  fileCount.textContent = String(files.length);
  updateFileList(files);
  updateEntryOptions(files);

  if (files.length === 0) {
    setStatus("等待上传");
    resetStats();
    modelName.textContent = "尚未加载模型";
    modelMeta.textContent = "上传本地模型文件后，即可在浏览器中预览。";
    clearCurrentObject();
    syncOptimizerFormState();
    return;
  }

  if (entryFileSelect.value) {
    setStatus("文件已就绪");
    highlightSelectedEntry();
    void handleLoadModel();
  } else {
    setStatus("未发现可预览模型文件");
    resetStats();
    modelName.textContent = "没有可预览的模型";
    modelMeta.textContent = "请上传 .glb、.gltf、.fbx、.obj 或 .stl 文件。";
    showLocalSelectionError("未发现可预览模型文件。请至少选择一个 .glb、.gltf、.fbx、.obj 或 .stl 文件。");
    clearCurrentObject();
    syncOptimizerFormState();
  }
}

function syncFileInput(files) {
  if (typeof DataTransfer === "undefined") return;
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  fileInput.files = transfer.files;
}

async function handleLoadModel() {
  const selectedName = entryFileSelect.value;
  const entryFile = resourceMap.get(selectedName);

  if (!entryFile) {
    setStatus("请先选择模型文件");
    return;
  }

  loadButton.disabled = true;
  setStatus("正在加载模型...");
  modelName.textContent = entryFile.name;
  formatStat.textContent = getExtension(entryFile.name).toUpperCase();
  const requestId = beginModelLoadRequest();
  currentModelFileSizeBytes = entryFile.size || 0;

  try {
    await loadModel(entryFile, requestId);
    if (!isModelLoadRequestCurrent(requestId)) {
      return;
    }
    applyWireframeState();
    captureStereoReferenceCamera();
    setStatus("预览已加载");
    endLocalSelectionLoading();
    syncOptimizerFormState();
  } catch (error) {
    if (!isModelLoadRequestCurrent(requestId)) {
      return;
    }
    clearCurrentObject();
    resetStats();
    setStatus("模型预览失败");
    modelMeta.textContent = formatPreviewError(error);
    showLocalSelectionError(formatPreviewError(error));
    syncOptimizerFormState();
  } finally {
    loadButton.disabled = false;
  }
}

async function loadModel(entryFile, requestId) {
  const extension = getExtension(entryFile.name);
  const manager = createLoadingManager();

  if (extension === "glb" || extension === "gltf") {
    await loadGltf(entryFile, manager, requestId);
    return;
  }

  if (extension === "fbx") {
    await loadFbx(entryFile, manager, requestId);
    return;
  }

  if (extension === "obj") {
    await loadObj(entryFile, manager, requestId);
    return;
  }

  if (extension === "stl") {
    await loadStl(entryFile, requestId);
    return;
  }

  throw new Error(`当前不支持 .${extension} 格式预览`);
}

async function loadRemoteModel(modelUrl, options = {}) {
  const requestId = beginModelLoadRequest();
  loadButton.disabled = true;
  const timeoutMs = Number(options.timeoutMs) || MODEL_PLAYBACK_TIMEOUT_MS;
  let timeoutId = null;
  currentModelFileSizeBytes = 0;

  const modelLabel = options.name || stripExtension(getFileNameFromUrl(modelUrl)) || "远程模型";
  const formatHint = options.formatHint || inferFormatFromUrl(modelUrl);
  const proxiedUrl = buildAssetProxyUrl(modelUrl);
  const onProgress = createRemoteProgressReporter(options.taskId);

  setStatus("正在加载生成结果...");
  modelName.textContent = modelLabel;
  formatStat.textContent = String(formatHint || "-").toUpperCase();
  updatePlaybackLoadingProgress({
    taskId: options.taskId,
    phase: "download",
    status: "正在加载模型资源...",
    percent: 3
  });

  try {
    if (options.assetMetaPromise) {
      void options.assetMetaPromise.catch(() => null);
    }

    await Promise.race([
      (async () => {
        const extension = getExtension(formatHint || modelUrl);

        if (extension === "glb" || extension === "gltf") {
          await loadRemoteGltf(proxiedUrl, requestId, onProgress);
        } else if (extension === "fbx") {
          await loadRemoteFbx(proxiedUrl, requestId, onProgress);
        } else if (extension === "obj") {
          await loadRemoteObj(proxiedUrl, requestId, onProgress);
        } else if (extension === "stl") {
          await loadRemoteStl(proxiedUrl, requestId, onProgress);
        } else {
          throw new Error(`当前暂不支持直接播放 ${extension.toUpperCase()} 远程模型`);
        }
      })(),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          cancelModelLoadRequest(requestId);
          reject(new Error("模型加载超时，请稍后重试"));
        }, timeoutMs);
      })
    ]);

    if (!isModelLoadRequestCurrent(requestId)) {
      return false;
    }
    currentObjectSource = "remote";
    currentRemoteModelUrl = modelUrl;
    applyWireframeState();
    captureStereoReferenceCamera();
    updatePlaybackLoadingProgress({
      taskId: options.taskId,
      phase: "done",
      status: "模型已完成解析，正在进入预览器...",
      percent: 100
    });
    setStatus("生成模型已载入预览器");
    syncOptimizerFormState();
    return true;
  } catch (error) {
    if (!isModelLoadRequestCurrent(requestId)) {
      if (String(error?.message || "").includes("超时")) {
        resetStats();
        modelMeta.textContent = "模型加载超时，请稍后重试。";
        setStatus("模型加载超时，请稍后重试");
      }
      return false;
    }
    clearCurrentObject();
    resetStats();
    modelMeta.textContent = formatPreviewError(error);
    setStatus("生成模型加载失败");
    syncOptimizerFormState();
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    loadButton.disabled = false;
  }
}

async function loadGltf(entryFile, manager, requestId) {
  const loader = new GLTFLoader(manager);
  const dracoLoader = new DRACOLoader(manager);
  dracoLoader.setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const url = createObjectUrl(entryFile);
  let gltf;

  try {
    gltf = await loader.loadAsync(url);
  } finally {
    safeRevokeObjectUrl(url);
    dracoLoader.dispose();
  }

  if (!isModelLoadRequestCurrent(requestId)) {
    disposeObject(gltf.scene);
    return;
  }

  currentObject = gltf.scene;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(gltf.animations || []);
  updateModelStats(entryFile.name, gltf.animations?.length || 0);
}

async function loadRemoteGltf(modelUrl, requestId, onProgress) {
  const manager = createRemoteLoadingManager(onProgress);
  const loader = new GLTFLoader(manager);
  const dracoLoader = new DRACOLoader(manager);
  dracoLoader.setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  let gltf;
  try {
    gltf = await loadWithProgress(loader, modelUrl, onProgress);
  } finally {
    dracoLoader.dispose();
  }

  if (!isModelLoadRequestCurrent(requestId)) {
    disposeObject(gltf.scene);
    return;
  }

  currentObject = gltf.scene;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(gltf.animations || []);
  updateModelStats(getFileNameFromUrl(modelUrl), gltf.animations?.length || 0);
}

async function loadFbx(entryFile, manager, requestId) {
  const loader = new FBXLoader(manager);
  const url = createObjectUrl(entryFile);
  let fbx;

  try {
    fbx = await loader.loadAsync(url);
  } finally {
    safeRevokeObjectUrl(url);
  }

  if (!isModelLoadRequestCurrent(requestId)) {
    disposeObject(fbx);
    return;
  }

  currentObject = fbx;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(fbx.animations || []);
  updateModelStats(entryFile.name, fbx.animations?.length || 0);
}

async function loadRemoteFbx(modelUrl, requestId, onProgress) {
  const loader = new FBXLoader(createRemoteLoadingManager(onProgress));
  const fbx = await loadWithProgress(loader, modelUrl, onProgress);

  if (!isModelLoadRequestCurrent(requestId)) {
    disposeObject(fbx);
    return;
  }

  currentObject = fbx;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(fbx.animations || []);
  updateModelStats(getFileNameFromUrl(modelUrl), fbx.animations?.length || 0);
}

async function loadObj(entryFile, manager, requestId) {
  const objLoader = new OBJLoader(manager);
  const mtlFile = findSiblingFile(".mtl");

  if (mtlFile) {
    const mtlLoader = new MTLLoader(manager);
    const mtlUrl = createObjectUrl(mtlFile);

    try {
      const materials = await mtlLoader.loadAsync(mtlUrl);
      materials.preload();
      objLoader.setMaterials(materials);
    } finally {
      safeRevokeObjectUrl(mtlUrl);
    }
  }

  const objUrl = createObjectUrl(entryFile);
  let obj;

  try {
    obj = await objLoader.loadAsync(objUrl);
  } finally {
    safeRevokeObjectUrl(objUrl);
  }

  currentObject = obj;
  currentObject.traverse((child) => {
    if (child.isMesh && !child.material) {
      child.material = new THREE.MeshStandardMaterial({ color: 0xd8b18f });
    }
  });

  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(entryFile.name, 0);
}

async function loadRemoteObj(modelUrl, requestId, onProgress) {
  const loader = new OBJLoader(createRemoteLoadingManager(onProgress));
  const obj = await loadWithProgress(loader, modelUrl, onProgress);

  if (!isModelLoadRequestCurrent(requestId)) {
    disposeObject(obj);
    return;
  }

  currentObject = obj;
  currentObject.traverse((child) => {
    if (child.isMesh && !child.material) {
      child.material = new THREE.MeshStandardMaterial({ color: 0xd8b18f });
    }
  });

  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(getFileNameFromUrl(modelUrl), 0);
}

async function loadStl(entryFile, requestId) {
  const loader = new STLLoader();
  const arrayBuffer = await entryFile.arrayBuffer();
  const geometry = loader.parse(arrayBuffer);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xc58d67,
    metalness: 0.08,
    roughness: 0.76
  });

  if (!isModelLoadRequestCurrent(requestId)) {
    geometry.dispose();
    material.dispose();
    return;
  }

  currentObject = new THREE.Mesh(geometry, material);
  currentObject.castShadow = true;
  currentObject.receiveShadow = true;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(entryFile.name, 0);
}

async function loadRemoteStl(modelUrl, requestId, onProgress) {
  const loader = new STLLoader();
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`无法读取远程 STL 模型 (${response.status})`);
  }

  const totalBytes = Number(response.headers.get("content-length") || 0);
  if (totalBytes > 0) {
    playbackLoadKnownTotalBytes = totalBytes;
    currentModelFileSizeBytes = totalBytes;
  }
  const arrayBuffer = await readResponseArrayBufferWithProgress(response, (loadedBytes, totalHint) => {
    onProgress?.({
      loaded: loadedBytes,
      total: totalHint || totalBytes
    });
  });
  const geometry = loader.parse(arrayBuffer);
  onProgress?.({ stage: "parse", percent: 96, detail: "正在解析 STL 几何体..." });
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xc58d67,
    metalness: 0.08,
    roughness: 0.76
  });

  if (!isModelLoadRequestCurrent(requestId)) {
    geometry.dispose();
    material.dispose();
    return;
  }

  currentObject = new THREE.Mesh(geometry, material);
  currentObject.castShadow = true;
  currentObject.receiveShadow = true;
  previewRoot.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(getFileNameFromUrl(modelUrl), 0);
}

function createLoadingManager() {
  const manager = new THREE.LoadingManager();
  const objectUrls = new Map();

  manager.setURLModifier((url) => {
    const cleanUrl = decodeURIComponent(url.split("?")[0]);
    const file = findResourceFileByUrl(cleanUrl);

    if (!file) {
      return url;
    }

    if (!objectUrls.has(file.name)) {
      objectUrls.set(file.name, createObjectUrl(file));
    }

    return objectUrls.get(file.name);
  });

  manager.onLoad = () => {
    for (const tempUrl of objectUrls.values()) {
      safeRevokeObjectUrl(tempUrl);
    }
  };

  return manager;
}

function createRemoteLoadingManager(onProgress) {
  const manager = new THREE.LoadingManager();

  manager.onStart = (_url, loaded, total) => {
    if (total > 1) {
      onProgress?.({
        stage: "dependencies",
        loadedItems: loaded,
        totalItems: total
      });
    }
  };

  manager.onProgress = (_url, loaded, total) => {
    if (total > 1) {
      onProgress?.({
        stage: "dependencies",
        loadedItems: loaded,
        totalItems: total
      });
    }
  };

  manager.onLoad = () => {
    onProgress?.({
      stage: "parse",
      percent: 98,
      detail: "依赖资源已就绪，正在整理场景..."
    });
  };

  return manager;
}

function loadWithProgress(loader, url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (event) => onProgress?.(event),
      reject
    );
  });
}

async function readResponseArrayBufferWithProgress(response, onProgress) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const arrayBuffer = await response.arrayBuffer();
    onProgress?.(arrayBuffer.byteLength, arrayBuffer.byteLength);
    return arrayBuffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loadedBytes = 0;
  const totalBytes = Number(response.headers.get("content-length") || 0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
      loadedBytes += value.byteLength;
      onProgress?.(loadedBytes, totalBytes);
    }
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

function playAnimations(animations) {
  animationMixer = null;

  if (!currentObject || !animations || animations.length === 0) {
    animationStat.textContent = "0";
    return;
  }

  animationMixer = new THREE.AnimationMixer(currentObject);
  for (const clip of animations) {
    animationMixer.clipAction(clip).play();
  }
  animationStat.textContent = String(animations.length);
}

function clearCurrentObject() {
  resetExplodedView(true);
  clearSelectedExplodePart();

  if (!currentObject) {
    animationMixer = null;
    currentObjectSource = "local";
    currentRemoteModelUrl = "";
    currentModelFileSizeBytes = 0;
    updateExplodeButton();
    syncOptimizerFormState();
    return;
  }

  previewRoot.remove(currentObject);
  disposeObject(currentObject);
  currentObject = null;
  animationMixer = null;
  currentObjectSource = "local";
  currentRemoteModelUrl = "";
  currentModelFileSizeBytes = 0;
  resetStereoSceneFit();
  updateExplodeButton();
  syncOptimizerFormState();
}

function beginModelLoadRequest() {
  modelLoadRequestId += 1;
  clearCurrentObject();
  return modelLoadRequestId;
}

function cancelModelLoadRequest(requestId) {
  if (!isModelLoadRequestCurrent(requestId)) {
    return;
  }

  modelLoadRequestId += 1;
  clearCurrentObject();
}

function isModelLoadRequestCurrent(requestId) {
  return requestId === modelLoadRequestId;
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function beginPlaybackLoading(task, assetMeta = {}) {
  if (playbackLoadTimeoutId) {
    clearTimeout(playbackLoadTimeoutId);
  }

  activePlaybackLoadingTaskId = task.id;
  playbackLoadProgressPercent = 0;
  playbackLoadKnownTotalBytes = Number(assetMeta.sizeBytes || 0);
  modelPlaybackLoadingTitle.textContent = "正在加载模型资源...";
  const fileLabel = task.prompt || getFileNameFromUrl(task.preferredModelUrl || "") || "模型文件名称";
  modelPlaybackLoadingFilename.textContent = `“${fileLabel}”`;
  modelPlaybackLoadingPercent.textContent = "0%";
  modelPlaybackLoadingFill.style.width = "0%";
  modelPlaybackLoading.classList.remove("hidden");
  renderGeneratedTaskList();

  playbackLoadTimeoutId = window.setTimeout(() => {
    if (!activePlaybackLoadingTaskId || activePlaybackLoadingTaskId !== task.id) {
      return;
    }

    setStatus("模型加载超时，请稍后重试");
    endPlaybackLoading();
  }, MODEL_PLAYBACK_TIMEOUT_MS + 500);
}

function beginLocalSelectionLoading(files) {
  if (!modelPlaybackLoading) {
    return;
  }

  const names = files
    .filter((file) => file && file.name)
    .map((file) => file.name);
  const primaryName = names[0] || "本地模型文件";
  const extraCount = Math.max(names.length - 1, 0);

  modelPlaybackLoadingTitle.textContent = "正在读取本地模型...";
  modelPlaybackLoadingFilename.textContent = extraCount > 0
    ? `“${primaryName}” 等 ${names.length} 个文件`
    : `“${primaryName}”`;
  modelPlaybackLoadingPercent.textContent = "准备中";
  modelPlaybackLoadingFill.style.width = "12%";
  modelPlaybackLoading.classList.remove("hidden");
}

function showLocalSelectionError(message) {
  if (!modelPlaybackLoading) {
    return;
  }

  modelPlaybackLoadingTitle.textContent = "本地模型加载失败";
  modelPlaybackLoadingFilename.textContent = message || "请选择有效的模型文件，并确保依赖文件完整。";
  modelPlaybackLoadingPercent.textContent = "失败";
  modelPlaybackLoadingFill.style.width = "100%";
}

function endLocalSelectionLoading() {
  if (!modelPlaybackLoading || activePlaybackLoadingTaskId) {
    return;
  }

  modelPlaybackLoading.classList.add("hidden");
}

function endPlaybackLoading() {
  if (playbackLoadTimeoutId) {
    clearTimeout(playbackLoadTimeoutId);
    playbackLoadTimeoutId = null;
  }

  activePlaybackLoadingTaskId = "";
  playbackLoadProgressPercent = 0;
  playbackLoadKnownTotalBytes = 0;
  modelPlaybackLoading.classList.add("hidden");
  renderGeneratedTaskList();
}

function updatePlaybackLoadingProgress({
  taskId,
  phase = "",
  status = "",
  percent,
  loadedBytes = 0,
  totalBytes = 0
} = {}) {
  if (taskId && activePlaybackLoadingTaskId && taskId !== activePlaybackLoadingTaskId) {
    return;
  }

  if (totalBytes > 0) {
    playbackLoadKnownTotalBytes = totalBytes;
    currentModelFileSizeBytes = totalBytes;
  }

  let nextPercent = Number.isFinite(percent) ? clampProgress(percent) : playbackLoadProgressPercent;
  if (!Number.isFinite(percent) && playbackLoadKnownTotalBytes > 0 && loadedBytes > 0) {
    nextPercent = clampProgress((loadedBytes / playbackLoadKnownTotalBytes) * 88);
  }
  if (phase === "parse") {
    nextPercent = Math.max(nextPercent, 92);
  }
  if (phase === "done") {
    nextPercent = 100;
  }

  playbackLoadProgressPercent = Math.max(playbackLoadProgressPercent, nextPercent);
  modelPlaybackLoadingFill.style.width = `${playbackLoadProgressPercent}%`;
  modelPlaybackLoadingPercent.textContent = `${playbackLoadProgressPercent}%`;
}

function createRemoteProgressReporter(taskId) {
  return (payload = {}) => {
    if (activePlaybackLoadingTaskId !== taskId) {
      return;
    }

    if (payload.stage === "dependencies") {
      const loadedItems = Number(payload.loadedItems || 0);
      const totalItems = Number(payload.totalItems || 0);
      const ratio = totalItems > 0 ? loadedItems / totalItems : 0;
      updatePlaybackLoadingProgress({
        taskId,
        phase: "parse",
        status: "正在解析模型依赖...",
        percent: 92 + Math.round(ratio * 6)
      });
      return;
    }

    if (payload.stage === "parse") {
      updatePlaybackLoadingProgress({
        taskId,
        phase: "parse",
        status: payload.detail || "正在解析模型结构...",
        percent: payload.percent ?? 96
      });
      return;
    }

    const loadedBytes = Number(payload.loaded || 0);
    const totalBytes = Number(payload.total || 0) || playbackLoadKnownTotalBytes;
    const hasTotal = totalBytes > 0;
    const percent = hasTotal
      ? Math.round((Math.min(loadedBytes, totalBytes) / totalBytes) * 88)
      : Math.min(88, Math.max(playbackLoadProgressPercent, 6));

      updatePlaybackLoadingProgress({
        taskId,
        phase: "download",
        status: "正在加载模型资源...",
        loadedBytes,
        totalBytes,
        percent
    });
  };
}

async function readRemoteAssetMetadata(url) {
  try {
    const response = await fetch(buildAssetProxyUrl(url), { method: "HEAD" });
    if (!response.ok) {
      return {
        sizeBytes: 0,
        contentType: ""
      };
    }

    return {
      sizeBytes: Number(response.headers.get("content-length") || 0),
      contentType: response.headers.get("content-type") || ""
    };
  } catch {
    return {
      sizeBytes: 0,
      contentType: ""
    };
  }
}

function disposeObject(root) {
  root.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (!child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && typeof value === "object" && "minFilter" in value) {
          value.dispose?.();
        }
      }
      material.dispose?.();
    }
  });
}

function normalizeObject(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.8 / maxAxis;
  object.scale.multiplyScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(object);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  object.position.sub(scaledCenter);
  const finalBox = new THREE.Box3().setFromObject(object);
  object.position.y -= finalBox.min.y;
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxDim * 1.8;

  camera.position.set(center.x + distance * 0.95, center.y + distance * 0.36, center.z + distance * 0.95);
  camera.near = Math.max(0.1, distance / 100);
  camera.far = Math.max(100, distance * 10);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(0.5, distance / 8);
  controls.maxDistance = Math.max(10, distance * 4);
  controls.target.set(center.x, Math.max(center.y * 0.92, size.y * 0.32), center.z);
  controls.update();
  syncStereoRuntimeParams();
  captureStereoReferenceCamera();
}

function collectExplodableParts(object) {
  if (!object) {
    return [];
  }

  const rootBox = new THREE.Box3().setFromObject(object);
  if (rootBox.isEmpty()) {
    return [];
  }

  const rootCenter = rootBox.getCenter(new THREE.Vector3());
  const rootSize = rootBox.getSize(new THREE.Vector3());
  const fallbackDistance = Math.max(rootSize.length() * 0.06, 0.035);
  const meshes = [];

  object.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
    }
  });

  return meshes
    .map((mesh, index) => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      if (meshBox.isEmpty()) {
        return null;
      }

      const meshCenter = meshBox.getCenter(new THREE.Vector3());
      const meshSize = meshBox.getSize(new THREE.Vector3());
      const directionWorld = meshCenter.clone().sub(rootCenter);

      if (directionWorld.lengthSq() < 1e-8) {
        const angle = (index / Math.max(meshes.length, 1)) * Math.PI * 2;
        directionWorld.set(Math.cos(angle), index % 2 === 0 ? 0.2 : -0.2, Math.sin(angle));
      }

      directionWorld.normalize();

      const parentWorldQuaternion = mesh.parent
        ? mesh.parent.getWorldQuaternion(new THREE.Quaternion())
        : new THREE.Quaternion();
      const directionLocal = directionWorld.applyQuaternion(parentWorldQuaternion.invert()).normalize();
      const distance = Math.max(meshSize.length() * EXPLODE_DISTANCE_SCALE, fallbackDistance);

      return {
        id: mesh.uuid,
        object: mesh,
        basePosition: mesh.position.clone(),
        direction: directionLocal,
        distance,
        dragOffset: new THREE.Vector3()
      };
    })
    .filter(Boolean);
}

function syncExplodeParts() {
  explodeParts = collectExplodableParts(currentObject);
  if (explodeParts.length <= 1) {
    explodeMode = "none";
    explodeTarget = 0;
    explodeProgress = 0;
  }
  applyExplodedLayout();
  updateExplodeButton();
  updateExplodeStrengthVisibility();
}

function applyExplodedLayout() {
  for (const part of explodeParts) {
    let factor = 0;

    if (explodeMode === "all") {
      factor = explodeProgress * explodeIntensity;
    } else if (explodeMode === "single" && selectedExplodePart?.id === part.id) {
      factor = explodeProgress * explodeIntensity * 1.2;
    }

    part.object.position
      .copy(part.basePosition)
      .addScaledVector(part.direction, part.distance * factor)
      .add(part.dragOffset);
  }

  currentObject?.updateMatrixWorld(true);
}

function updateExplodedLayout(delta) {
  if (!explodeParts.length && explodeProgress === explodeTarget) {
    return;
  }

  const step = Math.min(1, delta * EXPLODE_ANIMATION_SPEED);
  explodeProgress += (explodeTarget - explodeProgress) * step;

  if (Math.abs(explodeTarget - explodeProgress) < 0.001) {
    explodeProgress = explodeTarget;
  }

  applyExplodedLayout();
}

function resetExplodedView(clearParts = false) {
  explodeMode = "none";
  explodeTarget = 0;
  explodeProgress = 0;

  if (explodeParts.length) {
    for (const part of explodeParts) {
      part.object.position.copy(part.basePosition);
    }
    currentObject?.updateMatrixWorld(true);
  }

  if (clearParts) {
    explodeParts = [];
  }

  updateExplodeButton();
  updateExplodeStrengthVisibility();
}

function countExplodableParts(object) {
  return collectExplodableParts(object).length;
}

function handleExplodeStrengthInput() {
  explodeIntensity = THREE.MathUtils.clamp(Number(explodeStrengthInput?.value || 65) / 100, 0, 1);
  applyExplodedLayout();

  if (explodeMode === "all") {
    setStatus(`爆炸强度已调整为 ${Math.round(explodeIntensity * 100)}%`);
  } else if (explodeMode === "single" && selectedExplodePart) {
    setStatus(`子结构展开强度已调整为 ${Math.round(explodeIntensity * 100)}%`);
  }
}

function updateExplodeStrengthVisibility() {
  explodeStrengthWrap?.classList.toggle("hidden", !currentObject || explodeParts.length <= 1);
}

function resetExplodePartDragOffset(part) {
  part?.dragOffset?.set(0, 0, 0);
}

function hasMultipleExplodableParts() {
  return explodeParts.length > 1;
}

function stopSelectedPartDrag() {
  if (!isDraggingSelectedPart) {
    return;
  }

  isDraggingSelectedPart = false;
  draggingExplodePart = null;
  selectedPartDragStartScreen = null;
  controls.enabled = true;
}

function stopWholeModelPointerDrag() {
  if (!isDraggingWholeModelPointer) {
    return;
  }

  isDraggingWholeModelPointer = false;
  wholeModelDragPointerId = null;
  wholeModelDragStartScreen = null;
  controls.enabled = !isStereoInteractive();
}

function clearSelectedExplodePart() {
  stopSelectedPartDrag();

  if (!selectedExplodePart) {
    return;
  }

  resetExplodePartDragOffset(selectedExplodePart);

  if (selectedExplodeSourceMaterials) {
    selectedExplodePart.object.material = selectedExplodeSourceMaterials;
  }

  if (selectedExplodeSourceScale) {
    selectedExplodePart.object.scale.copy(selectedExplodeSourceScale);
  }

  selectedExplodePart = null;
  selectedExplodeSourceMaterials = null;
  selectedExplodeSourceScale = null;
  applyExplodedLayout();
}

function highlightExplodePart(part) {
  if (!part?.object || !hasMultipleExplodableParts()) {
    return;
  }

  clearSelectedExplodePart();
  selectedExplodePart = part;
  selectedExplodeSourceMaterials = part.object.material;
  selectedExplodeSourceScale = part.object.scale.clone();

  const sourceMaterials = Array.isArray(part.object.material) ? part.object.material : [part.object.material];
  const highlightedMaterials = sourceMaterials.map((material) => {
    const clone = material?.clone?.() || material;

    if ("emissive" in clone && clone.emissive?.setHex) {
      clone.emissive = clone.emissive.clone();
      clone.emissive.offsetHSL(0.01, -0.01, 0.015);
      clone.emissiveIntensity = Math.max(0.03, Number(clone.emissiveIntensity) || 0.03);
    } else if ("color" in clone && clone.color?.offsetHSL) {
      clone.color = clone.color.clone();
      clone.color.offsetHSL(0.004, 0.015, 0.03);
    }

    if ("opacity" in clone && clone.transparent !== true) {
      clone.transparent = true;
    }

    return clone;
  });

  part.object.material = Array.isArray(part.object.material) ? highlightedMaterials : highlightedMaterials[0];
  part.object.scale.copy(selectedExplodeSourceScale).multiplyScalar(1.015);
}

function activateSingleExplodePart(part, statusMessage) {
  if (!part || !hasMultipleExplodableParts()) {
    return false;
  }

  highlightExplodePart(part);
  explodeMode = "single";
  explodeTarget = 1;
  updateExplodeButton();

  if (statusMessage) {
    setStatus(statusMessage);
  }

  return true;
}

function findExplodePartByMesh(mesh) {
  if (!mesh) {
    return null;
  }

  return explodeParts.find((part) => part.object === mesh) || null;
}

function pickExplodePartFromPointer(event) {
  if (!currentObject || !hasMultipleExplodableParts()) {
    return null;
  }

  if (!updatePointerSelectionRay(event, camera)) {
    return null;
  }

  const hits = pointerSelectionRaycaster.intersectObjects(getCurrentModelMeshes(), false);
  if (!hits.length) {
    return null;
  }

  return findExplodePartByMesh(hits[0].object);
}

function getPrimaryCamera() {
  return isStereoInteractive() ? stereoCamera : camera;
}

function updatePointerSelectionRay(event, activeCamera = getPrimaryCamera()) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return false;
  }

  pointerSelectionCoords.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerSelectionCoords.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointerSelectionRaycaster.setFromCamera(pointerSelectionCoords, activeCamera);
  return true;
}

function beginWholeModelPointerDrag(event) {
  if (!currentObject || event.button !== 0 || !event.shiftKey) {
    return false;
  }

  const activeCamera = getPrimaryCamera();
  const previewRootWorldQuaternion = previewRoot.getWorldQuaternion(new THREE.Quaternion());
  const previewRootWorldQuaternionInverse = previewRootWorldQuaternion.clone().invert();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  activeCamera.matrixWorld.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

  const objectSize = new THREE.Box3().setFromObject(currentObject).getSize(new THREE.Vector3()).length() || 1;
  wholeModelDragScreenScale = Math.max(objectSize * 0.0018, 0.003);
  wholeModelDragStartScreen = { x: event.clientX, y: event.clientY };
  wholeModelDragStartPosition.copy(currentObject.position);
  wholeModelDragCameraRightLocal.copy(cameraRight.applyQuaternion(previewRootWorldQuaternionInverse).normalize());
  wholeModelDragCameraUpLocal.copy(cameraUp.applyQuaternion(previewRootWorldQuaternionInverse).normalize());
  isDraggingWholeModelPointer = true;
  wholeModelDragPointerId = event.pointerId;
  controls.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  setStatus("正在拖拽整体模型，松开可继续旋转场景");
  return true;
}

function updateWholeModelPointerDrag(event) {
  if (!isDraggingWholeModelPointer || !currentObject) {
    return false;
  }

  if (wholeModelDragPointerId !== null && event.pointerId !== undefined && wholeModelDragPointerId !== event.pointerId) {
    return false;
  }

  const deltaX = event.clientX - wholeModelDragStartScreen.x;
  const deltaY = event.clientY - wholeModelDragStartScreen.y;
  currentObject.position.copy(wholeModelDragStartPosition)
    .addScaledVector(wholeModelDragCameraRightLocal, deltaX * wholeModelDragScreenScale)
    .addScaledVector(wholeModelDragCameraUpLocal, -deltaY * wholeModelDragScreenScale);
  captureStereoReferenceCamera();
  return true;
}

function beginSelectedPartDrag(event) {
  if (isStereoInteractive() || event.button !== 0 || !selectedExplodePart) {
    return false;
  }

  const pickedPart = pickExplodePartFromPointer(event);
  if (!pickedPart || pickedPart.id !== selectedExplodePart.id) {
    return false;
  }

  selectedPartDragStartScreen = { x: event.clientX, y: event.clientY };
  const parentQuaternion = selectedExplodePart.object.parent
    ? selectedExplodePart.object.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion();
  selectedPartDragStartOffsetWorld.copy(selectedExplodePart.dragOffset).applyQuaternion(parentQuaternion);
  camera.matrixWorld.extractBasis(selectedPartDragCameraRight, selectedPartDragCameraUp, new THREE.Vector3());
  selectedPartDragCameraRight.normalize();
  selectedPartDragCameraUp.normalize();
  selectedPartDragPullDirection.copy(selectedExplodePart.direction).applyQuaternion(parentQuaternion).normalize();
  isDraggingSelectedPart = true;
  draggingExplodePart = selectedExplodePart;
  controls.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  setStatus("已进入子结构拖拽观察，向上拖可拉出，左右可微调");
  return true;
}

function updateSelectedPartDrag(event) {
  if (!isDraggingSelectedPart || !draggingExplodePart || !selectedPartDragStartScreen) {
    return false;
  }

  const deltaX = event.clientX - selectedPartDragStartScreen.x;
  const deltaY = event.clientY - selectedPartDragStartScreen.y;
  const pullStrength = Math.max(draggingExplodePart.distance * 0.02, 0.01);
  const screenAdjustStrength = Math.max(draggingExplodePart.distance * 0.0045, 0.0025);
  const worldOffset = selectedPartDragStartOffsetWorld.clone()
    .addScaledVector(selectedPartDragPullDirection, Math.max(0, -deltaY) * pullStrength)
    .addScaledVector(selectedPartDragCameraRight, deltaX * screenAdjustStrength)
    .addScaledVector(selectedPartDragCameraUp, -deltaY * screenAdjustStrength * 0.4);

  const parentQuaternion = draggingExplodePart.object.parent
    ? draggingExplodePart.object.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion();
  const localOffset = worldOffset.applyQuaternion(parentQuaternion.invert());

  draggingExplodePart.dragOffset.copy(localOffset);
  applyExplodedLayout();
  return true;
}

function updateFileList(files) {
  if (files.length === 0) {
    fileList.innerHTML = "<li>暂未选择文件</li>";
    return;
  }

  fileList.innerHTML = files
    .map((file) => `<li data-file="${escapeHtml(file.name)}">${escapeHtml(file.name)} <small>(${formatBytes(file.size)})</small></li>`)
    .join("");
}

function updateEntryOptions(files) {
  const modelFiles = files.filter((file) => isPreviewableModel(file.name));
  entryFileSelect.innerHTML = "";
  syncSubmodelOptions([]);

  if (modelFiles.length === 0) {
    entryFileSelect.disabled = true;
    loadButton.disabled = true;
    entryFileSelect.innerHTML = '<option value="">未发现可预览模型文件</option>';
    return;
  }

  for (const file of modelFiles) {
    const option = document.createElement("option");
    option.value = file.name;
    option.textContent = file.name;
    entryFileSelect.appendChild(option);
  }

  entryFileSelect.value = modelFiles[0].name;
  entryFileSelect.disabled = false;
  loadButton.disabled = false;
  syncSubmodelOptions(modelFiles);
}

function highlightSelectedEntry() {
  const selected = entryFileSelect.value;
  if (submodelSelect && submodelSelect.value !== selected && selected) {
    submodelSelect.value = selected;
  }
  for (const item of fileList.querySelectorAll("li[data-file]")) {
    item.classList.toggle("selected", item.dataset.file === selected);
  }
}

function syncSubmodelOptions(modelFiles) {
  if (!submodelSelect) {
    return;
  }

  submodelSelect.innerHTML = "";

  if (!modelFiles || modelFiles.length <= 1) {
    submodelSelect.classList.add("hidden");
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "主模型文件";
    submodelSelect.appendChild(option);
    submodelSelect.disabled = true;
    return;
  }

  for (const file of modelFiles) {
    const option = document.createElement("option");
    option.value = file.name;
    option.textContent = stripExtension(file.name);
    submodelSelect.appendChild(option);
  }

  submodelSelect.value = entryFileSelect.value || modelFiles[0].name;
  submodelSelect.disabled = false;
  submodelSelect.classList.remove("hidden");
}

function resetCameraView() {
  if (!currentObject) return;
  frameObject(currentObject);
  setStatus("视角已重置");
}

function isPreviewableModel(fileName) {
  return ["glb", "gltf", "fbx", "obj", "stl"].includes(getExtension(fileName));
}

function getExtension(fileName) {
  return String(fileName).split(".").pop().toLowerCase();
}

function findSiblingFile(extension) {
  for (const [name, file] of resourceMap.entries()) {
    if (name.toLowerCase().endsWith(extension)) {
      return file;
    }
  }
  return null;
}

function findResourceFileByUrl(url) {
  const fileName = url.split("/").pop();
  if (!fileName) {
    return null;
  }

  if (resourceMap.has(fileName)) {
    return resourceMap.get(fileName);
  }

  const normalizedName = fileName.toLowerCase();
  for (const [name, file] of resourceMap.entries()) {
    if (name.toLowerCase() === normalizedName) {
      return file;
    }
  }

  return null;
}

function createObjectUrl(file) {
  return URL.createObjectURL(file);
}

function safeRevokeObjectUrl(url) {
  try {
    URL.revokeObjectURL(url);
  } catch {}
}

function clearPanoramaScene() {
  if (currentPanoramaTexture) {
    currentPanoramaTexture.dispose();
    currentPanoramaTexture = null;
  }

  if (currentPanoramaEnvironment) {
    currentPanoramaEnvironment.dispose();
    currentPanoramaEnvironment = null;
  }

  scene.environment = null;
}

async function handlePanoramaSelected(file) {
  try {
    await loadPanoramaTexture(file);
    if (activeThemeKey === "panorama") {
      applyTheme("panorama");
    }
    updatePanoramaControls();
    setStatus("全景天空盒已更新");
  } catch (error) {
    setStatus("全景图加载失败");
    modelMeta.textContent = formatPreviewError(error);
  }
}

async function loadPanoramaTexture(file) {
  await loadPanoramaTextureFromSource(createObjectUrl(file), true);
  currentPanoramaName = file.name;
}

async function loadPanoramaTextureFromUrl(url, name = "") {
  await loadPanoramaTextureFromSource(url, false);
  currentPanoramaName = name || DEFAULT_PANORAMA_NAME;
}

async function loadPanoramaTextureFromSource(source, revokeAfterLoad) {
  clearPanoramaScene();

  const loader = new THREE.TextureLoader();

  try {
    const texture = await loader.loadAsync(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const envTarget = pmremGenerator.fromEquirectangular(texture);
    currentPanoramaTexture = texture;
    currentPanoramaEnvironment = envTarget.texture;
  } finally {
    if (revokeAfterLoad) {
      safeRevokeObjectUrl(source);
    }
  }
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setToolLabel(button, label) {
  if (!button) {
    return;
  }

  button.dataset.label = label;
  button.title = label;
}

function setStatus(text) {
  setText(statusText, text);
}

function setMetricsVisibility(visible) {
  metricsCard?.classList.toggle("hidden", !visible);
}

function updatePanoramaControls() {
  const isPanoramaTheme = activeThemeKey === "panorama";
  panoramaTrigger?.classList.toggle("hidden", !isPanoramaTheme);

  if (panoramaTrigger) {
    const label = currentPanoramaName ? `更换全景图：${currentPanoramaName}` : "上传全景图";
    panoramaTrigger.dataset.label = label;
    panoramaTrigger.title = label;
  }
}

function syncPanoramaPresentation() {
  const isPanoramaTheme = activeThemeKey === "panorama";

  ground.visible = !isPanoramaTheme && isGridVisible;
  grid.visible = !isPanoramaTheme && isGridVisible;

  if (!currentObject) {
    panoramaShadow.visible = false;
    return;
  }

  const defaultY = Number(currentObject.userData.defaultPositionY ?? 0);
  currentObject.position.y = defaultY;

  if (!isPanoramaTheme) {
    panoramaShadow.visible = false;
    return;
  }

  const box = new THREE.Box3().setFromObject(currentObject);
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.52;
  panoramaShadow.visible = true;
  panoramaShadow.scale.setScalar(Math.max(radius, 0.75));
  panoramaShadow.position.set(0, currentObject.position.y - 0.002, 0);
}

async function ensureDefaultPanoramaLoaded() {
  if (currentPanoramaTexture) {
    return;
  }

  try {
    await loadPanoramaTextureFromUrl(DEFAULT_PANORAMA_URL, DEFAULT_PANORAMA_NAME);
    updatePanoramaControls();
  } catch {
    currentPanoramaName = "";
    updatePanoramaControls();
  }
}

function updateModelStats(fileName, animationCount) {
  currentObject.userData.defaultPositionY = Number(currentObject.position.y || 0);
  const meshCount = countMeshes(currentObject);
  const partCount = countExplodableParts(currentObject);
  const { triangles, vertices } = countGeometryStats(currentObject);
  const size = getObjectSize(currentObject);
  const localEntryFile = resourceMap.get(fileName);
  const resolvedFileSizeBytes = currentObjectSource === "remote"
    ? currentModelFileSizeBytes
    : localEntryFile?.size || 0;

  setMetricsVisibility(Boolean(currentObject));
  setText(fileCount, currentObjectSource === "remote" ? "1" : String(Math.max(resourceMap.size, 1)));
  setText(formatStat, getExtension(fileName).toUpperCase() || "-");

  setText(meshStat, formatNumber(meshCount));
  setText(partStat, formatNumber(partCount));
  setText(triangleStat, formatNumber(triangles));
  setText(vertexStat, formatNumber(vertices));
  setText(animationStat, String(animationCount));
  setText(fileSizeStat, resolvedFileSizeBytes ? formatBytes(resolvedFileSizeBytes) : "-");
  setText(sizeStat, `${size.x} × ${size.y} × ${size.z}`);

  saveRecentEntry({
    name: fileName,
    format: getExtension(fileName).toUpperCase(),
    triangles,
    vertices,
    openedAt: new Date().toLocaleString()
  });

  meshMetric?.classList.add("hidden");
  modelMeta.textContent = `文件：${fileName} | 子结构：${formatNumber(partCount)} | 三角面：${formatNumber(triangles)}`;
  syncExplodeParts();
  syncPanoramaPresentation();
}

function resetStats() {
  setMetricsVisibility(false);
  meshMetric?.classList.add("hidden");
  setText(fileCount, "0");
  setText(formatStat, "-");
  setText(meshStat, "-");
  setText(partStat, "-");
  setText(triangleStat, "-");
  setText(vertexStat, "-");
  setText(animationStat, "0");
  setText(fileSizeStat, "-");
  setText(sizeStat, "-");
  updateExplodeStrengthVisibility();
  panoramaShadow.visible = false;
}

function countMeshes(object) {
  let count = 0;
  object?.traverse((child) => {
    if (child.isMesh) {
      count += 1;
    }
  });
  return count;
}

function countGeometryStats(object) {
  let triangles = 0;
  let vertices = 0;

  object?.traverse((child) => {
    if (!child.isMesh || !child.geometry) {
      return;
    }

    const geometry = child.geometry;
    const position = geometry.getAttribute("position");

    if (position) {
      vertices += position.count;
    }

    if (geometry.index) {
      triangles += geometry.index.count / 3;
    } else if (position) {
      triangles += position.count / 3;
    }
  });

  return {
    triangles: Math.round(triangles),
    vertices: Math.round(vertices)
  };
}

function getObjectSize(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  return {
    x: size.x.toFixed(2),
    y: size.y.toFixed(2),
    z: size.z.toFixed(2)
  };
}

function toggleAutoRotate() {
  controls.autoRotate = !controls.autoRotate;
  updateAutoRotateButton();
}

function updateAutoRotateButton() {
  autoRotateButton.classList.toggle("active", controls.autoRotate);
  setToolLabel(autoRotateButton, `自动旋转：${controls.autoRotate ? "开" : "关"}`);
}

function toggleWireframe() {
  isWireframe = !isWireframe;
  updateWireframeButton();
  applyWireframeState();
}

function updateWireframeButton() {
  wireframeButton.classList.toggle("active", isWireframe);
  setToolLabel(wireframeButton, `线框模式：${isWireframe ? "开" : "关"}`);
}

function applyWireframeState() {
  currentObject?.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if ("wireframe" in material) {
        material.wireframe = isWireframe;
      }
    }
  });
}

function toggleGrid() {
  isGridVisible = !isGridVisible;
  syncPanoramaPresentation();
  updateGridButton();
}

function updateGridButton() {
  gridButton.classList.toggle("active", isGridVisible);
  setToolLabel(gridButton, `地面网格：${isGridVisible ? "开" : "关"}`);
}

function toggleExplodedView() {
  if (!currentObject) {
    setStatus("请先加载模型");
    return;
  }

  if (!explodeParts.length) {
    syncExplodeParts();
  }

  if (explodeParts.length <= 1) {
    clearSelectedExplodePart();
    explodeMode = "none";
    explodeTarget = 0;
    updateExplodeButton();
    setStatus("当前模型只识别到 1 个可独立子结构，通常是源文件已经合并为单一网格");
    return;
  }

  const shouldEnable = explodeMode !== "all" || explodeTarget === 0;
  clearSelectedExplodePart();
  explodeMode = shouldEnable ? "all" : "none";
  explodeTarget = shouldEnable ? 1 : 0;
  updateExplodeButton();
  setStatus(shouldEnable ? `爆炸视图已开启，共识别 ${explodeParts.length} 个子结构` : "爆炸视图已恢复");
}

function updateExplodeButton() {
  if (!explodeButton) {
    return;
  }

  const hasModel = Boolean(currentObject);
  const available = explodeParts.length > 1;
  const active = explodeMode === "all" && (explodeTarget > 0 || explodeProgress > 0.01);
  const singleSelected = explodeMode === "single" && selectedExplodePart;

  explodeButton.disabled = !hasModel;
  explodeButton.classList.toggle("active", active);

  if (!hasModel) {
    setToolLabel(explodeButton, "爆炸视图：未加载模型");
    return;
  }

  if (!available) {
    setToolLabel(explodeButton, "爆炸视图：当前模型无可展开子结构");
    return;
  }

  if (singleSelected) {
    setToolLabel(explodeButton, "爆炸视图：当前为单独展开");
    return;
  }

  setToolLabel(explodeButton, `爆炸视图：${active ? "开" : "关"}`);
}

function toggleStereoMode() {
  isStereoEnabled = !isStereoEnabled;
  captureStereoReferenceCamera();

  if (isStereoEnabled) {
    if (document.fullscreenElement === viewerShell) {
      maybeActivateStereoDisplay();
    } else {
      setStatus("裸眼 3D 已开启，进入全屏后生效");
    }
  } else {
    deactivateStereoDisplay();
    setStatus("裸眼 3D 已关闭");
  }

  updateStereoButton();
}

function updateStereoButton() {
  const runtimeReady = Boolean(window.Module?.loaded);
  const trackerConnected = Boolean(stereoTracker?.ws && stereoTracker.ws.readyState === WebSocket.OPEN);
  const suffix = isStereoEnabled ? "开" : "关";
  const stereoActive = isStereoDisplayActive && document.fullscreenElement === viewerShell;

  stereoButton.classList.toggle("active", isStereoEnabled);
  stereoButton.classList.toggle("stereo-live", stereoActive);
  setToolLabel(stereoButton, `裸眼 3D：${suffix}`);
  stereoButton.title = runtimeReady
    ? trackerConnected
      ? "设备服务已连接，进入全屏后可启用立体显示"
      : "立体渲染引擎已加载，未检测到设备追踪服务时将使用固定视角立体显示"
    : "立体渲染引擎正在初始化";

  if (stereoDeviceBadge) {
    stereoDeviceBadge.classList.remove("online", "ready", "offline");

    if (stereoActive) {
      stereoDeviceBadge.classList.add("ready");
      stereoDeviceBadge.textContent = trackerConnected ? "立体输出中" : "固定视角输出中";
    } else if (trackerConnected) {
      stereoDeviceBadge.classList.add("online");
      stereoDeviceBadge.textContent = "设备已连接";
    } else {
      stereoDeviceBadge.classList.add("offline");
      stereoDeviceBadge.textContent = runtimeReady ? "设备未连接" : "引擎初始化中";
    }
  }

  if (stereoStatusDetail) {
    if (stereoActive) {
      stereoStatusDetail.textContent = trackerConnected
        ? "当前已经进入裸眼 3D 全屏显示。模型固定在中心，头部追踪已做弱化和平滑处理，鼠标拖拽和按住笔键移动会旋转模型，笔射线会同步显示。"
        : "当前已经进入裸眼 3D 全屏显示，但未检测到设备追踪服务，正在使用固定中心的立体输出。鼠标拖拽仍可旋转模型。";
    } else if (isStereoEnabled) {
      stereoStatusDetail.textContent = runtimeReady
        ? "裸眼 3D 已开启。进入全屏后会切到示例同款的固定中心立体显示；如果检测到设备服务，会自动启用头部追踪和笔追旋转。"
        : "裸眼 3D 已开启，正在等待立体渲染引擎初始化完成。初始化完成后进入全屏即可切到立体显示。";
    } else {
      stereoStatusDetail.textContent = "当前为普通 3D 预览模式。开启裸眼 3D 后，进入全屏即可切到立体显示。";
    }
  }
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await viewerShell.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}

function handleFullscreenChange() {
  updateFullscreenButton();
  viewerShell.classList.toggle("fullscreen-active", document.fullscreenElement === viewerShell);

  if (document.fullscreenElement === viewerShell) {
    maybeActivateStereoDisplay();
  } else {
    deactivateStereoDisplay();
  }

  setTimeout(handleResize, 50);
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement === viewerShell;
  fullscreenButton.classList.toggle("active", isFullscreen);
  setToolLabel(fullscreenButton, isFullscreen ? "退出全屏" : "全屏查看");
}

function maybeActivateStereoDisplay() {
  if (!isStereoEnabled || !window.Module?.loaded) {
    updateStereoButton();
    return;
  }

  isStereoDisplayActive = true;
  controls.enabled = false;
  updateStereoSceneFit();
  syncStereoRuntimeParams();

  try {
    stereoTracker?.setDisplayMode?.(1, 1);
  } catch {}

  setStatus("裸眼 3D 全屏模式已启用");
  updateStereoButton();
}

function deactivateStereoDisplay() {
  if (!isStereoDisplayActive) {
    controls.enabled = true;
    resetStereoSceneFit();
    resetPenInteractionState();
    stylusRaycaster?.updatePose(null);
    if (stylusRaycaster) {
      stylusRaycaster.line.visible = false;
      stylusRaycaster.helper.visible = false;
    }
    smoothedEyeOffset.set(0, 0, 0);
    isPointerModelRotating = false;
    activePointerId = null;
    updateStereoButton();
    return;
  }

  isStereoDisplayActive = false;
  controls.enabled = true;

  try {
    stereoTracker?.setDisplayMode?.(0, 0);
  } catch {}

  resetStereoSceneFit();
  resetPenInteractionState();
  stylusRaycaster?.updatePose(null);
  if (stylusRaycaster) {
    stylusRaycaster.line.visible = false;
    stylusRaycaster.helper.visible = false;
  }
  smoothedEyeOffset.set(0, 0, 0);
  isPointerModelRotating = false;
  activePointerId = null;

  updateStereoButton();
}

function captureStereoReferenceCamera() {
  stereoBaseCameraPosition = camera.position.clone();
  stereoBaseTarget = controls.target.clone();
}

function updateStereoSceneFit() {
  if (!currentObject) {
    resetStereoSceneFit();
    return;
  }

  previewRoot.position.set(0, 0, 0);
  previewRoot.scale.setScalar(1);
  previewRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(currentObject);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const stereoScale = STEREO_CONFIG.fitSize / maxDim;
  const stereoTarget = new THREE.Vector3(0, 0, STEREO_CONFIG.targetDepth);

  previewRoot.scale.setScalar(stereoScale);
  previewRoot.position.copy(stereoTarget).sub(center.multiplyScalar(stereoScale));
  previewRoot.updateMatrixWorld(true);

  stereoBaseTarget.copy(stereoTarget);
  stereoBaseCameraPosition = new THREE.Vector3(0, 0, STEREO_CONFIG.cameraDistance);
  smoothedEyeOffset.set(0, 0, 0);

  stereoCamera.position.copy(stereoBaseCameraPosition);
  stereoCamera.near = 0.01;
  stereoCamera.far = 10;
  stereoCamera.aspect = camera.aspect;
  stereoCamera.lookAt(stereoBaseTarget);
  stereoCamera.updateProjectionMatrix();
}

function resetStereoSceneFit() {
  previewRoot.position.set(0, 0, 0);
  previewRoot.scale.setScalar(1);
  previewRoot.updateMatrixWorld(true);
}

function isStereoInteractive() {
  return isStereoDisplayActive && document.fullscreenElement === viewerShell && Boolean(currentObject);
}

function handleViewerPointerDown(event) {
  pointerDownScreen = { x: event.clientX, y: event.clientY };

  if (beginWholeModelPointerDrag(event)) {
    suppressNextViewerClick = true;
    return;
  }

  if (beginSelectedPartDrag(event)) {
    suppressNextViewerClick = true;
    return;
  }

  if (!isStereoInteractive() || event.button !== 0) {
    return;
  }

  isPointerModelRotating = true;
  activePointerId = event.pointerId;
  pointerStart = { x: event.clientX, y: event.clientY };
  modelRotationOnPointerStart.copy(currentObject.rotation);
  renderer.domElement.setPointerCapture?.(event.pointerId);
  setStatus("裸眼 3D 交互中：拖拽可旋转模型");
}

function handleViewerPointerMove(event) {
  if (updateWholeModelPointerDrag(event)) {
    return;
  }

  if (updateSelectedPartDrag(event)) {
    return;
  }

  if (!isPointerModelRotating || activePointerId !== event.pointerId || !currentObject) {
    return;
  }

  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  const rotationSpeed = 0.008;

  currentObject.rotation.order = "YXZ";
  currentObject.rotation.y = modelRotationOnPointerStart.y + deltaX * rotationSpeed;
  currentObject.rotation.x = THREE.MathUtils.clamp(
    modelRotationOnPointerStart.x + deltaY * rotationSpeed,
    -Math.PI / 2,
    Math.PI / 2
  );
}

function handleViewerPointerUp(event) {
  if (isDraggingWholeModelPointer) {
    stopWholeModelPointerDrag();
    return;
  }

  if (isDraggingSelectedPart) {
    stopSelectedPartDrag();
    return;
  }

  if (activePointerId !== null && event.pointerId !== undefined && activePointerId !== event.pointerId) {
    return;
  }

  isPointerModelRotating = false;
  activePointerId = null;
}

function handleViewerClick(event) {
  if (isStereoInteractive() || !currentObject) {
    return;
  }

  if (suppressNextViewerClick) {
    suppressNextViewerClick = false;
    return;
  }

  if (pointerDownScreen) {
    const moved = Math.hypot(event.clientX - pointerDownScreen.x, event.clientY - pointerDownScreen.y);
    pointerDownScreen = null;
    if (moved > 6) {
      return;
    }
  }

  const pickedPart = pickExplodePartFromPointer(event);

  if (!pickedPart) {
    if (selectedExplodePart) {
      clearSelectedExplodePart();
      if (explodeMode === "single") {
        explodeMode = "none";
        explodeTarget = 0;
      }
      updateExplodeButton();
      setStatus("已取消子结构选择");
    }
    return;
  }

  const isSamePart = selectedExplodePart?.id === pickedPart.id;
  if (isSamePart && explodeMode === "single") {
    clearSelectedExplodePart();
    explodeMode = "none";
    explodeTarget = 0;
    updateExplodeButton();
    setStatus("已恢复整体视图");
    return;
  }

  activateSingleExplodePart(pickedPart, "已选中子结构，单独展开已开启");
}

function resetPenInteractionState() {
  lastPenPose = null;
  wasPenPressed = false;
  isPenGrabbingModel = false;
  isPenGrabbingExplodePart = false;
  penGrabbedExplodePart = null;
  penGrabStartPose = null;
  penGrabStartRotation = null;
  penGrabHitPointLocal = null;
  penExplodePartGrabHitPointLocal = null;
  penExplodePartGrabStartPose = null;
  penExplodePartGrabStartStylusLocal.set(0, 0, 0);
  penExplodePartGrabStartDragOffset.set(0, 0, 0);
}

function getCurrentModelMeshes() {
  const meshes = [];

  currentObject?.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
    }
  });

  return meshes;
}

function updateStylusRay() {
  if (!stylusRaycaster) {
    return;
  }

  if (!isStereoInteractive()) {
    stylusRaycaster.line.visible = false;
    stylusRaycaster.helper.visible = false;
    stylusRaycaster.updatePose(null);
    lastStylusIntersections = [];
    return;
  }

  const pen = stereoTrackingData?.pen;
  if (!pen) {
    stylusRaycaster.line.visible = false;
    stylusRaycaster.helper.visible = false;
    stylusRaycaster.updatePose(null);
    lastStylusIntersections = [];
    return;
  }

  stylusRaycaster.line.visible = true;
  stylusRaycaster.helper.visible = true;
  stylusRaycaster.updatePose(pen);

  if (isPenGrabbingExplodePart && penGrabbedExplodePart?.object && penExplodePartGrabHitPointLocal) {
    const lockedHitPoint = penGrabbedExplodePart.object.localToWorld(penExplodePartGrabHitPointLocal.clone());
    stylusRaycaster.helper.position.copy(lockedHitPoint);
    const lockedLinePoint = stylusRaycaster.line.worldToLocal(lockedHitPoint.clone());
    stylusRaycaster.points[1].copy(lockedLinePoint);
    stylusRaycaster.line.geometry.setFromPoints(stylusRaycaster.points);
    lastStylusIntersections = [];
    return;
  }

  if (isPenGrabbingModel && currentObject && penGrabHitPointLocal) {
    const lockedHitPoint = currentObject.localToWorld(penGrabHitPointLocal.clone());
    stylusRaycaster.helper.position.copy(lockedHitPoint);
    const lockedLinePoint = stylusRaycaster.line.worldToLocal(lockedHitPoint.clone());
    stylusRaycaster.points[1].copy(lockedLinePoint);
    stylusRaycaster.line.geometry.setFromPoints(stylusRaycaster.points);
    lastStylusIntersections = [];
    return;
  }

  lastStylusIntersections = stylusRaycaster.intersectObjects(getCurrentModelMeshes());
}

function getStylusPoseInPreviewRoot() {
  if (!stylusRaycaster) {
    return null;
  }

  const localPosition = previewRoot.worldToLocal(stylusRaycaster.line.position.clone());
  const previewRootWorldQuaternion = previewRoot.getWorldQuaternion(new THREE.Quaternion());
  const lineWorldQuaternion = stylusRaycaster.line.getWorldQuaternion(new THREE.Quaternion());
  const localQuaternion = previewRootWorldQuaternion.invert().multiply(lineWorldQuaternion);

  return {
    position: localPosition,
    quaternion: localQuaternion
  };
}

function getStylusPositionInObjectParent(object) {
  if (!stylusRaycaster || !object?.parent) {
    return null;
  }

  return object.parent.worldToLocal(stylusRaycaster.line.position.clone());
}

function getExplodePartFromStylusIntersections() {
  if (!hasMultipleExplodableParts() || !lastStylusIntersections.length) {
    return null;
  }

  return findExplodePartByMesh(lastStylusIntersections[0].object);
}

function beginPenExplodePartGrab(pen, part) {
  if (!part?.object || !lastStylusIntersections.length) {
    return false;
  }

  const stylusLocal = getStylusPositionInObjectParent(part.object);
  if (!stylusLocal) {
    return false;
  }

  penExplodePartGrabStartPose = {
    x: pen.pos.x,
    y: pen.pos.y,
    z: pen.pos.z
  };
  penExplodePartGrabStartStylusLocal.copy(stylusLocal);
  penExplodePartGrabStartDragOffset.copy(part.dragOffset);
  penExplodePartGrabHitPointLocal = part.object.worldToLocal(lastStylusIntersections[0].point.clone());
  penGrabbedExplodePart = part;
  isPenGrabbingExplodePart = true;
  isPenGrabbingModel = false;
  setStatus("笔已抓住子结构：可拖拽当前零件做立体观察");
  return true;
}

function updatePenExplodePartGrab(pen) {
  if (!isPenGrabbingExplodePart || !penGrabbedExplodePart?.object || !penExplodePartGrabStartPose) {
    return;
  }

  const stylusLocal = getStylusPositionInObjectParent(penGrabbedExplodePart.object);
  if (!stylusLocal) {
    return;
  }

  const localDelta = stylusLocal.sub(penExplodePartGrabStartStylusLocal);
  const pullDelta = Math.max(0, penExplodePartGrabStartPose.z - pen.pos.z) * Math.max(penGrabbedExplodePart.distance * 1.2, 0.045);

  penGrabbedExplodePart.dragOffset.copy(penExplodePartGrabStartDragOffset)
    .add(new THREE.Vector3(
      localDelta.x * STEREO_CONFIG.penMoveScaleX,
      localDelta.y * STEREO_CONFIG.penMoveScaleY,
      localDelta.z * 1.15
    ))
    .addScaledVector(penGrabbedExplodePart.direction, pullDelta);

  applyExplodedLayout();
}

function beginPenGrab(pen) {
  if (!currentObject || !lastStylusIntersections.length) {
    return false;
  }

  const stylusPose = getStylusPoseInPreviewRoot();
  if (!stylusPose) {
    return false;
  }

  penGrabStartPose = {
    x: pen.pos.x,
    y: pen.pos.y,
    z: pen.pos.z
  };
  penGrabHitPointLocal = currentObject.worldToLocal(lastStylusIntersections[0].point.clone());
  penGrabStartPosition.copy(currentObject.position);
  penGrabStartQuaternion.copy(currentObject.quaternion);
  penGrabStartScale.copy(currentObject.scale);
  penGrabStartRotation = {
    stylusQuaternion: stylusPose.quaternion.clone(),
    offset: currentObject.position.clone().sub(stylusPose.position).applyQuaternion(currentObject.quaternion.clone().invert()),
    rotationOffset: stylusPose.quaternion.clone().invert().multiply(currentObject.quaternion.clone())
  };
  isPenGrabbingModel = true;
  setStatus("笔已抓住模型：移动、旋转、前后推进都可控制模型");
  return true;
}

function updatePenGrab(pen) {
  if (!isPenGrabbingModel || !currentObject || !penGrabStartPose || !penGrabStartRotation) {
    return;
  }

  const stylusPose = getStylusPoseInPreviewRoot();
  if (!stylusPose) {
    return;
  }

  const nextQuaternion = stylusPose.quaternion.clone().multiply(penGrabStartRotation.rotationOffset);
  currentObject.quaternion.copy(nextQuaternion);

  const nextPosition = penGrabStartRotation.offset.clone().applyQuaternion(nextQuaternion).add(stylusPose.position);
  currentObject.position.copy(nextPosition);

  const depthDelta = penGrabStartPose.z - pen.pos.z;
  const scaleFactor = THREE.MathUtils.clamp(1 + depthDelta * STEREO_CONFIG.penScaleSpeed, 0.35, 3.5);
  currentObject.scale.copy(penGrabStartScale).multiplyScalar(scaleFactor);
}

function applyPenManipulation() {
  if (!isStereoInteractive() || !currentObject) {
    resetPenInteractionState();
    return;
  }

  const pen = stereoTrackingData?.pen;
  const penPressed = Number(stereoTrackingData?.penKey || 0) > 0;

  if (!pen || !pen.pos) {
    resetPenInteractionState();
    return;
  }

  if (!penPressed) {
    if (isPenGrabbingExplodePart || isPenGrabbingModel || wasPenPressed) {
      setStatus("裸眼 3D 笔追已松开");
    }
    resetPenInteractionState();
    return;
  }

  if (!wasPenPressed) {
    wasPenPressed = true;
    lastPenPose = {
      x: pen.pos.x,
      y: pen.pos.y,
      z: pen.pos.z
    };
    const hitPart = getExplodePartFromStylusIntersections();
    if (hitPart && activateSingleExplodePart(hitPart, "笔已命中子结构，正在切换到单独展开")) {
      if (!beginPenExplodePartGrab(pen, hitPart)) {
        setStatus("笔已命中子结构，但暂时无法抓取，请稍微移动后重试");
      }
    } else if (!beginPenGrab(pen)) {
      setStatus("笔已按下：请用射线命中模型后再抓取");
    }
  }

  if (isPenGrabbingExplodePart) {
    updatePenExplodePartGrab(pen);
  } else if (isPenGrabbingModel) {
    updatePenGrab(pen);
  }

  lastPenPose = {
    x: pen.pos.x,
    y: pen.pos.y,
    z: pen.pos.z
  };
  wasPenPressed = true;
}

function updateStereoTrackedCamera() {
  if (!isStereoDisplayActive || !stereoBaseCameraPosition) {
    return;
  }

  const eyePos = stereoTrackingData?.eye?.pos;
  stereoCamera.position.copy(stereoBaseCameraPosition);

  if (eyePos) {
    const targetEyeOffset = new THREE.Vector3(
      eyePos.x * STEREO_CONFIG.trackingScaleX,
      eyePos.y * STEREO_CONFIG.trackingScaleY,
      -eyePos.z * STEREO_CONFIG.trackingScaleZ
    ).multiplyScalar(STEREO_CONFIG.trackingScale);

    smoothedEyeOffset.lerp(targetEyeOffset, STEREO_CONFIG.trackingSmoothing);
  }

  stereoCamera.position.add(smoothedEyeOffset);
  stereoCamera.lookAt(stereoBaseTarget);
}

function applyStereoCameraFrustum(targetCamera) {
  const runtimeModule = window.Module;
  if (!runtimeModule?.loaded || typeof runtimeModule.getFrustumValue !== "function") {
    return;
  }

  const position = {
    x: targetCamera.position.x,
    y: targetCamera.position.y,
    z: targetCamera.position.z
  };

  const matrix = runtimeModule.getFrustumValue(position);
  if (!matrix) {
    return;
  }

  targetCamera.projectionMatrix.set(
    matrix.m00, matrix.m01, matrix.m02, matrix.m03,
    matrix.m10, matrix.m11, matrix.m12, matrix.m13,
    matrix.m20, matrix.m21, matrix.m22, matrix.m23,
    matrix.m30, matrix.m31, matrix.m32, matrix.m33
  );
}

function syncStereoRuntimeParams() {
  const runtimeModule = window.Module;
  if (!runtimeModule?.loaded) {
    return;
  }

  const activeCamera = isStereoDisplayActive ? stereoCamera : camera;

  if (typeof runtimeModule._setScreenParams === "function") {
    runtimeModule._setScreenParams(
      STEREO_CONFIG.screenWidth,
      STEREO_CONFIG.screenHeight,
      STEREO_CONFIG.screenScale
    );
  }

  if (typeof runtimeModule._setCameraParams === "function") {
    runtimeModule._setCameraParams(activeCamera.near, activeCamera.far);
  }
}

function exportPng() {
  if (!currentObject) {
    setStatus("请先加载模型");
    return;
  }

  renderer.render(scene, camera);
  const link = document.createElement("a");
  link.href = renderer.domElement.toDataURL("image/png");
  link.download = `${stripExtension(modelName.textContent || "model")}-preview.png`;
  link.click();
  setStatus("PNG 已导出");
}

function applyTheme(theme) {
  const settings = THEME_SETTINGS[theme] || THEME_SETTINGS.warm;
  activeThemeKey = THEME_SETTINGS[theme] ? theme : "warm";

  viewerShell.className = "viewer-shell";
  viewerShell.classList.add(settings.shellClass);
  viewerShell.classList.toggle("metrics-light", settings.metricsTone === "light");
  updatePanoramaControls();

  if (activeThemeKey === "panorama" && currentPanoramaTexture) {
    scene.background = currentPanoramaTexture;
    scene.environment = currentPanoramaEnvironment;
    scene.fog = null;
  } else {
    scene.background = new THREE.Color(settings.background);
    scene.environment = null;
    scene.fog = new THREE.Fog(settings.background, settings.fogNear, settings.fogFar);
  }

  groundMaterial.color.set(settings.ground);
  groundMaterial.opacity = activeThemeKey === "panorama" ? 0.72 : 0.95;
  hemiLight.color.set(settings.hemiSky);
  hemiLight.groundColor.set(settings.hemiGround);
  keyLight.color.set(settings.keyColor);
  fillLight.color.set(settings.fillColor);

  if (Array.isArray(grid.material)) {
    grid.material[0].color.set(settings.gridCenter);
    grid.material[1].color.set(settings.gridLine);
  }

  updateLightStrength(Number(lightRange?.value || 1.4));
  syncPanoramaPresentation();
}

function updateLightStrength(value) {
  const settings = THEME_SETTINGS[activeThemeKey] || THEME_SETTINGS.studio;
  lightValue.textContent = `${value.toFixed(1)}x`;
  hemiLight.intensity = value * 0.72;
  keyLight.intensity = value * (settings.keyIntensity / 1.45);
  fillLight.intensity = value * (settings.fillIntensity / 1.45);
}

function saveRecentEntry(entry) {
  const current = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
  const next = [entry, ...current.filter((item) => item.name !== entry.name)].slice(0, 6);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  renderRecentEntries(next);
}

function loadRecentEntries() {
  renderRecentEntries(JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]"));
}

function renderRecentEntries(items) {
  if (!items || items.length === 0) {
    recentList.innerHTML = "<li>还没有历史记录</li>";
    return;
  }

  recentList.innerHTML = items
    .map((item) => `<li><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.format)} | ${formatNumber(item.triangles)} tris | ${escapeHtml(item.openedAt)}</small></li>`)
    .join("");
}

function handleResize() {
  const width = Math.max(viewerHost.clientWidth, 1);
  const height = Math.max(viewerHost.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  stereoCamera.aspect = width / height;
  stereoCamera.updateProjectionMatrix();
  renderer.setSize(width, height);
  stereoEffect?.setSize(width, height);
  syncStereoRuntimeParams();
}

function handleControlsChange() {
  if (isStereoDisplayActive) {
    return;
  }

  captureStereoReferenceCamera();
  syncStereoRuntimeParams();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = animationClock.getDelta();

  if (animationMixer) {
    animationMixer.update(delta);
  }

  updateExplodedLayout(delta);

  if (isStereoDisplayActive) {
    updateStereoTrackedCamera();
    updateStylusRay();
    applyPenManipulation();
    syncStereoRuntimeParams();
  }

  if (controls.enabled) {
    controls.update();
  }

  if (isStereoDisplayActive && stereoEffect && document.fullscreenElement === viewerShell) {
    stereoEffect.render(scene, stereoCamera);
  } else {
    renderer.render(scene, camera);
  }
}


async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw createDetailedError(normalizeRequestErrorMessage(data.message || "请求失败", data), data);
  }

  return data;
}

function createDetailedError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function normalizeRequestErrorMessage(message, details) {
  const text = String(message || "").trim();
  const detailText = JSON.stringify(details || {});
  const isBusyError = text.includes("The server is busy. Please try again later.")
    || detailText.includes("The server is busy. Please try again later.");
  const isMissingRouteError = text.includes("API route not found")
    || detailText.includes("API route not found");

  if (isBusyError) {
    return "当前服务繁忙，请稍后重试。";
  }

  if (isMissingRouteError) {
    return "当前运行中的服务还没有加载最新的 AI模型优化接口。请重启本地 Node 服务后再试。";
  }

  return text || "请求失败";
}

function isMeshyBusyError(error) {
  const message = String(error?.message || "");
  const detailText = JSON.stringify(error?.details || {});
  return message.includes("当前服务繁忙")
    || message.includes("The server is busy. Please try again later.")
    || detailText.includes("The server is busy. Please try again later.");
}


