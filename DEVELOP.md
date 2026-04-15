# Development

## Branches

- `alpha`: prerelease development
- `release`: stable release preparation
- `main`: default branch

## Local Setup

```bash
bun install
```

Common commands:

```bash
bun run build
bun run typecheck
bun run test:ci
bun run verify:ci
```

## Daily Flow

Regular commits do not trigger release CI.

```bash
git checkout alpha
git pull
# edit files
git add .
git commit -m "..."
git push origin alpha
```

## Release Triggers

Release CI only runs for tag pushes with these prefixes:

- `publish-alpha/`
- `publish-release/`

No matching tag means no release workflow run.

## Alpha Release

Publish from the current `alpha` commit:

```bash
git checkout alpha
git pull
git tag publish-alpha/2026-04-15-1
git push origin publish-alpha/2026-04-15-1
```

The workflow will verify the package, bump the next `alpha.N`, and publish to npm with the `alpha` dist-tag.

Example progression:

- `0.1.0-alpha.0`
- `0.1.0-alpha.1`
- `0.1.0-alpha.2`

## Stable Release

Stable tags must point to a commit whose package version is already stable.

Typical flow:

```bash
git checkout release
git pull
bun run changeset
bun run version:package
git add .
git commit -m "Prepare stable release"
git push origin release
git tag publish-release/0.1.0
git push origin publish-release/0.1.0
```

If `packages/vop/package.json` still contains a prerelease such as `0.1.0-alpha.3`, the stable release workflow will fail.

## Tag Naming

Only the prefix is required.

Examples:

- `publish-alpha/2026-04-15-1`
- `publish-alpha/v0.1.0-build-1`
- `publish-release/0.1.0`
- `publish-release/2026-04-15`

## Delete a Wrong Tag

Delete locally:

```bash
git tag -d publish-alpha/2026-04-15-1
```

Delete remotely:

```bash
git push origin :refs/tags/publish-alpha/2026-04-15-1
```
