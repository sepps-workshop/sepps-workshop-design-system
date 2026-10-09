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
import { realpathSync } from "node:fs";
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
          // \' is not a JSON escape; inside '…' it is just a quote.
          s += c === "'" && src[i + 1] === "'" ? "'" : src[i] + src[i + 1];
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

const isColour = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const isAlpha = (v) => typeof v === "number" && v > 0 && v <= 1;

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
 *   3. every overlay given `hex` (composited over surface.bg),
 *      `hex_terminal` (composited over surface.bg_terminal) and
 *      `hexa` (the recipe as #rrggbbaa)
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
    // A malformed recipe gets no hex here; check() reports it by path.
    const ok = isColour(o.color) && isAlpha(o.alpha);
    o.hex =
      ok && isColour(tokens.surface.bg)
        ? alphaOver(o.color, tokens.surface.bg, o.alpha)
        : null;
    // The same recipe where a shell paints it: over the terminal background.
    o.hex_terminal =
      ok && isColour(tokens.surface.bg_terminal)
        ? alphaOver(o.color, tokens.surface.bg_terminal, o.alpha)
        : null;
    // The recipe itself as #rrggbbaa, for ports that can blend.
    o.hexa = ok
      ? o.color +
        Math.round(o.alpha * 255)
          .toString(16)
          .padStart(2, "0")
      : null;
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
  if (target === "accent_hover") return tokens.accent_hover;
  if (Object.hasOwn(tokens.syntax, target)) return tokens.syntax[target];
  if (Object.hasOwn(tokens.text, target)) return tokens.text[target];
  const [group, key, ...extra] = String(target).split(".");
  if (key !== undefined && extra.length === 0) {
    if (group === "semantic" && Object.hasOwn(tokens.semantic, key)) {
      return tokens.semantic[key];
    }
    if (group === "overlay" && Object.hasOwn(tokens.overlay, key)) {
      return tokens.overlay[key].hex;
    }
  }
  throw new Error(`Unknown colour target: ${target}`);
}

/* ── Gates ───────────────────────────────────────────────────────── */

const AA = 4.5;
const NON_TEXT = 3;
const DISTINCT = 7;
const LIGHTNESS_GAP = 5;
const HUE_TOLERANCE = 0.03; // radians
/** The only values allowed outside the palette and its ladders. */
const DERIVED_KEYS = [
  "bg_deep",
  "racingred_on_dark",
  "racingred_on_dark_bright",
  "racingred_fill",
];
/** Surfaces the spec defines as equal: terminal = chrome, widgets = chrome. */
const SAME_SURFACE = [
  ["bg_terminal", "bg_chrome"],
  ["bg_overlay", "bg_chrome"],
];
/** The canvas must read as a different surface from each of these. */
const APART_FROM_CANVAS = ["bg_chrome", "bg_terminal"];

