# Sepp's Workshop Design System — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the token foundation (source file, build tools with contrast gates, generated outputs, previews, docs) that the five Sepp's Workshop theme ports read from.

**Architecture:** One hand-edited `tokens.json5`. `tools/build-tokens.mjs` generates the tint ladders, resolves `$` references, composites overlays, runs nine gates and emits `tokens.json` + `dist/tokens.js`. `tools/build-css.mjs` and `tools/build-previews.mjs` derive `colors.css` and four preview pages from the resolved tokens. Every generated file is deterministic and has a `--check` mode.

**Tech Stack:** Node ≥ 18, ES modules, no dependencies. ImageMagick (`magick`) once, for icon renders.

**Spec:** `docs/superpowers/specs/2026-10-01-design-system-foundation-design.md`

## Global Constraints

- No npm dependencies. No font files. No CI or publish workflows.
- All repo content in English. No emoji.
- `tokens.json5` is the only hand-edited data file. `tokens.json`, `dist/tokens.js`, `colors.css`, `preview/*.html` are generated.
- A hex literal may appear in `tokens.json5` only under `palette_base` and `derived`.
- Signalred has no tint ladder. Signalred and Freegreen carry no syntax slot.
- WCAG 2.x AA is the hard requirement: text ≥ 4.5:1, non-text ≥ 3:1. APCA is reported, never gating.
- Distinctness threshold: OKLab distance ≥ 7 on the ×100 scale.
- Package name `@sepps-workshop/design-system`, version `0.1.0`, `"private": true` until publishing is set up.
- Commits: Conventional Commits with gitmoji, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Icon source stays outside the repo: `/home/vanlaarmi12/Git-Repos/temp/sepps-workshop-icon.png`.

## Review Focus

- A port edits nothing but imports `@sepps-workshop/design-system` and `@sepps-workshop/design-system/tools/build-tokens` → both resolve through `package.json` `exports`. (Task 2, step 7)
- Someone adds a `$palette.signalred.50` or misspelt reference to `tokens.json5` → the build stops with a message naming the reference, not a stack trace from deep inside. (Task 2 tests)
- Someone pastes a hex value straight into a role → gate 8 names the path. (Task 3 tests)
- Someone misspells a colour target in `shell_roles` (`"fuction"`) → the build names the role and the target. (Task 3 tests)
- Someone lightens `selection` back to a blue tint → gate 2 fails and says which slot on which overlay. (Task 3 tests)

---

### Task 1: Scaffold and colour maths

**Files:**

- Create: `package.json`, `.editorconfig`, `.gitignore`, `.prettierignore`
- Create: `tools/color.mjs`
- Create: `tools/color.test.mjs`

**Interfaces:**

- Produces, from `tools/color.mjs`:
  - `parseHex(hex: string): [number, number, number]` — throws `Bad hex color: <value>` unless `#rrggbb`
  - `toHex(rgb: number[]): string`
  - `mix(a: string, b: string, p: number): string` — `a` weighted `p`, sRGB
  - `alphaOver(fg: string, bg: string, alpha: number): string`
  - `tint(base: string, pct: number): string` — `mix(base, "#ffffff", pct / 100)`
  - `contrast(a: string, b: string): number` — WCAG 2.x ratio
  - `oklab(hex: string): [L, a, b]`
  - `deltaE(a: string, b: string): number` — OKLab Euclidean × 100
  - `hueAngle(hex: string): number` — OKLab hue in radians
  - `apca(text: string, bg: string): number` — signed Lc

- [ ] **Step 1: Write the config files**

`package.json`:

```json
{
  "name": "@sepps-workshop/design-system",
  "description": "Token foundation for the Sepp's Workshop themes. One medium-dark theme on sepp.med Darkblue, WCAG AA enforced by the build.",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "author": "sepp.med GmbH",
  "homepage": "https://github.com/sepps-workshop/sepps-workshop-design-system",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/sepps-workshop/sepps-workshop-design-system.git"
  },
  "type": "module",
  "main": "./dist/tokens.js",
  "exports": {
    ".": "./dist/tokens.js",
    "./tokens.json": "./tokens.json",
    "./css": "./colors.css",
    "./assets/*": "./assets/*",
    "./tools/build-tokens": "./tools/build-tokens.mjs"
  },
  "files": [
    "tokens.json5",
    "tokens.json",
    "dist/",
    "colors.css",
    "assets/",
    "tools/",
    "handoff/",
    "README.md"
  ],
  "scripts": {
    "build": "node tools/build-tokens.mjs && node tools/build-css.mjs && node tools/build-previews.mjs",
    "check": "node tools/build-tokens.mjs --check && node tools/build-css.mjs --check && node tools/build-previews.mjs --check",
    "test": "node --test tools/"
  },
  "engines": {
    "node": ">=18"
  }
}
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`.gitignore`:

```
node_modules/
.claude/settings.local.json
.superpowers/
```

`.prettierignore`:

```
# Generated — a formatter would make `npm run check` report drift.
tokens.json
dist/
colors.css
preview/
assets/
```

- [ ] **Step 2: Write the failing tests**

`tools/color.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseHex,
  toHex,
  mix,
  alphaOver,
  tint,
  contrast,
  deltaE,
  hueAngle,
  apca,
} from "./color.mjs";

test("parseHex reads #rrggbb", () => {
  assert.deepEqual(parseHex("#0d3174"), [13, 49, 116]);
});

test("parseHex rejects anything that is not #rrggbb", () => {
  for (const bad of ["0d3174", "#fff", "#0d3174ff", "#gggggg", ""]) {
    assert.throws(() => parseHex(bad), /Bad hex color/);
  }
});

test("toHex clamps and rounds", () => {
  assert.equal(toHex([-4, 127.5, 300]), "#0080ff");
});

test("mix weights the first colour", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#ffffff", "#000000", 0), "#000000");
  assert.equal(mix("#ffffff", "#000000", 1), "#ffffff");
});

test("tint reproduces the Canva ladders", () => {
  assert.equal(tint("#ec6608", 90), "#ee7521");
  assert.equal(tint("#0093d3", 90), "#199ed7");
  assert.equal(tint("#3aaa35", 90), "#4eb349");
  assert.equal(tint("#f59e33", 90), "#f6a847");
  assert.equal(tint("#0d3174", 100), "#0d3174");
});

test("alphaOver composites over an opaque background", () => {
  assert.equal(alphaOver("#1b1d1c", "#0d3174", 0.6), "#15253f");
});

test("contrast matches WCAG reference values", () => {
  assert.equal(Math.round(contrast("#ffffff", "#000000")), 21);
  assert.equal(contrast("#0d3174", "#0d3174"), 1);
  assert.equal(contrast("#fbba00", "#0d3174").toFixed(2), "7.10");
  assert.equal(contrast("#cd1719", "#0d3174").toFixed(2), "2.18");
});

test("contrast is symmetric", () => {
  assert.equal(contrast("#fbba00", "#0d3174"), contrast("#0d3174", "#fbba00"));
});

test("deltaE is zero for identical colours and grows with difference", () => {
  assert.equal(deltaE("#66bee5", "#66bee5"), 0);
  assert.ok(deltaE("#66bee5", "#80b4d4") < 7);
  assert.ok(deltaE("#fbba00", "#66bee5") > 20);
});

test("hueAngle keeps the derived reds on the Signalred hue", () => {
  const base = hueAngle("#cd1719");
  assert.ok(Math.abs(hueAngle("#ff897b") - base) < 0.03);
  assert.ok(Math.abs(hueAngle("#ffb4aa") - base) < 0.03);
});

