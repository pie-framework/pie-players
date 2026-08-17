---
"@pie-players/pie-theme": patch
---

Remove `@pie-players/pie-theme-daisyui`. The DaisyUI integration is the provider
adapter in this package, and was already the only part of it that worked.

The package shipped `bridge.css` — the same slot mapping as static CSS on
`:root, [data-theme]`, for a host wanting DaisyUI tokens without `<pie-theme>` —
plus three JS mappers over the same table. `<pie-theme scope="document">` writes
`--pie-*` as inline styles on the target, and `bridge.css` declared them in a
stylesheet with no `!important`, so inline won: every host that imported it also
mounted the element, which made the import inert. The JS mappers had no consumer
in this repo or in any host we read.

Nothing is lost that a host was using. The adapter resolves the same
`DAISYUI_PIE_TOKEN_MAP`, and it is the side that can correct a slot which lands
illegible, because it reads resolved colours through a canvas measure — the
correction static CSS could never make. The parity test that held the two copies
together goes with the copy; the assertions that were about the table rather than
the CSS already live in `packages/theme/tests/daisyui-mapping.test.ts`.

A host wanting the zero-`<pie-theme>` path aliases DaisyUI's variables to
`--pie-*` in its own stylesheet — the same twenty lines any non-DaisyUI design
system needs, and the only shape that also reaches host chrome under
`[data-color-scheme]`.

Published versions stay on npm, so a range pointing at the package still
resolves; it stops receiving releases. One host still declares the dependency
without importing it and should drop it.
