# 0006 — `players-shared` supports more than one copy per page

Status: Accepted, 2026-11-08

Owner: PIE Players maintainers

## Decision

A page may load more than one copy of `@pie-players/pie-players-shared`, at the
same or different versions, and every copy works. No copy detects or warns about
another.

- **Cross-copy state lives on the page.** State that two copies must agree on is
  keyed on `window` or `globalThis`, by a `Symbol.for` key or a documented string
  key, or kept on the element it describes: `window.PIE_REGISTRY`, the shared
  MathJax instance under `@pie-lib/math-rendering@2`, the session-commit
  signature on each element (`pie.sessionCommit.observedSignature`), and the
  MathJax event tracking under a global `Symbol.for` key in
  `loaders/mathjax-events.ts`.
- **Module state is per copy.** The element observer's container map, the
  element loader's in-flight and resolved-backend caches, the default i18n
  provider and the default instrumentation provider each belong to the copy that
  created them. That state serves only the players that copy renders.
- **Custom-element tags are first define wins.** A copy that finds a tag already
  defined stands down, so the players and tools a page renders come from the
  copy that registered first.
- **Promotion is on evidence.** Module state moves to page state when a host
  shows two copies doing one job twice, and the key it moves to is then part of
  the cross-copy contract: added, never renamed or removed.

## Constraint

The preloaded strategy puts two copies on one page by design. The preloaded
build bundles its own `players-shared`, registers its elements and its own
`pie-item-player`, and is loaded before the host's section-player bundle, which
brings a second copy through the section player and the toolkit. The two are
released on different schedules, so their versions can differ.

## Supporting reasons

State keyed on the page already carries every cross-copy agreement the players
need. A registry entry, a typeset instance and a commit signature are facts
about the page or the element, and keying them there makes the answer the same
whichever copy asks. The per-copy maps are caches and defaults, where a second
instance costs a duplicate fetch or a second English catalog and decides
nothing.

## Rejected alternatives

- **A second-copy warning.** It would fire on every launch of a supported
  configuration, so it reports nothing a host can act on, and a host that
  silences it would also silence a real conflict.
- **One page-wide singleton for every module-level value.** Each value would
  become a versioned cross-copy contract, so an older copy would constrain the
  shape of a newer one's caches. Under first-define-wins the copy that renders
  is the copy that owns them, so sharing them buys nothing today.

## Trade-off

A deliberate trade: no coordination protocol between copies, at the cost of
duplicated per-copy work, such as a second loader cache or a second default i18n
provider, while both copies are active.

## Consequences

- New state that two copies must agree on is keyed on the page by `Symbol.for`
  or kept on its element, from the change that introduces it. A comment at the
  key says so, as `session-commit.ts` and `mathjax-events.ts` do.
- A host sees the elements, observer and loader of whichever copy registered
  `pie-item-player` first. Behavior that depends on the other copy's version is
  a host composition question, not a defect in either copy.
- The i18n refactor (R-12 in the
  [core review remediation tracker](../reviews/2026-11-core-review-remediation.md))
  keeps the default provider per copy unless a host shows two copies disagreeing
  on the interface locale.
