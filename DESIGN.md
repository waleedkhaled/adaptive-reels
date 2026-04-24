---
name: Adaptive Reels
description: 'Status Board: one flat graphite readout shared by the app and the reels; colour appears only as evidence.'
colors:
  {
    bg-base: '#181612',
    bg-raised: '#22211C',
    bg-overlay: '#2F2C28',
    line-hairline: '#413F39',
    line-control: '#88857E',
    text-primary: '#F2F0EA',
    text-settled: '#D0CCC6',
    text-secondary: '#B3B0A9',
    proven-dim: '#2BA7BF',
    proven: '#65D5EC',
    proven-bright: '#B4EAF6',
    proven-surface: '#0C3037',
    due: '#EAB44A',
    error: '#EF8377',
    error-surface: '#45201C',
    syntax-literal: '#B0D9B7',
    syntax-name: '#C1B3DB',
    scrim: '#181612B8',
  }
typography:
  display: { fontFamily: BarlowSC-Bold, fontSize: 28px, lineHeight: 32px }
  title: { fontFamily: BarlowSC-SemiBold, fontSize: 22px, lineHeight: 28px }
  body: { fontFamily: System, fontSize: 17px, fontWeight: 400, lineHeight: 24px }
  tag: { fontFamily: MonoNL-SemiBold, fontSize: 11px, lineHeight: 14px, letterSpacing: 0.66px }
rounded: { none: 0px, tile: 4px, control: 8px }
spacing:
  { xxs: 2px, xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, xxl: 24px, section: 32px, page: 48px }
components:
  button-primary:
    {
      backgroundColor: '{colors.text-primary}',
      textColor: '{colors.bg-base}',
      rounded: '{rounded.control}',
      height: 48px,
    }
  button-primary-pressed: { backgroundColor: '{colors.text-settled}' }
  answer-row:
    {
      backgroundColor: '{colors.bg-raised}',
      textColor: '{colors.text-primary}',
      rounded: '{rounded.control}',
      height: 56px,
    }
  tile-learned: { backgroundColor: '{colors.proven}', rounded: '{rounded.tile}', size: 22px }
---

# Design System: Adaptive Reels

Scope: the Expo app (SDK 57, RN 0.86, StyleSheet + one token module) and the re-rendered reels (Remotion, 720x1280). Status: a pre-build specification, nothing rendered. It deliberately extends the impeccable DESIGN.md format (13 sections, not a SEED); no impeccable script runs, so frontmatter and tables are kept equal by hand. **Precedence:** this file owns tokens, sizes, marks and fit formulas; `docs/UX.md` owns copy, behaviour and accessibility labels (strings here are sizing examples); `docs/PERFORMANCE.md` owns list, player and encode mechanics; `PRODUCT.md` owns the vocabulary and evidence rules. Numbers were recomputed with code on 2026-10-04; text widths are SF Pro on macOS, not Roboto or Barlow; nothing is verified on a device.

## Overview

**Creative North Star: "Status Board"**

1. One calm readout of the learner's state. App chrome and reels share one flat warm-graphite ground (`#181612`) and one left axis, so the picture has no frame.
2. Colour is evidence. Interaction is neutral (light fill, dark text). Cyan = your own retrieval answer proved it. Amber = a review is due now. Coral = wrong or broken. A fresh profile is greyscale; watching can never add colour.
3. Words in sans, measurements in mono. Barlow Semi Condensed speaks (titles, captions), the system font explains, JetBrains Mono NL measures (code, counts, timers, key letters, state words).
4. Identity sits in two places only: the Matrix + Rail map with its uppercase status column, and the truthful "why this" sentence under every reel and card.
5. Solid and flat: no gradient, shadow, blur or glass. Emphasis is the 2 pt "current thing" rule or a tag-sized reverse-video block. Motion is spent on three moments.

Gate before the 119-reel re-render: render 5 reels (code, flow, hook-heavy, one with `→` and one with `≠` in on-screen text) and build the strip plus one map row on the demo phone. A design-literate viewer should say "learning product with a proof map", not "monitoring dashboard".

### Bans

