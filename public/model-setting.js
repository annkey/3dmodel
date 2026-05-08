import { applySiteBranding, normalizeSiteSettings } from "/site-brand.js";

const form = document.getElementById("generator-settings-form");
const providerSelect = document.getElementById("settings-provider");
const modelVersionSelect = document.getElementById("settings-model-version");
const runtimeNote = document.getElementById("settings-runtime-note");
const feedback = document.getElementById("settings-feedback");
const saveButton = document.getElementById("save-settings");
const siteForm = document.getElementById("site-settings-form");
const siteLogoPreview = document.getElementById("site-logo-preview");
const siteLogoFile = document.getElementById("site-logo-file");
const siteLogoFileText = document.getElementById("site-logo-file-text");
const siteKeywordsInput = document.getElementById("site-keywords");
const siteDescriptionInput = document.getElementById("site-description");
const siteFeedback = document.getElementById("site-settings-feedback");
const saveSiteButton = document.getElementById("save-site-settings");
const navItems = Array.from(document.querySelectorAll("[data-view]"));
const views = {
  settings: document.getElementById("settings-view"),
  assets: document.getElementById("assets-view"),
  users: document.getElementById("users-view"),
  credits: document.getElementById("credits-view")
};
const viewTitle = document.getElementById("view-title");
const viewDescription = document.getElementById("view-description");
const providerFilter = document.getElementById("provider-filter");
const searchWrap = document.getElementById("admin-search-wrap");
const searchInput = document.getElementById("admin-search");
const refreshButton = document.getElementById("refresh-view");
const createUserButton = document.getElementById("create-user");
const createCreditButton = document.getElementById("create-credit");
const assetTotal = document.getElementById("asset-total");
const assetTableBody = document.getElementById("asset-table-body");
const assetEmpty = document.getElementById("asset-empty");
const assetPagination = document.getElementById("asset-pagination");
const userTotal = document.getElementById("user-total");
const userTableBody = document.getElementById("user-table-body");
const userEmpty = document.getElementById("user-empty");
const userPagination = document.getElementById("user-pagination");
const creditTotal = document.getElementById("credit-total");
const creditTableBody = document.getElementById("credit-table-body");
const creditEmpty = document.getElementById("credit-empty");
const creditPagination = document.getElementById("credit-pagination");
const userDialog = document.getElementById("user-dialog");
const userForm = document.getElementById("user-form");
const userDialogTitle = document.getElementById("user-dialog-title");
const userIdInput = document.getElementById("user-id");
const userUsernameInput = document.getElementById("user-username");
const userDisplayNameInput = document.getElementById("user-display-name");
const userRoleSelect = document.getElementById("user-role");
const userModelStorageQuotaInput = document.getElementById("user-model-storage-quota");
const userPasswordInput = document.getElementById("user-password");
const userDisabledInput = document.getElementById("user-disabled");
const userFeedback = document.getElementById("user-feedback");
const saveUserButton = document.getElementById("save-user");
const closeUserDialogButton = document.getElementById("close-user-dialog");
const cancelUserButton = document.getElementById("cancel-user");
const creditDialog = document.getElementById("credit-dialog");
const creditForm = document.getElementById("credit-form");
const creditUserSelect = document.getElementById("credit-user");
const creditSelectedUser = document.getElementById("credit-selected-user");
const creditUserSearch = document.getElementById("credit-user-search");
const creditUserOptions = document.getElementById("credit-user-options");
const creditTypeSelect = document.getElementById("credit-type");
const creditAmountInput = document.getElementById("credit-amount");
const creditNoteInput = document.getElementById("credit-note");
const creditFeedback = document.getElementById("credit-feedback");
const saveCreditButton = document.getElementById("save-credit");
const closeCreditDialogButton = document.getElementById("close-credit-dialog");
const cancelCreditButton = document.getElementById("cancel-credit");
const adminUserMenu = document.querySelector(".topbar-user");
const adminUserMenuTrigger = document.getElementById("admin-user-menu-trigger");
const adminUserMenuPanel = document.getElementById("admin-user-menu-panel");
const adminUserAvatar = document.querySelector(".topbar-user .user-avatar");
const adminUserName = document.querySelector(".topbar-user .user-name");
const adminUserRole = document.getElementById("admin-user-role");
const adminUserCreditText = document.getElementById("admin-user-credit-text");
const adminLogoutButton = document.getElementById("admin-logout");
const AUTH_STORAGE_KEY = "kmax-model-preview-auth";
const ASSET_PAGE_SIZE = 20;
const USER_PAGE_SIZE = 20;
const CREDIT_PAGE_SIZE = 20;

