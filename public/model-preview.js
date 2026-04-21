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
const stereoButton = document.getElementById("toggle-stereo-3d");
const fullscreenButton = document.getElementById("toggle-fullscreen");
const exportButton = document.getElementById("export-image");
const submodelSelect = document.getElementById("submodel-select");
const openGeneratorModalButton = document.getElementById("open-generator-modal");
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
const modelPlaybackLoadingMeta = document.getElementById("model-playback-loading-meta");

const generatedTaskStorageKey = "model-preview-generated-tasks";
const previewTaskStorageLimit = 18;

const GENERATOR_PROVIDER_CONFIG = {
  tripo: {
    name: "Tripo3D",
    modelVersions: [
      { value: "P1-20260311", label: "P1-20260311" },
      { value: "v3.1-20260211", label: "v3.1-20260211" },
      { value: "v2.5-20250123", label: "v2.5-20250123" }
    ],
    textureOptions: [
      { value: "standard", label: "standard" },
      { value: "detailed", label: "detailed" }
    ],
    geometryOptions: [
      { value: "standard", label: "standard" },
      { value: "detailed", label: "detailed" }
    ],
    defaultModelVersion: "P1-20260311",
    defaultTextureQuality: "standard",
    defaultGeometryQuality: "standard",
    imageAccept: "image/png,image/jpeg,image/webp",
    textPlaceholder: "例如：一朵高细节的白粉色百合花，摄影棚灯光，写实材质"
  },
  meshy: {
    name: "Meshy",
    modelVersions: [
      { value: "latest", label: "latest (Meshy 6)" },
      { value: "meshy-6", label: "meshy-6" },
      { value: "meshy-5", label: "meshy-5" }
    ],
    textureOptions: [
      { value: "standard", label: "基础贴图" },
      { value: "detailed", label: "PBR 贴图" }
    ],
    geometryOptions: [
      { value: "standard", label: "standard" },
      { value: "lowpoly", label: "lowpoly" }
    ],
    defaultModelVersion: "latest",
    defaultTextureQuality: "standard",
    defaultGeometryQuality: "standard",
    imageAccept: "image/png,image/jpeg",
    textPlaceholder: "例如：一个白色科幻头盔，蓝色发光细节，产品级渲染"
  }
};

const resourceMap = new Map();
const recentStorageKey = "model-preview-recent";

const stereoConfig = {
  screenWidth: 0.544,
  screenHeight: 0.306,
  screenScale: 1,
  trackingScale: 0.32,
  trackingScaleX: 0.24,
  trackingScaleY: 0.16,
  trackingScaleZ: 0.2,
  trackingSmoothing: 0.1,
  fitSize: 0.17,
  targetDepth: -0.135,
  cameraDistance: 0.46,
  penRotationSpeed: 3.2,
  penMoveScaleX: 1.25,
  penMoveScaleY: 1.1,
  penScaleSpeed: 1.8
};

let currentObject = null;
let animationMixer = null;
let dragDepth = 0;
let isWireframe = false;
let isGridVisible = true;
let isStereoEnabled = false;
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
let penGrabStartPose = null;
let penGrabStartPosition = new THREE.Vector3();
let penGrabStartQuaternion = new THREE.Quaternion();
let penGrabStartScale = new THREE.Vector3(1, 1, 1);
let penGrabStartRotation = null;
let penGrabHitPointLocal = null;
let currentObjectSource = "local";
let currentRemoteModelUrl = "";
let apiConfig = null;
let generatedTasks = [];
let activeTaskPollers = new Map();
let activeGeneratingTaskId = "";
let dismissedTaskProgressId = "";
let autoPlayingGeneratedTaskId = "";
let modelLoadRequestId = 0;
let activePlaybackLoadingTaskId = "";
let playbackLoadTimeoutId = null;
let currentModelFileSizeBytes = 0;
let explodeParts = [];
let explodeProgress = 0;
let explodeTarget = 0;
let explodeMode = "none";
let explodeIntensity = 0.65;
let selectedExplodePart = null;
let selectedExplodeSourceMaterials = null;
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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.autoRotate = false;
controls.autoRotateSpeed = 2;

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

