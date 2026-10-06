#!/usr/bin/env node
/**
 * build-previews.mjs — tokens → preview/*.html.
 *
 *   node tools/build-previews.mjs            write the pages
 *   node tools/build-previews.mjs --check    exit 1 if any page is out of date
 *
 * The pages are generated so they cannot drift from the tokens. Colours
 * come from ../colors.css; a page holds no colour of its own.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  loadTokens,
  contrastReport,
  contrast,
  CODE_OVERLAYS,
} from "./build-tokens.mjs";
import { cssVar } from "./build-css.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kebab = (s) => String(s).replace(/_/g, "-");
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `[[name:text]]` → <span class="<prefix><name>">text</span>, after escaping. */
const mark = (src, prefix) =>
  esc(src).replace(
    /\[\[([a-z_]+):([\s\S]+?)\]\]/g,
    (_, name, text) => `<span class="${prefix}${name}">${text}</span>`,
  );

/** A block of sample lines. `@overlay|` at the start of a line draws it on that overlay. */
function block(title, src, prefix) {
  const lines = src.split("\n").map((line) => {
    const m = line.match(/^@([a-z_]+)\|(.*)$/);
    const cls = m ? ` o-${m[1]}` : "";
    return `<span class="line${cls}">${mark(m ? m[2] : line, prefix) || " "}</span>`;
  });
  return `<section><h2>${esc(title)}</h2><pre>${lines.join("")}</pre></section>`;
}

const styleDecl = (color, style = []) =>
  [
    color ? `color:var(${cssVar(color)})` : "",
    style.includes("italic") ? "font-style:italic" : "",
    style.includes("bold") ? "font-weight:700" : "",
    style.includes("underline") ? "text-decoration:underline" : "",
  ]
    .filter(Boolean)
    .join(";");

/** Rules for every syntax slot (.t-*), ANSI slot (.a-*), shell role (.s-*), prompt role (.p-*) and overlay (.o-*). */
function tokenCss(tokens) {
  const rules = [];
  const { core, core_style, extended } = tokens.syntax_tokens;
  for (const slot of core)
    rules.push(`.t-${slot}{${styleDecl(slot, core_style[slot])}}`);
  for (const [name, v] of Object.entries(extended)) {
    const { color, style } = typeof v === "string" ? { color: v } : v;
    rules.push(`.t-${name}{${styleDecl(color, style)}}`);
  }
  for (const slot of Object.keys(tokens.ansi))
    rules.push(`.a-${slot}{color:var(--sw-ansi-${kebab(slot)})}`);
  for (const [name, r] of Object.entries(tokens.shell_roles)) {
    const decl = r.color?.startsWith("overlay.")
      ? `background:var(${cssVar(r.color)})`
      : styleDecl(r.color, r.style);
    rules.push(`.s-${name}{${decl}}`);
  }
  for (const [name, r] of Object.entries(tokens.prompt_roles)) {
    if (name === "git_status") {
      for (const [k, target] of Object.entries(r))
        rules.push(`.p-git_${k}{${styleDecl(target)}}`);
    } else {
      rules.push(`.p-${name}{${styleDecl(r.color, r.style)}}`);
    }
  }
  for (const [name, o] of Object.entries(tokens.overlay)) {
    const border = o.border
      ? `;outline:1px solid var(--sw-overlay-${kebab(name)}-border);outline-offset:-1px`
      : "";
    rules.push(
      `.o-${name}{background:var(--sw-overlay-${kebab(name)})${border}}`,
    );
  }
  return rules.join("\n");
}

const CHROME = `
*{box-sizing:border-box}
body{margin:0;padding:32px 16px 64px;background:var(--sw-bg);color:var(--sw-fg);font:14px/1.6 var(--sw-font-mono)}
main{max-width:960px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px;color:var(--sw-accent)}
h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--sw-fg-muted);margin:32px 0 8px}
p{color:var(--sw-fg-muted);margin:0 0 8px;max-width:72ch}
nav{margin:0 0 24px}
nav a{color:var(--sw-info);margin-right:16px}
nav a[aria-current]{color:var(--sw-fg);text-decoration:none;border-bottom:2px solid var(--sw-accent)}
pre{margin:0;padding:12px 0;background:var(--sw-bg);border:1px solid var(--sw-border-default);overflow-x:auto;font:inherit}
pre.sunk{background:var(--sw-bg-sunk)}
.line{display:block;padding:0 16px;min-height:1.6em}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:4px 12px 4px 0;border-bottom:1px solid var(--sw-border-subtle);white-space:nowrap}
th{color:var(--sw-fg-muted);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.sw{padding:12px 8px;border:1px solid var(--sw-border-default);background:var(--sw-bg-terminal)}
.sw small{display:block;color:var(--sw-fg-muted)}
.chip{display:inline-block;width:1em;height:1em;vertical-align:-2px;margin-right:8px;border:1px solid var(--sw-border-control)}
.fill{display:inline-block;padding:2px 10px;margin-right:8px}
`;

