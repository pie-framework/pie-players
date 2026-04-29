---
name: ce-package-packaging
description: Workflow for adding or modifying a custom-element package — registration entrypoints, package `exports`, build artifacts, and pre-flight checks. Use when creating a new `@pie-players/*` CE package, adding a new `*-element.ts` registration entry, modifying the `exports` map of a publishable package, or validating CE consumer wiring. Trigger on cues like "register custom element", "add CE entry", "package exports", "components/*-element", "publishable package", "CE registration".
---

# Custom-Element Package Packaging

This is a **workflow skill** that pairs with the canonical contract /
boundary skills:

- `pie-element-versioning` — tag-name and `id` contract.
- `custom-elements-boundaries` — import / `exports` / class-name rules.
- `releases-and-changesets` — fixed-versioning policy when adding a new
  publishable package.

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

The `<component>-element.ts` files are the **only** import surface for
consumers. They wrap the `.svelte` file with `customElements.define`,
applying the versioning rules from
[`packages/players-shared/src/pie/config.ts`](../../../packages/players-shared/src/pie/config.ts)
when the element participates in the PIE registry.

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
- DOM hooks and CSS selectors use `pie-*` or `data-pie-*`. Avoid generic
  class names like `header`, `content`, `container`, `card`, `pane`,
  `toolbar`, `body`, `active` — they collide in light-DOM CEs.

## Pre-flight (every CE-touching change)

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

For new packages, also:

```bash
bun run check:fixed-versioning
bun run check:package-metadata
bun run check:publint
bun run check:types-publish
bun run check:pack-exports
bun run check:pack-smoke
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

See the `build-before-tests` skill for why this matters.

## Related rules

- [`.cursor/rules/custom-elements-boundaries.mdc`](../../../.cursor/rules/custom-elements-boundaries.mdc).
- [`.cursor/rules/pie-element-versioning.mdc`](../../../.cursor/rules/pie-element-versioning.mdc).
- [`.cursor/rules/release-version-alignment.mdc`](../../../.cursor/rules/release-version-alignment.mdc).
