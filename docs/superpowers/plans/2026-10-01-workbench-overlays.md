# Workbench Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the overlay recipes, the `accent_hover` token, the generated `hexa` field and the gates that let the VS Code port work without any port-side alpha or hex value.

**Architecture:** Nine recipes and one accent token go into `tokens.json5`. `tools/build-tokens.mjs` gains a `hexa` field per overlay, four overlay classes with an exactly-one-class check, and extensions to gates 2, 3, 4, 5 and 9. `colors.css`, the previews, the README table and `handoff/SKILL.md` follow from the tokens.

**Tech Stack:** Node 18 or later, ES modules, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-01-workbench-overlays-design.md`

## Global Constraints

- No npm dependencies. All repo content in English, no emoji.
- `tokens.json5` is the only hand-edited data file. Never edit `tokens.json`, `dist/tokens.js`, `colors.css`, `preview/*.html` or the README tables between `<!-- tokens:… -->` markers; run `npm run build`. A PreToolUse hook blocks such edits.
- A PostToolUse hook runs `npm run build` after every edit to `tokens.json5` and reports an error if a gate fails; it cannot undo the edit. The task and step order below keeps the build green after every token edit; do not reorder.
- A hex literal may appear in `tokens.json5` only under `palette_base` and `derived`. No new entry under `derived`. No new hue.
- No gate threshold is lowered. If a value from this plan fails a gate, move it along its ladder or change its alpha, keep the threshold, and report the change.
- Thresholds, copied from the spec: text 4.5:1, non-text 3:1; OKLab distance (×100) at least 3 for `hover`, 5 for `active`, 7 for `slider`, 7 for `merge_current_header`, 3 for `accent_hover` against `accent`.
- Work on a branch `feat/workbench-overlays`. Commits: Conventional Commits with gitmoji, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push, tag or run `npm version`; the release is cut by the user with the `/release` skill. That skill bumps `package.json` only, so this plan sets `meta.version` in `tokens.json5` and writes the changelog section itself (Task 4).

## Review Focus

- Someone adds an overlay to `tokens.json5` and forgets to classify it: the build must name the overlay, not pass silently. (Task 2, class check test)
- Someone removes or renames an overlay that a class list still names: the build must report it by name, not throw a `TypeError` from inside the gates. (Task 2, class check test)
- A port reads `overlay.<name>.hexa` for an overlay whose recipe is malformed: `hexa` must be `null` and the shape check must name the recipe, as `hex` does today. (Task 1, malformed recipe test)
- Someone lightens `hover` to match Vivid Life's white wash: gate 2 must fail and say on which surface. (Task 2, surface overlay test)
- Someone strengthens the terminal selection with a hue: gate 3 must name the ANSI slot that became unreadable on it. (Task 2, ANSI test)

---

### Task 1: Tokens, `hexa` and `accent_hover`

**Files:**

- Modify: `tokens.json5` (accent block near line 78, overlay block near line 353)
- Modify: `tools/build-tokens.mjs` (`resolveTokens`, `resolveTarget`, shape check in `check`)
- Test: `tools/build-tokens.test.mjs`, `tools/gates.test.mjs`

**Interfaces:**

- Produces: `tokens.accent_hover` (`#rrggbb`); `tokens.overlay.<name>.hexa` (`#rrggbbaa` or `null`); overlays `hover`, `active`, `scrim`, `slider`, `slider_hover`, `slider_active`, `merge_current_content`, `merge_current_header`, `stack_frame`; `resolveTarget(tokens, "accent_hover")`.

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/workbench-overlays
```

- [ ] **Step 2: Write the failing tests**

Append to `tools/build-tokens.test.mjs`:

```js
test("overlays get a translucent hexa beside the composited hex", () => {
  const t = resolveTokens(fresh());
  assert.equal(t.overlay.selection.hexa, "#1b1d1c99");
  for (const [name, o] of Object.entries(t.overlay)) {
    assert.match(o.hexa, /^#[0-9a-f]{8}$/, `overlay.${name}.hexa`);
    assert.equal(o.hexa.slice(0, 7), o.color, `overlay.${name}.hexa colour`);
  }
});

test("a malformed recipe gets neither hex nor hexa", () => {
  const raw = fresh();
  delete raw.overlay.selection.alpha;
  const t = resolveTokens(raw);
  assert.equal(t.overlay.selection.hex, null);
  assert.equal(t.overlay.selection.hexa, null);
});

test("the workbench overlays and accent_hover resolve", () => {
  const t = resolveTokens(fresh());
  assert.equal(t.overlay.hover.hex, "#112b5a");
  assert.equal(t.overlay.active.hex, "#142748");
  assert.equal(t.overlay.scrim.hex, "#15253f");
  assert.equal(t.overlay.slider.hex, "#39568d");
  assert.equal(t.overlay.slider_hover.hex, "#566f9e");
  assert.equal(t.overlay.slider_active.hex, "#7388ae");
  assert.equal(t.overlay.merge_current_content.hex, "#0c3b7e");
  assert.equal(t.overlay.merge_current_header.hex, "#0a4a8c");
  assert.equal(t.overlay.stack_frame.hex, "#243c6e");
  assert.equal(t.accent_hover, "#fcc833");
  assert.equal(resolveTarget(t, "accent_hover"), "#fcc833");
});
```

Append to `tools/gates.test.mjs`:

```js
test("shape: accent_hover must be a colour", () => {
  assertFails((r) => {
    r.accent_hover = "$palette.sunset";
  }, /accent_hover .*not a colour/);
});
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npm test`
Expected: the four new tests fail (`hexa` is `undefined`, `t.overlay.hover` is `undefined`, no failure matching `accent_hover`). Everything else passes.

- [ ] **Step 4: Emit `hexa` and accept `accent_hover` in `tools/build-tokens.mjs`**

In `resolveTokens`, replace the overlay loop:

```js
for (const o of Object.values(tokens.overlay)) {
  // A malformed recipe gets no hex here; check() reports it by path.
  const ok = isColour(o.color) && isAlpha(o.alpha);
  o.hex =
    ok && isColour(tokens.surface.bg)
      ? alphaOver(o.color, tokens.surface.bg, o.alpha)
      : null;
  // The recipe itself as #rrggbbaa, for ports that can blend.
  o.hexa = ok
    ? o.color +
      Math.round(o.alpha * 255)
        .toString(16)
        .padStart(2, "0")
    : null;
}
```

Update the doc comment above `resolveTokens`: item 3 becomes `every overlay given \`hex\` (composited over surface.bg) and \`hexa\` (the recipe as #rrggbbaa)`.

In `resolveTarget`, after the `accent` line:

```js
if (target === "accent_hover") return tokens.accent_hover;
```

In `check`, after `colour("accent_on", tokens.accent_on);`:

```js
colour("accent_hover", tokens.accent_hover);
```

- [ ] **Step 5: Add the tokens to `tokens.json5`**

Make the `accent_hover` edit first and on its own. After Step 4 the build requires `accent_hover` to be a colour, and the hook builds after every edit to this file, so any other edit made before it reports a failure.

After the `accent_on` line:

```js
  accent_hover: "$palette.sunset.80", // primary button under the pointer; the ladder only goes lighter
```

Replace the comment block above `overlay: {` with:

```js
// ── 7. OVERLAYS ─────────────────────────────────────────────────
// { color, alpha, border? }. The build adds `hex` (composited over
// surface.bg, for ports that cannot blend) and `hexa` (the recipe as
// #rrggbbaa, for ports that can). Overlays DARKEN: on a medium-dark
// canvas a lighter selection takes saturated colours below 4.5:1, a
// darker one adds contrast. Hued highlights stay faint and get a
// border. Every overlay belongs to exactly one class in
// tools/build-tokens.mjs: code, label, surface or non-text.
```

Append inside `overlay`, after `diff_removed_text`:

```js
    // Surface overlays: also drawn over bg_sunk and bg_overlay, and gated there.
    hover: { color: "$palette.darkblack.100", alpha: 0.3 }, // the row under the pointer
    active: { color: "$palette.darkblack.100", alpha: 0.5 }, // drop target, pressed item
    // Non-text: nothing is read through these.
    scrim: { color: "$palette.darkblack.100", alpha: 0.6 }, // widget and scrollbar shadow
    slider: { color: "$palette.darkblue.40", alpha: 0.3 }, // scrollbar and minimap thumb
    slider_hover: { color: "$palette.darkblue.40", alpha: 0.5 },
    slider_active: { color: "$palette.darkblue.40", alpha: 0.7 },
    // Merge editor, "current" side. "Incoming" reuses diff_inserted_*.
    merge_current_content: { color: "$palette.windblue.100", alpha: 0.1 },
    merge_current_header: { color: "$palette.windblue.100", alpha: 0.25 }, // fg / fg_muted only
    // One recipe for both debugger frames; the gutter arrow tells them apart.
    stack_frame: { color: "$palette.lightorange.100", alpha: 0.1 },
```

The hook runs `npm run build`. Expected: it passes, because the current build does not gate overlays it has no list entry for. Task 2 closes that.

- [ ] **Step 6: Run the tests and see them pass**

Run: `npm test`
Expected: all pass. If `the README's generated tables match the tokens` fails, run `npm run build` once and rerun.

- [ ] **Step 7: Commit**

```bash
git add tokens.json5 tokens.json dist/tokens.js colors.css preview README.md tools/build-tokens.mjs tools/build-tokens.test.mjs tools/gates.test.mjs
git commit -m "✨ feat: add workbench overlay recipes, accent_hover and a hexa field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Overlay classes and gates

**Files:**

- Modify: `tools/build-tokens.mjs` (constants near line 202, `textPairs`, `check`)
- Test: `tools/gates.test.mjs`

**Interfaces:**

- Consumes: the tokens from Task 1.
- Produces: exports `CODE_OVERLAYS`, `LABEL_OVERLAYS`, `SURFACE_OVERLAYS`, `NON_TEXT_OVERLAYS` (arrays of overlay names). `contrastReport(tokens)` rows for surface overlays carry `on: "overlay.<name> over surface.<surface>"`.

- [ ] **Step 1: Write the failing tests**

In `tools/gates.test.mjs`, add `SURFACE_OVERLAYS` and `NON_TEXT_OVERLAYS` to the import from `./build-tokens.mjs`, then append:

```js
/* ── Workbench overlays ──────────────────────────────────────────── */

