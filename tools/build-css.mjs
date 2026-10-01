#!/usr/bin/env node
/**
 * build-css.mjs — tokens → colors.css (custom properties on :root).
 *
 *   node tools/build-css.mjs            write colors.css
 *   node tools/build-css.mjs --check    exit 1 if colors.css is out of date
 */

import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadTokens } from "./build-tokens.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kebab = (s) => String(s).replace(/_/g, "-");

/** A colour target (see resolveTarget) → its custom property name. */
export function cssVar(target) {
  if (target === "accent") return "--sw-accent";
  if (target === "accent_hover") return "--sw-accent-hover";
  if (target.startsWith("fg")) return `--sw-${kebab(target)}`;
  const [group, key] = target.split(".");
  if (group === "semantic") return `--sw-${kebab(key)}`;
  if (group === "overlay") return `--sw-overlay-${kebab(key)}`;
  return `--sw-syn-${kebab(target)}`;
}

export function renderCss(tokens) {
  const lines = [];
  const section = (title, entries) => {
    lines.push("", `  /* ${title} */`);
    for (const [name, value] of entries) lines.push(`  ${name}: ${value};`);
  };

  section(
    "Brand palette — base colours and their tint ladders",
    Object.entries(tokens.palette).flatMap(([name, steps]) =>
      Object.entries(steps)
        .sort((a, b) => b[0] - a[0])
        .map(([step, hex]) => [`--sw-palette-${name}-${step}`, hex]),
    ),
  );
  section(
    "Surfaces",
    Object.entries(tokens.surface).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
  );
  section(
    "Text",
    Object.entries(tokens.text).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
  );
  section(
    "Borders",
    Object.entries(tokens.border).map(([k, v]) => [
      `--sw-border-${kebab(k)}`,
      v,
    ]),
  );
  section("Accent", [
    ["--sw-accent", tokens.accent],
    ["--sw-accent-on", tokens.accent_on],
    ["--sw-accent-hover", tokens.accent_hover],
  ]);
  section("Semantic — foregrounds on dark, then fills with their text colour", [
    ...Object.entries(tokens.semantic).map(([k, v]) => [`--sw-${kebab(k)}`, v]),
    ...Object.entries(tokens.semantic_fill).flatMap(([k, f]) => [
      [`--sw-${kebab(k)}-fill`, f.fill],
      [`--sw-${kebab(k)}-fill-text`, f.text],
    ]),
  ]);
  section(
    "Syntax",
    Object.entries(tokens.syntax).map(([k, v]) => [`--sw-syn-${kebab(k)}`, v]),
  );
  section(
    "ANSI",
    Object.entries(tokens.ansi).map(([k, v]) => [`--sw-ansi-${kebab(k)}`, v]),
  );
  section(
    "Overlays — composited over --sw-bg; -hexa is the translucent recipe",
    Object.entries(tokens.overlay).flatMap(([k, o]) => [
      [`--sw-overlay-${kebab(k)}`, o.hex],
      [`--sw-overlay-${kebab(k)}-hexa`, o.hexa],
      ...(o.border ? [[`--sw-overlay-${kebab(k)}-border`, o.border]] : []),
    ]),
  );
  section("Typography", [["--sw-font-mono", tokens.typography.mono.stack]]);

  return (
    `/* Sepp's Workshop ${tokens.meta.version} — AUTO-GENERATED from tokens.json5. Do not edit. */\n` +
    `:root {${lines.join("\n")}\n}\n`
  );
}

async function main() {
  const path = join(ROOT, "colors.css");
  const css = renderCss(await loadTokens());
  if (process.argv.includes("--check")) {
    const existing = await readFile(path, "utf8").catch(() => "");
    if (existing !== css) {
      console.error("✗ colors.css out of date — run `npm run build`.");
      process.exit(1);
    }
    console.log("✓ colors.css matches tokens.json5");
  } else {
    await writeFile(path, css);
    console.log("✓ colors.css");
  }
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
