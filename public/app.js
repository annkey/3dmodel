const form = document.getElementById("generator-form");
const submitButton = document.getElementById("submit-button");
const statusCard = document.getElementById("status-card");
const statusText = document.getElementById("status-text");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const taskMeta = document.getElementById("task-meta");
const previewWrap = document.getElementById("preview-wrap");
const viewerWrap = document.getElementById("viewer-wrap");
const renderWrap = document.getElementById("render-wrap");
const modelViewer = document.getElementById("model-viewer");
const renderImage = document.getElementById("render-image");
const downloadLinks = document.getElementById("download-links");
const resultJson = document.getElementById("result-json");
const imageInput = document.getElementById("image");
const imagePreview = document.getElementById("image-preview");
const textFields = document.getElementById("text-fields");
const imageFields = document.getElementById("image-fields");
const modeOptions = Array.from(document.querySelectorAll('.mode-option input[name="mode"]'));
const providerOptions = Array.from(document.querySelectorAll('.provider-option input[name="provider"]'));
const providerBadge = document.getElementById("provider-badge");
const modelVersionBadge = document.getElementById("model-version-badge");
const platformDescription = document.getElementById("platform-description");
const modelVersionLabel = document.getElementById("model-version-label");
const textureQualityLabel = document.getElementById("texture-quality-label");
const geometryQualityLabel = document.getElementById("geometry-quality-label");
const secondaryTextLabel = document.getElementById("secondary-text-label");
const imageHelpText = document.getElementById("image-help-text");
const modelVersionSelect = document.getElementById("modelVersion");
const textureQualitySelect = document.getElementById("textureQuality");
const geometryQualitySelect = document.getElementById("geometryQuality");
const negativePromptInput = document.getElementById("negativePrompt");

const PROVIDER_CONFIG = {
  tripo: {
    name: "Tripo3D",
    description: "选择一种输入方式，提交到 Tripo3D。",
    modelVersionLabel: "模型版本",
    textureQualityLabel: "纹理质量",
    geometryQualityLabel: "几何质量",
    secondaryTextLabel: "负向提示词",
    secondaryTextPlaceholder: "例如：模糊、破损、背景杂乱",
    imageAccept: "image/png,image/jpeg,image/webp",
    imageHelpText: "支持 PNG / JPEG / WEBP，建议分辨率大于 256px",
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
    defaultGeometryQuality: "standard"
  },
  meshy: {
    name: "Meshy",
    description: "选择一种输入方式，提交到 Meshy。",
    modelVersionLabel: "AI 模型",
    textureQualityLabel: "贴图输出",
    geometryQualityLabel: "网格类型",
    secondaryTextLabel: "贴图补充提示词",
    secondaryTextPlaceholder: "例如：金属表面、做旧痕迹、发光细节",
    imageAccept: "image/png,image/jpeg",
    imageHelpText: "支持 PNG / JPEG，建议主体清晰、背景干净",
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
    defaultGeometryQuality: "standard"
  }
};

let activePoller = null;
let currentTaskContext = null;

bootstrap();

async function bootstrap() {
  bindProviderSwitch();
  bindModeSwitch();
  bindImagePreview();
  bindModelViewer();

  modelVersionSelect.addEventListener("change", updateHeroBadges);

  try {
    const config = await fetchJson("/api/config");
    applyProviderConfig(getCurrentProvider(), config);
  } catch {
    applyProviderConfig(getCurrentProvider());
    setStatus("服务启动异常，请检查后端配置。", 0, "error");
  }

  form.addEventListener("submit", handleSubmit);
}

function bindProviderSwitch() {
  for (const input of providerOptions) {
    input.addEventListener("change", async () => {
      updateOptionVisuals();
      resetResultBlocks();
      clearPoller();
      currentTaskContext = null;
      setStatus("等待提交", 0, "idle");

      try {
        const config = await fetchJson("/api/config");
        applyProviderConfig(getCurrentProvider(), config);
      } catch {
        applyProviderConfig(getCurrentProvider());
      }
    });
  }
}

function bindModeSwitch() {
  for (const input of modeOptions) {
    input.addEventListener("change", () => {
      updateOptionVisuals();
      const mode = getCurrentMode();
      textFields.classList.toggle("hidden", mode !== "text");
      imageFields.classList.toggle("hidden", mode !== "image");
    });
  }
}

function bindImagePreview() {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) {
      imagePreview.classList.add("hidden");
      imagePreview.innerHTML = "";
      return;
    }

    const url = URL.createObjectURL(file);
    imagePreview.innerHTML = `<img src="${url}" alt="上传预览图">`;
    imagePreview.classList.remove("hidden");
  });
}

function bindModelViewer() {
  modelViewer.addEventListener("load", () => {
    viewerWrap.classList.remove("hidden");
    previewWrap.classList.remove("hidden");
  });

  modelViewer.addEventListener("error", () => {
    viewerWrap.classList.add("hidden");
  });
}