- Colour without a state behind it. No accent-coloured buttons, links, tabs or icons. Proof cyan on the correct row when the learner chose wrong.
- Amber or cyan anywhere in a reel. Amber on a countdown before it reaches 0:00.
- Gradients, glows, drop shadows, blur, glass (Liquid Glass off), untinted `#000000` or `#FFFFFF`.
- Opacity dimming to de-emphasise. Use `text.secondary`, weight, or positive marks (pins, lit connectors).
- Mono as costume: mono headings, buttons, sentences; uppercase anywhere except the map status column; internal rule names shown to the learner (echo, pace, reteach, fallback; "gap session" and "Prove it" are UX.md's learner-facing terms).
- Eyebrow labels (the dock's "Next up" labels its stepper), hero-metric blocks, progress rings, sparklines, the topic interest meter.
- Nested cards, card grids, coloured side stripes, pills; circles other than number pins and the Seen dot; full-width reverse-video blocks; rules that carry nothing (no soft-key dividers).
- Bounce or overshoot; `withSpring` without explicit `mass: 1`; animating height or any layout prop; springs on scroll offsets; motion on the swipe; anything that loops or pulses, spinners included.
- Lock glyphs, emoji, sparkle icons, Unicode arrows or ticks as icons, icons without a text label, a third icon set, states that need a filled icon variant.
- Any reward for watching: no panel, haptic, colour or count change at reel end. No streaks, confetti, loss-framed copy.
- Text over media without the scrim; `text.secondary` on the scrim or on tinted result rows.
- Raw hex or type numbers in components; `fontWeight` on a custom family; a standalone number outside mono; more than one ticking element per screen.
- Native formSheet and NativeTabs for these surfaces; gesture-only actions (no long-press, no double-tap).
- Reels: baked text in the top 120 px or bottom 160 px; baked chip, progress bar or window dots; non-code text under 26 px; code under `minCode`; centred text; ligatures; em dashes; entrances that move or scale.

## Colors

Warm-neutral ramp on one hue (OKLCH hue about 85, chroma 0.008 to 0.011) so proof cyan is the only cool hue on screen. sRGB hex only (RN 0.86 cannot parse oklch). Every chromatic token is under 80% HSL saturation (proven 78.0, proven.bright 78.6, due 79.2, error 78.9, proven.dim 63, syntax 35 and 36).

| Token            | Hex         | Role                                                                                                                                                                                                 | Contrast, computed (WCAG ratio)                                                                                                                       |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg.base`        | `#181612`   | App ground and reel ground, identical. Feed chrome, cards, map, tab bar.                                                                                                                             | Reference, L* 7.3. BT.709 limited-range fixed point (Y 35, Cb 126, Cr 129 decodes back within 0.10).                                                  |
| `bg.raised`      | `#22211C`   | Map stage, selected matrix row, answer rows, progress panel, onboarding rows; reels: code band, flow boxes.                                                                                          | 1.12 on base. Never the only boundary: always with a rule or outline.                                                                                 |
| `bg.overlay`     | `#2F2C28`   | Dock, panels, toast, pressed and selected rows, disabled button; reels: highlighted code row.                                                                                                        | 1.30 on base, 1.16 on raised.                                                                                                                         |
| `line.hairline`  | `#413F39`   | Decorative rules: progress track, tab bar edge, seam rule, panel top edge, answered non-chosen rows.                                                                                                 | 1.72 base / 1.53 raised / 1.32 overlay. Below 3:1 by design; never the only boundary of a live control.                                               |
| `line.control`   | `#88857E`   | Control outlines (answer rows, secondary and disabled buttons, progress panel), locked dash, unmet connectors.                                                                                       | 4.91 base / 4.38 raised / 3.77 overlay.                                                                                                               |
| `text.primary`   | `#F2F0EA`   | Text, icons, primary button fill, "current thing" rule, selection and focus ring, reverse-video blocks, progress fill, pins; reels: hook, on-screen text, spoken caption words, identifiers, arrows. | 15.85 base / 14.15 raised / 12.19 overlay / 12.34 proven.surface / 12.48 error.surface.                                                               |
| `text.settled`   | `#D0CCC6`   | Pressed fill of the primary button. Not used in reels.                                                                                                                                               | 11.30 base; 1.40 vs text.primary; text.inverse on it 11.30.                                                                                           |
| `text.secondary` | `#B3B0A9`   | Secondary text, inactive tabs, reason connectives, Open and Seen marks, disabled button label; reels: upcoming caption words, comments, punctuation.                                                 | 8.35 base / 7.45 raised / 6.42 overlay; 1.90 vs text.primary.                                                                                         |
| `text.inverse`   | `#181612`   | Text and marks on light or coloured fills: button label, retained tick, pin numeral, reverse-video text.                                                                                             | 15.85 on text.primary / 10.57 on proven / 13.80 on proven.bright / 9.57 on due.                                                                       |
| `proven.dim`     | `#2BA7BF`   | Checked (box 1): tile outline and half fill, the word CHECKED.                                                                                                                                       | 6.35 base / 5.67 raised / 4.88 overlay.                                                                                                               |
| `proven`         | `#65D5EC`   | Learned (box 2): tile fill, LEARNED, lit connectors, learned count; the learner's own correct answer (row outline, icon, "Correct", verdict). Never on buttons, links, tabs, or in reels.            | 10.57 base / 9.43 raised / 8.12 overlay / 8.22 proven.surface.                                                                                        |
| `proven.bright`  | `#B4EAF6`   | Retained (box 3-4): tile fill, always with a dark tick; RETAINED.                                                                                                                                    | 13.80 base / 12.32 raised / 10.61 overlay. 1.31 vs proven (the tick carries the level); 1.15 vs text.primary.                                         |
| `proven.surface` | `#0C3037`   | Background of the chosen, correct answer row.                                                                                                                                                        | 1.15 vs raised; the 2 pt proven outline carries the state.                                                                                            |
| `due`            | `#EAB44A`   | One meaning: a spaced review is due now. Tile dog-ear, clock + DUE, the Review lead in the strip, due counts.                                                                                        | 9.57 base / 8.54 raised / 7.36 overlay. 1.10 vs proven, 1.44 vs proven.bright, 1.51 vs proven.dim: never separable by lightness, so shape carries it. |
| `error`          | `#EF8377`   | The learner's wrong answer (outline, icon, "Your answer", "Not quite."), load failures; reels: deliberately wrong code.                                                                              | 7.04 base / 6.28 raised / 5.41 overlay / 5.54 error.surface.                                                                                          |
| `error.surface`  | `#45201C`   | Background of the chosen, wrong answer row.                                                                                                                                                          | 1.13 vs raised; the 2 pt error outline carries the state.                                                                                             |
| `syntax.literal` | `#B0D9B7`   | Code only (reels and cards): strings, numbers, attribute values.                                                                                                                                     | 11.58 base / 10.33 raised / 8.90 overlay.                                                                                                             |
| `syntax.name`    | `#C1B3DB`   | Code only: function, type and tag names.                                                                                                                                                             | 9.24 base / 8.25 raised / 7.10 overlay; 1.25 vs syntax.literal.                                                                                       |
| `scrim`          | `#181612B8` | Under marks on the picture (Paused, Play, Loading) and image visuals: bg.base at 72%. Primary text only.                                                                                             | Over a white frame: text.primary 6.34 (4.5:1 needs 63% alpha or more); text.secondary 3.34, hence banned.                                             |
| `ground.video`   | = `bg.base` | Chrome colour beside the picture, with a per-platform override if a decoder shifts the ground.                                                                                                       | Device check pending.                                                                                                                                 |

- **Increase Contrast** (`AccessibilityInfo.isDarkerSystemColorsEnabled` on iOS, `isHighTextContrastEnabled` on Android; confirm both on RN 0.86): `line.hairline` becomes `#88857E` (4.91 / 4.38 / 3.77), `line.control` becomes `#B3B0A9` (8.35 / 7.45 / 6.42), `text.secondary` becomes `#D0CCC6` (11.30 / 10.09 / 8.69).
- **Colour blindness**, CIE76 delta-E after Machado simulation at severity 1.0 (normal / protan / deutan / tritan): proven vs due 88 / 78 / 84 / 82; proven vs text.secondary 36 / 23 / 29 / 49; proven.dim vs locked dash 37 / 24 / 30 / 42; error vs proven 81 / 40 / 54 / 104; error vs text.secondary 46 / 17 / 25 / 56 (so wrong always carries an xmark and words); proven.bright vs proven 17 / 11 / 15 / 22 (so Retained always carries its tick); syntax.literal vs syntax.name 45 / 36 / 30 / 21; syntax.name vs text.secondary 26 / 24 / 22 / 6 (names and comments merge for tritanopes; comments keep their comment marker).

## Mastery encoding

One `StateTile` built from plain Views at three sizes: 18 pt (matrix below 390 pt width, progress panel, running head), 22 pt (matrix and rail), 28 pt (dock). Input: `level` (none, seen, checked, learned, retained) plus flags `locked`, `due`, `justUnlocked`, `selected`, `pin`. Interior = level, corner = due, outline = availability: drawn only when the concept is not locked and the level is none, seen or checked. Learned and Retained show no availability; once proven it no longer matters. Shape is the code; colour only reinforces. The tile takes its surface colour as a required prop (gaps and rings are drawn in it).

| Level or flag                           | Outline                                            | Interior                                                                                                         | Colour           | L*  | Status word (rail, `tag`)                                              |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------- | --- | ---------------------------------------------------------------------- |
| none, locked                            | none                                               | centred dash, no lock glyph                                                                                      | `line.control`   | 56  | LOCKED, text.secondary                                                 |
| none, open                              | square outline                                     | empty                                                                                                            | `text.secondary` | 72  | OPEN, text.secondary                                                   |
| seen                                    | outline; none while locked                         | centred round dot                                                                                                | `text.secondary` | 72  | SEEN, text.secondary                                                   |
| checked (box 1)                         | outline; none while locked                         | bottom half filled, flat edge at 50%                                                                             | `proven.dim`     | 63  | CHECKED, proven.dim                                                    |
| learned (box 2)                         | none                                               | solid fill, no glyph                                                                                             | `proven`         | 80  | LEARNED, proven                                                        |
| retained (box 3-4)                      | none                                               | solid fill + tick in text.inverse                                                                                | `proven.bright`  | 90  | RETAINED, proven.bright; no box number (58.1 pt, the widest word)      |
| flag `due` (checked, learned, retained) | unchanged                                          | top-right corner folded: amber triangle behind a gap in the surface colour; the tick shrinks and moves down-left | `due`            | 77  | clock icon + DUE, due                                                  |
| flag `justUnlocked` (none, open)        | thicker, `text.primary`                            | empty                                                                                                            | `text.primary`   | 95  | NEW, text.primary, until seen or the next visit                        |
| flag `selected`                         | 2 pt ring in `text.primary`, 2 pt outside the tile | unchanged                                                                                                        | `text.primary`   | 95  | row gets bg.overlay; the title keeps its weight (600 would re-wrap it) |

| Mark, pt                                                    | 18                                                                                                                                              | 22            | 28              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------- |
| Corner radius                                               | 3                                                                                                                                               | 4             | 5               |
| Outline (open, seen, checked) / NEW outline                 | 1.5 / 2.5                                                                                                                                       | 1.5 / 2.5     | 2 / 3           |
| Locked dash, w x h                                          | 8 x 2                                                                                                                                           | 10 x 2        | 12 x 2.5        |
| Seen dot, diameter                                          | 5                                                                                                                                               | 6             | 8               |
| Checked fill height                                         | 9                                                                                                                                               | 11            | 14              |
| Retained tick, box / stroke; when due: box, shift down-left | 10 / 2; 8, 3                                                                                                                                    | 12 / 2; 10, 3 | 16 / 2.5; 13, 4 |
| Due dog-ear, leg / gap                                      | 10 / 2 (leg 8 when pinned)                                                                                                                      | 11 / 2.5      | 14 / 3          |
| Number pin                                                  | 12 pt disc `text.primary` + 1 pt surface ring (14 overall), numeral `pinNumeral` in text.inverse, centre 2 pt inside the tile's top-left corner | same          | same            |

- **Construction, bottom to top:** fill, outline (the tile's border), tick, dog-ear, gap, pin. The tile clips to its radius. Dog-ear = a zero-size View in the top-right corner with a top border in `due` and a transparent left border, each one leg wide; gap = a surface-colour bar rotated 45 degrees on the hypotenuse; pin and ring sit outside the clip. On a checked tile the gap notches the half fill by about 4 pt: intended.
- **Clearances (computed).** Pin with ring: 1 pt to the left neighbour, 2.2 / 5.2 pt to the triangle at 22 / 28; at 18 it would cut 0.7 pt into a 10 pt leg, hence leg 8 when pinned (1.2 pt clear). Due tick end to gap: 2.2 / 2.4 / 3.4 pt.
- **One pin set at a time:** ranks 1 to 3 of the dock's suggestions by default; while a locked concept is selected, its gap-chain order 1 to n instead, on rail rows and the matching matrix tiles.
- **Greyscale:** L* is not monotonic with level (outline 72 above half 63) and adjacent fills are only 1.66:1 and 1.31:1, so the ladder dash, outline, dot, half, full, tick is required. NEW vs Open: 1.90:1 plus 1 pt of stroke.
- **Due never relies on colour** (1.10:1 against proven): corner, gap and the word DUE with a clock carry it. Weakest case: Learned + due in the matrix, a triangle of 12 to 15% of the tile with no word beside it; the row's count column backs it up. Gate before freezing: A/B against a 12 pt clock disc at 18 and 22 pt, greyscale, on the phone.
- **Locked but started** (after a gap session): no outline, interior shown, rail word = level word (LOCKED only at level none), dock line per UX.md 5.5. Locked + seen is a lone dot beside dashes: weak, on the device checklist. Retained and learned + due cannot occur on the 3-minute demo clock: show them with a seeded profile. The L* and delta-E tables are unit tests of the token module.

## Typography

| Family                                       | Source, licence                                                   | Static files to bundle (`packages/fonts`, shared by app and Remotion)                                                       | Role                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Barlow Semi Condensed                        | github.com/jpt/barlow `fonts/ttf/`, OFL 1.1                       | `BarlowSemiCondensed-SemiBold.ttf` (600), `BarlowSemiCondensed-Bold.ttf` (700)                                              | Display voice: titles, question, verdict, concept and topic names; reels: hook, on-screen text, captions, flow labels |
| JetBrains Mono NL (no ligatures in the file) | github.com/JetBrains/JetBrainsMono `fonts/archives/ttf/`, OFL 1.1 | `JetBrainsMonoNL-Medium.ttf` (500), `JetBrainsMonoNL-SemiBold.ttf` (600); reels only: `JetBrainsMonoNL-ExtraBold.ttf` (800) | Code, standalone data, state words. NL needs no `fontVariant` or CSS feature switch                                   |
| System (SF Pro / Roboto)                     | platform                                                          | none                                                                                                                        | Body: options, explanations, reason sentence, rail titles, buttons, tab labels                                        |

The app loads 4 files with `useFonts` and holds the splash until they resolve: 759 KB (168,500 + 170,604 + 209,100 + 210,684 bytes in the GitHub listings; not downloaded), as PERFORMANCE.md section 5 budgets (EAS builds embed them). One family name per file, the same in app and Remotion (`BarlowSC-SemiBold`, `BarlowSC-Bold`, `MonoNL-Medium`, `MonoNL-SemiBold`, reels also `MonoNL-ExtraBold`); never add `fontWeight` (Android synthesises bold). Keep both `OFL.txt` files. No variable fonts on SDK 57. Components use only these tokens (same names in the module):

| Token                                    | Size / line, pt                                | Face                                                    | Use                                                                                            |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `display`                                | 28 / 32                                        | Barlow SC 700                                           | Verdict ("Correct." / "Not quite."), onboarding headline, session summary                      |
| `title`                                  | 22 / 28                                        | Barlow SC 600                                           | Screen titles, question                                                                        |
| `heading`                                | 17 / 22                                        | Barlow SC 600                                           | Running head, map header title, concept title in dock and panel, stage topic, onboarding rows  |
| `label`                                  | 13 / 16                                        | Barlow SC 600, letterSpacing 0.13 pt                    | Matrix topic labels and large-text tab labels (two lines)                                      |
| `body`, `option`, `button`               | 17 / 24 at 400; 17 / 22 at 500; 17 / 22 at 600 | System                                                  | Running text; answer options; button labels                                                    |
| `bodyS`                                  | 15 / 21                                        | System 400                                              | Explanations, panel text, contract line                                                        |
| `sentence`, `rowTitle`, `sentenceStrong` | 15 / 20 at 400, 500, 600                       | System                                                  | Reason connective words; rail titles; lead word and cause                                      |
| `caption`, `captionStrong`               | 13 / 18 at 500; 13 / 16 at 600                 | System                                                  | Secondary lines, needs lines, legend; quick-action, result, change-line and paused-mark labels |
| `micro`                                  | 12 / 14                                        | System 600                                              | Tab labels, Sound label, "Next up" (12 pt is the floor for tappable text, 11 for the rest)     |
| `dataL`, `dataM`                         | 20 / 24 at 600; 15 / 20 at 500                 | Mono NL                                                 | Dock countdown; answer key letters                                                             |
| `dataS`, `pinNumeral`                    | 13 / 16 at 500; 11 / 11 at 600                 | Mono NL                                                 | "1/8", "1/40" in the map header, stepper "1/3", due counts; pin numeral                        |
| `tag`                                    | 11 / 14                                        | Mono NL 600, UPPERCASE, letterSpacing 0.66 pt (0.06 em) | Map status column only: LOCKED, OPEN, NEW, SEEN, CHECKED, LEARNED, RETAINED, DUE               |
| `code`, `codeKeyword`                    | 15 / 22 at 500, 600                            | Mono NL                                                 | Code inside cards                                                                              |

- **Numerals.** Standalone data fields (counts, timers, key letters, pins) are Mono NL. Numbers inside sentences stay in the system font with `fontVariant: ['tabular-nums']`. Light on dark: nothing below weight 400, and text at 13 pt or below is 500 or heavier.
- **Dynamic Type.** Everything scales; `allowFontScaling={false}` is never used.

| Surface                                     | `maxFontSizeMultiplier`     | Behaviour                                                                                                                                                             |
| ------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Running head, reason strip                  | 1.3                         | The strip height is computed (Layout): two lines up to fontScale 1.0, three above                                                                                     |
| Quick-action, tab and Sound labels          | 1.2                         | "More like this" is 84 pt at 1.0 and 101 at 1.2 in a 120 pt cell at 360 wide                                                                                          |
| Card: question, options, explanation, panel | none (tested target 2.0)    | Body scrolls inside the locked page; the pinned action row grows with its button                                                                                      |
| Map rail and dock; `tag`                    | none (designed to 1.6); 1.3 | Rows and dock grow, the stage scrolls. Status column = round(6 + 58.1 x min(fontScale, 1.3)): 64, 76 at 1.2, 82 from 1.3                                              |
| Matrix labels and counts                    | 1.2                         | 38.4 pt of text in a 42 pt row. From fontScale 1.35 the matrix becomes the five-tab row (Layout)                                                                      |
| Reel text                                   | cannot scale                | Required: a native, scalable transcript (narration, on-screen text, code) in the concept panel and behind the screen-reader "Read transcript" action (UX.md 6.1, 6.2) |

## Layout

Spacing scale (pt): 2, 4, 8, 12, 16, 20, 24, 32, 48. Gap inside a group 8, between rows 12, between groups 24, above a heading 32, below 12. Gutter 16 on the map and You. Feed chrome and card content use the picture's axis: `axis = pillar + pictureWidth x 40 / 720` (20.0 pt at 360, 21.8 at 393, 35.5 folded at 375x667), so native, card and baked text share one left edge. No centred text blocks.

Row heights: feed top row, map header and legend row 44 on iOS, 48 on Android (`topRow`); 48 quick-action row, tab bar, stage header, buttons and rail rows (minimum); 56 answer and onboarding rows (minimum); 64 card action row and rail row with a needs line. Minimum touch target 48 x 48 with 8 between; the 44 pt rows on iOS are the HIG minimum. Matrix tiles are smaller on purpose: the row is the target, never below 42 (ergonomics must-fix E3), and the rail row is the full-size equivalent.

**Strip height** depends on fontScale only, so the picture never changes size between items: `k = clamp(fontScale, 1, 1.3)`, `lines = fontScale > 1 ? 3 : 2`, `strip = ceil(20 + 20 x lines x k)` (2 pt progress line + 9 + text + 9): 60 at 1.0, 88 at iOS 1.118, 89 at Android 1.15, 95 at 1.235, 98 from 1.3. Simulated with SF Pro word widths: every UX.md 5.1 and 5.6 sentence with the 36-character title fits two lines at 1.0 from 360 wide (273 pt beside the glyph) and three at 1.3; the box-1 review sentence needs the third at the first step above 1.0 at 360 and 375 wide.

**Feed fit** (pure function, unit-tested): `s = min(W/720, (H - insetTop - topRow - strip - 48 - tabBar - insetBottom) / 1000)`, `tabBar` 48, or 0 in a session. Picture = 720s x 1280s, its 1000 px content band centred in the free region; the reel's flat top and bottom bands may sit under chrome. Table at strip 60:

| Window, insets top / bottom                  | Free, pt    | Picture                | 24 / 26 / 42 px on screen, pt |
| -------------------------------------------- | ----------- | ---------------------- | ----------------------------- |
| 360x800 Android, 24 / 24 (3-button: 24 / 48) | 548 (524)   | full width             | 12.0 / 13.0 / 21.0            |
| 375x812, 44 / 34                             | 534         | full width             | 12.5 / 13.5 / 21.9            |
| 390x844, 47 / 34 and 393x852, 59 / 34        | 563 and 559 | full width             | 13.1 / 14.2 / 22.9 at 393     |
| 402x874, 412x915, 430x932, 440x956           | 578 to 660  | full width             | 13.4 / 14.5 / 23.4 and up     |
| 375x667, 20 / 0 (16:9 class)                 | 447         | 86%; folded layout 91% | 11.4 / 12.3 / 20.0 folded     |
| 360x640 Android, 24 / 48                     | 364         | 73% (code 8.7 pt)      | out of scope                  |

With larger text the picture shrinks before text clips: at strip 98 it is 95.2% of the width at 375x812, 95.5% at 393x852, 96.9% at 390x844, 97.2% at 360x800 with 3 buttons. **Folded layout**, only when the picture would fall under 93% (free < 0.93 x 1000 x W/720): no top row, the running head becomes the first line of the strip (`stripFolded = ceil(14 + (22 + 20 x lines) x k)`: 76 at 1.0, 121 at 1.3), Sound moves to You. Fit tests: the rows above at fontScale 1.0, plus 393x852 and 375x812 at 1.15, 1.235 and 1.3, which must not fold.

**Map fit** (pushed route, no tab bar). Full mode: header, legend row (`topRow` each), five matrix rows of 44, then the stage; the dock overlays the stage's bottom edge; a seeded profile adds a 24 pt "Sample data" band under the header. Compact mode takes height from the legend, not from targets: matrix rows 42, the legend a 20 pt text line, "Key" a 48 pt button in the header. `fit(window, insets, fontScale, platform, need)` runs when the map opens: full if the stage span holds `need`, the height of the topic it opens on (stage header 48 + its rail rows), else compact; if that is still short, the rail scrolls the changed row into view before the replay. Switching topic never changes the mode. The dock is off-screen during the replay. `need` at default text (SF Pro widths): React Native 448 from 390 wide, 452 below ("Performance and re-renders" takes two lines); Problem solving 448; React + TS and AI engineering 432; Systems design 468 (488 at 360).

| Window                                                     | Span, full / compact | Opening on React Native                          | On Systems design      | At rest, above a 172 pt dock |
| ---------------------------------------------------------- | -------------------- | ------------------------------------------------ | ---------------------- | ---------------------------- |
| 390x844                                                    | 455 / 489            | full                                             | compact                | stage header + 4.9 rows      |
| 393x852                                                    | 451 / 485            | full                                             | compact                | header + 4.8 rows            |
| 375x812                                                    | 426 / 460            | compact                                          | compact, scrolls 8 pt  | header + 5.0 rows            |
| 360x800 Android, gesture                                   | 436 / 474            | compact                                          | compact, scrolls 14 pt | header + 5.3 rows            |
| 360x800 Android, 3-button                                  | 412 / 450            | compact; 450 against 448 to 452 (Roboto decides) | compact, scrolls 38 pt | header + 4.8 rows            |
| 412x915 Android, gesture / 3-button (top inset assumed 32) | 543 / 519 in full    | full                                             | full                   | header + 6.7 / 6.2 rows      |

With a 48 pt tab bar the React Native span falls short on every phone up to 393x852 even in compact mode (441 and 437), which is why the map is a pushed route. Matrix columns: label 88 (two lines), tiles 8 x 22 with 6 pt gaps = 218 (8 x 18 = 186 below 390 pt width), count 32 (two lines: "1/8" over clock + due count), 8 pt between columns: 354 of 358 at 390, 322 of 328 at 360. **Large text** (fontScale 1.35 or more): the matrix becomes a full-bleed row of five tabs, W/5 wide, min height 64: short topic name in `label` on two lines, under it the count in `dataS` with a 13 pt clock in `due` when a review is due, both capped at 1.1; selected = bg.raised, text.primary, a 2 pt `line.current` top edge. "engineering" at 14.3 pt must fit 64 pt at 360: unmeasured in Barlow.

## Elevation & Depth

None. No shadows, blur, gradients or glass. Depth is one surface step (`bg.base`, `bg.raised`, `bg.overlay`) plus a rule or outline; at most one step inside another, never a card in a card. Liquid Glass is off (optional later on the tab bar only, gated on `isLiquidGlassAvailable()`, `isGlassEffectAPIAvailable()` and Reduce Transparency off). Set `userInterfaceStyle: "dark"` and the root background to `bg.base` (expo-system-ui) so launch never flashes white.

## Shapes

| Token            | Value                                     | Use                                                                                                   |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `radius.none`    | 0                                         | Every full-width band: strip, action row, tab bar, dock, panels, code band                            |
| `radius.tile`    | 4 (3 at 18 pt, 5 at 28 pt)                | Tiles, reverse-video blocks, key-letter block                                                         |
| `radius.control` | 8 (16 px on the reel canvas)              | Buttons, answer rows, progress panel, toast, onboarding rows, paused mark, flow boxes                 |
| `line.rule`      | 1 pt `line.hairline`                      | Tab bar top edge, seam rule, panel top edge. Only where it carries something                          |
| `line.track`     | 2 pt `line.hairline`                      | Progress track on the strip's top edge                                                                |
| `line.current`   | 2 pt `text.primary`                       | The "current thing": progress fill, active tab mark, stage top edge, caption playhead (4 px in reels) |
| `line.outline`   | 1 pt `line.control`                       | Live control boundary, disabled button, progress panel (3.77 to 4.91:1)                               |
| `line.state`     | 1.5 pt (2 at 28 pt); NEW 2.5 (3 at 28 pt) | Tile outlines                                                                                         |
| `line.result`    | 2 pt                                      | Selected or answered row outline; selection and focus ring (2 pt offset)                              |

## Motion and haptics

Reanimated 4.5.1. Only transform, opacity, backgroundColor and borderColor animate. Keep animated views well under 100. Write `sv.get()` / `sv.set()`. One mechanism per property: translate and press scale = `withSpring`; tile fill (scaleY) and counter roll = `withTiming`; colour and opacity = Reanimated CSS transitions; `fade.rm` (opacity by `withTiming`, Reduce Motion only) is the one exception. Scroll offsets are not animated by this system: Continue, scroll to the result and scroll into view before the replay use `scrollToIndex({ index, animated: !reduceMotion })` on the pager and `scrollTo({ y, animated: !reduceMotion })` elsewhere, with the platform curve and no tokenised duration.

| Token            | Config                                                            | Computed                                          | Use                                                                                | Reduce Motion substitute                                           |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `spring.fast`    | `{ mass: 1, stiffness: 1400, damping: 67 }`                       | ratio 0.895, within 1% at 135 ms, overshoot 0.18% | Reason sentence roll (8 pt), pin and dog-ear appear, tile press scale 0.96         | No transform; `fade.rm`                                            |
| `spring.default` | `{ mass: 1, stiffness: 700, damping: 48 }`                        | ratio 0.907, 198 ms, 0.11%                        | Panels, dock and toast by translateY                                               | Appears in place with `fade.rm`                                    |
| `color.fast`     | CSS transition 120 ms, `cubicBezier(0.2, 0, 0, 1)`                | -                                                 | Press feedback                                                                     | 0 ms                                                               |
| `color.default`  | CSS transition 200 ms, same easing                                | -                                                 | Tile outline and colour, answer row result, connector colour, reverse-video blocks | 0 ms; changed mark holds a 2 pt `text.primary` outline for 1000 ms |
| `color.slow`     | CSS transition 320 ms, same easing                                | -                                                 | Topic cross-fade on the stage, paused mark                                         | `fade.rm`                                                          |
| `fill`           | `withTiming` 450 ms, `Easing.bezier(0.2, 0, 0, 1)`                | -                                                 | Tile fill as scaleY from the bottom edge                                           | Instant; outline hold as above                                     |
| `count`          | `withTiming` 300 ms, same easing                                  | -                                                 | Header counter roll                                                                | Instant                                                            |
| `stagger`        | 90 ms per item as CSS `transitionDelay`, at most 6 items (540 ms) | -                                                 | Unlock wave after the snapshot swap                                                | All at once                                                        |
| `hold`           | 1200 ms, static                                                   | -                                                 | Reverse-video blocks: changed marker, fired quick-action label                     | Same                                                               |
| `fade.rm`        | `withTiming` 150 ms opacity                                       | -                                                 | The only motion under Reduce Motion                                                | -                                                                  |

- Explicit mass matters: the library default is mass 4, which turns these ratios into 0.45 (bouncy). **Reduce Motion has one source:** a store holding `AccessibilityInfo.isReduceMotionEnabled()`, updated by `reduceMotionChanged`. Every `withSpring` and `withTiming` gets `reduceMotion: rm ? ReduceMotion.Always : ReduceMotion.Never` (`fade.rm` always `Never`); CSS durations follow the same value. The default `ReduceMotion.System` is never used: the library reads the setting once at app start (02 fact-check, stated for `useReducedMotion`, assumed for `System`), so a mid-session toggle would split the motion. Android "Remove animations" counts as Reduce Motion. Confirm the `cubicBezier` export name in the 4.5.1 docs.
- **Motion budget, three moments.** (1) The reason changes when the feed adapts: old sentence up 8 pt and out, new in from below, one reverse-video block for 1200 ms. (2) The retrieval result: row colour, then the panel (0 ms result and haptic, 120 ms panel in, 350 ms fill, children open at 90 ms each on Learned). (3) The map replay on open, once, under 2.1 s: last-seen snapshot, swap to live state with per-tile delays, dock slides in at 1800 ms.
- Reels (Remotion, 30 fps): every entrance is opacity only, `interpolate(frame, [0, 6], [0, 1])` with `Easing.bezier(0.2, 0, 0, 1)`: no rise, scale, draw-on or overshoot. Code lines take 4 frames each; flow boxes appear in order, then their arrows fade in. A reel therefore autoplays under Reduce Motion, but never with a screen reader running (UX.md 6.3; owner decision). Frame counts assume 30 fps (`VIDEO.fps`, PERFORMANCE.md 6.1). The pager swipe stays and every change is announced (UX.md 6.1).

| Event (always paired with a visible change)             | iOS                          | Android (`performAndroidHapticsAsync`; confirm enum names in the v57 doc) |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Select an answer option                                 | `selectionAsync()`           | `Segment_Tick`                                                            |
| Check answer: correct                                   | `notificationAsync(Success)` | `Confirm`                                                                 |
| Check answer: wrong                                     | `notificationAsync(Error)`   | `Reject`                                                                  |
| Quick action tapped                                     | `impactAsync(Light)`         | `Context_Click`                                                           |
| Concept becomes Learned (once, when the fill completes) | `impactAsync(Medium)`        | none (Confirm already played)                                             |

Nothing on swipe, autoplay, reel end, map selection or tab change. Settings toggle in You. Haptics are silent in Low Power Mode, so no meaning depends on them. No UI sounds; narration is the only audio.

## Iconography

`expo-symbols` behind one `Icon` wrapper: SF Symbols on iOS, Material Symbols on Android. Every icon has a text label beside or under it (back, disclosure and stepper chevrons: accessibility label only). Colour: `text.primary` active, `text.secondary` inactive; a state colour only when the label beside it carries that state (clock beside DUE, checkmark beside "Correct", xmark beside "Not quite.", warning beside a failure). Sizes: 28 paused mark, 22 tabs and verdict, 20 answer rows and failures, 18 quick actions, pool glyph and Sound, 13 inline. Weight: SF medium; Material wght 500, FILL 0: no state uses a filled variant (`plus` has none; FILL on Android is unverified).

| Use                                                 | SF Symbol                                                                               | Material Symbol                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Tabs: Feed, Map, You                                | `play.rectangle`, `square.grid.3x3`, `person`                                           | `smart_display`, `grid_view`, `person`                          |
| Quick actions: More like this, Too easy, Not for me | `plus`, `forward.end`, `eye.slash`                                                      | `add`, `skip_next`, `visibility_off`                            |
| Pools: Review, Deepen, Explore, Lateral             | `clock`, `arrow.down.to.line`, `arrow.up.right`, `arrow.left.and.right`                 | `schedule`, `vertical_align_bottom`, `north_east`, `swap_horiz` |
| Result, state change, undo, failure                 | `checkmark`, `xmark`, `arrow.right`, `arrow.uturn.backward`, `exclamationmark.triangle` | `check`, `close`, `arrow_forward`, `undo`, `warning`            |
| Playback and sound                                  | `play.fill`, `speaker.wave.2`, `speaker.slash`                                          | `play_arrow`, `volume_up`, `volume_off`                         |
| Navigation and disclosure                           | `chevron.left`, `chevron.right`                                                         | `chevron_left`, `chevron_right`                                 |

Names are unconfirmed against the SF Symbols app and the expo-symbols typings (beta; weight and grade control unverified). The Too easy glyph depicts skipping while the action queues a question: on the tester checklist. Not icons (plain Views): the mastery marks, pins and the 8 pt matrix caret (a border triangle). In reels the Mistake xmark and the arrowheads are SVG paths with a 3 px stroke.

## Components

All surfaces are solid. Chrome is mounted once, outside the pager, and follows the active item (PERFORMANCE.md 2.1). Reel item, top to bottom: status inset, top row, picture, reason strip (60 at default text; its top edge is the 2 pt progress line), quick-action row 48, tab bar 48 + bottom inset. Card item: body from the status inset, strip, action row 64, tab bar; the strip therefore sits 16 pt higher on cards and changes place with its sentence when the active item changes, without animation. Rules exist only on the progress line, the seam and the tab bar edge. Strings, panel contents and accessibility labels are in UX.md sections 3, 5 and 6.1; the app renders only the reason code the agent used.

| Component                  | Size, pt                                                                                                                      | Anatomy and tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | States                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video cell chrome          | top row 44 (48 on Android); picture from the feed fit                                                                         | Running head on the feed axis, one button (opens the concept panel): 18 pt state tile + concept in `heading` + " in {topic}" in text.secondary, one line, topic truncates first. Right: Sound control 72 wide, icon 18 over a `micro` label ("Sound off" is 57.5 pt, 69 at the 1.2 cap, too wide for 48). Seam rule: 1 pt hairline under the top row (flag `feed.seamRule`); pillars, when present, are bg.base with 1 pt hairlines. First-frame cover in `ground.video`: PERFORMANCE.md 2.3.                                                                                                                                                                                                                                                                                                                                                                                                                   | Paused or waiting for Play: scrim square, min 72 x 72, radius 8, `play.fill` 28 over "Paused" or "Play" in `captionStrong`; it is the Play button. Buffering over 400 ms (signal: PERFORMANCE.md 2.3): the same square with the static word "Loading". Sound starts off and persists. Failed: warning icon + message + secondary "Try again" + text button "Skip".                                                                                                                                                                                                                                                                                                                                   |
| Reason strip ("why this")  | computed (60 at default text), full width, one button                                                                         | Progress line on top (track `line.track`, fill `line.current`; cards show the track only). On the feed axis: pool glyph 18 + lead word (`sentenceStrong`) when the item came from a pool, then the sentence (connectives `sentence` text.secondary, cause `sentenceStrong` text.primary), never truncated; `chevron.right` 13 at the right. Only Review is coloured: clock and lead in `due`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Changed by the learner's last action: the sentence rolls and a reverse-video block (radius 4, padding 2 x 6) sits for 1200 ms on the lead word or, without a lead, on the span naming the action (at most 15 characters). Pressed: bg.overlay. Tap opens the reason panel. A confirmation with an underlined "Undo" replaces it for 4 s (10 s with a screen reader).                                                                                                                                                                                                                                                                                                                                 |
| Action row                 | 48 on a reel, 64 on a card                                                                                                    | Reel: three equal quick-action cells, no dividers, icon 18 over label in `captionStrong`. Card: "Later" (text button, intrinsic width) + one primary button filling the rest, 8 apart, 8 above and below, so the fill touches neither the strip nor the tab bar rule. Gap session (UX.md 3.6): "Item 2 of 6" in `captionStrong` and a "Leave session" text button replace the quick actions; on its cards "Leave session" replaces "Later".                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pressed: bg.overlay. Fired quick action: its label in a reverse-video block for 1200 ms; the strip names the real next item (UX.md 3.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Retrieval card             | full-screen pager item; body scrolls (591 pt at 390x844, 580 at 360x800); content on the feed axis, 24 under the status inset | Question in `title`, up to 5 lines; 12 between question, options and verdict. Three or four option rows (UX.md 3.3): min height 56, radius 8, bg.raised, 1 pt `line.control` outline, 8 apart, padding 12 x 16; key letter in `dataM` text.secondary in a 24 pt column; text in `option`, wraps. No timer. Pager locked for the whole card, answered or not (UX.md 3.3). Action row: "Later" + "Check answer" (disabled until a row is selected), then "Continue".                                                                                                                                                                                                                                                                                                                                                                                                                                              | Selected: 2 pt text.primary outline, key letter in a reverse-video block. Correct: chosen row bg `proven.surface`, 2 pt `proven` outline, checkmark + "Correct" in proven. Wrong: chosen row bg `error.surface`, 2 pt `error` outline, xmark + "Your answer" in error; the right row gets a neutral 2 pt text.primary outline and checkmark + "Correct answer" (nothing was proven). Other rows: text.secondary, hairline outline. Rows never move. Below: verdict in `display` with icon 22, explanation in `bodyS`, then the progress panel, brought into view with `scrollTo`.                                                                                                                    |
| Progress panel (in feed)   | width W - 2 x axis, min height 124 (142 with a two-line consequence), radius 8, padding 12, rows 8 apart                      | Only after an answer, never after watching; stays until the learner leaves the card; one button (opens the map). bg.raised, 1 pt `line.control` outline (4.38:1: it is a live control). Concept title in `heading`; the topic as eight 18 pt tiles + "1/8"; change line: old tile, old word, `arrow.right`, new tile, new word in `captionStrong` and its state colour; consequence in `caption`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Outcomes and their lines: UX.md 5.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tab bar                    | 48 + bottom inset                                                                                                             | Custom solid JS bar, bg.base, 1 pt hairline on top. Feed, Map, You: icon 22 over `micro` label. Feed and You are tabs; Map pushes the full-screen map route. The Light / Focus rows, the demo clock, Sound and haptics switches and the three sample profiles live in You (UX.md 3.8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Active: text.primary + a 24 x 2 `line.current` mark on the top rule. Inactive: text.secondary. Map changed since last visit: 8 pt text.primary square by the icon, label "Map, {n} changes".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Buttons                    | min height 48, radius 8, padding 12 x 16                                                                                      | Primary: fill text.primary, label `button` in text.inverse, up to two centred lines (68 pt; its container grows); one per screen. Secondary: 1 pt `line.control` outline, text.primary label. Text button: text.primary 600, 1 pt underline, 48 pt target. A label names the action and, for a locked target, the starting point (judges' graft, UX.md 5.5). At 390 (inner width 326) five dock labels need the second line; the longest is 377 pt.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Pressed: primary `text.settled`; secondary and text bg.overlay. Disabled: fill bg.overlay, 1 pt `line.control` outline, label text.secondary (6.42:1; "Check answer" is read before a row is selected). Focus: 2 pt text.primary ring, 2 pt offset.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Panel (in-screen sheet)    | full width, fixed heights: reason 240, Key 320 (content scrolls), concept and dock detail 340                                 | bg.overlay, radius 0, 1 pt hairline on top; header row 48 with a `heading` title and a labelled "Close" button; no scrim, a tap outside closes it. Absolutely positioned, moved by translateY (`spring.default`); height never animates. Contents: UX.md 3.2 and 3.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Android back closes it. Covered rows are hidden from accessibility; focus moves to the panel header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Toast                      | min height 48, width W - 32, 8 above the bottom stack                                                                         | bg.overlay, 1 pt `line.control` outline, radius 8; `bodyS` text.primary, optional text button. Outside the feed only (the feed confirms in the strip).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 4 s, 10 s with a screen reader; announced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Matrix row and tile        | row 44 (compact 42); tiles 22 (18 below 390 wide)                                                                             | Five topic rows, each one tab-role target; tiles hidden from accessibility; a tap on a tile also selects its concept (hit slot = tile pitch x row height). Label 88 (`label`, short names from UX.md 5.6), eight tiles in rail order with 6 pt gaps, count 32 (`dataS` "1/8"; clock 13 + due count in `due` when any).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Selected: bg.raised full-bleed, label text.primary, the 8 pt text.primary caret in the gutter; the stage below starts with a 2 pt `line.current` rule and repeats topic and count. Unselected: label text.secondary, no dimming. Changed since last visit: 8 pt text.primary square after the label. Pins as in Mastery encoding.                                                                                                                                                                                                                                                                                                                                                                    |
| Rail row and connectors    | min height 48, 64 with a needs line; rows grow with their text; full-width target                                             | In the stage (bg.raised, a ScrollView: rows are never measured). Guide columns 20 pt per level, per-row Views that stretch with the row (no onLayout, no SVG); tile 22; gap 10; title in `rowTitle`, wraps with no line cap (text.secondary when locked); status column in `tag`, right-aligned, 8 from the title. Needs line in `caption`, 2 pt under the title: "+ needs {concept} ({topic})", "AI" for AI engineering, no step count (the dock has it); it runs from the title's left edge to the gutter, under the status column, and wraps rather than truncates. Row height = max(48 or 64, 8 + 20 x title lines + 20 for a needs line), text terms x fontScale. Connectors: unmet = 1 pt `line.control` dashed 6 on / 4 off, as short Views; met (parent learned) = 2 pt `proven` solid. A concept whose only prerequisite is in another topic sits at level 0 with a 12 pt dashed stub from the gutter. | Selected: bg.overlay, ring on the tile. No countdown in rows; one timeout at the next `dueAt` flips CHECKED to DUE. Stage header 48: topic in `heading`, "1/8", previous and next topic chevrons (48 pt each). Measured: the four needs lines are 214, 202, 190 and 203 pt against 256, 276, 236 and 296 pt at 360 (one line up to fontScale 1.19; the old line with a step count was 302 to 369 pt). At default text three titles take two lines at 390; at 360 "Fallbacks and graceful degradation" (level 4, 144 pt) takes three. Test: a per-platform width table for the 40 titles and 4 needs lines asserts line counts, no clipping and `need` at 360 and 390 for fontScale 1.0, 1.3 and 1.6. |
| Dock                       | 136 + 18 per text line (154, 172, 190) + bottom inset; grows, never fixed                                                     | bg.overlay, radius 0, 1 pt hairline on top, padding 12. Row 1 (min 48): tile 28 with its pin; title in `heading`, up to two lines, over a one-line reason in `caption`, together one button ending in `chevron.right` 13 (opens the dock detail); right: stepper `chevron.left`, "Next up" in `micro` over "1/3" in `dataS`, `chevron.right` (48 pt targets), replaced by a "Next up" text button when the shown concept is not a suggestion. Then 8, the text block (1 to 3 `caption` lines), 8, one button, 12. Without a button the last 56 fall away and the countdown, where shown, adds a 32 pt line (80 + 18 per line + 32). A two-line title or button label adds 14 or 20. The rail's bottom inset follows the live height. Suggestion ranking: UX.md 3.5; pins match it. Off-screen during the replay.                                                                                                | Lines, buttons and heights per state, Retained and started-but-locked included: UX.md 5.5. Checked, not due: no button; the countdown in `dataL`, neutral, is the screen's one ticking element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Map header, legend and Key | header and legend row 44 (48 on Android)                                                                                      | Header, one line: back chevron, "Knowledge map" in `heading`, right "1/40 learned" (numeral `dataS`, `proven` once above 0) and, from 375 pt width, "12 watched" before it in text.secondary (an estimated 328 pt with both; Barlow unmeasured); in compact mode a 48 pt "Key" button takes the watched count's place. Legend row is one button: legend line in `caption` (273 pt) + "Key" + chevron; in compact mode a 20 pt text line. Key panel: each state as tile 22 + word + live count + meaning, then dog-ear, NEW, pin, selected.                                                                                                                                                                                                                                                                                                                                                                      | Seeded profile: a 24 pt band under the header (taken from the stage) with "Sample data" in a reverse-video block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Onboarding topic row       | min height 56, full width, 8 apart                                                                                            | Five rows, radius 8, bg.raised, 1 pt `line.control` outline: topic in `heading` + "8 concepts" in `caption` text.secondary. Below, side by side and equal: "Skip" (secondary, the zero-pick path) and "Start" (primary, disabled until a topic is picked). Headline, contract line and hint: UX.md 3.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Selected: bg.overlay, 2 pt text.primary outline, checkmark 20 + checked state for screen readers. No colour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Empty, offline, end states | on bg.base, left-aligned on the gutter                                                                                        | Title in `title` (`display` on the session summary), one line in `bodyS`, one button. Failures carry the warning icon beside the words. Strings: UX.md 3.7 and 3.9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The summary title counts honestly, for example "2 checked, 1 learned this session.", never "3 proven": a first correct answer is Checked, not Learned. A fresh map has no empty state: the greyscale map is the state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Reel safe-zone contract

Canvas 720 x 1280, 30 fps, flat `#181612`, tokens and font files shared with the app. One left axis at x 40. No cyan and no amber in any reel: neutrals, the two syntax tints inside code, coral for mistakes.

| Region         | y, px        | x, px                          | Content                                                         |
| -------------- | ------------ | ------------------------------ | --------------------------------------------------------------- |
| Top band       | 0 to 120     | 0 to 720                       | Flat ground only. The native top row may cover it.              |
| Visual box     | 136 to 716   | 40 to 680 (code band 0 to 720) | Code band, flow diagram or equation, vertically centred         |
| On-screen text | 748 to 848   | 40 to 680                      | Barlow SC 700, left-aligned, at most 2 lines                    |
| Rule           | 916          | 40 to 680                      | 2 px `line.hairline`, separates shown from spoken               |
| Caption rail   | 992 to 1096  | 40 to 680                      | Bottom-anchored at 1096, grows upward, at most 2 lines          |
| Bottom band    | 1120 to 1280 | 0 to 720                       | Flat ground only. The native strip and action row may cover it. |
| Hook part      | 120 to 1120  | 40 to 680                      | Left-aligned, vertically centred; each word appears when spoken |
| Frames 0 to 8  | all          | all                            | Empty ground (300 ms) for the placeholder handoff               |

| Baked text                                | Size / line height, px on 720        | pt at 393 / 360 wide        | Face                                                                                                         |
| ----------------------------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Floor, non-code                           | 26                                   | 14.2 / 13.0                 | 600 or heavier below 32 px                                                                                   |
| Code                                      | 28, 26, 25, 24; line height 1.5      | 15.3 to 13.1 / 14.0 to 12.0 | Mono NL 600, keywords 800                                                                                    |
| Captions                                  | 42 / 52                              | 22.9 / 21.0                 | Barlow SC 600                                                                                                |
| On-screen text                            | 44 / 50, 40 / 46, 36 / 42            | 24.0 / 22.0 at 44           | Barlow SC 700                                                                                                |
| Hook                                      | 72 / 80, 64 / 70, 56 / 62, 48 / 54   | 39.3 / 36.0 at 72           | Barlow SC 700; largest step that fits 5 lines by measured width (6 lines at 48); beyond that the build fails |
| Flow box label; edge label; Mistake label | 30 / 34 or 26 / 30; 26 / 30; 26 / 30 | 14.2 / 13.0 at 26           | Barlow SC 600; Mono NL 600; Mono NL 800                                                                      |
| Equation                                  | 56, floor 32                         | 30.6 / 28.0                 | KaTeX                                                                                                        |

- **Captions.** Left-aligned at x 40, width 640. A group is at most 7 words and about 48 characters, set by measured width. Two levels: words up to and including the active one in `text.primary` (15.85:1), upcoming words in `text.secondary` (8.35:1; 1.90:1 between the two), plus a 4 px `text.primary` playhead bar 8 px under the active word's baseline. No hue.
- **Code block.** Edge-to-edge band, `bg.raised`, 2 px hairline rules top and bottom, radius 0, no shadow, no window dots. Syntax: identifiers text.primary, keywords text.primary 800, strings and numbers `syntax.literal`, function, type and tag names `syntax.name`, comments and punctuation text.secondary. Highlighted lines get a `bg.overlay` row; the other lines drop to text.secondary (7.45:1) instead of 55% opacity. Mistake snippets: band rules in `error` and a top-right "Mistake" label with a drawn xmark. Size = the first step whose measured longest line fits the band minus both insets and a 4 px guard (636 px at inset 40, 668 at inset 24) and whose height fits the 580 px box. The measured width decides; the column counts assume a 0.6 em advance and are informative:

| Step: size, inset                                                | Max columns | Snippets, of 177 (counted in `library/reels`) |
| ---------------------------------------------------------------- | ----------- | --------------------------------------------- |
| 28 px, inset 40 (on the left axis)                               | 37          | 68                                            |
| 26 px, inset 24                                                  | 42          | 65                                            |
| 25 px, inset 24                                                  | 44          | 31 (21 at 43 columns, 10 at 44)               |
| 24 px, inset 24                                                  | 46          | 6                                             |
| none: reformat by hand to 46 or fewer, otherwise the build fails | 47 to 48    | 7, in 4 reels                                 |

- **Code floor.** Research 04's must is code at 26 to 28 px with long lines reformatted, not shrunk; its fact-check did not relax it. By the table 37 snippets render under 26 px (12.0 pt at 360 wide). Owner decision: `minCode` 26 with those 37 reformatted to 42 columns or fewer (recommended), or 24 as tabled. The steps are the same either way.
- **Flow diagram.** Boxes `bg.raised`, 2 px `text.secondary` outline, radius 16 px, at least 84 px tall (two 34 px lines + 16), width = slot - 16 (max 280), label up to 2 lines. Arrows 3 px `text.primary` with solid SVG heads. Edge labels on a `bg.base` knockout plate so no line crosses text.
- **Glyphs.** Hooks and on-screen text contain (counted) `→` 53 times, `·` 23, em dash 13, `≠` 11, `²` 6, `×` 4, `≈` 2 and `⇄`, `✓`, `✗`, `¾` once each; narration captions add 10 em dashes, flow labels one `…`. Em dashes are banned in visible strings (taste digest): all 23 become a comma, colon or full stop at render time; the audio is unchanged. Barlow Semi Condensed appears to lack arrows and ticks (not inspected). Fallback stacks keep the weight of the line: `BarlowSC-Bold, MonoNL-ExtraBold` and `BarlowSC-SemiBold, MonoNL-SemiBold`. A glyph audit over every non-ASCII character fails the build on any character no font in its stack covers; those are reworded or drawn as SVG.
- **No longer baked.** Topic chip, progress bar, window dots, gradient ground, amber word highlight, amber arrows, centred text, moving entrances. Concept and topic, progress, the reason, sound and the transcript are native.
- **Build checks.** A dry layout pass over all 72 flows and every hook, on-screen and caption string fails the build on overflow and sends offenders to manual review instead of shrinking type.
- **Encode contract** (settings and gate: PERFORMANCE.md 6.1 and 6.2): `yuv420p`, limited range, BT.709 matrix, primaries and transfer tagged, PNG frames; mono AAC-LC at 48 kHz, integrated loudness -19 +/- 1 LUFS on the mono file, true peak at most -1 dBTP; a decoded top-band pixel equals `bg.base` within 1 per channel. Content-hashed URLs, because the device cache never revalidates.
- **At 1080 x 1920.** The same composition with Remotion `scale: 1.5`: every px value above multiplies by 1.5, on-screen pt sizes are unchanged. Which one ships is PERFORMANCE.md 6.1's call: 1080 only if the 5-reel test plays cleanly on every test phone with three players alive, otherwise 720.

## Token module outline

One typed module with no React Native imports (suggested `packages/tokens`), imported by the app and by the Remotion renderer. Components never contain raw hex or raw type numbers.

```ts
type Hex = `#${string}`;
type FontFamily =
  'BarlowSC-SemiBold' | 'BarlowSC-Bold' | 'MonoNL-Medium' | 'MonoNL-SemiBold' | 'MonoNL-ExtraBold'; // one per file, app and Remotion
type Spring = { mass: 1; stiffness: number; damping: number };
type TypeStyle = {
  family: FontFamily | 'System';
  size: number;
  lineHeight: number;
  weight?: '400' | '500' | '600'; // weight with System only
  letterSpacing?: number /* pt */;
  uppercase?: true;
  maxScale?: number;
};
type TypeName =
  | 'display'
  | 'title'
  | 'heading'
  | 'label'
  | 'body'
  | 'option'
  | 'button'
  | 'bodyS'
  | 'sentence'
  | 'rowTitle'
  | 'sentenceStrong'
  | 'caption'
  | 'captionStrong'
  | 'micro'
  | 'dataL'
  | 'dataM'
  | 'dataS'
  | 'pinNumeral'
  | 'tag'
  | 'code'
  | 'codeKeyword';
type Level = 'none' | 'seen' | 'checked' | 'learned' | 'retained';
type TileFlags = {
  locked: boolean;
  due: boolean;
  justUnlocked: boolean;
  selected: boolean;
  pin?: number;
};
type TileSize = 18 | 22 | 28;

export interface Tokens {
  color: {
    bg: { base: Hex; raised: Hex; overlay: Hex };
    line: { hairline: Hex; control: Hex };
    text: { primary: Hex; settled: Hex; secondary: Hex; inverse: Hex };
    proven: { dim: Hex; base: Hex; bright: Hex; surface: Hex };
    due: Hex;
    error: { base: Hex; surface: Hex };
    syntax: { literal: Hex; name: Hex };
    scrim: Hex;
    groundVideo: { ios: Hex; android: Hex };
    highContrast: { lineHairline: Hex; lineControl: Hex; textSecondary: Hex };
  };
  fontStack: { display600: readonly FontFamily[]; display700: readonly FontFamily[] }; // reels: Barlow, then the mono of the same weight
  type: Record<TypeName, TypeStyle>;
  space: Record<2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 48, number>;
  radius: { none: 0; tile: 4; control: 8 };
  stroke: { rule: 1; track: 2; current: 2; outline: 1; state: 1.5; result: 2 };
  size: {
    target: 48;
    topRow: { ios: 44; android: 48 };
    sound: 72;
    actions: 48;
    cardActions: 64;
    tabBar: 48;
    answerRow: 56;
    railRow: 48;
    railRowNeeds: 64;
    matrixRow: { full: 44; compact: 42 };
  };
  motion: {
    spring: Record<'fast' | 'default', Spring>;
    color: Record<'fast' | 'default' | 'slow', number>; // ms, CSS transitions
    easing: readonly [number, number, number, number];
    timing: {
      fill: number;
      count: number;
      stagger: number;
      staggerMax: number;
      hold: number;
      fadeRm: number;
      toast: number;
    };
  };
  haptic: Record<
    'select' | 'correct' | 'wrong' | 'quickAction' | 'learned',
    { ios: string; android: string | null }
  >;
  icon: Record<IconName, { ios: string; android: string }>;
  mastery: {
    tile: Record<
      TileSize,
      {
        radius: number;
        outline: number;
        outlineNew: number;
        dash: [number, number];
        dot: number;
        halfFill: number;
        tick: [box: number, stroke: number];
        tickDue: [box: number, shift: number];
        dogEar: [leg: number, gap: number];
        dogEarLegPinned: number;
      }
    >;
    level: Record<
      Level,
      {
        interior: 'none' | 'dot' | 'half' | 'full' | 'fullTick';
        color: Hex;
        word: string;
        outlined: boolean;
      }
    >;
    // outline when outlined && !locked; dash and LOCKED when locked && level === 'none'; flags add DUE, NEW, ring and pin
    pin: { disc: 12; ring: 1; inset: 2 };
  };
  feed: {
    seamRule: boolean;
    foldBelow: 0.93;
    strip(fontScale: number, folded: boolean): number;
    axis(pictureWidth: number, pillar: number): number;
    fit(
      window: Size,
      insets: Insets,
      fontScale: number,
      platform: Platform,
      tabBar: 0 | 48,
    ): FeedLayout;
  };
  map: {
    statusColumn(fontScale: number): number;
    dockHeight(row1: number, textLines: number, button: number): number;
    fit(
      window: Size,
      insets: Insets,
      fontScale: number,
      platform: Platform,
      need: number,
    ): MapLayout;
  };
  reel: {
    canvas: { width: 720; height: 1280; fps: 30 };
    band: { top: 120; bottom: 160 };
    inset: 40;
    minText: 26;
    minCode: 24 | 26;
    codeGuard: 4;
    codeSteps: readonly { size: number; inset: number; maxColumns: number }[];
    caption: { size: 42; lineHeight: 52; maxLines: 2 };
  };
}
```

## Open decisions and unverified items

- **Owner decisions** (default in brackets): pool glyph and word instead of PLAN.md M6 "pool colour on each reel" [accept, with PLAN's four pool words for the demo]; warm graphite `#181612` instead of the old navy family [accept, confirm in the 5-reel test]; dog-ear vs round clock disc for due [dog-ear, after the A/B]; map as a pushed route without the tab bar [accept]; select then "Check answer" instead of single-tap commit [accept, about 1 s more per card]; 375x667 supported in the folded layout and 360x640 out of scope [accept]; sound on by default with a labelled Sound control [decided 2026-10-04: sound on]; Light / Focus switch moves to You [accept]; Semi Condensed vs regular-width Barlow [Semi Condensed, compare in the test render]; low-chroma syntax tints vs monochrome code [tints]; 1080 x 1920 [decided 2026-10-04: 1080 x 1920]; code floor 26 px with 37 snippets reformatted, or 24 px [26]; autoplay under Reduce Motion now that baked entrances only fade [autoplay, never with a screen reader: Android "Remove animations" is common on tester phones and would otherwise skew swipe metrics]; pager locked for the whole card instead of unlocking after the answer [whole card, UX.md 3.3]; a static "Loading" label instead of a spinner [accept]; a due review started from the map is one card, where PLAN gives each target three items [one card]; a gap session may serve a still-locked target, learner must-fix L10 [yes, PLAN to confirm]; three options at box 0 and four on reviews, as UX.md 3.3 now has it, against four everywhere as authored [three, per the 03 fact-check].
- **Other docs.** Reconciled on 2026-10-04: PRODUCT.md, UX.md and PERFORMANCE.md use the values above.
- **Not verified:** nothing is rendered; every text width is SF Pro on macOS (Roboto and Barlow unmeasured, including the map header, the running head and "engineering" in a tab); Mono NL's 0.6 em advance; Barlow glyph coverage; font sizes (GitHub listings); decoder colour match on device (the fixed-point ground is arithmetic only); CVD figures are simulations, not a device or user check; dog-ear, dot vs half vs solid, locked + seen and the Retained tint at 18 pt in daylight; SF and Material symbol names; `cubicBezier` export, Android haptic enum names and the two contrast-setting APIs on SDK 57; whether `ReduceMotion.System` is read once at start.
- **Known costs:** none of the 119 reels is approved yet, so the one approve/reject pass runs after the re-render; 7 snippets need hand reformatting (44 with the 26 px floor); the app is still the blank template, so router, Reanimated, expo-video, expo-symbols, expo-haptics and font loading come before any of this.
