# Animation map

How the Lóa / hummingbird reunion is built, so new animations can follow the same pattern.

Everything lives in `styles.css`. JavaScript only toggles three classes on `<body>` and never
writes inline styles or coordinates.

## 1. State machine

`app.js` drives the whole scene with three body classes:

| Body class | Meaning | Set by |
| --- | --- | --- |
| `journey` | The birds are travelling towards the countdown | `playArrival()` on a first visit |
| `arrived` | The birds are perched together, wings touching | `settleTogether()` |
| `kissing` | Short affectionate beat, added on top of `arrived` | `startKisses()` every 17 s |

`journey` is replaced by `arrived` after `--journey-duration`. `playArrival()` skips straight to
`arrived` when `localStorage` holds `loa-journey-seen`, or when the user prefers reduced motion,
so the travel sequence only ever plays once per device.

The single source of truth for the travel length is the CSS custom property:

```css
:root { --journey-duration: 8.4s; }
```

`app.js` reads it with `getComputedStyle(...).getPropertyValue("--journey-duration")`. Change the
value in CSS only; the timeout follows automatically.

## 2. The meeting point is layout, not coordinates

The key idea: the birds' **final** position is decided by normal flex layout, and every animation
is a *relative offset from that resting place*.

```html
<div class="meeting">
  <span class="heart">♥</span>
  <div class="bird bird--plover">...</div>
  <div class="bird bird--hummingbird">...</div>
</div>
```

`.meeting` is a flex row sitting right below the countdown. Because the birds already occupy their
final slots, every travel keyframe ends at `translate(0, 0)` and starts at a large offset:

```css
@keyframes plover-journey {
  0%   { transform: translate(-62vw, -58vh) rotate(16deg) scale(.45); }
  100% { transform: translate(0, 0) rotate(0) scale(1); }
}
```

This is why the scene stays centred on any screen size without measuring anything in JavaScript.
Offsets use `vw`/`vh` so they scale with the viewport, and `scale()` grows from small to full size
to suggest distance.

When adding a traveller, never animate `left`/`top`. Put the element in the layout where it should
end up, then animate `transform` from an off-screen offset back to zero.

## 3. Two-layer rig per bird

Each bird is two nested elements so that two independent motions can be composed without fighting
over the same `transform`:

```html
<div class="bird bird--plover">      <!-- layer 1: the long journey across the screen -->
  <div class="bird__body">           <!-- layer 2: the local bob, hop, glide or kiss -->
    <svg>...</svg>
  </div>
</div>
```

- `.bird` owns the **path** (`plover-journey`, `hummingbird-journey`).
- `.bird__body` owns the **personality** (`glide`, `hop-squash`, `settle`, `kiss`).

Nesting is what lets a hummingbird squash on every hop while simultaneously arcing across the
screen. If you need a third simultaneous motion, add another wrapper rather than merging keyframes.

## 4. Wing sets swapped by state

Each bird's SVG carries four wing groups. Only two are visible at a time, and the state class
decides which pair:

| Group | Purpose | Visible when |
| --- | --- | --- |
| `.wing--far` | Back wing, flapping | `journey` |
| `.wing--near` | Front wing, flapping | `journey` |
| `.wing--rest` | Folded over the body | `arrived` |
| `.wing--reach` | Stretched towards the partner | `arrived` |

```css
.wing--rest,
.wing--reach { opacity: 0; }

body.arrived .wing--far,
body.arrived .wing--near { opacity: 0; animation: none; }

body.arrived .wing--rest,
body.arrived .wing--reach { opacity: 1; }
```

The "wings together" moment is purely geometric: the plover's `.wing--reach` path extends past the
right edge of its `viewBox` and the hummingbird's extends past its left edge, while
`.bird--hummingbird` pulls itself closer with `margin-left: -.6rem`. The two shapes overlap, so the
wings read as touching. `overflow: visible` on the SVGs is required for this to work.

Flap speed is the main character cue: `flap` runs at `1.1s` for the plover, `buzz` at `.14s` for
the hummingbird. Both animations are scoped to `.wing--far` / `.wing--near` only — never to
`.wing--rest` / `.wing--reach`, or they keep buzzing after arrival.