const viewMeta = {
  settings: {
    title: "平台配置",
    description: "统一管理 3D 模型生成平台和公共模型版本。"
  },
  assets: {
    title: "模型管理",
    description: "查看模型生成任务列表，并下载已生成的模型资源。"
  },
  users: {
    title: "用户管理",
    description: "维护后台用户账号、角色和启用状态。"
  }
};

viewMeta.credits = {
  title: "积分管理",
  description: "查看用户积分记录，并给指定用户手动新增或扣除积分。"
};

let apiConfig = null;
let currentView = "settings";
let assetRows = [];
let userRows = [];
let creditRows = [];
let creditUsers = [];
let currentAdminUser = null;
let creditDialogFixedUserId = "";
let pendingSiteLogoFile = null;
let assetPage = 1;
let userPage = 1;
let creditPage = 1;

bootstrap();
void applySiteBranding();

async function bootstrap() {
  bindEvents();
  await ensureAdminSession();

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

  siteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSiteSettings();
  });

  siteLogoFile.addEventListener("change", () => {
    const file = siteLogoFile.files?.[0];
    pendingSiteLogoFile = file || null;
    if (file) {
      siteLogoPreview.src = URL.createObjectURL(file);
      siteLogoFileText.textContent = file.name;
    } else {
      siteLogoFileText.textContent = "未选择任何文件";
    }
    hideSiteFeedback();
  });

  navItems.forEach((button) => {
    button.addEventListener("click", () => {
      switchView(button.dataset.view || "settings");
    });
  });

  providerFilter.addEventListener("change", () => {
    if (currentView === "assets") {
      assetPage = 1;
      renderAssets();
    }
  });

  searchInput.addEventListener("input", () => {
    if (currentView === "assets") {
      assetPage = 1;
      renderAssets();
    } else if (currentView === "users") {
      userPage = 1;
      renderUsers();
    } else if (currentView === "credits") {
      creditPage = 1;
      renderCredits();
    }
  });

  refreshButton.addEventListener("click", () => {
    void refreshCurrentView();
  });

  createUserButton.addEventListener("click", () => {
    openUserDialog();
  });

  createCreditButton.addEventListener("click", () => {
    void openCreditDialogV2();
  });
  assetPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-page]");
    if (!button || button.disabled) {
      return;
    }
    assetPage = Number(button.dataset.assetPage || 1);
    renderAssets();
  });

  adminUserMenuTrigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    adminUserMenuPanel?.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!adminUserMenu?.contains(event.target)) {
      adminUserMenuPanel?.classList.add("hidden");
    }
  });

  adminLogoutButton?.addEventListener("click", async (event) => {
    event.stopPropagation();
    await logoutAdmin();
  });

  userTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-action]");
    if (!button) {
      return;
    }
    const user = userRows.find((item) => item.id === button.dataset.userId);
    if (!user) {
      return;
    }
    handleUserAction(button.dataset.userAction, user);
  });
  userPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-page]");
    if (!button || button.disabled) {
      return;
    }
    userPage = Number(button.dataset.userPage || 1);
    renderUsers();
  });

  userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveUser();
  });

  closeUserDialogButton.addEventListener("click", closeUserDialog);
  cancelUserButton.addEventListener("click", closeUserDialog);
  userDialog.addEventListener("click", (event) => {
    if (event.target === userDialog) {
      closeUserDialog();
    }
  });

  creditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCreditRecord();
  });
  creditUserSearch?.addEventListener("input", handleCreditUserSearchInput);
  creditUserOptions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-credit-user-id]");
    if (option) {
      selectCreditUser(option.dataset.creditUserId);
    }
  });
  creditTypeSelect?.addEventListener("change", syncCreditAmountHint);
  closeCreditDialogButton.addEventListener("click", closeCreditDialog);
  cancelCreditButton.addEventListener("click", closeCreditDialog);
  creditDialog.addEventListener("click", (event) => {
    if (event.target === creditDialog) {
      closeCreditDialog();
    }
  });
  creditPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-credit-page]");
    if (!button || button.disabled) {
      return;
    }
    creditPage = Number(button.dataset.creditPage || 1);
    renderCredits();
  });
}

