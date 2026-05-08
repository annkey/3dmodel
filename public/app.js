import {
  FEATURES,
  HERO_ACTIONS,
  MODEL_STATS,
  SCENE_FEATURES,
  SITE_CONFIG
} from "./app-config.js";
import { applySiteBranding } from "./site-brand.js";

const app = document.getElementById("app");

renderPage();
setupMotion();
void applySiteBranding();

function renderPage() {
  document.title = `${SITE_CONFIG.productName} - 官网门户`;

  app.innerHTML = `
    <div class="scroll-progress"></div>
    <div class="page-glow"></div>
    <header class="navbar">
      <div class="container navbar-inner">
        <a class="brand" href="/">
          <img class="brand-logo" src="/assets/kmax-logo.png" alt="${SITE_CONFIG.brand}" />
          <span class="brand-tagline">${SITE_CONFIG.navTagline}</span>
        </a>
        <div class="nav-actions">
          <a class="nav-link" href="#features">核心功能</a>
          <a class="button-primary" href="${SITE_CONFIG.portalHref}" target="_blank" rel="noreferrer">${SITE_CONFIG.portalLabel}</a>
        </div>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="container hero-grid">
          <div class="hero-copy">
            <h1 class="hero-title">${SITE_CONFIG.heroTitleHtml}</h1>
            <p class="hero-description">${SITE_CONFIG.heroDescription}</p>
            <div class="hero-actions">${renderActions()}</div>
            <div class="hero-note">${SITE_CONFIG.heroHighlights.map((item) => `<span>${item}</span>`).join("")}</div>
          </div>
        </div>
      </section>

      <section id="features" class="section">
        <div class="container scroll-reveal">
          <div class="section-head scroll-reveal">
            <h2>${SITE_CONFIG.featuresTitle}</h2>
            <p>${SITE_CONFIG.featuresDescription}</p>
          </div>
          <div class="feature-grid">
            ${FEATURES.map(renderFeatureCard).join("")}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="container stat-layout">
          <div class="stat-copy scroll-reveal">
            <h2>${SITE_CONFIG.statsTitle}</h2>
            <p>${SITE_CONFIG.statsDescription}</p>
            <div class="stat-callout glass-panel scroll-reveal" style="--reveal-delay:120ms">
              <strong>${SITE_CONFIG.statsCalloutTitle}</strong>
              <span>${SITE_CONFIG.statsCalloutDescription}</span>
            </div>
          </div>
          <div class="stats-card glass-panel scroll-reveal" style="--reveal-delay:180ms">
            <div class="stats-list">
              ${MODEL_STATS.map(renderStatRow).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container scroll-reveal">
          <div class="section-head scroll-reveal">
            <h2>${SITE_CONFIG.sceneTitle}</h2>
            <p>${SITE_CONFIG.sceneDescription}</p>
          </div>
          <div class="scene-grid">
            ${SCENE_FEATURES.map(renderSceneCard).join("")}
          </div>
        </div>
      </section>

      <section class="cta-section">
        <div class="container">
          <div class="cta-panel scroll-reveal">
            <div class="cta-copy">
              <h2>${SITE_CONFIG.ctaTitle}</h2>
              <p>${SITE_CONFIG.ctaDescription}</p>
            </div>
            <a class="button-secondary" href="${SITE_CONFIG.portalHref}" target="_blank" rel="noreferrer">${SITE_CONFIG.ctaButtonLabel}</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <img src="/assets/kmax-logo.png" alt="${SITE_CONFIG.brand}" />
        </div>
        <div class="footer-copy">${SITE_CONFIG.footerText}</div>
      </div>
    </footer>
  `;
}

function renderActions() {
  return HERO_ACTIONS.map((action) => {
    const className = action.kind === "primary" ? "button-primary" : "button-secondary";
    const externalAttrs = action.newTab ? ' target="_blank" rel="noreferrer"' : "";
    return `<a class="${className}" href="${action.href}"${externalAttrs}>${action.label}</a>`;
  }).join("");
}

function renderFeatureCard(feature) {
  return `
    <article class="feature-card scroll-reveal" style="--reveal-delay:${feature.delay}ms">
      <div class="feature-icon">${feature.icon}</div>
      <h3>${feature.title}</h3>
      <p>${feature.description}</p>
    </article>
  `;
}

function renderStatRow(item) {
  return `
    <div class="stats-row scroll-reveal" style="--reveal-delay:${item.delay}ms">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `;
}

function renderSceneCard(item) {
  return `
    <article class="scene-card scroll-reveal" style="--reveal-delay:${item.delay}ms">
      <div class="scene-icon">${item.icon}</div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    </article>
  `;
}

function setupMotion() {
  const reveals = Array.from(document.querySelectorAll(".scroll-reveal"));
  if (!reveals.length || !("IntersectionObserver" in window)) {
    reveals.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  reveals.forEach((node) => observer.observe(node));

  const hero = document.querySelector(".hero-copy");
  let ticking = false;

  window.addEventListener(
    "scroll",
    () => {
      if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.08, 28);
        hero.style.transform = `translateY(${-offset}px)`;
        const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const progress = Math.min(window.scrollY / maxScroll, 1);
        document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
        ticking = false;
      });
    },
    { passive: true }
  );

  const interactiveCards = document.querySelectorAll(".feature-card, .scene-card, .stats-row, .cta-panel");
  interactiveCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mx", `${x}%`);
      card.style.setProperty("--my", `${y}%`);
    });
  });

  const pageGlow = document.querySelector(".page-glow");
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!pageGlow) {
        return;
      }

      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      pageGlow.style.setProperty("--glow-x", `${x}%`);
      pageGlow.style.setProperty("--glow-y", `${y}%`);
    },
    { passive: true }
  );

  const initialScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  document.documentElement.style.setProperty("--scroll-progress", `${Math.min(window.scrollY / initialScroll, 1)}`);
}
