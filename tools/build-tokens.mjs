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
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