async function switchView(viewName) {
  currentView = views[viewName] ? viewName : "settings";

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === currentView);
  });

  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== currentView);
  });

  viewTitle.textContent = viewMeta[currentView].title;
  viewDescription.textContent = viewMeta[currentView].description;
  const listView = currentView !== "settings";
  providerFilter.classList.toggle("hidden", currentView !== "assets");
  searchWrap.classList.toggle("hidden", !listView);
  refreshButton.classList.toggle("hidden", !listView);
  createUserButton.classList.toggle("hidden", currentView !== "users");
  createCreditButton.classList.toggle("hidden", currentView !== "credits");
  searchInput.value = "";
  if (currentView === "assets") {
    assetPage = 1;
  }
  if (currentView === "users") {
    userPage = 1;
  }
  if (currentView === "credits") {
    creditPage = 1;
  }

  await refreshCurrentView();
}

async function refreshCurrentView() {
  if (currentView === "assets") {
    await refreshAssets();
  } else if (currentView === "users") {
    await refreshUsers();
  } else if (currentView === "credits") {
    await refreshCredits();
  }
}

async function refreshConfig() {
  apiConfig = await fetchJson("/api/config");
  renderProviderOptions();
  syncModelVersionOptions();
  renderSiteSettings();
  updateRuntimeNote();
}

async function ensureAdminSession() {
  const session = parseStoredJson(AUTH_STORAGE_KEY, null);
  if (!session?.token) {
    window.location.href = "/model-preview.html";
    throw new Error("Login required");
  }

  try {
    const data = await fetchJson("/api/auth/session");
    if (data.user?.role !== "admin") {
      window.location.href = "/model-preview.html";
      throw new Error("Admin required");
    }
    currentAdminUser = data.user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      token: data.token || session.token,
      expiresAt: data.expiresAt || session.expiresAt,
      user: data.user
    }));
    renderAdminUser();
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = "/model-preview.html";
    throw error;
  }
}

async function refreshAssets() {
  assetTableBody.innerHTML = renderLoadingRow(6, "正在读取资源列表...");
  assetEmpty.classList.add("hidden");
  assetPagination?.classList.add("hidden");

  try {
    const data = await fetchJson("/api/admin/assets");
    assetRows = data.tasks || [];
    renderAssets();
  } catch (error) {
    assetRows = [];
    assetPagination?.classList.add("hidden");
    assetTableBody.innerHTML = renderMessageRow(6, error.message || "资源列表读取失败");
  }
}

async function refreshUsers() {
  userTableBody.innerHTML = renderLoadingRow(6, "正在读取用户列表...");
  userEmpty.classList.add("hidden");
  userPagination?.classList.add("hidden");

  try {
    const data = await fetchJson("/api/admin/users");
    userRows = data.users || [];
    renderUsers();
  } catch (error) {
    userRows = [];
    userPagination?.classList.add("hidden");
    userTableBody.innerHTML = renderMessageRow(6, error.message || "用户列表读取失败");
  }
}

async function refreshCredits() {
  creditTableBody.innerHTML = renderLoadingRow(5, "正在读取积分记录...");
  creditEmpty.classList.add("hidden");
  creditPagination?.classList.add("hidden");

  try {
    const data = await fetchJson("/api/admin/credits");
    creditRows = data.records || [];
    creditUsers = data.users || [];
    if (!creditUsers.length) {
      await refreshCreditUsersFallback();
    }
    renderCredits();
  } catch (error) {
    creditRows = [];
    await refreshCreditUsersFallback();
    creditPagination?.classList.add("hidden");
    creditTableBody.innerHTML = renderMessageRow(5, error.message || "积分记录读取失败");
  }
}

async function refreshCreditUsersFallback() {
  try {
    const data = await fetchJson("/api/admin/users");
    creditUsers = (data.users || []).map((user) => ({
      ...user,
      credits: Number(user.credits || 0)
    }));
  } catch {
    creditUsers = [];
  }
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

  runtimeNote.textContent = `当前将统一使用 ${providerConfig.name} / ${modelVersionSelect.value} 生成模型。保存后，播放器中的新生成任务会按这份公共配置提交。`;
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
    showFeedback("公共生成配置已保存，模型播放器后续提交会自动使用这份配置。", "success");
  } catch (error) {
    showFeedback(error.message || "保存失败", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "保存公共配置";
  }
}

