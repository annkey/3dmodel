const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { URL } = require("node:url");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const envPath = path.join(rootDir, ".env.local");
const generatorSettingsPath = path.join(rootDir, "generator-settings.json");

loadEnvFile(envPath);

const PORT = Number(process.env.PORT || 3000);
const TRIPO_API_KEY = process.env.TRIPO_API_KEY || "";
const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";
const MESHY_API_KEY = process.env.MESHY_API_KEY || "";
const MESHY_API_BASE = "https://api.meshy.ai";
const GENERATOR_API_BASE = normalizeApiBase(process.env.GENERATOR_API_BASE || "");

const TRIPO_FINAL_STATUSES = new Set([
  "success",
  "failed",
  "banned",
  "expired",
  "cancelled",
  "unknown"
]);

const NORMALIZED_FINAL_STATUSES = new Set([
  "success",
  "failed",
  "cancelled",
  "expired",
  "unknown"
]);

const meshyTaskContexts = new Map();
const meshyRefineTasks = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm"
};

const GENERATOR_PROVIDER_OPTIONS = {
  tripo: {
    name: "Tripo3D",
    defaultModelVersion: "P1-20260311",
    modelVersions: [
      { value: "P1-20260311", label: "P1-20260311" },
      { value: "v3.1-20260211", label: "v3.1-20260211" },
      { value: "v2.5-20250123", label: "v2.5-20250123" }
    ]
  },
  meshy: {
    name: "Meshy",
    defaultModelVersion: "latest",
    modelVersions: [
      { value: "latest", label: "latest (Meshy 6)" },
      { value: "meshy-6", label: "meshy-6" },
      { value: "meshy-5", label: "meshy-5" }
    ]
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, requestUrl);
      return;
    }

    await handleStatic(req, res, requestUrl.pathname);
  } catch (error) {
    sendJson(res, 500, {
      error: "ServerError",
      message: error instanceof Error ? error.message : "Unknown server error."
    });
  }
});

server.listen(PORT, () => {
  console.log(`3D app running at http://localhost:${PORT}`);
});

async function handleApi(req, res, requestUrl) {
  if (req.method === "GET" && requestUrl.pathname === "/api/config") {
    sendJson(res, 200, buildLocalGeneratorConfigResponse());
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/generator-settings") {
    try {
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      const savedSettings = saveGeneratorSettings(payload);
      sendJson(res, 200, {
        ok: true,
        message: "Generator settings saved.",
        generatorSettings: savedSettings,
        ...buildLocalGeneratorConfigResponse()
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "GeneratorSettingsSaveFailed",
        message: error.message || "Failed to save generator settings.",
        details: error.details || null
      });
      return;
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/generate") {
    try {
      const request = toWebRequest(req, requestUrl);
      const form = await request.formData();
      const generatorSettings = getGeneratorSettings();
      form.set("provider", generatorSettings.provider);
      form.set("modelVersion", generatorSettings.modelVersion);
      const provider = generatorSettings.provider;

      if (GENERATOR_API_BASE) {
        const remoteResult = await proxyRemoteJson("/api/generate", {
          method: "POST",
          body: form
        });
        sendJson(res, 200, {
          ...remoteResult,
          generatorApiBase: GENERATOR_API_BASE,
          proxied: true
        });
        return;
      }

      if (provider === "meshy") {
        await handleMeshyGenerate(res, form);
      } else {
        await handleTripoGenerate(res, form);
      }
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "GenerationFailed",
        message: error.message || "Failed to create task.",
        details: error.details || null
      });
      return;
    }
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/task/")) {
    const taskId = requestUrl.pathname.split("/").pop();
    const provider = normalizeProvider(requestUrl.searchParams.get("provider"));

    if (!taskId) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Missing task id."
      });
      return;
    }

    try {
      if (GENERATOR_API_BASE) {
        const remoteTask = await proxyRemoteJson(`/api/task/${encodeURIComponent(taskId)}?provider=${encodeURIComponent(provider)}`);
        sendJson(res, 200, {
          ...remoteTask,
          generatorApiBase: GENERATOR_API_BASE,
          proxied: true
        });
        return;
      }

      if (provider === "meshy") {
        await handleMeshyTaskQuery(res, taskId);
      } else {
        await handleTripoTaskQuery(res, taskId);
      }
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "TaskQueryFailed",
        message: error.message || "Failed to query task.",
        details: error.details || null
      });
      return;
    }
  }

  if ((req.method === "GET" || req.method === "HEAD") && requestUrl.pathname === "/api/asset") {
    try {
      await handleAssetProxy(req, res, requestUrl);
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "AssetProxyFailed",
        message: error.message || "Failed to proxy asset.",
        details: error.details || null
      });
      return;
    }
  }

  sendJson(res, 404, {
    error: "NotFound",
    message: "API route not found."
  });
}

