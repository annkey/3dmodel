import { applySiteBranding } from "/site-brand.js";

const AUTH_STORAGE_KEY = "kmax-model-preview-auth";
const GENERATED_TASK_STORAGE_KEY = "model-preview-generated-tasks";
const navItems = Array.from(document.querySelectorAll("[data-view]"));
const views = {
  models: document.getElementById("models-view"),
  credits: document.getElementById("credits-view"),
  profile: document.getElementById("profile-view")
};
const viewTitle = document.getElementById("view-title");
const viewDescription = document.getElementById("view-description");
const workUserMenu = document.getElementById("work-user-menu");
const workUserMenuTrigger = document.getElementById("work-user-menu-trigger");
const workUserMenuPanel = document.getElementById("work-user-menu-panel");
const workUserAvatar = document.getElementById("work-user-avatar");
const workUserDisplayName = document.getElementById("work-user-display-name");
const workUserRoleText = document.getElementById("work-user-role-text");
const workUserCreditText = document.getElementById("work-user-credit-text");
const workAdminEntryLink = document.getElementById("work-admin-entry-link");
const workLogoutButton = document.getElementById("work-logout-button");
const modelFilters = document.getElementById("model-filters");
const sourceFilter = document.getElementById("source-filter");
const modelList = document.getElementById("model-list");
const modelPagination = document.getElementById("model-pagination");
const modelEmpty = document.getElementById("model-empty");
const modelFeedback = document.getElementById("model-feedback");
const storageText = document.getElementById("storage-text");
const storageMeterFill = document.getElementById("storage-meter-fill");
const openUploadDialogButton = document.getElementById("open-upload-dialog");
const uploadDialog = document.getElementById("upload-dialog");
const closeUploadDialogButton = document.getElementById("close-upload-dialog");
const cancelUploadDialogButton = document.getElementById("cancel-upload-dialog");
const uploadForm = document.getElementById("upload-form");
const uploadFiles = document.getElementById("model-upload-files");
const uploadCover = document.getElementById("model-upload-cover");
const uploadName = document.getElementById("model-upload-name");
const uploadFilesText = document.getElementById("model-upload-files-text");
const uploadCoverText = document.getElementById("model-upload-cover-text");
const uploadProgress = document.getElementById("upload-progress");
const uploadProgressLabel = document.getElementById("upload-progress-label");
const uploadProgressValue = document.getElementById("upload-progress-value");
const uploadProgressTrack = document.querySelector(".upload-progress-track");
const uploadProgressFill = document.getElementById("upload-progress-fill");
const uploadFeedback = document.getElementById("upload-feedback");
const uploadButton = document.getElementById("upload-model-button");
const modelActionDialog = document.getElementById("model-action-dialog");
const modelActionForm = document.getElementById("model-action-form");
const modelActionTitle = document.getElementById("model-action-title");
const modelActionMessage = document.getElementById("model-action-message");
const modelRenameField = document.getElementById("model-rename-field");
const modelRenameInput = document.getElementById("model-rename-input");
const modelCoverField = document.getElementById("model-cover-field");
const modelCoverInput = document.getElementById("model-cover-input");
const modelCoverInputText = document.getElementById("model-cover-input-text");
const modelActionFeedback = document.getElementById("model-action-feedback");
const confirmModelActionButton = document.getElementById("confirm-model-action");
const closeModelActionDialogButton = document.getElementById("close-model-action-dialog");
const cancelModelActionDialogButton = document.getElementById("cancel-model-action-dialog");
const creditBalance = document.getElementById("credit-balance");
const generateCost = document.getElementById("generate-cost");
const optimizeCost = document.getElementById("optimize-cost");
const creditRecordSearch = document.getElementById("credit-record-search");
const creditRecords = document.getElementById("credit-records");
const creditPagination = document.getElementById("credit-pagination");
const creditEmpty = document.getElementById("credit-empty");
const profileForm = document.getElementById("profile-form");
const profileUsername = document.getElementById("profile-username");
const profileDisplayName = document.getElementById("profile-display-name");
const profileFeedback = document.getElementById("profile-feedback");
const passwordForm = document.getElementById("password-form");
const currentPassword = document.getElementById("current-password");
const newPassword = document.getElementById("new-password");
const passwordFeedback = document.getElementById("password-feedback");

const viewMeta = {
  models: {
    title: "我的模型",
    description: "上传本地模型到个人空间，查看AI生成的模型"
  },
  credits: {
    title: "我的积分",
    description: "查看积分余额、消耗和充值记录。"
  },
  profile: {
    title: "我的信息",
    description: "维护个人账号信息和登录密码。"
  }
};

const MODEL_PAGE_SIZE = 20;
const CREDIT_PAGE_SIZE = 20;

let authSession = null;
let account = null;
let credits = { balance: 0, costs: {}, records: [] };
let storage = { usedBytes: 0, quotaBytes: 10 * 1024 * 1024 * 1024, remainingBytes: 0, percent: 0 };
let uploadedModels = [];
let currentView = "models";
let pendingModelAction = null;
const modelCoverObjectUrls = new Map();
let modelShareField = null;
let currentUploadController = null;
let uploadCancelledByUser = false;
let modelPage = 1;
let creditPage = 1;

bootstrap();
void applySiteBranding();

async function bootstrap() {
  authSession = parseStoredJson(AUTH_STORAGE_KEY, null);
  if (!authSession?.token) {
    window.location.href = "/model-preview.html";
    return;
  }
  if (authSession.user) {
    renderUserMenu(authSession.user);
  }

  bindEvents();
  renderStorage();
  renderModels();
  await refreshMe();
  await refreshUploadedModels();
}

