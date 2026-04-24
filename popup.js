// ─── Lite Mode v1.1.0 — Popup Script ─────────────────────────────────────────

const KEYS = [
  "enabled",
  "blockVideos", "blockIframes",
  "blockAnimations", "disableShadows", "disableBackdropFilter", "blockWebFonts",
  "blockTrackers", "throttleTimers", "blockAutoplay",
  // v1.1.0
  "youtubeException", "spaIframeException", "warnJs"
];

let settings = {};
let saveTimer = null;

// ─── i18n: заполняем все data-i18n атрибуты ───────────────────────────────────
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  });
}

// ─── Загрузка ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  applyI18n();

  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
    settings = res?.settings || {};
    renderToggles();
    loadStats();
    setStatus(chrome.i18n.getMessage("status_ready"), false);
  });
});

function renderToggles() {
  KEYS.forEach(key => {
    const input = document.getElementById(`toggle-${key}`);
    if (input) input.checked = !!settings[key];
  });
  updateAllRowStates();
  updateMaster();
}

function updateAllRowStates() {
  KEYS.filter(k => k !== "enabled").forEach(key => {
    const row = document.querySelector(`[data-key="${key}"]`);
    if (row) row.classList.toggle("on", !!settings[key]);
  });
}

function updateMaster() {
  const masterRow = document.getElementById("masterRow");
  const label = document.getElementById("masterLabel");
  const enabled = !!settings.enabled;
  masterRow.classList.toggle("active", enabled);
  label.textContent = chrome.i18n.getMessage(enabled ? "status_active" : "status_disabled");
  document.body.classList.toggle("disabled", !enabled);
}

// ─── Переключения ─────────────────────────────────────────────────────────────
KEYS.forEach(key => {
  const input = document.getElementById(`toggle-${key}`);
  if (!input) return;
  input.addEventListener("change", () => {
    settings[key] = input.checked;
    if (key === "enabled") {
      updateMaster();
    } else {
      document.querySelector(`[data-key="${key}"]`)?.classList.toggle("on", input.checked);
    }
    scheduleSave();
  });
});

function scheduleSave() {
  setStatus(chrome.i18n.getMessage("status_saving"), false);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 400);
}

function saveSettings() {
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, (res) => {
    if (res?.ok) {
      setStatus(chrome.i18n.getMessage("status_saved"), true);
      setTimeout(() => setStatus(chrome.i18n.getMessage("status_ready"), false), 1500);
    }
  });
}

// ─── Статистика ───────────────────────────────────────────────────────────────
function loadStats() {
  chrome.runtime.sendMessage({ type: "GET_STATS" }, (res) => {
    const stats = res?.stats || { blocked: 0, removed: 0 };
    document.getElementById("stat-removed").textContent = stats.removed;
    document.getElementById("stat-blocked").textContent = stats.blocked;
  });
}

// ─── Кнопки ───────────────────────────────────────────────────────────────────
document.getElementById("reloadBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
  });
});

function setStatus(text, saved) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("statusDot").classList.toggle("saved", saved);
}
