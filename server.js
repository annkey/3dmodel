const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { URL } = require("node:url");
const { Pool } = require("pg");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const envPath = path.join(rootDir, ".env.local");
const generatorSettingsPath = path.join(rootDir, "generator-settings.json");
const adminUsersPath = path.join(rootDir, "admin-users.json");
const userCreditsPath = path.join(rootDir, "user-credits.json");
const authSessionsPath = path.join(rootDir, "auth-sessions.json");
const userModelStorageRoot = path.join(rootDir, "storage", "user-models");
const userModelIndexPath = path.join(rootDir, "user-models.json");

loadEnvFile(envPath);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "kmax1224";
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || "";
const TRIPO_API_KEY = process.env.TRIPO_API_KEY || "";
const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";
const MESHY_API_KEY = process.env.MESHY_API_KEY || "";
const MESHY_API_BASE = "https://api.meshy.ai";
const GENERATOR_API_BASE = normalizeApiBase(process.env.GENERATOR_API_BASE || "");
const MODEL_STORAGE_DRIVER = normalizeStorageDriver(process.env.MODEL_STORAGE_DRIVER || "oss");
const ALIYUN_OSS_REGION = process.env.ALIYUN_OSS_REGION || "oss-cn-shenzhen";
const ALIYUN_OSS_BUCKET = process.env.ALIYUN_OSS_BUCKET || "k3dmodel";
const ALIYUN_OSS_PREFIX = normalizeObjectPrefix(process.env.ALIYUN_OSS_PREFIX || "models");
const ALIYUN_OSS_ENDPOINT = normalizeOssEndpoint(
  process.env.ALIYUN_OSS_ENDPOINT || `${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_REGION}.aliyuncs.com`
);
const ALIYUN_OSS_ACCESS_KEY_ID = process.env.ALIYUN_OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "";
const ALIYUN_OSS_ACCESS_KEY_SECRET = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "";

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
const optimizationTaskContexts = new Map();
const generatedTaskRecords = new Map();
const generatedTaskPersistPromises = new Map();
const playerClientSessions = new Map();
const authSessions = new Map();
const runtimeStores = {
  generatorSettings: null,
  adminUsers: null,
  userCredits: null,
  authSessions: null,
  userModels: null
};
const runtimeStorePersistPromises = new Map();
let pgPool = null;
const PLAYER_CLIENT_ACTIVE_MS = 2 * 60 * 1000;
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CREDIT_COSTS = {
  generate: 10,
  optimize: 5,
  download: 2
};
const CREDIT_ACTIONS = {
  generate: {
    costKey: "generate",
    type: "ai_generate",
    title: "AI生成模型"
  },
  optimize: {
    costKey: "optimize",
    type: "ai_optimize",
    title: "AI模型优化"
  },
  download: {
    costKey: "download",
    type: "model_download",
    title: "模型下载"
  }
};
const AUTO_CREDIT_RULES = {
  new_user_default: 50
};
const DEFAULT_USER_MODEL_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
const MODEL_UPLOAD_ALLOWED_EXTENSIONS = new Set([
  ".glb",
  ".gltf",
  ".fbx",
  ".obj",
  ".stl",
  ".bin",
  ".mtl",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

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
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".obj": "text/plain; charset=utf-8",
  ".stl": "model/stl",
  ".bin": "application/octet-stream",
  ".mtl": "text/plain; charset=utf-8"
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

const OPTIMIZATION_PROVIDER_OPTIONS = {
  tripo: {
    name: "Tripo3D",
    defaultModelVersion: "P1-20260311",
    modelVersions: GENERATOR_PROVIDER_OPTIONS.tripo.modelVersions,
    operations: {
      retexture: false,
      split: false
    }
  },
  meshy: {
    name: "Meshy",
    defaultModelVersion: "latest",
    modelVersions: GENERATOR_PROVIDER_OPTIONS.meshy.modelVersions,
    operations: {
      retexture: true,
      split: false
    }
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
      await flushRuntimeStorePersists();
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

startServer().catch((error) => {
  console.error("Server startup failed", error);
  process.exitCode = 1;
});

async function startServer() {
  await initializeRuntimeDatabase();
  server.listen(PORT, () => {
    console.log(`3D app running at http://localhost:${PORT}`);
  });
}

async function initializeRuntimeDatabase() {
  if (!DATABASE_URL) {
    return;
  }

  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldUsePostgresSsl() ? { rejectUnauthorized: false } : undefined
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_runtime_stores (
      store_key TEXT PRIMARY KEY,
      store_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  runtimeStores.generatorSettings = await loadRuntimeStore("generator_settings", readGeneratorSettingsJsonFile());
  runtimeStores.adminUsers = await loadRuntimeStore("admin_users", readAdminUsersJsonFile());
  runtimeStores.userCredits = await loadRuntimeStore("user_credits", readUserCreditsJsonFile());
  runtimeStores.authSessions = await loadRuntimeStore("auth_sessions", readAuthSessionsJsonFile());
  runtimeStores.userModels = await loadRuntimeStore("user_models", readUserModelIndexJsonFile());
  console.log("Runtime data store: PostgreSQL");
}

function shouldUsePostgresSsl() {
  const value = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
  return ["1", "true", "require", "required", "verify-ca", "verify-full"].includes(value);
}

async function loadRuntimeStore(storeKey, fallbackValue) {
  const result = await pgPool.query("SELECT store_value FROM app_runtime_stores WHERE store_key = $1", [storeKey]);
  if (result.rows[0]?.store_value) {
    return result.rows[0].store_value;
  }

  await persistRuntimeStore(storeKey, fallbackValue);
  return fallbackValue;
}

function queueRuntimeStorePersist(storeKey, value) {
  if (!pgPool) {
    return null;
  }

  const pending = (runtimeStorePersistPromises.get(storeKey) || Promise.resolve())
    .catch(() => {})
    .then(() => persistRuntimeStore(storeKey, value))
    .catch((error) => {
      console.error(`Failed to persist runtime store ${storeKey}`, error);
    })
    .finally(() => {
      if (runtimeStorePersistPromises.get(storeKey) === pending) {
        runtimeStorePersistPromises.delete(storeKey);
      }
    });
  runtimeStorePersistPromises.set(storeKey, pending);
  return pending;
}

async function persistRuntimeStore(storeKey, value) {
  if (!pgPool) {
    return;
  }

  await pgPool.query(
    `INSERT INTO app_runtime_stores (store_key, store_value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (store_key)
     DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
    [storeKey, JSON.stringify(value)]
  );
}

async function flushRuntimeStorePersists() {
  if (!runtimeStorePersistPromises.size) {
    return;
  }

  const pending = Array.from(runtimeStorePersistPromises.values());
  await Promise.allSettled(pending);
}

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function readGeneratorSettingsJsonFile() {
  return readJsonFile(generatorSettingsPath, {});
}

function readAdminUsersJsonFile() {
  return readJsonFile(adminUsersPath, { users: [createDefaultAdminUser()] });
}

function readUserCreditsJsonFile() {
  return readJsonFile(userCreditsPath, { balances: {}, records: [] });
}

function readAuthSessionsJsonFile() {
  return readJsonFile(authSessionsPath, { sessions: [] });
}

function readUserModelIndexJsonFile() {
  return readJsonFile(userModelIndexPath, { models: [] });
}

async function handleApi(req, res, requestUrl) {
  if (req.method === "GET" && requestUrl.pathname === "/api/config") {
    sendJson(res, 200, buildLocalGeneratorConfigResponse());
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    try {
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      const session = loginAdminUser(payload);
      sendJson(res, 200, {
        ok: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: session.user
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 401, {
        error: "LoginFailed",
        message: error.message || "用户名或密码错误。"
      });
      return;
    }
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/auth/session") {
    const session = getAuthenticatedSession(req);
    if (!session) {
      sendJson(res, 401, {
        error: "Unauthorized",
        message: "请先登录。"
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
    const token = getAuthToken(req);
    if (token) {
      loadAuthSessions();
      authSessions.delete(token);
      writeAuthSessionsFile();
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/work/me") {
    try {
      const session = assertAuthenticated(req);
      sendJson(res, 200, buildWorkMeResponse(session.user.id));
    } catch (error) {
      sendJson(res, error.status || 401, {
        error: "Unauthorized",
        message: error.message || "请先登录。"
      });
    }
    return;
  }

  if (req.method === "PUT" && requestUrl.pathname === "/api/work/me") {
    try {
      const session = assertAuthenticated(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      const user = updateSelfUser(session.user.id, payload);
      refreshAuthSessionUser(session.token, user);
      sendJson(res, 200, buildWorkMeResponse(user.id));
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "ProfileUpdateFailed",
        message: error.message || "个人信息保存失败。"
      });
      return;
    }
  }

  if (req.method === "PUT" && requestUrl.pathname === "/api/work/me/password") {
    try {
      const session = assertAuthenticated(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      updateSelfPassword(session.user.id, payload);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "PasswordUpdateFailed",
        message: error.message || "密码修改失败。"
      });
      return;
    }
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/work/models") {
    try {
      const session = assertAuthenticated(req);
      sendJson(res, 200, buildUserModelResponse(session.user.id));
    } catch (error) {
      sendJson(res, error.status || 401, {
        error: "UserModelListFailed",
        message: error.message || "请先登录。"
      });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/work/models") {
    try {
      const session = assertAuthenticated(req);
      const result = await handleUserModelUpload(req, session.user.id);
      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: error.code || "UserModelUploadFailed",
        message: error.message || "模型文件上传失败。",
        details: error.details || null
      });
    }
    return;
  }

  const workModelMatch = requestUrl.pathname.match(/^\/api\/work\/models\/([^/]+)$/);
  if (workModelMatch && req.method === "PATCH") {
    try {
      const session = assertAuthenticated(req);
      const result = await updateUserModelFromRequest(req, requestUrl, session.user.id, workModelMatch[1]);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "UserModelUpdateFailed",
        message: error.message || "模型信息更新失败。"
      });
    }
    return;
  }

  if (workModelMatch && req.method === "DELETE") {
    try {
      const session = assertAuthenticated(req);
      await deleteUserModel(session.user.id, workModelMatch[1]);
      sendJson(res, 200, buildUserModelResponse(session.user.id));
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "UserModelDeleteFailed",
        message: error.message || "模型文件删除失败。"
      });
    }
    return;
  }

  const workModelFileMatch = requestUrl.pathname.match(/^\/api\/work\/models\/([^/]+)\/files\/(.+)$/);
  if (workModelFileMatch && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const session = assertAuthenticated(req);
      await serveUserModelFile(req, res, session.user.id, workModelFileMatch[1], workModelFileMatch[2]);
    } catch (error) {
      sendJson(res, error.status || 404, {
        error: "UserModelFileReadFailed",
        message: error.message || "模型文件不存在。"
      });
    }
    return;
  }

  const workModelDownloadSourceMatch = requestUrl.pathname.match(/^\/api\/work\/models\/([^/]+)\/download-source$/);
  if (workModelDownloadSourceMatch && req.method === "GET") {
    try {
      const session = assertAuthenticated(req);
      assertUserHasCreditsForAction(session.user.id, "download");
      const result = await resolveUserModelDownloadSource(session.user.id, workModelDownloadSourceMatch[1], requestUrl);
      const creditRecord = consumeUserCreditsForAction(session.user.id, "download", {
        modelId: workModelDownloadSourceMatch[1],
        source: "work_model"
      });
      sendJson(res, 200, {
        ...result,
        creditRecord,
        credits: buildUserCreditSummary(session.user.id)
      });
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "UserModelDownloadSourceFailed",
        message: error.message || "Failed to prepare model download.",
        details: error.details || null
      });
    }
    return;
  }

  const generatedTaskDownloadSourceMatch = requestUrl.pathname.match(/^\/api\/generated-tasks\/([^/]+)\/download-source$/);
  if (generatedTaskDownloadSourceMatch && req.method === "GET") {
    try {
      const session = assertAuthenticated(req);
      assertUserHasCreditsForAction(session.user.id, "download");
      const result = resolveGeneratedTaskDownloadSource(session.user.id, generatedTaskDownloadSourceMatch[1], requestUrl);
      const creditRecord = consumeUserCreditsForAction(session.user.id, "download", {
        taskId: generatedTaskDownloadSourceMatch[1],
        source: "generated_task"
      });
      sendJson(res, 200, {
        ...result,
        creditRecord,
        credits: buildUserCreditSummary(session.user.id)
      });
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "GeneratedTaskDownloadSourceFailed",
        message: error.message || "Failed to prepare generated model download.",
        details: error.details || null
      });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/shared/models") {
    try {
      sendJson(res, 200, buildSharedModelResponse());
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: "SharedModelListFailed",
        message: error.message || "Failed to read shared models."
      });
    }
    return;
  }

  const sharedModelFileMatch = requestUrl.pathname.match(/^\/api\/shared\/models\/([^/]+)\/files\/(.+)$/);
  if (sharedModelFileMatch && (req.method === "GET" || req.method === "HEAD")) {
    try {
      await serveSharedModelFile(req, res, sharedModelFileMatch[1], sharedModelFileMatch[2]);
    } catch (error) {
      sendJson(res, error.status || 404, {
        error: "SharedModelFileReadFailed",
        message: error.message || "Shared model file does not exist."
      });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/admin/assets") {
    try {
      assertAdmin(req);
      sendJson(res, 200, buildAdminAssetResponse());
    } catch (error) {
      sendJson(res, error.status || 403, {
        error: "Forbidden",
        message: error.message || "没有权限。"
      });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/admin/clients") {
    try {
      assertAdmin(req);
      sendJson(res, 200, buildAdminClientResponse());
    } catch (error) {
      sendJson(res, error.status || 403, {
        error: "Forbidden",
        message: error.message || "没有权限。"
      });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/admin/users") {
    try {
      assertAdmin(req);
      sendJson(res, 200, buildAdminUserResponse());
    } catch (error) {
      sendJson(res, error.status || 403, {
        error: "Forbidden",
        message: error.message || "没有权限。"
      });
    }
    return;
  }

  if (req.method === "GET" && isAdminCreditRoute(requestUrl.pathname)) {
    try {
      assertAdmin(req);
      sendJson(res, 200, buildAdminCreditResponse());
    } catch (error) {
      sendJson(res, error.status || 403, {
        error: "Forbidden",
        message: error.message || "没有权限。"
      });
    }
    return;
  }

  if (req.method === "POST" && isAdminCreditRoute(requestUrl.pathname)) {
    try {
      const session = assertAdmin(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      sendJson(res, 201, {
        ok: true,
        record: adjustUserCreditsByAdmin({
          ...payload,
          operatorId: session.user.id
        }),
        ...buildAdminCreditResponse()
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "CreditAdjustFailed",
        message: error.message || "积分调整失败。"
      });
      return;
    }
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/credits/consume-download") {
    try {
      const session = assertAuthenticated(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      const creditRecord = consumeUserCreditsForAction(session.user.id, "download", {
        source: normalizeText(payload?.source || "manual_download"),
        taskId: normalizeText(payload?.taskId || ""),
        modelId: normalizeText(payload?.modelId || "")
      });
      sendJson(res, 200, {
        ok: true,
        creditRecord,
        credits: buildUserCreditSummary(session.user.id)
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "CreditConsumeFailed",
        message: error.message || "积分扣除失败。",
        details: error.details || null
      });
      return;
    }
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/admin/users") {
    try {
      assertAdmin(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      sendJson(res, 201, {
        ok: true,
        user: createAdminUser(payload),
        ...buildAdminUserResponse()
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "AdminUserCreateFailed",
        message: error.message || "Failed to create user."
      });
      return;
    }
  }

  const adminUserMatch = requestUrl.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (adminUserMatch && req.method === "PUT") {
    try {
      assertAdmin(req);
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      sendJson(res, 200, {
        ok: true,
        user: updateAdminUser(adminUserMatch[1], payload),
        ...buildAdminUserResponse()
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "AdminUserUpdateFailed",
        message: error.message || "Failed to update user."
      });
      return;
    }
  }

  if (adminUserMatch && req.method === "DELETE") {
    try {
      assertAdmin(req);
      deleteAdminUser(adminUserMatch[1]);
      sendJson(res, 200, buildAdminUserResponse());
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "AdminUserDeleteFailed",
        message: error.message || "Failed to delete user."
      });
      return;
    }
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/player-session") {
    try {
      const request = toWebRequest(req, requestUrl);
      const payload = await request.json();
      const session = upsertPlayerClientSession(payload, req);
      sendJson(res, 200, {
        ok: true,
        sessionId: session.sessionId,
        active: session.active
      });
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "PlayerSessionUpdateFailed",
        message: error.message || "Failed to update player session."
      });
      return;
    }
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
    let consumedCreditRecord = null;
    try {
      const session = assertAuthenticated(req);
      const request = toWebRequest(req, requestUrl);
      const form = await request.formData();
      const generatorSettings = getGeneratorSettings();
      const providers = buildProviderConfigMap();
      const requestedProvider = normalizeProvider(form.get("provider"));
      const provider = providers[requestedProvider]?.enabled ? requestedProvider : generatorSettings.provider;
      const modelVersion = resolveModelVersion(provider, form.get("modelVersion"), providers);
      consumedCreditRecord = consumeUserCreditsForAction(session.user.id, "generate", {
        provider,
        mode: normalizeText(form.get("mode") || "text"),
        prompt: normalizeText(form.get("prompt") || "")
      });
      form.set("provider", provider);
      form.set("modelVersion", modelVersion);

      if (GENERATOR_API_BASE) {
        const remoteResult = await proxyRemoteJson("/api/generate", {
          method: "POST",
          body: form
        });
        const responseBody = {
          ...remoteResult,
          generatorApiBase: GENERATOR_API_BASE,
          proxied: true
        };
        recordGeneratedTask(responseBody, {
          provider,
          modelVersion,
          mode: form.get("mode"),
          prompt: form.get("prompt"),
          userId: session.user.id
        });
        sendJson(res, 200, responseBody);
        return;
      }

      if (provider === "meshy") {
        await handleMeshyGenerate(res, form);
      } else {
        await handleTripoGenerate(res, form);
      }
      return;
    } catch (error) {
      refundConsumedCredits(consumedCreditRecord, "AI生成失败退回");
      sendJson(res, error.status || 400, {
        error: "GenerationFailed",
        message: error.message || "Failed to create task.",
        details: error.details || null
      });
      return;
    }
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/model-optimize") {
    let consumedCreditRecord = null;
    try {
      const session = assertAuthenticated(req);
      const request = toWebRequest(req, requestUrl);
      const form = await request.formData();
      const provider = normalizeProvider(form.get("provider"));
      const operation = normalizeOptimizationOperation(form.get("operation"));
      consumedCreditRecord = consumeUserCreditsForAction(session.user.id, "optimize", {
        provider,
        operation
      });

      if (GENERATOR_API_BASE) {
        try {
          const remoteResult = await proxyRemoteJson("/api/model-optimize", {
            method: "POST",
            body: form
          });
          sendJson(res, 200, {
            ...remoteResult,
            generatorApiBase: GENERATOR_API_BASE,
            proxied: true
          });
          return;
        } catch (error) {
          if (error.status && ![401, 403, 404, 501].includes(error.status)) {
            throw error;
          }
        }
      }

      await handleModelOptimize(res, form);
      return;
    } catch (error) {
      refundConsumedCredits(consumedCreditRecord, "AI优化失败退回");
      sendJson(res, error.status || 400, {
        error: "ModelOptimizeFailed",
        message: error.message || "Failed to create optimization task.",
        details: error.details || null
      });
      return;
    }
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/task/")) {
    const taskId = requestUrl.pathname.split("/").pop();
    const provider = normalizeProvider(requestUrl.searchParams.get("provider"));
    const session = getAuthenticatedSession(req);

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
        const responseBody = {
          ...remoteTask,
          generatorApiBase: GENERATOR_API_BASE,
          proxied: true
        };
        recordGeneratedTask(responseBody, { provider, taskId });
        await attachPersistedGeneratedModel(responseBody, session?.user?.id);
        sendJson(res, 200, responseBody);
        return;
      }

      if (provider === "meshy") {
        await handleMeshyTaskQuery(res, taskId, session?.user?.id);
      } else {
        await handleTripoTaskQuery(res, taskId, session?.user?.id);
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

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/model-optimize/task/")) {
    const taskId = requestUrl.pathname.split("/").pop();
    const provider = normalizeProvider(requestUrl.searchParams.get("provider"));
    const operation = normalizeOptimizationOperation(requestUrl.searchParams.get("operation"));

    if (!taskId) {
      sendJson(res, 400, {
        error: "ValidationError",
        message: "Missing optimization task id."
      });
      return;
    }

    try {
      if (GENERATOR_API_BASE) {
        try {
          const remoteTask = await proxyRemoteJson(
            `/api/model-optimize/task/${encodeURIComponent(taskId)}?provider=${encodeURIComponent(provider)}&operation=${encodeURIComponent(operation)}`
          );
          sendJson(res, 200, {
            ...remoteTask,
            generatorApiBase: GENERATOR_API_BASE,
            proxied: true
          });
          return;
        } catch (error) {
          if (error.status && ![401, 403, 404, 501].includes(error.status)) {
            throw error;
          }
        }
      }

      await handleModelOptimizeTaskQuery(res, taskId, provider, operation);
      return;
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: "ModelOptimizeTaskQueryFailed",
        message: error.message || "Failed to query optimization task.",
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

  const responseBody = {
    ok: true,
    provider: "tripo",
    providerName: "Tripo3D",
    mode,
    taskId: createResult.task_id || null,
    displayModelVersion: modelVersion,
    payload,
    upload: uploadInfo,
    raw: tripoResponse
  };

  recordGeneratedTask(responseBody, {
    provider: "tripo",
    providerName: "Tripo3D",
    mode,
    prompt,
    modelVersion
  });
  sendJson(res, 200, responseBody);
}

async function handleTripoTaskQuery(res, taskId, userId = "") {
  ensureProviderEnabled("tripo");

  const task = await tripoFetch(`/task/${taskId}`, { method: "GET" });
  const taskResult = unwrapTripoData(task);
  const output = taskResult.output || {};
  const preferredModelUrl = output.model || output.pbr_model || output.base_model || null;

  const responseBody = {
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
    stageText: "Tripo3D 鐢熸垚浠诲姟",
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
  };

  recordGeneratedTask(responseBody, { provider: "tripo", taskId, userId });
  await attachPersistedGeneratedModel(responseBody, userId);
  sendJson(res, 200, responseBody);
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

  const responseBody = {
    ok: true,
    provider: "meshy",
    providerName: "Meshy",
    mode,
    taskId,
    displayModelVersion: modelVersion,
    payload,
    raw: meshyResponse
  };

  recordGeneratedTask(responseBody, {
    provider: "meshy",
    providerName: "Meshy",
    mode,
    prompt,
    modelVersion
  });
  sendJson(res, 200, responseBody);
}

async function handleMeshyTaskQuery(res, taskId, userId = "") {
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
      statusText: "棰勮闃舵瀹屾垚锛屾鍦ㄨ繘鍏ヨ创鍥鹃樁娈?..",
      stageText: "Meshy 璐村浘闃舵",
      transition: {
        nextTaskId: refineTaskId,
        stageText: "Meshy 璐村浘闃舵",
        statusText: "棰勮闃舵瀹屾垚锛屾鍦ㄨ繘鍏ヨ创鍥鹃樁娈?.."
      }
    });
    return;
  }

  recordGeneratedTask(normalized, { provider: "meshy", taskId, userId });
  await attachPersistedGeneratedModel(normalized, userId);
  sendJson(res, 200, normalized);
}

async function handleModelOptimize(res, form) {
  const provider = normalizeProvider(form.get("provider"));
  const operation = normalizeOptimizationOperation(form.get("operation"));

  if (provider === "meshy" && operation === "retexture") {
    await handleMeshyRetexture(res, form);
    return;
  }

  const error = new Error(buildUnsupportedOptimizationMessage(provider, operation));
  error.status = 400;
  error.details = {
    provider,
    operation,
    support: buildOptimizationConfigMap().providers?.[provider]?.operations?.[operation] || null
  };
  throw error;
}

async function handleModelOptimizeTaskQuery(res, taskId, provider, operation) {
  if (provider === "meshy" && operation === "retexture") {
    await handleMeshyRetextureTaskQuery(res, taskId);
    return;
  }

  const error = new Error(buildUnsupportedOptimizationMessage(provider, operation));
  error.status = 400;
  error.details = {
    provider,
    operation,
    taskId
  };
  throw error;
}

async function handleMeshyRetexture(res, form) {
  ensureProviderEnabled("meshy");

  const modelVersion = String(form.get("modelVersion") || "latest");
  const modelUrl = normalizeText(form.get("modelUrl"));
  const modelFile = form.get("modelFile");
  const texturePrompt = normalizeText(form.get("texturePrompt"));
  const styleImage = form.get("styleImage");
  const target = normalizeText(form.get("target")) || "preview";
  const saveMode = normalizeText(form.get("saveMode")) || "new_revision";
  const preserveUv = parseBoolean(form.get("preserveUv"), true);
  const enablePbr = parseBoolean(form.get("enablePbr"), true);
  const removeLighting = parseBoolean(form.get("removeLighting"), true);

  let sourceUrl = modelUrl;
  if (!(sourceUrl && isHttpUrl(sourceUrl))) {
    sourceUrl = "";
  }

  if (!sourceUrl) {
    if (!(modelFile instanceof File) || modelFile.size === 0) {
      const error = new Error("Retexture requires a model file or a valid model URL.");
      error.status = 400;
      throw error;
    }

    sourceUrl = await fileToDataUri(modelFile, getMimeTypeForModelFile(modelFile));
  }

  const payload = {
    model_url: sourceUrl,
    ai_model: modelVersion,
    enable_original_uv: preserveUv,
    enable_pbr: enablePbr,
    remove_lighting: removeLighting
  };

  if (texturePrompt) {
    payload.text_style_prompt = texturePrompt;
  }

  if (styleImage instanceof File && styleImage.size > 0) {
    payload.image_url = await fileToDataUri(styleImage);
  }

  const meshyResponse = await meshyFetch("/openapi/v1/retexture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const taskId = meshyResponse.result || meshyResponse.id || null;
  if (taskId) {
    optimizationTaskContexts.set(taskId, {
      provider: "meshy",
      operation: "retexture",
      modelVersion,
      target,
      saveMode
    });
  }

  sendJson(res, 200, {
    ok: true,
    provider: "meshy",
    providerName: "Meshy",
    operation: "retexture",
    taskId,
    displayModelVersion: modelVersion,
    target,
    saveMode,
    payload,
    raw: meshyResponse
  });
}

async function handleMeshyRetextureTaskQuery(res, taskId) {
  ensureProviderEnabled("meshy");

  const context = optimizationTaskContexts.get(taskId) || null;
  const task = await meshyFetch(`/openapi/v1/retexture/${taskId}`, { method: "GET" });

  sendJson(res, 200, normalizeMeshyRetextureTask(task, context, taskId));
}

function normalizeMeshyRetextureTask(task, context, fallbackTaskId) {
  const rawUrls = task.model_urls || {};
  const normalizedStatus = normalizeMeshyStatus(task.status);
  const taskId = task.id || fallbackTaskId;

  return {
    ok: true,
    provider: "meshy",
    providerName: "Meshy",
    operation: "retexture",
    taskId,
    type: task.type || "retexture",
    status: normalizedStatus,
    statusText: task.task_error?.message || normalizedStatus,
    progress: typeof task.progress === "number" ? task.progress : 0,
    finalized: NORMALIZED_FINAL_STATUSES.has(normalizedStatus),
    stageText: "Meshy AI璐村浘浠诲姟",
    displayModelVersion: context?.modelVersion || task.ai_model || "latest",
    input: {
      textStylePrompt: task.text_style_prompt || "",
      imageUrl: task.image_url || "",
      target: context?.target || "preview",
      saveMode: context?.saveMode || "new_revision"
    },
    output: rawUrls,
    renderedImage: task.thumbnail_url || null,
    preferredModelUrl:
      rawUrls.glb ||
      rawUrls.fbx ||
      rawUrls.obj ||
      rawUrls.stl ||
      null,
    modelUrls: {
      glb: rawUrls.glb || null,
      fbx: rawUrls.fbx || null,
      obj: rawUrls.obj || null,
      mtl: rawUrls.mtl || null,
      stl: rawUrls.stl || null
    },
    downloadItems: buildMeshyDownloadItems(rawUrls, task.thumbnail_url),
    raw: task
  };
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
    ".stl": "model/stl",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bin": "application/octet-stream",
    ".mtl": "text/plain; charset=utf-8"
  };
  return map[ext] || "application/octet-stream";
}

async function fileToDataUri(file, mimeTypeOverride = "") {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = mimeTypeOverride || file.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
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

function normalizeOptimizationOperation(value) {
  return String(value || "retexture").toLowerCase() === "split" ? "split" : "retexture";
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isHttpUrl(value) {
  try {
    const target = new URL(String(value));
    return target.protocol === "http:" || target.protocol === "https:";
  } catch {
    return false;
  }
}

function getMimeTypeForModelFile(file) {
  const ext = path.extname(file.name || "").toLowerCase();
  return inferAssetContentType(ext);
}

function buildUnsupportedOptimizationMessage(provider, operation) {
  if (operation === "split") {
    return `${provider === "tripo" ? "Tripo3D" : "Meshy"} 的 AI 拆模型流程已在页面和接口上预留，但当前本地运行时尚未接入公开可用的拆件服务。`;
  }

  if (provider === "tripo") {
    return "Tripo3D 的 AI 贴图流程已在页面和接口上预留，但当前本地运行时尚未接入公开开发者端点。";
  }

  return "当前优化能力不可用。";
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
    return "Meshy 棰勮闃舵";
  }

  if (type === "text-to-3d-refine") {
    return "Meshy 璐村浘闃舵";
  }

  if (String(type).includes("image")) {
    return "Meshy 鍥剧墖鐢熸垚闃舵";
  }

  return "Meshy 鐢熸垚浠诲姟";
}

function buildTripoDownloadItems(output) {
  const items = [];
  if (output.model) items.push({ label: "涓嬭浇妯″瀷", url: output.model });
  if (output.pbr_model) items.push({ label: "涓嬭浇 PBR 妯″瀷", url: output.pbr_model });
  if (output.base_model) items.push({ label: "涓嬭浇 Base 妯″瀷", url: output.base_model });
  if (output.rendered_image || output.generated_image) {
    items.push({ label: "下载预览图", url: output.rendered_image || output.generated_image });
  }
  return items;
}

function buildMeshyDownloadItems(modelUrls, thumbnailUrl) {
  const labels = {
    glb: "涓嬭浇 GLB",
    pre_remeshed_glb: "涓嬭浇鍘熷 GLB",
    fbx: "涓嬭浇 FBX",
    obj: "涓嬭浇 OBJ",
    mtl: "涓嬭浇 MTL",
    stl: "涓嬭浇 STL",
    usdz: "涓嬭浇 USDZ"
  };

  const items = [];
  for (const [key, url] of Object.entries(modelUrls || {})) {
    if (url) {
      items.push({ label: labels[key] || `涓嬭浇 ${key.toUpperCase()}`, url });
    }
  }

  if (thumbnailUrl) {
    items.push({ label: "下载预览图", url: thumbnailUrl });
  }

  return items;
}

function buildAdminAssetResponse() {
  const tasks = Array.from(generatedTaskRecords.values())
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
      return rightTime - leftTime;
    });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: tasks.length,
    tasks
  };
}

function buildAdminClientResponse() {
  const now = Date.now();
  const clients = Array.from(playerClientSessions.values())
    .map((client) => ({
      ...client,
      active: now - (Date.parse(client.lastSeenAt) || 0) <= PLAYER_CLIENT_ACTIVE_MS
    }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.lastSeenAt || 0) || 0;
      const rightTime = Date.parse(right.lastSeenAt || 0) || 0;
      return rightTime - leftTime;
    });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    activeWindowSeconds: Math.round(PLAYER_CLIENT_ACTIVE_MS / 1000),
    total: clients.length,
    activeTotal: clients.filter((client) => client.active).length,
    clients
  };
}

function buildAdminUserResponse() {
  const users = readAdminUsersFile().users
    .map((user) => toPublicAdminUser(user))
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.createdAt || 0) || 0;
      return rightTime - leftTime;
    });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: users.length,
    users
  };
}

function buildWorkMeResponse(userId) {
  const user = getPublicUserById(userId);
  if (!user) {
    throwHttpError(404, "用户不存在。");
  }

  const creditSummary = buildUserCreditSummary(user.id);
  const storage = getUserModelStorageSummary(user.id, user.modelStorageQuotaBytes);
  return {
    ok: true,
    user: {
      ...user,
      credits: creditSummary.balance,
      storage
    },
    credits: creditSummary,
    storage
  };
}

function buildUserModelResponse(userId) {
  const user = getPublicUserById(userId);
  if (!user) {
    throwHttpError(404, "用户不存在。");
  }

  const store = readUserModelIndexFile();
  const models = getUserModelRecords(userId, store);
  const storage = getUserModelStorageSummary(userId, user.modelStorageQuotaBytes, store);
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    storage,
    models
  };
}

function buildSharedModelResponse() {
  const store = readUserModelIndexFile();
  const models = store.models
    .filter((model) => normalizeShareVisibility(model.visibility || (model.isPublic ? "public" : "private")) === "public")
    .sort((left, right) => {
      const leftTime = Date.parse(left.sharedAt || left.updatedAt || left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.sharedAt || right.updatedAt || right.createdAt || 0) || 0;
      return rightTime - leftTime;
    })
    .map(toPublicSharedModel);
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: models.length,
    models
  };
}

async function handleUserModelUpload(req, userId) {
  const user = getPublicUserById(userId);
  if (!user) {
    throwHttpError(404, "用户不存在。");
  }

  const store = readUserModelIndexFile();
  const storage = getUserModelStorageSummary(userId, user.modelStorageQuotaBytes, store);
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 0 && storage.usedBytes + contentLength > storage.quotaBytes + 1024 * 1024) {
    const error = new Error("个人 3D 模型空间不足，请先手动删除自己的 3D 模型文件后再上传。");
    error.status = 413;
    error.code = "StorageQuotaExceeded";
    error.details = storage;
    throw error;
  }

  const uploadId = crypto.randomUUID();
  const uploadDir = getUserModelUploadDir(userId, uploadId);
  await fsp.mkdir(uploadDir, { recursive: true });

  let uploaded;
  try {
    uploaded = await parseMultipartModelUpload(req, {
      uploadDir,
      userId,
      initialUsedBytes: storage.usedBytes,
      quotaBytes: storage.quotaBytes
    });
  } catch (error) {
    await fsp.rm(uploadDir, { recursive: true, force: true });
    throw error;
  }

  if (!uploaded.files.length) {
    await fsp.rm(uploadDir, { recursive: true, force: true });
    throwHttpError(400, "请选择要上传的 3D 模型文件。");
  }

  const entryFile = pickModelEntryFile(uploaded.files);
  if (!entryFile) {
    await fsp.rm(uploadDir, { recursive: true, force: true });
    throwHttpError(400, "上传文件中未找到可预览的 3D 主文件，请上传 GLB、GLTF、FBX、OBJ 或 STL。");
  }

  const coverFile = uploaded.files.find((file) => file.fieldName === "cover" && isImageUploadFile(file));
  if (uploaded.files.some((file) => file.fieldName === "cover" && !isImageUploadFile(file))) {
    await fsp.rm(uploadDir, { recursive: true, force: true });
    throwHttpError(400, "模型封面仅支持 JPG、PNG 或 WebP 图片。");
  }

  if (MODEL_STORAGE_DRIVER === "oss") {
    try {
      await uploadUserModelFilesToOss(userId, uploadId, uploaded.files, uploadDir);
      await fsp.rm(uploadDir, { recursive: true, force: true });
    } catch (error) {
      await fsp.rm(uploadDir, { recursive: true, force: true });
      throw error;
    }
  }

  const now = new Date().toISOString();
  const model = {
    id: uploadId,
    userId,
    name: normalizeText(uploaded.fields.name) || stripKnownModelExtension(entryFile.originalName),
    entryFile: entryFile.storedName,
    coverFile: coverFile?.storedName || "",
    storageDriver: MODEL_STORAGE_DRIVER,
    format: path.extname(entryFile.originalName).replace(".", "").toUpperCase(),
    fileSizeBytes: uploaded.totalBytes,
    files: uploaded.files,
    createdAt: now,
    updatedAt: now
  };

  store.models = [model, ...store.models.filter((item) => item.id !== model.id)];
  writeUserModelIndexFile(store);

  return {
    ok: true,
    model: toPublicUserModel(model),
    ...buildUserModelResponse(userId)
  };
}

async function serveUserModelFile(req, res, userId, modelId, encodedFileName) {
  const model = getUserModelRecord(userId, modelId);
  if (!model) {
    throwHttpError(404, "模型记录不存在。");
  }

  const fileName = decodeURIComponent(encodedFileName);
  const file = model.files.find((item) => item.storedName === fileName || item.originalName === fileName);
  if (!file) {
    throwHttpError(404, "模型文件不存在。");
  }

  if (file.storageDriver === "oss" && file.objectKey) {
    await proxyOssObject(req, res, file.objectKey, file);
    return;
  }

  const filePath = path.join(getUserModelUploadDir(userId, model.id), file.storedName);
  const normalizedFilePath = path.normalize(filePath);
  const uploadDir = getUserModelUploadDir(userId, model.id);
  if (!normalizedFilePath.startsWith(uploadDir)) {
    throwHttpError(403, "文件路径非法。");
  }

  const stat = await fsp.stat(normalizedFilePath);
  res.writeHead(200, {
    "Content-Type": inferAssetContentType(path.extname(file.storedName).toLowerCase()),
    "Content-Length": stat.size,
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(normalizedFilePath).pipe(res);
}

async function serveSharedModelFile(req, res, modelId, encodedFileName) {
  const model = getSharedModelRecord(modelId);
  if (!model) {
    throwHttpError(404, "Shared model does not exist.");
  }

  const fileName = decodeURIComponent(encodedFileName);
  const file = model.files.find((item) => item.storedName === fileName || item.originalName === fileName);
  if (!file) {
    throwHttpError(404, "Shared model file does not exist.");
  }

  if (file.storageDriver === "oss" && file.objectKey) {
    await proxyOssObject(req, res, file.objectKey, file);
    return;
  }

  const filePath = path.join(getUserModelUploadDir(model.userId, model.id), file.storedName);
  const normalizedFilePath = path.normalize(filePath);
  const uploadDir = getUserModelUploadDir(model.userId, model.id);
  if (!normalizedFilePath.startsWith(uploadDir)) {
    throwHttpError(403, "Invalid shared model file path.");
  }

  const stat = await fsp.stat(normalizedFilePath);
  res.writeHead(200, {
    "Content-Type": inferAssetContentType(path.extname(file.storedName).toLowerCase()),
    "Content-Length": stat.size,
    "Cache-Control": "public, max-age=3600",
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(normalizedFilePath).pipe(res);
}

async function resolveUserModelDownloadSource(userId, modelId, requestUrl) {
  const store = readUserModelIndexFile();
  let model = getUserModelRecord(userId, modelId, store);
  if (!model) {
    throwHttpError(404, "模型记录不存在。");
  }

  const format = normalizeText(requestUrl.searchParams.get("format") || model.format || "").toLowerCase();
  const localSource = buildLocalModelDownloadSource(model);
  if (model.source !== "ai" || model.downloadStrategy !== "remote-first") {
    return localSource;
  }

  const remoteUrl = selectRemoteModelUrl(model, format);
  if (remoteUrl && !isRemoteUrlExpired(model.remoteUrlExpiresAt, remoteUrl)) {
    return buildRemoteModelDownloadSource(model, remoteUrl);
  }

  const refreshed = await refreshRemoteModelUrlsForUserModel(store, model);
  if (refreshed) {
    model = refreshed;
    const refreshedUrl = selectRemoteModelUrl(model, format);
    if (refreshedUrl && !isRemoteUrlExpired(model.remoteUrlExpiresAt, refreshedUrl)) {
      return buildRemoteModelDownloadSource(model, refreshedUrl);
    }
  }

  return localSource;
}

function buildLocalModelDownloadSource(model) {
  return {
    ok: true,
    source: "local",
    url: `/api/work/models/${encodeURIComponent(model.id)}/files/${encodeURIComponent(model.entryFile)}`,
    fileName: buildUserModelDownloadFileName(model),
    strategy: model.downloadStrategy || "local-first"
  };
}

function buildRemoteModelDownloadSource(model, url) {
  return {
    ok: true,
    source: "remote",
    url,
    fileName: buildUserModelDownloadFileName(model),
    expiresAt: inferRemoteUrlExpiresAt(url) || model.remoteUrlExpiresAt || "",
    strategy: "remote-first"
  };
}

function buildUserModelDownloadFileName(model) {
  const file = model.files.find((item) => item.storedName === model.entryFile) || model.files[0];
  return sanitizeUploadFileName(file?.originalName || model.entryFile || `${model.name || "model"}.${String(model.format || "glb").toLowerCase()}`);
}

function resolveGeneratedTaskDownloadSource(userId, taskId, requestUrl) {
  const task = generatedTaskRecords.get(normalizeText(taskId));
  if (!task || task.userId !== userId) {
    throwHttpError(404, "生成模型记录不存在。");
  }

  const format = normalizeText(requestUrl.searchParams.get("format") || "").toLowerCase();
  const urls = collectRemoteModelUrlsFromTask(task);
  const requested = format ? urls[format] || urls[format.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] : "";
  const url = requested || urls.model || urls.glb || task.preferredModelUrl || "";
  if (!isHttpUrl(url) && !String(url || "").startsWith("/")) {
    throwHttpError(404, "当前任务还没有可下载的模型文件。");
  }

  return {
    ok: true,
    source: isHttpUrl(url) ? "remote" : "local",
    url,
    fileName: buildGeneratedTaskDownloadFileName(task, format),
    strategy: isHttpUrl(url) ? "remote-first" : "local-first"
  };
}

function buildGeneratedTaskDownloadFileName(task, format = "") {
  const extension = normalizeText(format || inferModelExtensionFromTask(task, task.preferredModelUrl || "") || "glb")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase() || "glb";
  const baseName = sanitizeUploadFileName(getGeneratedTaskPrompt(task) || task.taskId || "generated-model")
    .replace(/\.[a-z0-9]+$/i, "");
  return `${baseName || "generated-model"}.${extension}`;
}

function selectRemoteModelUrl(model, format = "") {
  const urls = normalizeRemoteModelUrls(model.remoteModelUrls);
  const requestedFormat = normalizeText(format).toLowerCase();
  const preferredKeys = requestedFormat
    ? [requestedFormat, requestedFormat.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), "model", "glb"]
    : ["model", "glb", "pbrModel", "baseModel", "pre_remeshed_glb", "preRemeshedGlb", "fbx", "obj", "stl", "usdz"];

  for (const key of preferredKeys) {
    if (urls[key]) {
      return urls[key];
    }
  }

  return Object.values(urls)[0] || "";
}

function isRemoteUrlExpired(expiresAt, url) {
  const inferred = normalizeText(expiresAt) || inferRemoteUrlExpiresAt(url);
  if (!inferred) {
    return false;
  }
  const time = Date.parse(inferred);
  if (!Number.isFinite(time)) {
    return false;
  }
  return time <= Date.now() + 5 * 60 * 1000;
}

async function refreshRemoteModelUrlsForUserModel(store, model) {
  if (!model.generatedTaskId || !model.provider) {
    return null;
  }

  try {
    const refreshedTask = await fetchNormalizedGeneratedTask(model.provider, model.generatedTaskId, model.mode);
    const remoteModelUrls = collectRemoteModelUrlsFromTask(refreshedTask);
    if (!Object.keys(remoteModelUrls).length) {
      return null;
    }

    const remoteDownloadItems = collectRemoteDownloadItemsFromTask(refreshedTask);
    const remoteUrlExpiresAt = inferEarliestRemoteUrlExpiresAt([
      ...Object.values(remoteModelUrls),
      ...remoteDownloadItems.map((item) => item.url)
    ]);

    store.models = store.models.map((item) => item.id === model.id && item.userId === model.userId
      ? {
          ...item,
          remoteModelUrls,
          remoteDownloadItems,
          remoteUrlExpiresAt,
          downloadStrategy: "remote-first",
          updatedAt: new Date().toISOString()
        }
      : item);
    writeUserModelIndexFile(store);
    return getUserModelRecord(model.userId, model.id, store);
  } catch (error) {
    console.warn("Generated model remote URL refresh failed", error);
    return null;
  }
}

async function fetchNormalizedGeneratedTask(provider, taskId, mode = "text") {
  if (provider === "meshy") {
    ensureProviderEnabled("meshy");
    const context = meshyTaskContexts.get(taskId) || { mode };
    const task = await fetchMeshyTask(taskId, context?.mode || mode);
    return normalizeMeshyTask(task, context, taskId);
  }

  ensureProviderEnabled("tripo");
  const task = await tripoFetch(`/task/${encodeURIComponent(taskId)}`, { method: "GET" });
  const taskResult = unwrapTripoData(task);
  const output = taskResult.output || {};
  return {
    provider: "tripo",
    providerName: "Tripo3D",
    mode: inferTripoMode(taskResult.type),
    taskId: taskResult.task_id || taskId,
    status: taskResult.status,
    output,
    preferredModelUrl: output.model || output.pbr_model || output.base_model || null,
    modelUrls: {
      model: output.model || null,
      pbrModel: output.pbr_model || null,
      baseModel: output.base_model || null
    },
    downloadItems: buildTripoDownloadItems(output),
    renderedImage: output.rendered_image || output.generated_image || null
  };
}

async function deleteUserModel(userId, modelId) {
  const decodedId = decodeURIComponent(modelId);
  const store = readUserModelIndexFile();
  const model = store.models.find((item) => item.userId === userId && item.id === decodedId);
  if (!model) {
    throwHttpError(404, "模型记录不存在。");
  }

  if (model.storageDriver === "oss") {
    await deleteUserModelFilesFromOss(model.files);
  }
  store.models = store.models.filter((item) => !(item.userId === userId && item.id === decodedId));
  writeUserModelIndexFile(store);
  fs.rmSync(getUserModelUploadDir(userId, decodedId), { recursive: true, force: true });
}

async function updateUserModelFromRequest(req, requestUrl, userId, modelId) {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const request = toWebRequest(req, requestUrl);
    const form = await request.formData();
    const payload = {
      name: form.get("name"),
      cover: form.get("cover")
    };
    if (form.has("visibility")) payload.visibility = form.get("visibility");
    if (form.has("shareVisibility")) payload.shareVisibility = form.get("shareVisibility");
    if (form.has("isPublic")) payload.isPublic = form.get("isPublic");
    return updateUserModel(userId, modelId, payload);
  }

  const request = toWebRequest(req, requestUrl);
  const payload = await request.json();
  return updateUserModel(userId, modelId, payload);
}

async function updateUserModel(userId, modelId, payload) {
  const decodedId = decodeURIComponent(modelId);
  const store = readUserModelIndexFile();
  const model = store.models.find((item) => item.userId === userId && item.id === decodedId);
  if (!model) {
    throwHttpError(404, "模型记录不存在。");
  }

  const hasVisibilityUpdate = Object.prototype.hasOwnProperty.call(payload || {}, "visibility")
    || Object.prototype.hasOwnProperty.call(payload || {}, "shareVisibility")
    || Object.prototype.hasOwnProperty.call(payload || {}, "isPublic");
  if (hasVisibilityUpdate) {
    const name = normalizeText(payload?.name);
    if (name) {
      if (name.length > 80) {
        throwHttpError(400, "Model name cannot exceed 80 characters.");
      }
      model.name = name;
    }
    const visibility = normalizeShareVisibility(payload?.visibility ?? payload?.shareVisibility ?? (payload?.isPublic ? "public" : "private"));
    applyUserModelShareVisibility(model, visibility);
    model.updatedAt = new Date().toISOString();
    writeUserModelIndexFile(store);
    return {
      ok: true,
      model: toPublicUserModel(model),
      ...buildUserModelResponse(userId)
    };
  }

  const name = normalizeText(payload?.name);
  if (!name) {
    throwHttpError(400, "请输入模型名称。");
  }
  if (name.length > 80) {
    throwHttpError(400, "模型名称不能超过 80 个字符。");
  }

  model.name = name;
  const coverFile = payload?.cover;
  if (coverFile && typeof coverFile.arrayBuffer === "function" && Number(coverFile.size || 0) > 0) {
    await replaceUserModelCover(userId, model, coverFile);
  }
  model.updatedAt = new Date().toISOString();
  writeUserModelIndexFile(store);

  return {
    ok: true,
    model: toPublicUserModel(model),
    ...buildUserModelResponse(userId)
  };
}

async function replaceUserModelCover(userId, model, coverFile) {
  const originalName = sanitizeUploadFileName(coverFile.name || "cover.png");
  const ext = path.extname(originalName).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    throwHttpError(400, "Cover image must be JPG, PNG, or WebP.");
  }

  const buffer = Buffer.from(await coverFile.arrayBuffer());
  if (!buffer.length) {
    throwHttpError(400, "Cover image is empty.");
  }

  const storedName = `${crypto.randomUUID()}-${originalName}`;
  const uploadDir = getUserModelUploadDir(userId, model.id);
  await fsp.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, storedName);
  const file = {
    originalName,
    storedName,
    fieldName: "cover",
    sizeBytes: buffer.length,
    contentType: coverFile.type || inferAssetContentType(ext),
    storageDriver: MODEL_STORAGE_DRIVER,
    objectKey: ""
  };

  await fsp.writeFile(filePath, buffer);
  try {
    if (MODEL_STORAGE_DRIVER === "oss") {
      const objectKey = buildUserModelObjectKey(userId, model.id, storedName);
      await putOssObject(objectKey, filePath, file.contentType);
      file.objectKey = objectKey;
      await fsp.rm(filePath, { force: true });
    }

    const oldCover = model.coverFile
      ? model.files.find((item) => item.storedName === model.coverFile)
      : model.files.find((item) => item.fieldName === "cover" && isImageUploadFile(item));
    if (oldCover?.objectKey) {
      await deleteOssObject(oldCover.objectKey);
    }
    if (oldCover?.storedName) {
      await fsp.rm(path.join(uploadDir, oldCover.storedName), { force: true });
    }
    model.files = model.files.filter((item) => item.storedName !== oldCover?.storedName);
    model.files.unshift(file);
    model.coverFile = storedName;
    model.fileSizeBytes = model.files.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
  } catch (error) {
    await fsp.rm(filePath, { force: true });
    if (file.objectKey) {
      try {
        await deleteOssObject(file.objectKey);
      } catch {}
    }
    throw error;
  }
}

function buildAdminCreditResponse() {
  const creditStore = readUserCreditsFile();
  const users = readAdminUsersFile().users.map((user) => ({
    ...toPublicAdminUser(user),
    credits: getUserCreditBalance(user.id, creditStore)
  }));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const records = creditStore.records
    .map((record) => ({
      ...record,
      user: userMap.get(record.userId) || null
    }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.createdAt || 0) || 0;
      return rightTime - leftTime;
    });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    users,
    records,
    total: records.length
  };
}

function isAdminCreditRoute(pathname) {
  return pathname === "/api/admin/credits"
    || pathname === "/api/admin/credit"
    || pathname === "/api/admin/points"
    || pathname === "/api/admin/point-records";
}

function loginAdminUser(payload) {
  loadAuthSessions();
  cleanupAuthSessions();

  const username = normalizeAdminUsername(payload?.username);
  const password = String(payload?.password || "");
  if (!password) {
    throwHttpError(400, "请输入登录密码。");
  }

  const store = readAdminUsersFile();
  const user = store.users.find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (!user || user.disabled) {
    throwHttpError(401, "用户名或密码错误。");
  }

  if (!verifyPasswordRecord(password, user.password)) {
    throwHttpError(401, user.password?.hash ? "用户名或密码错误。" : "该用户尚未设置密码，请先在用户管理中设置密码。");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
  const session = {
    token,
    expiresAt,
    user: toPublicAdminUser(user)
  };

  authSessions.set(token, session);
  writeAuthSessionsFile();
  return session;
}

function verifyPasswordRecord(password, passwordRecord) {
  if (!passwordRecord || passwordRecord.algorithm !== "scrypt" || !passwordRecord.salt || !passwordRecord.hash) {
    return false;
  }

  const expected = Buffer.from(passwordRecord.hash, "hex");
  const actual = crypto.scryptSync(password, passwordRecord.salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function getAuthenticatedSession(req) {
  loadAuthSessions();
  cleanupAuthSessions();

  const token = getAuthToken(req);
  if (!token) {
    return null;
  }

  const session = authSessions.get(token);
  if (!session || Date.parse(session.expiresAt || 0) <= Date.now()) {
    authSessions.delete(token);
    writeAuthSessionsFile();
    return null;
  }

  const store = readAdminUsersFile();
  const user = store.users.find((item) => item.id === session.user?.id);
  if (!user || user.disabled) {
    authSessions.delete(token);
    writeAuthSessionsFile();
    return null;
  }

  session.user = toPublicAdminUser(user);
  authSessions.set(token, session);
  writeAuthSessionsFile();
  return session;
}

function assertAuthenticated(req) {
  const session = getAuthenticatedSession(req);
  if (!session) {
    throwHttpError(401, "请先登录后再继续操作。");
  }
  return session;
}

function assertAdmin(req) {
  const session = assertAuthenticated(req);
  if (session.user?.role !== "admin") {
    throwHttpError(403, "仅管理员可以执行该操作。");
  }
  return session;
}

function refreshAuthSessionUser(token, user) {
  const session = authSessions.get(token);
  if (session) {
    session.user = user;
    authSessions.set(token, session);
    writeAuthSessionsFile();
  }
}

function getAuthToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanupAuthSessions() {
  const now = Date.now();
  let changed = false;
  for (const [token, session] of authSessions) {
    if (Date.parse(session.expiresAt || 0) <= now) {
      authSessions.delete(token);
      changed = true;
    }
  }
  if (changed) {
    writeAuthSessionsFile();
  }
}

function loadAuthSessions() {
  if (authSessions.size) {
    return;
  }

  try {
    const parsed = runtimeStores.authSessions || readAuthSessionsJsonFile();
    const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    for (const session of sessions) {
      const token = normalizeText(session?.token);
      if (token && Date.parse(session?.expiresAt || 0) > Date.now()) {
        authSessions.set(token, {
          token,
          expiresAt: normalizeText(session.expiresAt),
          user: session.user && typeof session.user === "object" ? session.user : null
        });
      }
    }
  } catch {
    authSessions.clear();
  }
}

function writeAuthSessionsFile() {
  const sessions = Array.from(authSessions.values()).filter((session) => (
    session?.token && Date.parse(session.expiresAt || 0) > Date.now()
  ));
  const payload = { sessions };
  runtimeStores.authSessions = payload;
  if (pgPool) {
    queueRuntimeStorePersist("auth_sessions", payload);
    return;
  }
  fs.writeFileSync(authSessionsPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function getPublicUserById(userId) {
  const user = readAdminUsersFile().users.find((item) => item.id === userId);
  return user ? toPublicAdminUser(user) : null;
}

function updateSelfUser(userId, payload) {
  const store = readAdminUsersFile();
  const index = store.users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throwHttpError(404, "用户不存在。");
  }

  const current = store.users[index];
  const nextUsername = payload?.username === undefined
    ? current.username
    : normalizeAdminUsername(payload.username);
  const duplicate = store.users.some((user) => {
    return user.id !== current.id && user.username.toLowerCase() === nextUsername.toLowerCase();
  });
  if (duplicate) {
    throwHttpError(409, "用户名已存在。");
  }

  const next = {
    ...current,
    username: nextUsername,
    displayName: payload?.displayName === undefined
      ? current.displayName
      : normalizeText(payload.displayName || nextUsername),
    updatedAt: new Date().toISOString()
  };

  store.users[index] = next;
  writeAdminUsersFile(store);
  return toPublicAdminUser(next);
}

function updateSelfPassword(userId, payload) {
  const currentPassword = String(payload?.currentPassword || "");
  const nextPassword = String(payload?.newPassword || "");
  if (!currentPassword || !nextPassword) {
    throwHttpError(400, "请输入当前密码和新密码。");
  }

  const store = readAdminUsersFile();
  const index = store.users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throwHttpError(404, "用户不存在。");
  }

  const current = store.users[index];
  if (!verifyPasswordRecord(currentPassword, current.password)) {
    throwHttpError(401, "当前密码不正确。");
  }

  store.users[index] = {
    ...current,
    password: buildPasswordRecord(nextPassword),
    updatedAt: new Date().toISOString()
  };
  writeAdminUsersFile(store);
}

function createAdminUser(payload) {
  const store = readAdminUsersFile();
  const now = new Date().toISOString();
  const username = normalizeAdminUsername(payload?.username);
  const displayName = normalizeText(payload?.displayName || username);
  const role = normalizeAdminRole(payload?.role);
  const disabled = Boolean(payload?.disabled);

  if (store.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throwHttpError(409, "用户名已存在。");
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role,
    disabled,
    modelStorageQuotaBytes: parseStorageQuotaGb(payload?.modelStorageQuotaGb),
    password: buildPasswordRecord(payload?.password),
    createdAt: now,
    updatedAt: now
  };

  store.users.push(user);
  writeAdminUsersFile(store);
  grantAutomaticUserCredits(user.id, "new_user_default");
  return toPublicAdminUser(user);
}

function updateAdminUser(id, payload) {
  const store = readAdminUsersFile();
  const decodedId = decodeURIComponent(id);
  const index = store.users.findIndex((user) => user.id === decodedId);
  if (index < 0) {
    throwHttpError(404, "用户不存在。");
  }

  const current = store.users[index];
  const nextUsername = payload?.username === undefined
    ? current.username
    : normalizeAdminUsername(payload.username);
  const duplicate = store.users.some((user) => {
    return user.id !== current.id && user.username.toLowerCase() === nextUsername.toLowerCase();
  });
  if (duplicate) {
    throwHttpError(409, "用户名已存在。");
  }

  const next = {
    ...current,
    username: nextUsername,
    displayName: payload?.displayName === undefined
      ? current.displayName
      : normalizeText(payload.displayName || nextUsername),
    role: payload?.role === undefined ? current.role : normalizeAdminRole(payload.role),
    disabled: payload?.disabled === undefined ? current.disabled : Boolean(payload.disabled),
    modelStorageQuotaBytes: payload?.modelStorageQuotaGb === undefined
      ? normalizeStorageQuotaBytes(current.modelStorageQuotaBytes)
      : parseStorageQuotaGb(payload.modelStorageQuotaGb),
    updatedAt: new Date().toISOString()
  };

  if (payload?.password) {
    next.password = buildPasswordRecord(payload.password);
  }

  assertAtLeastOneActiveAdmin(store.users, next);
  store.users[index] = next;
  writeAdminUsersFile(store);
  return toPublicAdminUser(next);
}

function deleteAdminUser(id) {
  const store = readAdminUsersFile();
  const decodedId = decodeURIComponent(id);
  const index = store.users.findIndex((user) => user.id === decodedId);
  if (index < 0) {
    throwHttpError(404, "用户不存在。");
  }

  const nextUsers = store.users.filter((user) => user.id !== decodedId);
  assertAtLeastOneActiveAdmin(nextUsers);
  writeAdminUsersFile({ users: nextUsers });
}

function assertAtLeastOneActiveAdmin(users, replacement) {
  const nextUsers = replacement
    ? users.map((user) => user.id === replacement.id ? replacement : user)
    : users;
  const hasActiveAdmin = nextUsers.some((user) => user.role === "admin" && !user.disabled);
  if (!hasActiveAdmin) {
    throwHttpError(400, "至少需要保留一个启用状态的管理员。");
  }
}

function readAdminUsersFile() {
  const fallback = {
    users: [createDefaultAdminUser()]
  };

  try {
    const data = runtimeStores.adminUsers || readAdminUsersJsonFile();
    const users = Array.isArray(data?.users) ? data.users : [];
    const normalizedUsers = users
      .map(normalizeStoredAdminUser)
      .filter(Boolean);
    return {
      users: normalizedUsers.length ? normalizedUsers : fallback.users
    };
  } catch {
    return fallback;
  }
}

function writeAdminUsersFile(store) {
  const payload = {
    users: store.users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      disabled: Boolean(user.disabled),
      modelStorageQuotaBytes: normalizeStorageQuotaBytes(user.modelStorageQuotaBytes),
      password: user.password || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  };

  runtimeStores.adminUsers = payload;
  if (pgPool) {
    queueRuntimeStorePersist("admin_users", payload);
    return;
  }
  fs.writeFileSync(adminUsersPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createDefaultAdminUser() {
  const now = new Date().toISOString();
  return {
    id: "admin",
    username: "admin",
    displayName: "管理员",
    role: "admin",
    disabled: false,
    modelStorageQuotaBytes: DEFAULT_USER_MODEL_STORAGE_QUOTA_BYTES,
    password: buildPasswordRecord(DEFAULT_ADMIN_PASSWORD),
    createdAt: now,
    updatedAt: now
  };
}

function normalizeStoredAdminUser(user) {
  const username = normalizeText(user?.username);
  if (!username) {
    return null;
  }

  return {
    id: normalizeText(user?.id) || crypto.randomUUID(),
    username,
    displayName: normalizeText(user?.displayName || username),
    role: normalizeAdminRole(user?.role, "user"),
    disabled: Boolean(user?.disabled),
    modelStorageQuotaBytes: normalizeStorageQuotaBytes(user?.modelStorageQuotaBytes),
    password: normalizeBootstrapAdminPassword(user, username),
    createdAt: normalizeText(user?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(user?.updatedAt) || normalizeText(user?.createdAt) || new Date().toISOString()
  };
}

function normalizeBootstrapAdminPassword(user, username) {
  if (user?.password && typeof user.password === "object") {
    return user.password;
  }

  if (String(user?.id || "").toLowerCase() === "admin" || String(username || "").toLowerCase() === "admin") {
    return buildPasswordRecord(DEFAULT_ADMIN_PASSWORD);
  }

  return null;
}

function normalizeAdminUsername(value) {
  const username = normalizeText(value);
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    throwHttpError(400, "用户名需为 2-32 位字母、数字、下划线、点或短横线。");
  }
  return username;
}

function normalizeAdminRole(value, fallback = "user") {
  const role = normalizeText(value || fallback).toLowerCase();
  if (role !== "admin" && role !== "user") {
    throwHttpError(400, "用户角色只能是管理员或普通用户。");
  }
  return role;
}

function buildPasswordRecord(password) {
  const value = String(password || "");
  if (!value) {
    return null;
  }

  if (value.length < 6) {
    throwHttpError(400, "密码长度至少 6 位。");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return {
    algorithm: "scrypt",
    salt,
    hash
  };
}

function toPublicAdminUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    roleText: user.role === "admin" ? "管理员" : "普通用户",
    credits: getUserCreditBalance(user.id),
    disabled: Boolean(user.disabled),
    statusText: user.disabled ? "已禁用" : "已启用",
    hasPassword: Boolean(user.password?.hash),
    modelStorageQuotaBytes: normalizeStorageQuotaBytes(user.modelStorageQuotaBytes),
    modelStorageQuotaGb: Math.round((normalizeStorageQuotaBytes(user.modelStorageQuotaBytes) / 1024 / 1024 / 1024) * 100) / 100,
    modelStorage: getUserModelStorageSummary(user.id, user.modelStorageQuotaBytes),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function readUserCreditsFile() {
  const fallback = {
    balances: {},
    records: []
  };

  try {
    const parsed = runtimeStores.userCredits || readUserCreditsJsonFile();
    return normalizeUserCreditStore(parsed);
  } catch {
    return fallback;
  }
}

function writeUserCreditsFile(store) {
  const payload = normalizeUserCreditStore(store);
  runtimeStores.userCredits = payload;
  if (pgPool) {
    queueRuntimeStorePersist("user_credits", payload);
    return;
  }
  fs.writeFileSync(userCreditsPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function normalizeUserCreditStore(store) {
  const balances = {};
  for (const [userId, value] of Object.entries(store?.balances || {})) {
    const id = normalizeText(userId);
    if (id) {
      balances[id] = Number(value) || 0;
    }
  }

  const records = Array.isArray(store?.records)
    ? store.records.map(normalizeCreditRecord).filter(Boolean)
    : [];

  return { balances, records };
}

function normalizeCreditRecord(record) {
  const userId = normalizeText(record?.userId);
  if (!userId) {
    return null;
  }

  const amount = Number(record?.amount || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  return {
    id: normalizeText(record?.id) || crypto.randomUUID(),
    userId,
    amount,
    balance: Number(record?.balance || 0),
    type: normalizeText(record?.type || "adjust"),
    title: normalizeText(record?.title || "绉垎璁板綍"),
    note: normalizeText(record?.note || ""),
    operatorId: normalizeText(record?.operatorId || ""),
    meta: record?.meta && typeof record.meta === "object" ? record.meta : {},
    createdAt: normalizeText(record?.createdAt) || new Date().toISOString()
  };
}

function getUserCreditBalance(userId, store = readUserCreditsFile()) {
  return Number(store.balances?.[userId] || 0);
}

function getCreditRecordsForUser(userId, store = readUserCreditsFile()) {
  return store.records
    .filter((record) => record.userId === userId)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.createdAt || 0) || 0;
      return rightTime - leftTime;
    });
}

function buildUserCreditSummary(userId, store = readUserCreditsFile()) {
  return {
    balance: getUserCreditBalance(userId, store),
    costs: CREDIT_COSTS,
    records: getCreditRecordsForUser(userId, store)
  };
}

function consumeUserCreditsForAction(userId, action, meta = {}) {
  const rule = CREDIT_ACTIONS[action];
  if (!rule) {
    throwHttpError(400, "未知积分扣除场景。");
  }

  const cost = Number(CREDIT_COSTS[rule.costKey] || 0);
  return consumeUserCredits(userId, cost, rule.title, {
    action,
    ...meta
  }, rule.type);
}

function assertUserHasCreditsForAction(userId, action) {
  const rule = CREDIT_ACTIONS[action];
  if (!rule) {
    throwHttpError(400, "未知积分扣除场景。");
  }

  const amount = Number(CREDIT_COSTS[rule.costKey] || 0);
  if (!amount) {
    return true;
  }

  const balance = getUserCreditBalance(userId);
  if (balance < amount) {
    throwHttpError(402, `积分不足，当前余额 ${balance}，本次需要 ${amount}。`);
  }
  return true;
}

function appendCreditRecord(store, { userId, amount, type, title, note, operatorId = "", meta = {} }) {
  const balance = getUserCreditBalance(userId, store) + amount;
  store.balances[userId] = balance;
  const record = {
    id: crypto.randomUUID(),
    userId,
    amount,
    balance,
    type,
    title,
    note: normalizeText(note || ""),
    operatorId: normalizeText(operatorId || ""),
    meta,
    createdAt: new Date().toISOString()
  };
  store.records.unshift(record);
  store.records = store.records.slice(0, 1000);
  return record;
}

function consumeUserCredits(userId, cost, title, meta = {}, type = "consume") {
  const amount = Number(cost || 0);
  if (!amount) {
    return null;
  }

  const store = readUserCreditsFile();
  const balance = getUserCreditBalance(userId, store);
  if (balance < amount) {
    throwHttpError(402, `积分不足，当前余额 ${balance}，本次需要 ${amount}。`);
  }

  const record = appendCreditRecord(store, {
    userId,
    amount: -amount,
    type,
    title,
    note: `${title}消耗 ${amount} 积分`,
    meta
  });
  writeUserCreditsFile(store);
  return record;
}

function refundConsumedCredits(record, title) {
  if (!record || Number(record.amount || 0) >= 0) {
    return null;
  }

  const store = readUserCreditsFile();
  const refund = appendCreditRecord(store, {
    userId: record.userId,
    amount: Math.abs(Number(record.amount)),
    type: "refund",
    title,
    note: `鍏宠仈璁板綍锛?{record.id}`,
    meta: {
      source: "auto_refund",
      relatedRecordId: record.id
    }
  });
  writeUserCreditsFile(store);
  return refund;
}

function grantAutomaticUserCredits(userId, ruleType) {
  const amount = Number(AUTO_CREDIT_RULES[ruleType] || 0);
  if (!userId || amount <= 0) {
    return null;
  }

  const store = readUserCreditsFile();
  const record = appendCreditRecord(store, {
    userId,
    amount,
    type: ruleType,
    title: "新用户默认充值",
    note: `系统自动充值 ${amount} 积分`,
    meta: { source: "auto_credit", ruleType }
  });
  writeUserCreditsFile(store);
  return record;
}

function adjustUserCreditsByAdmin(payload) {
  const userId = normalizeText(payload?.userId);
  const type = normalizeCreditAdjustType(payload?.type);
  const rawAmount = Math.abs(Number(payload?.amount || 0));
  const amount = type === "manual_deduct" ? -rawAmount : rawAmount;
  if (!userId) {
    throwHttpError(400, "请选择用户。");
  }
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    throwHttpError(400, "积分变动必须是非 0 数字。");
  }

  const user = getPublicUserById(userId);
  if (!user) {
    throwHttpError(404, "用户不存在。");
  }

  const store = readUserCreditsFile();
  const record = appendCreditRecord(store, {
    userId,
    amount,
    type,
    title: getCreditAdjustTitle(type),
    note: normalizeText(payload?.note || ""),
    operatorId: normalizeText(payload?.operatorId || ""),
    meta: { source: "model-setting" }
  });
  writeUserCreditsFile(store);
  return record;
}

function normalizeCreditAdjustType(type) {
  const value = normalizeText(type || "marketing_gift");
  return value === "manual_deduct" ? "manual_deduct" : "marketing_gift";
}

function getCreditAdjustTitle(type) {
  return type === "manual_deduct" ? "人工扣除" : "营销赠送";
}

function normalizeShareVisibility(value) {
  return normalizeText(value) === "public" ? "public" : "private";
}

function applyUserModelShareVisibility(model, visibility) {
  const previous = normalizeShareVisibility(model.visibility || model.shareVisibility || (model.isPublic ? "public" : "private"));
  const next = normalizeShareVisibility(visibility);
  const now = new Date().toISOString();
  if (previous === next) {
    model.visibility = next;
    model.isPublic = next === "public";
    return;
  }

  model.visibility = next;
  model.isPublic = next === "public";
  if (next === "public") {
    model.sharedAt = model.sharedAt || now;
    model.unsharedAt = "";
    grantModelShareCredits(model.userId, model.id);
    return;
  }

  model.unsharedAt = now;
  revokeRecentModelShareCredits(model.userId, model.id);
}

function grantModelShareCredits(userId, modelId) {
  const store = readUserCreditsFile();
  appendCreditRecord(store, {
    userId,
    amount: 2,
    type: "share_gift",
    title: "分享赠送",
    note: "分享模型公开可见赠送 2 积分",
    meta: {
      source: "model-share",
      modelId
    }
  });
  writeUserCreditsFile(store);
}

function revokeRecentModelShareCredits(userId, modelId) {
  const store = readUserCreditsFile();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const grant = store.records.find((record) => (
    record.userId === userId
    && record.type === "share_gift"
    && Number(record.amount || 0) === 2
    && record.meta?.modelId === modelId
    && (Date.parse(record.createdAt || 0) || 0) >= cutoff
    && !store.records.some((item) => item.type === "share_cancel_deduct" && item.meta?.relatedRecordId === record.id)
  ));
  if (!grant) return null;

  const record = appendCreditRecord(store, {
    userId,
    amount: -2,
    type: "share_cancel_deduct",
    title: "取消分享扣分",
    note: "30 天内取消公开分享，扣回分享赠送 2 积分",
    meta: {
      source: "model-share",
      modelId,
      relatedRecordId: grant.id
    }
  });
  writeUserCreditsFile(store);
  return record;
}

function readUserModelIndexFile() {
  try {
    const parsed = runtimeStores.userModels || readUserModelIndexJsonFile();
    return {
      models: Array.isArray(parsed?.models) ? parsed.models.map(normalizeUserModelRecord).filter(Boolean) : []
    };
  } catch {
    return { models: [] };
  }
}

function writeUserModelIndexFile(store) {
  const models = Array.isArray(store?.models) ? store.models.map(normalizeUserModelRecord).filter(Boolean) : [];
  const payload = { models };
  runtimeStores.userModels = payload;
  if (pgPool) {
    queueRuntimeStorePersist("user_models", payload);
    return;
  }
  fs.writeFileSync(userModelIndexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeUserModelRecord(record) {
  const id = normalizeText(record?.id);
  const userId = normalizeText(record?.userId);
  const files = Array.isArray(record?.files)
    ? record.files.map(normalizeUserModelFileRecord).filter(Boolean)
    : [];
  const entryFile = normalizeText(record?.entryFile) || files[0]?.storedName || "";
  const source = normalizeText(record?.source) || "upload";
  const generatedTaskId = normalizeText(record?.generatedTaskId);
  const provider = normalizeText(record?.provider);
  if (!id || !userId || !entryFile || !files.length) {
    return null;
  }

  return {
    id,
    userId,
    name: normalizeText(record?.name) || stripKnownModelExtension(entryFile),
    entryFile,
    coverFile: normalizeText(record?.coverFile),
    storageDriver: normalizeStorageDriver(record?.storageDriver),
    format: normalizeText(record?.format || path.extname(entryFile).replace(".", "").toUpperCase()),
    fileSizeBytes: files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0),
    files,
    source,
    sourceText: normalizeText(record?.sourceText),
    generatedTaskId,
    provider,
    providerName: normalizeText(record?.providerName),
    mode: normalizeText(record?.mode),
    displayModelVersion: normalizeText(record?.displayModelVersion),
    generationParams: record?.generationParams && typeof record.generationParams === "object" ? record.generationParams : null,
    remoteModelUrls: normalizeRemoteModelUrls(record?.remoteModelUrls),
    remoteDownloadItems: normalizeRemoteDownloadItems(record?.remoteDownloadItems),
    remoteUrlExpiresAt: normalizeText(record?.remoteUrlExpiresAt),
    downloadStrategy: record?.downloadStrategy
      ? normalizeDownloadStrategy(record.downloadStrategy)
      : source === "ai" && generatedTaskId && provider ? "remote-first" : "local-first",
    visibility: normalizeShareVisibility(record?.visibility || record?.shareVisibility || (record?.isPublic ? "public" : "private")),
    isPublic: normalizeShareVisibility(record?.visibility || record?.shareVisibility || (record?.isPublic ? "public" : "private")) === "public",
    sharedAt: normalizeText(record?.sharedAt),
    unsharedAt: normalizeText(record?.unsharedAt),
    createdAt: normalizeText(record?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(record?.updatedAt) || normalizeText(record?.createdAt) || new Date().toISOString()
  };
}

function normalizeUserModelFileRecord(file) {
  const originalName = normalizeText(file?.originalName);
  const storedName = normalizeText(file?.storedName);
  const ext = path.extname(storedName || originalName).toLowerCase();
  if (!originalName || !storedName || !MODEL_UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }

  return {
    originalName,
    storedName,
    fieldName: normalizeText(file?.fieldName),
    sizeBytes: Math.max(0, Number(file?.sizeBytes || 0)),
    contentType: normalizeText(file?.contentType || inferAssetContentType(ext)),
    storageDriver: normalizeStorageDriver(file?.storageDriver),
    objectKey: normalizeObjectKey(file?.objectKey)
  };
}

function normalizeRemoteModelUrls(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const urls = {};
  for (const [key, url] of Object.entries(value)) {
    const normalizedKey = normalizeText(key);
    const normalizedUrl = normalizeText(url);
    if (normalizedKey && isHttpUrl(normalizedUrl)) {
      urls[normalizedKey] = normalizedUrl;
    }
  }
  return urls;
}

function normalizeRemoteDownloadItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      label: normalizeText(item?.label || "Download model"),
      url: normalizeText(item?.url)
    }))
    .filter((item) => isHttpUrl(item.url));
}

function normalizeDownloadStrategy(value) {
  return normalizeText(value) === "remote-first" ? "remote-first" : "local-first";
}

function getUserModelRecords(userId, store = readUserModelIndexFile()) {
  return store.models
    .filter((model) => model.userId === userId)
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
      const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
      return rightTime - leftTime;
    })
    .map(toPublicUserModel);
}

function getOtherUserModelRecords(userId, store = readUserModelIndexFile()) {
  return store.models.filter((model) => model.userId !== userId);
}

function getUserModelRecord(userId, modelId, store = readUserModelIndexFile()) {
  const decodedId = decodeURIComponent(modelId);
  return store.models.find((model) => model.userId === userId && model.id === decodedId) || null;
}

function getSharedModelRecord(modelId, store = readUserModelIndexFile()) {
  const decodedId = decodeURIComponent(modelId);
  return store.models.find((model) => (
    model.id === decodedId
    && normalizeShareVisibility(model.visibility || (model.isPublic ? "public" : "private")) === "public"
  )) || null;
}

function getUserModelStorageSummary(userId, quotaBytes, store = readUserModelIndexFile()) {
  const usedBytes = store.models
    .filter((model) => model.userId === userId)
    .reduce((sum, model) => sum + Number(model.fileSizeBytes || 0), 0);
  const normalizedQuota = normalizeStorageQuotaBytes(quotaBytes);
  return {
    usedBytes,
    quotaBytes: normalizedQuota,
    remainingBytes: Math.max(0, normalizedQuota - usedBytes),
    percent: normalizedQuota > 0 ? Math.min(100, Math.round((usedBytes / normalizedQuota) * 100)) : 0
  };
}

function toPublicUserModel(model) {
  const entry = model.files.find((file) => file.storedName === model.entryFile) || model.files[0];
  const cover = model.coverFile
    ? model.files.find((file) => file.storedName === model.coverFile)
    : model.files.find((file) => file.fieldName === "cover" && isImageUploadFile(file));
  return {
    id: model.id,
    name: model.name,
    source: model.source || "upload",
    sourceText: "我的模型",
    generatedTaskId: model.generatedTaskId || "",
    provider: model.provider || "",
    providerName: model.providerName || "",
    mode: model.mode || "",
    displayModelVersion: model.displayModelVersion || "",
    generationParams: model.generationParams || null,
    remoteModelUrls: model.remoteModelUrls || {},
    remoteDownloadItems: model.remoteDownloadItems || [],
    remoteUrlExpiresAt: model.remoteUrlExpiresAt || "",
    downloadStrategy: model.downloadStrategy || "local-first",
    visibility: normalizeShareVisibility(model.visibility || (model.isPublic ? "public" : "private")),
    isPublic: normalizeShareVisibility(model.visibility || (model.isPublic ? "public" : "private")) === "public",
    sharedAt: model.sharedAt || "",
    unsharedAt: model.unsharedAt || "",
    entryFile: model.entryFile,
    coverFile: cover?.storedName || "",
    coverUrl: cover ? `/api/work/models/${encodeURIComponent(model.id)}/files/${encodeURIComponent(cover.storedName)}` : "",
    format: model.format,
    fileSizeBytes: model.fileSizeBytes,
    modelUrl: `/api/work/models/${encodeURIComponent(model.id)}/files/${encodeURIComponent(model.entryFile)}`,
    files: model.files.map((file) => ({
      originalName: file.originalName,
      storedName: file.storedName,
      fieldName: file.fieldName,
      sizeBytes: file.sizeBytes,
      contentType: file.contentType,
      url: `/api/work/models/${encodeURIComponent(model.id)}/files/${encodeURIComponent(file.storedName)}`
    })),
    contentType: entry?.contentType || "",
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  };
}

function toPublicSharedModel(model) {
  const owner = getPublicUserById(model.userId);
  const entry = model.files.find((file) => file.storedName === model.entryFile) || model.files[0];
  const cover = model.coverFile
    ? model.files.find((file) => file.storedName === model.coverFile)
    : model.files.find((file) => file.fieldName === "cover" && isImageUploadFile(file));
  const buildSharedFileUrl = (file) => `/api/shared/models/${encodeURIComponent(model.id)}/files/${encodeURIComponent(file.storedName)}`;
  return {
    id: model.id,
    name: model.name,
    ownerName: owner?.displayName || owner?.username || "",
    source: model.source || "upload",
    sourceText: model.source === "ai" ? "AI生成" : "我的模型",
    generatedTaskId: model.generatedTaskId || "",
    provider: model.provider || "",
    providerName: model.providerName || "",
    mode: model.mode || "",
    displayModelVersion: model.displayModelVersion || "",
    entryFile: model.entryFile,
    coverFile: cover?.storedName || "",
    coverUrl: cover ? buildSharedFileUrl(cover) : "",
    format: model.format,
    fileSizeBytes: model.fileSizeBytes,
    modelUrl: entry ? buildSharedFileUrl(entry) : "",
    contentType: entry?.contentType || "",
    visibility: "public",
    isPublic: true,
    sharedAt: model.sharedAt || "",
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  };
}

async function attachPersistedGeneratedModel(task, userId) {
  if (!userId || task?.status !== "success" || !task?.preferredModelUrl) {
    return null;
  }

  try {
    const model = await persistGeneratedTaskAsUserModel(userId, task);
    if (!model) return null;
    const publicModel = toPublicUserModel(model);
    task.persistedModel = publicModel;
    task.preferredModelUrl = publicModel.modelUrl;
    task.modelUrls = {
      ...(task.modelUrls || {}),
      model: publicModel.modelUrl,
      glb: publicModel.format === "GLB" ? publicModel.modelUrl : task.modelUrls?.glb || null
    };
    task.downloadItems = [{ label: "Download model", url: publicModel.modelUrl }];
    if (publicModel.coverUrl) {
      task.renderedImage = publicModel.coverUrl;
      task.downloadItems.push({ label: "Download cover", url: publicModel.coverUrl });
    } else {
      task.renderedImage = "";
    }
    task.fileSizeBytes = publicModel.fileSizeBytes;
    return publicModel;
  } catch (error) {
    task.persistError = {
      code: error.code || "GeneratedModelPersistFailed",
      message: error.message || "Generated model could not be saved to OSS."
    };
    return null;
  }
}

async function persistGeneratedTaskAsUserModel(userId, task) {
  const taskId = normalizeText(task?.taskId || task?.id);
  if (!taskId) return null;
  const promiseKey = `${userId}:${taskId}`;
  if (generatedTaskPersistPromises.has(promiseKey)) {
    return generatedTaskPersistPromises.get(promiseKey);
  }

  const promise = persistGeneratedTaskAsUserModelNow(userId, task).finally(() => {
    generatedTaskPersistPromises.delete(promiseKey);
  });
  generatedTaskPersistPromises.set(promiseKey, promise);
  return promise;
}

async function persistGeneratedTaskAsUserModelNow(userId, task) {
  const taskId = normalizeText(task.taskId || task.id);
  const store = readUserModelIndexFile();
  const existing = store.models.find((model) => model.userId === userId && model.generatedTaskId === taskId);
  if (existing) {
    return existing;
  }

  const modelUrl = normalizeText(task.preferredModelUrl);
  if (!isHttpUrl(modelUrl)) {
    return null;
  }

  const modelId = crypto.randomUUID();
  const uploadDir = getUserModelUploadDir(userId, modelId);
  await fsp.mkdir(uploadDir, { recursive: true });
  const downloadedObjectKeys = [];

  try {
    const promptText = getGeneratedTaskPrompt(task);
    const modelExt = inferModelExtensionFromTask(task, modelUrl);
    const modelOriginalName = sanitizeUploadFileName(`${promptText || taskId}${modelExt}`);
    const modelStoredName = `${crypto.randomUUID()}-${modelOriginalName}`;
    const modelPath = path.join(uploadDir, modelStoredName);
    const modelFile = await downloadRemoteAssetToFile(modelUrl, modelPath, {
      originalName: modelOriginalName,
      storedName: modelStoredName,
      fieldName: "files",
      fallbackContentType: inferAssetContentType(modelExt)
    });

    const files = [modelFile];
    const coverUrl = normalizeText(task.renderedImage);
    if (isHttpUrl(coverUrl)) {
      try {
        const coverExt = inferImageExtensionFromUrl(coverUrl);
        const coverOriginalName = sanitizeUploadFileName(`${promptText || taskId}-cover${coverExt}`);
        const coverStoredName = `${crypto.randomUUID()}-${coverOriginalName}`;
        const coverPath = path.join(uploadDir, coverStoredName);
        const coverFile = await downloadRemoteAssetToFile(coverUrl, coverPath, {
          originalName: coverOriginalName,
          storedName: coverStoredName,
          fieldName: "cover",
          fallbackContentType: inferAssetContentType(coverExt)
        });
        files.push(coverFile);
      } catch (error) {
        console.warn("Generated model cover download failed", error);
      }
    }

    const user = getPublicUserById(userId);
    const storage = getUserModelStorageSummary(userId, user?.modelStorageQuotaBytes, store);
    const generatedBytes = files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0);
    if (storage.usedBytes + generatedBytes > storage.quotaBytes) {
      const error = new Error("User model storage quota is not enough for this generated model.");
      error.status = 413;
      error.code = "StorageQuotaExceeded";
      error.details = storage;
      throw error;
    }

    if (MODEL_STORAGE_DRIVER === "oss") {
      assertOssConfigured();
      for (const file of files) {
        const objectKey = buildUserModelObjectKey(userId, modelId, file.storedName);
        await putOssObject(objectKey, path.join(uploadDir, file.storedName), file.contentType);
        downloadedObjectKeys.push(objectKey);
        file.storageDriver = "oss";
        file.objectKey = objectKey;
      }
      await fsp.rm(uploadDir, { recursive: true, force: true });
    }

    const now = new Date().toISOString();
    const remoteModelUrls = collectRemoteModelUrlsFromTask(task);
    const remoteDownloadItems = collectRemoteDownloadItemsFromTask(task);
    const model = {
      id: modelId,
      userId,
      name: promptText || `${task.providerName || task.provider || "AI"} ${taskId}`,
      entryFile: modelStoredName,
      coverFile: files.find((file) => file.fieldName === "cover")?.storedName || "",
      storageDriver: MODEL_STORAGE_DRIVER,
      format: modelExt.replace(".", "").toUpperCase(),
      fileSizeBytes: files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0),
      files,
      source: "ai",
      sourceText: "AI generated",
      generatedTaskId: taskId,
      provider: normalizeText(task.provider),
      providerName: normalizeText(task.providerName),
      mode: normalizeText(task.mode),
      displayModelVersion: normalizeText(task.displayModelVersion),
      generationParams: {
        prompt: promptText,
        status: normalizeText(task.status),
        taskId,
        input: task.input || null
      },
      remoteModelUrls,
      remoteDownloadItems,
      remoteUrlExpiresAt: inferEarliestRemoteUrlExpiresAt([...Object.values(remoteModelUrls), ...remoteDownloadItems.map((item) => item.url)]),
      downloadStrategy: Object.keys(remoteModelUrls).length ? "remote-first" : "local-first",
      createdAt: now,
      updatedAt: now
    };

    store.models = [model, ...store.models.filter((item) => item.id !== model.id)];
    writeUserModelIndexFile(store);
    return model;
  } catch (error) {
    for (const objectKey of downloadedObjectKeys) {
      try {
        await deleteOssObject(objectKey);
      } catch {}
    }
    await fsp.rm(uploadDir, { recursive: true, force: true });
    throw error;
  }
}

function getGeneratedTaskPrompt(task) {
  return normalizeText(
    task?.prompt
    || task?.input?.prompt
    || task?.input?.text_prompt
    || task?.input?.text
    || task?.payload?.prompt
  );
}

function collectRemoteModelUrlsFromTask(task) {
  const urls = {};
  const candidates = {
    ...(task?.modelUrls || {}),
    ...(task?.output || {})
  };

  for (const [key, url] of Object.entries(candidates)) {
    const normalizedUrl = normalizeText(url);
    if (isHttpUrl(normalizedUrl) && isDownloadableModelUrl(normalizedUrl)) {
      urls[normalizeText(key) || inferFormatFromRemoteUrl(normalizedUrl) || "model"] = normalizedUrl;
    }
  }

  const preferredUrl = normalizeText(task?.preferredModelUrl);
  if (isHttpUrl(preferredUrl) && isDownloadableModelUrl(preferredUrl)) {
    urls.model = preferredUrl;
  }

  return urls;
}

function collectRemoteDownloadItemsFromTask(task) {
  return Array.isArray(task?.downloadItems)
    ? task.downloadItems
        .map((item) => ({
          label: normalizeText(item?.label || "Download model"),
          url: normalizeText(item?.url)
        }))
        .filter((item) => isHttpUrl(item.url) && isDownloadableModelUrl(item.url))
    : [];
}

function isDownloadableModelUrl(url) {
  const ext = inferFormatFromRemoteUrl(url);
  return Boolean(ext && MODEL_UPLOAD_ALLOWED_EXTENSIONS.has(`.${ext}`) && !["jpg", "jpeg", "png", "webp"].includes(ext));
}

function inferFormatFromRemoteUrl(url) {
  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    return ext || "";
  } catch {
    return "";
  }
}

function inferEarliestRemoteUrlExpiresAt(urls) {
  const expirations = urls
    .map(inferRemoteUrlExpiresAt)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (!expirations.length) {
    return "";
  }

  return new Date(Math.min(...expirations)).toISOString();
}

function inferRemoteUrlExpiresAt(url) {
  try {
    const target = new URL(url);
    const expires = target.searchParams.get("Expires") || target.searchParams.get("expires");
    if (expires && /^\d+$/.test(expires)) {
      const numeric = Number(expires);
      return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000).toISOString();
    }

    const amzDate = target.searchParams.get("X-Amz-Date");
    const amzExpires = Number(target.searchParams.get("X-Amz-Expires") || 0);
    if (amzDate && amzExpires > 0) {
      const match = amzDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const start = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        return new Date(start + amzExpires * 1000).toISOString();
      }
    }
  } catch {}

  return "";
}

function downloadRemoteAssetToFile(url, filePath, meta) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const client = requestUrl.protocol === "http:" ? http : https;
    const request = client.get(requestUrl, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        const redirectedUrl = new URL(response.headers.location, requestUrl).toString();
        downloadRemoteAssetToFile(redirectedUrl, filePath, meta).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Remote model download failed with status ${response.statusCode}.`));
        return;
      }

      let sizeBytes = 0;
      const output = fs.createWriteStream(filePath);
      response.on("data", (chunk) => {
        sizeBytes += chunk.length;
      });
      response.on("error", reject);
      output.on("error", reject);
      output.on("finish", () => {
        resolve({
          originalName: meta.originalName,
          storedName: meta.storedName,
          fieldName: meta.fieldName,
          sizeBytes,
          contentType: normalizeText(response.headers["content-type"]) || meta.fallbackContentType,
          storageDriver: MODEL_STORAGE_DRIVER,
          objectKey: ""
        });
      });
      response.pipe(output);
    });
    request.on("error", reject);
    request.setTimeout(120000, () => {
      request.destroy(new Error("Remote model download timed out."));
    });
  });
}

