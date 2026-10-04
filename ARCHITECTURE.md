# Architecture

A static PWA with no build step: HTML, CSS and native ES modules served as-is by GitHub Pages.
Choices live in `config.json`, words live in `translations/<language>.json`; code only knows how to
render them.

## 1. Decisions

| Decision | Why |
| --- | --- |
| Native ES modules, no framework | The UI is one screen with a handful of text nodes and CSS-driven animations. React (or Preact) adds a runtime, and without a build step JSX needs Babel in the browser (~3 MB, slow first paint, fragile offline). Plain modules give the same separation for zero bytes. |
| Import map with `@/` | `<script type="importmap">` maps `@/` to `./src/`, so imports read `@/utils/meeting-time.js` without a bundler. Requires Safari 16.4+ / Chrome 89+. |
| `config.json` as the control panel | One file edits date, theme tokens, backgrounds, origins, characters, affection beats, kickers and thresholds. It is fetched at start (network-first, cached for offline). |
| Translations apart from config | Every visible text lives in `translations/<language>.json`. Config never holds words, only translation keys (`"kickers.sameSky"`, `"characters.plover"`), so adding a language is one new file plus its code in `config.languages`. |
| Registry for code, config for choice | Backgrounds need behaviour (the weather one fetches data), so they are JS modules registered in `src/backgrounds/index.js`. Config only picks ids. Characters need no behaviour, so they are pure files (SVG + CSS) referenced by path from config. |
| Weather behind a gateway | `src/gateways/weather-gateway.js` is the only module that knows Open-Meteo. It returns `{ phase, condition }` using `SkyPhase` and `SkyCondition` from `src/utils/enums.js`. Swapping provider or moving it behind a server (e.g. a Cloudflare Worker) only changes this file. Open-Meteo needs no API key, so a client-side gateway is enough for now. |
| Closed options as enums | Fixed string sets live in `Object.freeze` maps (`BackgroundMode`, `BackgroundId`, `NightSky`, `SkyPhase`, `SkyCondition`, plus install routes in `install-prompt.js`). Config still stores the string values; JS compares against the enum. |
| Install prompt kept small | For 7 days after the first visit it can show on every load. Cancel stores `dismissedOn` for today and hides it until the next calendar day. Install (or already standalone) stops it for good. |

## 2. Module map

```
index.html            static shell: layout slots, dialog, install prompt, import map
config.json           the control panel
translations/         en.json, es.json, is.json: ui, places, characters, kickers, thresholds
src/
  main.js             composition root: loads config, wires modules, owns the language
  gateways/
    weather-gateway.js  Open-Meteo adapter with last-sky cache and offline fallback
  services/
    cached-json.js    loadCachedJson(url): localStorage copy first, network refresh for next load
    config.js         loadConfig, applyThemeTokens
    i18n.js           createTranslator: loads translations, resolves dotted keys, language cycle
    connection.js     offline mark
  ui/
    headline.js       kicker (daily or threshold) + city/date/time label
    countdown.js      days/hours/minutes/seconds or the reunion message
    origin-pins.js    pin labels + click -> info card
    info-card.js      <dialog> content for an origin and its character
    characters.js     mounts each origin's character (SVG + CSS) into the meeting row
    meeting.js        journey -> arrived -> affection beats
    install-prompt.js install prompt (7-day window, dismiss until tomorrow)
  utils/
    enums.js          closed option sets: BackgroundMode, BackgroundId, NightSky, SkyPhase, SkyCondition
    stylesheet.js     loadStylesheet(href) -> Promise
    meeting-time.js   time zone math (wall clock -> instant, day numbers, remaining split)
    thresholds.js     findActiveThreshold(entries, remainingMs), shared by kickers and backgrounds
  backgrounds/
    index.js          registry, selectBackgroundId, mountBackground
    aurora-tropics.js the original sky (shared layers)
    origin-weather.js time and weather of each origin city
    converging.js     last days: both skies drift towards the centre
    meeting-city.js   meeting day: meeting city time and weather, both skies swirling together
styles/
  base.css            tokens, layout, topbar, pins, headline, countdown
  sky-layers.css      aurora / tropics / stars / horizon primitives
  meeting.css         bird rig contract, wing sets, heart
  affection.css       affection beats (configurable stylesheet)
  info-card.css       bottom sheet / anchored card
  install-prompt.css  install prompt
  backgrounds/*.css   one file per background, loaded only when selected
characters/<id>/      <id>.svg + <id>.css per character
```