bootstrap();

async function bootstrap() {
  stereoEffect = new KStereoEffect(renderer);
  stereoEffect.setSize(window.innerWidth, window.innerHeight);
  stereoEffect.setViewScale(1);
  stereoEffect.setCameraFrustum = applyStereoCameraFrustum;
  stylusRaycaster = new KStylusRaycaster(scene);
  stylusRaycaster.line.visible = false;
  stylusRaycaster.helper.visible = false;

  fileInput.addEventListener("change", (event) => applySelectedFiles(Array.from(event.target.files || [])));
  entryFileSelect.addEventListener("change", () => {
    highlightSelectedEntry();
    if (entryFileSelect.value) {
      void handleLoadModel();
    }
  });
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
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
  generatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleGeneratorSubmit();
  });
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
  const negativePrompt = generatorNegativePromptInput.value.trim();
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
  generatorSubmitButton.textContent = `正在提交到 ${activeConfig.providerName}...`;
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
  setStatus(`正在提交到 ${activeConfig.providerName}，请稍候...`);

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
    setStatus(`已提交到 ${activeConfig.providerName}，正在等待模型生成`);
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
  generatedTasks = parseStoredJson(generatedTaskStorageKey, []);
  sortGeneratedTasks();
  renderGeneratedTaskList();
}

function saveGeneratedTasks() {
  sortGeneratedTasks();
  localStorage.setItem(generatedTaskStorageKey, JSON.stringify(generatedTasks.slice(0, previewTaskStorageLimit)));
}

function sortGeneratedTasks() {
  generatedTasks.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
    return rightTime - leftTime;
  });
}

function upsertGeneratedTask(task) {
  const existingIndex = generatedTasks.findIndex((item) => item.id === task.id);
  const nextTask = {
    ...(existingIndex >= 0 ? generatedTasks[existingIndex] : {}),
    ...task
  };

  if (existingIndex >= 0) {
    generatedTasks.splice(existingIndex, 1, nextTask);
  } else {
    generatedTasks.unshift(nextTask);
  }

  saveGeneratedTasks();
  return nextTask;
}

function renderGeneratedTaskList() {
  if (!modelListItems || !modelListEmpty) {
    return;
  }

  if (!generatedTasks.length) {
    modelListEmpty.classList.remove("hidden");
    modelListItems.innerHTML = "";
    return;
  }

  modelListEmpty.classList.add("hidden");
  modelListItems.innerHTML = generatedTasks.map(renderGeneratedTaskMarkup).join("");

  modelListItems.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => {
      void playGeneratedTask(button.dataset.playTask || "");
    });
  });

  modelListItems.querySelectorAll("[data-download-task]").forEach((button) => {
    button.addEventListener("click", () => {
      downloadGeneratedTask(button.dataset.downloadTask || "");
    });
  });

  modelListItems.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteGeneratedTask(button.dataset.deleteTask || "");
    });
  });

  modelListItems.querySelectorAll("[data-refresh-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = generatedTasks.find((item) => item.id === button.dataset.refreshTask);
      if (task) {
        void pollGeneratedTask(task.id, task.provider, true);
      }
    });
  });
}

