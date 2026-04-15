# Changesets

This repository uses Changesets to manage versioning and npm releases for `packages/vop`.

Typical flow:

1. Add a changeset:

```bash
bun run changeset
```

2. Apply version updates:

```bash
bun run version:package
```

3. Publish the single public package:

```bash
bun run release
```