const PAGES = [
  ["01-syntax.html", "Syntax"],
  ["02-terminal.html", "Terminal"],
  ["03-shell.html", "Shell and prompt"],
  ["04-contrast.html", "Contrast report"],
];

function page(tokens, file, intro, body) {
  const title = PAGES.find(([f]) => f === file)[1];
  const nav = PAGES.map(
    ([f, t]) =>
      `<a href="${f}"${f === file ? ' aria-current="page"' : ""}>${t}</a>`,
  ).join("");
  return `<!doctype html>
<!-- AUTO-GENERATED by tools/build-previews.mjs — do not edit. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Sepp's Workshop</title>
<link rel="stylesheet" href="../colors.css">
<style>${CHROME}${tokenCss(tokens)}
</style>
</head>
<body>
<main>
<h1>Sepp's Workshop · ${title}</h1>
<p>${intro}</p>
<nav>${nav}</nav>
${body}
</main>
</body>
</html>
`;
}

/* ── Samples ─────────────────────────────────────────────────────── */

const TS = `[[doc_keyword:/** @param]] [[doc_type:{User}]] [[doc_param:user]] [[comment:who to greet */]]
[[keyword:import]] [[punct:{]] useState [[punct:}]] [[keyword:from]] [[string:"react"]][[punct:;]]

[[keyword:interface]] [[type:User]] [[punct:{]] name[[operator::]] [[type:string]][[punct:;]] age[[operator:?:]] [[type:number]] [[punct:}]]

[[decorator:@memo]]
[[keyword:export function]] [[function:Greeting]][[punct:(]][[punct:{]] [[parameter:user]] [[punct:}]][[operator::]] [[punct:{]] user[[operator::]] [[type:User]] [[punct:}]][[punct:)]] [[punct:{]]
  [[keyword:const]] [[punct:[]]count[[punct:,]] setCount[[punct:]]] [[operator:=]] [[function:useState]][[punct:(]][[number:0]][[punct:)]][[punct:;]]
  [[keyword:if]] [[punct:(]][[lang_var:this]] [[operator:===]] [[keyword:null]][[punct:)]] [[keyword:return]] [[keyword:null]][[punct:;]]
  [[keyword:const]] label [[operator:=]] [[string:\`Hi \${]]user[[punct:.]]name[[string:}\`]][[punct:;]] [[comment:// template string]]
  [[keyword:return]] [[punct:<]][[tag:Greeting]] [[attr:count]][[operator:=]][[punct:{]]count [[operator:+]] [[number:1]][[punct:}]] [[attr:pattern]][[operator:=]][[punct:{]][[regex:/^sepp\\d+$/i]][[punct:}]] [[punct:/>]][[punct:;]]
[[punct:}]]
[[invalid:cosnt oops]] [[invalid_deprecated:oldApi()]]`;

const PY = `[[shebang:#!/usr/bin/env python3]]
[[keyword:from]] [[namespace:dataclasses]] [[keyword:import]] dataclass

[[constant:MAX_TURNS]] [[operator:=]] [[number:5]]

[[decorator:@dataclass]]
[[keyword:class]] [[type:Robot]][[punct::]]
    name[[punct::]] [[type:str]] [[operator:=]] [[string:"Sepp"]]

    [[keyword:def]] [[function:tighten]][[punct:(]][[lang_var:self]][[punct:,]] [[parameter:turns]][[punct::]] [[type:int]] [[operator:=]] [[number:3]][[punct:)]] [[operator:->]] [[type:bool]][[punct::]]
        [[comment:# a wrench never returns None]]
        [[keyword:return]] [[builtin:len]][[punct:(]][[lang_var:self]][[punct:.]]name[[punct:)]] [[operator:>]] turns [[keyword:and]] [[keyword:True]]`;

const CSSS = `[[keyword:@media]] [[punct:(]]prefers-color-scheme[[punct::]] dark[[punct:)]] [[punct:{]]
  [[selector:.workshop]][[selector::hover]] [[punct:{]]
    color[[punct::]] [[hex:#fbba00]][[punct:;]]
    padding[[punct::]] [[number:16]][[unit:px]] [[number:1.5]][[unit:rem]][[punct:;]]
    font-family[[punct::]] [[string:"JetBrains Mono"]][[punct:;]]
  [[punct:}]]
[[punct:}]]`;

const HTML = `[[punct:<]][[tag:button]] [[attr:class]][[operator:=]][[string:"primary"]] [[attr:disabled]][[punct:>]]Tighten[[punct:</]][[tag:button]][[punct:>]]
[[comment:<!-- tags are not the function colour -->]]`;

