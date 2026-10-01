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