## 5. Travel rhythm: flight vs hops

The two paths encode different movement styles using only keyframe spacing.

**Flight** — few keyframes, smooth easing, gentle rotation as the bird banks:

```css
body.journey .bird--plover {
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

Each landing/apex pair is one hop, and the paused landings are the "places" the hummingbird visits.
Keep every landing offset under roughly `30vh` and `40vw`, otherwise the bird sits off-screen
during its pause and the stop is invisible.

## 6. The dotted map behind them

`.route` is a full-viewport SVG with `preserveAspectRatio="none"` so its two curves stretch to any
aspect ratio. The trick that keeps it from looking distorted:

```html
<path class="route__line" d="M 10 3 C 18 20, 28 32, 50 57" vector-effect="non-scaling-stroke"/>
```

`vector-effect="non-scaling-stroke"` keeps the stroke width and the dash pattern uniform no matter
how much the `viewBox` is stretched. The travelling-dashes effect is one animated property:

```css
@keyframes route-flow { to { stroke-dashoffset: -14; } }
```

The endpoint labels (`.pin--north`, `.pin--south`) are plain HTML positioned in percentages rather
than SVG text, so they never scale or skew with the stretched `viewBox`.

## 7. Background layers

The sky is four stacked gradient layers inside `.sky`, all `position: absolute` and blurred:

1. `.aurora--one/two/three` — linear gradients sheared by `aurora-drift` (`skewX` + `scaleY`) to
   suggest curtains. Different durations (26 s / 34 s / 19 s) stop them moving in lockstep.
2. `.tropics` — three radial gradients in the southern half.
3. `.stars` — a single element whose `background-image` is a list of tiny `radial-gradient` dots.
4. `.horizon` — a dark gradient that grounds the bottom edge.

Two constraints learned here, worth keeping:

- Radial gradient centres must stay **inside** the element box. A centre at `100%` on an element
  that already extends past the viewport puts the brightest part off-screen and the colour
  disappears.
- `mix-blend-mode: screen` is what makes the aurora and tropical colours glow where they meet. It
  only brightens, so it needs a dark base underneath.

## 8. The kiss beat

`kissing` is added for 2.6 s and removed, which restarts the animation each time because the class
toggles. Three keyframes fire together: `kiss` leans the plover towards its partner, `blush` tilts
the hummingbird away, and `heart-rise` floats the `.heart` glyph up and fades it out.

To add another periodic beat, follow the same shape: a class added and removed by `setInterval`,
with every element's reaction expressed as its own keyframe.

## 9. Accessibility and size rules

Always end a new animation with a reduced-motion escape. The existing block disables every moving
part and lets the layout show the final state:

```css
@media (prefers-reduced-motion: reduce) {
  .aurora, .tropics, .stars, .route__line, .wing, .bird__body, .bird {
    animation: none !important;
  }
}
```

Two more things to respect when adding elements:

- Off-screen travel offsets would normally create scrollbars. Three rules contain them without
  disabling page scroll: `html { overflow-x: clip }` (propagates to the viewport and kills
  horizontal scroll), `body { overflow: clip }` (contains the vertical reach of the travellers),
  and `.sky { overflow: hidden }` (the aurora layers are inset by `-40%` and, being children of a
  `position: fixed` element, escape the body's clip). Vertical page scroll still works, which is
  what a short screen needs.
- Sizes use `clamp(min, min(Xvw, Yvh), max)`. The inner `min()` ties type and artwork to the
  *shorter* side of the screen, which is what keeps the scene fitting in landscape.

## 10. Checklist for a new animation

1. Place the element in the layout at its final resting position.
2. Decide which body state(s) it reacts to: `journey`, `arrived`, `kissing`, or a new one.
3. Wrap it if it needs two simultaneous motions (path on the outside, personality inside).
4. Write keyframes that end at `translate(0, 0)` and start at a `vw`/`vh` offset.
5. Use repeated keyframes for pauses, `linear` for hops, a cubic-bezier for flight.
6. Drive any new duration from a custom property on `:root` if JavaScript needs to know it.
7. Add the element to the `prefers-reduced-motion` block.
8. Check 320×360 portrait and 667×375 landscape, the smallest sizes the layout targets.
