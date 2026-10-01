# Release Recovery

Reference for rollback and tag-cycling scenarios. Consult when something goes wrong after `git push --tags`.

## Prefer deprecation over unpublish

**Always preferred — deprecate, then ship a fix:**

```bash
npm deprecate @sepps-workshop/design-system@X.Y.Z "Breaking bug — upgrade to X.Y.Z+1"
```

## Unpublish (72-hour window only)

```bash
npm unpublish @sepps-workshop/design-system@X.Y.Z
```

## Delete and recreate a tag

To delete a tag (e.g. to re-cut the same version after fixing a workflow):

```bash
git tag -d vX.Y.Z
git push --delete origin vX.Y.Z
```

To recreate and re-push, use a **signed annotated tag** — `tag.gpgsign=true` is set globally on this machine and lightweight tags will fail on push with "keine Tag-Beschreibung?":

```bash
git tag -s vX.Y.Z <commit-sha> -m "vX.Y.Z"
git push origin vX.Y.Z
```

Deleting the tag turns its GitHub release into a draft. After re-pushing the tag, publish the release again:

```bash
gh release edit vX.Y.Z --draft=false
```
