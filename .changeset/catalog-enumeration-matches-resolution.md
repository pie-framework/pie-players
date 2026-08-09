---
"@pie-players/pie-assessment-toolkit": patch
---

`AccessibilityCatalogResolver.getAllAlternatives` now projects each card through the same code path as `getAlternative`, so enumeration and resolution cannot describe the same card differently.

It hand-rolled the projection, and the two drifted the moment one of them gained a rule. The rule was the `signLanguage` payload alias, folded in by `resolveCard` and unknown to `getAllAlternatives`, which read `payload` alone: a card that arrived under the alias rendered its signing video and was simultaneously reported as carrying no payload, so `hasAlternativeType` said the item had no signed alternate and anything driving a learner-facing "alternates available" affordance off that answer would have hidden an accommodation that works. Silent for a sighted developer, and it fails in exactly the direction the sign-language work exists to rule out. The alias itself is gone now — see the accompanying changeset — but the two paths staying in sync is the durable half of the fix, and it is what a test now pins.

Two smaller consequences of sharing the projection: enumerated `spoken` content is sanitized on the way out, matching resolution, and a card is enumerated once per type-and-language rather than once per occurrence. A second card with the same type and language was already unreachable — `findMatchingCard` returns the first — so reporting it as available promised content no lookup would return.

`getAllAlternatives` still reports item-level cards ahead of assessment-level ones and treats context-scoped registrations as `item`, which is the precedence `getAlternative` applies.
