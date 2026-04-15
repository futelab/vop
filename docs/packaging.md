# Packaging

The npm package is published from:

- `packages/vop`
- npm package: `@futelab/vop`

The package contains:

- `dist/`
- `bin/`
- package `README.md`
- package `LICENSE`

These items stay out of the published package:

- example apps
- repository tests
- internal workspace source trees as a supported import surface

## Release Commands

```bash
bun run changeset
bun run version:package
bun run pack:package
bun run release:alpha
```