Rule of thumb: `gateways/` talk to external APIs, `services/` load or watch app state, `ui/` modules
look up their own elements and expose render functions, `utils/` are DOM-free helpers. `main.js` is
the only place that knows about all of them.

## 3. Configuration reference

| Key | Meaning |
| --- | --- |
| `meeting.date`, `meeting.time`, `meeting.timeZone` | Wall clock of the meeting in its own zone. Converted once to an absolute instant; the countdown is `instant - Date.now()`, so the device time zone never matters. |
| `languages` | Language codes with a file in `translations/`. The first one is the fallback for missing keys. |
| `meeting.city` | Translation key of the headline city. |
| `theme.tokens` | Overrides for the CSS custom properties defined in `styles/base.css` `:root` (`--night`, `--deep`, `--aurora-mint`, `--aurora-teal`, `--aurora-violet`, `--tropic-magenta`, `--tropic-orange`, `--tropic-turquoise`, `--ink`, `--surface`). Defaults stay in CSS so the first paint is right before config loads. |
| `backgrounds.mode` | `BackgroundMode`: `"fixed"` uses `backgrounds.fixed`; `"random"` picks from `backgrounds.random.pool`, stable for `everyDays` days. See `src/utils/enums.js`. |
| `backgrounds.fixed` / `random.pool` / `countdown[].background` / `meetingDay` | `BackgroundId` values: `"aurora-tropics"`, `"origin-weather"`, `"converging"`, `"meeting-city"`. |
| `backgrounds.countdown` | `[{ withinHours, background }]`. When the remaining time is inside a window, that background wins over the mode. The smallest matching window wins. |
| `backgrounds.meetingDay` | Background for the calendar day of the meeting (in the meeting zone). Highest priority. Empty string disables it. |
| `origins.north` / `origins.south` | Slot name is the key. Each origin has a `character` id, `city`, `label` (translation key of the country), coordinates, `timeZone` (used by the weather background and its offline estimate) and `nightSky` (`NightSky`: `"aurora"` or `"stars"`; days are shared). |
| `characters.<id>` | `markup` (SVG path), `stylesheet` (CSS path), `scientificName` and `text`: translation key of an object with `name`, `ariaLabel` and `facts`, shown in the info card. |
| `affection` | `stylesheet`, `beats` (body classes defined in that stylesheet) and `intervalMs`. Beat length comes from `--beat-duration` in the stylesheet. |
| `kickers` | Up to ten translation keys. One per day: `dayNumber % kickers.length`, where the day is counted in the meeting zone. |
| `thresholds` | `[{ withinHours, text }]` with `text` as a translation key. Inside a window the threshold text replaces the daily kicker (15, 7, 3, 1 days and the last hour). |

Background priority: `meetingDay` → `countdown` window → `mode`.

## 4. Extending

**New background**: add `src/backgrounds/<id>.js` exporting `{ markup, stylesheet?, decorate? }`,
add `styles/backgrounds/<id>.css` scoped under `.sky--<id>`, register it in
`src/backgrounds/index.js`, list the files in `sw.js`, then reference the id from config.
Reuse `AURORA_TROPICS_LAYERS` to keep the visual family. `decorate(skyElement, context)` may set
`data-*` attributes; CSS reacts to them.

**New character**: create `characters/<id>/<id>.svg` and `<id>.css`, add it to `config.characters`,
add its `name` / `ariaLabel` / `facts` under `characters.<id>` in every translation file, and point an
origin at it. The SVG and CSS must respect the rig contract in `ANIMATION.md`
(wing groups, facing direction, journey keyframes ending at `translate(0, 0)`).

