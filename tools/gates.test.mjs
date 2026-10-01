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
