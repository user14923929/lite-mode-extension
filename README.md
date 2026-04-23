# ⚡ Lite Mode — Browser Performance Extension

![Version](https://img.shields.io/badge/version-1.0.0-4ade80?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-22d3ee?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)
![Browser](https://img.shields.io/badge/browser-Chrome%20%2F%20Chromium%20%2F%20Edge-orange?style=flat-square)

Расширение для Chromium-браузеров, которое ускоряет загрузку страниц на слабых компьютерах. Блокирует тяжёлые HTML-элементы, CSS-эффекты, JavaScript-трекеры и веб-шрифты — всё через удобный переключатель.

---

## Возможности

| Категория | Что блокирует | Метод |
|-----------|--------------|-------|
| **HTML** | `<video>`, `<audio>`, `<iframe>` | DOM удаление + заглушка |
| **CSS** | Анимации, transitions, box-shadow, backdrop-filter | Инжект стилей до рендера |
| **Шрифты** | Google Fonts, Typekit → системный шрифт | `declarativeNetRequest` |
| **Трекеры** | Google Analytics, GTM, Facebook Pixel, Hotjar, Amplitude, Sentry... | `declarativeNetRequest` |
| **JS-таймеры** | `requestAnimationFrame`, `setInterval`, `setTimeout` | Патч window API |
| **Autoplay** | Медиа с атрибутом `autoplay` | CSS + DOM |

---

## Установка

### Chrome / Chromium / Edge (режим разработчика)

1. Скачай репозиторий: **Code → Download ZIP** (или `git clone`)
2. Распакуй архив
3. Открой страницу расширений: `chrome://extensions/`
4. Включи **«Режим разработчика»** (правый верхний угол)
5. Нажми **«Загрузить распакованное»** и выбери папку
6. Нажимай на иконку **⚡** в панели браузера для настройки

---

## Как это работает

```
Браузер загружает страницу
        │
        ▼
declarativeNetRequest ──► Блокирует трекеры и шрифты на сетевом уровне
        │
        ▼
content.js (document_start)
  ├─ injectPerformanceCSS()  ──► <style> в <head> ДО рендера
  ├─ patchTimers()           ──► Патч rAF / setInterval / setTimeout
  └─ DOMContentLoaded
       ├─ processDom()       ──► Удаляет video, iframe, трекер-скрипты
       └─ MutationObserver   ──► Следит за динамическими элементами
```

### Архитектура файлов

```
lite-mode-extension/source/
├── manifest.json      — конфигурация MV3, права доступа
├── background.js      — service worker: DNR правила, storage, статистика
├── content.js         — DOM-манипуляции и CSS-оверрайды
├── popup.html         — интерфейс настроек (тёмная тема)
├── popup.js           — логика popup, связь с background
├── rules.json         — 14 правил declarativeNetRequest
└── icons/             — иконки 16/48/128px
```

---

## Заблокированные сервисы (rules.json)

| Сервис | Тип |
|--------|-----|
| Google Analytics | script |
| Google Tag Manager | script |
| Google Fonts | stylesheet, font |
| Typekit (Adobe Fonts) | stylesheet, font |
| DoubleClick | script, image, xhr |
| Google Syndication | script, image |
| Facebook Pixel | script |
| Hotjar | script |
| Amplitude | script |
| Segment.io | script, xhr |
| Sentry | script, xhr |
| Yandex.Metrica | script |
| Mail.ru Top | script |
| AdService Google | script, xhr |

---

## Кастомизация

### Добавить трекер в блок-лист

В `rules.json` (id должен быть уникальным):

```json
{
  "id": 15,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "*example-tracker.com*",
    "resourceTypes": ["script"]
  }
}
```

### Добавить CSS-отключение

В `content.js` → функция `injectPerformanceCSS()`:

```js
if (settings.myNewOption) {
  rules.push(`* { your-property: value !important; }`);
}
```

---

## Известные ограничения

- Патч таймеров применяется только к новым вызовам
- Некоторые SPA (React/Vue) могут вести себя странно при блокировке `iframe`
- Для применения настроек нужна перезагрузка вкладки (кнопка в popup)

---

## Contributing

PR и issues приветствуются! Особенно интересны:
- Новые трекеры для `rules.json`
- Поддержка Firefox
- Whitelist/исключения для сайтов
- Экспорт/импорт настроек

---

## Лицензия

[MIT](LICENSE)