**New affection set**: copy `styles/affection.css`, keep selectors on slots (`.bird--north`,
`.bird--south`), never on characters, and point `affection.stylesheet` / `affection.beats` to it.

## 5. Responsive model

The screen is a fixed sky with a single centred column on top. Nothing is positioned with
JavaScript, and nothing measures the viewport.

- **One column, centred by flex.** `.stage` is `min-height: 100dvh` with `justify-content: center`.
  `dvh` follows mobile browser chrome as it shows and hides.
- **Sizes follow the shorter side.** Type, countdown cells and birds use
  `clamp(min, min(Xvw, Yvh), max)`. The inner `min()` makes landscape phones shrink by height
  instead of overflowing.
- **Safe areas everywhere an edge is touched.** Pins, top bar, stage padding, info card and
  install prompt add `env(safe-area-inset-*)`.
- **Decoration can't create scroll.** `.sky` and `.route` are `position: fixed` and clip their own
  overflow. `html { overflow-x: clip }` and `body { overflow: clip }` contain the birds' off-screen
  journey without disabling vertical scroll. On screens smaller than 320×360 the page scrolls
  instead of cutting content.
- **Swappable parts inherit the frame.** Backgrounds only paint inside `.sky`, so no background
  can affect layout. Characters live in the `.meeting` flex row, whose height is clamped; their
  width is clamped in their own stylesheet, so a new character only decides its own size.
- **Tap targets are bigger than they look.** Pins and the language button expand their hit area
  with an `::after` overlay.

### Info card

The card is a native `<dialog>` opened with `showModal()`: focus trap, Escape to close, backdrop
and top layer come for free, so it never fights the stage's stacking or overflow rules.

- **Phones (default)**: bottom sheet. Full width, `max-height: min(78dvh, 34rem)`, internal scroll
  with `overscroll-behavior: contain`, bottom padding includes the home indicator safe area. A
  bottom sheet keeps content in the thumb zone and works the same in portrait and in short
  landscape screens.
- **Wide and tall screens** (`min-width: 720px` and `min-height: 540px`): a floating card anchored
  to the pin that opened it. The anchor is pure CSS from `data-origin` on the dialog (north opens
  under the top-left pin, south above the bottom-right pin), so no position is calculated.
- Tap on the backdrop or the close button dismisses it. Content is rebuilt on language change.

### Install prompt

A small fixed bar above the bottom pin (so the pin stays tappable), limited to `24rem` wide and
centred with auto margins. It appears after the birds arrive, never during the journey.

| Condition | Shown |
| --- | --- |
| First 7 days, not dismissed today, not installed | yes, on every load after the birds arrive |
| Cancelled today (`dismissedOn` = today) | no, until the next calendar day |
| Day 8+, or installed / standalone | never |

Chromium uses the deferred `beforeinstallprompt` event. iOS has no such event, so the same rules
show a hint ("Share → Add to Home Screen") instead of a button.

## 6. Offline

`sw.js` is network-first for same-origin GET requests and precaches every file listed in
`APP_SHELL`; bump `CACHE_NAME` when that list changes. If the network has not answered after
`NETWORK_TIMEOUT_MS` (1 s) the cached copy is served, and the late network response still
refreshes the cache. Navigations fall back to `index.html`. Cross-origin requests (the weather API)
skip the service worker. The worker is registered first thing in `main.js`.

`index.html` lists every module with `<link rel="modulepreload">`, so the whole module graph is
requested in parallel instead of one import level at a time. Keep it in sync with `APP_SHELL`.

`config.json` and `translations/*.json` go through `loadCachedJson` (`src/services/cached-json.js`):
the copy stored in `localStorage` (`loa-json:<url>`) is used immediately and the network response
replaces it for the next load, so after the first visit the countdown, labels and kicker render in
the first frame. Edits to those files show up on the second load after deploying.

The last fetched sky of each place is stored in `localStorage` (`place-sky:<lat>,<lon>`). Weather
backgrounds paint it instantly and then fade to the fresh response; the request never blocks the
countdown. When the request fails the gateway keeps the stored condition and estimates day/night
from the place's time zone.
