# Sepp's Workshop Design System — Workbench Overlays Design Spec

**Date:** 2026-10-01
**Status:** Draft, awaiting review
**Target version:** 0.2.0

## Goal

Close the gaps that would force the VS Code port to carry its own alpha constants or hex literals, so the port can follow the two hard rules in `handoff/SKILL.md` without exception: no hex value in a port, no port-side alpha.

Vivid Life solved half of this in its design-system 0.11.0 (issue #19): selection, find, word-highlight and diff colours became overlay recipes in the foundation. Its VS Code port still keeps a ten-step alpha table and six hex literals for about forty other keys. This spec covers that remainder for Sepp's Workshop. A matching issue for Vivid Life is drafted separately.

## Scope

In:

- Nine new overlay recipes and one new accent token in `tokens.json5`.
- A generated `hexa` field on every overlay.
- Extensions to gates 2, 3, 4, 5 and 9.
- README, previews, `handoff/SKILL.md`, CHANGELOG, version bump to 0.2.0.

Out:

- The VS Code port itself. It gets its own spec in `sepps-workshop-vs-code`.
- Diff gutter recipes and a terminal selection foreground, which Vivid Life has. Neither is needed here; see "Considered and dropped".
- Overview-ruler marks for find, selection and word highlights, transparent borders, the unnecessary-code opacity, and a chart purple. The port leaves these at VS Code defaults; see "Keys the port leaves at defaults".

## What the port needs and cannot get today

The Vivid Life template sets these with port-side constants. The right column is where the Sepp's Workshop port takes them from after this change.

| VS Code keys                                                                                                                                                                      | Vivid Life port                   | Sepp's Workshop source                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| `list.hoverBackground`, `menubar.selectionBackground`, `statusBarItem.hoverBackground`, `inputOption.hoverBackground`, `editor.rangeHighlightBackground`, notebook and chat hover | `state.hover` (`#ffffff14`)       | **new** `overlay.hover`                                                             |
| `list.dropBackground`, `sideBar.dropBackground`, `statusBarItem.activeBackground`, `merge.commonHeaderBackground`                                                                 | `state.active`, literal           | **new** `overlay.active`                                                            |
| `widget.shadow`, `scrollbar.shadow`                                                                                                                                               | `surface.bg_scrim`                | **new** `overlay.scrim`                                                             |
| `scrollbarSlider.*`, `minimapSlider.*`                                                                                                                                            | `fg_subtle` at 20 to 70 %         | **new** `overlay.slider`, `slider_hover`, `slider_active`                           |
| `merge.currentContentBackground`, `merge.currentHeaderBackground`                                                                                                                 | `semantic.info` at 15 and 30 %    | **new** `overlay.merge_current_content`, `merge_current_header`                     |
| `editor.stackFrameHighlightBackground`, `editor.focusedStackFrameHighlightBackground`                                                                                             | `semantic.warning` at 15 and 25 % | **new** `overlay.stack_frame`                                                       |
| `button.hoverBackground`, `extensionButton.prominentHoverBackground`                                                                                                              | accent at 90 %                    | **new** `accent_hover`                                                              |
| `editor.selectionHighlightBackground`, `editor.hoverHighlightBackground`, `editor.symbolHighlightBackground`, `notebook.symbolHighlightBackground`                                | accent at 15 to 20 %              | existing `overlay.word_highlight`                                                   |
| `editorBracketMatch.background` and `.border`                                                                                                                                     | accent at 20 %, accent            | existing `overlay.word_highlight_strong` and its border                             |
| `editor.findRangeHighlightBackground`                                                                                                                                             | accent at 10 %                    | existing `overlay.selection_inactive`                                               |
| `peekView*.matchHighlightBackground`                                                                                                                                              | accent at 30 %                    | existing `overlay.find_match` and its border                                        |
| `inputOption.activeBackground`, `chat.slashCommandBackground`                                                                                                                     | accent at 25 %, cyan at 20 %      | existing `overlay.selected_item`                                                    |
| `inputValidation.*Background`                                                                                                                                                     | semantic at 20 %                  | existing `surface.bg_overlay`, with the semantic colour as border                   |
| `merge.incomingContentBackground`, `merge.incomingHeaderBackground`                                                                                                               | success at 15 and 30 %            | existing `overlay.diff_inserted_line`, `diff_inserted_text`                         |
| `merge.commonContentBackground`                                                                                                                                                   | `fg_subtle` at 15 %               | **new** `overlay.hover`                                                             |
| `diffEditorGutter.*LineBackground`                                                                                                                                                | gutter recipes                    | existing `overlay.diff_*_line`                                                      |
| `minimap.findMatchHighlight`, `diffEditorOverview.*`, `activityBar.activeBorder`, `terminalCommandDecoration.defaultBackground`                                                   | alpha tints                       | opaque roles: `overlay.find_match.border`, `semantic.*`, `accent`, `text.fg_subtle` |

## New tokens

All values are brand colours or ladder steps. None adds a hue, and none needs a new entry under `derived`. The composited values and ratios below were computed with `tools/color.mjs` against the current `tokens.json`.

| Token                           | Colour        | Alpha | Over `bg` | Over `bg_sunk` | Class    |
| ------------------------------- | ------------- | ----- | --------- | -------------- | -------- |
| `overlay.hover`                 | `darkblack`   | 30 %  | `#112b5a` | `#13284d`      | surface  |
| `overlay.active`                | `darkblack`   | 50 %  | `#142748` | `#16253f`      | surface  |
| `overlay.scrim`                 | `darkblack`   | 60 %  | `#15253f` |                | non-text |
| `overlay.slider`                | `darkblue.40` | 30 %  | `#39568d` | `#3b5380`      | non-text |
| `overlay.slider_hover`          | `darkblue.40` | 50 %  | `#566f9e` | `#576d95`      | non-text |
| `overlay.slider_active`         | `darkblue.40` | 70 %  | `#7388ae` | `#7387a9`      | non-text |
| `overlay.merge_current_content` | `windblue`    | 10 %  | `#0c3b7e` |                | code     |
| `overlay.merge_current_header`  | `windblue`    | 25 %  | `#0a4a8c` |                | label    |
| `overlay.stack_frame`           | `lightorange` | 10 %  | `#243c6e` |                | code     |
| `accent_hover`                  | `sunset.80`   |       | `#fcc833` |                | fill     |

Reasoning:

- **`hover` and `active` darken**, like every neutral overlay in this foundation. A lighter hover would cost contrast on rows that carry git-decoration colours. `hover` has the same recipe as `line_highlight`: both mean "the row you are on". They stay separate tokens because they answer different questions and may diverge.
- **`hover` and `active` are a new class, "surface overlays".** The existing overlays appear only over the editor canvas. These two appear over the sidebar, the status bar and menus as well, so their gates run over `bg`, `bg_sunk` and `bg_overlay`. `hex` is still the composite over `bg`, as for every overlay.
- **Sliders lighten.** A scrollbar thumb has to be found, not read through. They use the Darkblue ladder step that already serves comments, so they stay in the neutral ramp.
- **Merge "current" is Windblue**, the brand's preferred blue, and the hue of `semantic.info`, which already marks "modified". The content fill is faint (10 %) because it sits behind code; the header carries the signal.
- **One stack-frame recipe, not two.** VS Code has two keys, for the top frame and the focused frame. A second faint hue does not separate from the first on this canvas: Lightorange at 10 % and Freegreen at 12 % are 1.9 apart in OKLab, under the just-noticeable 2. The port sets both keys to `stack_frame` and distinguishes the frames by VS Code's gutter arrow, coloured `semantic.warning` and `semantic.success`. That is a shape plus a position, which the "never colour alone" rule asks for anyway.
- **`accent_hover` is one ladder step lighter than the accent.** The ladder only goes lighter, and `accent_on` gains contrast on it (7.87:1 against 7.10:1).

### Generated field: `hexa`

The build adds `hexa` beside `hex` on every overlay: the recipe's own colour with its alpha as an eight-digit value, for example `overlay.selection.hexa = "#1b1d1c99"`.

VS Code requires about thirty-five keys to be translucent ("must not be opaque so as not to hide underlying decorations"): word highlights, find-match highlights, the inactive selection, diff backgrounds, merge regions, drop targets. A port that can blend must emit the recipe, not the composite. Vivid Life's port builds that string itself. Here the foundation emits it, so the conversion exists once and a port test can assert that every colour in a generated theme is a value present in `tokens.json`.

`hex` is for ports that cannot blend, `hexa` for ports that can. Over `surface.bg` both look the same.

## Gate changes

No threshold is lowered. All additions pass with the values above.

**Gate 2, text on overlays.**

- `merge_current_content` and `stack_frame` join the code overlays: every code text colour at 4.5:1. Worst case is `semantic.danger` at 4.69:1 and 4.68:1.
- `merge_current_header` joins the label overlays: `fg` and `fg_muted` at 4.5:1. Worst case is `fg_muted` at 4.88:1.
- `hover` and `active` are checked as code overlays on each of `bg`, `bg_sunk` and `bg_overlay`. Worst case is `semantic.danger` at 6.01:1.

**Gate 3, ANSI.** All sixteen colours except `black` reach 4.5:1 on `overlay.selection` and `overlay.selection_inactive`, because the terminal draws selected text in its ANSI colour. Worst case is `blue` at 5.71:1 and 5.34:1.

**Gate 4, non-text.** `slider_active` reaches 3:1 on `bg` and `bg_sunk` (3.43:1 and 3.66:1). The resting and hover sliders are exempt from 3:1, as scrollbar thumbs conventionally are; gate 9 covers their visibility.

**Gate 5, fills.** `accent_on` reaches 4.5:1 on `accent_hover` (7.87:1).

**Gate 9, visibility.** OKLab distance, ×100:

| Pair                               | Minimum | Actual     |
| ---------------------------------- | ------- | ---------- |
| `hover` from `bg`, from `bg_sunk`  | 3       | 4.8, 3.9   |
| `active` from `bg`, from `bg_sunk` | 5       | 8.1, 6.5   |
| `slider` from `bg`, from `bg_sunk` | 7       | 12.6, 13.6 |
| `merge_current_header` from `bg`   | 7       | 7.9        |
| `accent_hover` from `accent`       | 3       | 3.3        |

The thresholds below 7 are deliberate. A hover is a transient hint under the pointer, and 7 on a row background would make the sidebar flicker; 3 is one and a half times the just-noticeable difference. `accent_hover` is seen only in direct succession to `accent` on the same button.

**Shape.** `overlay.scrim` and the three sliders form a third class, "non-text", exported as `NON_TEXT_OVERLAYS` beside `CODE_OVERLAYS` and `LABEL_OVERLAYS`. Every overlay must be in exactly one class, or the build fails. This closes a hole in the current build, where a new overlay that nobody adds to a list is gated by nothing.

## Considered and dropped

- **Diff gutter recipes** (`diff_inserted_gutter`, `diff_removed_gutter`), as in Vivid Life. A gutter stronger than the line fill takes line numbers under AA: Freegreen at 18 % leaves `fg_subtle` at 4.33:1. The port uses the line recipes for the gutter.
- **A terminal selection foreground**, as in Vivid Life. Vivid Life needs it because its selections lighten on some flavours. Here the selection darkens and every ANSI colour gains contrast on it, which the extended gate 3 now proves.
- **A second stack-frame hue.** See above.
- **`state.hover` as a translucent white**, as in Vivid Life. It lightens, which this foundation rules out for anything behind coloured text.

## Keys the port leaves at defaults

These have no role here and get none. The port's README lists them.

- `editorOverviewRuler.findMatchForeground`, `.rangeHighlightForeground`, `.selectionHighlightForeground`, `.wordHighlightForeground`. VS Code requires them translucent, and its defaults are a neutral grey and an orange that sit well on Darkblue.
- Fully transparent borders (`tab.activeBorder`, `menu.selectionBorder`, `menubar.selectionBorder`). The defaults are already unset. `editor.lineHighlightBorder` takes `overlay.line_highlight`, the same colour as the fill.
- `editorUnnecessaryCode.opacity`.
- `charts.purple`. The brand has no purple. The other chart colours map to `semantic.*` and `accent`.
- `statusBarItem.prominentHoverBackground`.

## Files changed

| File                                                  | Change                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tokens.json5`                                        | The ten tokens, `meta.version` 0.2.0                                                                                                             |
| `tools/build-tokens.mjs`                              | `hexa`; overlay classes and the exactly-one-class check; gate extensions; `resolveTarget` accepts `accent_hover`                                 |
| `tools/gates.test.mjs`, `tools/build-tokens.test.mjs` | A failing case for each new or extended gate; `hexa` for a known recipe                                                                          |
| `tools/build-css.mjs`                                 | `--sw-accent-hover`; overlays are picked up by the existing loop                                                                                 |
| `tools/build-readme.mjs`                              | "Carries" column gains "surface" and "non-text"; `accent_hover` row                                                                              |
| `tools/build-previews.mjs`                            | Editor-states block shows the new code overlays; a row for hover, active and the sliders on `bg` and `bg_sunk`                                   |
| `README.md`                                           | Overlays prose: surface overlays, `hexa`, sliders; gate list; rule 5 under "For ports"                                                           |
| `handoff/SKILL.md`                                    | Mapping table: hover, drop targets, sliders, shadow, merge, stack frame, button hover; "`.hexa` where the target blends, `.hex` where it cannot" |
| `CHANGELOG.md`, `package.json`                        | 0.2.0                                                                                                                                            |
| Generated                                             | `tokens.json`, `dist/tokens.js`, `colors.css`, `preview/*.html`                                                                                  |

The existing spec, `2026-10-01-design-system-foundation-design.md`, stays as written. This document is the record for 0.2.0.

## Testing

- `npm test`: unit tests for `hexa`, for the class check, and one failing fixture per extended gate.
- `npm run build`: all gates pass with the values in this spec.
- `npm run check`: generated files are current.
- Manual: open `preview/01-syntax.html` and read the sample line on `merge_current_content` and `stack_frame`; check that hover is visible on the sunk surface in the new preview row.

## After this ships

1. Tag 0.2.0 so the port can pin `github:sepps-workshop/sepps-workshop-design-system#v0.2.0`.
2. Write the port spec in `sepps-workshop-vs-code`.
3. Draft the issue for `vivid-life-design-system`: the same classes of recipe (hover, active, sliders, merge, stack frame, accent hover) and a generated `#rrggbbaa` field, so its port can drop its alpha table.
