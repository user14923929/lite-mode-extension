// ─── Lite Mode — Popup Script ─────────────────────────────────────────────────

const KEYS = [
  "enabled",
  "blockVideos",
  "blockIframes",
  "blockAnimations",
  "disableShadows",
  "disableBackdropFilter",
  "blockWebFonts",
  "blockTrackers",
  "throttleTimers",
  "blockAutoplay"
];

let settings = {};
let saveTimer = null;

// ─── Загрузка и рендер ─────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
  settings = res?.settings || {};
  renderToggles();
  loadStats();
  setStatus("готово", false);
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
    if (!row) return;
    const enabled = !!settings[key];
    row.classList.toggle("on", enabled);
  });
}

function updateMaster() {
  const masterRow = document.getElementById("masterRow");
  const label = document.getElementById("masterLabel");
  const enabled = !!settings.enabled;

  masterRow.classList.toggle("active", enabled);
  label.textContent = enabled ? "АКТИВНО" : "ОТКЛЮЧЕНО";
  document.body.classList.toggle("disabled", !enabled);
}

// ─── Слушаем переключения ──────────────────────────────────────────────────────
KEYS.forEach(key => {
  const input = document.getElementById(`toggle-${key}`);
  if (!input) return;

  input.addEventListener("change", () => {
    settings[key] = input.checked;

    if (key !== "enabled") {
      const row = document.querySelector(`[data-key="${key}"]`);
      if (row) row.classList.toggle("on", input.checked);
    } else {
      updateMaster();
    }

    scheduleSave();
  });
});

// ─── Дебаунс сохранения ────────────────────────────────────────────────────────
function scheduleSave() {
  setStatus("сохранение...", false);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 400);
}

function saveSettings() {
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, (res) => {
    if (res?.ok) {
      setStatus("сохранено ✓", true);
      setTimeout(() => setStatus("готово", false), 1500);
    }
  });
}

// ─── Статистика ────────────────────────────────────────────────────────────────
function loadStats() {
  chrome.runtime.sendMessage({ type: "GET_STATS" }, (res) => {
    const stats = res?.stats || { blocked: 0, removed: 0 };
    document.getElementById("stat-removed").textContent = stats.removed;
    document.getElementById("stat-blocked").textContent = stats.blocked;
  });
}

// ─── Кнопка перезагрузки вкладки ──────────────────────────────────────────────
document.getElementById("reloadBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
  });
});

// ─── Статус-строка ─────────────────────────────────────────────────────────────
function setStatus(text, saved) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("statusDot").classList.toggle("saved", saved);
}
