import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokens, colourTargets } from "./build-tokens.mjs";
import { cssVar, renderCss } from "./build-css.mjs";

const tokens = await loadTokens();
const css = renderCss(tokens);

test("cssVar maps every kind of colour target", () => {
  assert.equal(cssVar("keyword"), "--sw-syn-keyword");
  assert.equal(cssVar("fg_muted"), "--sw-fg-muted");
  assert.equal(cssVar("accent"), "--sw-accent");
  assert.equal(cssVar("accent_hover"), "--sw-accent-hover");
  assert.equal(cssVar("semantic.danger"), "--sw-danger");
  assert.equal(cssVar("overlay.find_match"), "--sw-overlay-find-match");
});

test("the stylesheet declares the documented properties with resolved values", () => {
  for (const line of [
    "--sw-bg: #14284c;",
    "--sw-bg-chrome: #0d3174;",
    "--sw-fg: #e7eaf1;",
    "--sw-accent: #fbba00;",
    "--sw-danger: #ff897b;",
    "--sw-danger-fill: #db191d;",
    "--sw-syn-keyword: #fbba00;",
    "--sw-ansi-bright-red: #ffb4aa;",
    "--sw-overlay-selection: #1b1f25;",
    "--sw-accent-hover: #fcc833;",
    "--sw-overlay-selection-hexa: #1d1d1bcc;",
    "--sw-overlay-hover: #17243b;",
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
  const targets = colourTargets(tokens);
  assert.ok(
    targets.includes("overlay.selected_item") &&
      targets.includes("semantic.warning"),
  );
  for (const t of targets)
    assert.ok(declared.has(cssVar(t)), `${t} → ${cssVar(t)} not declared`);
});

test("no property is declared twice", () => {
  const names = [...css.matchAll(/^\s*(--sw-[a-z0-9-]+):/gm)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length);
});
