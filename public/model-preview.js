import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

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
const fullscreenButton = document.getElementById("toggle-fullscreen");
const exportButton = document.getElementById("export-image");
const fileList = document.getElementById("file-list");
const recentList = document.getElementById("recent-list");
const statusText = document.getElementById("status-text");
const fileCount = document.getElementById("file-count");
const formatStat = document.getElementById("format-stat");
const meshStat = document.getElementById("mesh-stat");
const triangleStat = document.getElementById("triangle-stat");
const vertexStat = document.getElementById("vertex-stat");
const animationStat = document.getElementById("animation-stat");
const sizeStat = document.getElementById("size-stat");
const modelName = document.getElementById("model-name");
const modelMeta = document.getElementById("model-meta");
const viewerHost = document.getElementById("viewer");
const viewerShell = document.getElementById("viewer-shell");

const resourceMap = new Map();
const recentStorageKey = "model-preview-recent";

let currentObject = null;
let animationMixer = null;
let dragDepth = 0;
let isWireframe = false;
let isGridVisible = true;

const animationClock = new THREE.Clock();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
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
scene.add(grid);

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4ece1,
  transparent: true,
  opacity: 0.95
});
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 64), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.002;
ground.receiveShadow = true;
scene.add(ground);

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
resetCameraButton.addEventListener("click", () => {
  if (!currentObject) return;
  frameObject(currentObject);
  setStatus("视角已重置");
});
autoRotateButton.addEventListener("click", toggleAutoRotate);
wireframeButton.addEventListener("click", toggleWireframe);
gridButton.addEventListener("click", toggleGrid);
fullscreenButton.addEventListener("click", () => void toggleFullscreen());
exportButton.addEventListener("click", exportPng);
document.addEventListener("fullscreenchange", updateFullscreenButton);
window.addEventListener("resize", handleResize);
window.addEventListener("error", (event) => {
  setStatus("脚本错误");
  modelMeta.textContent = formatPreviewError(event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  setStatus("加载错误");
  modelMeta.textContent = formatPreviewError(event.reason);
});

bindDragAndDrop();
loadRecentEntries();
applyTheme(themeSelect.value);
updateLightStrength(Number(lightRange.value || 1.4));
handleResize();
animate();

setStatus("准备就绪");
modelName.textContent = "尚未加载模型";
modelMeta.textContent = "上传本地模型文件后，即可在浏览器中预览。";

function bindDragAndDrop() {
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

function applySelectedFiles(files) {
  resourceMap.clear();
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

  try {
    await loadModel(entryFile);
    applyWireframeState();
    setStatus("预览已加载");
  } catch (error) {
    clearCurrentObject();
    resetStats();
    setStatus("模型预览失败");
    modelMeta.textContent = formatPreviewError(error);
  } finally {
    loadButton.disabled = false;
  }
}

async function loadModel(entryFile) {
  clearCurrentObject();

  const extension = getExtension(entryFile.name);
  const manager = createLoadingManager();

  switch (extension) {
    case "glb":
    case "gltf":
      await loadGltf(entryFile, manager);
      return;
    case "fbx":
      await loadFbx(entryFile, manager);
      return;
    case "obj":
      await loadObj(entryFile, manager);
      return;
    case "stl":
      await loadStl(entryFile);
      return;
    default:
      throw new Error(`当前不支持 .${extension} 格式预览`);
  }
}

async function loadGltf(entryFile, manager) {
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

  currentObject = gltf.scene;
  scene.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(gltf.animations || []);
  updateModelStats(entryFile.name, gltf.animations?.length || 0);
}

async function loadFbx(entryFile, manager) {
  const loader = new FBXLoader(manager);
  const url = createObjectUrl(entryFile);
  let fbx;

  try {
    fbx = await loader.loadAsync(url);
  } finally {
    safeRevokeObjectUrl(url);
  }

  currentObject = fbx;
  scene.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations(fbx.animations || []);
  updateModelStats(entryFile.name, fbx.animations?.length || 0);
}

async function loadObj(entryFile, manager) {
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

  scene.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(entryFile.name, 0);
}

async function loadStl(entryFile) {
  const loader = new STLLoader();
  const arrayBuffer = await entryFile.arrayBuffer();
  const geometry = loader.parse(arrayBuffer);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xc58d67,
    metalness: 0.08,
    roughness: 0.76
  });

  currentObject = new THREE.Mesh(geometry, material);
  currentObject.castShadow = true;
  currentObject.receiveShadow = true;
  scene.add(currentObject);
  normalizeObject(currentObject);
  frameObject(currentObject);
  playAnimations([]);
  updateModelStats(entryFile.name, 0);
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
  if (!currentObject) {
    animationMixer = null;
    return;
  }

  scene.remove(currentObject);
  disposeObject(currentObject);
  currentObject = null;
  animationMixer = null;
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

  camera.position.set(center.x + distance, center.y + distance * 0.65, center.z + distance);
  camera.near = Math.max(0.1, distance / 100);
  camera.far = Math.max(100, distance * 10);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(0.5, distance / 8);
  controls.maxDistance = Math.max(10, distance * 4);
  controls.target.copy(center);
  controls.update();
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
}

function highlightSelectedEntry() {
  const selected = entryFileSelect.value;
  for (const item of fileList.querySelectorAll("li[data-file]")) {
    item.classList.toggle("selected", item.dataset.file === selected);
  }
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

function setStatus(text) {
  statusText.textContent = text;
}

function updateModelStats(fileName, animationCount) {
  const meshCount = countMeshes(currentObject);
  const { triangles, vertices } = countGeometryStats(currentObject);
  const size = getObjectSize(currentObject);

  meshStat.textContent = formatNumber(meshCount);
  triangleStat.textContent = formatNumber(triangles);
  vertexStat.textContent = formatNumber(vertices);
  animationStat.textContent = String(animationCount);
  sizeStat.textContent = `${size.x} × ${size.y} × ${size.z}`;

  saveRecentEntry({
    name: fileName,
    format: getExtension(fileName).toUpperCase(),
    triangles,
    vertices,
    openedAt: new Date().toLocaleString()
  });

  modelMeta.textContent = `文件：${fileName} | 网格：${formatNumber(meshCount)} | 三角面：${formatNumber(triangles)}`;
}

function resetStats() {
  formatStat.textContent = "-";
  meshStat.textContent = "-";
  triangleStat.textContent = "-";
  vertexStat.textContent = "-";
  animationStat.textContent = "0";
  sizeStat.textContent = "-";
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
  autoRotateButton.classList.toggle("active", controls.autoRotate);
  autoRotateButton.textContent = `自动旋转：${controls.autoRotate ? "开" : "关"}`;
}

function toggleWireframe() {
  isWireframe = !isWireframe;
  wireframeButton.classList.toggle("active", isWireframe);
  wireframeButton.textContent = `线框模式：${isWireframe ? "开" : "关"}`;
  applyWireframeState();
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
  gridButton.classList.toggle("active", isGridVisible);
  gridButton.textContent = `地面网格：${isGridVisible ? "开" : "关"}`;
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await viewerShell.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}

function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenButton.classList.toggle("active", isFullscreen);
  fullscreenButton.textContent = isFullscreen ? "退出全屏" : "全屏查看";
  setTimeout(handleResize, 50);
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
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = animationClock.getDelta();
  if (animationMixer) {
    animationMixer.update(delta);
  }
  controls.update();
  renderer.render(scene, camera);
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
    return "模型文件无法解析，可能文件损坏，或并不是有效的 3D 模型文件。";
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