async function handleTripoGenerate(res, form) {
  ensureProviderEnabled("tripo");

  const mode = String(form.get("mode") || "text");
  const modelVersion = String(form.get("modelVersion") || "P1-20260311");
  const textureQuality = String(form.get("textureQuality") || "standard");
  const geometryQuality = String(form.get("geometryQuality") || "standard");
  const prompt = normalizeText(form.get("prompt"));
  const negativePrompt = normalizeText(form.get("negativePrompt"));
  const imageFile = form.get("image");

  let payload;
  let uploadInfo = null;

  if (mode === "image") {
    if (!(imageFile instanceof File) || imageFile.size === 0) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Image mode requires an uploaded image."
      });
      return;
    }

    uploadInfo = await uploadImageToTripo(imageFile);

    if (!uploadInfo.image_token) {
      sendJson(res, 400, {
        error: "UploadFailed",
        message: "Tripo upload did not return image_token.",
        details: uploadInfo.raw || null
      });
      return;
    }

    payload = {
      type: "image_to_model",
      model_version: modelVersion,
      file: {
        type: mapMimeToTripoFileType(imageFile.type),
        file_token: uploadInfo.image_token
      }
    };

    if (supportsTextureQuality(modelVersion)) {
      payload.texture_quality = textureQuality;
    }

    if (supportsOrientation(modelVersion)) {
      payload.orientation = "align_image";
    }
  } else {
    if (!prompt) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Text mode requires a prompt."
      });
      return;
    }

    payload = {
      type: "text_to_model",
      model_version: modelVersion,
      prompt
    };

    if (negativePrompt) {
      payload.negative_prompt = negativePrompt;
    }

    if (supportsTextureQuality(modelVersion)) {
      payload.texture_quality = textureQuality;
    }

    if (supportsGeometryQuality(modelVersion)) {
      payload.geometry_quality = geometryQuality;
    }
  }

  const tripoResponse = await tripoFetch("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const createResult = unwrapTripoData(tripoResponse);

  sendJson(res, 200, {
    ok: true,
    provider: "tripo",
    providerName: "Tripo3D",
    mode,
    taskId: createResult.task_id || null,
    displayModelVersion: modelVersion,
    payload,
    upload: uploadInfo,
    raw: tripoResponse
  });
}

async function handleTripoTaskQuery(res, taskId) {
  ensureProviderEnabled("tripo");

  const task = await tripoFetch(`/task/${taskId}`, { method: "GET" });
  const taskResult = unwrapTripoData(task);
  const output = taskResult.output || {};
  const preferredModelUrl = output.model || output.pbr_model || output.base_model || null;

  sendJson(res, 200, {
    ok: true,
    provider: "tripo",
    providerName: "Tripo3D",
    mode: inferTripoMode(taskResult.type),
    taskId: taskResult.task_id || taskId,
    type: taskResult.type,
    status: taskResult.status,
    statusText: taskResult.status,
    progress: typeof taskResult.progress === "number" ? taskResult.progress : 0,
    finalized: TRIPO_FINAL_STATUSES.has(taskResult.status),
    stageText: "Tripo3D 生成任务",
    displayModelVersion: taskResult.input?.model_version || "",
    input: taskResult.input || {},
    output,
    renderedImage: output.rendered_image || output.generated_image || null,
    preferredModelUrl,
    modelUrls: {
      model: output.model || null,
      pbrModel: output.pbr_model || null,
      baseModel: output.base_model || null
    },
    downloadItems: buildTripoDownloadItems(output),
    raw: task
  });
}

