# Sepp's Workshop Design System — Foundation Design Spec

**Date:** 2026-10-01
**Status:** Approved

## Goal

A small, machine-readable foundation that five theme ports read their values from: VS Code, Windows Terminal, PowerShell, fish, Starship. One theme, not a matrix: a medium-dark theme on sepp.med Darkblue, recognisably in the company colours, WCAG AA enforced by the build.

It is an offshoot of the sepp.med design system (Claude Design project `281ccfd8-85d4-423e-9239-c8fd87fb6de8`), not a copy. It takes the brand colours and the mono font recommendation, drops everything web- and marketing-specific, and adds what theme ports need and the brand system does not have: syntax slots, ANSI palette, shell and prompt roles, overlay recipes, contrast gates.

"Sepp's Workshop" is named after Sepp, the company's robot mascot. The name keeps the themes a step away from the formal sepp.med identity.

## Audience and voice

Colleagues at sepp.med and external developers. The published themes double as light recruiting: a short "Want to join Sepp's Workshop?" section linking to <https://www.seppmed.com/career/>.

All repo content is English. Technical sections are plain and precise. The intro and the recruiting section may be relaxed, with a little nerd humour. From the sepp.med recruiting style guide: no emoji, no empty superlatives, only true statements, a low-threshold call to action. The recruiting section ships as a first version and is polished later.

## Non-goals

- Light variant, accent variants, flavours.
- Web components, marketing motifs, spacing/radius/shadow/motion scales, a sans typeface.
- The five ports themselves.
- npm publishing, CI and release workflows. These follow once the foundation is settled. `package.json` is written so that adding them later changes no paths.
- Bundled fonts. Themes cannot ship fonts; the foundation only recommends one.
- Writing anything back to the sepp.med Claude Design project.

## Brand input

Authoritative values, from the Canva brand kit (the Claude Design project holds approximations for the secondary and signal colours):

| Group     | Name         | Hex       |
| --------- | ------------ | --------- |
| Primary   | Darkblue     | `#0d3174` |
| Primary   | Sunset       | `#fbba00` |
| Primary   | Shadowgrey   | `#b2b2b2` |
| Secondary | Middleblue   | `#0069a9` |
| Secondary | Pumpelorange | `#ec6608` |
| Secondary | Windblue     | `#0093d3` |
| Secondary | Lightorange  | `#f59e33` |
| Secondary | Darkblack    | `#1b1d1c` |
| Signal    | Signalred    | `#cd1719` |
| Signal    | Freegreen    | `#3aaa35` |

Brand rules that shape this design:

1. **Tints are allowed.** Every colour except Signalred has an official ladder in 10 % steps towards white (90 % … 10 %).
2. **Signalred has no tints.** A white-mixed red drifts into pink; the designer excluded it.
3. **Signal colours are signals only.** Signalred and Freegreen mark states (error, success, removed, added). They are not general-purpose colours, so they carry no syntax slot.
4. **Preference:** Sunset and Windblue lead. Lightorange is rarely used. Middleblue is the fallback where Windblue is too light.

## Palette

`palette` holds the ten base colours. The tint ladders are **generated** by the build (`tint = base × p + white × (1 − p)`, sRGB, rounded per channel) for every colour except Signalred, and emitted as `palette.<name>.<100…10>`. A self-test pins a sample of generated values to the Canva ladder (e.g. `pumpelorange.90 = #ee7521`, `windblue.90 = #199ed7`, `freegreen.90 = #4eb349`).

Contrast against the Darkblue canvas, which decides what can be text:

| Colour       | 100 % | First step ≥ 4.5:1 |
| ------------ | ----- | ------------------ |
| Sunset       | 7.10  | 100 %              |
| Shadowgrey   | 5.80  | 100 %              |
| Lightorange  | 5.75  | 100 %              |
| Freegreen    | 4.09  | 90 % (4.60)        |
| Pumpelorange | 3.79  | 80 % (4.75)        |
| Windblue     | 3.58  | 80 % (4.59)        |
| Middleblue   | 2.10  | 60 % (4.57)        |
| Darkblue     | 1.00  | 40 % (5.42)        |
| Signalred    | 2.18  | none — no ladder   |

### Two documented departures from the ladder