async function saveSiteSettings() {
  hideSiteFeedback();
  saveSiteButton.disabled = true;
  saveSiteButton.textContent = "保存中...";

  try {
    const logoFile = pendingSiteLogoFile || siteLogoFile.files?.[0] || null;
    const payload = getSiteSettingsPayload();
    let requestOptions = null;

    if (logoFile) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        formData.set(key, value);
      });
      formData.append("logo", logoFile, logoFile.name);
      requestOptions = {
        method: "POST",
        body: formData
      };
    } else {
      requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
    }

    apiConfig = await fetchJson("/api/site-settings", {
      ...requestOptions
    });
    apiConfig.siteSettings = normalizeSiteSettings(apiConfig.siteSettings);

    renderSiteSettings();
    await applySiteBranding(apiConfig.siteSettings);
    showSiteFeedback("平台品牌与 TDK 配置已保存。", "success");
  } catch (error) {
    showSiteFeedback(error.message || "品牌配置保存失败", "error");
  } finally {
    saveSiteButton.disabled = false;
    saveSiteButton.textContent = "保存品牌配置";
  }
}

function getSiteSettingsPayload() {
  return {
    keywords: siteKeywordsInput.value.trim(),
    description: siteDescriptionInput.value.trim()
  };
}

function renderSiteSettings() {
  const settings = normalizeSiteSettings(apiConfig?.siteSettings || {});
  siteLogoPreview.src = settings.logoUrl || "/assets/kmax-logo.png";
  siteKeywordsInput.value = settings.keywords || "";
  siteDescriptionInput.value = settings.description || "";
  siteLogoFile.value = "";
  siteLogoFileText.textContent = "未选择任何文件";
  pendingSiteLogoFile = null;
}

function renderAssets() {
  const keyword = searchInput.value.trim().toLowerCase();
  const provider = providerFilter.value;
  const rows = assetRows.filter((task) => {
    const matchesProvider = provider === "all" || normalizeProvider(task.provider) === provider;
    const text = [
      task.taskId,
      task.prompt,
      task.providerName,
      task.statusText,
      task.displayModelVersion
    ].join(" ").toLowerCase();
    return matchesProvider && (!keyword || text.includes(keyword));
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / ASSET_PAGE_SIZE));
  assetPage = Math.min(Math.max(1, assetPage), totalPages);
  const start = (assetPage - 1) * ASSET_PAGE_SIZE;
  const pageRows = rows.slice(start, start + ASSET_PAGE_SIZE);
  assetTotal.textContent = String(rows.length);
  assetEmpty.classList.toggle("hidden", rows.length > 0);
  assetTableBody.innerHTML = pageRows.map(renderAssetRow).join("");
  renderAssetPagination(rows.length, totalPages);
}

function renderAssetPagination(total, totalPages) {
  if (!assetPagination) {
    return;
  }
  const shouldShow = total > ASSET_PAGE_SIZE;
  assetPagination.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    assetPagination.innerHTML = "";
    return;
  }

  const start = (assetPage - 1) * ASSET_PAGE_SIZE + 1;
  const end = Math.min(total, assetPage * ASSET_PAGE_SIZE);
  assetPagination.innerHTML = `
    <span class="pagination-info">第 ${escapeHtml(assetPage)} / ${escapeHtml(totalPages)} 页，显示 ${escapeHtml(start)}-${escapeHtml(end)} 条，共 ${escapeHtml(total)} 条</span>
    <div class="pagination-actions">
      <button class="secondary-btn compact-btn" type="button" data-asset-page="${escapeAttribute(assetPage - 1)}"${assetPage <= 1 ? " disabled" : ""}>上一页</button>
      <button class="secondary-btn compact-btn" type="button" data-asset-page="${escapeAttribute(assetPage + 1)}"${assetPage >= totalPages ? " disabled" : ""}>下一页</button>
    </div>
  `;
}

function renderAssetRow(task) {
  const downloads = normalizeDownloadItems(task)
    .map((item) => `<a class="download-link" href="${escapeAttribute(buildAssetProxyUrl(item.url))}" download>${escapeHtml(item.label || "下载")}</a>`)
    .join("");

  return `
    <tr>
      <td>
        <div class="cell-main">
          <strong>${escapeHtml(task.prompt || "未命名模型")}</strong>
          <small>任务 ID：${escapeHtml(task.taskId || task.id || "-")}</small>
          <small>版本：${escapeHtml(task.displayModelVersion || "-")}</small>
        </div>
      </td>
      <td>${escapeHtml(task.providerName || task.provider || "-")}</td>
      <td><span class="status-pill ${getStatusClass(task.status)}">${escapeHtml(formatStatus(task.statusText || task.status))}</span></td>
      <td>${Number(task.progress || 0)}%</td>
      <td>${escapeHtml(formatTime(task.updatedAt))}</td>
      <td><div class="download-actions">${downloads || "<span class=\"muted\">暂无下载</span>"}</div></td>
    </tr>
  `;
}

