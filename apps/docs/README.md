# PIE Players Docs App

SvelteKit documentation site for the `pie-players` project.

## Commands

From the repository root:

```bash
bun run dev:docs
bun run preview:docs
```

From this app directory:

```bash
bun run check
bun run build
```

The root documentation gate also validates this app:

```bash
bun run check:docs
```

## Source Of Truth

- Use [`../../docs/readme.md`](../../docs/readme.md) as the in-repo documentation
  index.
- Keep public package API details in package READMEs, then link to them from the
  docs app instead of duplicating long API references.
