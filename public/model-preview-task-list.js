const DEFAULT_MODEL_COVER_URL = "/assets/default-model-cover.svg";

export function sortGeneratedTaskRecords(tasks) {
  return [...tasks].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
    return rightTime - leftTime;
  });
}

export function loadStoredGeneratedTasks({ storageKey, parseStoredJson }) {
  return sortGeneratedTaskRecords(parseStoredJson(storageKey, []));
}

export function saveStoredGeneratedTasks({ storageKey, tasks, limit }) {
  const sortedTasks = sortGeneratedTaskRecords(tasks);
  localStorage.setItem(storageKey, JSON.stringify(sortedTasks.slice(0, limit)));
  return sortedTasks;
}

export function upsertGeneratedTaskRecord(tasks, task) {
  const nextTasks = [...tasks];
  const existingIndex = nextTasks.findIndex((item) => item.id === task.id);
  const nextTask = {
    ...(existingIndex >= 0 ? nextTasks[existingIndex] : {}),
    ...task
  };

  if (existingIndex >= 0) {
    nextTasks.splice(existingIndex, 1, nextTask);
  } else {
    nextTasks.unshift(nextTask);
  }

  return {
    tasks: nextTasks,
    task: nextTask
  };
}

function renderGeneratedTaskMarkup(task, options) {
  const {
    activePlaybackLoadingTaskId,
    escapeHtml,
    formatBytes,
    formatStatus,
    formatTimeLabel,
    getDisplayProgress,
    getTaskStageLabel,
    resolvePlayableModel
  } = options;

  const progress = getDisplayProgress(task);
  const playable = resolvePlayableModel(task);
  const canPlay = task.status === "success" && Boolean(playable?.url);
  const canDownload = canPlay;
  const timeLabel = formatTimeLabel(task.updatedAt || task.createdAt);
  const statusLabel = formatStatus(task.statusText || task.status);
  const isPlaybackLoading = activePlaybackLoadingTaskId === task.id;
  const playDisabled = !canPlay || (Boolean(activePlaybackLoadingTaskId) && !isPlaybackLoading);
  const playLabel = isPlaybackLoading ? "加载中..." : "播放模型";
  const fileSizeLabel = Number(task.fileSizeBytes || 0) > 0 ? formatBytes(task.fileSizeBytes) : "-";

  return `
    <article class="model-list-item">
      <div class="model-list-top">
        <div class="model-list-title">
          <strong>${escapeHtml(task.prompt || "未命名模型")}</strong>
          <span>${escapeHtml(task.mode === "image" ? "图片生成" : "文字生成")}</span>
        </div>
        <span class="model-list-status">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="model-list-meta">
        <span>任务 ID：${escapeHtml(task.taskId || task.id)}</span>
        <span>更新时间：${escapeHtml(timeLabel)}</span>
        <span>文件大小：${escapeHtml(fileSizeLabel)}</span>
      </div>
      <div class="model-list-progress">
        <div class="model-list-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="model-list-meta">
        <span>${progress}%</span>
        <span>${escapeHtml(getTaskStageLabel(task))}</span>
      </div>
      <div class="model-list-actions">
        <button class="secondary-btn" type="button" data-delete-task="${escapeHtml(task.id)}">删除</button>
        <button class="secondary-btn" type="button" data-download-task="${escapeHtml(task.id)}" ${canDownload ? "" : "disabled"}>下载</button>
        <button class="primary-btn" type="button" data-play-task="${escapeHtml(task.id)}" ${playDisabled ? "disabled" : ""}>${playLabel}</button>
      </div>
    </article>
  `;
}