function bindEvents() {
  navItems.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view || "models"));
  });
  sourceFilter.addEventListener("change", () => {
    modelPage = 1;
    renderModels();
  });
  openUploadDialogButton?.addEventListener("click", openUploadDialog);
  closeUploadDialogButton?.addEventListener("click", closeUploadDialog);
  cancelUploadDialogButton?.addEventListener("click", closeUploadDialog);
  uploadDialog?.addEventListener("click", (event) => {
    if (event.target === uploadDialog) {
      closeUploadDialog();
    }
  });
  modelActionDialog?.addEventListener("click", (event) => {
    if (event.target === modelActionDialog) {
      closeModelActionDialog();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !uploadDialog?.classList.contains("hidden")) {
      closeUploadDialog();
    }
    if (event.key === "Escape" && !modelActionDialog?.classList.contains("hidden")) {
      closeModelActionDialog();
    }
  });
  uploadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void uploadModelFiles();
  });
  modelActionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void confirmModelAction();
  });
  closeModelActionDialogButton?.addEventListener("click", closeModelActionDialog);
  cancelModelActionDialogButton?.addEventListener("click", closeModelActionDialog);
  uploadFiles?.addEventListener("change", () => {
    updateFileInputText(uploadFiles, uploadFilesText);
    fillUploadNameFromModelFile();
  });
  uploadCover?.addEventListener("change", () => updateFileInputText(uploadCover, uploadCoverText));
  modelCoverInput?.addEventListener("change", () => updateFileInputText(modelCoverInput, modelCoverInputText));
  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveProfile();
  });
  passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void savePassword();
  });
  creditRecordSearch?.addEventListener("input", () => {
    creditPage = 1;
    renderCredits();
  });
  creditPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-credit-page]");
    if (!button || button.disabled) {
      return;
    }
    creditPage = Number(button.dataset.creditPage || 1);
    renderCredits();
  });
  modelPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-model-page]");
    if (!button || button.disabled) {
      return;
    }
    modelPage = Number(button.dataset.modelPage || 1);
    renderModels();
  });
  modelList.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-model-menu-id]");
    if (menuButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleModelActionMenu(menuButton.dataset.modelMenuId);
      return;
    }

    const renameButton = event.target.closest("[data-rename-model-id]");
    if (renameButton) {
      event.preventDefault();
      event.stopPropagation();
      closeModelActionMenus();
      openEditModelDialog(renameButton.dataset.renameModelId);
      return;
    }

    const shareButton = event.target.closest("[data-share-model-id]");
    if (shareButton) {
      event.preventDefault();
      event.stopPropagation();
      closeModelActionMenus();
      openShareModelDialog(shareButton.dataset.shareModelId);
      return;
    }

    const downloadButton = event.target.closest("[data-download-model-id]");
    if (downloadButton) {
      event.preventDefault();
      event.stopPropagation();
      closeModelActionMenus();
      void downloadUploadedModel(downloadButton.dataset.downloadModelId);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-model-id]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      closeModelActionMenus();
      openDeleteModelDialog(deleteButton.dataset.deleteModelId);
    }
  });
  workUserMenuTrigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    workUserMenuPanel?.classList.toggle("hidden");
  });
  document.addEventListener("click", (event) => {
    if (!workUserMenu?.contains(event.target)) {
      workUserMenuPanel?.classList.add("hidden");
    }
    if (!event.target.closest(".card-actions")) {
      closeModelActionMenus();
    }
  });
  workLogoutButton?.addEventListener("click", () => {
    void logout();
  });
}

function switchView(viewName) {
  currentView = views[viewName] ? viewName : "models";
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === currentView));
  Object.entries(views).forEach(([key, element]) => element.classList.toggle("hidden", key !== currentView));
  viewTitle.textContent = viewMeta[currentView].title;
  viewDescription.textContent = viewMeta[currentView].description;
  modelFilters.classList.toggle("hidden", currentView !== "models");
  if (currentView === "models") {
    void refreshUploadedModels();
  }
  if (currentView === "credits") renderCredits();
  if (currentView === "profile") renderProfile();
}

async function refreshMe() {
  try {
    const data = await fetchJson("/api/work/me", { headers: getAuthHeaders() });
    account = data.user;
    credits = data.credits || credits;
    storage = data.storage || account?.storage || storage;
    authSession.user = data.user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    renderUserMenu(account);
    renderStorage();
    renderCredits();
    renderProfile();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/model-preview.html";
      return;
    }

    account = authSession.user || account;
    if (account) {
      renderUserMenu(account);
      renderProfile();
    }
    showFeedback(uploadFeedback, error.message || "用户中心数据读取失败，请稍后重试。", "error");
  }
}

async function refreshUploadedModels() {
  try {
    const data = await fetchJson("/api/work/models", { headers: getAuthHeaders() });
    uploadedModels = data.models || [];
    storage = data.storage || storage;
    renderStorage();
    renderModels();
  } catch (error) {
    uploadedModels = [];
    renderModels();
    showFeedback(modelFeedback, error.message || "服务器模型列表读取失败。", "error");
  }
}

