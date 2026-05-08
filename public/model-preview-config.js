export const GENERATED_TASK_STORAGE_KEY = "model-preview-generated-tasks";
export const LOCAL_MODEL_STORAGE_KEY = "model-preview-local-models";
export const PREVIEW_TASK_STORAGE_LIMIT = 18;
export const RECENT_STORAGE_KEY = "model-preview-recent";
export const LAST_REMOTE_MODEL_STORAGE_KEY = "model-preview-last-remote-model";

export const GENERATOR_PROVIDER_CONFIG = {
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
      { value: "standard", label: "标准" },
      { value: "detailed", label: "精细" }
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
      { value: "standard", label: "标准" },
      { value: "lowpoly", label: "低多边形" }
    ],
    defaultModelVersion: "latest",
    defaultTextureQuality: "standard",
    defaultGeometryQuality: "standard",
    imageAccept: "image/png,image/jpeg",
    textPlaceholder: "例如：一个白色科幻头盔，蓝色发光细节，产品级渲染"
  }
};

export const OPTIMIZER_PROVIDER_CONFIG = {
  meshy: {
    name: "Meshy",
    operationNotes: {
      retexture: "当前会优先使用 Meshy 的公开 Retexture API，对当前播放模型做 AI 贴图。",
      split: "AI拆模型入口已接到当前播放器，但本地运行时默认还没有接入公开拆件服务。"
    }
  },
  tripo: {
    name: "Tripo3D",
    operationNotes: {
      retexture: "Tripo3D 的 AI贴图入口已预留，如果当前环境没有公开端点，会给出明确提示。",
      split: "Tripo3D 的 AI拆模型入口已预留，如果当前环境没有公开端点，会给出明确提示。"
    }
  }
};

export const STEREO_CONFIG = {
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

export const DEFAULT_PANORAMA_URL = "/panoramas/default-panorama.png";
export const DEFAULT_PANORAMA_NAME = "默认天空盒";
