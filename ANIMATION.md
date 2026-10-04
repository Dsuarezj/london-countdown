# Animation map

How the Lóa / hummingbird reunion is built, so new characters and animations can follow the same
pattern. See `ARCHITECTURE.md` for how the pieces are wired and configured.

JavaScript only toggles classes on `<body>` and never writes inline styles or coordinates.

| File | Owns |
| --- | --- |
| `styles/meeting.css` | The rig contract shared by every character: wing sets, heart, `snuggle`, `settle`, `--journey-duration` |
| `characters/<id>/<id>.css` | One character: size, flap, journey path, gait, arrived pose |
| `styles/affection.css` | Affection beats, written against slots (`.bird--north`, `.bird--south`) |
| `styles/sky-layers.css` | Aurora / tropics / stars / horizon primitives reused by every background |

## 1. State machine

`src/ui/meeting.js` drives the whole scene with body classes:

| Body class | Meaning | Set by |
| --- | --- | --- |
| `journey` | The birds are travelling towards the countdown | `playMeeting()` on every page load |
| `arrived` | The birds are perched together, wings touching | `settleTogether()` |
| one of `config.affection.beats` | Short affectionate beat on top of `arrived` | timer every `affection.intervalMs`, or tap on `.meeting` |

`journey` is replaced by `arrived` after `--journey-duration`. The travel sequence runs on every
load; it only skips straight to `arrived` when the user prefers reduced motion.

Durations JavaScript needs are CSS custom properties, read with `getComputedStyle`:

```css
:root { --journey-duration: 8.4s; }   /* styles/meeting.css */
:root { --beat-duration: 2.6s; }      /* styles/affection.css */
```

Change the value in CSS only; the timeouts follow automatically.

## 2. The meeting point is layout, not coordinates

The birds' **final** position is decided by normal flex layout, and every animation is a
*relative offset from that resting place*.

```html
<div class="meeting">
  <span class="heart">♥</span>
  <div class="bird bird--north character--plover">...</div>
  <div class="bird bird--south character--hummingbird">...</div>
</div>
```

`src/ui/characters.js` creates one `.bird` per origin in `config.origins` order. Two classes are
always present:

- `bird--<slot>` (`north` / `south`) — the place in the story. Affection beats target this.
- `character--<id>` — the artwork. Its own stylesheet targets this.

Because the birds already occupy their final slots, every travel keyframe ends at
`translate(0, 0)` and starts at a large offset:

```css
@keyframes plover-journey {
  0%   { transform: translate(-62vw, -58vh) rotate(16deg) scale(.45); }
  100% { transform: translate(0, 0) rotate(0) scale(1); }
}
```

This keeps the scene centred on any screen size without measuring anything in JavaScript.
Offsets use `vw`/`vh` so they scale with the viewport, and `scale()` grows from small to full size
to suggest distance. Never animate `left`/`top`.

## 3. Two-layer rig per bird

Each bird is two nested elements so two independent motions compose without fighting over the
same `transform`:

```html
<div class="bird bird--north character--plover">   <!-- layer 1: the journey path -->
  <div class="bird__body">                           <!-- layer 2: gait, bob, beats -->
    <svg>...</svg>
  </div>
</div>
```

- `.bird` owns the **path** (`plover-journey`, `hummingbird-journey`).
- `.bird__body` owns the **personality** (`plover-glide`, `hummingbird-hop`, `settle`, beats).

If you need a third simultaneous motion, add another wrapper rather than merging keyframes.

## 4. Character contract

A character is `characters/<id>/<id>.svg` + `characters/<id>/<id>.css`, referenced from
`config.characters`. To be swappable it must respect:

1. **Wing groups.** The SVG has four groups: `.wing--far`, `.wing--near` (flapping, visible during
   `journey`), `.wing--rest` (folded) and `.wing--reach` (stretched to the partner), visible when
   `arrived`. `styles/meeting.css` swaps them.
2. **Facing.** A north character faces right and comes from the top-left; a south character faces
   left and comes from the bottom-right. Its `.wing--reach` path extends past the `viewBox` edge
   towards the partner; `overflow: visible` on the SVG makes the wings overlap.
3. **Scoped CSS.** Every selector starts with `.character--<id>` and every keyframe name with
   `<id>-`, so two characters never collide.
4. **Flap only on flying wings.** Flap animations target `.wing--far` / `.wing--near` only, never
   `.wing--rest` / `.wing--reach`, or they keep moving after arrival.
5. **Own size.** Width uses `clamp(min, min(Xvw, Yvh), max)` inside the character stylesheet.
6. **No `aria` in the SVG.** `characters.js` sets `role="img"` and the localized `ariaLabel` on
   `.bird`.

```css
.character--plover .wing--near { animation: plover-flap 1.1s ease-in-out infinite; }
body.journey .character--plover { animation: plover-journey var(--journey-duration) ... forwards; }
body.arrived .character--plover .wing--reach { transform-origin: 56% 62%; animation: snuggle 5.5s ... }
```

## 5. Travel rhythm: flight vs hops

**Flight** — few keyframes, smooth easing, gentle rotation as the bird banks:

```css
body.journey .character--plover {
  animation: plover-journey var(--journey-duration) cubic-bezier(.33, .1, .4, 1) forwards;
}
```