test("classes: an overlay in no class is named", () => {
  assertFails((r) => {
    r.overlay.glow = { color: "$palette.sunset.100", alpha: 0.1 };
  }, /overlay\.glow is in no class/);
});

test("classes: a class naming a missing overlay is reported, not thrown", () => {
  assertFails((r) => {
    delete r.overlay.hover;
  }, /overlay\.hover is listed in the surface class but not defined/);
});

test("classes: every shipped overlay is in exactly one class", () => {
  const t = resolveTokens(parseTokens(SRC));
  const all = [
    ...CODE_OVERLAYS,
    ...LABEL_OVERLAYS,
    ...SURFACE_OVERLAYS,
    ...NON_TEXT_OVERLAYS,
  ];
  assert.deepEqual([...all].sort(), Object.keys(t.overlay).sort());
  assert.equal(new Set(all).size, all.length);
});

test("gate 2: the merge content fill keeps code readable", () => {
  assertFails((r) => {
    r.overlay.merge_current_content.alpha = 0.3;
  }, /on overlay\.merge_current_content/);
});

test("gate 2: the stack frame fill keeps code readable", () => {
  assertFails((r) => {
    r.overlay.stack_frame.alpha = 0.25;
  }, /on overlay\.stack_frame/);
});

test("gate 2: the merge header keeps fg_muted readable", () => {
  assertFails((r) => {
    r.overlay.merge_current_header.alpha = 0.5;
  }, /text\.fg_muted .* on overlay\.merge_current_header/);
});