function inferModelExtensionFromTask(task, url) {
  const format = normalizeText(task?.format || "").toLowerCase();
  if (format && MODEL_UPLOAD_ALLOWED_EXTENSIONS.has(`.${format}`)) return `.${format}`;
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".glb", ".gltf", ".fbx", ".obj", ".stl"].includes(ext) ? ext : ".glb";
}

function inferImageExtensionFromUrl(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".png";
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function uploadUserModelFilesToOss(userId, modelId, files, uploadDir) {
  assertOssConfigured();
  const uploadedObjectKeys = [];
  try {
    for (const file of files) {
      const objectKey = buildUserModelObjectKey(userId, modelId, file.storedName);
      const filePath = path.join(uploadDir, file.storedName);
      await putOssObject(objectKey, filePath, file.contentType);
      uploadedObjectKeys.push(objectKey);
      file.storageDriver = "oss";
      file.objectKey = objectKey;
    }
  } catch (error) {
    for (const objectKey of uploadedObjectKeys) {
      try {
        await deleteOssObject(objectKey);
      } catch {}
    }
    throw error;
  }
}

async function deleteUserModelFilesFromOss(files) {
  if (!Array.isArray(files) || !files.length) return;
  assertOssConfigured();
  for (const file of files) {
    if (file?.objectKey) {
      await deleteOssObject(file.objectKey);
    }
  }
}

async function proxyOssObject(req, res, objectKey, file) {
  assertOssConfigured();
  const ossHeaders = {};
  if (req.headers.range) {
    ossHeaders.Range = req.headers.range;
  }
  if (req.headers["if-none-match"]) {
    ossHeaders["If-None-Match"] = req.headers["if-none-match"];
  }
  if (req.headers["if-modified-since"]) {
    ossHeaders["If-Modified-Since"] = req.headers["if-modified-since"];
  }

  const response = await requestOssObject({
    method: req.method === "HEAD" ? "HEAD" : "GET",
    objectKey,
    headers: ossHeaders
  });

  if (response.statusCode === 304) {
    drainIncomingMessage(response);
    const headers = {
      "Cache-Control": "private, max-age=3600"
    };
    if (response.headers.etag) {
      headers.ETag = response.headers.etag;
    }
    if (response.headers["last-modified"]) {
      headers["Last-Modified"] = response.headers["last-modified"];
    }
    res.writeHead(304, headers);
    res.end();
    return;
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    drainIncomingMessage(response);
    throwHttpError(response.statusCode === 404 ? 404 : 502, "OSS model file read failed.");
  }

  const headers = {
    "Content-Type": file.contentType || inferAssetContentType(path.extname(file.storedName).toLowerCase()),
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`
  };
  if (response.headers["content-length"]) {
    headers["Content-Length"] = response.headers["content-length"];
  }
  if (response.headers["content-range"]) {
    headers["Content-Range"] = response.headers["content-range"];
  }
  if (response.headers.etag) {
    headers.ETag = response.headers.etag;
  }
  if (response.headers["last-modified"]) {
    headers["Last-Modified"] = response.headers["last-modified"];
  }
  if (response.headers["accept-ranges"]) {
    headers["Accept-Ranges"] = response.headers["accept-ranges"];
  }

  res.writeHead(response.statusCode, headers);
  if (req.method === "HEAD") {
    response.resume();
    res.end();
    return;
  }
  response.pipe(res);
}

async function putOssObject(objectKey, filePath, contentType) {
  const stat = await fsp.stat(filePath);
  const response = await requestOssObject({
    method: "PUT",
    objectKey,
    filePath,
    contentType,
    contentLength: stat.size
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const body = await readIncomingMessageText(response);
    const error = new Error(`OSS upload failed with status ${response.statusCode}.`);
    error.status = 502;
    error.code = "OssUploadFailed";
    error.details = body.slice(0, 1000);
    throw error;
  }
  drainIncomingMessage(response);
}

async function deleteOssObject(objectKey) {
  const response = await requestOssObject({ method: "DELETE", objectKey });
  if (![200, 202, 204, 404].includes(response.statusCode)) {
    const body = await readIncomingMessageText(response);
    const error = new Error(`OSS delete failed with status ${response.statusCode}.`);
    error.status = 502;
    error.code = "OssDeleteFailed";
    error.details = body.slice(0, 1000);
    throw error;
  }
  drainIncomingMessage(response);
}

function requestOssObject({ method, objectKey, filePath = "", contentType = "", contentLength = 0, headers = {} }) {
  return new Promise((resolve, reject) => {
    const date = new Date().toUTCString();
    const requestHeaders = {
      Date: date,
      ...headers
    };
    if (contentType) {
      requestHeaders["Content-Type"] = contentType;
    }
    if (contentLength) {
      requestHeaders["Content-Length"] = contentLength;
    }
    requestHeaders.Authorization = buildOssAuthorization(method, objectKey, {
      contentType,
      date
    });

    const request = https.request({
      method,
      hostname: ALIYUN_OSS_ENDPOINT,
      path: `/${encodeOssObjectKey(objectKey)}`,
      headers: requestHeaders
    }, resolve);

    request.on("error", reject);
    if (filePath) {
      fs.createReadStream(filePath)
        .on("error", reject)
        .pipe(request);
    } else {
      request.end();
    }
  });
}

function buildOssAuthorization(method, objectKey, { contentType = "", date = "" } = {}) {
  const canonicalizedResource = `/${ALIYUN_OSS_BUCKET}/${objectKey}`;
  const stringToSign = [
    method,
    "",
    contentType,
    date,
    canonicalizedResource
  ].join("\n");
  const signature = crypto
    .createHmac("sha1", ALIYUN_OSS_ACCESS_KEY_SECRET)
    .update(stringToSign, "utf8")
    .digest("base64");
  return `OSS ${ALIYUN_OSS_ACCESS_KEY_ID}:${signature}`;
}

function buildUserModelObjectKey(userId, modelId, storedName) {
  return [
    ALIYUN_OSS_PREFIX,
    sanitizePathSegment(userId),
    sanitizePathSegment(modelId),
    sanitizeUploadFileName(storedName)
  ].filter(Boolean).join("/");
}

function assertOssConfigured() {
  if (!ALIYUN_OSS_ACCESS_KEY_ID || !ALIYUN_OSS_ACCESS_KEY_SECRET || !ALIYUN_OSS_BUCKET || !ALIYUN_OSS_ENDPOINT) {
    const error = new Error("OSS storage is not configured. Please set ALIYUN_OSS_ACCESS_KEY_ID and ALIYUN_OSS_ACCESS_KEY_SECRET on the server.");
    error.status = 500;
    error.code = "OssConfigMissing";
    throw error;
  }
}

function normalizeStorageDriver(value) {
  return String(value || "local").toLowerCase() === "oss" ? "oss" : "local";
}

function normalizeObjectPrefix(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function normalizeObjectKey(value) {
  return String(value || "").replace(/^\/+/, "");
}

function normalizeOssEndpoint(value) {
  return String(value || "").replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

function encodeOssObjectKey(objectKey) {
  return String(objectKey || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function readIncomingMessageText(message) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    message.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    message.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    message.on("error", reject);
  });
}

function drainIncomingMessage(message) {
  if (message && typeof message.resume === "function") {
    message.resume();
  }
}

async function parseMultipartModelUpload(req, options) {
  const contentType = String(req.headers["content-type"] || "");
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    throwHttpError(400, "上传请求缺少 multipart boundary。");
  }

  const boundaryText = match[1] || match[2];
  const boundary = Buffer.from(`--${boundaryText}`);
  const boundaryInBody = Buffer.from(`\r\n--${boundaryText}`);
  const headerEnd = Buffer.from("\r\n\r\n");
  const crlf = Buffer.from("\r\n");
  const files = [];
  const fields = {};
  let totalBytes = 0;
  let buffer = Buffer.alloc(0);
  let state = "preamble";
  let part = null;

  const failQuota = () => {
    const error = new Error("个人 3D 模型空间不足，请先手动删除自己的 3D 模型文件后再上传。");
    error.status = 413;
    error.code = "StorageQuotaExceeded";
    error.details = {
      usedBytes: options.initialUsedBytes + totalBytes,
      quotaBytes: options.quotaBytes
    };
    return error;
  };

  const writePartData = async (chunk) => {
    if (!part || !chunk.length) return;
    if (part.type === "field") {
      part.chunks.push(chunk);
      return;
    }

    totalBytes += chunk.length;
    part.sizeBytes += chunk.length;
    if (options.initialUsedBytes + totalBytes > options.quotaBytes) {
      throw failQuota();
    }
    await writeStreamChunk(part.stream, chunk);
  };

  const finishPart = async () => {
    if (!part) return;
    if (part.type === "field") {
      fields[part.name] = Buffer.concat(part.chunks).toString("utf8").trim();
    } else {
      await closeWriteStream(part.stream);
      if (part.sizeBytes > 0) {
        files.push({
          originalName: part.originalName,
          storedName: part.storedName,
          fieldName: part.name,
          sizeBytes: part.sizeBytes,
          contentType: part.contentType
        });
      } else {
        await fsp.rm(part.filePath, { force: true });
      }
    }
    part = null;
  };

  const consume = async () => {
    while (true) {
      if (state === "preamble") {
        const index = buffer.indexOf(boundary);
        if (index < 0) {
          buffer = buffer.slice(Math.max(0, buffer.length - boundary.length));
          return;
        }
        buffer = buffer.slice(index + boundary.length);
        if (buffer.subarray(0, 2).toString() === "--") {
          state = "done";
          return;
        }
        if (buffer.indexOf(crlf) === 0) {
          buffer = buffer.slice(2);
        }
        state = "headers";
      }

      if (state === "headers") {
        const index = buffer.indexOf(headerEnd);
        if (index < 0) return;
        const rawHeaders = buffer.slice(0, index).toString("utf8");
        buffer = buffer.slice(index + headerEnd.length);
        part = createMultipartPart(rawHeaders, options.uploadDir);
        state = "body";
      }

      if (state === "body") {
        const index = buffer.indexOf(boundaryInBody);
        if (index < 0) {
          const keep = boundaryInBody.length + 4;
          const writableLength = buffer.length - keep;
          if (writableLength > 0) {
            await writePartData(buffer.slice(0, writableLength));
            buffer = buffer.slice(writableLength);
            continue;
          }
          return;
        }

        await writePartData(buffer.slice(0, index));
        await finishPart();
        buffer = buffer.slice(index + boundaryInBody.length);
        if (buffer.subarray(0, 2).toString() === "--") {
          state = "done";
          return;
        }
        if (buffer.indexOf(crlf) === 0) {
          buffer = buffer.slice(2);
        }
        state = "headers";
      }

      if (state === "done") {
        return;
      }
    }
  };

  for await (const chunk of req) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    await consume();
  }
  await consume();

  if (part) {
    await finishPart();
  }

  return { fields, files, totalBytes };
}

function createMultipartPart(rawHeaders, uploadDir) {
  const headers = parsePartHeaders(rawHeaders);
  const disposition = headers["content-disposition"] || "";
  const name = getDispositionParam(disposition, "name") || "";
  const filename = getDispositionParam(disposition, "filename");
  if (!filename) {
    return {
      type: "field",
      name,
      chunks: []
    };
  }

  const originalName = sanitizeUploadFileName(filename);
  const ext = path.extname(originalName).toLowerCase();
  if (!MODEL_UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
    throwHttpError(400, `不支持上传 ${ext || "未知"} 文件，请上传 3D 模型及其贴图依赖文件。`);
  }

  const storedName = `${crypto.randomUUID()}-${originalName}`;
  const filePath = path.join(uploadDir, storedName);
  return {
    type: "file",
    name,
    originalName,
    storedName,
    filePath,
    contentType: headers["content-type"] || inferAssetContentType(ext),
    sizeBytes: 0,
    stream: fs.createWriteStream(filePath)
  };
}

function parsePartHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split(/\r\n/)) {
    const index = line.indexOf(":");
    if (index > 0) {
      headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }
  }
  return headers;
}

function getDispositionParam(disposition, key) {
  const pattern = new RegExp(`${key}="([^"]*)"`, "i");
  const quoted = disposition.match(pattern);
  if (quoted) return quoted[1];
  const plain = disposition.match(new RegExp(`${key}=([^;]+)`, "i"));
  return plain ? plain[1].trim() : "";
}

function writeStreamChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (error) => error ? reject(error) : resolve());
  });
}

function closeWriteStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => error ? reject(error) : resolve());
  });
}

function getUserModelUploadDir(userId, modelId) {
  const safeUserId = sanitizePathSegment(userId);
  const safeModelId = sanitizePathSegment(modelId);
  return path.join(userModelStorageRoot, safeUserId, safeModelId);
}

function sanitizePathSegment(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "unknown";
}

function sanitizeUploadFileName(value) {
  const base = path.basename(String(value || "model").replace(/\\/g, "/"));
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 160) || "model";
}

function pickModelEntryFile(files) {
  const priority = [".glb", ".gltf", ".fbx", ".obj", ".stl"];
  return files.find((file) => priority.includes(path.extname(file.originalName).toLowerCase())) || null;
}

function isImageUploadFile(file) {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(file?.originalName || file?.storedName || "").toLowerCase());
}

function stripKnownModelExtension(fileName) {
  const ext = path.extname(fileName || "");
  return ext ? path.basename(fileName, ext) : fileName;
}

function normalizeStorageQuotaBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return DEFAULT_USER_MODEL_STORAGE_QUOTA_BYTES;
  }
  return Math.round(number);
}

function parseStorageQuotaGb(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_USER_MODEL_STORAGE_QUOTA_BYTES;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1024) {
    throwHttpError(400, "用户 3D 模型空间需为 0-1024GB 之间的数字。");
  }
  return Math.round(number * 1024 * 1024 * 1024);
}

function throwHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function recordGeneratedTask(task, fallback = {}) {
  const taskId = normalizeText(task?.taskId || task?.id || fallback.taskId);
  if (!taskId) {
    return null;
  }

  const existing = generatedTaskRecords.get(taskId) || {};
  const now = new Date().toISOString();
  const provider = normalizeProvider(task?.provider || fallback.provider || existing.provider);
  const providerName = task?.providerName || fallback.providerName || existing.providerName || (provider === "meshy" ? "Meshy" : "Tripo3D");
  const mode = normalizeText(task?.mode || fallback.mode || existing.mode || "text");
  const input = task?.input && typeof task.input === "object" ? task.input : {};
  const output = task?.output && typeof task.output === "object" ? task.output : existing.output || null;
  const modelUrls = task?.modelUrls && typeof task.modelUrls === "object" ? task.modelUrls : existing.modelUrls || null;
  const downloadItems = Array.isArray(task?.downloadItems) ? task.downloadItems : buildDownloadItemsFromTask(task, modelUrls);
  const prompt = normalizeText(fallback.prompt || input.prompt || existing.prompt || task?.payload?.prompt || "");
  const preferredModelUrl = normalizeText(task?.preferredModelUrl || existing.preferredModelUrl || "");

  const nextRecord = {
    id: taskId,
    taskId,
    provider,
    providerName,
    userId: normalizeText(fallback.userId || existing.userId || task?.userId || ""),
    mode,
    prompt,
    displayModelVersion: normalizeText(task?.displayModelVersion || fallback.modelVersion || existing.displayModelVersion || ""),
    status: normalizeText(task?.status || existing.status || "queued"),
    statusText: normalizeText(task?.statusText || existing.statusText || task?.status || "queued"),
    stageText: normalizeText(task?.stageText || existing.stageText || ""),
    progress: typeof task?.progress === "number" ? task.progress : Number(existing.progress || 0),
    finalized: Boolean(task?.finalized ?? existing.finalized ?? false),
    preferredModelUrl,
    renderedImage: normalizeText(task?.renderedImage || existing.renderedImage || ""),
    modelUrls,
    output,
    downloadItems,
    proxied: Boolean(task?.proxied || existing.proxied),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };

  generatedTaskRecords.set(taskId, nextRecord);
  return nextRecord;
}

