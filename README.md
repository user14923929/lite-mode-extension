# ⚡ Lite Mode — Chrome Extension (EN)

A Chromium browser extension that speeds up page loading on weak computers by blocking heavy HTML elements, CSS effects, and JavaScript trackers.

## Features

| Category | What it does |
|----------|--------------|
| **HTML** | Removes `<video>`, `<audio>`, `<iframe>` and replaces with placeholders |
| **CSS** | Disables animations, transitions, box-shadow, backdrop-filter |
| **Fonts** | Blocks Google Fonts and Typekit, replaces with system fonts |
| **JS Trackers** | Blocks Google Analytics, Facebook Pixel, Hotjar, etc. (via `declarativeNetRequest`) |
| **Timers** | Patches `requestAnimationFrame`, `setInterval`, `setTimeout` |
| **Autoplay** | Hides media with `autoplay` attribute |

## Installation (Developer Mode)

1. Download or clone the repository
2. Open Chrome/Chromium and go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in the top right)
4. Click **"Load unpacked extension"**
5. Select the `lite-mode-extension` folder
6. The extension will appear on the toolbar — click the ⚡ icon for settings

## Icons

The `icons/` folder should contain PNG files: `icon16.png`, `icon48.png`, `icon128.png`.

For development, you can quickly create them via any generator (e.g., https://favicon.io/) or draw a simple ⚡ icon.

## File Structure

```
lite-mode-extension/
├── manifest.json      — extension configuration (MV3)
├── background.js      — service worker: DNR rules, storage
├── content.js         — DOM manipulations on each page
├── popup.html         — settings interface
├── popup.js           — popup logic
├── rules.json         — declarativeNetRequest rules (URL blocking)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## How It Works

### content.js (runs as `document_start`)
1. Requests settings from `chrome.storage.sync`
2. Injects `<style>` with CSS overrides before page render
3. After `DOMContentLoaded`, scans DOM and removes/replaces unwanted elements
4. Starts `MutationObserver` to track dynamically added elements
5. Patches `window.requestAnimationFrame` / `setInterval` / `setTimeout`

### background.js (service worker)
- Activates/deactivates ruleset via `declarativeNetRequest.updateEnabledRulesets`
- Stores settings in `chrome.storage.sync` (syncs across devices)
- Broadcasts setting updates to all tabs on change

### rules.json (declarativeNetRequest)
Static blocking rules — work at network level, before resource loading.
List includes: Google Analytics, GTM, Facebook Pixel, Hotjar, Amplitude, Sentry, Google Fonts, Typekit.

## Project Extension

### Add a New Blocked Tracker
In `rules.json`, add an object like this:
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

### Add a New CSS Override
In `content.js`, in the `injectPerformanceCSS()` function, add a new `rules.push(...)` with the required styles.

### Add a Site Exception (Whitelist)
Extend `manifest.json` and `background.js`: on page load, check hostname against a list from `chrome.storage.sync`, and if it matches, skip `processDom`.

## Known Limitations

- Timer patching (`throttleTimers`) applies only to new calls — already running intervals are not affected
- Some SPAs (React/Vue apps) may malfunction with iframe removal enabled
- Applying setting changes requires a tab reload (button in popup)

## License

MIT — do whatever you want.

# ⚡ Lite Mode — Chrome Extension (UA)

Розширення для браузерів Chromium, яке прискорює завантаження сторінок на слабких комп'ютерах, блокуючи важкі HTML-елементи, CSS-ефекти та JavaScript-трекери.

## Можливості

| Категорія | Що робить |
|-----------|-----------|
| **HTML** | Видаляє `<video>`, `<audio>`, `<iframe>` і замінює заглушкою |
| **CSS** | Вимикає анімації, transitions, box-shadow, backdrop-filter |
| **Шрифти** | Блокує Google Fonts та Typekit, замінює на системні |
| **JS-трекери** | Блокує Google Analytics, Facebook Pixel, Hotjar тощо (через `declarativeNetRequest`) |
| **Таймери** | Патчить `requestAnimationFrame`, `setInterval`, `setTimeout` |
| **Автоперегляд** | Приховує медіа з атрибутом `autoplay` |

## Встановлення (режим розробника)

1. Завантаж або клонуй репозиторій
2. Відкрий Chrome/Chromium і перейди на `chrome://extensions/`
3. Увімкни **"Режим розробника"** (перемикач праворуч вгорі)
4. Натисни **"Завантажити розпаковане розширення"**
5. Вибери папку `lite-mode-extension`
6. Розширення з'явиться на панелі — натискай на іконку ⚡ для налаштувань

## Іконки

Папка `icons/` повинна містити PNG-файли: `icon16.png`, `icon48.png`, `icon128.png`.

Для розробки можна створити швидко через будь-який генератор (наприклад, https://favicon.io/) або намалювати просту ⚡ іконку.

## Структура файлів

```
lite-mode-extension/
├── manifest.json      — конфігурація розширення (MV3)
├── background.js      — service worker: правила DNR, storage
├── content.js         — DOM-маніпуляції на кожній сторінці
├── popup.html         — інтерфейс налаштувань
├── popup.js           — логіка popup
├── rules.json         — правила declarativeNetRequest (блокування за URL)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Як це працює

### content.js (запускається як `document_start`)
1. Запитує налаштування з `chrome.storage.sync`
2. Інжектує `<style>` з CSS-перевизначеннями до рендеру сторінки
3. Після `DOMContentLoaded` сканує DOM і видаляє/замінює небажані елементи
4. Запускає `MutationObserver` для відстеження динамічно доданих елементів
5. Патчить `window.requestAnimationFrame` / `setInterval` / `setTimeout`

### background.js (service worker)
- Активує/деактивує ruleset через `declarativeNetRequest.updateEnabledRulesets`
- Зберігає налаштування в `chrome.storage.sync` (синхронізується між пристроями)
- Розсилає оновлення налаштувань у всі вкладки при зміні

### rules.json (declarativeNetRequest)
Статичні правила блокування — працюють на рівні мережі, до завантаження ресурсу.
Список включає: Google Analytics, GTM, Facebook Pixel, Hotjar, Amplitude, Sentry, Google Fonts, Typekit.

## Розширення проекту

### Додати новий заблокований трекер
У `rules.json` додай об'єкт за зразком:
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

### Додати нове CSS-перевизначення
У `content.js` у функції `injectPerformanceCSS()` додай новий блок `rules.push(...)` з потрібними стилями.

### Додати виняток сайту (whitelist)
Розшир `manifest.json` та `background.js`: при завантаженні сторінки перевіряй hostname проти списку з `chrome.storage.sync`, і якщо співпадає — не виконуй `processDom`.

## Відомі обмеження

- Патч таймерів (`throttleTimers`) застосовується тільки до нових викликів — вже запущені інтервали не зачіпаються
- Деякі SPA (React/Vue додатки) можуть працювати некоректно при увімкненому видаленні iframe
- Для застосування змін налаштувань потрібне перезавантаження вкладки (кнопка в popup)

## Ліцензія

MIT — роби що хочеш.

# ⚡ Lite Mode — Chrome Extension (RU)
Расширение для Chromium-браузеров, которое ускоряет загрузку страниц на слабых компьютерах, блокируя тяжёлые HTML-элементы, CSS-эффекты и JavaScript-трекеры.

## Возможности

| Категория | Что делает |
|-----------|-----------|
| **HTML** | Удаляет `<video>`, `<audio>`, `<iframe>` и заменяет заглушкой |
| **CSS** | Отключает анимации, transitions, box-shadow, backdrop-filter |
| **Шрифты** | Блокирует Google Fonts и Typekit, заменяет на системные |
| **JS-трекеры** | Блокирует Google Analytics, Facebook Pixel, Hotjar и др. (через `declarativeNetRequest`) |
| **Таймеры** | Патчит `requestAnimationFrame`, `setInterval`, `setTimeout` |
| **Autoplay** | Скрывает медиа с атрибутом `autoplay` |

## Установка (режим разработчика)

1. Скачай или клонируй репозиторий
2. Открой Chrome/Chromium и перейди на `chrome://extensions/`
3. Включи **"Режим разработчика"** (переключатель справа вверху)
4. Нажми **"Загрузить распакованное расширение"**
5. Выбери папку `lite-mode-extension`
6. Расширение появится на панели — нажимай на иконку ⚡ для настроек

## Иконки

Папка `icons/` должна содержать PNG-файлы: `icon16.png`, `icon48.png`, `icon128.png`.

Для разработки можно создать быстро через любой генератор (например, https://favicon.io/) или нарисовать простую ⚡ иконку.

## Структура файлов

```
lite-mode-extension/
├── manifest.json      — конфигурация расширения (MV3)
├── background.js      — service worker: правила DNR, storage
├── content.js         — DOM-манипуляции на каждой странице
├── popup.html         — интерфейс настроек
├── popup.js           — логика popup
├── rules.json         — правила declarativeNetRequest (блокировка по URL)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Как это работает

### content.js (запускается как `document_start`)
1. Запрашивает настройки из `chrome.storage.sync`
2. Инжектирует `<style>` с CSS-переопределениями до рендера страницы
3. После `DOMContentLoaded` сканирует DOM и удаляет/заменяет нежелательные элементы
4. Запускает `MutationObserver` для отслеживания динамически добавляемых элементов
5. Патчит `window.requestAnimationFrame` / `setInterval` / `setTimeout`

### background.js (service worker)
- Активирует/деактивирует ruleset через `declarativeNetRequest.updateEnabledRulesets`
- Хранит настройки в `chrome.storage.sync` (синхронизируется между устройствами)
- Рассылает обновления настроек во все вкладки при изменении

### rules.json (declarativeNetRequest)
Статические правила блокировки — работают на уровне сети, до загрузки ресурса.
Список включает: Google Analytics, GTM, Facebook Pixel, Hotjar, Amplitude, Sentry, Google Fonts, Typekit.

## Расширение проекта

### Добавить новый заблокированный трекер
В `rules.json` добавь объект по образцу:
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

### Добавить новый CSS-переопределение
В `content.js` в функции `injectPerformanceCSS()` добавь новый блок `rules.push(...)` с нужными стилями.

### Добавить исключение сайта (whitelist)
Расширь `manifest.json` и `background.js`: при загрузке страницы проверяй hostname против списка из `chrome.storage.sync`, и если совпадает — не выполняй `processDom`.

## Известные ограничения

- Патч таймеров (`throttleTimers`) применяется только к новым вызовам — уже запущенные интервалы не затрагиваются
- Некоторые SPA (React/Vue приложения) могут работать некорректно при включённом удалении iframe
- Для применения изменений настроек нужна перезагрузка вкладки (кнопка в popup)

## Лицензия

MIT — делай что хочешь.