test("gate 2: a lightening hover fails on the sunk surface too", () => {
  assertFails((r) => {
    r.overlay.hover = { color: "$palette.windblue.100", alpha: 0.3 };
  }, /on overlay\.hover over surface\.bg_sunk/);
});

test("gate 3: ANSI colours stay readable on the terminal selection", () => {
  assertFails((r) => {
    r.overlay.selection_inactive = {
      color: "$palette.middleblue.100",
      alpha: 0.4,
    };
  }, /ansi\.blue .* on overlay\.selection_inactive/);
});

test("gate 4: the dragged slider reaches 3:1", () => {
  assertFails((r) => {
    r.overlay.slider_active.alpha = 0.5;
  }, /overlay\.slider_active .*needs 3:1/);
});

test("gate 5: text on the hovered accent must be readable", () => {
  assertFails((r) => {
    r.accent_hover = "$palette.darkblue.80";
  }, /accent_on .* on accent_hover/);
});

test("gate 9: hover must be visible on the canvas and the sunk surface", () => {
  assertFails((r) => {
    r.overlay.hover.alpha = 0.05;
  }, /overlay\.hover over surface\.bg_sunk .* too alike/);
});

test("gate 9: the resting slider must be visible", () => {
  assertFails((r) => {
    r.overlay.slider.alpha = 0.1;
  }, /overlay\.slider over surface\.bg .* too alike/);
});

