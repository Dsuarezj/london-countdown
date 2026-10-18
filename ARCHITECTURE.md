# Architecture

A static PWA with no build step: HTML, CSS and native ES modules served as-is by GitHub Pages.
Choices live in `config.json`, words live in `translations/<language>.json`; code only knows how to
render them.

## 1. Decisions

| Decision | Why |
| --- | --- |
| Native ES modules, no framework | The UI is one screen with a handful of text nodes and CSS-driven animations. React (or Preact) adds a runtime, and without a build step JSX needs Babel in the browser (~3 MB, slow first paint, fragile offline). Plain modules give the same separation for zero bytes. |
| Import map with `@/` | `<script type="importmap">` maps `@/` to `./src/`, so imports read `@/utils/meeting-time.js` without a bundler. Requires Safari 16.4+ / Chrome 89+. |
| `config.json` as the control panel | One file edits date, theme tokens, backgrounds, origins, characters, affection beats, kickers and thresholds. It is fetched at start (network-first, cached for offline); only the sky reads the cached copy first (see Offline). |
| Translations apart from config | Every visible text lives in `translations/<language>.json`. Config never holds words, only translation keys (`"kickers.sameSky"`, `"characters.plover"`), so adding a language is one new file plus its code in `config.languages`. |
| Registry for code, config for choice | Backgrounds need behaviour (the weather one fetches data), so they are JS modules registered in `src/backgrounds/index.js`. Config only picks ids. Characters need no behaviour, so they are pure files (SVG + CSS) referenced by path from config. |
| Weather in three layers | `src/gateways/weather-gateway.js` alone knows Open-Meteo and normalizes observations to `PlaceSky`. `src/services/place-sky.js` owns the versioned `place-sky` cache and daylight estimate. `src/backgrounds/weather-scene.js` alone paints the DOM and handles the `backgrounds.weather` toggle. |
| Independent weather dimensions (2026-10-18) | Replace the exclusive `SkyCondition` enum with continuous cloud coverage, separate rain and snowfall rates, and an independent thunder flag. Cloud cover does not imply precipitation, nor does rain imply 100% cloud cover. `clear`, `partly` and `overcast` add no independent information to a cloud percentage, so they are not stored or used as rendering controls. Rain and snow have separate layers and can coexist. The WMO code identifies thunder (95/96/97/99), not cloud coverage or invented precipitation. Fog codes 45/48 are no longer relabelled as overcast; a dedicated fog effect is outside this change. |
| Explicit weather units | Follow [Open-Meteo's documented units](https://open-meteo.com/en/docs): `cloud_cover` is %, `rain` and `showers` are mm, `snowfall` is cm, and `current.interval` is seconds. Request `precipitation_unit=mm` explicitly, validate the returned units and values, then normalize accumulated amounts to hourly rates using `3600 / current.interval`. These are interval-average rates, not instantaneous measurements. Never add snowfall depth to liquid rainfall or label snowfall as mm of water. |
| Closed options as enums | Fixed string sets live in `Object.freeze` maps (`BackgroundMode`, `BackgroundId`, `NightSky`, `SkyPhase`, plus install routes in `install-prompt.js`). Config still stores the string values; JS compares against the enum. |
| Install prompt kept small | For 7 days after the first visit it can show on every load. Cancel stores `dismissedOn` for today and hides it until the next calendar day. Install (or already standalone) stops it for good. |

## 2. Module map

```
index.html            static shell: layout slots, dialog, install prompt, import map
config.json           the control panel
manifest.webmanifest  PWA name, display, icons
icons/                SVG + PNG touch icons listed in the manifest and APP_SHELL
translations/         en.json, es.json, is.json: ui, places, characters, kickers, thresholds
src/
  main.js             composition root: loads config, wires modules, owns the language
  gateways/
    weather-gateway.js  Open-Meteo adapter: request -> PlaceSky (phase, cloudCoverPct, rainMmPerHour, snowfallCmPerHour, thunder)
    wikipedia-gateway.js  localized articles, geographic disambiguation and complete thematic passages
  services/
    facts.js          configured species/city/country -> topic and passage per click, weekly cache
    place-sky.js      last sky per place in localStorage, fresh load with offline fallback
    cached-json.js    loadCachedJson(url): network first, localStorage copy when offline
    config.js         loadConfig, applyThemeTokens
    i18n.js           createTranslator: loads translations, resolves dotted keys, language cycle
    connection.js     toggles #offlineMark when the origin probe fails
  ui/
    headline.js       daily kicker, threshold line under the countdown, city/date/time label
    countdown.js      days/hours/minutes/seconds or the reunion message
    origin-pins.js    pin labels + click -> info card
    info-card.js      <dialog>: name, scientific name, current location, fact + topic link
    characters.js     mounts each origin's character (SVG + CSS) into the meeting row
    meeting.js        journey -> arrived -> affection beats
    together.js       one-shot reunion overlay (heart rain) after countdown zero
    install-prompt.js install prompt (7-day window, dismiss until tomorrow)
  utils/
    enums.js          closed option sets: BackgroundMode, BackgroundId, NightSky, SkyPhase
    stylesheet.js     loadStylesheet(href) -> Promise
    meeting-time.js   time zone math (wall clock -> instant, day numbers, remaining split)
    thresholds.js     findActiveThreshold(entries, remainingMs), shared by the threshold line and backgrounds
  backgrounds/
    index.js          registry and createSky: picks the background from config and mounts it once per plan
    aurora-tropics.js the original sky (shared layers in sky-layers.css; no own stylesheet)
    weather-scene.js  weather layers markup + followWeather: the weather toggle, cached sky, then fresh sky
    origin-weather.js time and weather of each origin city
    converging.js     last days: both skies drift towards the centre
    meeting-city.js   meeting day: meeting city time and weather, both skies swirling together
styles/
  base.css            tokens, layout, topbar, pins, headline, countdown
  sky-layers.css      aurora / tropics / stars / horizon primitives shared by every background
  weather-scene.css   .weather component: tokens, layers, day/night, clouds, rain, snow, thunder
  meeting.css         bird rig contract, wing sets, heart
  affection.css       affection beats (configurable stylesheet)
  together/<id>.css   one-shot reunion overlay; path lives with the player in together.js
  info-card.css       bottom sheet / anchored card
  install-prompt.css  install prompt
  backgrounds/*.css   per-background overrides when needed, linked in index.html so the first paint never waits
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
| `meeting.latitude`, `meeting.longitude` | Coordinates of the meeting city. Used by `meeting-city` when `backgrounds.weather` is on. |
| `theme.tokens` | Overrides for the CSS custom properties defined in `styles/base.css` `:root` (`--night`, `--deep`, `--aurora-mint`, `--aurora-teal`, `--aurora-violet`, `--tropic-magenta`, `--tropic-orange`, `--tropic-turquoise`, `--ink`, `--surface`). Defaults stay in CSS so the first paint is right before config loads. |
| `backgrounds.weather` | `true` follows the live weather (day/night, clouds, rain, snow, thunder). `false` makes no weather request and does not read or write `place-sky`: every sky stays on a clear night (aurora or stars from `nightSky`). |
| `backgrounds.mode` | `BackgroundMode`: `"fixed"` uses `backgrounds.fixed`; `"random"` picks from `backgrounds.random.pool`, stable for `everyDays` days. See `src/utils/enums.js`. |
| `backgrounds.fixed` / `random.pool` / `countdown[].background` / `meetingDay` | `BackgroundId` values: `"aurora-tropics"`, `"origin-weather"`, `"converging"`, `"meeting-city"`. |
| `backgrounds.countdown` | `[{ withinHours, background }]`. When the remaining time is inside a window, that background wins over the mode. The smallest matching window wins. |
| `backgrounds.meetingDay` | Background for the calendar day of the meeting (in the meeting zone). Highest priority. Empty string disables it. |
| `origins.north` / `origins.south` | Slot name is the key. Each origin has a `character` id, `city` and `label` (translation keys of the city and country), coordinates, `timeZone` (used by the weather background and its offline estimate) and `nightSky` (`NightSky`: `"aurora"` or `"stars"`; days are shared). City and country discovery topics derive from these same keys, not separate article or fact lists. |
| `characters.<id>` | `markup` (SVG path), `stylesheet` (CSS path), `scientificName` (also the Wikipedia species lookup) and `text`: translation key of an object with `name` and `ariaLabel`, shown in the info card. |
| `affection` | `stylesheet`, `beats` (body classes defined in that stylesheet) and `intervalMs`. Beat length comes from `--beat-duration` in the stylesheet. |
| `together` | Id of the one-shot reunion overlay (`heart-rain`). Empty string disables it. Stylesheet and player live together in `src/ui/together.js`. |
| `kickers` | Up to ten translation keys. One per day above the city: `dayNumber % kickers.length`, where the day is counted in the meeting zone. |
| `thresholds` | `[{ withinHours, text }]` with `text` as a translation key. Inside a window a small line appears under the countdown (15, 7, 3, 1 days and the last hour). |

Background priority: `meetingDay` → `countdown` window → `mode`.

## 4. Extending

**New background**: add `src/backgrounds/<id>.js` exporting `{ markup, decorate? }`,
register it in `src/backgrounds/index.js`, list the files in `sw.js`, then reference the id from
config. Add `styles/backgrounds/<id>.css` scoped under `.sky--<id>` and link it in `index.html`
only when the shared layers in `sky-layers.css` are not enough (`aurora-tropics` has no own file).
Reuse `AURORA_TROPICS_LAYERS` (or `AURORA_LAYERS`) to keep the visual family. `decorate(skyElement, context)` may set
`data-*` attributes; CSS reacts to them. A weather background wraps its layers in a `.weather`
element with `WEATHER_BASE_LAYERS` / `WEATHER_CLOUD_LAYERS` and calls
`followWeather(sceneElement, place, { enabled: context.weatherEnabled, fadeIn })`; it only adds
placement CSS (direction via `--sky-direction` / `--sun-position`, mirroring, insets).

**New character**: create `characters/<id>/<id>.svg` and `<id>.css`, add it to `config.characters`,
add its `name` / `ariaLabel` under `characters.<id>` in every translation file,
set its `scientificName`, and point an origin at it. No fact lists are needed. The SVG and CSS must respect the rig contract in `ANIMATION.md`
(wing groups, facing direction, journey keyframes ending at `translate(0, 0)`).

**New together animation**: add `{ stylesheet, play }` under that id in `src/ui/together.js`, add
`styles/together/<id>.css`, list both in `sw.js`, then set `together` to the id. It runs once when
the countdown is at zero, the birds have arrived, and the opening affection beat has finished
(1 s + `--beat-duration`) if they just met.

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

Content, top to bottom: character `name`, `scientificName`, current location
(`ui.currentLocation` with `{place}` → translated `city, country`, no bird name),
`ui.didYouKnow` ("Something to discover"), the article title and section, a complete passage, optional
source-language/stale-cache notices, and a `ui.factSource` link to the original Wikipedia section
with its CC BY-SA 4.0 license link.
Loading and unavailable-content messages are explicit. Request numbering prevents a delayed
response from overwriting a newer pin or language selection.

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
centred with auto margins. Markup lives in `index.html` (`#installPrompt`); copy comes from
`ui.installInvite`, `ui.installIos` and `ui.installAction`. It appears after the birds arrive
(`offerInstall` from `playMeeting`'s arrived callback), never during the journey. State is stored
in `localStorage` under `install-prompt` as
`{ firstVisitAt, dismissedOn?, installed? }`. The dismiss calendar day is the device's local date,
not the meeting zone. `InstallRoute` (`native` / `ios-hint`) lives next to the prompt module, not
in `enums.js`.

| Condition | Shown |
| --- | --- |
| First 7 days, not dismissed today, not installed | yes, on every load after the birds arrive |
| Cancelled today (`dismissedOn` = today) | no, until the next calendar day |
| Day 8+, or installed / standalone | never |

Chromium uses the deferred `beforeinstallprompt` event. iOS has no such event, so the same rules
show a hint ("Share → Add to Home Screen") instead of a button. `appinstalled` or already running
in standalone marks `installed: true` and hides the bar for good. The PWA shell is
`manifest.webmanifest` plus the icons under `icons/`.

## 6. Offline

`sw.js` is network-first for same-origin GET requests and precaches every file listed in
`APP_SHELL`; bump `CACHE_NAME` when that list changes. Before the first request in each five-second
window, the worker probes the origin. With no connection it serves the cached copy immediately;
when reachable it uses network-first (`cache: "no-store"`) and refreshes the cache. Navigations
fall back to `index.html`. The precache bypasses the HTTP cache (`cache: "reload"`) and the worker
is registered with `updateViaCache: "none"`, so a deploy is visible on the next load.
Cross-origin requests skip the service worker: Open-Meteo (weather) and Wikipedia (discovery
content). Wikipedia content is cached separately in localStorage; no translation service is used.

`index.html` lists every module with `<link rel="modulepreload">`, so the whole module graph is
requested in parallel instead of one import level at a time. Keep it in sync with `APP_SHELL`.

`config.json` and `translations/*.json` go through `loadCachedJson` (`src/services/cached-json.js`):
the network response is used and stored in `localStorage` (`trip-json:<url>`); the stored copy is
only read when the request fails. City, date and time zone are not hard-coded in the shell: they
come from `config.json` and `translations/*/places`.

`connection.js` probes the origin the same way the worker does and toggles `#offlineMark` when the
app is offline. The active language is stored in `trip-language`.

The sky mounts cache-first. Before any request, `main.js` reads the stored config
(`readCachedConfig`) and mounts the sky from it, so a returning visit opens on the sky it last
showed. The fresh config then goes through the same `showSky`, which builds a plan (background id
plus the context it needs) and only remounts when that plan changed.

Each place's last sky (`phase`, `cloudCoverPct`, `rainMmPerHour`, `snowfallCmPerHour`, `thunder`) is stored in
`localStorage` (`place-sky:<lat>,<lon>`) as `{ version: 2, sky }` by `place-sky.js`. Old unversioned
entries are discarded, not migrated by guessing cloud coverage or an accumulation interval.
Malformed entries are discarded with a warning. Weather backgrounds paint that stored
sky with the markup. The forecast request runs in the background and only writes the dataset again
when the fresh sky differs, so the layers' `transition` plays for day/night (or weather) changes and
a revisit during the same sky does not replay them. With no stored sky, the default night markup is
painted first and then fades into the first forecast. When the request fails the service keeps the
stored sky, or estimates day/night from the place's time zone if nothing was stored. In that
estimate `cloudCoverPct` is `null` (`data-cloud-cover-pct="unknown"`), with no cloud or precipitation
effect; it is not a measured 0% observation and is never cached as one. API failures and cache
fallbacks are logged. With weather disabled, the intentional clear-night preset has 0% clouds. None of this
runs when `backgrounds.weather` is `false`.

### Dynamic discovery content

Each click to open a pin's info card advances its own selection counter, starting at zero.
Selections rotate between species, city and country (`selectionIndex % 3`); after each round
the next complete passage in each article is used. A pin's counter survives switching to the
other pin but resets on page reload. Language rerenders do not advance it, so the same topic
and passage index stay selected while reading. There is no daily limit.
`createFactTopics` derives identities directly from `scientificName`, translated `city`
and translated `label`. `translate(key, language?)` can resolve the fallback-language name
without changing the active language. Changing a location requires the usual city/country
labels, coordinates and time zone, but no additional `topic`, article title or fact translations.

The gateway first resolves the active-language Wikipedia article, following redirects.
City articles must have coordinates within 75 km of the configured origin; if the direct title
does not match, a city/country search checks up to five candidates with matching city names
and coordinates. Disambiguation pages are rejected, not displayed. When the localized article
is missing or has no suitable passages, the gateway tries the first configured language and
its language link back to the requested edition. If only the fallback edition is suitable,
the UI labels the original language rather than silently translating or mixing languages.

Extraction keeps complete paragraphs of 100–800 characters, never cuts a sentence to fit,
and prefers thematic sections (culture, etymology, behaviour, ecology and traditions) over
general prose. Short dependent paragraphs may be joined to the immediately preceding paragraph
within the same section; unresolved pronoun openings, reference sections and list items are
skipped. The article title and section stay visible alongside the text. This is sourced
discovery content, not a guarantee of editorial-quality trivia or AI-generated summaries.
Changing language may select a different passage because Wikipedia editions differ.

Article caches (`topic-article:v1:<topic JSON>`) include the requested and fallback names,
languages, topic kind, country and city coordinates. They refresh after seven days; failed
refreshes keep only the matching topic's saved article, with a visible notice. Changing city,
country or species cannot reuse the old topic's cache. An unseen topic without a connection
shows an unavailable message rather than unrelated content. Failed requests are not cached
and reopening advances to the next selection. Concurrent requests for the same topic share one
in-flight promise.

Run the regression tests with `node --test tests/facts.test.mjs` (Node 22.15+, no dependencies).

## 7. Weather verification and manual QA

The site still has no build step or runtime dependencies. Test tooling requires Node 22.15+,
npm and Python 3 (the E2E static server):

```sh
npm ci
npm exec playwright install chromium
npm test
npm run test:e2e
```

Unit tests assert normalized weather results, combinations, rejected data, cache round-trips and
offline behavior, not mock call counts. Playwright opens the real page with deterministic API
responses and checks computed opacity, precipitation patterns, animation, intensity boundaries,
independent hemispheres, night skies, city lights, disabled weather, cached fallback and reduced
motion. It also compares the mixed-storm sky to a checked-in visual baseline. No external weather
availability or analytics is needed for these tests.

Every E2E case prints `[weather QA]` with the API payload and computed rendering, attaches the
comparison JSON and a screenshot to `playwright-report/`, and saves screenshots in `test-results/`.
Open the report with `npm exec playwright show-report`. To intentionally update the visual
baseline after reviewing a design change, run `npm run test:e2e -- --update-snapshots`.

For manual QA, serve the site (for example `python3 -m http.server 4173 --bind 127.0.0.1`), open
`http://127.0.0.1:4173/?weatherDebug` and inspect the browser console:

- `[weather] API <lat>,<lon>` prints the actual response values and native units, including the
  timestamp and accumulation interval.
- `[weather] Painted <lat>,<lon> (after fade)` prints the applied percentages/hourly rates and
  computed layer opacities and animations after the browser's active transitions finish (normally 2.4 s).
- Warnings distinguish API failure, a cached observation, an estimate with unknown cloud cover,
  and discarded legacy caches. A cached render has no new successful API observation; disabled
  weather intentionally paints a clear night.

For example, `interval=900`, `cloud_cover=40`, `rain=0.25`, `showers=0.5`, `snowfall=0.5` becomes
40% coverage, 3 mm/h rain and 2 cm/h snowfall. By day that paints cloud-cover opacity 0.28,
cloud-veil opacity 0.24, rain opacity 0.88 and snow opacity 0.55, simultaneously. Without the query
parameter, diagnostic tables and transition inspection are disabled.