function renderUsers() {
  const keyword = searchInput.value.trim().toLowerCase();
  const rows = userRows.filter((user) => {
    const text = [
      user.username,
      user.displayName,
      user.roleText,
      user.statusText
    ].join(" ").toLowerCase();
    return !keyword || text.includes(keyword);
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / USER_PAGE_SIZE));
  userPage = Math.min(Math.max(1, userPage), totalPages);
  const start = (userPage - 1) * USER_PAGE_SIZE;
  const pageRows = rows.slice(start, start + USER_PAGE_SIZE);
  userTotal.textContent = String(rows.length);
  userEmpty.classList.toggle("hidden", rows.length > 0);
  userTableBody.innerHTML = pageRows.map(renderUserRow).join("");
  renderUserPagination(rows.length, totalPages);
}

function renderUserPagination(total, totalPages) {
  if (!userPagination) {
    return;
  }
  const shouldShow = total > USER_PAGE_SIZE;
  userPagination.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    userPagination.innerHTML = "";
    return;
  }

  const start = (userPage - 1) * USER_PAGE_SIZE + 1;
  const end = Math.min(total, userPage * USER_PAGE_SIZE);
  userPagination.innerHTML = `
    <span class="pagination-info">第 ${escapeHtml(userPage)} / ${escapeHtml(totalPages)} 页，显示 ${escapeHtml(start)}-${escapeHtml(end)} 条，共 ${escapeHtml(total)} 条</span>
    <div class="pagination-actions">
      <button class="secondary-btn compact-btn" type="button" data-user-page="${escapeAttribute(userPage - 1)}"${userPage <= 1 ? " disabled" : ""}>上一页</button>
      <button class="secondary-btn compact-btn" type="button" data-user-page="${escapeAttribute(userPage + 1)}"${userPage >= totalPages ? " disabled" : ""}>下一页</button>
    </div>
  `;
}

