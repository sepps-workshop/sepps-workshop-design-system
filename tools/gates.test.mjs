import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, cp, writeFile, symlink, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseTokens,
  resolveTokens,
  resolveTarget,
  contrast,
  check,
  contrastReport,
  json5ToJson,
  CODE_OVERLAYS,
  LABEL_OVERLAYS,
  SURFACE_OVERLAYS,
  NON_TEXT_OVERLAYS,
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
  }, /syntax\.function .* on surface\.bg .*4\.01:1/);
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
  }, /syntax\.type .* text\.fg .* are too alike/);
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
    r.semantic.success = "$palette.limegreen.70";
  }, /lightness/);
});

test("gate 8: a hex pasted into a role is named by path", () => {
  assertFails((r) => {
    r.syntax.keyword = "#ffcc00";
  }, /syntax\.keyword .*hex literal/);
});

test("gate 8: a ladder for Racing Red is refused", () => {
  assertFails((r) => {
    r.ladder.exclude = [];
  }, /racingred must not have a ladder/);
});

test("gate 8: bg_deep must follow its recipe", () => {
  assertFails((r) => {
    r.derived.bg_deep = "#0a2550";
  }, /derived\.bg_deep .* mix\(darkblue, darkblack, 0\.55\)/);
});

test("gate 8: the danger fill must follow its recipe", () => {
  assertFails((r) => {
    r.derived.racingred_fill = "#c81519";
  }, /derived\.racingred_fill .* mix\(racingred, darkblack, 0\.9\)/);
});

test("gate 8: the derived reds must keep the Racing Red hue", () => {
  assertFails((r) => {
    r.derived.racingred_on_dark = "#ff89c0";
  }, /derived\.racingred_on_dark .* hue/);
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

test("the report covers every surface and overlay the gates name", () => {
  const rows = contrastReport(resolveTokens(parseTokens(SRC)));
  const on = new Set(rows.map((r) => r.on));
  const expected = [
    ...["bg", "bg_chrome", "bg_overlay", "bg_soft"].map((s) => `surface.${s}`),
    ...[...CODE_OVERLAYS, ...LABEL_OVERLAYS].map((o) => `overlay.${o}`),
    ...SURFACE_OVERLAYS.flatMap((o) =>
      ["bg", "bg_chrome", "bg_overlay"].map(
        (s) => `overlay.${o} over surface.${s}`,
      ),
    ),
    "overlay.diff_inserted_text over overlay.diff_inserted_line",
    "overlay.diff_removed_text over overlay.diff_removed_line",
  ];
  assert.deepEqual([...on].sort(), expected.sort());
  assert.ok(
    rows.every((r) => r.ratio >= 4.5),
    "every reported text pair clears AA",
  );
  const body = rows.find((r) => r.label === "text.fg" && r.on === "surface.bg");
  assert.ok(Math.abs(body.lc) >= 75, "body text reaches APCA Lc 75");
});

/* ── Final-review fixes ──────────────────────────────────────────── */

test("a short hex in a gated slot is named by path, not thrown", () => {
  assertFails((r) => {
    r.syntax.keyword = "#fb0";
  }, /syntax\.keyword .*hex literal/);
});

test("a reference to a whole ladder is refused as not a colour", () => {
  assertFails((r) => {
    r.syntax.keyword = "$palette.sunset";
  }, /syntax\.keyword .*not a colour/);
  assertFails((r) => {
    r.border.subtle = "$palette.darkblue";
  }, /border\.subtle .*not a colour/);
});

test("an overlay without a numeric alpha is named", () => {
  assertFails((r) => {
    delete r.overlay.selection.alpha;
  }, /overlay\.selection\.alpha/);
});

test("a misspelt key in a role is refused", () => {
  assertFails((r) => {
    r.shell_roles.command = { colour: "function" };
  }, /shell_roles\.command.*unknown key "colour"/);
});

test("an unknown font style in a role is refused", () => {
  assertFails((r) => {
    r.shell_roles.comment.style = ["italics"];
  }, /shell_roles\.comment.*unknown style "italics"/);
});

test("text on the selected pager row is readable", () => {
  const t = resolveTokens(parseTokens(SRC));
  const row = t.overlay.selected_item.hex;
  for (const role of [
    "pager_selected_completion",
    "pager_selected_description",
    "pager_selected_prefix",
  ]) {
    assert.ok(t.shell_roles[role], `shell_roles.${role} is missing`);
    assert.ok(
      contrast(resolveTarget(t, t.shell_roles[role].color), row) >= 4.5,
      `${role} on the selected row`,
    );
  }
});

test("a failing build writes nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sw-build-"));
  await cp(new URL("../tools", import.meta.url), join(dir, "tools"), {
    recursive: true,
  });
  await writeFile(
    join(dir, "tokens.json5"),
    SRC.replace(
      'function: "$palette.windblue.50"',
      'function: "$palette.windblue.100"',
    ),
  );
  const run = spawnSync(
    process.execPath,
    [join(dir, "tools", "build-tokens.mjs")],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /syntax\.function/);
  assert.ok(
    !existsSync(join(dir, "tokens.json")),
    "tokens.json was written despite a gate failure",
  );
});