**Hops** — `linear` easing plus *repeated keyframes* to create pauses. Two identical keyframes at
different percentages mean "stay still for that slice of time":

```css
22%  { transform: translate(36vw, 26vh) scale(.66); }   /* lands */
30%  { transform: translate(36vw, 26vh) scale(.66); }   /* rests here, a stop on the map */
38%  { transform: translate(26vw, 4vh) scale(.74); }    /* apex of the next hop */
```

Keep every landing offset under roughly `30vh` and `40vw`, otherwise the bird sits off-screen
during its pause.

## 6. The dotted map behind them

`.route` is a full-viewport SVG with `preserveAspectRatio="none"` so its two curves stretch to any
aspect ratio. `vector-effect="non-scaling-stroke"` keeps stroke width and dash pattern uniform:

```html
<path class="route__line" d="M 10 3 C 18 20, 28 32, 50 57" vector-effect="non-scaling-stroke"/>
```

The origin pins (`.pin--north`, `.pin--south`) are HTML buttons positioned against the safe areas,
so they never scale or skew with the stretched `viewBox`. They open the info card.

## 7. Background layers

Every background is mounted into `.sky` and scoped by `.sky--<id>`. The shared primitives in
`styles/sky-layers.css`:

1. `.aurora--one/two/three` — linear gradients sheared by `aurora-drift` (`skewX` + `scaleY`).
   Different durations (26 s / 34 s / 19 s) stop them moving in lockstep.
2. `.tropics` — three radial gradients in the southern half.
3. `.stars` — one element whose `background-image` is a list of tiny `radial-gradient` dots.
4. `.horizon` — a dark gradient that grounds the bottom edge.

| Background | Idea |
| --- | --- |
| `aurora-tropics` | The original: aurora north, tropical glow south |
| `origin-weather` | One `.hemisphere` per origin (north on top, south at the bottom). Each gets `data-phase`, `data-condition` and `data-night-sky`. Day uses the shared daylight sky. Night keeps aurora and/or stars as a base layer; partly/overcast/rain/snow fade in on top and only dim that night sky |
| `converging` | Last days: aurora reaches lower, tropics rise higher, a warm glow where they meet |
| `meeting-city` | Meeting day: one sky that follows the meeting city's time and weather (`data-phase`, `data-condition`). No aurora or tropics: only the city sky and a full-width `.confluence` band where both skies fuse. Inside it two square conic gradients (north colours, south colours) rotate 180° apart; an elliptical mask shows only the central band, blurred, so it reads as two currents mixing |

Constraints worth keeping:

- Radial gradient centres must stay **inside** the element box, or the brightest part ends up
  off-screen.
- `mix-blend-mode: screen` only brightens, so it needs a dark base underneath.
- Layers that animate `opacity` (`.tropics`, `.stars`, `.city-lights`) can't be dimmed with
  `opacity`; use `filter: opacity()` so the change can still fade.
- Weather backgrounds paint the last cached sky on mount (no transition, so no flash), then fade
  to the fresh state with `transition`. Never toggle `visibility` or swap a gradient for a weather
  change: add a layer (e.g. `.overcast`) and fade its `opacity`.

## 8. Affection beats

Every `affection.intervalMs`, `src/ui/meeting.js` picks one class from `config.affection.beats`,
adds it for `--beat-duration`, then removes it. The same function runs on a tap of `.meeting`. An
`affectionBusy` flag blocks overlapping beats.

| Class | What happens |
| --- | --- |
| `kissing` | North leans in, south tilts back, heart rises |
| `nestling` | South tucks under north; north's reach wing covers further |
| `circling` | South hops a small arc around north's head; north watches |
| `swaying` | Both lean left then right together |
| `perching` | South lands briefly on north's back |
| `nuzzling` | Both lean in until beaks meet; heart rises |

Selectors start with `body.arrived.<beat>` so they always outrank the character's arrived
animation regardless of stylesheet load order:

```css
body.arrived.kissing .bird--north .bird__body { animation: kiss var(--beat-duration) ease-in-out; }
```

To add a beat: write the CSS in the affection stylesheet and add its name to `affection.beats`.

## 9. Accessibility and size rules

Each stylesheet ends with its own reduced-motion escape (`meeting.css`, `sky-layers.css`,
`base.css`, `info-card.css`, `install-prompt.css`). New files must do the same.

- Off-screen travel offsets would normally create scrollbars. `html { overflow-x: clip }`,
  `body { overflow: clip }` and `.sky { overflow: hidden }` contain them without disabling
  vertical page scroll.
- Sizes use `clamp(min, min(Xvw, Yvh), max)` so artwork follows the shorter side of the screen.

## 10. Checklist for a new animation

1. Place the element in the layout at its final resting position.
2. Decide which body state(s) it reacts to: `journey`, `arrived`, an affection beat, or a new one.
3. Wrap it if it needs two simultaneous motions (path outside, personality inside).
4. Write keyframes that end at `translate(0, 0)` and start at a `vw`/`vh` offset.
5. Use repeated keyframes for pauses, `linear` for hops, a cubic-bezier for flight.
6. Drive any duration JavaScript needs from a custom property on `:root`.
7. Add a `prefers-reduced-motion` escape.
8. Check 320×360 portrait and 667×375 landscape, the smallest sizes the layout targets.
