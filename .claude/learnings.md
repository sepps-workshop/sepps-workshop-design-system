# Learnings

- Release: a cloud session can push the changelog, meta-version and version commits without the `vX.Y.Z` tag; check for a missing tag before proposing a bump and follow "Tag missing" in the release skill instead of `npm version`.
- Release smoke test: `npm init -y --prefix <dir>` ignores the prefix and rewrites the `package.json` in the current directory; run `npm init` from inside the scratch directory, never from the repo root.