/* ── Deferred minors ─────────────────────────────────────────────── */

test("gate 6: two core slots may share a colour only if listed as aliases", () => {
  assertFails((r) => {
    r.syntax.keyword = "$palette.windblue.50";
  }, /syntax\.keyword and syntax\.function share .* syntax_tokens\.aliases/);
});

test("gate 6: an alias group naming an unknown slot is refused", () => {
  assertFails((r) => {
    r.syntax_tokens.aliases.push(["keyword", "keywrod"]);
  }, /syntax_tokens\.aliases .*"keywrod"/);
});

test("gate 6: every ANSI colour differs from its bright version", () => {
  assertFails((r) => {
    r.ansi.bright_yellow = "$palette.sunset.90";
  }, /ansi\.yellow .* ansi\.bright_yellow .* too alike/);
});

test("gate 4: the focus ring must reach 3:1", () => {
  assertFails((r) => {
    r.accent = "$palette.darkblue.70";
  }, /^✗ accent .*needs 3:1/);
});

test("gate 5: text on the accent must be readable", () => {
  assertFails((r) => {
    r.accent_on = "$palette.sunset.90";
  }, /accent_on .* on accent/);
});

test("gate 7: danger must not look like the accent or the warning", () => {
  assertFails((r) => {
    r.semantic.danger = "$palette.sunset.90";
  }, /accent .* semantic\.danger .* too alike/);
  assertFails((r) => {
    r.semantic.warning = "$palette.pumpelorange.70";
  }, /semantic\.warning .* semantic\.danger .* too alike/);
});

test("gate 9: selection and find match must not look alike", () => {
  assertFails((r) => {
    r.overlay.find_match.color = "$palette.darkblack.100";
    r.overlay.find_match.alpha = 0.6;
  }, /overlay\.selection .* overlay\.find_match .* too alike/);
});

test("gate 2: label overlays keep fg_muted readable", () => {
  assertFails((r) => {
    r.overlay.selected_item.alpha = 0.5;
  }, /text\.fg_muted .* on overlay\.selected_item/);
});

test("a syntax slot must not shadow a text colour or the accent", () => {
  assertFails((r) => {
    r.syntax.fg = "$palette.sunset.100";
  }, /syntax\.fg shadows/);
});

test("scopes: stray whitespace does not hide a meta scope", () => {
  assertFails((r) => {
    r.scope_recommendations.function.push("meta.function-call ");
  }, /scope_recommendations\.function .*meta\./);
  assertFails((r) => {
    r.scope_recommendations.function.push("source.js  meta.function-call");
  }, /scope_recommendations\.function .*meta\./);
});

test("gate 8: the terminal background is the chrome", () => {
  assertFails((r) => {
    r.surface.bg_terminal = "$palette.darkblue.90";
  }, /surface\.bg_terminal must equal surface\.bg_chrome/);
});

test("gate 8: the canvas must stand apart from the chrome and the terminal", () => {
  assertFails((r) => {
    r.surface.bg = "$palette.darkblue.100";
  }, /surface\.bg .* surface\.bg_terminal .* too alike/);
});

test("gate 8: floating widgets sit on the chrome", () => {
  assertFails((r) => {
    r.surface.bg_overlay = "$palette.darkblue.90";
  }, /surface\.bg_overlay must equal surface\.bg_chrome/);
});

test("gate 8: white has no ladder", () => {
  assertFails((r) => {
    r.ladder.exclude = ["racingred"];
  }, /white must not have a ladder/);
});