async function uploadModelFiles() {
  if (currentUploadController) {
    showFeedback(uploadFeedback, "已有上传任务正在进行，请先取消当前上传。", "error");
    return;
  }

  const files = Array.from(uploadFiles.files || []);
  const coverFile = uploadCover.files?.[0] || null;
  if (!files.length) {
    showFeedback(uploadFeedback, "请选择要上传的 3D 模型文件。", "error");
    return;
  }

  if (coverFile && !["image/jpeg", "image/png", "image/webp"].includes(coverFile.type)) {
    showFeedback(uploadFeedback, "封面仅支持 JPG、PNG 或 WebP 图片。", "error");
    return;
  }

  const selectedBytes = files.reduce((sum, file) => sum + file.size, 0) + (coverFile?.size || 0);
  if (selectedBytes > Number(storage.remainingBytes || 0)) {
    showFeedback(uploadFeedback, "个人 3D 模型空间不足，请先手动删除自己的 3D 模型文件后再上传。", "error");
    return;
  }

  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  if (coverFile) {
    form.append("cover", coverFile);
  }
  form.append("name", uploadName.value.trim());

  let uploadRequest = null;
  uploadCancelledByUser = false;
  uploadButton.disabled = true;
  uploadButton.textContent = "上传中...";
  updateUploadProgress(0, "准备上传");
  showFeedback(uploadFeedback, "正在上传到服务器，请保持页面打开。", "success");

  try {
    const data = await uploadFormDataWithProgress("/api/work/models", form, {
      headers: getAuthHeaders(),
      onRequest: (request) => {
        uploadRequest = request;
        currentUploadController = request;
      },
      onProgress: (percent, event) => {
        const loaded = formatBytes(event.loaded);
        const total = event.lengthComputable ? formatBytes(event.total) : "";
        updateUploadProgress(percent, total ? `正在上传 ${loaded} / ${total}` : `正在上传 ${loaded}`);
      },
      onProcessing: () => {
        updateUploadProgress(100, "上传完成，服务器正在保存到 OSS");
      }
    });
    uploadedModels = data.models || [];
    storage = data.storage || storage;
    uploadForm.reset();
    updateUploadFileTexts();
    currentUploadController = null;
    closeUploadDialog({ abortUpload: false });
    renderStorage();
    renderModels();
    showFeedback(modelFeedback, "模型文件已上传到服务器。", "success");
  } catch (error) {
    if (error.name === "AbortError" || uploadCancelledByUser) {
      showFeedback(modelFeedback, "上传已取消，未完成的文件不会加入模型库。", "success");
      return;
    }
    showFeedback(uploadFeedback, error.message || "模型文件上传失败。", "error");
  } finally {
    if (currentUploadController === uploadRequest) {
      currentUploadController = null;
    }
    uploadCancelledByUser = false;
    uploadButton.disabled = false;
    uploadButton.textContent = "上传到服务器";
  }
}

async function deleteUploadedModel(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  try {
    if (model.localGenerated) {
      removeGeneratedTaskCache(model);
      renderModels();
      showFeedback(modelFeedback, "模型记录已删除。", "success");
      return;
    }

    const data = await fetchJson(`/api/work/models/${encodeURIComponent(modelId)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    uploadedModels = data.models || [];
    storage = data.storage || storage;
    removeGeneratedTaskCache(model);
    renderStorage();
    renderModels();
    showFeedback(modelFeedback, "模型文件已删除，存储空间已释放。", "success");
  } catch (error) {
    showFeedback(modelFeedback, error.message || "删除失败。", "error");
    throw error;
  }
}

async function editUploadedModel(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  const name = modelRenameInput.value.trim();
  if (!name) {
    showFeedback(modelFeedback, "模型名称不能为空。", "error");
    return;
  }

  try {
    if (model.localGenerated) {
      const coverDataUrl = modelCoverInput?.files?.[0]
        ? await fileToDataUrl(modelCoverInput.files[0])
        : "";
      updateGeneratedTaskCache(model, {
        name,
        coverUrl: coverDataUrl || model.coverUrl || model.renderedImage || ""
      });
      renderModels();
      showFeedback(modelFeedback, "模型信息已更新。", "success");
      return;
    }

    const form = new FormData();
    form.append("name", name);
    if (modelCoverInput?.files?.[0]) {
      form.append("cover", modelCoverInput.files[0]);
    }
    const data = await fetchJson(`/api/work/models/${encodeURIComponent(modelId)}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: form
    });
    uploadedModels = data.models || [];
    storage = data.storage || storage;
    updateGeneratedTaskCache(model, {
      name: data.model?.name || name,
      coverUrl: data.model?.coverUrl || model.coverUrl || ""
    });
    renderStorage();
    renderModels();
    showFeedback(modelFeedback, "模型信息已更新。", "success");
  } catch (error) {
    showFeedback(modelFeedback, error.message || "修改模型失败。", "error");
    throw error;
  }
}

function ensureModelShareField() {
  if (modelShareField) return modelShareField;
  modelShareField = document.createElement("div");
  modelShareField.id = "model-share-field";
  modelShareField.className = "share-field hidden";
  modelShareField.innerHTML = `
    <p class="share-tip">分享模型可以获得积分奖励</p>
    <label class="radio-option">
      <input type="radio" name="model-share-visibility" value="private" checked />
      <span>私有可见</span>
    </label>
    <label class="radio-option">
      <input type="radio" name="model-share-visibility" value="public" />
      <span>公开可见</span>
    </label>
  `;
  modelRenameField?.before(modelShareField);
  return modelShareField;
}

function setModelShareFieldVisible(visible, visibility = "private") {
  const field = ensureModelShareField();
  field.classList.toggle("hidden", !visible);
  const value = visibility === "public" ? "public" : "private";
  field.querySelectorAll('input[name="model-share-visibility"]').forEach((input) => {
    input.checked = input.value === value;
  });
}

function getSelectedModelShareVisibility() {
  const checked = ensureModelShareField().querySelector('input[name="model-share-visibility"]:checked');
  return checked?.value === "public" ? "public" : "private";
}

