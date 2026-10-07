---
name: release
description: Use when publishing a new version of @sepps-workshop/design-system to npm. Invoke any time the user mentions releasing, publishing, cutting a release, bumping the version, shipping a new version, or tagging — even if they phrase it casually ("ready to release", "let's ship 0.3", "bump to minor"). Covers the full pipeline: change analysis, semver recommendation with explicit user confirmation, CHANGELOG update, version bump, CI publish via OIDC, GitHub release creation, and post-release verification.
disable-model-invocation: true
---

# Release — @sepps-workshop/design-system

Step-by-step guide for publishing a new version to npm.

## 0 — Preflight

Confirm the workspace is in a clean, releasable state before touching anything:

```bash
git branch --show-current        # must be: main
git status --short               # must be empty (clean working tree)
```

If the branch is wrong or there are uncommitted changes, stop and tell the user. `npm version` will fail on a dirty tree, and tagging a non-main branch creates a confusing release history.

## 1 — Pre-release verification

- [ ] `npm run test` — unit tests pass
- [ ] `npm run build` — regenerate tokens.json, dist/tokens.js, colors.css, preview pages and README tables
- [ ] `npm run check` — all outputs in sync with tokens.json5 (exits non-zero on drift)
- [ ] `npm pack --dry-run` — confirm package contents match the `files` array; no sensitive files

## 2 — Analyze changes and propose version

Find the last release tag and show what has changed since then:

```bash
git describe --tags --abbrev=0          # last tag, e.g. v0.2.0
git log v0.2.0..HEAD --oneline          # commits since that tag
```

If no tags exist yet, use `git log --oneline` (all commits = initial release).

**If no commits appear since the last tag, stop.** There is nothing to release — tell the user and exit the skill.

Categorize each commit against the semver rules:

| Bump  | When                                                                     |
| ----- | ------------------------------------------------------------------------ |
| Patch | Value tweak, gate fix, doc-only, bug fix                                 |
| Minor | New token or role — additive and backward compatible                     |
| Major | ⚠️ Token or role renamed or removed — breaks any port that references it |

While the package is in 0.x, a breaking change is a **minor** bump (as in 0.3.0 and 0.4.0), flagged with **⚠️** in the changelog. Propose 1.0.0 only when the user wants to declare the token contract stable.

**Present your proposed version to the user with a short rationale** — e.g.:

> "Since v0.2.0 the changes are all additive (two new tokens, one WCAG fix), so I'm proposing **0.3.0** (minor bump). Confirm, or tell me a different number."

Wait for the user to confirm or override before proceeding to any following step.

## 3 — Update CHANGELOG.md

**Do this BEFORE running `npm version`.** Use the confirmed version number.

Add a new `## X.Y.Z — YYYY-MM-DD` section at the top, summarising the commits since the last tag. Follow [reference.md](reference.md#changelog-format-step-3) and flag breaking changes with **⚠️**.

## 4 — Update README if needed

The token tables are generated; `npm run build` already refreshed them. Edit prose only when a role or gate changed.

## 5 — Commit docs and set the token meta version

```bash
git add CHANGELOG.md README.md   # and any other modified docs
git commit -m "📝 docs: update changelog for vX.Y.Z"
```

`npm version` only touches `package.json`. Set `meta.version` in `tokens.json5` to the confirmed version by hand, then rebuild so the generated files carry it:

```bash
npm run build && npm run check
git add tokens.json5 tokens.json dist/tokens.js colors.css
git commit -m "🔖 chore: set the token meta version to X.Y.Z"
```

## 6 — Bump version and tag

Use the bump type confirmed in step 2:

```bash
npm version minor   # patch | minor | major — must match what was confirmed in step 2
```

This updates package.json, creates a commit (`v0.3.0`), and creates the git tag `vX.Y.Z`.

## 7 — Push to GitHub (triggers CI publish)

```bash
git push && git push --tags
```

The publish workflow (`.github/workflows/publish-to-npm.yml`) fires automatically on any `v*` tag push and runs `npm publish --provenance --access public` via OIDC — no token needed.

Watch the workflow run at: https://github.com/sepps-workshop/sepps-workshop-design-system/actions

> **Manual publish** — required for the very first release (OIDC needs the package to exist on npm first), or as a fallback if CI is broken:
>
> ```bash
> npm publish --access public
> ```
>
> After a manual first publish, OIDC will work automatically for all subsequent releases.

## 8 — Create GitHub release

Extract the release notes from the CHANGELOG section and run `gh release create` as described in [reference.md](reference.md#github-release-step-8). Add the downstream-ports note there if the release contains ⚠️ breaking changes.

## 9 — Post-release verification

Run the checklist in [reference.md](reference.md#post-release-verification-step-9): workflow succeeded, package on npm, install smoke test, GitHub release visible.

## Rollback

See `docs/release-recovery.md` for deprecation, unpublish, tag deletion, and signed-tag recreation steps.

## Feedback

Did this release go smoothly? If anything went wrong or was unexpected, share it here — I'll log a correction to `.claude/learnings.md` so the next session doesn't repeat it.