Everything resolves to a base colour or a ladder step, with two exceptions. Both are named literals in `tokens.json5` with the reason beside them.

**1. Surfaces below the canvas.** The ladder only goes lighter. Sunk surfaces mix Darkblue towards Darkblack: `mix(darkblue, darkblack, 0.8)` = `#102d62`. Two brand colours, one recipe.

**2. A readable red.** Signalred reaches 2.18:1 on Darkblue, under the 3:1 a squiggle needs and far under the 4.5:1 text needs. Red text cannot be avoided: ANSI red, `git diff` removals, shell error highlighting.

Decision: one derived value, `signalred_on_dark` = `#fe7365`. Same OKLCH hue as Signalred, lightness raised to the first step that clears 4.5:1 (4.60), chroma kept at the sRGB gamut maximum. It reads as a vivid coral red rather than the pink a white tint gives (`#e68b8c` at the equivalent step). It is used only where red must be a foreground on a dark surface. Wherever red can be a **fill** — error badges, the debugging status bar, validation boxes — the foundation uses true Signalred with white text (5.63:1).

Rejected alternative: no red foreground at all. Errors become white text on a Signalred fill where the target supports a background (fish, PSReadLine, VS Code badges), and ANSI red plus squiggles fall back to `pumpelorange.80`. Cost: red and orange stop being distinguishable in terminal output, and warning needs a different colour.

## Surfaces, text, borders

| Token                 | Value                 | Use                                              |
| --------------------- | --------------------- | ------------------------------------------------ |
| `surface.bg`          | `darkblue.100`        | Editor canvas                                    |
| `surface.bg_sunk`     | `#102d62` (see above) | Sidebar, activity bar, status bar, inactive tabs |
| `surface.bg_soft`     | `darkblue.90`         | Hover, lifted panels, inputs                     |
| `surface.bg_overlay`  | `darkblue.90`         | Menus, suggest widget, quick input               |
| `surface.bg_terminal` | `= surface.bg`        | Terminal background, in editors and standalone   |
| `text.fg`             | `darkblue.10`         | Body text, variables (10.21:1)                   |
| `text.fg_muted`       | `darkblue.30`         | Secondary text, punctuation (6.78:1)             |
| `text.fg_subtle`      | `darkblue.40`         | Comments, autosuggestions (5.42:1)               |
| `text.fg_disabled`    | `darkblue.60`         | Disabled; exempt from the text gate (3.22:1)     |
| `border.subtle`       | `darkblue.90`         | Dividers                                         |
| `border.default`      | `darkblue.80`         | Panel edges                                      |
| `border.control`      | resolved by gate      | Control outline, ≥ 3:1 on every control surface  |
| `accent`              | `sunset.100`          | Cursor, focus ring, active tab, primary button   |
| `accent_on`           | `darkblue.100`        | Text on the accent (7.10:1)                      |

`bg_terminal` equals the canvas on purpose: a standalone terminal shows no other surface, and it should be the Darkblue people recognise.

No pure white and no pure black anywhere: `fg` is `#e7eaf1`, ANSI black is `bg_sunk`.

## Semantic roles

| Role      | Foreground on dark         | Fill (with text colour)        |
| --------- | -------------------------- | ------------------------------ |
| `danger`  | `signalred_on_dark`        | `signalred.100` + white        |
| `success` | `freegreen.80` (5.14:1)    | `freegreen.100` + Darkblack    |
| `warning` | `pumpelorange.80` (4.75:1) | `pumpelorange.100` + Darkblack |
| `info`    | `windblue.70` (5.17:1)     | —                              |

Warning is orange, not yellow, because yellow is the accent. For the same reason the VS Code debugging status bar uses the danger fill.

Danger and success differ in lightness as well as hue (gate below), so they survive red-green colour blindness. Ports still pair them with shape or position, never colour alone.

## Syntax

### School

The brand gives three hue families that stay distinct on Darkblue — yellow, orange, cyan-blue — plus a blue-grey neutral ramp. Measured in OKLab, Lightorange sits 4 units from the Pumpelorange tints and Middleblue tints 4 from Windblue tints: not separable, which matches day-to-day experience with the brand. So Lightorange and Middleblue carry no syntax slot.

