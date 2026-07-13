---
name: ce-package-packaging
description: Workflow for adding or modifying a custom-element package — registration entrypoints, package `exports`, build artifacts, and pre-flight checks. Use when creating a new `@pie-players/*` CE package, adding a new `*-element.ts` registration entry, modifying the `exports` map of a publishable package, or validating CE consumer wiring. Trigger on cues like "register custom element", "add CE entry", "package exports", "components/*-element", "publishable package", "CE registration".
---

# Custom-Element Package Packaging

This is a **workflow skill** that pairs with canonical project rules and
specialist skills:

- [`AGENTS.md`](../../../AGENTS.md) — canonical tag/ID, custom-element
  boundary, build-artifact, and release rules.
- `releases-and-changesets` — fixed-versioning workflow when adding a new publishable package.

## Layout (canonical)

```text
packages/<pkg>/
├── package.json
├── src/
│   ├── components/
│   │   ├── <Component>.svelte
│   │   └── <component>-element.ts        # registration entry
│   ├── services/...
│   └── index.ts
├── tests/...
└── tsconfig.json
```

Use a dedicated registration entry for each targeted component import. Some
packages also intentionally expose a root registration entry; both forms must
be documented and tested from the packed package. Registration entries apply
the versioning rules from
[`packages/players-shared/src/pie/config.ts`](../../../packages/players-shared/src/pie/config.ts)
when the element participates in the PIE registry. Versioned tags are effective
runtime namespaces: load concurrent versions under their distinct tags rather
than attempting to replace an existing custom-element definition.

Do not assume a source-level registration guard is sufficient. Inspect or test
the packed artifact as well, because compilation can change registration behavior.

## `exports` shape

For each registration entry, add an `exports` entry pointing at the
**built `dist`** path. Example pattern from
[`packages/assessment-toolkit/package.json`](../../../packages/assessment-toolkit/package.json):

```json
"./components/item-toolbar-element": {
  "types": "./dist/components/item-toolbar-element.d.ts",
  "import": "./dist/components/item-toolbar-element.js"
}
```

Rules:

- Always emit `types` + `import` for each entry.
- Runtime path must be `./dist/...`, not `./src/...`.
- Custom-element declarations must be framework-neutral and typecheck in an
  isolated consumer without Svelte or other workspace dependencies installed.
- Runtime and declaration named exports must match exactly.
- Contract and policy-only subpaths must stay inert when imported.
- Do **not** add a top-level `*.svelte` export. Cross-package
  `?customElement` imports are rejected by
  `bun run check:custom-elements`.

## Adding a new publishable package

When the package will be published to npm:

1. Add it to the `fixed` block in
   [`.changeset/config.json`](../../../.changeset/config.json) **in the
   same change**.
2. Register the package's `exports` entries pointing at `dist/`.
3. Add or update a `*-element.ts` registration entry per CE.
4. Author a changeset (default `patch`) — see the
   `releases-and-changesets` skill.

A publishable package outside the `fixed` block silently breaks the
lockstep invariant.

## Naming and class hooks

- Custom-element tag names use `pie-` prefix and the versioning encoder
  from `packages/players-shared/src/pie/config.ts` when participating in
  the PIE registry.
- A host that deliberately substitutes its packaged version may update tags only
  in a cloned runtime config; it must leave the caller's authored input unchanged.
- Keep the existing encoder stable. Do not add a parallel encoding or content
  migration for theoretical prerelease collisions.
- DOM hooks and CSS selectors use `pie-*` or `data-pie-*`. Avoid generic
  class names like `header`, `content`, `container`, `card`, `pane`,
  `toolbar`, `body`, `active` — they collide in light-DOM CEs.

## Pre-flight (every CE-touching change)

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run check:svelte-runtime-deps
bun run check:ce-define-safety
bun run check:ce-consumer-contract
bun run check:runtime-compat
bun run check:bundle-safety
```

For new packages, also:

```bash
bun run check:fixed-versioning
bun run check:package-metadata
bun run check:publint
bun run check:types-publish
bun run check:pack-exports
bun run check:pack-smoke
bun run check:pack-integrity:real
```

Or run the full pre-publish gate:

```bash
bun run verify:publish
```

## Build before validating in a consumer

After `src` edits, **rebuild** the package before running consumer apps
or e2e tests:

```bash
turbo build --filter=@pie-players/<pkg>...
```

Then validate from built or packed artifacts so workspace source resolution does
not conceal undeclared framework types or registration differences.

## Related rules

- [`AGENTS.md`](../../../AGENTS.md), especially Custom Element Import And Packaging
  Boundaries, PIE Element Versioning And Tag/ID Contract, and Release Version
  Alignment.
