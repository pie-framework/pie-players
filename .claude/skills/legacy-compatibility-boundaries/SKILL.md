---
name: legacy-compatibility-boundaries
description: Disallow legacy/back-compat shims except the `pie-item` client contract. Use when adding alias maps, dual event names, fallback payload normalizers, deprecated config bridges, duplicate dispatch paths, or any "support old consumers" branch. Trigger on cues like "backwards compat", "legacy", "alias", "dual event", "fallback", "deprecated", "support old", "shim".
---

# Legacy Compatibility Boundaries

Canonical rule: [`.cursor/rules/legacy-compatibility-boundaries.mdc`](../../../.cursor/rules/legacy-compatibility-boundaries.mdc).

## Why this exists

The only externally consumed compatibility surface in this repo is the
`pie-item` client contract. Compatibility shims for everything else
(internal toolkit APIs, telemetry, config layers, demo-only code) silently
multiply dispatch paths, duplicate event semantics, and drift over time —
the cost is paid every time someone reads or extends that code.

## Do not (default)

Treat the following as **legacy compatibility** and reject them by default:

- Alias maps for old IDs / tags / event names.
- Dual event names (firing both `oldThing` and `newThing` "to be safe").
- Deprecated config bridges that translate an old shape into a new one.
- Fallback payload normalizers that absorb stale producers.
- Duplicate dispatch paths kept only for older consumers.
- Compatibility layers for internal toolkit, telemetry, config, or
  demo-only APIs.

## Do

- Prefer canonical single-path implementations. When compatibility can be
  removed without breaking the `pie-item` client contract, **delete** the
  compatibility branch.
- If uncertainty exists about contract impact, **default to removing**
  legacy behavior and request maintainer clarification only for potential
  `pie-item` contract impact.
- For every allowed compatibility exception (`pie-item` contract only):
  - Add an inline comment exactly:
    `pie-item contract compatibility: <reason>`.
  - Add or update a covering test that proves the contract-preserving
    behavior is required.

## Decision flow

```text
Is this preserving externally consumed `pie-item` client contract behavior?
├─ No  → remove the legacy branch / refuse to add the shim.
└─ Yes → add inline `pie-item contract compatibility: <reason>` comment
         AND add/update a covering test.
```

## Related skills

- `pie-element-versioning` — the tag/id contract uses the same exception
  policy.
- `code-review-workflow` — flag suspected legacy branches as high-signal
  review items.