function buildDownloadItemsFromTask(task, modelUrls) {
  if (Array.isArray(task?.downloadItems)) {
    return task.downloadItems;
  }

  const items = [];
  const preferredModelUrl = normalizeText(task?.preferredModelUrl);
  if (preferredModelUrl) {
    items.push({ label: "涓嬭浇妯″瀷", url: preferredModelUrl });
  }

  for (const [key, url] of Object.entries(modelUrls || {})) {
    if (url && !items.some((item) => item.url === url)) {
      items.push({ label: `涓嬭浇 ${key}`, url });
    }
  }

  if (task?.renderedImage) {
    items.push({ label: "下载预览图", url: task.renderedImage });
  }

  return items;
}

function upsertPlayerClientSession(payload, req) {
  const sessionId = normalizeText(payload?.sessionId) || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const existing = playerClientSessions.get(sessionId) || {};
  const now = new Date().toISOString();
  const client = {
    sessionId,
    active: payload?.event === "close" ? false : true,
    path: normalizeText(payload?.path || existing.path || "/model-preview.html"),
    title: normalizeText(payload?.title || existing.title || "3D 模型播放器"),
    userAgent: normalizeText(payload?.userAgent || existing.userAgent || req.headers["user-agent"] || ""),
    language: normalizeText(payload?.language || existing.language || ""),
    platform: normalizeText(payload?.platform || existing.platform || ""),
    timezone: normalizeText(payload?.timezone || existing.timezone || ""),
    viewport: sanitizeClientSize(payload?.viewport || existing.viewport),
    screen: sanitizeClientSize(payload?.screen || existing.screen),
    referrer: normalizeText(payload?.referrer || existing.referrer || ""),
    ip: getClientIp(req),
    firstSeenAt: existing.firstSeenAt || now,
    lastSeenAt: now
  };

  playerClientSessions.set(sessionId, client);
  return client;
}