const JSON_ = `[[punct:{]] [[property:"name"]][[punct::]] [[string:"sepps-workshop"]][[punct:,]] [[property:"wrenches"]][[punct::]] [[number:2]][[punct:,]] [[property:"private"]][[punct::]] [[keyword:true]] [[punct:}]]`;

const MD = `[[heading:# Sepp's Workshop]]
Plain text, [[emphasis:emphasis]], [[strong:strong]] and a [[link:[link](https://www.seppmed.com/career/)]].
[[string:\`inline code\`]]`;

const STATES = `@line_highlight|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// current line]]
@selection|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// selected]]
@selection_inactive|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// selected, unfocused]]
@find_match|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// current find match]]
@find_match_other|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// other find match]]
@word_highlight|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// symbol read]]
@word_highlight_strong|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// symbol written]]
@diff_inserted_line|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// inserted]] [[invalid:error text]]
@diff_removed_line|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// removed]] [[invalid:error text]]
@merge_current_content|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// merge, current side]] [[invalid:error text]]
@stack_frame|[[keyword:const]] total [[operator:=]] [[function:sum]][[punct:(]][[number:1]][[punct:,]] [[string:"2"]][[punct:)]][[punct:;]] [[comment:// debugger paused here]] [[invalid:error text]]`;

const TERM = `[[green:sepp@workshop]] [[blue:~/themes]] $ git status
On branch [[cyan:main]]
Changes to be committed:
        [[green:new file:   tokens.json5]]
Changes not staged for commit:
        [[red:modified:   README.md]]
        [[red:deleted:    old-theme.json]]
[[yellow:warning:]] LF will be replaced by CRLF
[[bright_black:# a comment in bright black]]
$ git diff
[[cyan:@@ -1,3 +1,3 @@]]
[[red:-  "bg": "navy",]]
[[green:+  "bg": "darkblue",]]
$ ls
[[blue:assets]]  [[blue:tools]]  [[green:build.sh]]  [[magenta:icon.png]]  [[cyan:latest -> v0.1.0]]  README.md
[[bright_red:error:]] [[bright_white:bright white]] [[bright_yellow:bright yellow]] [[bright_green:bright green]] [[bright_blue:bright blue]] [[bright_cyan:bright cyan]] [[bright_magenta:bright magenta]] [[white:white]]`;

const SHELL = `[[command:git]] [[argument:commit]] [[option:--message]] [[string:"tighten bolts"]] [[operator:&&]] [[command:npm]] [[argument:test]] [[redirection:>]] [[valid_path:out.log]]
[[keyword:for]] [[argument:f]] [[keyword:in]] [[argument:*.json]][[operator:;]] [[command:echo]] [[variable:$f]] [[escape:\\n]][[operator:;]] [[keyword:end]] [[comment:# loop]]
[[command:cd]] [[valid_path:~/themes]][[autosuggestion:/sepps-workshop-fish]]
[[error:gti]] [[argument:status]]
[[command:cat]] [[selection:selected text]] [[search_match:search match]]
[[pager_selected:--message       (Commit message)]]
[[pager_prefix:--mes]][[pager_completion:sage-file]]  [[pager_description:(Read message from file)]]`;

const PROMPT = `[[directory:~/themes/sepps-workshop-fish]] [[git_branch: main]] [[git_added:+2]] [[git_modified:!1]] [[git_deleted:✘1]] [[git_untracked:?3]] [[git_conflicted:=1]] [[git_ahead:⇡1]] [[language_module: v26.10.0]] [[duration:took 3s]]
[[character_success:❯]] npm run build
[[character_error:❯]] npm run biuld`;

/* ── Pages ───────────────────────────────────────────────────────── */

function contrastPage(tokens) {
  const groups = new Map();
  for (const r of contrastReport(tokens)) {
    if (!groups.has(r.on)) groups.set(r.on, []);
    groups.get(r.on).push(r);
  }
  const tables = [...groups].map(([on, rows]) => {
    const body = rows
      .map(
        (r) =>
          `<tr data-pair><td><span class="chip" style="background:${r.fg}"></span>${r.label}</td><td>${r.fg}</td><td>${r.ratio.toFixed(2)}:1</td><td>Lc ${Math.abs(r.lc).toFixed(0)}</td></tr>`,
      )
      .join("\n");
    return `<section><h2>On ${on} (${rows[0].bg})</h2><table><tr><th>Text</th><th>Value</th><th>WCAG 2.x</th><th>APCA</th></tr>\n${body}</table></section>`;
  });
  const ansi = Object.entries(tokens.ansi)
    .map(
      ([slot, hex]) =>
        `<tr><td><span class="chip" style="background:${hex}"></span>ansi.${slot}</td><td>${hex}</td><td>${contrast(hex, tokens.surface.bg_terminal).toFixed(2)}:1</td><td>${slot === "black" ? "exempt" : ""}</td></tr>`,
    )
    .join("\n");
  const lcOf = (label) =>
    Math.abs(
      contrastReport(tokens).find(
        (r) => r.label === label && r.on === "surface.bg",
      ).lc,
    ).toFixed(0);
  const apcaNote = `<section><h2>APCA (reference only)</h2><p>On the canvas: body text Lc ${lcOf("text.fg")} (target 75), comments Lc ${lcOf("syntax.comment")} (target 45).</p></section>`;
  return (
    apcaNote +
    tables.join("\n") +
    `<section><h2>ANSI on surface.bg_terminal (${tokens.surface.bg_terminal})</h2><table><tr><th>Slot</th><th>Value</th><th>WCAG 2.x</th><th></th></tr>\n${ansi}</table></section>`
  );
}

