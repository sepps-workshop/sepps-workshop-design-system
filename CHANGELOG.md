# Changelog

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
