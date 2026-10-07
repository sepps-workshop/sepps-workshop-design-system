# Sepp’s Workshop Design System

Token foundation for five theme ports (VS Code, Windows Terminal, PowerShell, fish, Starship). One dark theme on sepp.med Darkblue. Source of truth is `tokens.json5`; everything else is generated. No npm dependencies — plain Node.

## Commands

- `npm run build` — run the gates, then regenerate `tokens.json`, `dist/tokens.js`, `colors.css`, `preview/*.html` and the token tables in `README.md`
- `npm run check` — fail if any generated file is out of date or a gate fails
- `npm test` — unit tests for the colour maths, loader, gates, CSS and previews

Run `npm run build` after every change to `tokens.json5`. A PostToolUse hook does this on edit.

After cloning, run `git config core.hooksPath .githooks` to enable the gitleaks pre-commit hook. CI runs `npm run check` and `npm test`.

## References

`README.md` **Read when:** working on the palette, roles, gates, or the contract with the ports, or when you need the reasoning behind a value or a rule.

## Conventions

- `tokens.json5` is the only data file edited by hand.
- A hex literal is allowed only under `palette_base` and `derived`. Everything else is a `$` reference.
- Every colour is a brand colour, a 10 % ladder step, or one of the four named values in `derived`. Never add a hue.
- When a gate fails: move along the same ladder, then swap roles between brand hues.
- Racing Red has no tints. Racing Red and Lime Green are signals, not syntax colours.
- Red as text on a dark surface is `semantic.danger`; red as a fill is `semantic_fill.danger.fill` (Racing Red darkened with Darkblack) with white text.
- Overlays darken the canvas. A lighter selection fails gate 2.
- Docs are English, no emoji. Numbers in docs come from `tokens.json` or the build output.

## Don't

- Don't hand-edit `tokens.json`, `dist/tokens.js`, `colors.css`, `preview/*.html`, or the README tables between `<!-- tokens:… -->` markers.
- Don't lower a gate threshold to make a value pass.
- Don't copy the 76 MB icon source into the repo; only the renders in `assets/` belong here.
- Don't add font files. Themes cannot ship fonts; the foundation only recommends one.
- Don't commit secrets. Don't use `--force`.

## Learnings

When the user corrects a mistake or points out a recurring issue, append a one-line summary to `.claude/learnings.md`. Don't modify CLAUDE.md directly.

## Compact Instructions

When compacting, preserve: list of modified files, current test status, open TODOs, and key decisions made.

<!-- cc-config: last-optimize-run: 2026-10-07 f55e26a165a3cc1e205a64a8a760f91fe9ec966c -->
