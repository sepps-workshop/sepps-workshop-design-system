import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadTokens } from "./build-tokens.mjs";
import { renderReadme } from "./build-readme.mjs";

const tokens = await loadTokens();
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("the README's generated tables match the tokens", () => {
  assert.equal(renderReadme(tokens, readme), readme);
});

test("a table between markers is replaced, text outside is kept", () => {
  const out = renderReadme(
    tokens,
    "before\n\n<!-- tokens:palette -->\nstale\n<!-- /tokens -->\n\nafter\n",
  );
  assert.match(out, /^before\n\n<!-- tokens:palette -->\n\n\| Colour/);
  assert.ok(out.includes("| Darkblue     | `#0d3174` |"));
  assert.ok(!out.includes("stale"));
  assert.ok(out.endsWith("|\n\n<!-- /tokens -->\n\nafter\n"));
});

test("an unknown table name is an error", () => {
  assert.throws(
    () => renderReadme(tokens, "<!-- tokens:nope -->\n<!-- /tokens -->"),
    /Unknown README table: nope/,
  );
});

test("every table is present in the README", () => {
  for (const name of [
    "palette",
    "surfaces",
    "syntax",
    "extended",
    "semantic",
    "ansi",
    "overlay",
    "shell",
    "prompt",
  ]) {
    assert.ok(
      readme.includes(`<!-- tokens:${name} -->`),
      `README has no ${name} table marker`,
    );
  }
});
