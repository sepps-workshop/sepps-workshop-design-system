#!/usr/bin/env node
/**
 * build-readme.mjs — keeps the token tables in README.md in step with
 * tokens.json5. Only the text between `<!-- tokens:<name> -->` and
 * `<!-- /tokens -->` is generated; everything else is written by hand.
 *
 *   node tools/build-readme.mjs            rewrite the tables
 *   node tools/build-readme.mjs --check    exit 1 if a table is out of date
 */

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  loadTokens,
  parseTokens,
  contrast,
  LABEL_OVERLAYS,
  SURFACE_OVERLAYS,
  NON_TEXT_OVERLAYS,
} from "./build-tokens.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const code = (s) => "`" + s + "`";
/** The brand writes the three renamed colours as two words. */
const BRAND_NAMES = {
  brightorange: "Bright Orange",
  racingred: "Racing Red",
  limegreen: "Lime Green",
};
const title = (s) => BRAND_NAMES[s] ?? s[0].toUpperCase() + s.slice(1);

/** "$palette.sunset.100" → `sunset`; "$palette.sunset.40" → `sunset.40`. */
const source = (ref) =>
  code(
    String(ref)
      .replace(/^\$/, "")
      .replace(/^palette\./, "")
      .replace(/\.100$/, ""),
  );

