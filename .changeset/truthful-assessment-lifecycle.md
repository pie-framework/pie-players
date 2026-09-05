---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-players-shared": patch
---

Make assessment-player mounting follow its documented public property contract.
Connect-then-assign hosts now initialize without a private bootstrap call. Batch
assessment/attempt/hook changes, retire superseded or disconnected controllers,
and publish a ready controller only after initialization and hydration succeed.
Each successful initialization invokes the ready hook and ready event once.

Load failures reject at the controller boundary and leave the element unavailable
with a localized, accessible retry action. Controller waiters resolve to null
when their active initialization fails or is retired. Assessment controllers now
provide idempotent `dispose()`; nested toolkit coordinators keep their existing
ownership rules, so borrowed coordinators are not disposed by the assessment.
Locale, navigation visibility, and runtime property updates preserve the active
assessment controller. Package entrypoints and event names/flags are unchanged.

The recorded consumer pad lists no external assessment-player host. Its downstream
checkout verification remains pending; the accompanying public host fixture
validates the built package's documented contract. Section, Quiz Engine,
knowledge-check, and item-player APIs are unchanged.
