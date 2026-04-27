---
name: pie-element-versioning
description: Preserve the PIE custom-element tag/id contract. Use whenever editing or reviewing sanitizers, HTML transformers, DOMPurify configs, custom-element registries, or any code that touches `pie-*` tag names, the `--version-*` suffix, the `id` / `model-id` / `session-id` attributes, or `customElements.define`. Trigger on cues like "DOMPurify", "sanitize", "tag name", "id attribute", "user-content-", "PIE element", "model lookup", "duplicate define".
---

# PIE Element Versioning & Tag/ID Contract

Canonical rule: [`.cursor/rules/pie-element-versioning.mdc`](../../../.cursor/rules/pie-element-versioning.mdc).
Canonical implementations:

- [`packages/players-shared/src/pie/config.ts`](../../../packages/players-shared/src/pie/config.ts)
  (`makeUniqueTags` — the encoder for versioned tag names).
- [`packages/players-shared/src/pie/updates.ts`](../../../packages/players-shared/src/pie/updates.ts)
  (`updateSinglePieElement` — strict `pieElement.id === config.models[].id`
  equality lookup).
- [`packages/players-shared/tests/sanitize-item-markup.test.ts`](../../../packages/players-shared/tests/sanitize-item-markup.test.ts)
  (covering test for sanitizer round-trips).

## Why this exists

The Custom Elements spec disallows redefining a tag once registered. PIE
items can legitimately load multiple versions of the same package, so the
player encodes the package version into the tag name itself —
e.g. `pie-multiple-choice--version-latest`,
`pie-multiple-choice--version-1-2-3`. Because the versioned tag is the only
way two versions coexist at runtime, it is part of the **authored content
contract**, not opaque markup. Stripping or normalizing it silently breaks
PIE runtime element/model binding.

The `id` attribute is the matching key for model lookup. Prefixing or
slugging it (e.g. DOMPurify's `SANITIZE_NAMED_PROPS: true` adding
`user-content-`) silently breaks model lookup.

## Do not

- Strip, trim, or normalize the `--version-<encoded>` suffix on any `pie-*`
  tag name in markup, config, registries, or logs (logging the bare base name
  is fine; **dispatch is not**).
- Compare a rendered PIE element against its non-versioned base tag.
- Mutate the `id` attribute on `pie-*` elements — no prefixing
  (`user-content-`, `sanitized-`, …), no slugging, no casing changes, no
  collapse of repeated hyphens.
- Mutate `model-id`, `session-id`, `slot`, `data-*`, `aria-*`, `pie-*`,
  `config-*`, or `context-*` attributes.
- Enable DOMPurify's `SANITIZE_NAMED_PROPS: true`. Keep `SANITIZE_DOM: true`
  (the actual clobbering defense); leave `SANITIZE_NAMED_PROPS` at its
  default `false`.
- Re-`define` an already-registered PIE custom element tag. If a new version
  is needed, produce a new versioned tag and update the content / config
  together.
- Add alias maps that collapse versioned tags back to a base tag for
  "convenience".
- Add regex cleanups that strip `--version-*` or `-config` suffixes before
  comparison or dispatch.

## Do

- Treat versioned tag names and contract attributes as opaque, content-typed
  strings — pass them through verbatim.
- Use DOMPurify's `CUSTOM_ELEMENT_HANDLING.tagNameCheck` /
  `attributeNameCheck` to allow versioned `pie-*` tags and their contract
  attributes. Do not fall back to generic HTML5 allow-lists that drop unknown
  tags.
- Treat `pie-*-config` (authoring-mode) tags the same as their runtime
  counterparts; keep them in allow-lists alongside the runtime tags.
- For any change that touches DOMPurify config or the `pie-*` allow-list,
  add or update a contract-preserving test in
  `packages/players-shared/tests/sanitize-item-markup.test.ts` that proves
  `id` round-trips unchanged.

## Exception policy

The only permitted compatibility surface is the `pie-item` client contract,
per [`.cursor/rules/legacy-compatibility-boundaries.mdc`](../../../.cursor/rules/legacy-compatibility-boundaries.mdc).
Exceptions must carry an inline `pie-item contract compatibility: <reason>`
comment **and** a covering test.

## Pre-flight before merging

For changes that touch sanitizer or CE registration code:

```bash
bun run check:custom-elements
bun run check:source-exports
bun run check:consumer-boundaries
```

Plus the relevant `bun run test:e2e:*` for the affected player surface (run
with `required_permissions: ["all"]`; see the `playwright-sandbox` skill).
