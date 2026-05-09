export const DEFAULT_SITE_SETTINGS = {
  logoUrl: "/assets/kmax-logo-transparent.png",
  iconUrl: "/assets/kmax-browser-icon.png",
  iconVersion: "fixed",
  title: "模型播放器",
  titles: {
    home: "模型官网门户",
    player: "模型播放器",
    work: "用户中心",
    admin: "模型管理后台"
  },
  keywords: "KMAX,AI模型播放器,3D模型生成,3D模型预览,模型播放器",
  description: "KMAX AI模型播放器提供3D模型生成、模型预览、模型管理与空间交互展示能力。"
};

export async function applySiteBranding(settings = null) {
  const siteSettings = settings ? normalizeSiteSettings(settings) : await fetchSiteSettings();
  updateDocumentMeta(siteSettings);
  updateLogoImages(siteSettings.logoUrl);
  return siteSettings;
}

export async function fetchSiteSettings() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) {
      return DEFAULT_SITE_SETTINGS;
    }
    const data = await response.json();
    return normalizeSiteSettings(data.siteSettings);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function normalizeSiteSettings(settings = {}) {
  const logoUrl = normalizeSiteLogoUrl(settings.logoUrl);
  return {
    logoUrl: logoUrl || DEFAULT_SITE_SETTINGS.logoUrl,
    iconUrl: DEFAULT_SITE_SETTINGS.iconUrl,
    iconVersion: DEFAULT_SITE_SETTINGS.iconVersion,
    title: DEFAULT_SITE_SETTINGS.title,
    titles: DEFAULT_SITE_SETTINGS.titles,
    keywords: settings.keywords || DEFAULT_SITE_SETTINGS.keywords,
    description: settings.description || DEFAULT_SITE_SETTINGS.description
  };
}

function normalizeSiteLogoUrl(value) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("/assets/site/")) return "";
  if (text.startsWith("/assets/") || text.startsWith("data:image/")) return text;
  return "";
}

function updateDocumentMeta(settings) {
  document.title = getCurrentPageTitle(settings);
  setNamedMeta("keywords", settings.keywords);
  setNamedMeta("description", settings.description);
  const iconHref = withAssetVersion(settings.iconUrl, settings.iconVersion);
  setIconLink("icon", iconHref);
  setIconLink("shortcut icon", iconHref);
}

function getCurrentPageTitle(settings) {
  const titles = settings.titles || DEFAULT_SITE_SETTINGS.titles;
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/" || pathname.endsWith("/index.html")) return titles.home || settings.title;
  if (pathname.endsWith("/model-preview.html")) return titles.player || settings.title;
  if (pathname.endsWith("/model-work.html")) return titles.work || settings.title;
  if (pathname.endsWith("/model-setting.html")) return titles.admin || settings.title;
  return settings.title;
}

function updateLogoImages(logoUrl) {
  document.querySelectorAll("img.brand-logo, .footer-brand img").forEach((image) => {
    image.src = logoUrl;
  });
}

function setNamedMeta(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setIconLink(rel, href) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.type = inferSiteIconContentType(href);
  link.href = href;
}

function withAssetVersion(url, version) {
  if (!url || !version || url.startsWith("data:image/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function inferSiteIconContentType(url) {
  const cleanUrl = String(url || "").split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".ico")) return "image/x-icon";
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  return "image/png";
}
