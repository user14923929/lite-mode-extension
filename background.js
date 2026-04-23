// ─── Lite Mode — Background Service Worker ───────────────────────────────────
// Управляет настройками, активирует/деактивирует декларативные правила,
// слушает сообщения от popup и content script.

const RULESET_ID = "ruleset_1";

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  enabled: true,
  blockVideos: true,
  blockIframes: true,
  blockAnimations: true,
  blockWebFonts: true,         // через declarativeNetRequest
  blockTrackers: true,         // через declarativeNetRequest
  blockCanvasAnimations: true,
  disableShadows: true,
  disableBackdropFilter: true,
  throttleTimers: true,
  blockAutoplay: true
};

// ─── Инициализация при установке расширения ──────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("settings");
  if (!existing.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    console.log("[LiteMode] Настройки инициализированы по умолчанию");
  }
  await applyNetworkRules(existing.settings || DEFAULT_SETTINGS);
});

// ─── Слушаем сообщения от popup ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SETTINGS") {
    chrome.storage.sync.get("settings").then(data => {
      sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
    });
    return true; // асинхронный ответ
  }

  if (msg.type === "SAVE_SETTINGS") {
    chrome.storage.sync.set({ settings: msg.settings }).then(async () => {
      await applyNetworkRules(msg.settings);
      // Говорим всем активным вкладкам перезагрузить настройки
      const tabs = await chrome.tabs.query({ url: "<all_urls>" });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SETTINGS_UPDATED",
          settings: msg.settings
        }).catch(() => {}); // игнорируем вкладки без content script
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
});

// ─── Управление сетевыми правилами (шрифты, трекеры) ─────────────────────────
async function applyNetworkRules(settings) {
  try {
    const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
    const isEnabled = rulesets.includes(RULESET_ID);
    const shouldEnable = settings.enabled && (settings.blockTrackers || settings.blockWebFonts);

    if (shouldEnable && !isEnabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [RULESET_ID]
      });
      console.log("[LiteMode] Сетевые правила активированы");
    } else if (!shouldEnable && isEnabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: [RULESET_ID]
      });
      console.log("[LiteMode] Сетевые правила деактивированы");
    }
  } catch (e) {
    console.error("[LiteMode] Ошибка при применении правил:", e);
  }
}

// ─── Обновляем счётчик статистики из content script ──────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REPORT_STATS") {
    chrome.storage.local.get("stats").then(data => {
      const stats = data.stats || { blocked: 0, removed: 0 };
      stats.blocked += msg.blocked || 0;
      stats.removed += msg.removed || 0;
      chrome.storage.local.set({ stats });
    });
  }
});
