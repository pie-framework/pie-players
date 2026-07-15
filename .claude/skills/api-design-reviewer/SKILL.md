---
name: api-design-reviewer
description: Use when reviewing public APIs, package exports, custom-element properties/events/slots, or cross-package contracts in PIE Players.
---

# API Design Reviewer

Review only public or cross-package surfaces. Skip purely internal refactors unless they change a contract consumed outside the module.

## PIE API Checklist

- Identify the consumer: package import, custom element host, authored content, tool host, demo app, or release tooling.
- Preserve the PIE tag/id contract: never mutate authored versioned `pie-*` tags
  or model/session IDs. A host may substitute its package version only on a
  cloned runtime config; the caller's authored config must remain unchanged.
- Treat versioned tags as runtime namespaces. Concurrent versions coexist under
  distinct tags because an existing custom-element definition cannot be replaced.
- Keep the established version encoder backward compatible. Do not propose an
  alternate encoding or content migration for theoretical prerelease collisions.
- Keep custom-element APIs property-first; attributes are not the main model/session update path.
- Check whether `shadow: "open"` vs `shadow: "none"` changes the public styling, DOM hook, or host-integration contract.
- For light-DOM custom elements, require stable `pie-*` or `data-pie-*` hooks and avoid exposing generic class names as accidental API.
- Check package `exports` against built `dist` artifacts, not source-only convenience paths.
- Require framework-neutral declaration closure for custom-element entrypoints:
  consumers must not need Svelte or another implementation framework to typecheck an import.
- Verify that public runtime exports and declarations expose the same names, and
  that policy or contract-only subpaths remain inert when imported.
- Verify emitted events are named, typed, cancelable/bubbling/composed only when the contract needs it, and documented from the consumer perspective.
- Keep TypeScript exports usable without importing package internals.
- Treat element package registries as executable-content trust boundaries when
  attacker-influenced config can reach them; prefer opt-in, host-controlled policy.
- Avoid compatibility shims unless they preserve the external `pie-item` client contract and include the required inline comment plus tests.
- For release-facing changes, remember this repo is lockstep and patch-only pre-1.0; do not suggest per-package semver bumps.

## Review Output

Lead with contract risks, then note missing tests or docs. Prefer concrete file/symbol references over broad style advice.