function sanitizeClientSize(value) {
  if (!value || typeof value !== "object") {
    return { width: 0, height: 0 };
  }

  return {
    width: Number(value.width || 0),
    height: Number(value.height || 0)
  };
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.socket?.remoteAddress || "";
}

function buildLocalGeneratorConfigResponse() {
  const providers = buildProviderConfigMap();
  const generatorSettings = getGeneratorSettings(providers);
  const optimization = buildOptimizationConfigMap();

  return {
    ok: true,
    generatorApiBase: "",
    proxied: false,
    providers,
    generatorSettings,
    creditCosts: CREDIT_COSTS,
    optimization
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

function buildOptimizationConfigMap() {
  return {
    providers: {
      tripo: {
        enabled: Boolean(TRIPO_API_KEY),
        name: OPTIMIZATION_PROVIDER_OPTIONS.tripo.name,
        defaultModelVersion: OPTIMIZATION_PROVIDER_OPTIONS.tripo.defaultModelVersion,
        modelVersions: OPTIMIZATION_PROVIDER_OPTIONS.tripo.modelVersions,
        operations: {
          retexture: {
            enabled: false
          },
          split: {
            enabled: false
          }
        }
      },
      meshy: {
        enabled: Boolean(MESHY_API_KEY),
        name: OPTIMIZATION_PROVIDER_OPTIONS.meshy.name,
        defaultModelVersion: OPTIMIZATION_PROVIDER_OPTIONS.meshy.defaultModelVersion,
        modelVersions: OPTIMIZATION_PROVIDER_OPTIONS.meshy.modelVersions,
        operations: {
          retexture: {
            enabled: Boolean(MESHY_API_KEY)
          },
          split: {
            enabled: false
          }
        }
      }
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

  runtimeStores.generatorSettings = nextSettings;
  if (pgPool) {
    queueRuntimeStorePersist("generator_settings", nextSettings);
  } else {
    fs.writeFileSync(generatorSettingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
  }

  return {
    ...nextSettings,
    providerName: providers[provider]?.name || provider
  };
}

function readGeneratorSettingsFile() {
  try {
    return runtimeStores.generatorSettings || readGeneratorSettingsJsonFile();
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
