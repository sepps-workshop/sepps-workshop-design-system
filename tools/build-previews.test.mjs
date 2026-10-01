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

test("sample lines are block elements with no newline between them", () => {
  // .line is display:block inside <pre>; a newline between two lines
  // would render as an extra blank row.
  for (const [name, html] of Object.entries(pages)) {
    assert.ok(!/<\/span>\n<span class="line/.test(html), `${name} double-spaces its samples`);
  }
});