Three hues is fewer than the 7–9 a traditional theme uses. This theme therefore sits between the traditional and minimalist schools: three hues, **two lightness steps per hue**, and font style as a third axis. Lightness is the dimension the eye separates best, and the build gates on it.

### Core slots (provisional — the gates decide)

| Slot        | Value             | Style  | Note                                  |
| ----------- | ----------------- | ------ | ------------------------------------- |
| `comment`   | `text.fg_subtle`  | italic |                                       |
| `keyword`   | `sunset.100`      |        | The signature colour                  |
| `string`    | `pumpelorange.50` |        | Warm = data                           |
| `number`    | `pumpelorange.80` |        | Deeper than string                    |
| `constant`  | `pumpelorange.80` |        |                                       |
| `function`  | `windblue.70`     |        | Cool = behaviour                      |
| `type`      | `windblue.40`     |        | Lighter than function                 |
| `parameter` | `sunset.40`       | italic | Pale yellow                           |
| `tag`       | `sunset.100`      |        | Not the function colour               |
| `attr`      | `sunset.40`       | italic |                                       |
| `regex`     | `pumpelorange.80` |        | Signal colours are not available here |
| `punct`     | `text.fg_muted`   |        |                                       |

Variables and properties are `fg`. JS/TS `const` declarations fall through to `fg`.

### Extended slots

Same shape as Vivid Life: a logical name resolving to a core slot, a text alias or a semantic alias, with optional style. `variable`, `property`, `operator`, `decorator`, `builtin`, `namespace`, `macro`, `lifetime`, `heading`, `link`, `selector`, `unit`, `hex`, `shebang`, `lang_var`, `emphasis`, `strong`, `invalid`, `invalid_deprecated`, `doc_keyword`, `doc_type`, `doc_param`, `event`, `label`.

Differences from Vivid Life, each following the best-practice documents:

- `operator` → `fg_muted`, not the keyword colour. Sunset is the loudest hue; spending it on every `=` dilutes it.
- `lang_var` (`this`/`self`/`super`) → keyword colour, italic.
- `invalid` → `semantic.danger`, italic underline. `invalid_deprecated` → `fg`, italic underline.

### Recommendation maps

Carried over in shape from Vivid Life and resolved against the slots above:

- `scope_recommendations` — TextMate scopes per slot. No rule targets a `meta.*` scope directly.
- `semantic_token_recommendations` — the standard LSP token types and modifiers. Ports set `semanticHighlighting: true`.
- `workbench_color_roles` — signals, git decorations, diff alphas, bracket-pair order (starting at `fg`, skipping the keyword colour), unexpected bracket.

## ANSI palette

| Slot    | Normal              | Bright            |
| ------- | ------------------- | ----------------- |
| black   | `surface.bg_sunk`   | `darkblue.50`     |
| red     | `signalred_on_dark` | resolved by gate  |
| green   | `freegreen.80`      | `freegreen.50`    |
| yellow  | `sunset.100`        | `sunset.50`       |
| blue    | `middleblue.50`     | `middleblue.30`   |
| magenta | `pumpelorange.80`   | `pumpelorange.50` |
| cyan    | `windblue.70`       | `windblue.40`     |
| white   | `darkblue.30`       | `darkblue.10`     |

Notes:

- The brand has no magenta. The slot takes Pumpelorange, the only unassigned hue. This is the one place the ANSI name and the colour disagree; the README says so.
- ANSI blue on a blue terminal is the hardest slot. It takes Middleblue so it stays apart from cyan (Windblue) by hue as far as the brand allows; the distinctness gate checks the pair.
- `black` is exempt from the contrast gate, as the conventional near-background anchor. `bright_black` is not.
- Bright red, if the red decision goes as recommended, is the next OKLCH lightness step of the same hue.

## Overlay recipes

Vivid Life's ports each hard-code their own alphas. Here they are tokens: `{ color, alpha }` pairs, composited over `surface.bg` by a helper the foundation exports (`alphaOver`), so a port without alpha support bakes the same value a port with alpha support blends.