test("gate 8: a new derived value is refused", () => {
  assertFails((r) => {
    r.derived.teal = "#11aa99";
  }, /derived\.teal .*not one of the documented derived values/);
});

test("json5: an escaped quote in a single-quoted string survives", () => {
  assert.deepEqual(
    JSON.parse(json5ToJson("{ a: 'Sepp\\'s', b: \"x\\\"y\" }")),
    { a: "Sepp's", b: 'x"y' },
  );
});

async function scratchCopy() {
  const dir = await mkdtemp(join(tmpdir(), "sw-build-"));
  await cp(new URL("../tools", import.meta.url), join(dir, "tools"), {
    recursive: true,
  });
  await writeFile(join(dir, "tokens.json5"), SRC);
  return dir;
}
const runTool = (...args) =>
  spawnSync(process.execPath, args, { encoding: "utf8" });

test("the CLI runs when invoked through a symlinked path", async () => {
  const dir = await scratchCopy();
  const link = join(dir, "linked");
  await symlink(join(dir, "tools"), link);
  const run = runTool(join(link, "build-tokens.mjs"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /All gates pass/);
  assert.ok(existsSync(join(dir, "tokens.json")));
});

test("--check fails when a generated file has drifted", async () => {
  const dir = await scratchCopy();
  const tool = join(dir, "tools", "build-tokens.mjs");
  assert.equal(runTool(tool).status, 0);
  assert.equal(runTool(tool, "--check").status, 0);
  await appendFile(join(dir, "tokens.json"), "\n");
  const run = runTool(tool, "--check");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /tokens\.json out of date/);
});

test("shape: accent_hover must be a colour", () => {
  assertFails((r) => {
    r.accent_hover = "$palette.sunset";
  }, /accent_hover .*not a colour/);
});

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

test("gate 2: a lightening hover fails on the chrome too", () => {
  assertFails((r) => {
    r.overlay.hover = { color: "$palette.windblue.100", alpha: 0.3 };
  }, /on overlay\.hover over surface\.bg_chrome/);
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

test("gate 9: hover must be visible on the canvas and the chrome", () => {
  assertFails((r) => {
    r.overlay.hover.alpha = 0.05;
  }, /overlay\.hover over surface\.bg_chrome .* too alike/);
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

/* ── Final-review fixes (workbench overlays) ─────────────────────── */

test("a renamed overlay that a gate still names is reported, not thrown", () => {
  const i = NON_TEXT_OVERLAYS.indexOf("slider_active");
  NON_TEXT_OVERLAYS[i] = "slider_drag";
  try {
    assertFails((r) => {
      r.overlay.slider_drag = r.overlay.slider_active;
      delete r.overlay.slider_active;
    }, /overlay\.slider_active is used by a gate but not defined/);
  } finally {
    NON_TEXT_OVERLAYS[i] = "slider_active";
  }
});

test("gate 2: a surface overlay must darken, however faintly it lightens", () => {
  assertFails((r) => {
    r.overlay.hover = { color: "$palette.white.100", alpha: 0.05 };
  }, /overlay\.hover over surface\.bg .* lighter than the surface/);
});

/* ── Inline diff spans (0.2.1) ───────────────────────────────────── */

test("gate 2: a changed span stacked on its diff line keeps code readable", () => {
  assertFails((r) => {
    r.overlay.diff_inserted_text = {
      color: "$palette.limegreen.100",
      alpha: 0.25,
    };
  }, /syntax\.number .* on overlay\.diff_inserted_text over overlay\.diff_inserted_line/);
});

test("gate 9: a changed span must be visible on its diff line", () => {
  assertFails((r) => {
    r.overlay.diff_inserted_text.alpha = 0.05;
  }, /overlay\.diff_inserted_text over overlay\.diff_inserted_line .* too alike/);
});

test("the shipped diff spans darken their lines and carry code", () => {
  const t = resolveTokens(parseTokens(SRC));
  assert.equal(t.overlay.diff_inserted_text.color, t.palette.darkblack[100]);
  assert.ok(CODE_OVERLAYS.includes("diff_inserted_text"));
  assert.ok(CODE_OVERLAYS.includes("diff_removed_text"));
  assert.ok(LABEL_OVERLAYS.includes("merge_incoming_header"));
  assert.equal(t.overlay.merge_incoming_header.hex, "#284b45");
});
