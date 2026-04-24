// ─── Lite Mode v1.1.0 — Content Script ───────────────────────────────────────
// Новое в v1.1.0:
//   • Локализация через chrome.i18n
//   • Исключение YouTube для video/audio
//   • Исключение SPA-сайтов для iframe
//   • Предупреждение об ограничении JS

(function () {
  "use strict";

  let settings = null;
  let removedCount = 0;
  let blockedCount = 0;
  let observer = null;
  let isSpaAllowed = false;

  const hostname = location.hostname;
  const isYouTube = hostname.endsWith("youtube.com") || hostname.endsWith("youtu.be");

  // Получаем локализованную строку
  function t(key) {
    try { return chrome.i18n.getMessage(key) || key; } catch { return key; }
  }

  // ─── Запуск ────────────────────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (chrome.runtime.lastError) return;
    settings = response?.settings;
    if (!settings?.enabled) return;

    // Проверяем SPA-список в background
    chrome.runtime.sendMessage({ type: "CHECK_SPA", hostname }, (res) => {
      isSpaAllowed = !!res?.isSpa;
      init();
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SETTINGS_UPDATED") {
      settings = msg.settings;
      if (settings.enabled) {
        chrome.runtime.sendMessage({ type: "CHECK_SPA", hostname }, (res) => {
          isSpaAllowed = !!res?.isSpa;
          init();
        });
      } else {
        cleanup();
      }
    }
  });

  // ─── Главный запуск ────────────────────────────────────────────────────────
  function init() {
    injectPerformanceCSS();

    if (settings.throttleTimers) patchTimers();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady);
    } else {
      onReady();
    }
  }

  function onReady() {
    processDom(document.body);
    startObserver();
    if (settings.warnJs && settings.throttleTimers) {
      showJsWarning();
    }
  }

  // ─── 1. CSS-оверрайды ──────────────────────────────────────────────────────
  function injectPerformanceCSS() {
    if (document.getElementById("__litmode_style__")) return;

    const rules = [];

    if (settings.blockAnimations) {
      rules.push(`
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      `);
    }

    if (settings.disableShadows) {
      rules.push(`
        * { text-shadow: none !important; filter: none !important; }
        *:not(:focus):not(:focus-within) { box-shadow: none !important; }
      `);
    }

    if (settings.disableBackdropFilter) {
      rules.push(`
        * {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
      `);
    }

    if (settings.blockWebFonts) {
      rules.push(`
        * { font-family: system-ui, -apple-system, sans-serif !important; }
        code, pre, kbd, samp { font-family: ui-monospace, monospace !important; }
      `);
    }

    // Autoplay: не скрываем на YouTube если включено исключение
    if (settings.blockAutoplay) {
      const youtubeSkip = settings.youtubeException && isYouTube;
      if (!youtubeSkip) {
        rules.push(`video[autoplay], audio[autoplay] { display: none !important; }`);
      }
    }

    if (rules.length === 0) return;

    const style = document.createElement("style");
    style.id = "__litmode_style__";
    style.textContent = rules.join("\n");
    (document.head || document.documentElement).prepend(style);
  }

  // ─── 2. Обработка DOM ──────────────────────────────────────────────────────
  function processDom(root) {
    if (!root) return;

    // Видео/аудио: пропускаем YouTube если включено исключение
    if (settings.blockVideos) {
      const skipVideo = settings.youtubeException && isYouTube;
      if (!skipVideo) {
        removeElements(root, "video, audio", t("placeholder_video"));
      }
    }

    // Iframe: пропускаем SPA-сайты если включено исключение
    if (settings.blockIframes) {
      const skipIframe = settings.spaIframeException && isSpaAllowed;
      if (!skipIframe) {
        removeElements(root, "iframe", t("placeholder_iframe"));
      }
    }

    if (settings.blockTrackers) {
      root.querySelectorAll("script[src]").forEach(script => {
        if (isTrackerUrl(script.src)) {
          script.remove();
          blockedCount++;
        }
      });
    }

    reportStats();
  }

  // ─── 3. Удаление с заглушкой ───────────────────────────────────────────────
  function removeElements(root, selector, label) {
    root.querySelectorAll(selector).forEach(el => {
      if (el.hasAttribute("data-litmode")) return; // уже обработан
      const placeholder = document.createElement("div");
      placeholder.style.cssText = `
        display: inline-block;
        background: #f0f0f0;
        border: 1px dashed #bbb;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        color: #888;
        font-family: system-ui, sans-serif;
        max-width: 100%;
        box-sizing: border-box;
      `;
      placeholder.textContent = label;
      placeholder.setAttribute("data-litmode", "placeholder");
      el.parentNode?.replaceChild(placeholder, el);
      removedCount++;
    });
  }

  // ─── 4. MutationObserver ───────────────────────────────────────────────────
  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const tag = node.tagName?.toLowerCase();

          if (settings.blockVideos && (tag === "video" || tag === "audio")) {
            const skipVideo = settings.youtubeException && isYouTube;
            if (!skipVideo && !node.hasAttribute("data-litmode")) {
              removeElements(
                node.parentNode || document.body,
                `${tag}:not([data-litmode])`,
                t("placeholder_video")
              );
            }
          }

          if (settings.blockIframes && tag === "iframe") {
            const skipIframe = settings.spaIframeException && isSpaAllowed;
            if (!skipIframe && !node.hasAttribute("data-litmode")) {
              removeElements(
                node.parentNode || document.body,
                `iframe:not([data-litmode])`,
                t("placeholder_iframe")
              );
            }
          }

          processDom(node);
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── 5. Патч таймеров ──────────────────────────────────────────────────────
  function patchTimers() {
    const origRAF = window.requestAnimationFrame.bind(window);
    let frameCount = 0;
    window.requestAnimationFrame = function (cb) {
      frameCount++;
      return frameCount % 2 === 0
        ? origRAF(cb)
        : origRAF(() => origRAF(cb));
    };

    const origSetInterval = window.setInterval.bind(window);
    window.setInterval = function (cb, delay, ...args) {
      return origSetInterval(cb, (typeof delay === "number" && delay < 100) ? 100 : delay, ...args);
    };

    const origSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (cb, delay, ...args) {
      return origSetTimeout(cb, (typeof delay === "number" && delay < 4) ? 4 : delay, ...args);
    };
  }

  // ─── 6. Предупреждение об ограничении JS ───────────────────────────────────
  function showJsWarning() {
    if (document.getElementById("__litmode_warn__")) return;

    const bar = document.createElement("div");
    bar.id = "__litmode_warn__";
    bar.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      max-width: 320px;
      background: #1e1e2e;
      border: 1px solid #f59e0b;
      border-radius: 10px;
      padding: 12px 14px 10px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: #e2e8f0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      line-height: 1.5;
      cursor: default;
      animation: none;
    `;

    const title = document.createElement("div");
    title.style.cssText = "font-weight: 600; color: #f59e0b; margin-bottom: 4px; font-size: 13px;";
    title.textContent = t("warn_js_title");

    const text = document.createElement("div");
    text.style.color = "#94a3b8";
    text.textContent = t("warn_js_text");

    const close = document.createElement("button");
    close.textContent = "×";
    close.style.cssText = `
      position: absolute;
      top: 8px; right: 10px;
      background: none;
      border: none;
      color: #64748b;
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    close.onclick = () => bar.remove();

    bar.appendChild(title);
    bar.appendChild(text);
    bar.appendChild(close);
    document.body?.appendChild(bar);

    // Автоскрытие через 8 секунд
    setTimeout(() => bar.remove(), 8000);
  }

  // ─── 7. Cleanup ────────────────────────────────────────────────────────────
  function cleanup() {
    observer?.disconnect();
    observer = null;
    document.getElementById("__litmode_style__")?.remove();
    document.getElementById("__litmode_warn__")?.remove();
  }

  // ─── 8. Вспомогательные ────────────────────────────────────────────────────
  const TRACKER_PATTERNS = [
    "google-analytics.com", "googletagmanager.com", "hotjar.com",
    "doubleclick.net", "googlesyndication.com", "facebook.net",
    "connect.facebook", "amplitude.com", "segment.io", "sentry.io",
    "clarity.ms", "mc.yandex.ru", "top-fwz1.mail.ru"
  ];

  function isTrackerUrl(url) {
    return url ? TRACKER_PATTERNS.some(p => url.includes(p)) : false;
  }

  function reportStats() {
    if (removedCount > 0 || blockedCount > 0) {
      chrome.runtime.sendMessage({
        type: "REPORT_STATS",
        removed: removedCount,
        blocked: blockedCount
      }).catch(() => {});
      removedCount = 0;
      blockedCount = 0;
    }
  }

})();