| Recipe                  | Colour         | Alpha |
| ----------------------- | -------------- | ----- |
| `selection`             | `windblue`     | 30 %  |
| `selection_inactive`    | `windblue`     | 18 %  |
| `line_highlight`        | `darkblue.90`  | solid |
| `find_match`            | `pumpelorange` | 45 %  |
| `find_match_other`      | `windblue`     | 22 %  |
| `word_highlight`        | `sunset`       | 22 %  |
| `word_highlight_strong` | `sunset`       | 38 %  |
| `selected_item`         | `sunset`       | 18 %  |
| `diff_inserted_line`    | `freegreen`    | 12 %  |
| `diff_inserted_text`    | `freegreen`    | 25 %  |
| `diff_removed_line`     | `signalred`    | 14 %  |
| `diff_removed_text`     | `signalred`    | 35 %  |

Selection is blue and the current find match is orange so the two never look alike. Alphas are starting values; the gate below can force them down.

## Shell roles

New in this foundation. fish and PowerShell each need "what colour is a command, an option, an autosuggestion" and the Vivid Life ports each answered it separately. One map, `shell_roles`, with the fish variable and PSReadLine key each role feeds listed beside it:

| Role                | Value                   | Style     |
| ------------------- | ----------------------- | --------- |
| `command`           | `function` slot         |           |
| `keyword`           | `keyword` slot          |           |
| `option`            | `attr` slot             |           |
| `argument`          | `fg`                    |           |
| `string`            | `string` slot           |           |
| `number`            | `number` slot           |           |
| `variable`          | `type` slot             |           |
| `operator`          | `fg_muted`              |           |
| `redirection`       | `fg_muted`              |           |
| `escape`            | `constant` slot         |           |
| `comment`           | `comment` slot          | italic    |
| `autosuggestion`    | `fg_subtle`             |           |
| `error`             | `semantic.danger`       |           |
| `valid_path`        | —                       | underline |
| `selection`         | `overlay.selection`     |           |
| `search_match`      | `overlay.find_match`    |           |
| `pager_selected`    | `overlay.selected_item` |           |
| `pager_prefix`      | `accent`                |           |
| `pager_description` | `fg_subtle`             |           |

Commands take the function colour rather than the accent (as Vivid Life does): the cursor is already Sunset, and a typed command is a call.

## Prompt roles