test("gate 9: accent_hover must differ from the accent", () => {
  assertFails((r) => {
    r.accent_hover = "$palette.sunset.90";
  }, /accent_hover .* accent .* too alike/);
});
```

Replace the `expected` array in the existing test `the report covers every surface and overlay the gates name`:

```js
const expected = [
  ...["bg", "bg_sunk", "bg_overlay", "bg_soft"].map((s) => `surface.${s}`),
  ...[...CODE_OVERLAYS, ...LABEL_OVERLAYS].map((o) => `overlay.${o}`),
  ...SURFACE_OVERLAYS.flatMap((o) =>
    ["bg", "bg_sunk", "bg_overlay"].map(
      (s) => `overlay.${o} over surface.${s}`,
    ),
  ),
];
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tools/gates.test.mjs`
Expected: the file fails to load, because `SURFACE_OVERLAYS` is not exported.

- [ ] **Step 3: Add the classes and helpers in `tools/build-tokens.mjs`**

Replace the `CODE_OVERLAYS` and `LABEL_OVERLAYS` definitions with:

```js
/** Overlays that sit behind whole lines of code, over the canvas. */
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
  "merge_current_content",
  "stack_frame",
];
/** Overlays that sit behind list rows and inline spans: fg / fg_muted only. */
export const LABEL_OVERLAYS = [
  "selected_item",
  "diff_inserted_text",
  "diff_removed_text",
  "merge_current_header",
];
/** Overlays drawn over every code surface, gated as code on each. */
export const SURFACE_OVERLAYS = ["hover", "active"];
/** Overlays nothing is read through: shadow and scrollbar thumbs. */
export const NON_TEXT_OVERLAYS = [
  "scrim",
  "slider",
  "slider_hover",
  "slider_active",
];
/** Every overlay must be in exactly one of these. */
const OVERLAY_CLASSES = {
  code: CODE_OVERLAYS,
  label: LABEL_OVERLAYS,
  surface: SURFACE_OVERLAYS,
  "non-text": NON_TEXT_OVERLAYS,
};
/** The terminal draws selected text in its ANSI colour on these. */
const TERMINAL_SELECTIONS = ["selection", "selection_inactive"];
/** [overlay, surfaces, minimum OKLab distance from each surface]. */
const VISIBLE_OVERLAYS = [
  ["hover", ["bg", "bg_sunk"], 3],
  ["active", ["bg", "bg_sunk"], 5],
  ["slider", ["bg", "bg_sunk"], DISTINCT],
  ["merge_current_header", ["bg"], DISTINCT],
];
/** accent_hover is seen only in succession to accent on the same button. */
const HOVER_STEP = 3;

/** An overlay recipe composited over a named surface. */
const over = (tokens, name, surface) =>
  alphaOver(
    tokens.overlay[name].color,
    tokens.surface[surface],
    tokens.overlay[name].alpha,
  );
```

`VISIBLE_OVERLAYS` uses `DISTINCT`, which is declared above it. Keep it that way.

In `textPairs`, before `return pairs;`:

```js
for (const o of SURFACE_OVERLAYS)
  for (const s of CODE_SURFACES)
    add(codeText(tokens), `overlay.${o} over surface.${s}`, over(tokens, o, s));
