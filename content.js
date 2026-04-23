// ─── Lite Mode — Content Script ──────────────────────────────────────────────
// Выполняется на каждой странице. Удаляет тяжёлые элементы, отключает
// анимации и CSS-эффекты, ограничивает JS-таймеры.
// run_at: document_start — до рендера страницы.

(function () {
  "use strict";

  let settings = null;
  let removedCount = 0;
  let blockedCount = 0;
  let observer = null;

  // ─── Загружаем настройки и запускаемся ─────────────────────────────────────
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (chrome.runtime.lastError) return;
    settings = response?.settings;
    if (settings?.enabled) {
      init();
    }
  });

  // ─── Слушаем обновления настроек из popup ──────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SETTINGS_UPDATED") {
      settings = msg.settings;
      if (settings.enabled) {
        init();
      } else {
        cleanup();
      }
    }
  });

  // ─── Главный запуск ────────────────────────────────────────────────────────
  function init() {
    injectPerformanceCSS();

    if (settings.throttleTimers) {
      patchTimers();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        processDom(document.body);
        startObserver();
      });
    } else {
      processDom(document.body);
      startObserver();
    }
  }

  // ─── 1. CSS-оверрайды (инжектируем в <head> до рендера) ────────────────────
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
        * {
          text-shadow: none !important;
          filter: none !important;
        }
      `);
      // box-shadow отдельно — иначе сломаются outline-эффекты фокуса
      rules.push(`
        *:not(:focus):not(:focus-within) {
          box-shadow: none !important;
        }
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
        * {
          font-family: system-ui, -apple-system, sans-serif !important;
        }
        code, pre, kbd, samp {
          font-family: ui-monospace, monospace !important;
        }
      `);
    }

    if (settings.blockAutoplay) {
      rules.push(`
        video[autoplay], audio[autoplay] {
          display: none !important;
        }
      `);
    }

    if (rules.length === 0) return;

    const style = document.createElement("style");
    style.id = "__litmode_style__";
    style.textContent = rules.join("\n");

    // Вставляем как можно раньше
    const target = document.head || document.documentElement;
    target.prepend(style);
  }

  // ─── 2. Обработка DOM-элементов ────────────────────────────────────────────
  function processDom(root) {
    if (!root) return;

    if (settings.blockVideos) {
      removeElements(root, "video, audio", "медиа-элемент");
    }

    if (settings.blockIframes) {
      removeElements(root, "iframe", "iframe");
    }

    if (settings.blockCanvasAnimations) {
      // Canvas оставляем (может быть нужен для контента),
      // но останавливаем requestAnimationFrame у canvas-based анимаций
      // через патч (см. patchTimers)
      root.querySelectorAll("canvas").forEach(canvas => {
        canvas.setAttribute("data-litmode-canvas", "1");
      });
    }

    // Удаляем <script> с трекерами (не заблокированные declarativeNetRequest)
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

  // ─── 3. Удаление элементов с заменой-заглушкой ─────────────────────────────
  function removeElements(root, selector, label) {
    root.querySelectorAll(selector).forEach(el => {
      const placeholder = document.createElement("div");
      placeholder.style.cssText = `
        display: inline-block;
        background: #f0f0f0;
        border: 1px dashed #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        color: #888;
        font-family: system-ui, sans-serif;
        max-width: 100%;
        box-sizing: border-box;
      `;
      placeholder.textContent = `[Lite Mode: ${label} скрыт]`;
      placeholder.setAttribute("data-litmode", "placeholder");
      el.parentNode?.replaceChild(placeholder, el);
      removedCount++;
    });
  }

  // ─── 4. MutationObserver — следим за динамически добавляемыми элементами ───
  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          processDom(node);
          // Проверяем сам добавленный узел
          const tag = node.tagName?.toLowerCase();
          if (settings.blockVideos && (tag === "video" || tag === "audio")) {
            removeElements(node.parentNode || document.body, `${tag}:not([data-litmode])`, "медиа-элемент");
          }
          if (settings.blockIframes && tag === "iframe") {
            removeElements(node.parentNode || document.body, `iframe:not([data-litmode])`, "iframe");
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ─── 5. Патчим JS-таймеры для снижения нагрузки ────────────────────────────
  function patchTimers() {
    // Ограничиваем requestAnimationFrame: пропускаем каждый 2-й кадр
    const origRAF = window.requestAnimationFrame.bind(window);
    let frameCount = 0;
    window.requestAnimationFrame = function (cb) {
      frameCount++;
      if (frameCount % 2 === 0) {
        return origRAF(cb);
      }
      // Откладываем на следующий кадр без вызова
      return origRAF(() => origRAF(cb));
    };

    // setInterval с задержкой < 100ms — растягиваем до 100ms
    const origSetInterval = window.setInterval.bind(window);
    window.setInterval = function (cb, delay, ...args) {
      const safeDelay = (typeof delay === "number" && delay < 100) ? 100 : delay;
      return origSetInterval(cb, safeDelay, ...args);
    };

    // setTimeout с задержкой < 4ms — минимум 4ms (браузерный минимум)
    const origSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (cb, delay, ...args) {
      const safeDelay = (typeof delay === "number" && delay < 4) ? 4 : delay;
      return origSetTimeout(cb, safeDelay, ...args);
    };
  }

  // ─── 6. Отключение (если расширение выключено через popup) ─────────────────
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    const style = document.getElementById("__litmode_style__");
    if (style) style.remove();
    // Заглушки не удаляем — страницу нужно перезагрузить
  }

  // ─── 7. Вспомогательные функции ────────────────────────────────────────────
  const TRACKER_PATTERNS = [
    "google-analytics.com",
    "googletagmanager.com",
    "hotjar.com",
    "doubleclick.net",
    "googlesyndication.com",
    "facebook.net",
    "connect.facebook",
    "amplitude.com",
    "segment.io",
    "sentry.io",
    "clarity.ms",
    "mc.yandex.ru",
    "top-fwz1.mail.ru"
  ];

  function isTrackerUrl(url) {
    if (!url) return false;
    return TRACKER_PATTERNS.some(pattern => url.includes(pattern));
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