function renderGeneratedTaskMarkup(task) {
  const progress = getDisplayProgress(task);
  const playable = resolvePlayableModel(task);
  const canPlay = task.status === "success" && Boolean(playable?.url);
  const canDownload = canPlay;
  const timeLabel = formatTimeLabel(task.updatedAt || task.createdAt);
  const statusLabel = formatStatus(task.statusText || task.status);
  const isPlaybackLoading = activePlaybackLoadingTaskId === task.id;
  const playDisabled = !canPlay || (Boolean(activePlaybackLoadingTaskId) && !isPlaybackLoading);
  const playLabel = isPlaybackLoading ? "加载中..." : "播放模型";

  return `
    <article class="model-list-item">
      <div class="model-list-top">
        <div class="model-list-title">
          <strong>${escapeHtml(task.prompt || "未命名模型")}</strong>
          <span>${escapeHtml(task.providerName || task.provider || "生成平台")} · ${escapeHtml(task.mode === "image" ? "图片生成" : "文字生成")}</span>
        </div>
        <span class="model-list-status">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="model-list-meta">
        <span>任务 ID：${escapeHtml(task.taskId || task.id)}</span>
        <span>模型版本：${escapeHtml(task.displayModelVersion || "-")}</span>
        <span>更新时间：${escapeHtml(timeLabel)}</span>
      </div>
      <div class="model-list-progress">
        <div class="model-list-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="model-list-meta">
        <span>${progress}%</span>
        <span>${escapeHtml(task.stageText || "等待处理")}</span>
      </div>
      <div class="model-list-actions">
        <button class="secondary-btn" type="button" data-refresh-task="${escapeHtml(task.id)}">刷新进度</button>
        <button class="secondary-btn" type="button" data-delete-task="${escapeHtml(task.id)}">删除</button>
        <button class="secondary-btn" type="button" data-download-task="${escapeHtml(task.id)}" ${canDownload ? "" : "disabled"}>下载</button>
        <button class="primary-btn" type="button" data-play-task="${escapeHtml(task.id)}" ${playDisabled ? "disabled" : ""}>${playLabel}</button>
      </div>
    </article>
  `;
}

