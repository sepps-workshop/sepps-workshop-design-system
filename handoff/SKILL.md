---
name: sepps-workshop
description: Use when building or changing a Sepp's Workshop theme port (VS Code, Windows Terminal, PowerShell, fish, Starship) — explains how to read colours and roles from the design-system foundation instead of re-encoding them.
---

# Sepp's Workshop — port skill

A port turns the foundation's tokens into one native theme file. It decides nothing about colour.

## Step 1 — Load the foundation

```js
import tokens from "@sepps-workshop/design-system";
import {
  resolveTarget,
  alphaOver,
  contrast,
} from "@sepps-workshop/design-system/tools/build-tokens";
```

Until it is on npm, install it with `npm install github:sepps-workshop/sepps-workshop-design-system`. Then read `node_modules/@sepps-workshop/design-system/README.md` before writing a template. **Read when:** starting a port. It explains every role.

## Step 2 — Map, don't invent

| The port needs                        | Take it from                                                               |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Editor syntax colours                 | `tokens.syntax`, `tokens.syntax_tokens`, `tokens.scope_recommendations`    |
| LSP semantic tokens                   | `tokens.semantic_token_recommendations`; set `semanticHighlighting: true`  |
| Errors, warnings, git, brackets       | `tokens.workbench_color_roles`                                             |
| The sixteen terminal colours          | `tokens.ansi`, background `tokens.surface.bg_terminal`                     |
| Shell highlighting (fish, PSReadLine) | `tokens.shell_roles` — each role lists the variables and keys it feeds     |
| Prompt segments (Starship)            | `tokens.prompt_roles`                                                      |
| Selection, find, word highlight, diff | `tokens.overlay.<name>.hex` (already composited), `.border` where present  |
| A named colour target                 | `resolveTarget(tokens, "keyword" \| "fg_muted" \| "semantic.danger" \| …)` |

## Hard rules

- Never write a hex value in a port. A value you cannot find is a gap in the foundation: fix it there.
- Red as text is `semantic.danger`. Signalred itself is for fills only, with `semantic_fill.danger.text` on top.
- Overlays come from `tokens.overlay`, with no port-side alpha constants. `overlay.selected_item` and the `diff_*_text` overlays carry `fg` and `fg_muted` only.
- Controls are outlined with `border.control`, the focus ring is `accent`.
- VS Code: the status bar stays on `surface.bg_sunk`; the accent appears as a border, not as its background. The debugging status bar uses the danger fill.
- Never rely on colour alone: pair a state colour with a border, an underline, a position or a font style.
- Recommend JetBrains Mono, and JetBrainsMono Nerd Font where the port shows icons. Ports cannot ship fonts. One theme per port, no variants.
- Port READMEs are English, exact where technical, relaxed elsewhere, no emoji. Each ends with the "Want to join Sepp's Workshop?" section linking to https://www.seppmed.com/career/.

## Feedback

After producing a theme, ask whether it used the foundation correctly and log corrections to `.claude/learnings.md`.