test("apca matches the reference extremes", () => {
  assert.equal(apca("#ffffff", "#000000").toFixed(1), "-107.9");
  assert.equal(apca("#000000", "#ffffff").toFixed(1), "106.0");
  assert.equal(apca("#0d3174", "#0d3174"), 0);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./color.mjs`.

- [ ] **Step 4: Implement `tools/color.mjs`**

```js
/**
 * color.mjs — colour maths shared by the build tools and by ports.
 * Hex in, hex or number out. No dependencies.
 */

/** "#rrggbb" → [r, g, b], each 0..255. */
export function parseHex(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Bad hex color: ${hex}`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** [r, g, b] → "#rrggbb", clamped and rounded. */
export function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Mix in gamma-encoded sRGB: `a` weighted p, `b` weighted 1 − p. */
export function mix(a, b, p) {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex(x.map((v, i) => v * p + y[i] * (1 - p)));
}

/** Composite a translucent foreground over an opaque background. */
export function alphaOver(fg, bg, alpha) {
  return mix(fg, bg, alpha);
}

/** A brand tint: pct % of the base colour, the rest white. */
export function tint(base, pct) {
  return mix(base, "#ffffff", pct / 100);
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export function relLum(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrast(a, b) {
  const x = relLum(a);
  const y = relLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** sRGB hex → OKLab [L, a, b] (L in 0..1). */
export function oklab(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance: OKLab Euclidean × 100. About 2 is just noticeable. */
export function deltaE(a, b) {
  const x = oklab(a);
  const y = oklab(b);
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** OKLab hue angle in radians. */
export function hueAngle(hex) {
  const [, a, b] = oklab(hex);
  return Math.atan2(b, a);
}

/**
 * APCA lightness contrast (Lc), APCA-W3 0.0.98G-4g constants.
 * Negative for light text on a dark background. Report only — not a gate.
 */
export function apca(text, bg) {
  const y = (hex) => {
    const [r, g, b] = parseHex(hex).map((v) => (v / 255) ** 2.4);
    const lum = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return lum < 0.022 ? lum + (0.022 - lum) ** 1.414 : lum;
  };
  const yt = y(text);
  const yb = y(bg);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json .editorconfig .gitignore .prettierignore tools/color.mjs tools/color.test.mjs
git commit -m "✨ feat: add project scaffold and colour maths"
```

---

### Task 2: Token source, loader and emitted outputs

**Files:**

- Create: `tokens.json5`
- Create: `tools/build-tokens.mjs`
- Create: `tools/build-tokens.test.mjs`
- Generated: `tokens.json`, `dist/tokens.js`

**Interfaces:**

- Consumes: everything from `tools/color.mjs`.
- Produces, from `tools/build-tokens.mjs`:
  - re-exports of every `tools/color.mjs` function
  - `json5ToJson(src: string): string`
  - `parseTokens(src: string): object` — the raw tree, references unresolved
  - `resolveTokens(raw: object): object` — ladders generated, `$` references resolved, each overlay given a composited `hex`
  - `loadTokens(path?: string): Promise<object>` — read + parse + resolve
  - `resolveTarget(tokens: object, target: string): string` — a colour target (`"keyword"`, `"fg_muted"`, `"accent"`, `"semantic.danger"`, `"overlay.selection"`) → hex; throws `Unknown colour target: <target>`
- Resolved token shape used by later tasks: `palette.<name>.<step>`, `surface.*`, `text.*`, `border.*`, `accent`, `accent_on`, `semantic.*`, `semantic_fill.<role>.{fill,text}`, `syntax.*`, `syntax_tokens.{core,core_style,extended}`, `ansi.*`, `overlay.<name>.{color,alpha,hex,border?}`, `shell_roles.*`, `prompt_roles.*`, `typography.mono.*`.

- [ ] **Step 1: Write `tokens.json5`**

```json5
// ════════════════════════════════════════════════════════════════════
// Sepp's Workshop — Foundation Tokens
// ────────────────────────────────────────────────────────────────────
// The single source of truth. Every port (VS Code, Windows Terminal,
// PowerShell, fish, Starship) reads its values from the files generated
// from this one. If a port needs a value that is not here, that is a
// gap in the foundation: fix it here.
//
// Format: JSON5 subset (comments, unquoted keys, trailing commas).
// Strings starting with "$" are references: "$palette.sunset.100".
// Run `npm run build` after every edit.
// ════════════════════════════════════════════════════════════════════
{
  meta: {
    name: "Sepp's Workshop",
    version: "0.1.0",
    description: "One medium-dark theme on sepp.med Darkblue. WCAG AA enforced by the build.",
    career_url: "https://www.seppmed.com/career/",
  },

  // ── 1. BRAND COLOURS ────────────────────────────────────────────
  // Authoritative values from the sepp.med brand kit. Hex literals are
  // allowed here and under `derived`, nowhere else (gate 8).
  palette_base: {
    darkblue: "#0d3174",
    sunset: "#fbba00",
    shadowgrey: "#b2b2b2",
    middleblue: "#0069a9",
    pumpelorange: "#ec6608",
    windblue: "#0093d3",
    lightorange: "#f59e33",
    darkblack: "#1b1d1c",
    signalred: "#cd1719", // signal only — no ladder, never text on dark
    freegreen: "#3aaa35", // signal only — no syntax slot
    white: "#ffffff", // the brand's unlisted "non-colour"; text on fills only
  },

  // The build generates palette.<name>.<step> for every step: the base
  // colour mixed towards white, as in the brand kit. Signalred has no
  // tints by brand decision (they drift into pink).
  ladder: {
    steps: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
    exclude: ["signalred", "white"],
  },

  // ── 2. DERIVED LITERALS ─────────────────────────────────────────
  // The only values that are neither a brand colour nor a ladder step.
  derived: {
    // The ladder only goes lighter. Surfaces below the canvas mix
    // Darkblue 80 % with Darkblack. The build verifies the recipe.
    bg_sunk: "#102d62",
    // Signalred reaches 2.18:1 on Darkblue. These keep its OKLCH hue,
    // raise lightness to 5.34:1 / 7.23:1, and hold chroma at the sRGB
    // maximum. Foreground on dark surfaces only; fills use Signalred.
    signalred_on_dark: "#ff897b",
    signalred_on_dark_bright: "#ffb4aa",
  },

  // ── 3. SURFACES, TEXT, BORDERS ──────────────────────────────────
  surface: {
    bg: "$palette.darkblue.100", // editor canvas
    bg_sunk: "$derived.bg_sunk", // sidebar, activity bar, status bar, inactive tabs
    bg_soft: "$palette.darkblue.90", // hover, inputs — carries fg and fg_muted only
    bg_overlay: "$derived.bg_sunk", // menus, hover/suggest widgets, quick input
    bg_terminal: "$palette.darkblue.100", // = bg: a standalone terminal should be Darkblue
  },
  text: {
    fg: "$palette.darkblue.10",
    fg_muted: "$palette.darkblue.30",
    fg_subtle: "$palette.darkblue.40",
    fg_disabled: "$palette.darkblue.60", // exempt from the text gate
  },
  border: {
    subtle: "$palette.darkblue.90",
    default: "$palette.darkblue.80",
    control: "$palette.darkblue.50", // ≥ 3:1 on every surface
  },
  accent: "$palette.sunset.100", // cursor, focus ring, active tab, primary button
  accent_on: "$palette.darkblue.100", // text on the accent

  // ── 4. SEMANTIC ROLES ───────────────────────────────────────────
  // Warning is Lightorange: yellow is the accent, and Pumpelorange is
  // too close to the derived red. Success sits two steps lighter than
  // contrast needs so red and green differ in lightness too.
  semantic: {
    danger: "$derived.signalred_on_dark",
    success: "$palette.freegreen.50",
    warning: "$palette.lightorange.100",
    info: "$palette.windblue.60",
  },
  semantic_fill: {
    danger: { fill: "$palette.signalred.100", text: "$palette.white.100" },
    success: { fill: "$palette.freegreen.100", text: "$palette.darkblack.100" },
    warning: {
      fill: "$palette.lightorange.100",
      text: "$palette.darkblack.100",
    },
  },

  // ── 5. SYNTAX ───────────────────────────────────────────────────
  // Three hues (yellow, orange, cyan-blue), two lightness steps each,
  // plus the blue-grey text ramp. Warm = data, cool = behaviour.
  syntax: {
    comment: "$text.fg_subtle",
    keyword: "$palette.sunset.100",
    string: "$palette.pumpelorange.40",
    number: "$palette.pumpelorange.70",
    function: "$palette.windblue.60",
    parameter: "$palette.windblue.30",
    type: "$palette.sunset.40",
    constant: "$palette.pumpelorange.70",
    tag: "$palette.sunset.100",
    attr: "$palette.windblue.30",
    regex: "$palette.pumpelorange.70",
    punct: "$text.fg_muted",
  },

  // Colour targets used from here on are names, not "$" references:
  //   a core slot (keyword, string, …) · fg, fg_muted, fg_subtle, fg_disabled
  //   · accent · semantic.<role> · overlay.<name>
  // Ports resolve them with resolveTarget() from tools/build-tokens.mjs.
  syntax_tokens: {
    core: [
      "comment",
      "keyword",
      "string",
      "number",
      "function",
      "parameter",
      "type",
      "constant",
      "tag",
      "attr",
      "regex",
      "punct",
    ],
    core_style: {
      comment: ["italic"],
      parameter: ["italic"],
      attr: ["italic"],
    },
    extended: {
      variable: "fg",
      property: "fg",
      operator: "fg_muted", // not the keyword colour: Sunset on every "=" dilutes it
      decorator: { color: "function", style: ["italic"] },
      builtin: { color: "function", style: ["italic"] }, // "not yours"
      namespace: "type",
      macro: "function",
      lifetime: "constant",
      heading: { color: "keyword", style: ["bold"] },
      link: "function",
      selector: "tag",
      unit: "number",
      hex: "string",
      shebang: "comment",
      lang_var: { color: "keyword", style: ["italic"] }, // this / self / super
      emphasis: { style: ["italic"] },
      strong: { style: ["bold"] },
      invalid: { color: "semantic.danger", style: ["italic", "underline"] },
      invalid_deprecated: { color: "fg", style: ["italic", "underline"] },
      doc_keyword: "keyword",
      doc_type: { color: "type", style: ["italic"] },
      doc_param: { color: "parameter", style: ["italic"] },
      event: "function",
      label: { color: "fg", style: ["italic"] },
    },
  },

  // TextMate scopes per slot, most specific first. A rule must never
  // end in a meta.* scope (the build checks this).
  scope_recommendations: {
    comment: ["comment", "comment.line", "comment.block"],
    keyword: [
      "keyword.control",
      "keyword.other",
      "storage.type",
      "storage.modifier",
      "constant.language",
    ],
    string: ["string", "string.quoted", "string.template"],
    number: ["constant.numeric"],
    function: ["entity.name.function", "support.function"],
    parameter: ["variable.parameter"],
    type: [
      "entity.name.type",
      "entity.name.class",
      "support.class",
      "support.type",
    ],
    constant: ["constant.other"],
    tag: ["entity.name.tag"],
    attr: ["entity.other.attribute-name"],
    regex: ["string.regexp"],
    punct: ["punctuation"],
    variable: ["variable.other.readwrite", "variable.other"],
    property: [
      "variable.other.property",
      "variable.other.member",
      "support.type.property-name",
    ],
    operator: ["keyword.operator"],
    decorator: [
      "entity.name.function.decorator",
      "meta.decorator entity.name.function",
      "punctuation.decorator",
    ],
    builtin: [
      "support.function.builtin",
      "support.class.builtin",
      "support.variable.builtin",
    ],
    namespace: ["entity.name.namespace", "entity.name.module"],
    macro: ["entity.name.function.macro", "support.function.macro"],
    lifetime: ["storage.modifier.lifetime.rust", "entity.name.lifetime.rust"],
    heading: [
      "markup.heading",
      "entity.name.section",
      "punctuation.definition.heading",
    ],
    link: ["markup.underline.link", "string.other.link"],
    selector: [
      "entity.other.pseudo-class",
      "entity.other.pseudo-element",
      "meta.selector entity.other.attribute-name",
    ],
    unit: ["keyword.other.unit"],
    hex: ["constant.other.color", "constant.other.color.rgb-value.css"],
    shebang: ["comment.line.shebang"],
    lang_var: [
      "variable.language.this",
      "variable.language.self",
      "variable.language.super",
    ],
    emphasis: ["markup.italic"],
    strong: ["markup.bold"],
    invalid: ["invalid.illegal"],
    invalid_deprecated: ["invalid.deprecated"],
    doc_keyword: ["comment.block.documentation keyword"],
    doc_type: ["comment.block.documentation entity.name.type"],
    doc_param: ["comment.block.documentation variable"],
    event: ["variable.other.event", "support.type.event"],
    label: ["entity.name.label", "variable.label"],
    // In JS/TS nearly every declaration is `const`. Colouring them all
    // as constants is noise; the LSP `variable.readonly` token does it.
    fg_fallthrough_jsts: [
      "variable.other.constant.js",
      "variable.other.constant.ts",
      "variable.other.constant.tsx",
    ],
  },

  // LSP semantic tokens. Ports set "semanticHighlighting": true.
  semantic_token_recommendations: {
    types: {
      namespace: "type",
      class: "type",
      enum: "type",
      interface: "type",
      struct: "type",
      typeParameter: "parameter",
      type: "type",
      parameter: { color: "parameter", style: ["italic"] },
      variable: "fg",
      property: "fg",
      enumMember: "constant",
      decorator: { color: "function", style: ["italic"] },
      event: "function",
      function: "function",
      method: "function",
      macro: "function",
      label: { color: "fg", style: ["italic"] },
      comment: { color: "comment", style: ["italic"] },
      string: "string",
      keyword: "keyword",
      number: "number",
      regexp: "regex",
      operator: "fg_muted",
    },
    // "none" = no change to the base type.
    modifiers: {
      declaration: "none",
      definition: "none",
      readonly: { color: "constant" },
      static: "none",
      deprecated: { style: ["italic", "underline"] },
      abstract: { style: ["italic"] },
      async: "none",
      modification: "none",
      documentation: { color: "comment" },
      defaultLibrary: { style: ["italic"] },
    },
  },

  // The same role takes the same colour wherever it appears: squiggle,
  // gutter, overview ruler, status bar, file tree.
  workbench_color_roles: {
    signals: {
      error: "semantic.danger",
      warning: "semantic.warning",
      info: "semantic.info",
      hint: "fg_muted",
      success: "semantic.success",
    },
    git: {
      added: "semantic.success",
      modified: "semantic.info",
      deleted: "semantic.danger",
      untracked: "semantic.success",
      ignored: "fg_disabled",
      conflicting: "semantic.warning",
    },
    // Starts neutral; skips the keyword colour.
    bracket_pairs: ["fg", "function", "string", "type", "parameter", "number"],
    bracket_unexpected: "semantic.danger",
  },

  // ── 6. ANSI ─────────────────────────────────────────────────────
  // The brand has no magenta: the slot takes Lightorange. Neutrals are
  // true greys (Shadowgrey, Darkblack tints) to stay apart from blue
  // and cyan.
  ansi: {
    black: "$derived.bg_sunk", // reverse-video anchor; exempt from the contrast gate
    red: "$derived.signalred_on_dark",
    green: "$palette.freegreen.50",
    yellow: "$palette.sunset.100",
    blue: "$palette.middleblue.60",
    magenta: "$palette.lightorange.100",
    cyan: "$palette.windblue.50",
    white: "$palette.shadowgrey.60",
    bright_black: "$palette.darkblack.40",
    bright_red: "$derived.signalred_on_dark_bright",
    bright_green: "$palette.freegreen.30",
    bright_yellow: "$palette.sunset.40",
    bright_blue: "$palette.middleblue.40",
    bright_magenta: "$palette.lightorange.60",
    bright_cyan: "$palette.windblue.30",
    bright_white: "$palette.darkblue.10",
  },

  // ── 7. OVERLAYS ─────────────────────────────────────────────────
  // { color, alpha, border? }, composited over surface.bg. The build
  // adds `hex`. Overlays DARKEN: on a medium-dark canvas a lighter
  // selection takes saturated colours below 4.5:1, a darker one adds
  // contrast. Hued highlights stay faint and get a border.
  overlay: {
    selection: { color: "$palette.darkblack.100", alpha: 0.6 },
    selection_inactive: { color: "$palette.darkblack.100", alpha: 0.4 },
    line_highlight: { color: "$palette.darkblack.100", alpha: 0.3 },
    find_match: {
      color: "$palette.pumpelorange.100",
      alpha: 0.15,
      border: "$palette.pumpelorange.70",
    },
    find_match_other: {
      color: "$palette.pumpelorange.100",
      alpha: 0.08,
      border: "$palette.darkblue.50",
    },
    word_highlight: { color: "$palette.sunset.100", alpha: 0.1 },
    word_highlight_strong: {
      color: "$palette.sunset.100",
      alpha: 0.1,
      border: "$palette.sunset.100",
    },
    selected_item: { color: "$palette.sunset.100", alpha: 0.18 }, // list rows: fg / fg_muted only
    diff_inserted_line: { color: "$palette.freegreen.100", alpha: 0.12 },
    diff_inserted_text: { color: "$palette.freegreen.100", alpha: 0.25 }, // fg / fg_muted only
    diff_removed_line: { color: "$palette.signalred.100", alpha: 0.14 },
    diff_removed_text: { color: "$palette.signalred.100", alpha: 0.35 }, // fg / fg_muted only
  },

  // ── 8. SHELL ROLES ──────────────────────────────────────────────
  // One answer for fish and PowerShell. `fish` / `psreadline` name the
  // variables and keys each role feeds.
  shell_roles: {
    command: {
      color: "function",
      fish: ["fish_color_command"],
      psreadline: ["Command"],
    },
    keyword: {
      color: "keyword",
      fish: ["fish_color_keyword"],
      psreadline: ["Keyword"],
    },
    option: {
      color: "attr",
      fish: ["fish_color_option"],
      psreadline: ["Parameter"],
    },
    argument: {
      color: "fg",
      fish: ["fish_color_normal", "fish_color_param"],
      psreadline: ["Default"],
    },
    string: {
      color: "string",
      fish: ["fish_color_quote"],
      psreadline: ["String"],
    },
    number: { color: "number", psreadline: ["Number"] },
    variable: { color: "type", psreadline: ["Variable"] },
    type: { color: "type", psreadline: ["Type"] },
    member: { color: "fg", psreadline: ["Member"] },
    operator: {
      color: "fg_muted",
      fish: ["fish_color_operator", "fish_color_end"],
      psreadline: ["Operator"],
    },
    redirection: { color: "fg_muted", fish: ["fish_color_redirection"] },
    escape: { color: "constant", fish: ["fish_color_escape"] },
    comment: {
      color: "comment",
      style: ["italic"],
      fish: ["fish_color_comment"],
      psreadline: ["Comment"],
    },
    autosuggestion: {
      color: "fg_subtle",
      fish: ["fish_color_autosuggestion"],
      psreadline: ["InlinePrediction", "ContinuationPrompt"],
    },
    error: {
      color: "semantic.danger",
      fish: ["fish_color_error", "fish_color_status"],
      psreadline: ["Error"],
    },
    emphasis: { color: "accent", psreadline: ["Emphasis"] },
    valid_path: { style: ["underline"], fish: ["fish_color_valid_path"] },
    selection: {
      color: "overlay.selection",
      fish: ["fish_color_selection"],
      psreadline: ["Selection"],
    },
    search_match: {
      color: "overlay.find_match",
      fish: ["fish_color_search_match"],
    },
    pager_selected: {
      color: "overlay.selected_item",
      fish: ["fish_pager_color_selected_background"],
      psreadline: ["ListPredictionSelected"],
    },
    pager_prefix: { color: "accent", fish: ["fish_pager_color_prefix"] },
    pager_completion: {
      color: "fg",
      fish: ["fish_pager_color_completion"],
      psreadline: ["ListPrediction"],
    },
    pager_description: {
      color: "fg_subtle",
      fish: ["fish_pager_color_description", "fish_pager_color_progress"],
    },
    cwd: { color: "accent", fish: ["fish_color_cwd"] },
    cwd_root: { color: "semantic.danger", fish: ["fish_color_cwd_root"] },
    user: { color: "function", fish: ["fish_color_user"] },
    host: { color: "fg_muted", fish: ["fish_color_host"] },
    host_remote: {
      color: "semantic.warning",
      fish: ["fish_color_host_remote"],
    },
  },

  // ── 9. PROMPT ROLES ─────────────────────────────────────────────
  // For Starship. Language modules stay neutral: the brand has too few
  // hues to give each language its own, and the symbol identifies it.
  prompt_roles: {
    directory: { color: "accent", style: ["bold"] },
    git_branch: { color: "semantic.info" },
    git_status: {
      added: "semantic.success",
      untracked: "semantic.success",
      modified: "semantic.info",
      renamed: "semantic.info",
      deleted: "semantic.danger",
      conflicted: "semantic.warning",
      staged: "semantic.warning",
      ahead: "fg_muted",
      behind: "fg_muted",
      diverged: "fg_muted",
      stashed: "fg_muted",
    },
    character_success: { color: "semantic.success" },
    character_error: { color: "semantic.danger" },
    duration: { color: "fg_muted" },
    language_module: { color: "fg_muted" },
  },

  // ── 10. TYPOGRAPHY ──────────────────────────────────────────────
  // A recommendation. Themes cannot ship fonts and this repo has none.
  typography: {
    mono: {
      primary: "JetBrains Mono",
      nerd_font: "JetBrainsMono Nerd Font",
      stack: '"JetBrains Mono", "JetBrainsMono Nerd Font", "Cascadia Code", Consolas, ui-monospace, monospace',
      license: "OFL-1.1",
      source: "https://www.jetbrains.com/lp/mono/",
      nerd_font_source: "https://www.nerdfonts.com/font-downloads",
    },
  },
}
```

- [ ] **Step 2: Write the failing tests**

`tools/build-tokens.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json5ToJson,
  parseTokens,
  resolveTokens,
  loadTokens,
  resolveTarget,
} from "./build-tokens.mjs";

const SRC = await readFile(new URL("../tokens.json5", import.meta.url), "utf8");
export const fresh = () => parseTokens(SRC);

test("json5ToJson strips comments, quotes keys, drops trailing commas", () => {
  const out = json5ToJson(`{ // c\n a: 'x', /* b */ 10: "y, z: w", }`);
  assert.deepEqual(JSON.parse(out), { a: "x", 10: "y, z: w" });
});

test("ladders are generated for every colour except the excluded ones", () => {
  const t = resolveTokens(fresh());
  assert.equal(t.palette.darkblue[100], "#0d3174");
  assert.equal(t.palette.pumpelorange[90], "#ee7521");
  assert.equal(Object.keys(t.palette.windblue).length, 10);
  assert.deepEqual(Object.keys(t.palette.signalred), ["100"]);
});

test("references resolve, including chained ones", () => {
  const t = resolveTokens(fresh());
  assert.equal(t.surface.bg, "#0d3174");
  assert.equal(t.syntax.comment, t.text.fg_subtle);
  assert.equal(t.semantic_fill.danger.text, "#ffffff");
  assert.equal(t.surface.bg_overlay, t.surface.bg_sunk);
  assert.equal(t.ansi.black, "#102d62");
});

test("an unknown reference names itself and where it was used", () => {
  const raw = fresh();
  raw.syntax.keyword = "$palette.signalred.50";
  assert.throws(
    () => resolveTokens(raw),
    /Unknown reference \$palette\.signalred\.50 at syntax\.keyword/,
  );
});

test("a reference cycle is reported, not a stack overflow", () => {
  const raw = fresh();
  raw.text.fg = "$text.fg_muted";
  raw.text.fg_muted = "$text.fg";
  assert.throws(() => resolveTokens(raw), /Circular reference/);
});

test("overlays get a composited hex", () => {
  const t = resolveTokens(fresh());
  assert.equal(t.overlay.selection.hex, "#15253f");
  assert.equal(t.overlay.find_match.border, t.palette.pumpelorange[70]);
});

test("resolveTarget understands every kind of target", () => {
  const t = resolveTokens(fresh());
  assert.equal(resolveTarget(t, "keyword"), "#fbba00");
  assert.equal(resolveTarget(t, "fg_muted"), t.text.fg_muted);
  assert.equal(resolveTarget(t, "accent"), "#fbba00");
  assert.equal(resolveTarget(t, "semantic.danger"), "#ff897b");
  assert.equal(resolveTarget(t, "overlay.selection"), "#15253f");
  assert.throws(
    () => resolveTarget(t, "fuction"),
    /Unknown colour target: fuction/,
  );
});

test("loadTokens reads the repository's tokens.json5", async () => {
  const t = await loadTokens();
  assert.equal(t.meta.name, "Sepp's Workshop");
});

test("resolving twice gives identical output", () => {
  assert.equal(
    JSON.stringify(resolveTokens(fresh())),
    JSON.stringify(resolveTokens(fresh())),
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./build-tokens.mjs`.

- [ ] **Step 4: Implement the loader half of `tools/build-tokens.mjs`**

```js
#!/usr/bin/env node
/**
 * build-tokens.mjs
 *
 * CLI:
 *   node tools/build-tokens.mjs           emit tokens.json + dist/tokens.js, run the gates
 *   node tools/build-tokens.mjs --check   also fail if the emitted files are out of date
 *
 * Library (for ports):
 *   import { loadTokens, resolveTarget, alphaOver, contrast }
 *     from "@sepps-workshop/design-system/tools/build-tokens";
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, relative } from "node:path";
import { tint, alphaOver } from "./color.mjs";

export * from "./color.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ── JSON5 subset → JSON ─────────────────────────────────────────── */

/** Comments, single-quoted strings, unquoted keys, trailing commas. */
export function json5ToJson(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  // Strings are lifted out so the key-quoting pass cannot touch them.
  const strings = [];
  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);
    if (c2 === "//") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c2 === "/*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated block comment");
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let s = "";
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") {
          s += src[i] + src[i + 1];
          i += 2;
          continue;
        }
        s += src[i] === '"' ? '\\"' : src[i];
        i++;
      }
      if (i >= n) throw new Error("Unterminated string");
      i++;
      strings.push(`"${s}"`);
      out += `\u0000${strings.length - 1}\u0000`;
      continue;
    }
    out += c;
    i++;
  }
  out = out.replace(/,(\s*[}\]])/g, "$1");
  out = out.replace(
    /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)\s*:/g,
    '$1"$2":',
  );
  return out.replace(/\u0000(\d+)\u0000/g, (_, k) => strings[Number(k)]);
}

