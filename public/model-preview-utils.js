export function normalizeProviderValue(value) {
  return String(value || "tripo").toLowerCase() === "meshy" ? "meshy" : "tripo";
}

export function sanitizeGenerationText(value, fallback = "") {
  const text = String(value || "")
    .replace(/\bmeshy\b/ig, "")
    .replace(/\btripo3d\b/ig, "")
    .replace(/\btripo\b/ig, "")
    .replace(/[·|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

export function getTaskStatusLabel(task) {
  return sanitizeGenerationText(formatStatus(task?.statusText || task?.status), "处理中");
}

export function getTaskStageLabel(task) {
  return sanitizeGenerationText(task?.stageText, "处理中");
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function getDisplayProgress(task) {
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

export function getPreviewModelUrl(task) {
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

export function resolvePlayableModel(task) {
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

export function parseStoredJson(key, fallbackValue) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
  } catch {
    return fallbackValue;
  }
}

export function getFileNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const pathname = parsedUrl.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(pathname);
  } catch {
    return String(url).split("/").pop() || "";
  }
}

function getExtensionFromName(fileName) {
  const parts = String(fileName || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export function inferFormatFromUrl(url) {
  return getExtensionFromName(getFileNameFromUrl(url));
}

export function buildAssetProxyUrl(url) {
  const value = String(url || "");
  if (value.startsWith("/api/work/models/")) {
    return value;
  }
  return `/api/asset?url=${encodeURIComponent(url)}`;
}

export function sanitizeDownloadName(value) {
  return String(value || "generated-model")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 64) || "generated-model";
}

export function formatTimeLabel(value) {
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

export function formatStatus(status) {
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

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export function stripExtension(fileName) {
  const parts = String(fileName).split(".");
  if (parts.length <= 1) return fileName;
  parts.pop();
  return parts.join(".");
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatPreviewError(error) {
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