For Starship. `prompt_roles` covers: `directory` (accent, bold), `git_branch` (info), `git_status` entries (added → success, modified → info, deleted → danger, conflicted → warning, untracked → success, ahead/behind/stashed → `fg_muted`), `character_success` (success), `character_error` (danger), `duration` (`fg_muted`), `language_module` (`fg_muted` — the brand has too few hues to give each language its own, and a module's symbol already identifies it).

## Typography

Recommendation only; no font files in the repo.

- Editor and terminal: **JetBrains Mono** (OFL-1.1), as the sepp.med design system already names it.
- Prompts with icons (Starship, fish): **JetBrainsMono Nerd Font**.
- `typography.mono.stack`: `"JetBrains Mono", "JetBrainsMono Nerd Font", "Cascadia Code", Consolas, ui-monospace, monospace`.

Preview pages use the same stack and fall back gracefully when the font is not installed.

## Build gates

`tools/build-tokens.mjs` fails the build when any of these do not hold. Colour maths (luminance, contrast, alpha compositing, mixing) is adapted from Vivid Life's `tools/build-tokens.mjs`.

1. **Text contrast.** `fg`, `fg_muted`, `fg_subtle`, every syntax slot, every semantic foreground: ≥ 4.5:1 on `bg`, `bg_sunk`, `bg_soft`, `bg_overlay`.
2. **Text on overlays.** `fg` and every syntax slot: ≥ 4.5:1 on `selection`, `line_highlight`, `find_match`, `find_match_other`, `word_highlight`, `word_highlight_strong` and the diff line recipes, each composited over `bg`. People read code while it is selected.
3. **ANSI.** All sixteen ≥ 4.5:1 on `bg_terminal`, except `black`.
4. **Non-text.** `border.control` ≥ 3:1 on `bg`, `bg_sunk`, `bg_soft`, `bg_overlay`. `accent` ≥ 3:1 on the same (focus ring).
5. **Fills.** Each semantic fill's text colour ≥ 4.5:1 on its fill; `accent_on` ≥ 4.5:1 on `accent`.
6. **Distinctness.** Pairs that must not look alike have an OKLab distance ≥ 8 (×100 scale): `function`/`fg`, `function`/`tag`, `function`/`type`, `string`/`number`, `keyword`/`parameter`, `type`/`attr`, `comment`/`fg`, ANSI `blue`/`cyan`, ANSI `yellow`/`magenta`, every ANSI normal against its bright. Slots that share a value on purpose (`number`/`constant`/`regex`, `keyword`/`tag`, `parameter`/`attr`) are listed as allowed aliases so the audit runs on resolved colours, not slot names.
7. **Signal separation.** `accent`, `warning`, `danger` pairwise distance ≥ 8. `danger` and `success` differ by ≥ 5 in OKLab lightness.
8. **Palette integrity.** Every colour reference resolves to a base colour, a generated ladder step, or one of the two named literals. No stray hex. Signalred has no ladder steps.
9. **Selection ≠ find.** `selection` and `find_match`, composited, have a distance ≥ 8.

**APCA** (Lc for every text pair) is printed as a report and written to the contrast preview, with the syntax document's targets beside it (body ≥ 75, comments ≥ 45). It informs; it does not fail the build. WCAG 2.x AA is the hard requirement.

Where a gate fails on the provisional values in this spec, the fix order is: move along the same ladder; then swap roles between brand hues; never add a hue.

## Repository layout

```
tokens.json5                 Single source of truth (hand-edited)
tokens.json                  Generated — resolved
dist/tokens.js               Generated — ES module
colors.css                   Generated — custom properties for the previews
tools/
  build-tokens.mjs           Resolve, generate ladders, run gates, --check, --test
  build-css.mjs              tokens → colors.css
  build-previews.mjs         --check: every var(--…) in preview/ resolves
preview/
  01-syntax.html             TS/JSX, Python, CSS, HTML, JSON, Markdown samples
  02-terminal.html           ANSI grid, sample git/ls output
  03-shell.html              Shell roles, prompt roles
  04-contrast.html           Generated gate and APCA report
assets/
  icon-{16,32,48,128,180,256,512}.png
handoff/
  SKILL.md                   Claude Code skill for port repos
  README.md
docs/superpowers/specs/      This file
README.md
CLAUDE.md
CHANGELOG.md
package.json
.editorconfig  .gitignore  .prettierignore
```

No dependencies; plain Node ≥ 18. Scripts: `build`, `check`, `test`, as in Vivid Life. `package.json` is named `@sepps-workshop/design-system` with `exports` for `.`, `./tokens.json`, `./css`, `./assets/*`, `./tools/build-tokens`, so ports can depend on it by local path or git URL now and by npm later without changing imports.

### Icon

Source: an 8192 × 8192 PNG of Sepp (76 MB), kept outside the repo. The repo holds downscaled renders only. At 16 and 32 px the halftone dots and the wrench will likely not survive; those sizes are rendered and reviewed, and a simplified small-size mark is a later asset.

### Licence

None yet. The repository is public as an experiment; the licence question is deferred, so all rights are reserved by sepp.med GmbH and `package.json` says `UNLICENSED`. There is no licence file.

## Contract for ports

Stated in the README and `handoff/SKILL.md`:

1. Read `dist/tokens.js` or `tokens.json`. Never re-encode a colour.
2. Editor ports take syntax from `syntax` and the recommendation maps.
3. Terminal ports take all sixteen colours from `ansi` and the background from `surface.bg_terminal`.
4. Shell ports take every colour from `shell_roles`; prompt ports from `prompt_roles`.
5. Overlays come from `overlay` via `alphaOver`, not from port-side alpha constants.
6. Red as text is `semantic.danger`; red as a fill is `semantic.danger_fill` with its listed text colour. Never Signalred as text on a dark surface.
7. A value a port needs and cannot find is a foundation gap: fix it here.

## Testing

- `npm run test` — colour-maths self-tests (contrast against known pairs, ladder generation against Canva values, `alphaOver`, OKLab distance).
- `npm run build` — all nine gates.
- `npm run check` — generated files match `tokens.json5`; preview references resolve.
- Manual: open the four preview pages; walk the two best-practice checklists against `01-syntax.html` and `02-terminal.html`, including a deuteranopia and protanopia simulation of the terminal page.
