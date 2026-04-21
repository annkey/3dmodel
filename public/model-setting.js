const form = document.getElementById("generator-settings-form");
const providerSelect = document.getElementById("settings-provider");
const modelVersionSelect = document.getElementById("settings-model-version");
const runtimeNote = document.getElementById("settings-runtime-note");
const feedback = document.getElementById("settings-feedback");
const saveButton = document.getElementById("save-settings");

let apiConfig = null;

bootstrap();

async function bootstrap() {
  bindEvents();

  try {
    await refreshConfig();
  } catch (error) {
    showFeedback(error.message || "配置读取失败", "error");
    runtimeNote.textContent = "当前无法读取生成配置，请先检查服务端接口。";
  }
}

function bindEvents() {
  providerSelect.addEventListener("change", () => {
    syncModelVersionOptions();
    updateRuntimeNote();
    hideFeedback();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
  });
}

async function refreshConfig() {
  apiConfig = await fetchJson("/api/config");
  renderProviderOptions();
  syncModelVersionOptions();
  updateRuntimeNote();
}

function renderProviderOptions() {
  const providers = apiConfig?.providers || {};
  const entries = Object.entries(providers);
  const activeProvider = normalizeProvider(apiConfig?.generatorSettings?.provider);

  providerSelect.innerHTML = entries.map(([key, config]) => {
    const selected = key === activeProvider ? " selected" : "";
    const disabled = config.enabled ? "" : " disabled";
    const suffix = config.enabled ? "" : "（未配置密钥）";
    return `<option value="${escapeHtml(key)}"${selected}${disabled}>${escapeHtml(config.name || key)}${escapeHtml(suffix)}</option>`;
  }).join("");

  if (!providerSelect.value && entries.length) {
    const firstEnabled = entries.find(([, config]) => config.enabled);
    providerSelect.value = firstEnabled?.[0] || entries[0][0];
  }
}

function syncModelVersionOptions() {
  const provider = normalizeProvider(providerSelect.value);
  const providerConfig = apiConfig?.providers?.[provider];
  const options = providerConfig?.modelVersions || [];
  const savedProvider = normalizeProvider(apiConfig?.generatorSettings?.provider);
  const preferredVersion = provider === savedProvider
    ? apiConfig?.generatorSettings?.modelVersion
    : providerConfig?.defaultModelVersion;

  modelVersionSelect.innerHTML = options.map((option) => {
    const selected = option.value === preferredVersion ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label || option.value)}</option>`;
  }).join("");

  if (!modelVersionSelect.value && options.length) {
    modelVersionSelect.value = options[0].value;
  }
}

function updateRuntimeNote() {
  const provider = normalizeProvider(providerSelect.value);
  const providerConfig = apiConfig?.providers?.[provider];

  if (!providerConfig) {
    runtimeNote.textContent = "没有找到当前平台配置。";
    return;
  }

  if (!providerConfig.enabled) {
    runtimeNote.textContent = `${providerConfig.name} 当前未配置运行密钥，暂时不能保存为公共生成平台。`;
    return;
  }

  runtimeNote.textContent = `当前将统一使用 ${providerConfig.name} / ${modelVersionSelect.value} 生成模型。保存后，预览页中的所有用户都会按这份公共配置提交任务。`;
}

async function saveSettings() {
  hideFeedback();
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    apiConfig = await fetchJson("/api/generator-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerSelect.value,
        modelVersion: modelVersionSelect.value
      })
    });

    renderProviderOptions();
    syncModelVersionOptions();
    updateRuntimeNote();
    showFeedback("公共生成配置已保存，预览页后续提交会自动使用这份配置。", "success");
  } catch (error) {
    showFeedback(error.message || "保存失败", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "保存公共配置";
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }

  return data;
}

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

function hideFeedback() {
  feedback.textContent = "";
  feedback.className = "feedback hidden";
}

function normalizeProvider(value) {
  return String(value || "tripo").toLowerCase() === "meshy" ? "meshy" : "tripo";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
