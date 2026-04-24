// ─── Lite Mode v1.1.0 — Background Service Worker ────────────────────────────

const RULESET_ID = "ruleset_1";

// Список известных SPA-сайтов, которым нужны iframe (расширяемый)
const SPA_IFRAME_ALLOWLIST = [
  "notion.so",
  "figma.com",
  "miro.com",
  "trello.com",
  "linear.app",
  "airtable.com",
  "monday.com",
  "clickup.com",
  "atlassian.net",
  "vercel.app",
  "netlify.app",
  "codesandbox.io",
  "stackblitz.com",
  "codepen.io",
  "replit.com",
  "app.diagrams.net",
  "excalidraw.com"
];

const DEFAULT_SETTINGS = {
  enabled: true,
  blockVideos: true,
  blockIframes: true,
  blockAnimations: true,
  blockWebFonts: true,
  blockTrackers: true,
  blockCanvasAnimations: true,
  disableShadows: true,
  disableBackdropFilter: true,
  throttleTimers: true,
  blockAutoplay: true,
  // v1.1.0
  youtubeException: true,    // разрешить видео/аудио на YouTube
  spaIframeException: true,  // разрешить iframe на SPA-сайтах
  warnJs: true               // показывать предупреждение об ограничении JS
};

// ─── Инициализация ────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("settings");
  if (!existing.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  } else {
    // Мигрируем старые настройки — добавляем новые поля если их нет
    const merged = { ...DEFAULT_SETTINGS, ...existing.settings };
    await chrome.storage.sync.set({ settings: merged });
  }
  await applyNetworkRules(existing.settings || DEFAULT_SETTINGS);
});

// ─── Сообщения от popup и content script ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "GET_SETTINGS") {
    chrome.storage.sync.get("settings").then(data => {
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      sendResponse({ settings });
    });
    return true;
  }

  if (msg.type === "SAVE_SETTINGS") {
    chrome.storage.sync.set({ settings: msg.settings }).then(async () => {
      await applyNetworkRules(msg.settings);
      const tabs = await chrome.tabs.query({ url: "<all_urls>" });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SETTINGS_UPDATED",
          settings: msg.settings
        }).catch(() => {});
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "GET_STATS") {
    chrome.storage.local.get("stats").then(data => {
      sendResponse({ stats: data.stats || { blocked: 0, removed: 0 } });
    });
    return true;
  }

  if (msg.type === "REPORT_STATS") {
    chrome.storage.local.get("stats").then(data => {
      const stats = data.stats || { blocked: 0, removed: 0 };
      stats.blocked += msg.blocked || 0;
      stats.removed += msg.removed || 0;
      chrome.storage.local.set({ stats });
    });
  }

  // Проверяем, входит ли текущий сайт в SPA allowlist
  if (msg.type === "CHECK_SPA") {
    const hostname = msg.hostname || "";
    const isSpa = SPA_IFRAME_ALLOWLIST.some(domain => hostname.endsWith(domain));
    sendResponse({ isSpa });
    return true;
  }
});

// ─── declarativeNetRequest ────────────────────────────────────────────────────
async function applyNetworkRules(settings) {
  try {
    const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
    const isEnabled = rulesets.includes(RULESET_ID);
    const shouldEnable = settings.enabled && (settings.blockTrackers || settings.blockWebFonts);

    if (shouldEnable && !isEnabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [RULESET_ID] });
    } else if (!shouldEnable && isEnabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [RULESET_ID] });
    }
  } catch (e) {
    console.error("[LiteMode] Ошибка DNR:", e);
  }
}