/** tokens.json5 source → raw tree, references unresolved. */
export function parseTokens(src) {
  return JSON.parse(json5ToJson(src));
}

/* ── Resolution ──────────────────────────────────────────────────── */

function lookup(root, ref, at, seen) {
  if (seen.includes(ref)) {
    throw new Error(
      `Circular reference ${[...seen, ref].join(" → ")} at ${at}`,
    );
  }
  let cur = root;
  for (const part of ref.slice(1).split(".")) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) {
      throw new Error(`Unknown reference ${ref} at ${at}`);
    }
    cur = cur[part];
  }
  if (typeof cur === "string" && cur.startsWith("$")) {
    return lookup(root, cur, at, [...seen, ref]);
  }
  return cur;
}

function resolveRefs(node, root, at) {
  if (typeof node === "string") {
    return node.startsWith("$") ? lookup(root, node, at, []) : node;
  }
  if (Array.isArray(node)) {
    return node.map((v, i) => resolveRefs(v, root, `${at}[${i}]`));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = resolveRefs(v, root, at ? `${at}.${k}` : k);
    }
    return out;
  }
  return node;
}

/**
 * Raw tree → resolved tokens:
 *   1. palette.<name>.<step> generated from palette_base + ladder
 *   2. every "$a.b.c" reference replaced by its value
 *   3. every overlay given `hex`, composited over surface.bg
 * Does not mutate `raw`.
 */
export function resolveTokens(raw) {
  const palette = {};
  for (const [name, base] of Object.entries(raw.palette_base)) {
    const steps = raw.ladder.exclude.includes(name) ? [100] : raw.ladder.steps;
    palette[name] = Object.fromEntries(steps.map((s) => [s, tint(base, s)]));
  }
  const { meta, palette_base, ladder, derived, ...rest } = raw;
  const withPalette = { meta, palette_base, ladder, palette, derived, ...rest };
  const tokens = resolveRefs(withPalette, withPalette, "");
  for (const o of Object.values(tokens.overlay)) {
    o.hex = alphaOver(o.color, tokens.surface.bg, o.alpha);
  }
  return tokens;
}

/** Read + parse + resolve. Defaults to this package's tokens.json5. */
export async function loadTokens(path = join(ROOT, "tokens.json5")) {
  return resolveTokens(parseTokens(await readFile(path, "utf8")));
}

/**
 * A colour target → hex. Targets are the names used in
 * syntax_tokens.extended, shell_roles, prompt_roles and the
 * recommendation maps.
 */
export function resolveTarget(tokens, target) {
  if (target === "accent") return tokens.accent;
  if (Object.hasOwn(tokens.syntax, target)) return tokens.syntax[target];
  if (Object.hasOwn(tokens.text, target)) return tokens.text[target];
  const [group, key] = String(target).split(".");
  if (group === "semantic" && Object.hasOwn(tokens.semantic, key ?? "")) {
    return tokens.semantic[key];
  }
  if (group === "overlay" && Object.hasOwn(tokens.overlay, key ?? "")) {
    return tokens.overlay[key].hex;
  }
  throw new Error(`Unknown colour target: ${target}`);
}

/* ── Emit ────────────────────────────────────────────────────────── */