const CODE_SURFACES = ["bg", "bg_chrome", "bg_overlay"];
const CONTROL_SURFACES = ["bg", "bg_chrome", "bg_soft", "bg_overlay"];
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
  "diff_inserted_text",
  "diff_removed_text",
];
/** Overlays that sit behind list rows and headers: fg / fg_muted only. */
export const LABEL_OVERLAYS = [
  "selected_item",
  "merge_current_header",
  "merge_incoming_header",
];
/** [span, line]: an editor draws the span on top of the line, behind code. */
const DIFF_STACKS = [
  ["diff_inserted_text", "diff_inserted_line"],
  ["diff_removed_text", "diff_removed_line"],
];
/** A changed span is a detail inside a line that is already marked. */
const SPAN_STEP = 5;
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
  ["hover", ["bg", "bg_chrome"], 3],
  ["active", ["bg", "bg_chrome"], 5],
  ["slider", ["bg", "bg_chrome"], DISTINCT],
  ["merge_current_header", ["bg"], DISTINCT],
];
/** Overlays a gate reads by name; each must exist before the gates run. */
const GATED_BY_NAME = [
  ...TERMINAL_SELECTIONS,
  ...VISIBLE_OVERLAYS.map(([name]) => name),
  ...DIFF_STACKS.flat(),
  "slider_active",
  "find_match",
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
/** A diff span composited over its line, itself composited over the canvas. */
const stacked = (tokens, span, line) =>
  alphaOver(
    tokens.overlay[span].color,
    tokens.overlay[line].hex,
    tokens.overlay[span].alpha,
  );

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
/** The only keys a role object may have, and the font styles it may name. */
const ROLE_KEYS = new Set(["color", "style", "fish", "psreadline"]);
const STYLES = new Set(["italic", "bold", "underline"]);
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

/** The text class of an overlay, or null: what may be read on it. */
const overlayText = (tokens, name) =>
  CODE_OVERLAYS.includes(name)
    ? codeText(tokens)
    : LABEL_OVERLAYS.includes(name)
      ? labelText(tokens)
      : null;
/** [role key, overlay name] for every shell role that paints an overlay. */
const shellOverlays = (tokens) =>
  Object.entries(tokens.shell_roles)
    .map(([key, role]) => [key, String(role.color).split(".")])
    .filter(([, [group]]) => group === "overlay")
    .map(([key, [, name]]) => [key, name]);

/**
 * Text a shell draws on an overlay. A shell cannot blend, and it paints
 * over the terminal background, so these are checked on `hex_terminal`.
 * Roles named `<overlay role>_*` restate the text on that row.
 */
function shellPairs(tokens) {
  const pairs = [];
  for (const [key, name] of shellOverlays(tokens)) {
    const on = `overlay.${name} over surface.bg_terminal`;
    const bg = tokens.overlay[name].hex_terminal;
    for (const [label, fg] of overlayText(tokens, name) ?? [])
      pairs.push({ label, fg, on, bg });
    for (const [k, role] of Object.entries(tokens.shell_roles)) {
      // Only a role that is itself text: not a style alone, not a background.
      const text =
        typeof role.color === "string" &&
        role.color !== "none" &&
        !role.color.startsWith("overlay.");
      if (text && k.startsWith(`${key}_`))
        pairs.push({
          label: `shell_roles.${k}`,
          fg: resolveTarget(tokens, role.color),
          on,
          bg,
        });
    }
  }
  return pairs;
}

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
  for (const o of SURFACE_OVERLAYS)
    for (const s of CODE_SURFACES)
      add(
        codeText(tokens),
        `overlay.${o} over surface.${s}`,
        over(tokens, o, s),
      );
  for (const [span, line] of DIFF_STACKS)
    add(
      codeText(tokens),
      `overlay.${span} over overlay.${line}`,
      stacked(tokens, span, line),
    );
  return [...pairs, ...shellPairs(tokens)];
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

/** Every distinct colour target the role maps use, in first-use order. */
export function colourTargets(tokens) {
  const all = TARGET_MAPS.flatMap((map) =>
    collectTargets(at(tokens, map), map, []),
  );
  return [...new Set(all.map(([, target]) => target))];
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

function at(obj, dotted) {
  return dotted.split(".").reduce((o, k) => o?.[k], obj);
}

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

  // Shape first: the gates below assume colours are colours and roles
  // are spelt right. Everything here is reported by path.
  const { palette_base, derived, ...roles } = raw;
  for (const [path, value] of collectHex(roles, "", [])) {
    fail.push(
      `✗ ${path} is the hex literal ${value}: reference a palette step or a derived value instead`,
    );
  }
  const colour = (path, v) => {
    if (!isColour(v))
      fail.push(`✗ ${path} is ${JSON.stringify(v)}, not a colour (#rrggbb)`);
  };
  for (const group of [
    "surface",
    "text",
    "border",
    "semantic",
    "syntax",
    "ansi",
  ]) {
    for (const [k, v] of Object.entries(tokens[group]))
      colour(`${group}.${k}`, v);
  }
  colour("accent", tokens.accent);
  colour("accent_on", tokens.accent_on);
  colour("accent_hover", tokens.accent_hover);
  for (const [k, f] of Object.entries(tokens.semantic_fill)) {
    colour(`semantic_fill.${k}.fill`, f.fill);
    colour(`semantic_fill.${k}.text`, f.text);
  }
  for (const [k, o] of Object.entries(tokens.overlay)) {
    colour(`overlay.${k}.color`, o.color);
    if ("border" in o) colour(`overlay.${k}.border`, o.border);
    if (!isAlpha(o.alpha)) {
      fail.push(
        `✗ overlay.${k}.alpha is ${JSON.stringify(o.alpha)}, needs a number above 0 and up to 1`,
      );
    }
  }
  const role = (path, v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    for (const key of Object.keys(v)) {
      if (!ROLE_KEYS.has(key)) {
        fail.push(
          `✗ ${path} has the unknown key "${key}" (allowed: ${[...ROLE_KEYS].join(", ")})`,
        );
      }
    }
    for (const style of v.style ?? []) {
      if (!STYLES.has(style)) {
        fail.push(
          `✗ ${path} has the unknown style "${style}" (allowed: ${[...STYLES].join(", ")})`,
        );
      }
    }
  };
  for (const [map, entries] of [
    ["shell_roles", tokens.shell_roles],
    [
      "prompt_roles",
      Object.fromEntries(
        Object.entries(tokens.prompt_roles).filter(([k]) => k !== "git_status"),
      ),
    ],
    ["syntax_tokens.extended", tokens.syntax_tokens.extended],
    [
      "semantic_token_recommendations.types",
      tokens.semantic_token_recommendations.types,
    ],
    [
      "semantic_token_recommendations.modifiers",
      tokens.semantic_token_recommendations.modifiers,
    ],
  ]) {
    for (const [k, v] of Object.entries(entries)) role(`${map}.${k}`, v);
  }
  if (fail.length) return fail;

  // Structure next: later gates assume every target resolves.
  for (const slot of Object.keys(tokens.syntax)) {
    if (slot === "accent" || Object.hasOwn(tokens.text, slot)) {
      fail.push(
        `✗ syntax.${slot} shadows the colour target "${slot}": rename the slot`,
      );
    }
  }
  const aliases = tokens.syntax_tokens.aliases ?? [];
  for (const group of aliases) {
    for (const slot of group) {
      if (!Object.hasOwn(tokens.syntax, slot)) {
        fail.push(
          `✗ syntax_tokens.aliases names "${slot}", which syntax does not define`,
        );
      }
    }
  }
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
  for (const [key, name] of shellOverlays(tokens)) {
    if (Object.hasOwn(tokens.overlay, name) && !overlayText(tokens, name)) {
      fail.push(
        `✗ shell_roles.${key} uses overlay.${name}, which carries no text: a shell overlay must be a code or label overlay`,
      );
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
      if (scope.trim().split(/\s+/).pop().startsWith("meta.")) {
        fail.push(
          `✗ scope_recommendations.${slot} targets "${scope}": never style a meta.* scope directly`,
        );
      }
    }
  }
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
  for (const name of new Set(GATED_BY_NAME)) {
    if (!Object.hasOwn(tokens.overlay, name)) {
      fail.push(
        `✗ overlay.${name} is used by a gate but not defined (tools/build-tokens.mjs)`,
      );
    }
  }
  if (fail.length) return fail;

  // 1 + 2. Text contrast on surfaces and overlays.
  for (const p of textPairs(tokens)) need(p.label, p.fg, p.on, p.bg, AA);
  // Contrast does not see direction: a faint lightening can still pass.
  for (const o of SURFACE_OVERLAYS) {
    for (const s of CODE_SURFACES) {
      const hex = over(tokens, o, s);
      if (oklab(hex)[0] > oklab(tokens.surface[s])[0]) {
        fail.push(
          `✗ overlay.${o} over surface.${s} (${hex}) is lighter than the surface (${tokens.surface[s]}): surface overlays must darken`,
        );
      }
    }
  }

  // 3. ANSI on the terminal background.
  for (const [slot, color] of Object.entries(tokens.ansi)) {
    if (!ANSI_EXEMPT.has(slot)) {
      // A terminal embedded in an editor sits on the canvas.
      for (const s of ["bg_terminal", "bg"])
        need(`ansi.${slot}`, color, `surface.${s}`, tokens.surface[s], AA);
      // `hex` is the selection a non-blending port paints; a blending one
      // draws the recipe over the terminal background.
      for (const o of TERMINAL_SELECTIONS) {
        need(`ansi.${slot}`, color, `overlay.${o}`, tokens.overlay[o].hex, AA);
        need(
          `ansi.${slot}`,
          color,
          `overlay.${o} over surface.bg_terminal`,
          over(tokens, o, "bg_terminal"),
          AA,
        );
      }
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
  for (const s of ["bg", "bg_chrome"])
    need(
      "overlay.slider_active",
      over(tokens, "slider_active", s),
      `surface.${s}`,
      tokens.surface[s],
      NON_TEXT,
    );

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
  need("accent_on", tokens.accent_on, "accent_hover", tokens.accent_hover, AA);

  // 6. Distinctness — audited on resolved colours, not slot names.
  // Core slots may share a colour only where syntax_tokens.aliases says so.
  const aliased = (a, b) => aliases.some((g) => g.includes(a) && g.includes(b));
  const core = tokens.syntax_tokens.core;
  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) {
      const [a, b] = [core[i], core[j]];
      if (tokens.syntax[a] === tokens.syntax[b] && !aliased(a, b)) {
        fail.push(
          `✗ syntax.${a} and syntax.${b} share ${tokens.syntax[a]} but are not listed together in syntax_tokens.aliases`,
        );
      }
    }
  }
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
  if (!raw.ladder.exclude.includes("racingred")) {
    fail.push(
      "✗ racingred must not have a ladder: its tints drift into pink (brand decision)",
    );
  }
  if (!raw.ladder.exclude.includes("white")) {
    fail.push("✗ white must not have a ladder: every tint of white is white");
  }
  for (const name of Object.keys(derived)) {
    if (!DERIVED_KEYS.includes(name)) {
      fail.push(
        `✗ derived.${name} is not one of the documented derived values (${DERIVED_KEYS.join(", ")}): use a palette step`,
      );
    }
  }
  for (const [a, b] of SAME_SURFACE) {
    if (tokens.surface[a] !== tokens.surface[b]) {
      fail.push(
        `✗ surface.${a} must equal surface.${b} (${tokens.surface[b]}), but is ${tokens.surface[a]}`,
      );
    }
  }
  for (const s of APART_FROM_CANVAS)
    apart(
      "surface.bg",
      tokens.surface.bg,
      `surface.${s}`,
      tokens.surface[s],
      DISTINCT,
    );
  const deep = mix(palette_base.darkblue, palette_base.darkblack, 0.55);
  if (derived.bg_deep !== deep) {
    fail.push(
      `✗ derived.bg_deep is ${derived.bg_deep}, but mix(darkblue, darkblack, 0.55) is ${deep}`,
    );
  }
  const fill = mix(palette_base.racingred, palette_base.darkblack, 0.9);
  if (derived.racingred_fill !== fill) {
    fail.push(
      `✗ derived.racingred_fill is ${derived.racingred_fill}, but mix(racingred, darkblack, 0.9) is ${fill}`,
    );
  }
  for (const name of ["racingred_on_dark", "racingred_on_dark_bright"]) {
    const drift = Math.abs(
      hueAngle(derived[name]) - hueAngle(palette_base.racingred),
    );
    if (drift > HUE_TOLERANCE) {
      fail.push(
        `✗ derived.${name} (${derived[name]}) has left the Racing Red hue by ${drift.toFixed(3)} rad`,
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
  for (const [name, surfaces, min] of VISIBLE_OVERLAYS)
    for (const s of surfaces)
      apart(
        `overlay.${name} over surface.${s}`,
        over(tokens, name, s),
        `surface.${s}`,
        tokens.surface[s],
        min,
      );
  for (const [span, line] of DIFF_STACKS)
    apart(
      `overlay.${span} over overlay.${line}`,
      stacked(tokens, span, line),
      `overlay.${line}`,
      tokens.overlay[line].hex,
      SPAN_STEP,
    );
  apart(
    "accent_hover",
    tokens.accent_hover,
    "accent",
    tokens.accent,
    HOVER_STEP,
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

  // Gates first: a build that fails must not leave rejected values on disk.
  const failures = check(tokens, raw);
  if (failures.length) {
    console.error(`\n${failures.length} gate failure(s):`);
    for (const f of failures) console.error("  " + f);
    console.error("\nNothing was written.");
    process.exit(1);
  }

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

// realpath: Node resolves a symlinked entry script, argv[1] does not.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