```

- [ ] **Step 4: Add the class check and the gate extensions in `check`**

In the "Structure next" block, directly before its closing `if (fail.length) return fail;`:

```js
for (const name of Object.keys(tokens.overlay)) {
  const found = Object.keys(OVERLAY_CLASSES).filter((c) =>
    OVERLAY_CLASSES[c].includes(name),
  );
  if (found.length !== 1) {
    fail.push(
      `✗ overlay.${name} is in ${found.length ? found.join(" and ") : "no class"}: every overlay needs exactly one of ${Object.keys(OVERLAY_CLASSES).join(", ")} (tools/build-tokens.mjs)`,
    );
  }
}
for (const [cls, list] of Object.entries(OVERLAY_CLASSES)) {
  for (const name of list) {
    if (!Object.hasOwn(tokens.overlay, name)) {
      fail.push(
        `✗ overlay.${name} is listed in the ${cls} class but not defined`,
      );
    }
  }
}
```

In gate 3, inside the `if (!ANSI_EXEMPT.has(slot))` block, after the existing `need(...)`:

```js
for (const o of TERMINAL_SELECTIONS)
  need(`ansi.${slot}`, color, `overlay.${o}`, tokens.overlay[o].hex, AA);
```

In gate 4, after the loop over overlay borders:

```js
for (const s of ["bg", "bg_sunk"])
  need(
    "overlay.slider_active",
    over(tokens, "slider_active", s),
    `surface.${s}`,
    tokens.surface[s],
    NON_TEXT,
  );
```

In gate 5, after the `accent_on` line:

```js
need("accent_on", tokens.accent_on, "accent_hover", tokens.accent_hover, AA);
```

In gate 9, before `return fail;`:

```js
for (const [name, surfaces, min] of VISIBLE_OVERLAYS)
  for (const s of surfaces)
    apart(
      `overlay.${name} over surface.${s}`,
      over(tokens, name, s),
      `surface.${s}`,
      tokens.surface[s],
      min,
    );
apart("accent_hover", tokens.accent_hover, "accent", tokens.accent, HOVER_STEP);
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`
Expected: all pass except `the README's generated tables match the tokens`. That one compares the README on disk, where `merge_current_header` still says `code`, with a table that now says `` `fg`, `fg_muted` ``; Step 6 rebuilds it. `the shipped tokens pass every gate` must pass. If that one fails, the message names the pair; apply the fix order from Global Constraints and note the changed value for the final report.

- [ ] **Step 6: Rebuild and commit**

Run: `npm run build && npm run check`
Expected: `All gates pass` with a larger pair count than before, then every `--check` line prints a tick. `preview/04-contrast.html` changes, because the report now has rows for hover and active.

```bash
git add tools/build-tokens.mjs tools/gates.test.mjs tokens.json dist/tokens.js colors.css preview README.md
git commit -m "✨ feat: classify every overlay and gate the workbench ones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Stylesheet and previews

**Files:**

- Modify: `tools/build-css.mjs` (`cssVar`, the Accent and Overlays sections of `renderCss`)
- Modify: `tools/build-previews.mjs` (`STATES`, `renderPages`)
- Test: `tools/build-css.test.mjs`, `tools/build-previews.test.mjs`

**Interfaces:**

- Consumes: `tokens.accent_hover`, `tokens.overlay.<name>.hexa` from Task 1.
- Produces: custom properties `--sw-accent-hover` and `--sw-overlay-<name>-hexa` for every overlay; `cssVar("accent_hover")` returns `"--sw-accent-hover"`.

- [ ] **Step 1: Write the failing tests**

In `tools/build-css.test.mjs`, add to the test `cssVar maps every kind of colour target`:

```js
assert.equal(cssVar("accent_hover"), "--sw-accent-hover");
```

and add to the list in `the stylesheet declares the documented properties with resolved values`:

```js
    "--sw-accent-hover: #fcc833;",
    "--sw-overlay-selection-hexa: #1b1d1c99;",
    "--sw-overlay-hover: #112b5a;",
