---
"@pie-players/pie-players-shared": patch
---

Declare the players-shared modules that siblings resolve from source in one place,
and add the gate that keeps them declared.

`components`, `ui/use-promise` and `ui/use-zoom-compensation` carry Svelte runes or
are components, and this package builds with plain `tsc`, whose config excludes
both — so they never reach `dist` and three sibling Vite configs each aliased the
source with their own copy of the path. The set of source-resolved modules was
whatever each build file happened to list.

`svelte-source-aliases.ts` now holds that list, at the package root so it stays out
of `dist` and unpublished. These paths are deliberately still absent from the
`exports` map: putting them there means publishing the source and making
`PieItemPlayer.svelte` and the rune helpers public API, which is a consumer-facing
decision rather than a packaging detail.

`check-undeclared-subpaths` is the new gate. Every cross-package `@pie-players/*`
import must name a subpath the owner declares, with the three source-resolved ones
as a visible allowlist; it also checks that a config spelling an alias out agrees
with the declaration, so the copies cannot drift back apart. Nothing enforced this
before — `check-consumer-boundaries` walks `apps/` only, which is how the three
tables accumulated.