function applyProviderConfig(provider, config = null) {
  const providerConfig = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.tripo;
  const apiConfig = config?.providers?.[provider] || {};

  platformDescription.textContent = providerConfig.description;
  providerBadge.textContent = providerConfig.name;
  modelVersionLabel.textContent = providerConfig.modelVersionLabel;
  textureQualityLabel.textContent = providerConfig.textureQualityLabel;
  geometryQualityLabel.textContent = providerConfig.geometryQualityLabel;
  secondaryTextLabel.textContent = providerConfig.secondaryTextLabel;
  negativePromptInput.placeholder = providerConfig.secondaryTextPlaceholder;
  imageInput.accept = providerConfig.imageAccept;
  imageHelpText.textContent = providerConfig.imageHelpText;

  fillSelect(
    modelVersionSelect,
    providerConfig.modelVersions,
    apiConfig.defaultModelVersion || providerConfig.defaultModelVersion
  );
  fillSelect(textureQualitySelect, providerConfig.textureOptions, providerConfig.defaultTextureQuality);
  fillSelect(geometryQualitySelect, providerConfig.geometryOptions, providerConfig.defaultGeometryQuality);

  updateHeroBadges();
  updateOptionVisuals();
}

function fillSelect(select, options, selectedValue) {
  const currentValue = selectedValue || select.value;
  select.innerHTML = "";

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    if (option.value === currentValue) {
      element.selected = true;
    }
    select.appendChild(element);
  }

  if (!select.value && options.length > 0) {
    select.value = options[0].value;
  }
}

function updateHeroBadges() {
  const provider = getCurrentProvider();
  const providerConfig = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.tripo;
  providerBadge.textContent = providerConfig.name;
  modelVersionBadge.textContent = modelVersionSelect.selectedOptions[0]?.textContent || modelVersionSelect.value;
}

