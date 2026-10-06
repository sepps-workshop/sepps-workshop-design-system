# Changelog

## Unreleased

- **⚠️ Three colours are renamed, following the sepp.med Farbtafel 2026:** `lightorange` is now `brightorange` (Bright Orange), `signalred` is now `racingred` (Racing Red), `freegreen` is now `limegreen` (Lime Green). This renames `palette.<name>.*`, `--sw-palette-<name>-*`, and `derived.signalred_on_dark` / `derived.signalred_on_dark_bright` to `derived.racingred_on_dark` / `derived.racingred_on_dark_bright`. There are no aliases.
- **⚠️ Six base colours change value:** Windblue `#008ecf`, Middleblue `#076eab`, Darkblack `#1d1d1b`, Bright Orange `#f59c00`, Racing Red `#f0191d`, Lime Green `#64b32e`. Every ladder step, overlay and ANSI colour built on them moves with them. The derived reds `#ff897b` and `#ffb4aa` and `bg_sunk` `#102d62` keep their values.
- **⚠️ The danger fill is no longer Racing Red itself:** white reaches 4.32:1 on the new red. `semantic_fill.danger.fill` is the new `derived.racingred_fill`, Racing Red mixed 90 % with Darkblack (`#db191d`, white text 5.04:1). The build verifies the recipe.
- `syntax.function` and `semantic.info` move from `windblue.60` to `windblue.50`: on the new Windblue, step 60 sits too close to the comment colour.
- `semantic.success` and ANSI green move from step 50 to `limegreen.60`, ANSI bright green from step 30 to `limegreen.40`: the lighter step of the new green sits too close to bright yellow.
- `diff_removed_text` drops from 35 % to 30 %: the brighter red took code text on the stacked span below 4.5:1.
- The Farbtafel shows no tints for Lime Green. The build still calculates its ladder, because green text on Darkblue needs the lighter steps.

## 0.2.1 — 2026-10-01

- **⚠️ `diff_inserted_text` changes colour:** from Freegreen at 25 % to Darkblack at 40 %. An editor draws the changed span on top of the inserted line, behind code; the green stack left numbers at 3.37:1. The span now darkens the line (worst code text 5.72:1).
- Both `diff_*_text` recipes are now code overlays and are gated stacked on their line recipes, for contrast and for visibility.
- New `merge_incoming_header` (Freegreen at 25 %, `fg` and `fg_muted` only), the value `diff_inserted_text` used to have, for the merge editor's incoming header.

## 0.2.0 — 2026-10-01

- Nine overlay recipes for workbench surfaces: `hover`, `active`, `scrim`, `slider`, `slider_hover`, `slider_active`, `merge_current_content`, `merge_current_header`, `stack_frame`.
- `accent_hover`, one ladder step lighter than the accent.
- Every overlay gains `hexa`, the recipe as `#rrggbbaa`, beside the composited `hex`. `colors.css` gains `--sw-overlay-<name>-hexa` and `--sw-accent-hover`.
- Every overlay must belong to exactly one class (code, label, surface, non-text), or the build fails.
- Gates: `hover` and `active` are checked on every code surface; ANSI colours are checked on the selection; `slider_active` reaches 3:1; `accent_on` is checked on `accent_hover`; new visibility minimums for hover, active, slider, the merge header and `accent_hover`.
- `hover` and `active` must darken `bg`, `bg_sunk` and `bg_overlay`: a faint lightening can pass on contrast alone. An overlay that a gate reads by name but that is not defined is reported as a failure.

## 0.1.0 — 2026-10-01

- Token foundation: brand palette with generated tint ladders, surfaces, text, borders, semantic roles, twelve core and twenty-four extended syntax slots, ANSI palette, overlay recipes, shell roles, prompt roles.
- Build with nine gates: WCAG AA text contrast on surfaces and overlays, ANSI contrast, non-text contrast, fills, distinctness, signal separation, palette integrity, overlay visibility.
- Generated `tokens.json`, `dist/tokens.js`, `colors.css` and four preview pages.
- Port handoff skill.
- README token tables generated from the tokens and checked by `npm run check`.