async function handleMeshyGenerate(res, form) {
  ensureProviderEnabled("meshy");

  const mode = String(form.get("mode") || "text");
  const modelVersion = String(form.get("modelVersion") || "latest");
  const textureQuality = String(form.get("textureQuality") || "standard");
  const geometryQuality = String(form.get("geometryQuality") || "standard");
  const prompt = normalizeText(form.get("prompt"));
  const auxiliaryPrompt = normalizeText(form.get("negativePrompt"));
  const imageFile = form.get("image");

  let payload;
  let endpoint;

  if (mode === "image") {
    if (!(imageFile instanceof File) || imageFile.size === 0) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Image mode requires an uploaded image."
      });
      return;
    }

    if (!["image/png", "image/jpeg"].includes(imageFile.type)) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Meshy image mode only supports PNG or JPEG images."
      });
      return;
    }

    payload = {
      image_url: await fileToDataUri(imageFile),
      ai_model: modelVersion,
      model_type: geometryQuality === "lowpoly" ? "lowpoly" : "standard",
      should_texture: true,
      enable_pbr: textureQuality === "detailed",
      moderation: false,
      image_enhancement: true,
      remove_lighting: true,
      target_formats: ["glb", "fbx", "obj", "stl"]
    };

    endpoint = "/openapi/v1/image-to-3d";
  } else {
    if (!prompt) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Text mode requires a prompt."
      });
      return;
    }

    payload = {
      mode: "preview",
      prompt,
      ai_model: modelVersion,
      model_type: geometryQuality === "lowpoly" ? "lowpoly" : "standard",
      moderation: false,
      target_formats: ["glb", "fbx", "obj", "stl"]
    };

    endpoint = "/openapi/v2/text-to-3d";
  }

  const meshyResponse = await meshyFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const taskId = meshyResponse.result || meshyResponse.id || null;
  if (taskId) {
    meshyTaskContexts.set(taskId, {
      provider: "meshy",
      mode,
      modelVersion,
      textureQuality,
      geometryQuality,
      auxiliaryPrompt
    });
  }

  sendJson(res, 200, {
    ok: true,
    provider: "meshy",
    providerName: "Meshy",
    mode,
    taskId,
    displayModelVersion: modelVersion,
    payload,
    raw: meshyResponse
  });
}

async function handleMeshyTaskQuery(res, taskId) {
  ensureProviderEnabled("meshy");

  const context = meshyTaskContexts.get(taskId) || null;
  const task = await fetchMeshyTask(taskId, context?.mode);
  const normalized = normalizeMeshyTask(task, context, taskId);

  if (task.type === "text-to-3d-preview" && task.status === "SUCCEEDED") {
    const refineTaskId = await ensureMeshyRefineTask(task.id || taskId, context);
    sendJson(res, 200, {
      ...normalized,
      finalized: false,
      progress: 100,
      status: "running",
      statusText: "预览阶段完成，正在进入贴图阶段...",
      stageText: "Meshy 贴图阶段",
      transition: {
        nextTaskId: refineTaskId,
        stageText: "Meshy 贴图阶段",
        statusText: "预览阶段完成，正在进入贴图阶段..."
      }
    });
    return;
  }

  sendJson(res, 200, normalized);
}