function updateOptionVisuals() {
  const labels = document.querySelectorAll(".mode-option");
  for (const label of labels) {
    const input = label.querySelector("input");
    label.classList.toggle("active", input.checked);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const provider = getCurrentProvider();
  const providerConfig = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.tripo;
  const mode = getCurrentMode();
  const payload = new FormData();
  payload.append("provider", provider);
  payload.append("mode", mode);
  payload.append("modelVersion", modelVersionSelect.value);
  payload.append("textureQuality", textureQualitySelect.value);
  payload.append("geometryQuality", geometryQualitySelect.value);

  if (mode === "text") {
    const prompt = document.getElementById("prompt").value.trim();
    const secondaryText = negativePromptInput.value.trim();

    if (!prompt) {
      setStatus("请输入文本提示词。", 0, "error");
      return;
    }

    payload.append("prompt", prompt);
    payload.append("negativePrompt", secondaryText);
  } else {
    const file = imageInput.files?.[0];
    if (!file) {
      setStatus("请先上传一张参考图片。", 0, "error");
      return;
    }
    payload.append("image", file);
  }

  clearPoller();
  resetResultBlocks();
  setBusy(true, providerConfig.name);
  setStatus(`任务已提交，正在创建 ${providerConfig.name} 任务...`, 5, "running");

  try {
    const result = await fetchJson("/api/generate", {
      method: "POST",
      body: payload
    });

    if (!result.taskId) {
      throw createDetailedError(`${providerConfig.name} 没有返回任务 ID，任务创建失败。`, result);
    }

    currentTaskContext = {
      provider: result.provider || provider,
      mode: result.mode || mode,
      modelVersion: result.displayModelVersion || modelVersionSelect.selectedOptions[0]?.textContent || modelVersionSelect.value,
      providerName: PROVIDER_CONFIG[result.provider || provider]?.name || providerConfig.name
    };

    renderTaskMeta(result.taskId, currentTaskContext);
    await pollTask(result.taskId, currentTaskContext.provider);
  } catch (error) {
    setStatus(error.message || "提交失败。", 0, "error");
    if (error.details) {
      resultJson.textContent = JSON.stringify(error.details, null, 2);
      resultJson.classList.remove("hidden");
    }
  } finally {
    setBusy(false);
  }
}

async function pollTask(taskId, provider) {
  clearPoller();

  const run = async () => {
    try {
      const task = await fetchJson(`/api/task/${taskId}?provider=${encodeURIComponent(provider)}`);
      const progress = typeof task.progress === "number" ? task.progress : 0;
      const tone =
        task.status === "success"
          ? "success"
          : task.finalized && task.status !== "success"
            ? "error"
            : "running";

      if (task.transition?.nextTaskId && task.transition.nextTaskId !== taskId) {
        currentTaskContext = {
          provider,
          mode: task.mode || currentTaskContext?.mode || getCurrentMode(),
          modelVersion: task.displayModelVersion || currentTaskContext?.modelVersion || modelVersionSelect.value,
          providerName: task.providerName || currentTaskContext?.providerName || PROVIDER_CONFIG[provider]?.name || provider
        };
        renderTaskMeta(task.transition.nextTaskId, currentTaskContext, task.transition.stageText);
        setStatus(task.transition.statusText || "正在进入下一阶段...", progress, "running");
        clearPoller();
        await pollTask(task.transition.nextTaskId, provider);
        return;
      }

      currentTaskContext = {
        provider,
        mode: task.mode || currentTaskContext?.mode || getCurrentMode(),
        modelVersion: task.displayModelVersion || currentTaskContext?.modelVersion || modelVersionSelect.value,
        providerName: task.providerName || currentTaskContext?.providerName || PROVIDER_CONFIG[provider]?.name || provider
      };

      renderTaskMeta(task.taskId || taskId, currentTaskContext, task.stageText);
      setStatus(task.statusText || task.status, progress, tone);
      renderTask(task);

      if (task.finalized) {
        clearPoller();
      }
    } catch (error) {
      clearPoller();
      setStatus(error.message || "查询任务状态失败。", 0, "error");
      if (error.details) {
        resultJson.textContent = JSON.stringify(error.details, null, 2);
        resultJson.classList.remove("hidden");
      }
    }
  };

  await run();
  activePoller = setInterval(run, 4000);
}

function renderTaskMeta(taskId, context, stageText = "") {
  taskMeta.innerHTML = "";
  taskMeta.append(
    createPill(`Task ID: ${taskId}`),
    createPill(`Provider: ${context.providerName}`),
    createPill(`Mode: ${context.mode}`),
    createPill(`Model: ${context.modelVersion}`)
  );

  if (stageText) {
    taskMeta.append(createPill(stageText));
  }

  taskMeta.classList.remove("hidden");
}

function renderTask(task) {
  resultJson.textContent = JSON.stringify(task.raw, null, 2);
  resultJson.classList.remove("hidden");

  const modelUrl = getPreviewModelUrl(task);
  const renderedImageUrl = task.renderedImage;

  previewWrap.classList.add("hidden");
  viewerWrap.classList.add("hidden");
  renderWrap.classList.add("hidden");

  if (modelUrl) {
    modelViewer.src = modelUrl;
    viewerWrap.classList.remove("hidden");
    previewWrap.classList.remove("hidden");
  } else {
    modelViewer.removeAttribute("src");
  }

  if (renderedImageUrl) {
    renderImage.src = renderedImageUrl;
    renderWrap.classList.remove("hidden");
    previewWrap.classList.remove("hidden");
  } else {
    renderImage.removeAttribute("src");
  }

  const links = [];
  for (const item of task.downloadItems || []) {
    if (item?.url) {
      links.push(linkMarkup(item.label, item.url));
    }
  }

  if (links.length > 0) {
    downloadLinks.innerHTML = links.join("");
    downloadLinks.classList.remove("hidden");
  } else {
    downloadLinks.innerHTML = "";
    downloadLinks.classList.add("hidden");
  }
}

function resetResultBlocks() {
  taskMeta.innerHTML = "";
  taskMeta.classList.add("hidden");
  previewWrap.classList.add("hidden");
  viewerWrap.classList.add("hidden");
  renderWrap.classList.add("hidden");
  downloadLinks.innerHTML = "";
  downloadLinks.classList.add("hidden");
  resultJson.textContent = "";
  resultJson.classList.add("hidden");
  modelViewer.removeAttribute("src");
  renderImage.removeAttribute("src");
}

function setStatus(text, progress, tone) {
  statusText.textContent = formatStatus(text);
  progressText.textContent = `${Math.max(0, Math.min(100, Math.round(progress)))}%`;
  progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  statusCard.className = `status-card ${tone || "idle"}`;
}

function setBusy(isBusy, providerName = "") {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? `正在提交到 ${providerName}...` : "开始生成 3D 模型";
}

function getCurrentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function getCurrentProvider() {
  return document.querySelector('input[name="provider"]:checked').value;
}

function clearPoller() {
  if (activePoller) {
    clearInterval(activePoller);
    activePoller = null;
  }
}

function getPreviewModelUrl(task) {
  return (
    task.preferredModelUrl ||
    task.modelUrls?.pbrModel ||
    task.modelUrls?.baseModel ||
    task.modelUrls?.model ||
    task.modelUrls?.glb ||
    task.modelUrls?.fbx ||
    task.modelUrls?.obj ||
    task.modelUrls?.stl ||
    null
  );
}

function formatStatus(status) {
  const map = {
    queued: "排队中",
    running: "生成中",
    success: "生成成功",
    failed: "生成失败",
    banned: "任务被拦截",
    expired: "任务已过期",
    cancelled: "任务已取消",
    unknown: "状态未知",
    PENDING: "排队中",
    IN_PROGRESS: "生成中",
    SUCCEEDED: "生成成功",
    FAILED: "生成失败",
    CANCELED: "任务已取消"
  };
  return map[status] || status;
}

function createPill(text) {
  const div = document.createElement("div");
  div.className = "task-pill";
  div.textContent = text;
  return div;
}

function linkMarkup(label, href) {
  return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw createDetailedError(data.message || "请求失败。", data);
  }

  return data;
}

function createDetailedError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}