function renderOutputs(tokens) {
  const json = JSON.stringify(tokens, null, 2) + "\n";
  return [
    [join(ROOT, "tokens.json"), json],
    [
      join(ROOT, "dist", "tokens.js"),
      `// AUTO-GENERATED from tokens.json5 — do not edit.\nexport default ${json.trimEnd()};\n`,
    ],
  ];
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const src = await readFile(join(ROOT, "tokens.json5"), "utf8");
  const raw = parseTokens(src);
  const tokens = resolveTokens(raw);

  const stale = [];
  for (const [path, content] of renderOutputs(tokens)) {
    if (checkMode) {
      const existing = await readFile(path, "utf8").catch(() => "");
      if (existing !== content) stale.push(relative(ROOT, path));
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
      console.log(`✓ ${relative(ROOT, path)}`);
    }
  }
  if (stale.length) {
    console.error(`✗ ${stale.join(", ")} out of date — run \`npm run build\`.`);
    process.exit(1);
  }
  if (checkMode)
    console.log("✓ tokens.json and dist/tokens.js match tokens.json5");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 20 tests (11 from Task 1, 9 new).

- [ ] **Step 6: Emit the outputs and check determinism**

Run: `node tools/build-tokens.mjs && node tools/build-tokens.mjs --check`
Expected:

```
✓ tokens.json
✓ dist/tokens.js
✓ tokens.json and dist/tokens.js match tokens.json5
```

- [ ] **Step 7: Verify the package exports resolve the way a port imports them**

Run:

```bash
node --input-type=module -e '
import tokens from "@sepps-workshop/design-system";
import { resolveTarget, contrast } from "@sepps-workshop/design-system/tools/build-tokens";
console.log(tokens.meta.name, resolveTarget(tokens, "keyword"), contrast(tokens.accent, tokens.surface.bg).toFixed(2));
'
```

Expected: `Sepp's Workshop #fbba00 7.10` (Node resolves a package's own name through its `exports`).

- [ ] **Step 8: Commit**

```bash
git add tokens.json5 tokens.json dist/tokens.js tools/build-tokens.mjs tools/build-tokens.test.mjs
git commit -m "✨ feat: add token source, loader and emitted outputs"
```

---

### Task 3: Build gates and contrast report

**Files:**

- Modify: `tools/build-tokens.mjs` (add `check`, `contrastReport`; call both from `main`)
- Create: `tools/gates.test.mjs`

**Interfaces:**

- Consumes: `parseTokens`, `resolveTokens`, `resolveTarget`, and `contrast`, `deltaE`, `oklab`, `hueAngle`, `mix`, `apca` from Tasks 1–2.
- Produces, from `tools/build-tokens.mjs`:
  - `check(tokens: object, raw: object): string[]` — one message per gate failure; empty when everything passes
  - `contrastReport(tokens: object): { label: string, fg: string, on: string, bg: string, ratio: number, lc: number }[]` — every text pair the gates look at, for the console and for `preview/04-contrast.html`
  - `CODE_OVERLAYS: string[]`, `LABEL_OVERLAYS: string[]` — overlay names by what text they carry

- [ ] **Step 1: Write the failing tests**

`tools/gates.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseTokens,
  resolveTokens,
  check,
  contrastReport,
} from "./build-tokens.mjs";

const SRC = await readFile(new URL("../tokens.json5", import.meta.url), "utf8");

/** Apply `edit` to a fresh raw tree and return the gate failures. */
function failuresAfter(edit) {
  const raw = parseTokens(SRC);
  edit(raw);
  return check(resolveTokens(raw), raw);
}
const assertFails = (edit, pattern) => {
  const failures = failuresAfter(edit);
  assert.ok(
    failures.some((f) => pattern.test(f)),
    `expected a failure matching ${pattern}, got:\n${failures.join("\n") || "(none)"}`,
  );
};

test("the shipped tokens pass every gate", () => {
  assert.deepEqual(
    failuresAfter(() => {}),
    [],
  );
});

test("gate 1: a syntax slot below 4.5:1 on the canvas fails", () => {
  assertFails((r) => {
    r.syntax.function = "$palette.windblue.100";
  }, /syntax\.function .* on surface\.bg .*3\.58:1/);
});

test("gate 1: fg_muted must stay readable on bg_soft", () => {
  assertFails((r) => {
    r.text.fg_muted = "$palette.darkblue.50";
  }, /text\.fg_muted .* on surface\.bg_soft/);
});

test("gate 2: a lightening selection fails and names slot and overlay", () => {
  assertFails((r) => {
    r.overlay.selection = { color: "$palette.windblue.100", alpha: 0.3 };
  }, /syntax\.number .* on overlay\.selection/);
});

test("gate 3: an ANSI colour below 4.5:1 on the terminal fails", () => {
  assertFails((r) => {
    r.ansi.blue = "$palette.middleblue.100";
  }, /ansi\.blue .* on surface\.bg_terminal/);
});

test("gate 3: ansi.black is exempt", () => {
  assert.ok(!failuresAfter(() => {}).some((f) => /ansi\.black /.test(f)));
});

test("gate 4: a control border under 3:1 fails", () => {
  assertFails((r) => {
    r.border.control = "$palette.darkblue.70";
  }, /border\.control .*needs 3:1/);
});

test("gate 4: an overlay border under 3:1 on its own fill fails", () => {
  assertFails((r) => {
    r.overlay.find_match.border = "$palette.darkblue.90";
  }, /overlay\.find_match\.border/);
});

test("gate 5: unreadable text on a semantic fill fails", () => {
  assertFails((r) => {
    r.semantic_fill.warning.text = "$palette.sunset.100";
  }, /semantic_fill\.warning\.text/);
});

test("gate 6: two slots that must differ but look alike fail", () => {
  assertFails((r) => {
    r.syntax.type = "$palette.darkblue.20";
  }, /syntax\.type .* syntax\.fg|text\.fg .* are too alike/);
});

test("gate 6: ANSI blue and cyan must stay apart", () => {
  assertFails((r) => {
    r.ansi.cyan = "$palette.middleblue.50";
  }, /ansi\.blue .* ansi\.cyan .* too alike/);
});

test("gate 7: warning must not look like the accent", () => {
  assertFails((r) => {
    r.semantic.warning = "$palette.sunset.90";
  }, /accent .* semantic\.warning .* too alike/);
});

test("gate 7: danger and success must differ in lightness", () => {
  assertFails((r) => {
    r.semantic.success = "$palette.freegreen.70";
  }, /lightness/);
});

test("gate 8: a hex pasted into a role is named by path", () => {
  assertFails((r) => {
    r.syntax.keyword = "#ffcc00";
  }, /syntax\.keyword .*hex literal/);
});

test("gate 8: a ladder for Signalred is refused", () => {
  assertFails((r) => {
    r.ladder.exclude = [];
  }, /signalred must not have a ladder/);
});

test("gate 8: bg_sunk must follow its recipe", () => {
  assertFails((r) => {
    r.derived.bg_sunk = "#0a2550";
  }, /derived\.bg_sunk .* mix\(darkblue, darkblack, 0\.8\)/);
});

test("gate 8: the derived reds must keep the Signalred hue", () => {
  assertFails((r) => {
    r.derived.signalred_on_dark = "#ff89c0";
  }, /derived\.signalred_on_dark .* hue/);
});

test("gate 9: selection must be visible against the canvas", () => {
  assertFails((r) => {
    r.overlay.selection.alpha = 0.1;
  }, /overlay\.selection .* surface\.bg .* too alike/);
});

test("targets: a misspelt colour target names the role", () => {
  assertFails((r) => {
    r.shell_roles.command.color = "fuction";
  }, /shell_roles\.command.*Unknown colour target: fuction/);
});

test("targets: a core slot missing from syntax is reported", () => {
  assertFails((r) => {
    r.syntax_tokens.core.push("lifetime_x");
  }, /syntax_tokens\.core lists "lifetime_x"/);
});

test("scopes: a rule ending in a meta scope is refused", () => {
  assertFails((r) => {
    r.scope_recommendations.function.push("meta.function-call");
  }, /scope_recommendations\.function .*meta\./);
});

test("the report covers code on every code surface and overlay", () => {
  const raw = parseTokens(SRC);
  const rows = contrastReport(resolveTokens(raw));
  const on = new Set(rows.map((r) => r.on));
  for (const name of [
    "surface.bg",
    "surface.bg_sunk",
    "overlay.selection",
    "overlay.find_match",
  ]) {
    assert.ok(on.has(name), `report is missing ${name}`);
  }
  assert.ok(
    rows.every((r) => r.ratio >= 4.5),
    "every reported text pair clears AA",
  );
  const body = rows.find((r) => r.label === "text.fg" && r.on === "surface.bg");
  assert.ok(Math.abs(body.lc) >= 75, "body text reaches APCA Lc 75");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `check` and `contrastReport` are not exported.

- [ ] **Step 3: Implement the gates**

In `tools/build-tokens.mjs`, change the colour import to:

```js
import {
  tint,
  alphaOver,
  mix,
  contrast,
  deltaE,
  oklab,
  hueAngle,
  apca,
} from "./color.mjs";
```

Insert this section between `resolveTarget` and the `Emit` section:

```js
/* ── Gates ───────────────────────────────────────────────────────── */

const AA = 4.5;
const NON_TEXT = 3;
const DISTINCT = 7;
const LIGHTNESS_GAP = 5;
const HUE_TOLERANCE = 0.03; // radians

const CODE_SURFACES = ["bg", "bg_sunk", "bg_overlay"];
const CONTROL_SURFACES = ["bg", "bg_sunk", "bg_soft", "bg_overlay"];
/** Overlays that sit behind whole lines of code. */
export const CODE_OVERLAYS = [
  "selection",
  "selection_inactive",
  "line_highlight",
  "find_match",
  "find_match_other",
  "word_highlight",
  "word_highlight_strong",
  "diff_inserted_line",
  "diff_removed_line",
];
/** Overlays that sit behind list rows and inline spans: fg / fg_muted only. */
export const LABEL_OVERLAYS = [
  "selected_item",
  "diff_inserted_text",
  "diff_removed_text",
];

/** Pairs that must not look alike. Names are colour targets. */
const DISTINCT_PAIRS = [
  ["function", "fg"],
  ["function", "tag"],
  ["function", "parameter"],
  ["function", "comment"],
  ["type", "fg"],
  ["type", "keyword"],
  ["type", "string"],
  ["type", "attr"],
  ["string", "number"],
  ["string", "fg"],
  ["parameter", "fg"],
  ["comment", "fg"],
  ["punct", "fg"],
];
const ANSI_SLOTS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];
const ANSI_EXEMPT = new Set(["black"]);

/** Keys inside role maps that hold metadata, not colour targets. */
const NOT_A_TARGET = new Set(["style", "fish", "psreadline"]);
const TARGET_MAPS = [
  "syntax_tokens.extended",
  "semantic_token_recommendations",
  "workbench_color_roles",
  "shell_roles",
  "prompt_roles",
];

const targetLabel = (t) =>
  t === "accent" || t.includes(".")
    ? t
    : t.startsWith("fg")
      ? `text.${t}`
      : `syntax.${t}`;

/** Text that appears in code: body, comments, syntax, semantic foregrounds. */
function codeText(tokens) {
  return [
    ["text.fg", tokens.text.fg],
    ["text.fg_muted", tokens.text.fg_muted],
    ["text.fg_subtle", tokens.text.fg_subtle],
    ...Object.entries(tokens.syntax).map(([k, v]) => [`syntax.${k}`, v]),
    ...Object.entries(tokens.semantic).map(([k, v]) => [`semantic.${k}`, v]),
  ];
}
const labelText = (tokens) => [
  ["text.fg", tokens.text.fg],
  ["text.fg_muted", tokens.text.fg_muted],
];

/** Every (text, background) pair gates 1 and 2 look at. */
function textPairs(tokens) {
  const pairs = [];
  const add = (texts, on, bg) => {
    for (const [label, fg] of texts) pairs.push({ label, fg, on, bg });
  };
  for (const s of CODE_SURFACES)
    add(codeText(tokens), `surface.${s}`, tokens.surface[s]);
  add(labelText(tokens), "surface.bg_soft", tokens.surface.bg_soft);
  for (const o of CODE_OVERLAYS)
    add(codeText(tokens), `overlay.${o}`, tokens.overlay[o].hex);
  for (const o of LABEL_OVERLAYS)
    add(labelText(tokens), `overlay.${o}`, tokens.overlay[o].hex);
  return pairs;
}

/** Rows for the console summary and preview/04-contrast.html. */
export function contrastReport(tokens) {
  return textPairs(tokens).map((p) => ({
    ...p,
    ratio: contrast(p.fg, p.bg),
    lc: apca(p.fg, p.bg),
  }));
}

/** Collect [path, target] for every colour target under `node`. */
function collectTargets(node, path, out) {
  if (typeof node === "string") {
    if (node !== "none") out.push([path, node]);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collectTargets(v, `${path}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (!NOT_A_TARGET.has(k))
        collectTargets(v, k === "color" ? path : `${path}.${k}`, out);
    }
  }
  return out;
}

/** Collect [path, value] for every hex literal under `node`. */
function collectHex(node, path, out) {
  if (typeof node === "string") {
    if (/^#[0-9a-f]{3,8}$/i.test(node)) out.push([path, node]);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      collectHex(
        v,
        Array.isArray(node) ? `${path}[${k}]` : path ? `${path}.${k}` : k,
        out,
      );
    }
  }
  return out;
}

const at = (obj, dotted) => dotted.split(".").reduce((o, k) => o?.[k], obj);

/**
 * Run every gate. `tokens` is the resolved tree, `raw` the tree as
 * authored (gate 8 needs to see what was written, not what it became).
 * Returns one message per failure.
 */
export function check(tokens, raw) {
  const fail = [];
  const need = (label, fg, on, bg, min) => {
    const r = contrast(fg, bg);
    if (r < min) {
      fail.push(
        `✗ ${label} (${fg}) on ${on} (${bg}): ${r.toFixed(2)}:1, needs ${min}:1`,
      );
    }
  };
  const apart = (la, a, lb, b, min) => {
    const d = deltaE(a, b);
    if (d < min) {
      fail.push(
        `✗ ${la} (${a}) and ${lb} (${b}) are too alike: distance ${d.toFixed(1)}, needs ${min}`,
      );
    }
  };

  // Structure first: later gates assume every target resolves.
  for (const slot of tokens.syntax_tokens.core) {
    if (!Object.hasOwn(tokens.syntax, slot)) {
      fail.push(
        `✗ syntax_tokens.core lists "${slot}", which syntax does not define`,
      );
    }
  }
  for (const map of TARGET_MAPS) {
    for (const [path, target] of collectTargets(at(tokens, map), map, [])) {
      try {
        resolveTarget(tokens, target);
      } catch (err) {
        fail.push(`✗ ${path}: ${err.message}`);
      }
    }
  }
  const known = new Set([
    ...tokens.syntax_tokens.core,
    ...Object.keys(tokens.syntax_tokens.extended),
    "fg_fallthrough_jsts",
  ]);
  for (const [slot, scopes] of Object.entries(tokens.scope_recommendations)) {
    if (!known.has(slot))
      fail.push(
        `✗ scope_recommendations.${slot} is not a core or extended slot`,
      );
    for (const scope of scopes) {
      if (scope.split(" ").pop().startsWith("meta.")) {
        fail.push(
          `✗ scope_recommendations.${slot} targets "${scope}": never style a meta.* scope directly`,
        );
      }
    }
  }
  if (fail.length) return fail;

  // 1 + 2. Text contrast on surfaces and overlays.
  for (const p of textPairs(tokens)) need(p.label, p.fg, p.on, p.bg, AA);

  // 3. ANSI on the terminal background.
  for (const [slot, color] of Object.entries(tokens.ansi)) {
    if (!ANSI_EXEMPT.has(slot)) {
      need(
        `ansi.${slot}`,
        color,
        "surface.bg_terminal",
        tokens.surface.bg_terminal,
        AA,
      );
    }
  }

  // 4. Non-text: control outline, focus ring, overlay borders.
  for (const s of CONTROL_SURFACES) {
    need(
      "border.control",
      tokens.border.control,
      `surface.${s}`,
      tokens.surface[s],
      NON_TEXT,
    );
    need("accent", tokens.accent, `surface.${s}`, tokens.surface[s], NON_TEXT);
  }
  for (const [name, o] of Object.entries(tokens.overlay)) {
    if (o.border)
      need(
        `overlay.${name}.border`,
        o.border,
        `overlay.${name}`,
        o.hex,
        NON_TEXT,
      );
  }

  // 5. Text on fills.
  for (const [role, f] of Object.entries(tokens.semantic_fill)) {
    need(
      `semantic_fill.${role}.text`,
      f.text,
      `semantic_fill.${role}.fill`,
      f.fill,
      AA,
    );
  }
  need("accent_on", tokens.accent_on, "accent", tokens.accent, AA);

  // 6. Distinctness — audited on resolved colours, not slot names.
  for (const [a, b] of DISTINCT_PAIRS) {
    apart(
      targetLabel(a),
      resolveTarget(tokens, a),
      targetLabel(b),
      resolveTarget(tokens, b),
      DISTINCT,
    );
  }
  for (const prefix of ["", "bright_"]) {
    for (let i = 0; i < ANSI_SLOTS.length; i++) {
      for (let j = i + 1; j < ANSI_SLOTS.length; j++) {
        const [a, b] = [prefix + ANSI_SLOTS[i], prefix + ANSI_SLOTS[j]];
        apart(
          `ansi.${a}`,
          tokens.ansi[a],
          `ansi.${b}`,
          tokens.ansi[b],
          DISTINCT,
        );
      }
    }
  }
  for (const slot of ANSI_SLOTS) {
    apart(
      `ansi.${slot}`,
      tokens.ansi[slot],
      `ansi.bright_${slot}`,
      tokens.ansi[`bright_${slot}`],
      DISTINCT,
    );
  }

  // 7. Signal separation.
  const { danger, warning, success } = tokens.semantic;
  apart("accent", tokens.accent, "semantic.warning", warning, DISTINCT);
  apart("accent", tokens.accent, "semantic.danger", danger, DISTINCT);
  apart("semantic.warning", warning, "semantic.danger", danger, DISTINCT);
  const gap = Math.abs(oklab(danger)[0] - oklab(success)[0]) * 100;
  if (gap < LIGHTNESS_GAP) {
    fail.push(
      `✗ semantic.danger (${danger}) and semantic.success (${success}) differ by ${gap.toFixed(1)} in lightness, need ${LIGHTNESS_GAP}: red and green must not rely on hue alone`,
    );
  }

  // 8. Palette integrity.
  const { palette_base, derived, ...roles } = raw;
  for (const [path, value] of collectHex(roles, "", [])) {
    fail.push(
      `✗ ${path} is the hex literal ${value}: reference a palette step or a derived value instead`,
    );
  }
  if (!raw.ladder.exclude.includes("signalred")) {
    fail.push(
      "✗ signalred must not have a ladder: its tints drift into pink (brand decision)",
    );
  }
  const sunk = mix(palette_base.darkblue, palette_base.darkblack, 0.8);
  if (derived.bg_sunk !== sunk) {
    fail.push(
      `✗ derived.bg_sunk is ${derived.bg_sunk}, but mix(darkblue, darkblack, 0.8) is ${sunk}`,
    );
  }
  for (const name of ["signalred_on_dark", "signalred_on_dark_bright"]) {
    const drift = Math.abs(
      hueAngle(derived[name]) - hueAngle(palette_base.signalred),
    );
    if (drift > HUE_TOLERANCE) {
      fail.push(
        `✗ derived.${name} (${derived[name]}) has left the Signalred hue by ${drift.toFixed(3)} rad`,
      );
    }
  }

  // 9. Overlays are visible and distinct.
  const { selection, find_match } = tokens.overlay;
  apart(
    "overlay.selection",
    selection.hex,
    "surface.bg",
    tokens.surface.bg,
    DISTINCT,
  );
  apart(
    "overlay.selection",
    selection.hex,
    "overlay.find_match",
    find_match.hex,
    DISTINCT,
  );

  return fail;
}
```

Then, in `main`, add the gate run and the summary after the stale-file block (replacing the final `if (checkMode) console.log(...)` line):

```js
if (checkMode)
  console.log("✓ tokens.json and dist/tokens.js match tokens.json5");

const failures = check(tokens, raw);
if (failures.length) {
  console.error(`\n${failures.length} gate failure(s):`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
const rows = contrastReport(tokens);
const tightest = rows.reduce((a, b) => (a.ratio < b.ratio ? a : b));
const body = rows.find((r) => r.label === "text.fg" && r.on === "surface.bg");
const comment = rows.find(
  (r) => r.label === "syntax.comment" && r.on === "surface.bg",
);
console.log(`\n✓ All gates pass (${rows.length} text pairs at ≥ ${AA}:1).`);
console.log(
  `  Tightest: ${tightest.label} on ${tightest.on}, ${tightest.ratio.toFixed(2)}:1`,
);
console.log(
  `  APCA (report only): body Lc ${Math.abs(body.lc).toFixed(0)} (target 75), comments Lc ${Math.abs(comment.lc).toFixed(0)} (target 45)`,
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 42 tests.

If "the shipped tokens pass every gate" fails, the message lists the failing pairs. Fix `tokens.json5` in this order, re-running after each change: move the value one step along the same ladder; then swap roles between brand hues; never add a hue. Record any value that ends up different from the spec in the spec's tables.

- [ ] **Step 5: Run the build**

Run: `node tools/build-tokens.mjs`
Expected (numbers may differ in the last digit):

```
✓ tokens.json
✓ dist/tokens.js

✓ All gates pass (236 text pairs at ≥ 4.5:1).
  Tightest: semantic.danger on overlay.word_highlight_strong, 4.58:1
  APCA (report only): body Lc 87 (target 75), comments Lc 51 (target 45)
```

- [ ] **Step 6: Commit**

```bash
git add tools/build-tokens.mjs tools/gates.test.mjs tokens.json5 tokens.json dist/tokens.js
git commit -m "✨ feat: enforce contrast and distinctness gates in the build"
```

---

### Task 4: Generated CSS

**Files:**

- Create: `tools/build-css.mjs`
- Create: `tools/build-css.test.mjs`
- Generated: `colors.css`

**Interfaces:**

- Consumes: `loadTokens`, `resolveTokens`, `parseTokens` from `tools/build-tokens.mjs`.
- Produces, from `tools/build-css.mjs`:
  - `cssVar(target: string): string` — colour target → custom property name: `"keyword"` → `--sw-syn-keyword`, `"fg_muted"` → `--sw-fg-muted`, `"accent"` → `--sw-accent`, `"semantic.danger"` → `--sw-danger`, `"overlay.find_match"` → `--sw-overlay-find-match`
  - `renderCss(tokens: object): string`
- Custom properties declared on `:root`: `--sw-palette-<name>-<step>`, `--sw-bg`, `--sw-bg-sunk`, `--sw-bg-soft`, `--sw-bg-overlay`, `--sw-bg-terminal`, `--sw-fg`, `--sw-fg-muted`, `--sw-fg-subtle`, `--sw-fg-disabled`, `--sw-border-<name>`, `--sw-accent`, `--sw-accent-on`, `--sw-<role>` (danger, success, warning, info), `--sw-<role>-fill`, `--sw-<role>-fill-text`, `--sw-syn-<slot>`, `--sw-ansi-<slot>` (`bright_red` → `--sw-ansi-bright-red`), `--sw-overlay-<name>`, `--sw-overlay-<name>-border`, `--sw-font-mono`.

- [ ] **Step 1: Write the failing tests**

`tools/build-css.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokens } from "./build-tokens.mjs";
import { cssVar, renderCss } from "./build-css.mjs";

const tokens = await loadTokens();
const css = renderCss(tokens);

test("cssVar maps every kind of colour target", () => {
  assert.equal(cssVar("keyword"), "--sw-syn-keyword");
  assert.equal(cssVar("fg_muted"), "--sw-fg-muted");
  assert.equal(cssVar("accent"), "--sw-accent");
  assert.equal(cssVar("semantic.danger"), "--sw-danger");
  assert.equal(cssVar("overlay.find_match"), "--sw-overlay-find-match");
});

test("the stylesheet declares the documented properties with resolved values", () => {
  for (const line of [
    "--sw-bg: #0d3174;",
    "--sw-bg-sunk: #102d62;",
    "--sw-fg: #e7eaf1;",
    "--sw-accent: #fbba00;",
    "--sw-danger: #ff897b;",
    "--sw-danger-fill: #cd1719;",
    "--sw-syn-keyword: #fbba00;",
    "--sw-ansi-bright-red: #ffb4aa;",
    "--sw-overlay-selection: #15253f;",
    "--sw-palette-pumpelorange-90: #ee7521;",
  ]) {
    assert.ok(css.includes(line), `missing: ${line}`);
  }
  assert.ok(css.includes('--sw-font-mono: "JetBrains Mono"'));
});

test("every colour target used in the role maps has a declared property", () => {
  const declared = new Set(
    [...css.matchAll(/^\s*(--sw-[a-z0-9-]+):/gm)].map((m) => m[1]),
  );
  const targets = [
    ...tokens.syntax_tokens.core,
    ...Object.values(tokens.shell_roles)
      .map((r) => r.color)
      .filter(Boolean),
    "fg",
    "fg_muted",
    "fg_subtle",
    "fg_disabled",
    "accent",
    "semantic.danger",
    "semantic.success",
    "semantic.warning",
    "semantic.info",
  ];
  for (const t of targets)
    assert.ok(declared.has(cssVar(t)), `${t} → ${cssVar(t)} not declared`);
});

test("no property is declared twice", () => {
  const names = [...css.matchAll(/^\s*(--sw-[a-z0-9-]+):/gm)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./build-css.mjs`.

- [ ] **Step 3: Implement `tools/build-css.mjs`**

```js
#!/usr/bin/env node
/**
 * build-css.mjs — tokens → colors.css (custom properties on :root).
 *
 *   node tools/build-css.mjs            write colors.css
 *   node tools/build-css.mjs --check    exit 1 if colors.css is out of date
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadTokens } from "./build-tokens.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kebab = (s) => String(s).replace(/_/g, "-");

/** A colour target (see resolveTarget) → its custom property name. */
export function cssVar(target) {
  if (target === "accent") return "--sw-accent";
  if (target.startsWith("fg")) return `--sw-${kebab(target)}`;
  const [group, key] = target.split(".");
  if (group === "semantic") return `--sw-${kebab(key)}`;
  if (group === "overlay") return `--sw-overlay-${kebab(key)}`;
  return `--sw-syn-${kebab(target)}`;
}

export function renderCss(tokens) {
  const lines = [];
  const section = (title, entries) => {
    lines.push("", `  /* ${title} */`);
    for (const [name, value] of entries) lines.push(`  ${name}: ${value};`);
  };

  section(
    "Brand palette — base colours and their tint ladders",
    Object.entries(tokens.palette).flatMap(([name, steps]) =>
      Object.entries(steps)
        .sort((a, b) => b[0] - a[0])
        .map(([step, hex]) => [`--sw-palette-${name}-${step}`, hex]),
    ),
  );
  section(
    "Surfaces",
    Object.entries(tokens.surface).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
  );
  section(
    "Text",
    Object.entries(tokens.text).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
  );
  section(
    "Borders",
    Object.entries(tokens.border).map(([k, v]) => [
      `--sw-border-${kebab(k)}`,
      v,
    ]),
  );
  section("Accent", [
    ["--sw-accent", tokens.accent],
    ["--sw-accent-on", tokens.accent_on],
  ]);
  section("Semantic — foregrounds on dark, then fills with their text colour", [
    ...Object.entries(tokens.semantic).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
    ...Object.entries(tokens.semantic_fill).flatMap(([k, f]) => [
      [`--sw-${kebab(k)}-fill`, f.fill],
      [`--sw-${kebab(k)}-fill-text`, f.text],
    ]),
  ]);
  section(
    "Syntax",
    Object.entries(tokens.syntax).map(([k, v]) => [`--sw-syn-${kebab(k)}`, v]),
  );
  section(
    "ANSI",
    Object.entries(tokens.ansi).map(([k, v]) => [`--sw-ansi-${kebab(k)}`, v]),
  );
  section(
    "Overlays — composited over --sw-bg",
    Object.entries(tokens.overlay).flatMap(([k, o]) => [
      [`--sw-overlay-${kebab(k)}`, o.hex],
      ...(o.border ? [[`--sw-overlay-${kebab(k)}-border`, o.border]] : []),
    ]),
  );
  section("Typography", [["--sw-font-mono", tokens.typography.mono.stack]]);

  return (
    `/* Sepp's Workshop ${tokens.meta.version} — AUTO-GENERATED from tokens.json5. Do not edit. */\n` +
    `:root {${lines.join("\n")}\n}\n`
  );
}

async function main() {
  const path = join(ROOT, "colors.css");
  const css = renderCss(await loadTokens());
  if (process.argv.includes("--check")) {
    const existing = await readFile(path, "utf8").catch(() => "");
    if (existing !== css) {
      console.error("✗ colors.css out of date — run `npm run build`.");
      process.exit(1);
    }
    console.log("✓ colors.css matches tokens.json5");
  } else {
    await writeFile(path, css);
    console.log("✓ colors.css");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the tests, then build and check**

Run: `npm test && node tools/build-css.mjs && node tools/build-css.mjs --check`
Expected: 46 tests pass; `✓ colors.css`; `✓ colors.css matches tokens.json5`.

- [ ] **Step 5: Commit**

```bash
git add tools/build-css.mjs tools/build-css.test.mjs colors.css
git commit -m "✨ feat: generate colors.css from the tokens"
```

---

### Task 5: Generated preview pages

**Files:**

- Create: `tools/build-previews.mjs`
- Create: `tools/build-previews.test.mjs`
- Generated: `preview/01-syntax.html`, `preview/02-terminal.html`, `preview/03-shell.html`, `preview/04-contrast.html`

**Interfaces:**

- Consumes: `loadTokens`, `resolveTarget`, `contrastReport`, `contrast`, `CODE_OVERLAYS` from `tools/build-tokens.mjs`; `cssVar`, `renderCss` from `tools/build-css.mjs`.
- Produces, from `tools/build-previews.mjs`:
  - `renderPages(tokens: object): Record<string, string>` — file name → HTML
- Sample markup inside the tool: `[[name:text]]` wraps `text` in a span. `name` is a core or extended syntax slot on the syntax page, an ANSI slot on the terminal page, a shell or prompt role on the shell page. A sample line starting with `@overlay_name|` is drawn on that overlay.

- [ ] **Step 1: Write the failing tests**

`tools/build-previews.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokens } from "./build-tokens.mjs";
import { renderCss } from "./build-css.mjs";
import { renderPages } from "./build-previews.mjs";

const tokens = await loadTokens();
const pages = renderPages(tokens);
const declared = new Set(
  [...renderCss(tokens).matchAll(/^\s*(--sw-[a-z0-9-]+):/gm)].map((m) => m[1]),
);

test("the four pages are produced", () => {
  assert.deepEqual(Object.keys(pages), [
    "01-syntax.html",
    "02-terminal.html",
    "03-shell.html",
    "04-contrast.html",
  ]);
});

test("no sample markup or broken interpolation leaks into the output", () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.ok(!html.includes("[["), `${name} contains unrendered [[ markup`);
    assert.ok(
      !/undefined|NaN|\[object Object\]/.test(html),
      `${name} contains a broken value`,
    );
  }
});

test("every custom property a page uses is declared in colors.css", () => {
  for (const [name, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/var\((--sw-[a-z0-9-]+)\)/g)) {
      assert.ok(declared.has(m[1]), `${name} uses undeclared ${m[1]}`);
    }
  }
});

test("pages style themselves from colors.css, not from hex literals", () => {
  for (const [name, html] of Object.entries(pages)) {
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.ok(
      !/#[0-9a-f]{3,8}\b/i.test(css),
      `${name} hardcodes a colour in its stylesheet`,
    );
    if (name === "04-contrast.html") continue; // swatches show the reported value itself
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
      assert.ok(!m[1].includes("#"), `${name} hardcodes a colour inline`);
    }
  }
});

test("the syntax page exercises every core slot and the code overlays", () => {
  const html = pages["01-syntax.html"];
  for (const slot of tokens.syntax_tokens.core) {
    assert.ok(html.includes(`class="t-${slot}"`), `no sample uses ${slot}`);
  }
  for (const o of [
    "selection",
    "line_highlight",
    "find_match",
    "word_highlight_strong",
    "diff_inserted_line",
    "diff_removed_line",
  ]) {
    assert.ok(html.includes(`class="line o-${o}"`), `no sample line on ${o}`);
  }
});

test("the terminal page shows all sixteen ANSI colours", () => {
  for (const slot of Object.keys(tokens.ansi)) {
    assert.ok(
      pages["02-terminal.html"].includes(`a-${slot}`),
      `missing ${slot}`,
    );
  }
});

test("the contrast page lists every reported pair", () => {
  const rows = pages["04-contrast.html"].match(/<tr data-pair/g) ?? [];
  assert.ok(rows.length > 150);
});

test("user-visible text is HTML-escaped", () => {
  assert.ok(pages["01-syntax.html"].includes("&lt;"));
  assert.ok(!/<Greeting\b/.test(pages["01-syntax.html"]));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./build-previews.mjs`.

- [ ] **Step 3: Implement `tools/build-previews.mjs`**

```js
#!/usr/bin/env node
/**
 * build-previews.mjs — tokens → preview/*.html.
 *
 *   node tools/build-previews.mjs            write the pages
 *   node tools/build-previews.mjs --check    exit 1 if any page is out of date
 *
 * The pages are generated so they cannot drift from the tokens. Colours
 * come from ../colors.css; a page holds no colour of its own.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  loadTokens,
  contrastReport,
  contrast,
  CODE_OVERLAYS,
} from "./build-tokens.mjs";
import { cssVar } from "./build-css.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kebab = (s) => String(s).replace(/_/g, "-");
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `[[name:text]]` → <span class="<prefix><name>">text</span>, after escaping. */
const mark = (src, prefix) =>
  esc(src).replace(
    /\[\[([a-z_]+):([\s\S]+?)\]\]/g,
    (_, name, text) => `<span class="${prefix}${name}">${text}</span>`,
  );

/** A block of sample lines. `@overlay|` at the start of a line draws it on that overlay. */
function block(title, src, prefix) {
  const lines = src.split("\n").map((line) => {
    const m = line.match(/^@([a-z_]+)\|(.*)$/);
    const cls = m ? ` o-${m[1]}` : "";
    return `<span class="line${cls}">${mark(m ? m[2] : line, prefix) || " "}</span>`;
  });
  return `<section><h2>${esc(title)}</h2><pre>${lines.join("\n")}</pre></section>`;
}

const styleDecl = (color, style = []) =>
  [
    color ? `color:var(${cssVar(color)})` : "",
    style.includes("italic") ? "font-style:italic" : "",
    style.includes("bold") ? "font-weight:700" : "",
    style.includes("underline") ? "text-decoration:underline" : "",
  ]
    .filter(Boolean)
    .join(";");

/** Rules for every syntax slot (.t-*), ANSI slot (.a-*), shell role (.s-*), prompt role (.p-*) and overlay (.o-*). */
function tokenCss(tokens) {
  const rules = [];
  const { core, core_style, extended } = tokens.syntax_tokens;
  for (const slot of core)
    rules.push(`.t-${slot}{${styleDecl(slot, core_style[slot])}}`);
  for (const [name, v] of Object.entries(extended)) {
    const { color, style } = typeof v === "string" ? { color: v } : v;
    rules.push(`.t-${name}{${styleDecl(color, style)}}`);
  }
  for (const slot of Object.keys(tokens.ansi))
    rules.push(`.a-${slot}{color:var(--sw-ansi-${kebab(slot)})}`);
  for (const [name, r] of Object.entries(tokens.shell_roles)) {
    const decl = r.color?.startsWith("overlay.")
      ? `background:var(${cssVar(r.color)})`
      : styleDecl(r.color, r.style);
    rules.push(`.s-${name}{${decl}}`);
  }
  for (const [name, r] of Object.entries(tokens.prompt_roles)) {
    if (name === "git_status") {
      for (const [k, target] of Object.entries(r))
        rules.push(`.p-git_${k}{${styleDecl(target)}}`);
    } else {
      rules.push(`.p-${name}{${styleDecl(r.color, r.style)}}`);
    }
  }
  for (const [name, o] of Object.entries(tokens.overlay)) {
    const border = o.border
      ? `;outline:1px solid var(--sw-overlay-${kebab(name)}-border);outline-offset:-1px`
      : "";
    rules.push(
      `.o-${name}{background:var(--sw-overlay-${kebab(name)})${border}}`,
    );
  }
  return rules.join("\n");
}

const CHROME = `
*{box-sizing:border-box}
body{margin:0;padding:32px 16px 64px;background:var(--sw-bg);color:var(--sw-fg);font:14px/1.6 var(--sw-font-mono)}
main{max-width:960px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px;color:var(--sw-accent)}
h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--sw-fg-muted);margin:32px 0 8px}
p{color:var(--sw-fg-muted);margin:0 0 8px;max-width:72ch}
nav{margin:0 0 24px}
nav a{color:var(--sw-info);margin-right:16px}
nav a[aria-current]{color:var(--sw-fg);text-decoration:none;border-bottom:2px solid var(--sw-accent)}
pre{margin:0;padding:12px 0;background:var(--sw-bg);border:1px solid var(--sw-border-default);overflow-x:auto;font:inherit}
pre.sunk{background:var(--sw-bg-sunk)}
.line{display:block;padding:0 16px;min-height:1.6em}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:4px 12px 4px 0;border-bottom:1px solid var(--sw-border-subtle);white-space:nowrap}
th{color:var(--sw-fg-muted);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.sw{padding:12px 8px;border:1px solid var(--sw-border-default);background:var(--sw-bg-terminal)}
.sw small{display:block;color:var(--sw-fg-muted)}
.chip{display:inline-block;width:1em;height:1em;vertical-align:-2px;margin-right:8px;border:1px solid var(--sw-border-control)}
.fill{display:inline-block;padding:2px 10px;margin-right:8px}
`;

const PAGES = [
  ["01-syntax.html", "Syntax"],
  ["02-terminal.html", "Terminal"],
  ["03-shell.html", "Shell and prompt"],
  ["04-contrast.html", "Contrast report"],
];

function page(tokens, file, intro, body) {
  const title = PAGES.find(([f]) => f === file)[1];
  const nav = PAGES.map(
    ([f, t]) =>
      `<a href="${f}"${f === file ? ' aria-current="page"' : ""}>${t}</a>`,
  ).join("");
  return `<!doctype html>
<!-- AUTO-GENERATED by tools/build-previews.mjs — do not edit. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Sepp's Workshop</title>
<link rel="stylesheet" href="../colors.css">
<style>${CHROME}${tokenCss(tokens)}
</style>
</head>
<body>
<main>
<h1>Sepp's Workshop · ${title}</h1>
<p>${intro}</p>
<nav>${nav}</nav>
${body}
</main>
</body>
</html>
`;
}

/* ── Samples ─────────────────────────────────────────────────────── */

const TS = `[[doc_keyword:/** @param]] [[doc_type:{User}]] [[doc_param:user]] [[comment:who to greet */]]
[[keyword:import]] [[punct:{]] useState [[punct:}]] [[keyword:from]] [[string:"react"]][[punct:;]]

[[keyword:interface]] [[type:User]] [[punct:{]] name[[operator::]] [[type:string]][[punct:;]] age[[operator:?:]] [[type:number]] [[punct:}]]

[[decorator:@memo]]
[[keyword:export function]] [[function:Greeting]][[punct:(]][[punct:{]] [[parameter:user]] [[punct:}]][[operator::]] [[punct:{]] user[[operator::]] [[type:User]] [[punct:}]][[punct:)]] [[punct:{]]
  [[keyword:const]] [[punct:[]]count[[punct:,]] setCount[[punct:]]] [[operator:=]] [[function:useState]][[punct:(]][[number:0]][[punct:)]][[punct:;]]
  [[keyword:if]] [[punct:(]][[lang_var:this]] [[operator:===]] [[keyword:null]][[punct:)]] [[keyword:return]] [[keyword:null]][[punct:;]]
  [[keyword:const]] label [[operator:=]] [[string:\`Hi \${]]user[[punct:.]]name[[string:}\`]][[punct:;]] [[comment:// template string]]
  [[keyword:return]] [[punct:<]][[tag:Greeting]] [[attr:count]][[operator:=]][[punct:{]]count [[operator:+]] [[number:1]][[punct:}]] [[attr:pattern]][[operator:=]][[punct:{]][[regex:/^sepp\\d+$/i]][[punct:}]] [[punct:/>]][[punct:;]]
[[punct:}]]
[[invalid:cosnt oops]] [[invalid_deprecated:oldApi()]]`;

const PY = `[[shebang:#!/usr/bin/env python3]]
[[keyword:from]] [[namespace:dataclasses]] [[keyword:import]] dataclass

[[constant:MAX_TURNS]] [[operator:=]] [[number:5]]

[[decorator:@dataclass]]
[[keyword:class]] [[type:Robot]][[punct::]]
    name[[punct::]] [[type:str]] [[operator:=]] [[string:"Sepp"]]

    [[keyword:def]] [[function:tighten]][[punct:(]][[lang_var:self]][[punct:,]] [[parameter:turns]][[punct::]] [[type:int]] [[operator:=]] [[number:3]][[punct:)]] [[operator:->]] [[type:bool]][[punct::]]
        [[comment:# a wrench never returns None]]
        [[keyword:return]] [[builtin:len]][[punct:(]][[lang_var:self]][[punct:.]]name[[punct:)]] [[operator:>]] turns [[keyword:and]] [[keyword:True]]`;

const CSSS = `[[keyword:@media]] [[punct:(]]prefers-color-scheme[[punct::]] dark[[punct:)]] [[punct:{]]
  [[selector:.workshop]][[selector::hover]] [[punct:{]]
    color[[punct::]] [[hex:#fbba00]][[punct:;]]
    padding[[punct::]] [[number:16]][[unit:px]] [[number:1.5]][[unit:rem]][[punct:;]]
    font-family[[punct::]] [[string:"JetBrains Mono"]][[punct:;]]
  [[punct:}]]
[[punct:}]]`;

const HTML = `[[punct:<]][[tag:button]] [[attr:class]][[operator:=]][[string:"primary"]] [[attr:disabled]][[punct:>]]Tighten[[punct:</]][[tag:button]][[punct:>]]
[[comment:<!-- tags are not the function colour -->]]`;

const JSON_ = `[[punct:{]] [[property:"name"]][[punct::]] [[string:"sepps-workshop"]][[punct:,]] [[property:"wrenches"]][[punct::]] [[number:2]][[punct:,]] [[property:"private"]][[punct::]] [[keyword:true]] [[punct:}]]`;

const MD = `[[heading:# Sepp's Workshop]]
Plain text, [[emphasis:emphasis]], [[strong:strong]] and a [[link:[link](https://www.seppmed.com/career/)]].
[[string:\`inline code\`]]`;

const STATES = `@line_highlight|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// current line]]
@selection|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// selected]]
@selection_inactive|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// selected, unfocused]]
@find_match|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// current find match]]
@find_match_other|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// other find match]]
@word_highlight|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// symbol read]]
@word_highlight_strong|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// symbol written]]
@diff_inserted_line|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// inserted]] [[invalid:error text]]
@diff_removed_line|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// removed]] [[invalid:error text]]`;

const TERM = `[[green:sepp@workshop]] [[blue:~/themes]] $ git status
On branch [[cyan:main]]
Changes to be committed:
        [[green:new file:   tokens.json5]]
Changes not staged for commit:
        [[red:modified:   README.md]]
        [[red:deleted:    old-theme.json]]
[[yellow:warning:]] LF will be replaced by CRLF
[[bright_black:# a comment in bright black]]
$ git diff
[[cyan:@@ -1,3 +1,3 @@]]
[[red:-  "bg": "navy",]]
[[green:+  "bg": "darkblue",]]
$ ls
[[blue:assets]]  [[blue:tools]]  [[green:build.sh]]  [[magenta:icon.png]]  [[cyan:latest -> v0.1.0]]  README.md
[[bright_red:error:]] [[bright_white:bright white]] [[bright_yellow:bright yellow]] [[bright_green:bright green]] [[bright_blue:bright blue]] [[bright_cyan:bright cyan]] [[bright_magenta:bright magenta]] [[white:white]]`;

const SHELL = `[[command:git]] [[argument:commit]] [[option:--message]] [[string:"tighten bolts"]] [[operator:&&]] [[command:npm]] [[argument:test]] [[redirection:>]] [[valid_path:out.log]]
[[keyword:for]] [[argument:f]] [[keyword:in]] [[argument:*.json]][[operator:;]] [[command:echo]] [[variable:$f]] [[escape:\\n]][[operator:;]] [[keyword:end]] [[comment:# loop]]
[[command:cd]] [[valid_path:~/themes]][[autosuggestion:/sepps-workshop-fish]]
[[error:gti]] [[argument:status]]
[[command:cat]] [[selection:selected text]] [[search_match:search match]]
[[pager_selected:--message       (Commit message)]]
[[pager_prefix:--mes]][[pager_completion:sage-file]]  [[pager_description:(Read message from file)]]`;

const PROMPT = `[[directory:~/themes/sepps-workshop-fish]] [[git_branch: main]] [[git_added:+2]] [[git_modified:!1]] [[git_deleted:✘1]] [[git_untracked:?3]] [[git_conflicted:=1]] [[git_ahead:⇡1]] [[language_module: v26.10.0]] [[duration:took 3s]]
[[character_success:❯]] npm run build
[[character_error:❯]] npm run biuld`;

/* ── Pages ───────────────────────────────────────────────────────── */

function contrastPage(tokens) {
  const groups = new Map();
  for (const r of contrastReport(tokens)) {
    if (!groups.has(r.on)) groups.set(r.on, []);
    groups.get(r.on).push(r);
  }
  const tables = [...groups].map(([on, rows]) => {
    const body = rows
      .map(
        (r) =>
          `<tr data-pair><td><span class="chip" style="background:${r.fg}"></span>${r.label}</td><td>${r.fg}</td><td>${r.ratio.toFixed(2)}:1</td><td>Lc ${Math.abs(r.lc).toFixed(0)}</td></tr>`,
      )
      .join("\n");
    return `<section><h2>On ${on} (${rows[0].bg})</h2><table><tr><th>Text</th><th>Value</th><th>WCAG 2.x</th><th>APCA</th></tr>\n${body}</table></section>`;
  });
  const ansi = Object.entries(tokens.ansi)
    .map(
      ([slot, hex]) =>
        `<tr><td><span class="chip" style="background:${hex}"></span>ansi.${slot}</td><td>${hex}</td><td>${contrast(hex, tokens.surface.bg_terminal).toFixed(2)}:1</td><td>${slot === "black" ? "exempt" : ""}</td></tr>`,
    )
    .join("\n");
  return (
    tables.join("\n") +
    `<section><h2>ANSI on surface.bg_terminal (${tokens.surface.bg_terminal})</h2><table><tr><th>Slot</th><th>Value</th><th>WCAG 2.x</th><th></th></tr>\n${ansi}</table></section>`
  );
}

export function renderPages(tokens) {
  const mono = tokens.typography.mono.primary;
  const syntax = [
    block("TypeScript / JSX", TS, "t-"),
    block("Python", PY, "t-"),
    block("CSS", CSSS, "t-"),
    block("HTML", HTML, "t-"),
    block("JSON", JSON_, "t-"),
    block("Markdown", MD, "t-"),
    block("Editor states — the same line on every code overlay", STATES, "t-"),
    `<section><h2>Signals</h2><p>` +
      ["danger", "success", "warning", "info"]
        .map(
          (r) =>
            `<span style="color:var(--sw-${r});margin-right:16px">${r}</span>`,
        )
        .join("") +
      `</p><p>` +
      Object.keys(tokens.semantic_fill)
        .map(
          (r) =>
            `<span class="fill" style="background:var(--sw-${r}-fill);color:var(--sw-${r}-fill-text)">${r} fill</span>`,
        )
        .join("") +
      `<span class="fill" style="background:var(--sw-accent);color:var(--sw-accent-on)">accent</span></p></section>`,
  ].join("\n");

  const grid = (prefix) =>
    `<div class="grid">` +
    ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]
      .map(
        (s) =>
          `<div class="sw a-${prefix}${s}">${prefix ? "bright " : ""}${s}<small>${tokens.ansi[prefix + s]}</small></div>`,
      )
      .join("") +
    `</div>`;
  const terminal = [
    `<section><h2>Normal</h2>${grid("")}</section>`,
    `<section><h2>Bright</h2>${grid("bright_")}</section>`,
    block("Sample session", TERM, "a-"),
  ].join("\n");

  const shell = [
    block("Command line (fish, PSReadLine)", SHELL, "s-"),
    block("Prompt (Starship)", PROMPT, "p-"),
  ].join("\n");

  return {
    "01-syntax.html": page(
      tokens,
      "01-syntax.html",
      `Three brand hues, two lightness steps each. Set in ${esc(mono)} if it is installed.`,
      syntax,
    ),
    "02-terminal.html": page(
      tokens,
      "02-terminal.html",
      "The sixteen ANSI colours on the terminal background. Magenta is Lightorange: the brand has no magenta.",
      terminal,
    ),
    "03-shell.html": page(
      tokens,
      "03-shell.html",
      "Shell and prompt roles, shared by the fish, PowerShell and Starship ports.",
      shell,
    ),
    "04-contrast.html": page(
      tokens,
      "04-contrast.html",
      "Every text pair the build gates on. WCAG 2.x AA (4.5:1) is enforced; APCA Lc is shown for reference.",
      contrastPage(tokens),
    ),
  };
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const pages = renderPages(await loadTokens());
  const dir = join(ROOT, "preview");
  const stale = [];
  if (!checkMode) await mkdir(dir, { recursive: true });
  for (const [name, html] of Object.entries(pages)) {
    if (checkMode) {
      const existing = await readFile(join(dir, name), "utf8").catch(() => "");
      if (existing !== html) stale.push(`preview/${name}`);
    } else {
      await writeFile(join(dir, name), html);
      console.log(`✓ preview/${name}`);
    }
  }
  if (stale.length) {
    console.error(`✗ ${stale.join(", ")} out of date — run \`npm run build\`.`);
    process.exit(1);
  }
  if (checkMode)
    console.log(
      `✓ ${Object.keys(pages).length} preview pages match tokens.json5`,
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
```

The prompt sample uses the names `git_added`, `git_modified`, …; with the `p-` prefix they become `p-git_added`, the class `tokenCss` emits for `prompt_roles.git_status.added`. Sample markers do not nest.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 54 tests.

- [ ] **Step 5: Build everything and check for drift**

Run: `npm run build && npm run check`
Expected: every line starts with `✓`; the last line is `✓ 4 preview pages match tokens.json5`.

- [ ] **Step 6: Look at the pages**

Open the four files in `preview/` in a browser. Walk section 12 of the syntax best-practice checklist and section 8 of the VS Code checklist against `01-syntax.html` and `02-terminal.html`: keywords distinct from identifiers, strings from numbers, types from variables, parameters italic, comments subordinate but readable, selection distinct from find match, all sixteen ANSI colours visible. In the browser dev tools, emulate deuteranopia and protanopia on `02-terminal.html` and confirm the `git diff` lines stay distinguishable. Note anything that reads wrong; a value change goes through `tokens.json5` and the gates.

- [ ] **Step 7: Commit**

```bash
git add tools/build-previews.mjs tools/build-previews.test.mjs preview/
git commit -m "✨ feat: generate preview pages from the tokens"
```

---

### Task 6: Icon renders

**Files:**

- Create: `assets/icon-16.png`, `assets/icon-32.png`, `assets/icon-48.png`, `assets/icon-128.png`, `assets/icon-180.png`, `assets/icon-256.png`, `assets/icon-512.png`

**Interfaces:**

- Consumes: the source image at `/home/vanlaarmi12/Git-Repos/temp/sepps-workshop-icon.png` (8192 × 8192, 76 MB — never copied into the repo).
- Produces: square PNG renders at the seven sizes, reachable by ports as `@sepps-workshop/design-system/assets/icon-<size>.png`.

- [ ] **Step 1: Render**

```bash
mkdir -p assets
for size in 16 32 48 128 180 256 512; do
  magick /home/vanlaarmi12/Git-Repos/temp/sepps-workshop-icon.png \
    -filter Lanczos -resize "${size}x${size}" -strip \
    -define png:compression-level=9 "assets/icon-${size}.png"
done
```

- [ ] **Step 2: Verify sizes and weight**

Run: `magick identify -format '%f %wx%h %b\n' assets/icon-*.png && du -ch assets/icon-*.png | tail -1`
Expected: seven lines, each `icon-N.png NxN …`; total under 1 MB. If the 512 px render alone exceeds 600 KB, re-render it with `-colors 256`.

- [ ] **Step 3: Look at the small sizes**

Open `assets/icon-16.png`, `icon-32.png` and `icon-128.png`. At 128 px Sepp, the halftone dots and the wrench should read clearly. At 16 and 32 px the dots and the wrench are expected to blur; record what is and is not recognisable for the README's asset note. A simplified small-size mark is a later asset, not part of this plan.

- [ ] **Step 4: Commit**

```bash
git add assets/
git commit -m "🍱 chore: add Sepp icon renders"
```

---

### Task 7: Documentation and port handoff

**Files:**

- Create: `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `handoff/SKILL.md`, `handoff/README.md`

**Interfaces:**

- Consumes: the resolved tokens (for the tables), the generated previews and icons.
- Produces: the written contract ports work from.

Voice: English, no emoji. Technical sections plain and exact. The intro and the recruiting section may be relaxed with a little nerd humour; no empty superlatives; only true statements. Take every number in the docs from `tokens.json` or the build output, not from this plan.

- [ ] **Step 1: Write `README.md`**

Sections, in this order:

1. **Header.** Centered `assets/icon-128.png`, the name "Sepp's Workshop", the line "Design System", and two plain badges: WCAG AA, no dependencies.
2. **Intro**, verbatim:

   > Sepp is the robot who keeps things running at [sepp.med](https://www.seppmed.com). This is his workshop: one colour theme for the tools developers stare at all day, built on the company's dark blue.
   >
   > This repository is the foundation, not a theme you can install. It holds the colours, the rules for using them, and a build that refuses to pass if any text drops below WCAG AA. The themes themselves live in their own repositories and read everything from here.

3. **Ports.** A table of the five ports with their repository names (`sepps-workshop-vs-code`, `sepps-workshop-windows-terminal`, `sepps-workshop-powershell`, `sepps-workshop-fish`, `sepps-workshop-starship`), each marked "planned".
4. **The theme at a glance.** One paragraph: medium-dark, Darkblue canvas, Sunset accent, three syntax hues with two lightness steps each. Link the four preview pages.
5. **Palette.** The ten brand colours with hex; the ladder rule (10 % steps towards white, generated by the build); the two brand rules (Signalred has no tints; Signalred and Freegreen are signals only). Then "Two departures from the ladder": `bg_sunk` and its recipe; the derived reds, why Signalred cannot be text on Darkblue (2.18:1), and the rule "red as text is `semantic.danger`, red as a fill is Signalred".
6. **Surfaces, text, borders.** Table from the tokens with contrast on `bg`. State that `bg_soft` carries `fg` and `fg_muted` only, and why `bg_terminal` equals `bg`.
7. **Syntax.** Why three hues (Lightorange and Middleblue are not separable from Pumpelorange and Windblue on this canvas), the core slot table with value, style and contrast, the extended slots, and the three recommendation maps with one line each on how a port uses them.
8. **Semantic roles.** Table of foreground and fill; why warning is Lightorange; the lightness rule for danger and success.
9. **ANSI.** The sixteen-colour table. The three notes: magenta is Lightorange; blue and cyan differ in lightness as well as hue; neutrals are Shadowgrey.
10. **Overlays.** The recipe table and the paragraph "Overlays darken" with the reason. Which overlays carry code and which carry labels only.
11. **Shell and prompt roles.** What they are for; the role tables.
12. **Typography.** JetBrains Mono, JetBrainsMono Nerd Font for prompts with icons, the stack; the statement that themes cannot ship fonts.
13. **Build gates.** The nine gates as a numbered list, one line each, with their thresholds. APCA is reported, not enforced.
14. **Build flow and files.** `npm run build`, `npm run check`, `npm test`; the file tree; the rule that only `tokens.json5` is edited by hand.
15. **For ports.** The seven-point contract from the spec, and how to depend on the foundation today: `npm install github:sepps-workshop/sepps-workshop-design-system` or a local path, with the same import specifiers that will work once the package is published.
16. **Assets.** Icon sizes; what survives at 16 and 32 px (from Task 6, step 3); a note that no licence has been chosen yet and all rights are reserved.
17. **Want to join Sepp's Workshop?**, verbatim:

    > sepp.med builds and tests software for places where a bug is more than an inconvenience: medical devices, cars, aircraft. If you would rather get the contrast ratio right than argue about it, you might like it here.
    >
    > Have a look at the [open positions](https://www.seppmed.com/career/), or just say hello.

- [ ] **Step 2: Check the README against the tokens**

Run:

```bash
node --input-type=module -e '
import { readFile } from "node:fs/promises";
import tokens from "@sepps-workshop/design-system";
const md = await readFile("README.md", "utf8");
const want = new Set([
  ...Object.values(tokens.palette_base), ...Object.values(tokens.derived),
  ...Object.values(tokens.syntax), ...Object.values(tokens.ansi),
  ...Object.values(tokens.semantic), ...Object.values(tokens.surface), ...Object.values(tokens.text),
]);
const missing = [...want].filter((hex) => !md.toLowerCase().includes(hex));
const stray = [...new Set(md.toLowerCase().match(/#[0-9a-f]{6}\b/g) ?? [])].filter(
  (hex) => !JSON.stringify(tokens).includes(hex));
console.log("missing from README:", missing.join(" ") || "none");
console.log("in README but not in tokens:", stray.join(" ") || "none");
process.exit(missing.length || stray.length ? 1 : 0);
'
```

Expected: `missing from README: none` and `in README but not in tokens: none`. A hex that is quoted as a counter-example (a rejected value) is the one legitimate "stray"; remove it from the README or accept the listing knowingly.

- [ ] **Step 3: Write `CLAUDE.md`**

```markdown
# Sepp's Workshop Design System

Token foundation for five theme ports (VS Code, Windows Terminal, PowerShell, fish, Starship). One medium-dark theme on sepp.med Darkblue. Source of truth is `tokens.json5`; everything else is generated. No npm dependencies — plain Node.

## Commands

- `npm run build` — regenerate `tokens.json`, `dist/tokens.js`, `colors.css` and `preview/*.html`, and run the gates
- `npm run check` — fail if any generated file is out of date or a gate fails
- `npm test` — unit tests for the colour maths, loader, gates, CSS and previews

Run `npm run build` after every change to `tokens.json5`.

## References

@README.md **Read when:** working on the palette, roles, gates, or the contract with the ports.

`docs/superpowers/specs/2026-10-01-design-system-foundation-design.md` **Read when:** you need the reasoning behind a value or a rule.

## Conventions

- `tokens.json5` is the only data file edited by hand.
- A hex literal is allowed only under `palette_base` and `derived`. Everything else is a `$` reference.
- Every colour is a brand colour, a 10 % ladder step, or one of the three named values in `derived`. Never add a hue.
- When a gate fails: move along the same ladder, then swap roles between brand hues.
- Signalred has no tints. Signalred and Freegreen are signals, not syntax colours.
- Red as text on a dark surface is `semantic.danger`; red as a fill is Signalred with white text.
- Overlays darken the canvas. A lighter selection fails gate 2.
- Docs are English, no emoji. Numbers in docs come from `tokens.json` or the build output.

## Don't

- Don't hand-edit `tokens.json`, `dist/tokens.js`, `colors.css` or `preview/*.html`.
- Don't lower a gate threshold to make a value pass.
- Don't copy the 76 MB icon source into the repo; only the renders in `assets/` belong here.
- Don't add font files. Themes cannot ship fonts; the foundation only recommends one.
- Don't commit secrets. Don't use `--force`.

## Learnings

When the user corrects a mistake or points out a recurring issue, append a one-line summary to `.claude/learnings.md`. Don't modify CLAUDE.md directly.

## Compact Instructions

When compacting, preserve: list of modified files, current test status, open TODOs, and key decisions made.
```

- [ ] **Step 4: Write `handoff/SKILL.md` and `handoff/README.md`**

`handoff/SKILL.md`:

````markdown
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

Read the foundation's `README.md` before writing a template: it explains every role.

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
- Overlays come from `tokens.overlay`. Do not define port-side alpha constants.
- `overlay.selected_item` and the `diff_*_text` overlays carry `fg` and `fg_muted` only.
- Controls are outlined with `border.control`, the focus ring is `accent`.
- The status bar stays on `surface.bg_sunk`; the accent appears as a border, not as its background. The debugging status bar uses the danger fill.
- Never rely on colour alone: pair a state colour with a border, an underline, a position or a font style.
- Recommend JetBrains Mono, and JetBrainsMono Nerd Font where the port shows icons. Ports cannot ship fonts.
- One theme per port. No variants.

## Voice

Port READMEs are English, exact where they are technical, relaxed elsewhere, no emoji. Each ends with the "Want to join Sepp's Workshop?" section linking to https://www.seppmed.com/career/.

## Feedback

After producing a theme, ask whether it used the foundation correctly and log corrections to `.claude/learnings.md`.
````

`handoff/README.md`:

```markdown
# Handoff

`SKILL.md` is a Claude Code skill for port repositories. Copy it to `.claude/skills/sepps-workshop/SKILL.md` in a port to make it available as `/sepps-workshop`.

It is not active in this repository.
```

- [ ] **Step 5: Write `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 — 2026-10-01

- Token foundation: brand palette with generated tint ladders, surfaces, text, borders, semantic roles, twelve core and twenty-four extended syntax slots, ANSI palette, overlay recipes, shell roles, prompt roles.
- Build with nine gates: WCAG AA text contrast on surfaces and overlays, ANSI contrast, non-text contrast, fills, distinctness, signal separation, palette integrity, overlay visibility.
- Generated `tokens.json`, `dist/tokens.js`, `colors.css` and four preview pages.
- Port handoff skill.
```

- [ ] **Step 6: Final verification**

Run: `npm test && npm run check && npx --yes prettier@3 --check README.md CLAUDE.md CHANGELOG.md handoff/ tokens.json5`
Expected: all tests pass; every check line starts with `✓`; Prettier reports no issues (run `npx prettier@3 --write` on the listed files if it does, then `npm run build && npm run check` again, since reformatting `tokens.json5` must not change the generated output).

- [ ] **Step 7: Commit**

```bash
git add README.md CLAUDE.md CHANGELOG.md handoff/
git commit -m "📝 docs: add README, project instructions and port handoff"
```