```

In `tools/build-previews.test.mjs`, add `"merge_current_content"` and `"stack_frame"` to the overlay list in `the syntax page exercises every core slot and the code overlays`, and append:

```js
test("the syntax page shows the workbench overlays on the canvas and the sunk surface", () => {
  const html = pages["01-syntax.html"];
  for (const o of [
    "hover",
    "active",
    "slider",
    "slider-hover",
    "slider-active",
  ]) {
    const uses =
      html.split(`style="background:var(--sw-overlay-${o}-hexa)"`).length - 1;
    assert.equal(uses, 2, `${o} is shown ${uses} times, expected 2`);
  }
  assert.ok(html.includes('<pre class="sunk">'), "no sunk sample block");
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tools/build-css.test.mjs tools/build-previews.test.mjs`
Expected: four failures (`cssVar`, missing properties, no sample line on `merge_current_content`, workbench overlays shown 0 times).

- [ ] **Step 3: Extend `tools/build-css.mjs`**

In `cssVar`, after the `accent` line:

```js
if (target === "accent_hover") return "--sw-accent-hover";
```

Replace the Accent and Overlays sections of `renderCss`:

```js
section("Accent", [
  ["--sw-accent", tokens.accent],
  ["--sw-accent-on", tokens.accent_on],
  ["--sw-accent-hover", tokens.accent_hover],
]);
```

```js
section(
  "Overlays — composited over --sw-bg; -hexa is the translucent recipe",
  Object.entries(tokens.overlay).flatMap(([k, o]) => [
    [`--sw-overlay-${kebab(k)}`, o.hex],
    [`--sw-overlay-${kebab(k)}-hexa`, o.hexa],
    ...(o.border ? [[`--sw-overlay-${kebab(k)}-border`, o.border]] : []),
  ]),
);
```

- [ ] **Step 4: Extend `tools/build-previews.mjs`**

Append two lines to the `STATES` template string, after the `@diff_removed_line|` line and inside the backticks:

```
@merge_current_content|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// merge, current side]] [[invalid:error text]]
@stack_frame|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// debugger paused here]] [[invalid:error text]]
```

Above `export function renderPages`, add:

```js
/** Surface and non-text overlays, drawn translucent so they show on any surface. */
const WORKBENCH = [
  "hover",
  "active",
  "slider",
  "slider_hover",
  "slider_active",
];
const workbench = (cls) =>
  `<pre${cls ? ` class="${cls}"` : ""}>` +
  WORKBENCH.map(
    (n) =>
      `<span class="line" style="background:var(--sw-overlay-${kebab(n)}-hexa)">${n}</span>`,
  ).join("") +
  `</pre>`;
```

In `renderPages`, in the `syntax` array, directly after the `block("Editor states …", STATES, "t-")` entry:

```js
    `<section><h2>Workbench overlays — on the canvas, then on the sunk surface</h2>${workbench("")}${workbench("sunk")}</section>`,
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Rebuild, look, commit**

Run: `npm run build && npm run check`
Expected: all ticks.

Open `preview/01-syntax.html` in a browser. Check by eye: the comment and the red "error text" are readable on the merge and stack-frame lines; `hover` is visible in the sunk block. If one is not, say so in the final report; do not change a value without a failing gate.

```bash
git add tools/build-css.mjs tools/build-css.test.mjs tools/build-previews.mjs tools/build-previews.test.mjs colors.css preview
git commit -m "✨ feat: expose hexa and accent-hover in colors.css, preview the workbench overlays

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: README, handoff skill, changelog

**Files:**

- Modify: `tools/build-readme.mjs` (import, `surfaces` and `overlay` tables)
- Modify: `README.md` (Overlays prose, Build gates, For ports)
- Modify: `handoff/SKILL.md`, `CHANGELOG.md`
- Test: `tools/build-readme.test.mjs`

**Interfaces:**

- Consumes: `SURFACE_OVERLAYS`, `NON_TEXT_OVERLAYS`, `LABEL_OVERLAYS` from Task 2; `tokens.accent_hover` from Task 1.

- [ ] **Step 1: Write the failing test**

Append to `tools/build-readme.test.mjs`:

```js
test("the overlay table names the class of each recipe", () => {
  const out = renderReadme(tokens, "<!-- tokens:overlay -->\n<!-- /tokens -->");
  assert.match(out, /`hover`\s.*\|\s+surface\s+\|/);
  assert.match(out, /`scrim`\s.*\|\s+non-text\s+\|/);
  assert.match(out, /`stack_frame`\s.*\|\s+code\s+\|/);
  assert.match(out, /`merge_current_header`\s.*`fg`, `fg_muted`/);
});

test("the surfaces table lists accent_hover", () => {
  const out = renderReadme(
    tokens,
    "<!-- tokens:surfaces -->\n<!-- /tokens -->",
  );
  assert.match(out, /`accent_hover`\s+\|\s+`sunset\.80`\s+\|\s+`#fcc833`/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/build-readme.test.mjs`
Expected: both new tests fail (`hover` row says `code`, no `accent_hover` row).

- [ ] **Step 3: Update `tools/build-readme.mjs`**

Extend the import:

```js
import {
  loadTokens,
  parseTokens,
  contrast,
  LABEL_OVERLAYS,
  SURFACE_OVERLAYS,
  NON_TEXT_OVERLAYS,
} from "./build-tokens.mjs";
```

Inside `tables`, next to the other small helpers:

```js
const carries = (k) =>
  LABEL_OVERLAYS.includes(k)
    ? "`fg`, `fg_muted`"
    : SURFACE_OVERLAYS.includes(k)
      ? "surface"
      : NON_TEXT_OVERLAYS.includes(k)
        ? "non-text"
        : "code";
```

In the `overlay` table, replace the last cell `LABEL_OVERLAYS.includes(k) ? "\`fg\`, \`fg_muted\`" : "code"`with`carries(k)`.

In the `surfaces` table, after the `accent_on` row:

```js
          [
            "`accent_hover`",
            source(raw.accent_hover),
            code(tokens.accent_hover),
            ratio(tokens.accent_hover),
            "Primary button under the pointer",
          ],
```

- [ ] **Step 4: Run the tests, then rebuild the README tables**

Run: `node --test tools/build-readme.test.mjs`
Expected: the two new tests pass; `the README's generated tables match the tokens` fails until the next command.

Run: `npm run build && npm test`
Expected: all pass.

- [ ] **Step 5: Update the README prose**

In `## Overlays`, replace the first paragraph with:

```markdown
Recipes for the backgrounds that appear behind text and for a few workbench surfaces: `{ color, alpha, border? }`. The build adds two values to each. `hex` is the recipe composited over `surface.bg`, for a port that cannot blend. `hexa` is the recipe itself as `#rrggbbaa`, for a port that can. Over the canvas both look the same.
```

Replace the paragraph that starts "Overlays marked "code" sit behind whole lines" with:

```markdown
The last column is the overlay's class, and every overlay has exactly one:

- **code** overlays sit behind whole lines on the canvas and are checked against every syntax colour.
- **`fg`, `fg_muted`** overlays sit behind list rows, headers and inline spans and carry those two text colours only.
- **surface** overlays (`hover`, `active`) are also drawn over the sidebar, the status bar and menus. They are checked as code overlays on `bg`, `bg_sunk` and `bg_overlay`, so a port must use `hexa` for them.
- **non-text** overlays are the shadow and the scrollbar thumbs. Nothing is read through them.

The debugger has two frame highlights and the foundation has one recipe, `stack_frame`: a second faint hue would not separate from the first on Darkblue. Ports tell the frames apart by the gutter arrow.
```

In `## Build gates`, extend the numbered items by appending these sentences:

- Item 2: ` \`hover\` and \`active\` are checked the same way on \`bg\`, \`bg_sunk\` and \`bg_overlay\`.`
- Item 3: ` The same fifteen reach 4.5:1 on \`overlay.selection\` and \`overlay.selection_inactive\`, where a terminal draws selected text.`
- Item 4: ` \`slider_active\` reaches 3:1 on \`bg\` and \`bg_sunk\`.`
- Item 5: change "and `accent_on` on `accent`, reach 4.5:1" to "and `accent_on` on `accent` and on `accent_hover`, reach 4.5:1".
- Item 9: ` \`hover\` is at least 3 from \`bg\` and \`bg_sunk\`, \`active\` at least 5, \`slider\` at least 7. \`merge_current_header\` is at least 7 from \`bg\`. \`accent_hover\` is at least 3 from \`accent\`.`

In the paragraph after the list ("Before the gates run, the build checks the shape…"), insert after "every overlay has an alpha,": ` every overlay belongs to exactly one class,`.

In `## For ports`, replace rule 5 with:

```markdown
5. Overlays come from `overlay.<name>`: `.hexa` where the target blends, `.hex` where it cannot, `.border` where present. No alpha constants in the port.
```

- [ ] **Step 6: Update `handoff/SKILL.md`**

Replace the table row that starts `| Selection, find, word highlight, diff` with these rows:

```markdown
| Selection, find, word highlight, diff | `tokens.overlay.<name>`: `.hexa` where the target blends, `.hex` where it cannot, `.border` where present |
| Row hover, drop target, pressed item | `overlay.hover`, `overlay.active` (always `.hexa`: they sit on every surface) |
| Shadow, scrollbar and minimap thumbs | `overlay.scrim`, `overlay.slider`, `slider_hover`, `slider_active` |
| Merge editor | current: `overlay.merge_current_*`; incoming: `overlay.diff_inserted_line` / `_text`; common: `overlay.hover` / `active` |
| Debugger frames | `overlay.stack_frame` for both; the gutter arrow takes `semantic.warning` (top) and `semantic.success` (focused) |
| Primary button under the pointer | `tokens.accent_hover` |
```

Replace the hard rule that starts "Overlays come from `tokens.overlay`" with:

```markdown
- Overlays come from `tokens.overlay`, with no port-side alpha constants and no string building: read `.hexa` or `.hex`. `overlay.selected_item`, `merge_current_header` and the `diff_*_text` overlays carry `fg` and `fg_muted` only.
- A VS Code key with no role in the foundation stays at its default. Do not approximate it.
```

- [ ] **Step 7: Set the version and add the changelog entry**

In `tokens.json5`, change `meta.version` from `"0.1.0"` to `"0.2.0"`. The hook rebuilds; the header line of `colors.css` now says 0.2.0. Leave `package.json` alone: `npm version minor` in the `/release` skill bumps it and creates the tag.

Use today's date in the heading if it is no longer 2026-10-01.

Insert above `## 0.1.0 — 2026-10-01` in `CHANGELOG.md`:

```markdown
## 0.2.0 — 2026-10-01

- Nine overlay recipes for workbench surfaces: `hover`, `active`, `scrim`, `slider`, `slider_hover`, `slider_active`, `merge_current_content`, `merge_current_header`, `stack_frame`.
- `accent_hover`, one ladder step lighter than the accent.
- Every overlay gains `hexa`, the recipe as `#rrggbbaa`, beside the composited `hex`. `colors.css` gains `--sw-overlay-<name>-hexa` and `--sw-accent-hover`.
- Every overlay must belong to exactly one class (code, label, surface, non-text), or the build fails.
- Gates: `hover` and `active` are checked on every code surface; ANSI colours are checked on the selection; `slider_active` reaches 3:1; `accent_on` is checked on `accent_hover`; new visibility minimums for hover, active, slider, the merge header and `accent_hover`.
```

- [ ] **Step 8: Verify and commit**

Run: `npm run build && npm run check && npm test`
Expected: all ticks, all tests pass. The README overlay table has 21 rows.

```bash
git add tools/build-readme.mjs tools/build-readme.test.mjs README.md handoff/SKILL.md CHANGELOG.md tokens.json5 tokens.json dist/tokens.js colors.css preview
git commit -m "📝 docs: document the workbench overlays, hexa and the overlay classes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Final verification and handoff

**Files:** none changed.

- [ ] **Step 1: Run everything from a clean state**

```bash
git status --short
npm run check
npm test
```

Expected: empty status, every `--check` line ticks, all tests pass.

- [ ] **Step 2: Confirm the port-facing contract**

```bash
node -e '
import("./dist/tokens.js").then(({ default: t }) => {
  const bad = Object.entries(t.overlay).filter(([, o]) => !/^#[0-9a-f]{8}$/.test(o.hexa));
  console.log("overlays:", Object.keys(t.overlay).length, "bad hexa:", bad.length, "accent_hover:", t.accent_hover);
});'
```

Expected: `overlays: 21 bad hexa: 0 accent_hover: #fcc833`

- [ ] **Step 3: Report**

Report to the user: the commits on `feat/workbench-overlays`, any value that had to move from the spec and why, and anything that looked wrong in the preview. Then stop. Merging, `npm version minor`, the tag and the push belong to the user's `/release` run. Tell the user that the `## 0.2.0` changelog section and `meta.version` are already in place, so step 3 of `/release` only needs to confirm the date.