function updateTaskProgressOverlay(task) {
  if (!task || task.finalized) {
    taskProgressOverlay.classList.add("hidden");
    return;
  }

  if (dismissedTaskProgressId && dismissedTaskProgressId === task.id) {
    taskProgressOverlay.classList.add("hidden");
    return;
  }

  const progress = getDisplayProgress(task);
  taskProgressOverlay.classList.remove("hidden");
  taskProgressTitle.textContent = task.prompt || "正在生成 3D 模型";
  taskProgressMeta.textContent = `${task.providerName || task.provider || "生成平台"} · ${formatStatus(task.statusText || task.status)} · ${task.stageText || "处理中"}`;
  taskProgressFill.style.width = `${progress}%`;
  taskProgressPercent.textContent = `${progress}%`;
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
  const assetMeta = await readRemoteAssetMetadata(playable.url);
  beginPlaybackLoading(task, assetMeta);

  if (assetMeta.sizeBytes > 120 * 1024 * 1024) {
    setStatus(`当前模型约 ${formatBytes(assetMeta.sizeBytes)}，加载会比较慢，请耐心等待`);
  }

  try {
    const loaded = await loadRemoteModel(playable.url, {
      name: task.prompt || `${task.providerName || task.provider} 生成模型`,
      formatHint: playable.format,
      timeoutMs: MODEL_PLAYBACK_TIMEOUT_MS,
      assetMeta
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
    clearCurrentObject();
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
  } catch (error) {
    if (!isModelLoadRequestCurrent(requestId)) {
      return;
    }
    clearCurrentObject();
    resetStats();
    setStatus("模型预览失败");
    modelMeta.textContent = formatPreviewError(error);
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
  currentModelFileSizeBytes = Number(options.assetMeta?.sizeBytes || 0);

  const modelLabel = options.name || stripExtension(getFileNameFromUrl(modelUrl)) || "远程模型";
  const formatHint = options.formatHint || inferFormatFromUrl(modelUrl);
  const proxiedUrl = buildAssetProxyUrl(modelUrl);

  setStatus("正在加载生成结果...");
  modelName.textContent = modelLabel;
  formatStat.textContent = String(formatHint || "-").toUpperCase();

  try {
    await Promise.race([
      (async () => {
        const extension = getExtension(formatHint || modelUrl);

        if (extension === "glb" || extension === "gltf") {
          await loadRemoteGltf(proxiedUrl, requestId);
        } else if (extension === "fbx") {
          await loadRemoteFbx(proxiedUrl, requestId);
        } else if (extension === "obj") {
          await loadRemoteObj(proxiedUrl, requestId);
        } else if (extension === "stl") {
          await loadRemoteStl(proxiedUrl, requestId);
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
    setStatus("生成模型已载入预览器");
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

async function loadRemoteGltf(modelUrl, requestId) {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  let gltf;
  try {
    gltf = await loader.loadAsync(modelUrl);
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

async function loadRemoteFbx(modelUrl, requestId) {
  const loader = new FBXLoader();
  const fbx = await loader.loadAsync(modelUrl);

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

async function loadRemoteObj(modelUrl, requestId) {
  const loader = new OBJLoader();
  const obj = await loader.loadAsync(modelUrl);

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

async function loadRemoteStl(modelUrl, requestId) {
  const loader = new STLLoader();
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`无法读取远程 STL 模型 (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
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

function beginPlaybackLoading(task, assetMeta = {}) {
  if (playbackLoadTimeoutId) {
    clearTimeout(playbackLoadTimeoutId);
  }

  activePlaybackLoadingTaskId = task.id;
  modelPlaybackLoadingTitle.textContent = `正在加载「${task.prompt || "3D 模型"}」`;
  modelPlaybackLoadingMeta.textContent = assetMeta.sizeBytes
    ? `当前文件约 ${formatBytes(assetMeta.sizeBytes)}，加载完成前会锁定其他模型切换。`
    : "加载完成前会锁定其他模型切换，超时或失败后会自动解锁。";
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

function endPlaybackLoading() {
  if (playbackLoadTimeoutId) {
    clearTimeout(playbackLoadTimeoutId);
    playbackLoadTimeoutId = null;
  }

  activePlaybackLoadingTaskId = "";
  modelPlaybackLoading.classList.add("hidden");
  renderGeneratedTaskList();
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

function stopSelectedPartDrag() {
  if (!isDraggingSelectedPart) {
    return;
  }

  isDraggingSelectedPart = false;
  draggingExplodePart = null;
  selectedPartDragStartScreen = null;
  controls.enabled = true;
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

  selectedExplodePart = null;
  selectedExplodeSourceMaterials = null;
  applyExplodedLayout();
}

function highlightExplodePart(part) {
  if (!part?.object) {
    return;
  }

  clearSelectedExplodePart();
  selectedExplodePart = part;
  selectedExplodeSourceMaterials = part.object.material;

  const sourceMaterials = Array.isArray(part.object.material) ? part.object.material : [part.object.material];
  const highlightedMaterials = sourceMaterials.map((material) => {
    const clone = material?.clone?.() || material;

    if ("emissive" in clone && clone.emissive?.setHex) {
      clone.emissive.setHex(0x2563eb);
      clone.emissiveIntensity = Math.max(0.45, Number(clone.emissiveIntensity) || 0.45);
    } else if ("color" in clone && clone.color?.offsetHSL) {
      clone.color = clone.color.clone();
      clone.color.offsetHSL(0.01, 0.18, 0.08);
    }

    return clone;
  });

  part.object.material = Array.isArray(part.object.material) ? highlightedMaterials : highlightedMaterials[0];
}

function findExplodePartByMesh(mesh) {
  if (!mesh) {
    return null;
  }

  return explodeParts.find((part) => part.object === mesh) || null;
}

function pickExplodePartFromPointer(event) {
  if (!currentObject || !explodeParts.length) {
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

function updateModelStats(fileName, animationCount) {
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
  grid.visible = isGridVisible;
  ground.visible = isGridVisible;
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
  const stereoScale = stereoConfig.fitSize / maxDim;
  const stereoTarget = new THREE.Vector3(0, 0, stereoConfig.targetDepth);

  previewRoot.scale.setScalar(stereoScale);
  previewRoot.position.copy(stereoTarget).sub(center.multiplyScalar(stereoScale));
  previewRoot.updateMatrixWorld(true);

  stereoBaseTarget.copy(stereoTarget);
  stereoBaseCameraPosition = new THREE.Vector3(0, 0, stereoConfig.cameraDistance);
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

  highlightExplodePart(pickedPart);
  explodeMode = "single";
  explodeTarget = 1;
  updateExplodeButton();
  setStatus(`已选中子结构，单独展开已开启`);
}

function resetPenInteractionState() {
  lastPenPose = null;
  wasPenPressed = false;
  isPenGrabbingModel = false;
  penGrabStartPose = null;
  penGrabStartRotation = null;
  penGrabHitPointLocal = null;
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

  if (isPenGrabbingModel && currentObject && penGrabHitPointLocal) {
    const lockedHitPoint = currentObject.localToWorld(penGrabHitPointLocal.clone());
    stylusRaycaster.helper.position.copy(lockedHitPoint);
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
  const scaleFactor = THREE.MathUtils.clamp(1 + depthDelta * stereoConfig.penScaleSpeed, 0.35, 3.5);
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
    if (isPenGrabbingModel || wasPenPressed) {
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
    if (!beginPenGrab(pen)) {
      setStatus("笔已按下：请用射线命中模型后再抓取");
    }
  }

  if (isPenGrabbingModel) {
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
      eyePos.x * stereoConfig.trackingScaleX,
      eyePos.y * stereoConfig.trackingScaleY,
      -eyePos.z * stereoConfig.trackingScaleZ
    ).multiplyScalar(stereoConfig.trackingScale);

    smoothedEyeOffset.lerp(targetEyeOffset, stereoConfig.trackingSmoothing);
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
      stereoConfig.screenWidth,
      stereoConfig.screenHeight,
      stereoConfig.screenScale
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
  viewerShell.classList.remove("theme-studio", "theme-dark");

  if (theme === "studio") {
    viewerShell.classList.add("theme-studio");
    scene.background = new THREE.Color(0xe8ecef);
    scene.fog = new THREE.Fog(0xe8ecef, 20, 50);
    groundMaterial.color.set(0xe7eaee);
    return;
  }

  if (theme === "dark") {
    viewerShell.classList.add("theme-dark");
    scene.background = new THREE.Color(0x20242b);
    scene.fog = new THREE.Fog(0x20242b, 20, 55);
    groundMaterial.color.set(0x323843);
    return;
  }

  scene.background = new THREE.Color(0xf7efe4);
  scene.fog = new THREE.Fog(0xf7efe4, 18, 44);
  groundMaterial.color.set(0xf4ece1);
}

function updateLightStrength(value) {
  lightValue.textContent = `${value.toFixed(1)}x`;
  hemiLight.intensity = value;
  keyLight.intensity = value * 1.15;
  fillLight.intensity = value * 0.7;
}

function saveRecentEntry(entry) {
  const current = JSON.parse(localStorage.getItem(recentStorageKey) || "[]");
  const next = [entry, ...current.filter((item) => item.name !== entry.name)].slice(0, 6);
  localStorage.setItem(recentStorageKey, JSON.stringify(next));
  renderRecentEntries(next);
}

function loadRecentEntries() {
  renderRecentEntries(JSON.parse(localStorage.getItem(recentStorageKey) || "[]"));
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

function normalizeProviderValue(value) {
  return String(value || "tripo").toLowerCase() === "meshy" ? "meshy" : "tripo";
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getDisplayProgress(task) {
  const rawProgress = clampProgress(task?.progress);
  const provider = normalizeProviderValue(task?.provider);
  const stageText = String(task?.stageText || task?.statusText || task?.type || "");

  if (provider === "meshy") {
    if (stageText.includes("预览")) {
      return Math.max(3, Math.round(rawProgress * 0.58));
    }

    if (stageText.includes("贴图")) {
      return Math.max(60, Math.round(60 + rawProgress * 0.4));
    }
  }

  return rawProgress;
}

function getPreviewModelUrl(task) {
  return (
    task?.preferredModelUrl ||
    task?.modelUrls?.pbrModel ||
    task?.modelUrls?.baseModel ||
    task?.modelUrls?.model ||
    task?.modelUrls?.glb ||
    task?.modelUrls?.fbx ||
    task?.modelUrls?.obj ||
    task?.modelUrls?.stl ||
    null
  );
}

function resolvePlayableModel(task) {
  const candidates = [
    { url: task?.modelUrls?.glb, format: "glb" },
    { url: task?.modelUrls?.model, format: inferFormatFromUrl(task?.modelUrls?.model || "") },
    { url: task?.modelUrls?.pbrModel, format: inferFormatFromUrl(task?.modelUrls?.pbrModel || "") },
    { url: task?.modelUrls?.baseModel, format: inferFormatFromUrl(task?.modelUrls?.baseModel || "") },
    { url: task?.modelUrls?.preRemeshedGlb, format: "glb" },
    { url: task?.modelUrls?.fbx, format: "fbx" },
    { url: task?.modelUrls?.obj, format: "obj" },
    { url: task?.modelUrls?.stl, format: "stl" },
    { url: task?.preferredModelUrl, format: inferFormatFromUrl(task?.preferredModelUrl || "") }
  ];

  for (const candidate of candidates) {
    if (candidate.url) {
      return candidate;
    }
  }

  return null;
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

  if (isBusyError) {
    return "Meshy 当前服务繁忙，请稍后重试。建议先切换到 Tripo3D，或过 1-2 分钟再提交。";
  }

  return text || "请求失败";
}

function isMeshyBusyError(error) {
  const message = String(error?.message || "");
  const detailText = JSON.stringify(error?.details || {});
  return message.includes("Meshy 当前服务繁忙")
    || message.includes("The server is busy. Please try again later.")
    || detailText.includes("The server is busy. Please try again later.");
}

function parseStoredJson(key, fallbackValue) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
  } catch {
    return fallbackValue;
  }
}

function getFileNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const pathname = parsedUrl.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(pathname);
  } catch {
    return String(url).split("/").pop() || "";
  }
}

function inferFormatFromUrl(url) {
  return getExtension(getFileNameFromUrl(url));
}

function buildAssetProxyUrl(url) {
  return `/api/asset?url=${encodeURIComponent(url)}`;
}

function sanitizeDownloadName(value) {
  return String(value || "generated-model")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 64) || "generated-model";
}

function formatTimeLabel(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatStatus(status) {
  const text = String(status || "").trim();
  const map = {
    queued: "排队中",
    running: "生成中",
    success: "生成成功",
    failed: "生成失败",
    banned: "任务被拦截",
    expired: "任务已过期",
    cancelled: "任务已取消",
    unknown: "状态未知",
    pending: "排队中",
    PENDING: "排队中",
    IN_PROGRESS: "生成中",
    SUCCEEDED: "生成成功",
    FAILED: "生成失败",
    CANCELED: "任务已取消",
    CANCELLED: "任务已取消"
  };

  return map[text] || text || "处理中";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function stripExtension(fileName) {
  const parts = String(fileName).split(".");
  if (parts.length <= 1) return fileName;
  parts.pop();
  return parts.join(".");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPreviewError(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "未知预览错误";

  if (message.includes("Unexpected token") || message.includes("JSON")) {
    return "模型文件无法解析，可能文件损坏，或者并不是有效的 3D 模型文件。";
  }

  if (message.includes("KHR_draco_mesh_compression") || message.includes("Draco")) {
    return "该模型使用了 Draco 压缩，但浏览器解码失败。";
  }

  if (message.includes("EXT_meshopt_compression") || message.includes("Meshopt")) {
    return "该模型使用了 Meshopt 压缩，但浏览器解码失败。";
  }

  if (message.includes("Failed to fetch") || message.includes("404")) {
    return "模型依赖的贴图或二进制文件缺失，请将 .gltf 与对应的 .bin 和贴图文件一起上传。";
  }

  return message;
}
