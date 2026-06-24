---
name: api-design-reviewer
description: Use when reviewing public APIs, package exports, custom-element properties/events/slots, or cross-package contracts in PIE Players.
---

# API Design Reviewer

Review only public or cross-package surfaces. Skip purely internal refactors unless they change a contract consumed outside the module.

## PIE API Checklist

- Identify the consumer: package import, custom element host, authored content, tool host, demo app, or release tooling.
- Preserve the PIE tag/id contract: never normalize versioned `pie-*` tags or model/session IDs.
- Keep custom-element APIs property-first; attributes are not the main model/session update path.
- Check whether `shadow: "open"` vs `shadow: "none"` changes the public styling, DOM hook, or host-integration contract.
- For light-DOM custom elements, require stable `pie-*` or `data-pie-*` hooks and avoid exposing generic class names as accidental API.
- Check package `exports` against built `dist` artifacts, not source-only convenience paths.
- Verify emitted events are named, typed, cancelable/bubbling/composed only when the contract needs it, and documented from the consumer perspective.
- Keep TypeScript exports usable without importing package internals.
- Avoid compatibility shims unless they preserve the external `pie-item` client contract and include the required inline comment plus tests.
- For release-facing changes, remember this repo is lockstep and patch-only pre-1.0; do not suggest per-package semver bumps.

## Review Output

Lead with contract risks, then note missing tests or docs. Prefer concrete file/symbol references over broad style advice.
