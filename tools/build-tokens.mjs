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
import { tint, alphaOver } from "./color.mjs";

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
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