/** A Markdown table padded the way Prettier pads it, so both agree. */
function table(head, rows) {
  const width = head.map((h, i) =>
    Math.max(3, h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cells) =>
    "| " + cells.map((c, i) => c.padEnd(width[i])).join(" | ") + " |";
  return [
    line(head),
    line(width.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ].join("\n");
}

function tables(tokens, raw) {
  const bg = tokens.surface.bg;
  const ratio = (hex, on = bg) => contrast(hex, on).toFixed(2) + ":1";
  const styles = (list) => (list ?? []).join(", ");
  const names = (list) => (list ?? []).map(code).join("<br>");
  const carries = (k) =>
    LABEL_OVERLAYS.includes(k)
      ? "`fg`, `fg_muted`"
      : SURFACE_OVERLAYS.includes(k)
        ? "surface"
        : NON_TEXT_OVERLAYS.includes(k)
          ? "non-text"
          : "code";
  const group = (g, use, withRatio) =>
    Object.entries(tokens[g]).map(([k, v]) => [
      code(`${g}.${k}`),
      source(raw[g][k]),
      code(v),
      withRatio ? ratio(v) : "",
      use[k] ?? "",
    ]);
  const ansiSlots = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
  ];
  const { core, core_style, extended } = tokens.syntax_tokens;
  const { git_status, ...promptRoles } = tokens.prompt_roles;

  return {
    palette: () =>
      table(
        ["Colour", "Hex", "On Darkblue", "Ladder"],
        Object.entries(tokens.palette_base).map(([name, hex]) => [
          title(name),
          code(hex),
          ratio(hex, tokens.palette_base.darkblue),
          tokens.ladder.exclude.includes(name) ? "none" : "100 % … 10 %",
        ]),
      ),
    surfaces: () =>
      table(
        ["Token", "Source", "Value", "On `bg`", "Use"],
        [
          ...group("surface", {
            bg: "Editor canvas",
            bg_chrome: "Sidebar, activity bar, status bar, inactive tabs",
            bg_soft: "Hover, inputs",
            bg_overlay: "Menus, hover and suggest widgets, quick input",
            bg_terminal: "Terminal background",
          }),
          ...group(
            "text",
            {
              fg: "Body text, variables",
              fg_muted: "Secondary text, punctuation",
              fg_subtle: "Comments, autosuggestions",
              fg_disabled: "Disabled; exempt from the text gate",
            },
            true,
          ),
          ...group(
            "border",
            {
              subtle: "Dividers",
              default: "Panel edges",
              control: "Control outline",
            },
            true,
          ),
          [
            "`accent`",
            source(raw.accent),
            code(tokens.accent),
            ratio(tokens.accent),
            "Cursor, focus ring, active tab, primary button",
          ],
          [
            "`accent_on`",
            source(raw.accent_on),
            code(tokens.accent_on),
            ratio(tokens.accent_on, tokens.accent) + " on accent",
            "Text on the accent",
          ],
          [
            "`accent_hover`",
            source(raw.accent_hover),
            code(tokens.accent_hover),
            ratio(tokens.accent_hover),
            "Primary button under the pointer",
          ],
        ],
      ),
    syntax: () =>
      table(
        ["Slot", "Source", "Value", "Style", "On `bg`"],
        core.map((k) => [
          code(k),
          source(raw.syntax[k]),
          code(tokens.syntax[k]),
          styles(core_style[k]),
          ratio(tokens.syntax[k]),
        ]),
      ),
    extended: () =>
      table(
        ["Token", "Colour", "Style"],
        Object.entries(extended).map(([k, v]) => {
          const role = typeof v === "string" ? { color: v } : v;
          return [
            code(k),
            role.color ? code(role.color) : "inherits",
            styles(role.style),
          ];
        }),
      ),
    semantic: () =>
      table(
        ["Role", "Foreground on dark", "On `bg`", "Fill", "Text on fill"],
        Object.entries(tokens.semantic).map(([k, v]) => {
          const fill = tokens.semantic_fill[k];
          const rawFill = raw.semantic_fill[k];
          return [
            code(k),
            `${source(raw.semantic[k])} ${code(v)}`,
            ratio(v),
            fill ? `${source(rawFill.fill)} ${code(fill.fill)}` : "—",
            fill
              ? `${source(rawFill.text)} (${ratio(fill.text, fill.fill)})`
              : "—",
          ];
        }),
      ),
    ansi: () =>
      table(
        ["Slot", "Normal", "On terminal", "Bright", "On terminal"],
        ansiSlots.map((s) => {
          const b = `bright_${s}`;
          const term = tokens.surface.bg_terminal;
          return [
            s,
            `${source(raw.ansi[s])} ${code(tokens.ansi[s])}`,
            s === "black" ? "exempt" : ratio(tokens.ansi[s], term),
            `${source(raw.ansi[b])} ${code(tokens.ansi[b])}`,
            ratio(tokens.ansi[b], term),
          ];
        }),
      ),
    overlay: () =>
      table(
        ["Recipe", "Colour", "Alpha", "Composited", "Border", "Carries"],
        Object.entries(tokens.overlay).map(([k, o]) => [
          code(k),
          source(raw.overlay[k].color),
          `${Math.round(o.alpha * 100)} %`,
          code(o.hex),
          o.border ? source(raw.overlay[k].border) : "",
          carries(k),
        ]),
      ),
    shell: () =>
      table(
        ["Role", "Colour", "Style", "fish", "PSReadLine"],
        Object.entries(tokens.shell_roles).map(([k, r]) => [
          code(k),
          r.color ? code(r.color) : "inherits",
          styles(r.style),
          names(r.fish),
          names(r.psreadline),
        ]),
      ),
    prompt: () =>
      table(
        ["Role", "Colour", "Style"],
        [
          ...Object.entries(promptRoles).map(([k, r]) => [
            code(k),
            code(r.color),
            styles(r.style),
          ]),
          ...Object.entries(git_status).map(([k, v]) => [
            code(`git_status.${k}`),
            code(v),
            "",
          ]),
        ],
      ),
  };
}

const readRaw = () =>
  parseTokens(readFileSync(join(ROOT, "tokens.json5"), "utf8"));

/** Replace every `<!-- tokens:<name> -->…<!-- /tokens -->` block in `md`. */
export function renderReadme(tokens, md, raw = readRaw()) {
  const make = tables(tokens, raw);
  return md.replace(
    /<!-- tokens:([a-z]+) -->[\s\S]*?<!-- \/tokens -->/g,
    (_, name) => {
      if (!Object.hasOwn(make, name))
        throw new Error(`Unknown README table: ${name}`);
      // Blank lines around the table are what Prettier writes.
      return `<!-- tokens:${name} -->\n\n${make[name]()}\n\n<!-- /tokens -->`;
    },
  );
}

async function main() {
  const path = join(ROOT, "README.md");
  const current = await readFile(path, "utf8");
  const next = renderReadme(await loadTokens(), current);
  if (process.argv.includes("--check")) {
    if (next !== current) {
      console.error("✗ README.md tables out of date — run `npm run build`.");
      process.exit(1);
    }
    console.log("✓ README.md tables match tokens.json5");
  } else {
    if (next !== current) await writeFile(path, next);
    console.log("✓ README.md");
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
