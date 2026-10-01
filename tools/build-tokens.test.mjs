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

test("resolveTarget refuses a target with extra path segments", () => {
  const t = resolveTokens(fresh());
  assert.throws(
    () => resolveTarget(t, "semantic.danger.extra"),
    /Unknown colour target/,
  );
  assert.throws(
    () => resolveTarget(t, "overlay.selection.hex"),
    /Unknown colour target/,
  );
});

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
