---
"@pie-players/pie-players-shared": patch
---

Sanitizers now filter the declarations inside a `style` attribute.

DOMPurify lists `style` among its URI-safe attributes, so it permitted the
attribute and inspected nothing inside it. Two things reached the page through
an authored inline style as a result: a URL-fetching function, which makes the
browser request an arbitrary origin every time the item renders and reports back
which learner saw which item, and `position: fixed`, which leaves the item's box
and covers the host page — `pie-item-player` renders in light DOM
(`shadow: "none"`), so nothing else confined it.

`sanitizeItemMarkup` and `sanitizeSvgIcon` now drop any declaration whose value
carries `url()`, `image-set()`, `-webkit-image-set()` or `src()`, and any
`position: fixed`. Every other declaration is kept, and an attribute with
nothing forbidden in it is returned byte-identical, so a shorthand stays a
shorthand. Filtering runs against the parsed CSSOM rather than the raw string,
so escaped spellings (`\75 rl(`), comments and quoted semicolons are normalized
before the check.

`position: absolute` and `position: sticky` are deliberately kept. Sticky cannot
leave its containing block. Absolute is load-bearing for accessibility —
MathJax's `mjx-assistive-mml` carries `position: absolute; width: 1px;
height: 1px; overflow: hidden` to expose MathML to a screen reader while hiding
it visually — and an authored absolute overlay is still possible where no
ancestor between the node and the viewport is positioned. Closing that means
making the player's container a containing block, which re-anchors every
absolutely positioned node a PIE element renders, so it is a separate change
with its own visual review.

Behaviour change for consumers: an authored `background-image: url(…)` or
`position: fixed` in a `style` attribute is removed. Background images belong in
`<img>`, whose `src` already goes through the sanitizer's URI checks. Hosts that
trust their own content keep both existing escape hatches, `trust-markup` and a
caller-supplied `sanitizeMarkup`.