async function shareUploadedModel(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  if (model.localGenerated) {
    updateGeneratedTaskCache(model, { visibility: getSelectedModelShareVisibility() });
    renderModels();
    showFeedback(modelFeedback, "分享设置已保存。本地缓存模型同步到服务器后可获得积分奖励。", "success");
    return;
  }

  const data = await fetchJson(`/api/work/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: getSelectedModelShareVisibility() })
  });
  uploadedModels = data.models || [];
  storage = data.storage || storage;
  await refreshMe();
  renderStorage();
  renderModels();
  showFeedback(modelFeedback, "分享设置已保存。", "success");
}

function openShareModelDialog(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  pendingModelAction = { type: "share", modelId };
  modelActionTitle.textContent = "分享模型";
  modelActionMessage.textContent = "选择模型公开可见还是私有可见，默认为私有。";
  modelRenameInput.value = "";
  modelRenameField.classList.add("hidden");
  modelCoverField?.classList.add("hidden");
  if (modelCoverInput) modelCoverInput.value = "";
  updateFileInputText(modelCoverInput, modelCoverInputText);
  setModelShareFieldVisible(true, model.visibility || (model.isPublic ? "public" : "private"));
  confirmModelActionButton.textContent = "保存";
  confirmModelActionButton.classList.remove("danger-btn");
  confirmModelActionButton.classList.add("primary-btn");
  showFeedback(modelActionFeedback, "");
  modelActionDialog.classList.remove("hidden");
  ensureModelShareField().querySelector("input")?.focus();
}

function openEditModelDialog(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  pendingModelAction = { type: "edit", modelId };
  modelActionTitle.textContent = "修改模型";
  modelActionMessage.textContent = "可修改模型名称，也可以上传新的封面图。";
  modelRenameInput.value = model.name || model.entryFile || "";
  modelRenameField.classList.remove("hidden");
  modelCoverField?.classList.remove("hidden");
  setModelShareFieldVisible(false);
  if (modelCoverInput) modelCoverInput.value = "";
  updateFileInputText(modelCoverInput, modelCoverInputText);
  confirmModelActionButton.textContent = "保存";
  confirmModelActionButton.classList.remove("danger-btn");
  confirmModelActionButton.classList.add("primary-btn");
  showFeedback(modelActionFeedback, "");
  modelActionDialog.classList.remove("hidden");
  modelRenameInput.focus();
  modelRenameInput.select();
}

function openDeleteModelDialog(modelId) {
  const model = findRenderableModel(modelId);
  if (!model) return;

  pendingModelAction = { type: "delete", modelId };
  modelActionTitle.textContent = "删除模型";
  modelActionMessage.textContent = `确认删除“${model.name || model.entryFile}”？删除后会释放个人存储空间。`;
  modelRenameInput.value = "";
  modelRenameField.classList.add("hidden");
  modelCoverField?.classList.add("hidden");
  setModelShareFieldVisible(false);
  if (modelCoverInput) modelCoverInput.value = "";
  updateFileInputText(modelCoverInput, modelCoverInputText);
  confirmModelActionButton.textContent = "删除";
  confirmModelActionButton.classList.remove("primary-btn");
  confirmModelActionButton.classList.add("danger-btn");
  showFeedback(modelActionFeedback, "");
  modelActionDialog.classList.remove("hidden");
  confirmModelActionButton.focus();
}

async function confirmModelAction() {
  if (!pendingModelAction) return;

  confirmModelActionButton.disabled = true;
  try {
    if (pendingModelAction.type === "edit") {
      await editUploadedModel(pendingModelAction.modelId);
    } else if (pendingModelAction.type === "share") {
      await shareUploadedModel(pendingModelAction.modelId);
    } else if (pendingModelAction.type === "delete") {
      await deleteUploadedModel(pendingModelAction.modelId);
    }
    confirmModelActionButton.disabled = false;
    closeModelActionDialog();
  } catch (error) {
    showFeedback(modelActionFeedback, error.message || "操作失败。", "error");
  } finally {
    confirmModelActionButton.disabled = false;
  }
}

function closeModelActionDialog() {
  if (confirmModelActionButton?.disabled) return;
  pendingModelAction = null;
  modelActionDialog?.classList.add("hidden");
  modelRenameField?.classList.add("hidden");
  modelCoverField?.classList.add("hidden");
  setModelShareFieldVisible(false);
  if (modelCoverInput) modelCoverInput.value = "";
  updateFileInputText(modelCoverInput, modelCoverInputText);
  showFeedback(modelActionFeedback, "");
}

function updateUploadFileTexts() {
  updateFileInputText(uploadFiles, uploadFilesText);
  updateFileInputText(uploadCover, uploadCoverText);
}

function updateFileInputText(input, output) {
  if (!input || !output) return;
  const files = Array.from(input.files || []);
  if (!files.length) {
    output.textContent = "未选择任何文件";
    output.title = "";
    return;
  }

  if (files.length === 1) {
    output.textContent = files[0].name;
    output.title = files[0].name;
    return;
  }

  const text = `${files.length} 个文件：${files[0].name} 等`;
  output.textContent = text;
  output.title = files.map((file) => file.name).join("\n");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

function toggleModelActionMenu(modelId) {
  const target = Array.from(modelList.querySelectorAll("[data-model-menu]"))
    .find((menu) => menu.dataset.modelMenu === modelId);
  const shouldOpen = target?.classList.contains("hidden");
  closeModelActionMenus();
  if (target && shouldOpen) {
    target.classList.remove("hidden");
  }
}

function closeModelActionMenus() {
  modelList.querySelectorAll("[data-model-menu]").forEach((menu) => menu.classList.add("hidden"));
}

function fillUploadNameFromModelFile() {
  const files = Array.from(uploadFiles?.files || []);
  const modelFile = files.find((file) => /\.(glb|gltf|fbx|obj|stl)$/i.test(file.name)) || files[0];
  if (!modelFile || uploadName.value.trim()) return;
  uploadName.value = stripFileExtension(modelFile.name);
}

function renderStorage() {
  const used = Number(storage.usedBytes || 0);
  const quota = Number(storage.quotaBytes || 0);
  const remaining = Math.max(0, quota - used);
  const percent = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  storageText.textContent = `${formatBytes(used)} / ${formatBytes(quota)}，剩余 ${formatBytes(remaining)}`;
  storageMeterFill.style.width = `${percent}%`;
  storageMeterFill.classList.toggle("danger", percent >= 95);
}

function renderModels() {
  const source = sourceFilter.value;
  const rows = getRenderableModels()
    .filter((item) => source === "all" || item.source === source)
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
      return rightTime - leftTime;
    });

  const totalPages = Math.max(1, Math.ceil(rows.length / MODEL_PAGE_SIZE));
  modelPage = Math.min(Math.max(1, modelPage), totalPages);
  const start = (modelPage - 1) * MODEL_PAGE_SIZE;
  const pageRows = rows.slice(start, start + MODEL_PAGE_SIZE);
  modelEmpty.classList.toggle("hidden", rows.length > 0);
  modelList.innerHTML = pageRows.map(renderModelCard).join("");
  renderModelPagination(rows.length, totalPages);
  loadProtectedModelCovers();
}

function renderModelPagination(total, totalPages) {
  if (!modelPagination) {
    return;
  }
  const shouldShow = total > MODEL_PAGE_SIZE;
  modelPagination.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    modelPagination.innerHTML = "";
    return;
  }

  const start = (modelPage - 1) * MODEL_PAGE_SIZE + 1;
  const end = Math.min(total, modelPage * MODEL_PAGE_SIZE);
  modelPagination.innerHTML = `
    <span class="pagination-info">第 ${escapeHtml(modelPage)} / ${escapeHtml(totalPages)} 页，显示 ${escapeHtml(start)}-${escapeHtml(end)} 条，共 ${escapeHtml(total)} 条</span>
    <div class="pagination-actions">
      <button class="secondary-btn compact-btn" type="button" data-model-page="${escapeAttribute(modelPage - 1)}"${modelPage <= 1 ? " disabled" : ""}>上一页</button>
      <button class="secondary-btn compact-btn" type="button" data-model-page="${escapeAttribute(modelPage + 1)}"${modelPage >= totalPages ? " disabled" : ""}>下一页</button>
    </div>
  `;
}

function getRenderableModels() {
  const serverModels = Array.isArray(uploadedModels) ? uploadedModels : [];
  const serverGeneratedTaskIds = new Set(
    serverModels
      .map((model) => model.generatedTaskId || "")
      .filter(Boolean)
  );
  const serverModelIds = new Set(serverModels.map((model) => model.id).filter(Boolean));
  const localGeneratedModels = loadLocalGeneratedModels()
    .filter((model) => !serverGeneratedTaskIds.has(model.generatedTaskId) && !serverModelIds.has(model.id));

  return [...serverModels, ...localGeneratedModels];
}

function findRenderableModel(modelId) {
  return getRenderableModels().find((item) => item.id === modelId) || null;
}

function loadLocalGeneratedModels() {
  return parseStoredJson(GENERATED_TASK_STORAGE_KEY, [])
    .filter((task) => task?.status === "success" && resolveGeneratedModelUrl(task))
    .map(convertGeneratedTaskToWorkModel);
}

function convertGeneratedTaskToWorkModel(task) {
  const modelUrl = resolveGeneratedModelUrl(task);
  const persistedModel = task.persistedModel || null;
  const format = (persistedModel?.format || inferFormatFromUrl(modelUrl) || task.format || "").toUpperCase();
  return {
    id: persistedModel?.id || task.taskId || task.id,
    name: task.prompt || task.name || task.taskId || "AI生成模型",
    source: "ai",
    sourceText: "AI生成",
    generatedTaskId: task.taskId || task.id || "",
    provider: task.provider || "",
    providerName: task.providerName || "",
    mode: task.mode || "",
    displayModelVersion: task.displayModelVersion || "",
    format,
    fileSizeBytes: Number(task.fileSizeBytes || persistedModel?.fileSizeBytes || 0),
    modelUrl,
    coverUrl: task.renderedImage || task.thumbnailUrl || persistedModel?.coverUrl || "",
    renderedImage: task.renderedImage || "",
    visibility: task.visibility || persistedModel?.visibility || "private",
    isPublic: Boolean(task.isPublic || persistedModel?.isPublic),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    localGenerated: true
  };
}

function resolveGeneratedModelUrl(task) {
  return (
    task?.persistedModel?.modelUrl ||
    task?.preferredModelUrl ||
    task?.modelUrls?.glb ||
    task?.modelUrls?.model ||
    task?.modelUrls?.pbrModel ||
    task?.modelUrls?.baseModel ||
    task?.modelUrls?.fbx ||
    task?.modelUrls?.obj ||
    task?.modelUrls?.stl ||
    ""
  );
}

function updateGeneratedTaskCache(model, changes) {
  const tasks = parseStoredJson(GENERATED_TASK_STORAGE_KEY, []);
  let changed = false;
  const nextTasks = tasks.map((task) => {
    if (!isSameGeneratedTask(task, model)) {
      return task;
    }

    changed = true;
    const nextTask = {
      ...task,
      prompt: changes.name || task.prompt,
      name: changes.name || task.name,
      updatedAt: new Date().toISOString()
    };
    if (changes.coverUrl) {
      nextTask.renderedImage = changes.coverUrl;
      nextTask.thumbnailUrl = changes.coverUrl;
    }
    if (changes.visibility) {
      nextTask.visibility = changes.visibility;
      nextTask.isPublic = changes.visibility === "public";
    }
    if (nextTask.persistedModel) {
      nextTask.persistedModel = {
        ...nextTask.persistedModel,
        name: changes.name || nextTask.persistedModel.name,
        coverUrl: changes.coverUrl || nextTask.persistedModel.coverUrl,
        visibility: changes.visibility || nextTask.persistedModel.visibility,
        isPublic: changes.visibility ? changes.visibility === "public" : nextTask.persistedModel.isPublic
      };
    }
    return nextTask;
  });

  if (changed) {
    localStorage.setItem(GENERATED_TASK_STORAGE_KEY, JSON.stringify(nextTasks));
  }
}

function removeGeneratedTaskCache(model) {
  const tasks = parseStoredJson(GENERATED_TASK_STORAGE_KEY, []);
  const nextTasks = tasks.filter((task) => !isSameGeneratedTask(task, model));
  if (nextTasks.length !== tasks.length) {
    localStorage.setItem(GENERATED_TASK_STORAGE_KEY, JSON.stringify(nextTasks));
  }
}

function isSameGeneratedTask(task, model) {
  const taskId = task?.taskId || task?.id || "";
  return Boolean(
    (model.generatedTaskId && taskId === model.generatedTaskId) ||
    (model.id && taskId === model.id) ||
    (model.id && task?.persistedModel?.id === model.id)
  );
}

function renderModelCard(item) {
  const title = item.name || item.prompt || item.taskId || "AI生成模型";
  const time = formatTime(item.updatedAt || item.createdAt);
  const href = buildUploadedPreviewUrl(item);
  const cover = item.coverUrl || item.imageUrl || item.renderedImage || item.thumbnailUrl;
  const protectedCover = isProtectedWorkAssetUrl(cover);
  const coverHtml = protectedCover
    ? `<img data-cover-url="${escapeAttribute(cover)}" alt="${escapeAttribute(title)} 封面" loading="lazy" />`
    : cover
    ? `<img src="${escapeAttribute(cover)}" alt="${escapeAttribute(title)} 封面" loading="lazy" />`
    : `<span class="model-cube"></span>`;
  const actionMenu = `
        <button class="card-menu-trigger" type="button" data-model-menu-id="${escapeAttribute(item.id)}" aria-label="模型操作" aria-haspopup="menu" aria-expanded="false">...</button>
        <div class="card-action-menu hidden" data-model-menu="${escapeAttribute(item.id)}" role="menu">
          <button type="button" data-share-model-id="${escapeAttribute(item.id)}" role="menuitem">分享</button>
          <button type="button" data-download-model-id="${escapeAttribute(item.id)}" role="menuitem">下载</button>
          <button type="button" data-rename-model-id="${escapeAttribute(item.id)}" role="menuitem">修改</button>
          <button class="danger" type="button" data-delete-model-id="${escapeAttribute(item.id)}" role="menuitem">删除</button>
        </div>
      `;
  const paramsText = buildModelParamsText(item);
  const isPublic = item.visibility === "public" || item.isPublic;

  return `
    <article class="model-card">
      <a class="model-card-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener" aria-label="预览 ${escapeAttribute(title)}">
        <div class="model-cover">${coverHtml}</div>
        <div class="model-info">
          <h2>${escapeHtml(title)}</h2>
          <div class="model-meta">
            <span>${escapeHtml(time)}</span>
            ${isPublic ? `<span class="visibility-pill public">公开</span>` : ""}
          </div>
          ${paramsText ? `<p class="model-params">${escapeHtml(paramsText)}</p>` : ""}
        </div>
      </a>
      <div class="card-actions">
        ${actionMenu}
      </div>
    </article>
  `;
}

function buildUploadedPreviewUrl(model) {
  const params = new URLSearchParams({
    modelUrl: model.modelUrl || "",
    taskId: model.id || "",
    name: model.name || model.entryFile || "上传模型",
    provider: model.provider || "upload",
    source: model.source === "ai" ? "AI生成" : "我的模型",
    format: model.format || ""
  });
  return `/model-preview.html?${params.toString()}`;
}

function buildDownloadUrl(url) {
  const value = String(url || "");
  if (!/^https?:\/\//i.test(value) || isProtectedWorkAssetUrl(value)) {
    return value;
  }
  return `/api/asset?url=${encodeURIComponent(value)}`;
}

function inferFormatFromUrl(url) {
  const fileName = String(url || "").split("?")[0].split("/").pop() || "";
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  return ext || "";
}

function buildDownloadFileName(model, title) {
  const entry = Array.isArray(model.files)
    ? model.files.find((file) => file.storedName === model.entryFile) || model.files[0]
    : null;
  const fileName = entry?.originalName || model.entryFile || title || "model";
  const baseName = stripFileExtension(fileName) || stripFileExtension(title) || "model";
  const extension = String(model.format || fileName || "")
    .replace(/^.*\./, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return extension ? `${baseName}.${extension}` : baseName;
}

async function resolveModelDownloadSource(model) {
  if (!model?.id || model.localGenerated) {
    return {
      source: "local",
      url: model?.modelUrl || "",
      fileName: buildDownloadFileName(model, model?.name || model?.entryFile || "model")
    };
  }

  const endpoint = `/api/work/models/${encodeURIComponent(model.id)}/download-source?format=${encodeURIComponent(model.format || "")}`;
  try {
    const data = await fetchJson(endpoint, { headers: getAuthHeaders() });
    if (data?.url) {
      updateCreditsFromResponse(data);
      return data;
    }
  } catch (error) {
    console.warn("Model download source resolve failed", error);
    throw error;
  }

  return {
    source: "local",
    url: model?.modelUrl || "",
    fileName: buildDownloadFileName(model, model?.name || model?.entryFile || "model")
  };
}

async function downloadUploadedModel(modelId) {
  const model = findRenderableModel(modelId);
  if (!model?.modelUrl) {
    showFeedback(modelFeedback, "当前模型暂无可下载文件。", "error");
    return;
  }

  try {
    showFeedback(modelFeedback, "正在准备下载模型文件...", "success");
    const source = await resolveModelDownloadSource(model);
    if (source.source === "remote" && source.url) {
      const link = document.createElement("a");
      link.href = source.url;
      link.download = source.fileName || buildDownloadFileName(model, model.name || model.entryFile || "model");
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      showFeedback(modelFeedback, "模型下载已开始。", "success");
      return;
    }

    const downloadUrl = buildDownloadUrl(source.url || model.modelUrl);
    const response = await fetch(downloadUrl, { headers: isProtectedWorkAssetUrl(downloadUrl) ? getAuthHeaders() : {} });
    if (!response.ok) {
      const text = await response.text();
      let message = "模型下载失败。";
      try {
        message = JSON.parse(text).message || message;
      } catch {}
      throw new Error(message);
    }

    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = source.fileName || buildDownloadFileName(model, model.name || model.entryFile || "model");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    showFeedback(modelFeedback, "模型下载已开始。", "success");
  } catch (error) {
    showFeedback(modelFeedback, error.message || "模型下载失败。", "error");
  }
}

function buildModelParamsText(model) {
  const parts = [];
  if (model.source === "ai" || model.generatedTaskId) {
    parts.push("AI模型");
    if (model.mode) parts.push(model.mode === "image" ? "图片生成" : "文本生成");
    if (model.format) parts.push(String(model.format).toUpperCase());
    parts.push(formatBytes(model.fileSizeBytes));
    return parts.join(" · ");
  }
  if (model.providerName || model.provider) parts.push(model.providerName || model.provider);
  if (model.displayModelVersion) parts.push(model.displayModelVersion);
  if (model.mode) parts.push(model.mode === "image" ? "图片生成" : "文字生成");
  if (model.format) parts.push(String(model.format).toUpperCase());
  parts.push(formatBytes(model.fileSizeBytes));
  return parts.join(" · ");
}

function loadProtectedModelCovers() {
  const visibleUrls = new Set();
  modelList.querySelectorAll("[data-cover-url]").forEach((image) => {
    const url = image.dataset.coverUrl || "";
    if (!url) return;
    visibleUrls.add(url);
    const cachedUrl = modelCoverObjectUrls.get(url);
    if (cachedUrl) {
      image.src = cachedUrl;
      return;
    }

    fetch(url, { headers: getAuthHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error("Cover load failed.");
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        modelCoverObjectUrls.set(url, objectUrl);
        modelList.querySelectorAll(`[data-cover-url="${cssEscape(url)}"]`).forEach((target) => {
          target.src = objectUrl;
        });
      })
      .catch(() => {
        image.replaceWith(createModelCoverFallback());
      });
  });

  for (const [url, objectUrl] of modelCoverObjectUrls) {
    if (!visibleUrls.has(url)) {
      URL.revokeObjectURL(objectUrl);
      modelCoverObjectUrls.delete(url);
    }
  }
}

function isProtectedWorkAssetUrl(url) {
  return String(url || "").startsWith("/api/work/models/");
}

function createModelCoverFallback() {
  const element = document.createElement("span");
  element.className = "model-cube";
  return element;
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function renderCredits() {
  creditBalance.textContent = String(credits.balance || 0);
  generateCost.textContent = `${credits.costs?.generate || 0} / 次`;
  optimizeCost.textContent = `${credits.costs?.optimize || 0} / 次`;
  const query = normalizeSearchText(creditRecordSearch?.value || "");
  const allRecords = credits.records || [];
  const records = query
    ? allRecords.filter((record) => normalizeSearchText([
      formatCreditRecordTitle(record),
      record.type,
      record.amount,
      record.balance,
      record.note,
      formatTime(record.createdAt)
    ].join(" ")).includes(query))
    : allRecords;
  creditEmpty.textContent = allRecords.length && query ? "没有匹配的积分记录。" : "暂无积分记录。";
  const totalPages = Math.max(1, Math.ceil(records.length / CREDIT_PAGE_SIZE));
  creditPage = Math.min(Math.max(1, creditPage), totalPages);
  const start = (creditPage - 1) * CREDIT_PAGE_SIZE;
  const pageRecords = records.slice(start, start + CREDIT_PAGE_SIZE);
  creditEmpty.classList.toggle("hidden", records.length > 0);
  creditRecords.innerHTML = pageRecords.map((record) => {
    const plus = Number(record.amount) > 0;
    const reason = record.note || formatCreditRecordTitle(record);
    return `
      <article class="record-item">
        <div class="record-copy">
          <div class="record-line">
            <strong>${escapeHtml(formatCreditRecordTitle(record))}</strong>
            <span class="muted">${escapeHtml(formatTime(record.createdAt))}</span>
          </div>
          <div class="record-line muted">
            <span>余额 ${escapeHtml(record.balance)}</span>
            <span>${escapeHtml(reason)}</span>
          </div>
        </div>
        <span class="record-amount ${plus ? "plus" : "minus"}">${plus ? "+" : ""}${escapeHtml(record.amount)}</span>
      </article>
    `;
  }).join("");
  renderCreditPagination(records.length, totalPages);
}

function renderCreditPagination(total, totalPages) {
  if (!creditPagination) {
    return;
  }
  const shouldShow = total > CREDIT_PAGE_SIZE;
  creditPagination.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    creditPagination.innerHTML = "";
    return;
  }

  const start = (creditPage - 1) * CREDIT_PAGE_SIZE + 1;
  const end = Math.min(total, creditPage * CREDIT_PAGE_SIZE);
  creditPagination.innerHTML = `
    <span class="pagination-info">第 ${escapeHtml(creditPage)} / ${escapeHtml(totalPages)} 页，显示 ${escapeHtml(start)}-${escapeHtml(end)} 条，共 ${escapeHtml(total)} 条</span>
    <div class="pagination-actions">
      <button class="secondary-btn compact-btn" type="button" data-credit-page="${escapeAttribute(creditPage - 1)}"${creditPage <= 1 ? " disabled" : ""}>上一页</button>
      <button class="secondary-btn compact-btn" type="button" data-credit-page="${escapeAttribute(creditPage + 1)}"${creditPage >= totalPages ? " disabled" : ""}>下一页</button>
    </div>
  `;
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatCreditRecordTitle(record) {
  if (record?.title) return record.title;
  if (record?.type === "share_gift") return "分享赠送";
  if (record?.type === "share_cancel_deduct") return "取消分享扣分";
  return "积分记录";
}

function updateCreditsFromResponse(data) {
  if (!data?.credits) {
    return;
  }

  credits = data.credits;
  if (currentView === "credits") {
    renderCredits();
  }
}

function renderProfile() {
  if (!account) return;
  profileUsername.value = account.username || "";
  profileDisplayName.value = account.displayName || "";
}

async function saveProfile() {
  showFeedback(profileFeedback, "");
  try {
    const data = await fetchJson("/api/work/me", {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        username: profileUsername.value.trim(),
        displayName: profileDisplayName.value.trim()
      })
    });
    account = data.user;
    credits = data.credits || credits;
    storage = data.storage || storage;
    authSession.user = data.user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    renderUserMenu(account);
    renderStorage();
    showFeedback(profileFeedback, "账号信息已保存。", "success");
  } catch (error) {
    showFeedback(profileFeedback, error.message || "保存失败。", "error");
  }
}

async function savePassword() {
  showFeedback(passwordFeedback, "");
  try {
    await fetchJson("/api/work/me/password", {
      method: "PUT",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    });
    passwordForm.reset();
    showFeedback(passwordFeedback, "密码已修改。", "success");
  } catch (error) {
    showFeedback(passwordFeedback, error.message || "密码修改失败。", "error");
  }
}

async function logout() {
  const headers = getAuthHeaders();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  authSession = null;
  try {
    await fetchJson("/api/auth/logout", {
      method: "POST",
      headers
    });
  } catch {}
  window.location.href = "/model-preview.html";
}

function openUploadDialog() {
  showFeedback(uploadFeedback, "");
  if (!currentUploadController) {
    resetUploadProgress();
  }
  uploadDialog?.classList.remove("hidden");
  uploadFiles?.focus();
}

function closeUploadDialog(options = {}) {
  const shouldAbortUpload = options?.abortUpload !== false;
  if (shouldAbortUpload && currentUploadController) {
    uploadCancelledByUser = true;
    currentUploadController.abort();
  }
  uploadDialog?.classList.add("hidden");
  if (!uploadButton?.disabled) {
    showFeedback(uploadFeedback, "");
    resetUploadProgress();
  }
}

function updateUploadProgress(percent, label = "") {
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  uploadProgress?.classList.remove("hidden");
  if (uploadProgressLabel) {
    uploadProgressLabel.textContent = label || "上传进度";
  }
  if (uploadProgressValue) {
    uploadProgressValue.textContent = `${value}%`;
  }
  if (uploadProgressFill) {
    uploadProgressFill.style.width = `${value}%`;
  }
  if (uploadProgressTrack) {
    uploadProgressTrack.setAttribute("aria-valuenow", String(value));
  }
}

function resetUploadProgress() {
  uploadProgress?.classList.add("hidden");
  if (uploadProgressLabel) {
    uploadProgressLabel.textContent = "上传进度";
  }
  if (uploadProgressValue) {
    uploadProgressValue.textContent = "0%";
  }
  if (uploadProgressFill) {
    uploadProgressFill.style.width = "0";
  }
  if (uploadProgressTrack) {
    uploadProgressTrack.setAttribute("aria-valuenow", "0");
  }
}

function uploadFormDataWithProgress(url, form, { headers = {}, onRequest, onProgress, onProcessing } = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "text";
    Object.entries(headers || {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        onProgress?.(0, event);
        return;
      }
      onProgress?.((event.loaded / event.total) * 100, event);
      if (event.loaded >= event.total) {
        onProcessing?.();
      }
    });
    request.addEventListener("load", () => {
      const text = request.responseText || "";
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (request.status < 200 || request.status >= 300) {
        const error = new Error(data.message || "请求失败");
        error.status = request.status;
        error.data = data;
        reject(error);
        return;
      }
      resolve(data);
    });
    request.addEventListener("abort", () => {
      const error = new DOMException("Upload aborted.", "AbortError");
      reject(error);
    });
    request.addEventListener("error", () => reject(new Error("网络连接中断，模型文件上传失败。")));
    request.addEventListener("timeout", () => reject(new Error("模型文件上传超时，请稍后重试。")));
    request.timeout = 15 * 60 * 1000;
    onRequest?.(request);
    request.send(form);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data.message || "请求失败");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function getAuthHeaders() {
  return authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {};
}

function renderUserMenu(user) {
  const displayName = user?.displayName || user?.username || "用户";
  if (workUserAvatar) {
    workUserAvatar.textContent = getUserInitial(displayName);
  }
  if (workUserDisplayName) {
    workUserDisplayName.textContent = displayName;
  }
  if (workUserRoleText) {
    workUserRoleText.textContent = user?.roleText || (user?.role === "admin" ? "管理员" : "普通用户");
  }
  if (workUserCreditText) {
    workUserCreditText.textContent = `积分 ${formatNumber(user?.credits || credits.balance || 0)}`;
  }
  workAdminEntryLink?.classList.toggle("hidden", user?.role !== "admin");
}

function getUserInitial(name) {
  const text = String(name || "U").trim();
  return text ? text.slice(0, 1).toUpperCase() : "U";
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("zh-CN").format(number) : "0";
}

function parseStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function showFeedback(element, message, type = "success") {
  element.textContent = message;
  element.className = message ? `feedback ${type}` : "feedback hidden";
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { hour12: false });
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let next = value;
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next >= 10 || unitIndex === 0 ? next.toFixed(0) : next.toFixed(1)} ${units[unitIndex]}`;
}

function stripFileExtension(fileName) {
  return String(fileName || "").replace(/\.[^.]+$/, "");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text);
}
