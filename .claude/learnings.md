# Learnings

- 2026-10-13: A cloud session (claude.ai/code) can push branches and `main` but not tags: `git push origin v*` ends in "remote end hung up" every time. Run `/release` from a local machine, or stop after `npm version` and let the user push the signed tag (`git tag -s`) and create the GitHub release. Never rerun the whole skill after a partial release; it would bump the version again.
