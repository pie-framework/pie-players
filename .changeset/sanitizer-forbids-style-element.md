---
"@pie-players/pie-players-shared": patch
---

Sanitizers now strip `<style>` elements from authored markup and tool icons.

`<style>` is a document-global stylesheet, and `pie-item-player` renders in
light DOM (`shadow: "none"`), so a `<style>` that survived sanitization applied
to the whole host page rather than to the item. DOMPurify's defaults already
dropped a top-level HTML `<style>`, but its SVG profile keeps one, so
`<svg><style>…</style></svg>` passed `sanitizeItemMarkup` and its rules reached
host chrome outside the player — verified in Chromium, where authored CSS hid an
element belonging to the host. `sanitizeSvgIcon` had the same gap through the
shared forbid-list.

`style` is now in `SANITIZER_FORBIDDEN_TAGS`, which covers both sanitizers. It
is also in DOMPurify's default `FORBID_CONTENTS`, so the CSS text is dropped
with the tag instead of surfacing as item text.

Behaviour change for consumers: authored item or passage markup that carried a
`<style>` block inside an `<svg>` loses it. Per-element styling through `style`
attributes, `class`, and the theme tokens is unaffected, and hosts that
deliberately trust their content can still opt out of sanitization entirely with
`trust-markup` or supply their own sanitizer via `sanitizeMarkup`.

Inline `style` attributes are handled separately, by the declaration filter in
the companion changeset.
