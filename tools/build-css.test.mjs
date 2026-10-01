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