function renderGeneratedTaskCardMarkup(task, options) {
  const {
    activePlaybackLoadingTaskId,
    escapeHtml,
    formatBytes,
    formatStatus,
    formatTimeLabel,
    getDisplayProgress,
    getTaskStageLabel,
    resolvePlayableModel
  } = options;

  const progress = getDisplayProgress(task);
  const playable = resolvePlayableModel(task);
  const canPlay = task.status === "success" && Boolean(playable?.url);
  const canDownload = canPlay;
  const isPlaybackLoading = activePlaybackLoadingTaskId === task.id;
  const playDisabled = !canPlay || (Boolean(activePlaybackLoadingTaskId) && !isPlaybackLoading);
  const playLabel = isPlaybackLoading ? "加载中..." : "播放模型";
  const title = task.prompt || task.name || task.taskId || "未命名模型";
  const timeLabel = formatTimeLabel(task.updatedAt || task.createdAt);
  const fileSizeLabel = Number(task.fileSizeBytes || 0) > 0 ? formatBytes(task.fileSizeBytes) : "-";
  const formatLabel = (playable?.format || task.format || "").toString().toUpperCase() || "-";
  const statusLabel = formatStatus(task.statusText || task.status);
  const coverUrl = task.renderedImage || task.thumbnailUrl || task.imageUrl || task.persistedModel?.coverUrl || "";
  const coverHtml = coverUrl
    ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)} 封面" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_MODEL_COVER_URL}'" />`
    : `<img src="${DEFAULT_MODEL_COVER_URL}" alt="${escapeHtml(title)} 封面" loading="lazy" />`;

  return `
    <article class="model-list-item">
      <div class="model-list-cover">${coverHtml}</div>
      <div class="model-list-body">
        <div class="model-list-top">
          <div class="model-list-title">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(task.mode === "image" ? "图片生成" : "文字生成")}</span>
          </div>
        </div>
        <div class="model-list-meta">
          <span>时间：${escapeHtml(timeLabel)}</span>
          <span>大小：${escapeHtml(fileSizeLabel)}</span>
          <span>格式：${escapeHtml(formatLabel)}</span>
        </div>
        <div class="model-list-progress" aria-label="生成进度 ${progress}%">
          <div class="model-list-progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="model-list-meta">
          <span>${progress}%</span>
          <span>${escapeHtml(getTaskStageLabel(task))}</span>
          <span class="model-list-status">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="model-list-actions">
          <button class="secondary-btn" type="button" data-delete-task="${escapeHtml(task.id)}">删除</button>
          <button class="secondary-btn" type="button" data-download-task="${escapeHtml(task.id)}" ${canDownload ? "" : "disabled"}>下载</button>
          <button class="primary-btn" type="button" data-play-task="${escapeHtml(task.id)}" ${playDisabled ? "disabled" : ""}>${playLabel}</button>
        </div>
      </div>
    </article>
  `;
}

export function renderGeneratedTaskListView({
  tasks,
  modelListItems,
  modelListEmpty,
  activePlaybackLoadingTaskId,
  onDelete,
  onDownload,
  onPlay,
  onRefresh,
  escapeHtml,
  formatBytes,
  formatStatus,
  formatTimeLabel,
  getDisplayProgress,
  getTaskStageLabel,
  resolvePlayableModel
}) {
  if (!modelListItems || !modelListEmpty) {
    return;
  }

  if (!tasks.length) {
    modelListEmpty.classList.remove("hidden");
    modelListItems.innerHTML = "";
    return;
  }

  modelListEmpty.classList.add("hidden");
  modelListItems.innerHTML = tasks.map((task) => renderGeneratedTaskCardMarkup(task, {
    activePlaybackLoadingTaskId,
    escapeHtml,
    formatBytes,
    formatStatus,
    formatTimeLabel,
    getDisplayProgress,
    getTaskStageLabel,
    resolvePlayableModel
  })).join("");

  modelListItems.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => {
      onPlay(button.dataset.playTask || "");
    });
  });

  modelListItems.querySelectorAll("[data-download-task]").forEach((button) => {
    button.addEventListener("click", () => {
      onDownload(button.dataset.downloadTask || "");
    });
  });

  modelListItems.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      onDelete(button.dataset.deleteTask || "");
    });
  });

  void onRefresh;
}

export function updateTaskProgressOverlayView({
  task,
  activeGeneratingTaskId,
  dismissedTaskProgressId,
  overlay,
  title,
  meta,
  fill,
  percent,
  getDisplayProgress,
  getTaskStageLabel,
  getTaskStatusLabel
}) {
  if (!task || task.finalized) {
    overlay.classList.add("hidden");
    return;
  }

  if (dismissedTaskProgressId && dismissedTaskProgressId === task.id) {
    overlay.classList.add("hidden");
    return;
  }

  if (activeGeneratingTaskId && activeGeneratingTaskId !== task.id) {
    return;
  }

  const progress = getDisplayProgress(task);
  overlay.classList.remove("hidden");
  title.textContent = task.prompt || "正在生成 3D 模型";
  meta.textContent = `${getTaskStatusLabel(task)} · ${getTaskStageLabel(task)}`;
  fill.style.width = `${progress}%`;
  percent.textContent = `${progress}%`;
}