/** Surface and non-text overlays, drawn translucent so they show on any surface. */
const WORKBENCH = [
  "hover",
  "active",
  "slider",
  "slider_hover",
  "slider_active",
];
const workbench = (cls) =>
  `<pre${cls ? ` class="${cls}"` : ""}>` +
  WORKBENCH.map(
    (n) =>
      `<span class="line" style="background:var(--sw-overlay-${kebab(n)}-hexa)">${n}</span>`,
  ).join("") +
  `</pre>`;

export function renderPages(tokens) {
  const mono = tokens.typography.mono.primary;
  const syntax = [
    block("TypeScript / JSX", TS, "t-"),
    block("Python", PY, "t-"),
    block("CSS", CSSS, "t-"),
    block("HTML", HTML, "t-"),
    block("JSON", JSON_, "t-"),
    block("Markdown", MD, "t-"),
    block("Editor states — the same line on every code overlay", STATES, "t-"),
    `<section><h2>Workbench overlays — on the canvas, then on the sunk surface</h2>${workbench("")}${workbench("sunk")}</section>`,
    `<section><h2>Signals</h2><p>` +
      ["danger", "success", "warning", "info"]
        .map(
          (r) =>
            `<span style="color:var(--sw-${r});margin-right:16px">${r}</span>`,
        )
        .join("") +
      `</p><p>` +
      Object.keys(tokens.semantic_fill)
        .map(
          (r) =>
            `<span class="fill" style="background:var(--sw-${r}-fill);color:var(--sw-${r}-fill-text)">${r} fill</span>`,
        )
        .join("") +
      `<span class="fill" style="background:var(--sw-accent);color:var(--sw-accent-on)">accent</span></p></section>`,
  ].join("\n");

  const grid = (prefix) =>
    `<div class="grid">` +
    ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]
      .map(
        (s) =>
          `<div class="sw a-${prefix}${s}">${prefix ? "bright " : ""}${s}<small>${tokens.ansi[prefix + s]}</small></div>`,
      )
      .join("") +
    `</div>`;
  const terminal = [
    `<section><h2>Normal</h2>${grid("")}</section>`,
    `<section><h2>Bright</h2>${grid("bright_")}</section>`,
    block("Sample session", TERM, "a-"),
  ].join("\n");

  const shell = [
    block("Command line (fish, PSReadLine)", SHELL, "s-"),
    block("Prompt (Starship)", PROMPT, "p-"),
  ].join("\n");

  return {
    "01-syntax.html": page(
      tokens,
      "01-syntax.html",
      `Three brand hues, two lightness steps each. Set in ${esc(mono)} if it is installed.`,
      syntax,
    ),
    "02-terminal.html": page(
      tokens,
      "02-terminal.html",
      "The sixteen ANSI colours on the terminal background. Magenta is Bright Orange: the brand has no magenta.",
      terminal,
    ),
    "03-shell.html": page(
      tokens,
      "03-shell.html",
      "Shell and prompt roles, shared by the fish, PowerShell and Starship ports.",
      shell,
    ),
    "04-contrast.html": page(
      tokens,
      "04-contrast.html",
      "Every text pair the build gates on. WCAG 2.x AA (4.5:1) is enforced; APCA Lc is shown for reference.",
      contrastPage(tokens),
    ),
  };
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const pages = renderPages(await loadTokens());
  const dir = join(ROOT, "preview");
  const stale = [];
  if (!checkMode) await mkdir(dir, { recursive: true });
  for (const [name, html] of Object.entries(pages)) {
    if (checkMode) {
      const existing = await readFile(join(dir, name), "utf8").catch(() => "");
      if (existing !== html) stale.push(`preview/${name}`);
    } else {
      await writeFile(join(dir, name), html);
      console.log(`✓ preview/${name}`);
    }
  }
  if (stale.length) {
    console.error(`✗ ${stale.join(", ")} out of date — run \`npm run build\`.`);
    process.exit(1);
  }
  if (checkMode)
    console.log(
      `✓ ${Object.keys(pages).length} preview pages match tokens.json5`,
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
