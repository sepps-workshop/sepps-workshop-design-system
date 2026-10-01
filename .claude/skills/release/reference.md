# Release — reference details

Detail for steps 3, 8 and 9 of `SKILL.md`.

## Changelog format (step 3)

- Add a new `## X.Y.Z — YYYY-MM-DD` section at the top, matching the existing entries
- One bullet per user-visible change, drawn from `git log <last-tag>..HEAD`; skip pure CI/chore commits
- Flag breaking token changes with **⚠️** — port maintainers scan for this

## GitHub release (step 8)

Extract release notes from the CHANGELOG section you just wrote:

```bash
# Replace X.Y.Z with the actual version, e.g. 0.3.0
VERSION="X.Y.Z"
NOTES=$(mktemp)
awk "/^## ${VERSION} /{p=1; next} p && /^## /{exit} p" CHANGELOG.md > "$NOTES"
```

Then create the release:

```bash
gh release create "v${VERSION}" \
  --title "v${VERSION}" \
  --notes-file "$NOTES"
```

Add a downstream-ports note at the end of the release body if this release contains ⚠️ breaking changes:

> **For downstream ports:** Re-read `tokens.json` / `dist/tokens.js`. Update any hard-coded token references before regenerating.
>
> Full changelog: https://github.com/sepps-workshop/sepps-workshop-design-system/blob/main/CHANGELOG.md

## Post-release verification (step 9)

- [ ] Workflow succeeded: https://github.com/sepps-workshop/sepps-workshop-design-system/actions
- [ ] Package appears on npm: `npm view @sepps-workshop/design-system version`
- [ ] Install smoke test:
  ```bash
  dir=$(mktemp -d) && cd "$dir" && npm init -y
  npm install @sepps-workshop/design-system
  node -e "import('@sepps-workshop/design-system').then(m => console.log(Object.keys(m)))"
  ```
- [ ] GitHub release visible with correct notes