async function ensureMeshyRefineTask(previewTaskId, context) {
  if (meshyRefineTasks.has(previewTaskId)) {
    return meshyRefineTasks.get(previewTaskId);
  }

  const payload = {
    mode: "refine",
    preview_task_id: previewTaskId,
    ai_model: context?.modelVersion || "latest",
    enable_pbr: context?.textureQuality === "detailed"
  };

  if (context?.auxiliaryPrompt) {
    payload.texture_prompt = context.auxiliaryPrompt;
  }

  const response = await meshyFetch("/openapi/v2/text-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const refineTaskId = response.result || response.id;
  meshyRefineTasks.set(previewTaskId, refineTaskId);
  meshyTaskContexts.set(refineTaskId, {
    ...(context || {}),
    provider: "meshy",
    mode: "text",
    stage: "refine",
    previewTaskId
  });

  return refineTaskId;
}

async function fetchMeshyTask(taskId, preferredMode = "text") {
  const attempts = preferredMode === "image"
    ? [
        { endpoint: `/openapi/v1/image-to-3d/${taskId}` },
        { endpoint: `/openapi/v2/text-to-3d/${taskId}` }
      ]
    : [
        { endpoint: `/openapi/v2/text-to-3d/${taskId}` },
        { endpoint: `/openapi/v1/image-to-3d/${taskId}` }
      ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      return await meshyFetch(attempt.endpoint, { method: "GET" });
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Meshy task not found.");
}

function normalizeMeshyTask(task, context, fallbackTaskId) {
  const rawUrls = task.model_urls || {};
  const normalizedStatus = normalizeMeshyStatus(task.status);
  const taskId = task.id || fallbackTaskId;
  const mode = task.type?.startsWith("image") ? "image" : "text";

  return {
    ok: true,
    provider: "meshy",
    providerName: "Meshy",
    mode,
    taskId,
    type: task.type,
    status: normalizedStatus,
    statusText: task.task_error?.message || normalizedStatus,
    progress: typeof task.progress === "number" ? task.progress : 0,
    finalized: NORMALIZED_FINAL_STATUSES.has(normalizedStatus),
    stageText: inferMeshyStageText(task.type),
    displayModelVersion: context?.modelVersion || task.ai_model || "latest",
    input: {
      prompt: task.prompt || "",
      texturePrompt: task.texture_prompt || ""
    },
    output: rawUrls,
    renderedImage: task.thumbnail_url || null,
    preferredModelUrl:
      rawUrls.glb ||
      rawUrls.pre_remeshed_glb ||
      rawUrls.fbx ||
      rawUrls.obj ||
      rawUrls.stl ||
      rawUrls.usdz ||
      null,
    modelUrls: {
      model: rawUrls.glb || null,
      pbrModel: null,
      baseModel: rawUrls.pre_remeshed_glb || null,
      glb: rawUrls.glb || null,
      preRemeshedGlb: rawUrls.pre_remeshed_glb || null,
      fbx: rawUrls.fbx || null,
      obj: rawUrls.obj || null,
      mtl: rawUrls.mtl || null,
      stl: rawUrls.stl || null,
      usdz: rawUrls.usdz || null
    },
    downloadItems: buildMeshyDownloadItems(rawUrls, task.thumbnail_url),
    raw: task
  };
}

async function uploadImageToTripo(file) {
  const formData = new FormData();
  formData.append("file", file, file.name || "input.png");

  const response = await tripoFetch("/upload/sts", {
    method: "POST",
    body: formData
  });

  return {
    ...unwrapTripoData(response),
    raw: response
  };
}

async function tripoFetch(endpoint, options) {
  const response = await fetch(`${TRIPO_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TRIPO_API_KEY}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  return parseHttpJson(response);
}

async function meshyFetch(endpoint, options) {
  const response = await fetch(`${MESHY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${MESHY_API_KEY}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  return parseHttpJson(response);
}

async function parseHttpJson(response) {
  const text = await response.text();
  const data = tryParseJson(text);

  if (!response.ok) {
    const error = new Error(
      extractErrorMessage(data) ||
      text ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function proxyRemoteJson(pathname, options = {}) {
  if (!GENERATOR_API_BASE) {
    const error = new Error("GENERATOR_API_BASE is not configured.");
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${GENERATOR_API_BASE}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });

  return parseHttpJson(response);
}

async function handleAssetProxy(req, res, requestUrl) {
  const rawUrl = String(requestUrl.searchParams.get("url") || "").trim();
  if (!rawUrl) {
    const error = new Error("Missing asset url.");
    error.status = 400;
    throw error;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    const error = new Error("Invalid asset url.");
    error.status = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    const error = new Error("Only http/https asset urls are supported.");
    error.status = 400;
    throw error;
  }

  const response = await fetch(targetUrl, {
    method: req.method === "HEAD" ? "HEAD" : "GET",
    headers: {
      Accept: "*/*",
      ...(req.headers.range ? { Range: req.headers.range } : {})
    }
  });

  if (!response.ok) {
    const details = await safeReadResponseText(response);
    const error = new Error(`Failed to fetch remote asset (${response.status}).`);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  const fileName = path.basename(targetUrl.pathname || "asset");
  const ext = path.extname(fileName).toLowerCase();
  const contentType = response.headers.get("content-type") || inferAssetContentType(ext);
  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  const acceptRanges = response.headers.get("accept-ranges");

  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${fileName || "asset"}"`
  };

  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  if (contentRange) {
    headers["Content-Range"] = contentRange;
  }

  if (etag) {
    headers["ETag"] = etag;
  }

  if (lastModified) {
    headers["Last-Modified"] = lastModified;
  }

  if (acceptRanges) {
    headers["Accept-Ranges"] = acceptRanges;
  }

  res.writeHead(response.status, headers);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

async function safeReadResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function inferAssetContentType(ext) {
  const map = {
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".fbx": "application/octet-stream",
    ".obj": "text/plain; charset=utf-8",
    ".stl": "model/stl"
  };
  return map[ext] || "application/octet-stream";
}

async function fileToDataUri(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

function ensureProviderEnabled(provider) {
  if (provider === "meshy" && !MESHY_API_KEY) {
    const error = new Error("MESHY_API_KEY is not configured in the runtime environment.");
    error.status = 500;
    throw error;
  }

  if (provider === "tripo" && !TRIPO_API_KEY) {
    const error = new Error("TRIPO_API_KEY is not configured in the runtime environment.");
    error.status = 500;
    throw error;
  }
}

function normalizeProvider(value) {
  return String(value || "tripo").toLowerCase() === "meshy" ? "meshy" : "tripo";
}

function normalizeMeshyStatus(status) {
  const map = {
    PENDING: "queued",
    IN_PROGRESS: "running",
    SUCCEEDED: "success",
    FAILED: "failed",
    CANCELED: "cancelled",
    CANCELLED: "cancelled",
    EXPIRED: "expired"
  };
  return map[status] || "unknown";
}

function inferTripoMode(type) {
  if (String(type).includes("image")) {
    return "image";
  }
  return "text";
}

function inferMeshyStageText(type) {
  if (type === "text-to-3d-preview") {
    return "Meshy 预览阶段";
  }

  if (type === "text-to-3d-refine") {
    return "Meshy 贴图阶段";
  }

  if (String(type).includes("image")) {
    return "Meshy 图片生成阶段";
  }

  return "Meshy 生成任务";
}

function buildTripoDownloadItems(output) {
  const items = [];
  if (output.model) items.push({ label: "下载模型", url: output.model });
  if (output.pbr_model) items.push({ label: "下载 PBR 模型", url: output.pbr_model });
  if (output.base_model) items.push({ label: "下载 Base 模型", url: output.base_model });
  if (output.rendered_image || output.generated_image) {
    items.push({ label: "下载预览图", url: output.rendered_image || output.generated_image });
  }
  return items;
}

function buildMeshyDownloadItems(modelUrls, thumbnailUrl) {
  const labels = {
    glb: "下载 GLB",
    pre_remeshed_glb: "下载原始 GLB",
    fbx: "下载 FBX",
    obj: "下载 OBJ",
    mtl: "下载 MTL",
    stl: "下载 STL",
    usdz: "下载 USDZ"
  };

  const items = [];
  for (const [key, url] of Object.entries(modelUrls || {})) {
    if (url) {
      items.push({ label: labels[key] || `下载 ${key.toUpperCase()}`, url });
    }
  }

  if (thumbnailUrl) {
    items.push({ label: "下载预览图", url: thumbnailUrl });
  }

  return items;
}

function buildLocalGeneratorConfigResponse() {
  const providers = buildProviderConfigMap();
  const generatorSettings = getGeneratorSettings(providers);

  return {
    ok: true,
    generatorApiBase: "",
    proxied: false,
    providers,
    generatorSettings
  };
}

function buildProviderConfigMap() {
  const useRemoteGenerator = Boolean(GENERATOR_API_BASE);
  return {
    tripo: {
      enabled: useRemoteGenerator || Boolean(TRIPO_API_KEY),
      name: GENERATOR_PROVIDER_OPTIONS.tripo.name,
      defaultModelVersion: GENERATOR_PROVIDER_OPTIONS.tripo.defaultModelVersion,
      modelVersions: GENERATOR_PROVIDER_OPTIONS.tripo.modelVersions
    },
    meshy: {
      enabled: useRemoteGenerator || Boolean(MESHY_API_KEY),
      name: GENERATOR_PROVIDER_OPTIONS.meshy.name,
      defaultModelVersion: GENERATOR_PROVIDER_OPTIONS.meshy.defaultModelVersion,
      modelVersions: GENERATOR_PROVIDER_OPTIONS.meshy.modelVersions
    }
  };
}

function getGeneratorSettings(providers = buildProviderConfigMap()) {
  const stored = readGeneratorSettingsFile();
  const availableProvider = selectDefaultProvider(providers);
  const fallbackProvider = providers[availableProvider] ? availableProvider : "tripo";
  const requestedProvider = normalizeProvider(stored.provider || fallbackProvider);
  const provider = providers[requestedProvider]?.enabled ? requestedProvider : fallbackProvider;
  const modelVersion = resolveModelVersion(provider, stored.modelVersion, providers);

  return {
    provider,
    providerName: providers[provider]?.name || provider,
    modelVersion
  };
}

function saveGeneratorSettings(payload) {
  const providers = buildProviderConfigMap();
  const provider = normalizeProvider(payload?.provider);

  if (!providers[provider]?.enabled) {
    const error = new Error("Selected provider is not enabled in the current runtime environment.");
    error.status = 400;
    throw error;
  }

  const modelVersion = resolveModelVersion(provider, payload?.modelVersion, providers, true);
  const nextSettings = {
    provider,
    modelVersion
  };

  fs.writeFileSync(generatorSettingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");

  return {
    ...nextSettings,
    providerName: providers[provider]?.name || provider
  };
}

function readGeneratorSettingsFile() {
  if (!fs.existsSync(generatorSettingsPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(generatorSettingsPath, "utf8"));
  } catch {
    return {};
  }
}

function selectDefaultProvider(providers) {
  if (providers.meshy?.enabled) {
    return "meshy";
  }

  if (providers.tripo?.enabled) {
    return "tripo";
  }

  return "tripo";
}

function resolveModelVersion(provider, requestedValue, providers = buildProviderConfigMap(), strict = false) {
  const modelVersions = providers[provider]?.modelVersions || [];
  const allowedValues = new Set(modelVersions.map((item) => item.value));
  const defaultValue = providers[provider]?.defaultModelVersion || GENERATOR_PROVIDER_OPTIONS[provider]?.defaultModelVersion || "";
  const requestedModelVersion = String(requestedValue || "").trim();

  if (requestedModelVersion && allowedValues.has(requestedModelVersion)) {
    return requestedModelVersion;
  }

  if (strict && requestedModelVersion) {
    const error = new Error("Selected model version is not supported for the current provider.");
    error.status = 400;
    throw error;
  }

  return defaultValue;
}

async function handleStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  let targetPath = pathname === "/" ? "/index.html" : pathname;
  targetPath = decodeURIComponent(targetPath);

  const normalizedPath = path
    .normalize(targetPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const fileBuffer = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    });
    res.end(req.method === "HEAD" ? undefined : fileBuffer);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

function toWebRequest(req, requestUrl) {
  return new Request(requestUrl.toString(), {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: "half"
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(text);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function unwrapTripoData(data) {
  if (data && typeof data === "object" && data.data && typeof data.data === "object") {
    return data.data;
  }

  return data;
}

function extractErrorMessage(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error.message === "string" && data.error.message.trim()) {
    return data.error.message;
  }

  if (data.task_error && typeof data.task_error.message === "string" && data.task_error.message.trim()) {
    return data.task_error.message;
  }

  if (typeof data.raw === "string" && data.raw.trim()) {
    return data.raw;
  }

  return "";
}

function normalizeText(value) {
  return String(value || "").trim();
}

function mapMimeToTripoFileType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpeg";
}

function supportsTextureQuality(modelVersion) {
  return [
    "P1-20260311",
    "v3.1-20260211",
    "v3.0-20250812",
    "v2.5-20250123",
    "v2.0-20240919"
  ].includes(modelVersion);
}

function supportsGeometryQuality(modelVersion) {
  return ["v3.1-20260211", "v3.0-20250812"].includes(modelVersion);
}

function supportsOrientation(modelVersion) {
  return [
    "P1-20260311",
    "v3.1-20260211",
    "v3.0-20250812",
    "v2.5-20250123",
    "v2.0-20240919"
  ].includes(modelVersion);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
