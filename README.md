<p align="center">
  <img src="assets/sepps-workshop-header.jpg" width="100%" alt="Sepp, the blue robot, assembling code blocks with a wrench in his workshop" />
</p>

# Sepp’s Workshop Design System

<p>
  <img src="https://img.shields.io/badge/WCAG-AA-3aaa35" alt="WCAG AA" />
  <img src="https://img.shields.io/badge/dependencies-none-b2b2b2" alt="No dependencies" />
  <img src="https://img.shields.io/badge/license-MIT-b2b2b2" alt="MIT license" />
</p>

Sepp is the robot who keeps things running at [sepp.med](https://www.seppmed.com). This is his workshop: one colour theme for the tools developers stare at all day, built on the company’s Darkblue.

This repository is the foundation, not a theme you can install. It holds the colours, the rules for using them, and a build that refuses to pass if any text drops below WCAG AA. Think of the build as a very pedantic colleague: no colour gets through unless the maths agrees. The themes themselves live in their own repositories and read everything from here.

## Contents

- [Ports](#ports)
- [The theme at a glance](#the-theme-at-a-glance)
- [Palette](#palette)
- [Surfaces, text, borders](#surfaces-text-borders)
- [Syntax](#syntax)
- [Semantic roles](#semantic-roles)
- [ANSI](#ansi)
- [Overlays](#overlays)
- [Shell and prompt roles](#shell-and-prompt-roles)
- [Typography](#typography)
- [Build gates](#build-gates)
- [Build flow and files](#build-flow-and-files)
- [For ports](#for-ports)
- [Assets](#assets)
- [Contributing](#contributing)
- [License](#license)
- [Want to join Sepp’s Workshop?](#want-to-join-sepps-workshop)

## Ports

| Target           | Repository                                                                           | Status                               |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| VS Code          | [`sepps-workshop-vs-code`](https://github.com/sepps-workshop/sepps-workshop-vs-code) | working, Marketplace listing pending |
| Windows Terminal | `sepps-workshop-windows-terminal`                                                    | planned                              |
| PowerShell       | `sepps-workshop-powershell`                                                          | planned                              |
| fish             | `sepps-workshop-fish`                                                                | planned                              |
| Starship         | `sepps-workshop-starship`                                                            | planned                              |

One theme per port. There are no variants.

## The theme at a glance

A dark theme. The editor canvas is a deepened sepp.med Darkblue, the chrome around it is Darkblue itself, the accent is Sunset yellow, and code is coloured with three brand hues (yellow, orange, cyan-blue) at two lightness steps each. Every colour is a brand colour, one of its official tints, or one of four documented derived values.

The preview pages are generated from the tokens. Clone the repository and open them in a browser:

- [`preview/01-syntax.html`](preview/01-syntax.html): code samples and editor states
- [`preview/02-terminal.html`](preview/02-terminal.html): the sixteen ANSI colours
- [`preview/03-shell.html`](preview/03-shell.html): shell and prompt roles
- [`preview/04-contrast.html`](preview/04-contrast.html): every text pair the build checks, with its contrast

## Palette

The base colours come from the sepp.med brand kit (Farbtafel 2026).

<!-- tokens:palette -->

| Colour        | Hex       | On Darkblue | Ladder       |
| ------------- | --------- | ----------- | ------------ |
| Darkblue      | `#0d3174` | 1.00:1      | 100 % … 10 % |
| Sunset        | `#fbba00` | 7.10:1      | 100 % … 10 % |
| Shadowgrey    | `#b2b2b2` | 5.80:1      | 100 % … 10 % |
| Middleblue    | `#076eab` | 2.24:1      | 100 % … 10 % |
| Pumpelorange  | `#ec6608` | 3.79:1      | 100 % … 10 % |
| Windblue      | `#008ecf` | 3.38:1      | 100 % … 10 % |
| Bright Orange | `#f59c00` | 5.64:1      | 100 % … 10 % |
| Darkblack     | `#1d1d1b` | 1.37:1      | 100 % … 10 % |
| Racing Red    | `#f0191d` | 2.85:1      | none         |
| Lime Green    | `#64b32e` | 4.70:1      | 100 % … 10 % |
| White         | `#ffffff` | 12.29:1     | none         |

<!-- /tokens -->

**Ladders.** Every colour except Racing Red and White has a ladder of tints in 10 % steps towards white, as in the brand kit. The build generates them (`palette.<name>.<step>`), so `pumpelorange.70` is 70 % Pumpelorange and 30 % white. A few generated steps differ from the value printed in the brand kit by one unit in one channel (rounding). The brand kit shows no tints for Lime Green, because there it is a signal colour only. Green text on Darkblue needs lighter steps, so the build calculates a Lime Green ladder the same way.

**Brand rules the foundation follows:**

- Racing Red has no tints. Mixed with white it drifts into pink.
- Racing Red and Lime Green are signals (error, success, removed, added). They carry no syntax slot.
- White is part of the brand without being listed in it. Here it is used only as text on the red fill.

### Three departures from the ladder

Everything else resolves to a base colour or a ladder step. The exceptions live under `derived` in `tokens.json5`, with the reason beside each.

**A canvas below Darkblue.** The ladder only goes lighter, and Darkblue itself is too bright and too saturated to read code on for hours. `derived.bg_deep` is Darkblue mixed 55 % with Darkblack: `#14284c`, far enough from Darkblue to read as a different surface. The build verifies the recipe.

**A readable red.** Racing Red reaches 2.85:1 on Darkblue. That is under the 3:1 a squiggle needs and far under the 4.5:1 text needs, and red text cannot be avoided: ANSI red, `git diff` removals, shell error highlighting. `derived.racingred_on_dark` (`#ff897b`, 5.34:1) keeps Racing Red's hue in OKLCH, raises the lightness and holds the chroma at the sRGB maximum, which gives a warm coral red and not the pink of a white tint. `derived.racingred_on_dark_bright` (`#ffb4aa`, 7.23:1) is the next step of the same hue, for ANSI bright red. The build checks that both stay on the Racing Red hue.

**A red fill that carries text.** White reaches 4.32:1 on Racing Red, and no other brand colour does better. `derived.racingred_fill` is Racing Red mixed 90 % with Darkblack: `#db191d`, with white text at 5.04:1. The build verifies the recipe.

The rule for ports: **red as text is `semantic.danger`; red as a fill is `semantic_fill.danger.fill`** with white text on it (5.04:1).

## Surfaces, text, borders

<!-- tokens:surfaces -->

| Token                 | Source            | Value     | On `bg`          | Use                                              |
| --------------------- | ----------------- | --------- | ---------------- | ------------------------------------------------ |
| `surface.bg`          | `derived.bg_deep` | `#14284c` |                  | Editor canvas                                    |
| `surface.bg_chrome`   | `darkblue`        | `#0d3174` |                  | Sidebar, activity bar, status bar, inactive tabs |
| `surface.bg_soft`     | `darkblue.90`     | `#254682` |                  | Hover, inputs                                    |
| `surface.bg_overlay`  | `darkblue`        | `#0d3174` |                  | Menus, hover and suggest widgets, quick input    |
| `surface.bg_terminal` | `darkblue`        | `#0d3174` |                  | Terminal background                              |
| `text.fg`             | `darkblue.10`     | `#e7eaf1` | 12.13:1          | Body text, variables                             |
| `text.fg_muted`       | `darkblue.30`     | `#b6c1d5` | 8.05:1           | Secondary text, punctuation                      |
| `text.fg_subtle`      | `darkblue.40`     | `#9eadc7` | 6.44:1           | Comments, autosuggestions                        |
| `text.fg_disabled`    | `darkblue.60`     | `#6e83ac` | 3.83:1           | Disabled; exempt from the text gate              |
| `border.subtle`       | `darkblue.90`     | `#254682` | 1.58:1           | Dividers                                         |
| `border.default`      | `darkblue.80`     | `#3d5a90` | 2.13:1           | Panel edges                                      |
| `border.control`      | `darkblue.50`     | `#8698ba` | 5.02:1           | Control outline                                  |
| `accent`              | `sunset`          | `#fbba00` | 8.43:1           | Cursor, focus ring, active tab, primary button   |
| `accent_on`           | `darkblue`        | `#0d3174` | 7.10:1 on accent | Text on the accent                               |
| `accent_hover`        | `sunset.80`       | `#fcc833` | 9.35:1           | Primary button under the pointer                 |

<!-- /tokens -->

- `bg_soft` is lighter than the canvas and costs contrast. It carries `fg` and `fg_muted` only, never comments or syntax colours.
- The canvas is the dark well the code sits in. The chrome around it (`bg_chrome`) is Darkblue, lighter than the canvas, so the brand colour frames the code and the two never merge.
- Floating widgets sit on `bg_chrome`: a lighter panel over the dark canvas reads as raised.
- `bg_terminal` equals `bg_chrome`. A standalone terminal shows no other surface, and it should be the Darkblue people recognise. A terminal embedded in an editor is content: it sits on `bg`, and the port separates it from the editor with a strip of chrome.
- Body text is not pure white, and no surface is pure black.

## Syntax

A traditional theme uses seven to nine hues. The brand offers three that stay apart on Darkblue. Measured in OKLab, Bright Orange sits 5 units from the Pumpelorange tint used for numbers and the Middleblue tints sit 2 to 5 units from the Windblue tints at the same step, which is too close to tell apart at a glance, so neither carries a syntax slot. The theme makes up for the missing hues with lightness, the dimension the eye separates best: each hue appears at two steps, and italics add a third axis. Warm colours mark data, cool colours mark behaviour.

### Core slots

<!-- tokens:syntax -->

| Slot        | Source            | Value     | Style  | On `bg` |
| ----------- | ----------------- | --------- | ------ | ------- |
| `comment`   | `text.fg_subtle`  | `#9eadc7` | italic | 6.44:1  |
| `keyword`   | `sunset`          | `#fbba00` |        | 8.43:1  |
| `string`    | `pumpelorange.40` | `#f7c29c` |        | 9.15:1  |
| `number`    | `pumpelorange.70` | `#f29452` |        | 6.35:1  |
| `function`  | `windblue.50`     | `#80c7e7` |        | 7.82:1  |
| `parameter` | `windblue.30`     | `#b3ddf1` | italic | 10.11:1 |
| `type`      | `sunset.40`       | `#fde399` |        | 11.56:1 |
| `constant`  | `pumpelorange.70` | `#f29452` |        | 6.35:1  |
| `tag`       | `sunset`          | `#fbba00` |        | 8.43:1  |
| `attr`      | `windblue.30`     | `#b3ddf1` | italic | 10.11:1 |
| `regex`     | `pumpelorange.70` | `#f29452` |        | 6.35:1  |
| `punct`     | `text.fg_muted`   | `#b6c1d5` |        | 8.05:1  |

<!-- /tokens -->

Slots that share a colour on purpose are listed in `syntax_tokens.aliases`: `number`, `constant` and `regex`; `keyword` and `tag`; `parameter` and `attr`.

Variables and properties are `fg`. In JavaScript and TypeScript nearly every declaration is a `const`, so `variable.other.constant` falls through to `fg`; the language server's `variable.readonly` token marks real constants.

### Extended tokens

Each resolves to a core slot, a text colour or a semantic role, with an optional font style.

<!-- tokens:extended -->

| Token                | Colour            | Style             |
| -------------------- | ----------------- | ----------------- |
| `variable`           | `fg`              |                   |
| `property`           | `fg`              |                   |
| `operator`           | `fg_muted`        |                   |
| `decorator`          | `function`        | italic            |
| `builtin`            | `function`        | italic            |
| `namespace`          | `type`            |                   |
| `macro`              | `function`        |                   |
| `lifetime`           | `constant`        |                   |
| `heading`            | `keyword`         | bold              |
| `link`               | `function`        |                   |
| `selector`           | `tag`             |                   |
| `unit`               | `number`          |                   |
| `hex`                | `string`          |                   |
| `shebang`            | `comment`         |                   |
| `lang_var`           | `keyword`         | italic            |
| `emphasis`           | inherits          | italic            |
| `strong`             | `constant`        | bold              |
| `invalid`            | `semantic.danger` | italic, underline |
| `invalid_deprecated` | `fg`              | italic, underline |
| `doc_keyword`        | `keyword`         |                   |
| `doc_type`           | `type`            | italic            |
| `doc_param`          | `parameter`       | italic            |
| `event`              | `function`        |                   |
| `label`              | `fg`              | italic            |

<!-- /tokens -->

`operator` is `fg_muted` and not the keyword colour: Sunset is the loudest hue, and spending it on every `=` would dilute it.

### Recommendation maps

- `scope_recommendations`: TextMate scopes per slot, most specific first. Use them for `tokenColors`. No rule ends in a `meta.*` scope.
- `semantic_token_recommendations`: the standard language-server token types and modifiers. Use them for `semanticTokenColors`, and set `"semanticHighlighting": true`.
- `workbench_color_roles`: which role colours errors, warnings, git states and bracket pairs. Apply the same role wherever the state appears: squiggle, gutter, overview ruler, status bar, file tree.

## Semantic roles

<!-- tokens:semantic -->

| Role      | Foreground on dark                    | On `bg` | Fill                               | Text on fill         |
| --------- | ------------------------------------- | ------- | ---------------------------------- | -------------------- |
| `danger`  | `derived.racingred_on_dark` `#ff897b` | 6.34:1  | `derived.racingred_fill` `#db191d` | `white` (5.04:1)     |
| `success` | `limegreen.60` `#a2d182`              | 8.33:1  | `limegreen` `#64b32e`              | `darkblack` (6.46:1) |
| `warning` | `brightorange` `#f59c00`              | 6.70:1  | `brightorange` `#f59c00`           | `darkblack` (7.75:1) |
| `info`    | `windblue.50` `#80c7e7`               | 7.82:1  | —                                  | —                    |

<!-- /tokens -->

- **Warning is Bright Orange.** Yellow is the accent, and Pumpelorange is too close to the derived red. Bright Orange is the remaining orange; it sits close to the number colour, so ports pair a warning with a shape (a squiggle, an icon), never with colour alone.
- **Danger and success differ in lightness as well as hue**, so the pair survives red-green colour blindness. Success is lighter than contrast alone would require.
- The VS Code debugging status bar uses the danger fill, because the accent is already yellow.

## ANSI

<!-- tokens:ansi -->

| Slot    | Normal                                | On terminal | Bright                                       | On terminal |
| ------- | ------------------------------------- | ----------- | -------------------------------------------- | ----------- |
| black   | `darkblack` `#1d1d1b`                 | exempt      | `darkblack.40` `#a5a5a4`                     | 4.99:1      |
| red     | `derived.racingred_on_dark` `#ff897b` | 5.34:1      | `derived.racingred_on_dark_bright` `#ffb4aa` | 7.23:1      |
| green   | `limegreen.60` `#a2d182`              | 7.01:1      | `limegreen.40` `#c1e1ab`                     | 8.56:1      |
| yellow  | `sunset` `#fbba00`                    | 7.10:1      | `sunset.40` `#fde399`                        | 9.73:1      |
| blue    | `middleblue.60` `#6aa8cd`             | 4.74:1      | `middleblue.40` `#9cc5dd`                    | 6.70:1      |
| magenta | `brightorange` `#f59c00`              | 5.64:1      | `brightorange.60` `#f9c466`                  | 7.68:1      |
| cyan    | `windblue.50` `#80c7e7`               | 6.58:1      | `windblue.30` `#b3ddf1`                      | 8.50:1      |
| white   | `shadowgrey.60` `#d1d1d1`             | 8.05:1      | `darkblue.10` `#e7eaf1`                      | 10.21:1     |

<!-- /tokens -->

- **Magenta is Bright Orange.** The brand has no magenta. This is the one place where the ANSI name and the colour disagree.
- **Blue and cyan differ in lightness as well as hue.** Blue on a blue terminal is the hardest slot; it takes Middleblue, and cyan takes a lighter Windblue step.
- **The neutrals are true greys** (Shadowgrey and a Darkblack tint). A blue-grey from the Darkblue ladder would not stay apart from blue and cyan.
- `black` is Darkblack, the anchor for reverse video and black fills. It differs from both terminal backgrounds and is exempt from the contrast gate.

## Overlays

Recipes for the backgrounds that appear behind text and for a few workbench surfaces: `{ color, alpha, border? }`. The build adds two values to each. `hex` is the recipe composited over `surface.bg`, for a port that cannot blend. `hexa` is the recipe itself as `#rrggbbaa`, for a port that can. Over the canvas both look the same.

<!-- tokens:overlay -->

| Recipe                  | Colour         | Alpha | Composited | Border            | Carries          |
| ----------------------- | -------------- | ----- | ---------- | ----------------- | ---------------- |
| `selection`             | `darkblack`    | 80 %  | `#1b1f25`  |                   | code             |
| `selection_inactive`    | `darkblack`    | 55 %  | `#192231`  |                   | code             |
| `line_highlight`        | `darkblack`    | 35 %  | `#17243b`  |                   | code             |
| `find_match`            | `pumpelorange` | 15 %  | `#343142`  | `pumpelorange.70` | code             |
| `find_match_other`      | `pumpelorange` | 8 %   | `#252d47`  | `darkblue.50`     | code             |
| `word_highlight`        | `sunset`       | 10 %  | `#2b3744`  |                   | code             |
| `word_highlight_strong` | `sunset`       | 10 %  | `#2b3744`  | `sunset`          | code             |
| `selected_item`         | `sunset`       | 18 %  | `#3e423e`  |                   | `fg`, `fg_muted` |
| `diff_inserted_line`    | `limegreen`    | 12 %  | `#1e3948`  |                   | code             |
| `diff_inserted_text`    | `darkblack`    | 50 %  | `#192334`  |                   | code             |
| `diff_removed_line`     | `racingred`    | 14 %  | `#332645`  |                   | code             |
| `diff_removed_text`     | `racingred`    | 30 %  | `#56243e`  |                   | code             |
| `hover`                 | `darkblack`    | 35 %  | `#17243b`  |                   | surface          |
| `active`                | `darkblack`    | 55 %  | `#192231`  |                   | surface          |
| `scrim`                 | `darkblack`    | 60 %  | `#19212f`  |                   | non-text         |
| `slider`                | `darkblue.40`  | 30 %  | `#3d5071`  |                   | non-text         |
| `slider_hover`          | `darkblue.40`  | 50 %  | `#596b8a`  |                   | non-text         |
| `slider_active`         | `darkblue.40`  | 70 %  | `#7585a2`  |                   | non-text         |
| `merge_current_content` | `windblue`     | 10 %  | `#123259`  |                   | code             |
| `merge_current_header`  | `windblue`     | 25 %  | `#0f426d`  |                   | `fg`, `fg_muted` |
| `merge_incoming_header` | `limegreen`    | 25 %  | `#284b45`  |                   | `fg`, `fg_muted` |
| `stack_frame`           | `brightorange` | 10 %  | `#2b3444`  |                   | code             |

<!-- /tokens -->

**Overlays darken.** Neither the canvas nor Darkblue is dark enough to lighten. A selection that lightens them by a visible amount pushes every saturated brand colour below 4.5:1; a selection that darkens it adds contrast. So selection and line highlight mix towards Darkblack. The canvas is already close to Darkblack, which is why the alphas are high.

Highlights that have to carry a hue stay faint and get a border, which also means they do not rely on colour alone. Read and write word highlights share a fill; the write highlight adds the border.

The last column is the overlay's class, and every overlay has exactly one:

- **code** overlays sit behind whole lines on the canvas and are checked against every syntax colour.
- **`fg`, `fg_muted`** overlays sit behind list rows and headers and carry those two text colours only.
- **surface** overlays (`hover`, `active`) are also drawn over the sidebar, the status bar and menus. They are checked as code overlays on `bg`, `bg_chrome` and `bg_overlay`, so a port must use `hexa` for them.
- **non-text** overlays are the shadow and the scrollbar thumbs. Nothing is read through them.

A changed span in a diff is drawn on top of its line, behind code. So `diff_inserted_text` darkens the green line instead of deepening the green, which would take numbers and comments below 4.5:1, and both `diff_*_text` recipes are checked stacked on their line recipes.

The debugger has two frame highlights and the foundation has one recipe, `stack_frame`: a second faint hue would not separate from the first on Darkblue. Ports tell the frames apart by the gutter arrow.

## Shell and prompt roles

fish and PowerShell both need to know what colour a command, an option or an autosuggestion is. `shell_roles` answers that once, and lists the fish variables and PSReadLine keys each role feeds.

<!-- tokens:shell -->

| Role                         | Colour                  | Style     | fish                                                          | PSReadLine                                 |
| ---------------------------- | ----------------------- | --------- | ------------------------------------------------------------- | ------------------------------------------ |
| `command`                    | `function`              |           | `fish_color_command`                                          | `Command`                                  |
| `keyword`                    | `keyword`               |           | `fish_color_keyword`                                          | `Keyword`                                  |
| `option`                     | `attr`                  |           | `fish_color_option`                                           | `Parameter`                                |
| `argument`                   | `fg`                    |           | `fish_color_normal`<br>`fish_color_param`                     | `Default`                                  |
| `string`                     | `string`                |           | `fish_color_quote`                                            | `String`                                   |
| `number`                     | `number`                |           |                                                               | `Number`                                   |
| `variable`                   | `type`                  |           |                                                               | `Variable`                                 |
| `type`                       | `type`                  |           |                                                               | `Type`                                     |
| `member`                     | `fg`                    |           |                                                               | `Member`                                   |
| `operator`                   | `fg_muted`              |           | `fish_color_operator`<br>`fish_color_end`                     | `Operator`                                 |
| `redirection`                | `fg_muted`              |           | `fish_color_redirection`                                      |                                            |
| `escape`                     | `constant`              |           | `fish_color_escape`                                           |                                            |
| `comment`                    | `comment`               | italic    | `fish_color_comment`                                          | `Comment`                                  |
| `autosuggestion`             | `fg_subtle`             |           | `fish_color_autosuggestion`                                   | `InlinePrediction`<br>`ContinuationPrompt` |
| `error`                      | `semantic.danger`       |           | `fish_color_error`<br>`fish_color_status`                     | `Error`                                    |
| `emphasis`                   | `accent`                |           |                                                               | `Emphasis`                                 |
| `valid_path`                 | inherits                | underline | `fish_color_valid_path`                                       |                                            |
| `selection`                  | `overlay.selection`     |           | `fish_color_selection`                                        | `Selection`                                |
| `search_match`               | `overlay.find_match`    |           | `fish_color_search_match`                                     |                                            |
| `pager_selected`             | `overlay.selected_item` |           | `fish_pager_color_selected_background`                        | `ListPredictionSelected`                   |
| `pager_selected_completion`  | `fg`                    |           | `fish_pager_color_selected_completion`                        |                                            |
| `pager_selected_description` | `fg_muted`              |           | `fish_pager_color_selected_description`                       |                                            |
| `pager_selected_prefix`      | `accent`                |           | `fish_pager_color_selected_prefix`                            |                                            |
| `pager_prefix`               | `accent`                |           | `fish_pager_color_prefix`                                     |                                            |
| `pager_completion`           | `fg`                    |           | `fish_pager_color_completion`                                 | `ListPrediction`                           |
| `pager_description`          | `fg_subtle`             |           | `fish_pager_color_description`<br>`fish_pager_color_progress` |                                            |
| `cwd`                        | `accent`                |           | `fish_color_cwd`                                              |                                            |
| `cwd_root`                   | `semantic.danger`       |           | `fish_color_cwd_root`                                         |                                            |
| `user`                       | `function`              |           | `fish_color_user`                                             |                                            |
| `host`                       | `fg_muted`              |           | `fish_color_host`                                             |                                            |
| `host_remote`                | `semantic.warning`      |           | `fish_color_host_remote`                                      |                                            |

<!-- /tokens -->

The selected pager row lightens the canvas, so its text is restated in the `pager_selected_*` roles: the description steps up from `fg_subtle` to `fg_muted`.

Commands take the function colour, not the accent: the cursor is already Sunset, and a typed command is a call.

`prompt_roles` does the same for Starship.

<!-- tokens:prompt -->

| Role                    | Colour             | Style |
| ----------------------- | ------------------ | ----- |
| `directory`             | `accent`           | bold  |
| `git_branch`            | `semantic.info`    |       |
| `character_success`     | `semantic.success` |       |
| `character_error`       | `semantic.danger`  |       |
| `duration`              | `fg_muted`         |       |
| `language_module`       | `fg_muted`         |       |
| `git_status.added`      | `semantic.success` |       |
| `git_status.untracked`  | `semantic.success` |       |
| `git_status.modified`   | `semantic.info`    |       |
| `git_status.renamed`    | `semantic.info`    |       |
| `git_status.deleted`    | `semantic.danger`  |       |
| `git_status.conflicted` | `semantic.warning` |       |
| `git_status.staged`     | `semantic.warning` |       |
| `git_status.ahead`      | `fg_muted`         |       |
| `git_status.behind`     | `fg_muted`         |       |
| `git_status.diverged`   | `fg_muted`         |       |
| `git_status.stashed`    | `fg_muted`         |       |

<!-- /tokens -->

Language modules stay neutral. The brand has too few hues to give each language its own, and a module's symbol already identifies it.

## Typography

Themes cannot ship fonts, and this repository contains none. The foundation recommends:

- **JetBrains Mono** for editors and terminals ([jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/), OFL-1.1)
- **JetBrainsMono Nerd Font** where a prompt shows icons, as Starship does ([nerdfonts.com](https://www.nerdfonts.com/font-downloads))

`typography.mono.stack` holds the full fallback stack.

## Build gates

`npm run build` fails when any of these does not hold.

1. **Text contrast.** `fg`, `fg_muted`, `fg_subtle`, every syntax slot and every semantic foreground reach 4.5:1 on `bg`, `bg_chrome` and `bg_overlay`. `fg` and `fg_muted` reach 4.5:1 on `bg_soft`.
2. **Text on overlays.** The same colours reach 4.5:1 on every code overlay. `fg` and `fg_muted` reach 4.5:1 on the label overlays. `hover` and `active` are checked the same way on `bg`, `bg_chrome` and `bg_overlay`, and each `diff_*_text` recipe stacked on its `diff_*_line` recipe. Both must also darken each of those surfaces: a faint lightening can pass on contrast alone.
3. **ANSI.** All sixteen colours except `black` reach 4.5:1 on `bg_terminal` and on `bg`, where an embedded terminal sits. The same fifteen reach 4.5:1 on `overlay.selection` and `overlay.selection_inactive`, composited over either background, where a terminal draws selected text.
4. **Non-text.** `border.control` and `accent` reach 3:1 on every surface. Every overlay border reaches 3:1 on its own fill. `slider_active` reaches 3:1 on `bg` and `bg_chrome`.
5. **Fills.** The text on each semantic fill, and `accent_on` on `accent` and on `accent_hover`, reach 4.5:1.
6. **Distinctness.** Slots that must not look alike are at least 7 apart in OKLab (×100; about 2 is just noticeable): the listed syntax pairs, every pair within an ANSI row, and each ANSI colour against its bright version. Two core slots may share a colour only if `syntax_tokens.aliases` lists them together.
7. **Signal separation.** `accent`, `warning` and `danger` are at least 7 apart. `danger` and `success` differ by at least 5 in lightness.
8. **Palette integrity.** No hex value outside `palette_base` and `derived`, and no value under `derived` beyond the four documented ones. No ladder for Racing Red or White. `bg_deep` and `racingred_fill` match their recipes. The derived reds stay on the Racing Red hue. `bg_terminal` and `bg_overlay` equal `bg_chrome`, and `bg` is at least 7 from `bg_chrome` and `bg_terminal` in OKLab.
9. **Overlay visibility.** `selection` is at least 7 from `bg` and from `find_match`. `hover` is at least 3 from `bg` and `bg_chrome`, `active` at least 5, `slider` at least 7. `merge_current_header` is at least 7 from `bg`. `accent_hover` is at least 3 from `accent`. Each `diff_*_text` recipe, stacked, is at least 5 from its line.

Before the gates run, the build checks the shape of the tokens: every colour is a `#rrggbb` value, every overlay has an alpha, every overlay belongs to exactly one class, role objects use only the keys `color`, `style`, `fish` and `psreadline`, every colour target in the role maps resolves, and no scope rule ends in `meta.*`. Each problem is reported with its path. A build that fails writes nothing.

APCA lightness contrast is reported for every pair and shown on the contrast page. It informs and does not fail the build; WCAG 2.x AA is the requirement.

When a gate fails, move the value along its ladder, or swap roles between brand hues. Never add a hue, and never lower a threshold.

## Build flow and files

```
tokens.json5            the only file edited by hand
   │
   ├─ tools/build-tokens.mjs    → tokens.json, dist/tokens.js   (and runs the gates)
   ├─ tools/build-css.mjs       → colors.css
   ├─ tools/build-previews.mjs  → preview/*.html
   └─ tools/build-readme.mjs    → the token tables in this README
```

- `npm run build` regenerates everything and runs the gates.
- `npm run check` fails if a generated file is out of date or a gate fails.
- `npm test` runs the unit tests.

Plain Node 18 or later. No dependencies.

```
tokens.json5        source of truth
tokens.json         generated: resolved tokens
dist/tokens.js      generated: the same as an ES module
colors.css          generated: custom properties (--sw-*)
tools/              color.mjs, build-tokens.mjs, build-css.mjs, build-previews.mjs, build-readme.mjs, tests
preview/            generated reference pages
assets/             icon renders
handoff/            Claude Code skill for port repositories
docs/               release recovery steps
```

## For ports

1. Read `dist/tokens.js` or `tokens.json`. Never re-encode a colour.
2. Editor ports take syntax from `syntax`, `syntax_tokens` and the recommendation maps.
3. Terminal ports take all sixteen colours from `ansi` and the background from `surface.bg_terminal`. An editor port puts its embedded terminal on `surface.bg`.
4. Shell ports take every colour from `shell_roles`; prompt ports from `prompt_roles`.
5. Overlays come from `overlay.<name>`: `.hexa` where the target blends, `.hex` where it cannot, `.border` where present. No alpha constants in the port.
6. Red as text is `semantic.danger`. Red as a fill is `semantic_fill.danger.fill` with `semantic_fill.danger.text` on it. Never Racing Red as text on a dark surface.
7. A value a port needs and cannot find is a gap in the foundation. Fix it here.

The package is on npm:

```bash
npm install @sepps-workshop/design-system
```

```js
import tokens from "@sepps-workshop/design-system";
import {
  resolveTarget,
  alphaOver,
  contrast,
} from "@sepps-workshop/design-system/tools/build-tokens";

resolveTarget(tokens, "keyword"); // "#fbba00"
resolveTarget(tokens, "semantic.danger"); // "#ff897b"
resolveTarget(tokens, "overlay.selection"); // "#1b1f25"
```

`handoff/SKILL.md` is a Claude Code skill that teaches an assistant in a port repository how to use the foundation. Copy it to `.claude/skills/sepps-workshop/SKILL.md` in the port.

## Assets

`assets/icon-{16,32,48,128,180,256,512}.png` are renders of the Sepp icon. At 128 px and above, the halftone dots and the wrench are clear. At 16 and 32 px Sepp still reads as a blue robot on yellow, but the dots and the wrench are lost; a simplified mark for those sizes is planned.

<img src="assets/icon-128.png" width="128" height="128" alt="Sepp, a blue robot holding a wrench" />

## Contributing

`tokens.json5` is the only file edited by hand. Run `npm run build` after every change, then make sure `npm run check` and `npm test` pass. Issues are welcome, especially when two colours are hard to tell apart or a value looks wrong in one of the ports.

## License

MIT. See [LICENSE](./LICENSE).

## Want to join Sepp’s Workshop?

<img align="right" width="150" src="assets/sepp-recruiting.png" alt="Sepp, the blue robot, holding a sign that reads Be you – with us!" />

sepp.med builds and tests software for places where a bug is more than an inconvenience: medical devices, cars, aircraft. We have been doing it since 1980, as a family-run company in the Nuremberg metropolitan region. If you would rather get the contrast ratio right than argue about it, you might like it here.

Browse the [open positions](https://www.seppmed.com/career/open-positions/), or send a [speculative application](https://www.seppmed.com/career/speculative-application/) if none of them fits yet. Be you – with us.
