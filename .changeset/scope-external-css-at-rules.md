---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Scope external stylesheets with an at-rule-aware walker, so `@media`, `@supports` and `:root` survive.

`pie-item-player` scoped external stylesheets by prefixing every selector-like fragment with
one regex. That is correct for flat selector rules and wrong for everything else:
`@media screen { ... }` became `.pie-item-player.x @media screen { ... }`, an invalid
selector, so the browser dropped the whole block and every rule inside it. `@font-face` and
`@keyframes` were corrupted the same way — the font never loaded, the animation name was
gone. And `:root { --var: ... }` became `.pie-item-player.x :root`, which can never match,
because `:root` is `<html>` and is not a descendant of the player.

At-rules and `:root` custom properties therefore never applied at all. Both entry paths were
affected: the `external-style-urls` attribute and `itemConfig.resources.stylesheets[*].url`.

Scoping now walks the stylesheet brace-by-brace, in a new `scopeStylesheetCss` export from
`@pie-players/pie-players-shared`:

- `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
  their inner rules scoped, recursively.
- `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
  `@counter-style` pass through untouched, as do at-rules the walker does not recognise —
  their blocks hold declarations or keyframe selectors, not selectors to scope.
- `:root`, `html` and `body` are replaced by the scope selector instead of being prefixed by
  it, so external custom properties apply. Anything that followed is preserved:
  `html.dark .a` becomes `.pie-item-player.x.dark .a`.
- A leading pseudo becomes a descendant: `:is(.a, .b) .c` scopes to
  `.pie-item-player.x :is(.a, .b) .c`, not `.pie-item-player.x:is(.a, .b) .c`, which would
  demand that the player root carry the partner's class.
- Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
  a `,` inside `:is(a, b)` does not split a selector list. Comments are stripped before the
  walk so one sitting between two rules is not absorbed into the next selector.
- Style-rule blocks are emitted verbatim, which is also what native CSS nesting needs:
  nested selectors are relative to a parent that has already been scoped.

Flat selector rules scope exactly as before. No new dependency, and no public API change —
no new attribute, prop or event.

**Where stylesheets are passed, expect visible changes.** At-rules and `:root` variables have
never applied in this player, so fixing the scoper turns currently-dead CSS live. That is the
point of the fix, but it is a real rendering difference for any host that was passing a
stylesheet with media queries or custom properties in it.

`@import` still passes through untouched, exactly as the regex left it. It pulls in an
unscoped stylesheet and so defeats scoping; blocking it is a policy decision, not a scoping
one. Cross-origin stylesheets are also still unscoped — they take the `<link>` branch because
`fetch()` cannot read the text to rewrite. Both are pre-existing and tracked separately.