function renderCredits() {
  const keyword = searchInput.value.trim().toLowerCase();
  const rows = creditRows.filter((record) => {
    const user = record.user || {};
    const text = [
      user.username,
      user.displayName,
      record.title,
      record.note,
      record.amount,
      record.balance
    ].join(" ").toLowerCase();
    return !keyword || text.includes(keyword);
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / CREDIT_PAGE_SIZE));
  creditPage = Math.min(Math.max(1, creditPage), totalPages);
  const start = (creditPage - 1) * CREDIT_PAGE_SIZE;
  const pageRows = rows.slice(start, start + CREDIT_PAGE_SIZE);
  creditTotal.textContent = String(rows.length);
  creditEmpty.classList.toggle("hidden", rows.length > 0);
  creditTableBody.innerHTML = pageRows.map(renderCreditRow).join("");
  renderCreditPagination(rows.length, totalPages);
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

function renderCreditRow(record) {
  const user = record.user || {};
  const amount = Number(record.amount || 0);
  return `
    <tr>
      <td>
        <div class="cell-main">
          <strong>${escapeHtml(user.displayName || user.username || record.userId)}</strong>
          <small>${escapeHtml(user.username || record.userId)}</small>
        </div>
      </td>
      <td><span class="status-pill ${amount >= 0 ? "success" : "failed"}">${amount >= 0 ? "+" : ""}${escapeHtml(amount)}</span></td>
      <td>${escapeHtml(record.balance)}</td>
      <td>
        <div class="cell-main">
          <strong>${escapeHtml(formatCreditRecordTitle(record))}</strong>
          <small>${escapeHtml(record.note || "-")}</small>
        </div>
      </td>
      <td>${escapeHtml(formatTime(record.createdAt))}</td>
    </tr>
  `;
}

function formatCreditRecordTitle(record) {
  if (record?.title) return record.title;
  if (record?.type === "share_gift") return "分享赠送";
  if (record?.type === "share_cancel_deduct") return "取消分享扣分";
  return "积分记录";
}

function renderUserRow(user) {
  return `
    <tr>
      <td>
        <div class="cell-main">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <small>${escapeHtml(user.username)}</small>
          <small>${user.hasPassword ? "已设置密码" : "未设置密码"}</small>
        </div>
      </td>
      <td><span class="status-pill">${escapeHtml(user.roleText || formatRole(user.role))}</span></td>
      <td>
        <div class="cell-main">
          <strong>${escapeHtml(formatBytes(user.modelStorage?.usedBytes || 0))} / ${escapeHtml(formatBytes(user.modelStorageQuotaBytes || 0))}</strong>
          <small>可在用户编辑中调整</small>
        </div>
      </td>
      <td><span class="status-pill ${user.disabled ? "failed" : "success"}">${escapeHtml(user.statusText || (user.disabled ? "已禁用" : "已启用"))}</span></td>
      <td>${escapeHtml(formatTime(user.updatedAt))}</td>
      <td>
        <div class="row-actions">
          <button class="text-btn" type="button" data-user-action="edit" data-user-id="${escapeAttribute(user.id)}">修改</button>
          <button class="text-btn" type="button" data-user-action="toggle" data-user-id="${escapeAttribute(user.id)}">${user.disabled ? "启用" : "禁用"}</button>
          <button class="danger-btn" type="button" data-user-action="delete" data-user-id="${escapeAttribute(user.id)}">删除</button>
        </div>
      </td>
    </tr>
  `;
}

function openUserDialog(user = null) {
  userDialogTitle.textContent = user ? "修改用户" : "新增用户";
  userIdInput.value = user?.id || "";
  userUsernameInput.value = user?.username || "";
  userDisplayNameInput.value = user?.displayName || "";
  userRoleSelect.value = user?.role || "user";
  userModelStorageQuotaInput.value = user?.modelStorageQuotaGb || 10;
  userPasswordInput.value = "";
  userPasswordInput.required = !user;
  userDisabledInput.checked = Boolean(user?.disabled);
  hideUserFeedback();
  userDialog.classList.remove("hidden");
  userUsernameInput.focus();
}

function closeUserDialog() {
  userDialog.classList.add("hidden");
  userForm.reset();
  userIdInput.value = "";
  hideUserFeedback();
}

function closeCreditDialog() {
  creditDialog.classList.add("hidden");
  creditForm.reset();
  creditDialogFixedUserId = "";
  hideCreditFeedback();
}

async function openCreditDialogV2(preselectUserId = "") {
  await refreshCredits();

  creditForm.reset();
  creditDialogFixedUserId = preselectUserId || "";
  renderCreditUserSelectOptions();

  if (!creditUsers.length) {
    showCreditFeedback("暂无可调整积分的用户，请先在用户管理中创建用户。", "error");
    creditDialog.classList.remove("hidden");
    return;
  }

  creditUserSelect.value = "";
  renderSelectedCreditUser(null);
  syncCreditUserPicker();
  if (preselectUserId) {
    selectCreditUser(preselectUserId);
  } else if (creditUserSearch) {
    creditUserSearch.value = "";
    hideCreditUserOptions();
  }
  syncCreditAmountHint();
  hideCreditFeedback();
  creditDialog.classList.remove("hidden");
  (creditDialogFixedUserId ? creditAmountInput : creditUserSearch)?.focus();
}

function renderCreditUserSelectOptions() {
  creditUserSelect.innerHTML = creditUsers.map((user) => {
    const label = `${user.displayName || user.username}（余额 ${user.credits || 0}）`;
    return `<option value="${escapeAttribute(user.id)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function syncCreditUserPicker() {
  const selectedUser = getCreditUserById(creditUserSelect.value);
  renderSelectedCreditUser(null);

  if (creditDialogFixedUserId && selectedUser) {
    creditUserSearch.classList.add("hidden");
    hideCreditUserOptions();
    return;
  }

  creditUserSearch.classList.remove("hidden");
  if (creditUserSearch.value.trim()) {
    renderCreditUserOptions();
  } else {
    hideCreditUserOptions();
  }
}

function handleCreditUserSearchInput() {
  const keyword = creditUserSearch.value.trim().toLowerCase();
  creditUserSelect.value = "";
  renderSelectedCreditUser(null);
  if (!keyword) {
    hideCreditUserOptions();
    return;
  }
  renderCreditUserOptions();
}

function renderSelectedCreditUser(user) {
  if (!user) {
    creditSelectedUser.classList.add("hidden");
    creditSelectedUser.innerHTML = "";
    return;
  }

  creditSelectedUser.classList.remove("hidden");
  creditSelectedUser.innerHTML = `
    <strong>${escapeHtml(user.displayName || user.username)}</strong>
    <span>${escapeHtml(user.username)} · 当前积分 ${escapeHtml(user.credits || 0)}</span>
  `;
}

function renderCreditUserOptions() {
  if (!creditUserOptions) {
    return;
  }
  const keyword = creditUserSearch.value.trim().toLowerCase();
  if (!keyword) {
    hideCreditUserOptions();
    return;
  }
  const users = getMatchingCreditUsers(keyword).slice(0, 30);
  creditUserOptions.classList.remove("hidden");

  creditUserOptions.innerHTML = users.length ? users.map((user) => `
    <button class="credit-user-option ${user.id === creditUserSelect.value ? "active" : ""}" type="button" data-credit-user-id="${escapeAttribute(user.id)}">
      <span>${escapeHtml(user.displayName || user.username)}</span>
      <small>${escapeHtml(user.username)} · 积分 ${escapeHtml(user.credits || 0)}</small>
    </button>
  `).join("") : `<div class="credit-user-empty">没有匹配的用户</div>`;
}

function getMatchingCreditUsers(keyword) {
  if (!keyword) {
    return creditUsers;
  }
  return creditUsers.filter((user) => {
    const text = [user.id, user.username, user.displayName, user.roleText].join(" ").toLowerCase();
    return text.includes(keyword);
  });
}

function hideCreditUserOptions() {
  if (!creditUserOptions) {
    return;
  }
  creditUserOptions.classList.add("hidden");
  creditUserOptions.innerHTML = "";
}

function selectCreditUser(userId) {
  const user = getCreditUserById(userId);
  if (!user) {
    return;
  }
  creditUserSelect.value = user.id;
  if (creditUserSearch) {
    creditUserSearch.value = user.displayName || user.username || "";
  }
  renderSelectedCreditUser(null);
  hideCreditUserOptions();
}

function getCreditUserById(userId) {
  return creditUsers.find((user) => user.id === userId) || null;
}

function syncCreditAmountHint() {
  if (!creditTypeSelect || !creditAmountInput) {
    return;
  }
  if (creditTypeSelect.value === "manual_deduct") {
    creditAmountInput.placeholder = "请输入扣除积分，例如 10";
  } else {
    creditAmountInput.placeholder = "请输入赠送积分，例如 50";
  }
}

async function handleUserAction(action, user) {
  if (action === "edit") {
    openUserDialog(user);
    return;
  }

  if (action === "toggle") {
    await updateUser(user.id, { disabled: !user.disabled });
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`确认删除用户“${user.displayName || user.username}”？`)) {
      return;
    }
    try {
      await fetchJson(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE"
      });
      await refreshUsers();
    } catch (error) {
      window.alert(error.message || "删除失败");
    }
  }
}

async function saveUser() {
  const userId = userIdInput.value;
  const payload = {
    username: userUsernameInput.value.trim(),
    displayName: userDisplayNameInput.value.trim(),
    role: userRoleSelect.value,
    modelStorageQuotaGb: Number(userModelStorageQuotaInput.value || 10),
    disabled: userDisabledInput.checked
  };

  if (userPasswordInput.value) {
    payload.password = userPasswordInput.value;
  }

  saveUserButton.disabled = true;
  saveUserButton.textContent = "保存中...";
  hideUserFeedback();

  try {
    const url = userId ? `/api/admin/users/${encodeURIComponent(userId)}` : "/api/admin/users";
    const method = userId ? "PUT" : "POST";
    await fetchJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    closeUserDialog();
    await refreshUsers();
  } catch (error) {
    showUserFeedback(error.message || "保存失败", "error");
  } finally {
    saveUserButton.disabled = false;
    saveUserButton.textContent = "保存";
  }
}

async function saveCreditRecord() {
  saveCreditButton.disabled = true;
  saveCreditButton.textContent = "保存中...";
  hideCreditFeedback();

  try {
    const rawAmount = Math.abs(Number(creditAmountInput.value));
    const amount = creditTypeSelect.value === "manual_deduct" ? -rawAmount : rawAmount;
    if (!getCreditUserById(creditUserSelect.value)) {
      throw new Error("请先搜索并选择要调整积分的用户。");
    }
    await fetchJson("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: creditUserSelect.value,
        amount,
        type: creditTypeSelect.value,
        note: creditNoteInput.value.trim()
      })
    });
    closeCreditDialog();
    await refreshCredits();
  } catch (error) {
    showCreditFeedback(error.message || "积分记录保存失败", "error");
  } finally {
    saveCreditButton.disabled = false;
    saveCreditButton.textContent = "保存";
  }
}

async function updateUser(id, payload) {
  try {
    await fetchJson(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refreshUsers();
  } catch (error) {
    window.alert(error.message || "操作失败");
  }
}

async function logoutAdmin() {
  try {
    await fetchJson("/api/auth/logout", { method: "POST" });
  } catch {
    // Local logout should still clear the browser session.
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.location.href = "/model-preview.html";
}

function renderAdminUser() {
  const displayName = currentAdminUser?.displayName || currentAdminUser?.username || "admin";
  if (adminUserAvatar) {
    adminUserAvatar.textContent = getUserInitial(displayName);
  }
  if (adminUserName) {
    adminUserName.textContent = displayName;
  }
  if (adminUserRole) {
    adminUserRole.textContent = currentAdminUser?.roleText || "管理员";
  }
  if (adminUserCreditText) {
    adminUserCreditText.textContent = `积分 ${formatNumber(currentAdminUser?.credits || 0)}`;
  }
}

function normalizeDownloadItems(task) {
  const items = Array.isArray(task.downloadItems) ? [...task.downloadItems] : [];
  if (task.preferredModelUrl && !items.some((item) => item.url === task.preferredModelUrl)) {
    items.unshift({ label: "下载模型", url: task.preferredModelUrl });
  }
  return items.filter((item) => item.url);
}

async function fetchJson(url, options) {
  const headers = {
    ...getAuthHeaders(),
    ...(options?.headers || {})
  };
  const response = await fetch(url, {
    ...(options || {}),
    headers
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/model-preview.html";
    }
    throw new Error(data.message || "请求失败");
  }

  return data;
}

function getAuthHeaders() {
  const session = parseStoredJson(AUTH_STORAGE_KEY, null);
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

function parseStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function renderLoadingRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(message)}</td></tr>`;
}

function renderMessageRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(message)}</td></tr>`;
}

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

function hideFeedback() {
  feedback.textContent = "";
  feedback.className = "feedback hidden";
}

function showSiteFeedback(message, type) {
  siteFeedback.textContent = message;
  siteFeedback.className = `feedback ${type}`;
}

function hideSiteFeedback() {
  siteFeedback.textContent = "";
  siteFeedback.className = "feedback hidden";
}

function showUserFeedback(message, type) {
  userFeedback.textContent = message;
  userFeedback.className = `feedback ${type}`;
}

function hideUserFeedback() {
  userFeedback.textContent = "";
  userFeedback.className = "feedback hidden";
}

function showCreditFeedback(message, type) {
  creditFeedback.textContent = message;
  creditFeedback.className = `feedback ${type}`;
}

function hideCreditFeedback() {
  creditFeedback.textContent = "";
  creditFeedback.className = "feedback hidden";
}

function normalizeProvider(value) {
  return String(value || "tripo").toLowerCase() === "meshy" ? "meshy" : "tripo";
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "success") return "success";
  if (["failed", "banned", "expired", "cancelled", "unknown"].includes(value)) return "failed";
  return "running";
}

function formatStatus(status) {
  const map = {
    queued: "排队中",
    running: "生成中",
    success: "已完成",
    failed: "失败",
    cancelled: "已取消",
    expired: "已过期",
    banned: "被拦截",
    unknown: "未知"
  };
  return map[String(status || "").toLowerCase()] || status || "-";
}

function formatRole(role) {
  return role === "admin" ? "管理员" : "普通用户";
}

function getUserInitial(name) {
  const value = String(name || "").trim();
  return value ? value.slice(0, 1).toUpperCase() : "A";
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("zh-CN").format(number) : "0";
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatSize(size) {
  const width = Number(size?.width || 0);
  const height = Number(size?.height || 0);
  return width && height ? `${width} × ${height}` : "-";
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

function getBrowserLabel(userAgent) {
  const text = String(userAgent || "");
  if (text.includes("Edg/")) return "Microsoft Edge";
  if (text.includes("Chrome/")) return "Chrome";
  if (text.includes("Firefox/")) return "Firefox";
  if (text.includes("Safari/")) return "Safari";
  return "未知浏览器";
}

function buildAssetProxyUrl(url) {
  return `/api/asset?url=${encodeURIComponent(url)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text);
}
