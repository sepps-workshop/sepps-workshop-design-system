# Learnings

- Release: a cloud session can push the changelog, meta-version and version commits without the `vX.Y.Z` tag; check for a missing tag before proposing a bump and follow "Tag missing" in the release skill instead of `npm version`.
- Release smoke test: `npm init -y --prefix <dir>` ignores the prefix and rewrites the `package.json` in the current directory; run `npm init` from inside the scratch directory, never from the repo root.
- Selection (2026-10-15, user decision): the selection may lighten the canvas. It is Sunset, text on it needs 3:1, and gate 9 checks its lightness gap. CLAUDE.md's "A lighter selection fails gate 2" is outdated: other overlays still darken.
