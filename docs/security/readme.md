# Security

The trust boundary the players enforce for authored content, the limits their
sanitizers deliberately accept, and the obligations that fall to the host
because the framework cannot enforce them from inside a page it does not own.

Scope is the delivery surface — `pie-item-player`, `pie-section-player`,
`pie-assessment-player`, `pie-print-player` — and the authored content they
render. Transport security, authentication, and the integrity of the pipeline
that produced an item belong to the host.

## Trust boundary

Three parties meet in a rendered item.

**The host page is trusted.** It supplies `config`, `env` and every attribute,
and it reaches into the player's light DOM at will. No control here defends
against the embedding page.

**Authored content is untrusted.** `config.markup`, `passage.markup`, the
`style` attributes inside them, the rich-content fields of `config.models[]`,
and `config.resources.stylesheets[].url` all arrive from an authoring pipeline
whose authors are not engineers of the delivering product.
[`sanitizeItemMarkup`](../../packages/players-shared/src/security/sanitize-item-markup.ts)
is the boundary they cross. Tool icons supplied as inline SVG cross the same
boundary through
[`sanitizeSvgIcon`](../../packages/players-shared/src/security/sanitize-svg-icon.ts).

**Element packages are trusted by default.** `config.elements` names executable
code, fetched by package and version from a bundle host or CDN and registered as
custom elements. The default path constrains nothing about which package a
config may name, so authored data selects the code that renders it.
[`ElementPackagePolicy`](../../packages/players-shared/src/loaders/element-package-policy.ts)
closes that when a host opts in.

## Light DOM and the absence of containment

`pie-item-player` declares `shadow: "none"`
([`PieItemPlayer.svelte:5`](../../packages/item-player/src/PieItemPlayer.svelte)),
so host styles reach rendered assessment content: theme tokens, colour schemes,
`--pie-font-scale` and the rest of the accommodation chain apply to authored
markup because no shadow boundary intercepts them. `AGENTS.md` records the mixed
`shadow: "open"` / `shadow: "none"` strategy as a design decision.

The price is that authored CSS is not contained. The container carries
`display: block` and nothing else — no positioned ancestor, no `contain`, no
stacking context — so nothing between an authored node and the initial
containing block confines it. The sanitizer's forbid-lists carry the whole
containment job, and the residual below is what they do not reach.

## Sanitizer guarantees

Both sanitizers read one shared pair of lists
([`sanitize-forbidden-lists.ts`](../../packages/players-shared/src/security/sanitize-forbidden-lists.ts)),
so a newly identified sink is closed once for every consumer.

Forbidden tags: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`,
`<form>`, `<meta>`, `<link>`, `<foreignObject>`, `<style>`. `<foreignObject>` is
an escape hatch from SVG back into HTML context. `<style>` is a document-global
stylesheet, and DOMPurify's SVG profile keeps one even though its HTML defaults
drop it — an authored `<svg><style>` restyles host chrome outside the item. Both
elements are in DOMPurify's default `FORBID_CONTENTS`, so their text is dropped
with the tag rather than surfacing as visible item text.

Event-handler attributes are forbidden explicitly as well as by DOMPurify's own
block-list, together with `formaction` and `xlink:href`. Non-http(s) protocols
are rejected: `ALLOW_UNKNOWN_PROTOCOLS: false` closes `javascript:` and
unmarked `data:` URLs.

`style` attributes are filtered per declaration rather than dropped, by
[`sanitizeStyleAttribute`](../../packages/players-shared/src/security/sanitize-style-attribute.ts),
installed as an `afterSanitizeAttributes` hook on each sanitizer's memoized
DOMPurify instance. Two declaration classes are removed: any value carrying
`url()`, `image-set()`, `-webkit-image-set()` or `src()`, which otherwise makes
the browser request an arbitrary origin on every render and reports back which
learner saw which item; and `position: fixed`, which leaves the item's box
entirely. Everything else is kept, because authored items use inline styles for
ordinary per-element presentation. Filtering runs against the parsed CSSOM, so a
CSS-escaped spelling (`\75 rl(` for `url(`) and a value containing a quoted
semicolon both resolve before the check sees them; a declaration the engine did
not parse is dropped rather than passed through. An attribute with nothing
forbidden is returned byte-identical, so authored shorthands are not expanded
into longhands by a serialization round-trip.

What survives by design:

- **`pie-*` custom elements**, via `CUSTOM_ELEMENT_HANDLING.tagNameCheck`.
  Versioned tags (`pie-*--version-*`) are authored content contracts and a
  generic allow-list that dropped unknown tags would break them.
- **The PIE attribute contract** — `id`, `class`, `style`, `slot`, `role`,
  `tabindex`, `data-*`, `aria-*`, `pie-*`, `model-*`, `session-*`, `config-*`,
  `context-*` — via `CUSTOM_ELEMENT_ATTR_REGEX`.
- **Unprefixed `id` values.** `SANITIZE_NAMED_PROPS` stays `false`: it would
  prefix every `id` with `user-content-`, and
  [`updateSinglePieElement`](../../packages/players-shared/src/pie/updates.ts)
  matches models to elements by strict `config.models[].id === element.id`
  equality, so enabling it silently breaks model lookup for every item.
  `SANITIZE_DOM: true` keeps the DOM-clobbering defences that motivate
  named-prop sanitization, so the trade costs the `id` prefixing alone.

Under SSR the sanitizer returns an empty string, so untrusted markup never
reaches prerender output; the live renderer re-sanitizes on hydrate.

## Accepted residual: absolute-positioned overlays

An authored `position: absolute; inset: 0; width: 100vw; height: 100vh` still
paints over the host page. `position: absolute` and `position: sticky` are kept:
sticky cannot leave its containing block, and absolute is load-bearing for
accessibility — MathJax's `mjx-assistive-mml` carries
`position: absolute; width: 1px; height: 1px; overflow: hidden` to expose MathML
to a screen reader while hiding it visually
([`tts-math-aware-text-processing.test.ts:73`](../../packages/assessment-toolkit/tests/tts-math-aware-text-processing.test.ts)).

Measured in Chromium against the candidate container styles
([PR #335](https://github.com/pie-framework/pie-players/pull/335)):

| container style | overlay geometry | host chrome above the item |
| --- | --- | --- |
| today (`display: block`) | anchored to the viewport, 100vw x 100vh | covered |
| `position: relative` or `contain: layout` | anchored to the item container, still 100vw x 100vh | protected |
| `contain: paint` | painting clipped to the container | protected |
| `isolation: isolate` | anchored to the viewport, unchanged | covered |

A containing block is a partial mitigation: it moves the overlay's origin onto
the item, protecting host chrome laid out above it, while the box still extends
a full viewport past the container so anything after it stays covered. Only
paint containment contains, and it clips — including the `overflow-x: auto`
reflow wrappers `sanitizeItemMarkup` inserts for WCAG 1.4.10 Reflow at 400%
zoom. That clipping is why print rendering already opts out of those wrappers
with `wrapOverwideContent: false`
([`markup-processor.ts:70`](../../packages/print-player/src/markup-processor.ts));
paint containment would reproduce it on screen, where the wrappers are the only
route to the rest of a wide table. `isolation: isolate` buys nothing, because
the overlay wins by positioning against the initial containing block rather than
by z-index.

What stays reachable is therefore visual disruption by whoever already authors
the item's content, with no channel behind it: `<script>`, `<form>` and
`<style>` are forbidden and `url()` is filtered, so an overlay can cover things
and can neither execute nor transmit. Accepted as a consequence of the light-DOM
decision. A host that wants the partial mitigation sets `position: relative` on
`.pie-item-player` from its own stylesheet — light DOM is what makes that
reachable, and for light-DOM custom elements those class names are public API.

## Delivery integrity

`role` and `mode` are not a security boundary.
`add-correct-response`, `env` and `mode` are public observed attributes on
`<pie-item-player>`
([`PieItemPlayer.svelte:10`](../../packages/item-player/src/PieItemPlayer.svelte)),
so any script on the page sets any of them.
[`populateCorrectResponses`](../../packages/players-shared/src/components/PieItemPlayer.svelte)
then escalates deliberately: `getCorrectResponseEnv` forces `role: "instructor"`
([`correct-response-env.ts:6`](../../packages/players-shared/src/pie/correct-response-env.ts)),
gated only on `env.mode !== "evaluate"`. With `add-correct-response` set, the
player asks every element controller for its correct-response session in the
learner's browser.

The precondition is client-side controllers, and that is the default.
`resolveBundleType()` returns `clientPlayer` whenever `hosted` is false
([`PieItemPlayer.svelte:790`](../../packages/item-player/src/PieItemPlayer.svelte)),
and `hosted` defaults to false. `clientPlayer` bundles carry the controllers, so
in the default configuration the answer key and the scoring logic are both in
the browser, and an attribute flip is not the exposure — the bundle type is.
Removing `add-correct-response` from a page changes nothing about what the
loaded controllers can compute.

A proctored or high-stakes delivery therefore needs all three of:

1. `hosted=true`, so `resolveBundleType()` selects `player` bundles — elements
   only, no controllers. See
   [`loading-strategies.md`](../item-player/loading-strategies.md#strategyiife)
   for the bundle-type selection per strategy.
2. `config.models[]` stripped of key-bearing and rationale fields before it
   reaches the browser. The players pass models through to elements verbatim;
   nothing in this repo redacts them.
3. Outcomes computed by the host and handed to the controller.
   `SectionController.recordFormativeTry` accepts outcomes the host computed
   anywhere, including server-side, which is
   [how a product keeps the answer key out of the browser](../architecture/framework-completing-work.md).
   The shipped control does not use that path, so server-scored Tries mean a
   host-rendered control driving the controller.

The formative flow reveals solutions in the browser by design, under an
authored policy: `envOverrideFor` projects `role: "instructor"` onto a revealed
item when the resolved feedback level is `solution`
([`formative/state.ts:155`](../../packages/players-shared/src/formative/state.ts)).
That is an intended reveal to a learner who has spent a Try, and it is
independent of the delivery case above — a host that cannot afford
client-side keys configures the policy accordingly rather than relying on
`env` to withhold them.

## External stylesheets

[`validateExternalStyleUrl`](../../packages/players-shared/src/security/validate-style-url.ts)
always rejects protocols other than http(s). It enforces an origin allow-list
only when the host supplies one, and `allowed-style-origins` is unset by
default, so every http(s) origin is accepted out of the box. Authored content
reaches this path through `itemConfig.resources.stylesheets[].url`, alongside
the host-controlled `external-style-urls` attribute.

The two origin classes are then handled asymmetrically
([`PieItemPlayer.svelte:1144`](../../packages/item-player/src/PieItemPlayer.svelte)):

- **Same-origin** CSS is fetched, passed through `scopeStylesheetCss`, and
  appended to `document.head` scoped to `.pie-item-player.<scope>`.
- **Cross-origin** CSS is appended to `document.head` as a bare
  `<link rel="stylesheet">` with no scoping at all, because a cross-origin
  fetch without CORS headers cannot be read to scope it. Its rules apply
  document-wide.

So an authored cross-origin stylesheet URL restyles the host page. Set
`allowed-style-origins` to the origins the deployment actually serves CSS from;
it is the only control on this path.

## Content-Security-Policy

The players load element bundles by injecting `<script>` tags
([`iife-adapter.ts`](../../packages/players-shared/src/loaders/iife-adapter.ts),
`defaultLoadBundleScript`), and the ESM strategy in `import-map` mode injects a
`<script type="importmap">`
([`esm-adapter.ts`](../../packages/players-shared/src/loaders/esm-adapter.ts),
`injectImportMap`). Neither carries a nonce. Nothing in this repo sets a CSP;
the policy is the host's, and these are the constraints it has to satisfy.

Measured in Chromium 152, injecting each of the three paths under a
header-delivered policy:

| `script-src` | IIFE `<script src>` | injected import map | `import()` of an unlisted CDN origin |
| --- | --- | --- | --- |
| `'nonce-…' 'strict-dynamic'` | loads | applies | loads |
| `'nonce-…'` | refused | refused | loads |
| `'nonce-…' https://bundle-host` | loads | refused | loads |
| `'unsafe-inline' https://bundle-host` | loads | applies | refused |

`'strict-dynamic'` is what makes every strategy work: it allows a script element
created by already-trusted script, which is exactly how both adapters inject.
Without it, a host-source entry covers the IIFE bundle URL but not the import
map, which is an inline script element that cannot be given a nonce from
outside the adapter — bare specifiers then fail to resolve and the ESM load
fails. Dynamic `import()` inherits the nonce of the script that initiated it,
which is why rows 2 and 3 load an unlisted origin and row 4, with no nonce in
play, does not.

A starting policy that works with every loading strategy:

```
default-src 'self';
script-src 'nonce-{per-response}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:;
media-src 'self' https:;
object-src 'none';
base-uri 'none';
```

Per directive: `script-src` as above, and the host's own player bundle must
carry the nonce, since `'strict-dynamic'` propagates trust from it.
`'unsafe-inline'` in `style-src` is load-bearing: under
`style-src 'self'` alone, Chromium blocks both authored `style` attributes
(`style-src-attr`) and the `<style>` element the same-origin stylesheet path
appends (`style-src-elem`), so authored presentation and scoped host CSS fail
silently. `'strict-dynamic'` is script-only and does not help here; a nonce
cannot help either, because the injected `<style>` carries none. `img-src` and
`media-src` cover authored media and TTS audio. `object-src 'none'` and
`base-uri 'none'` cost nothing, since the sanitizer already forbids `<object>`,
`<embed>` and `<base>`. `connect-src` needs whatever endpoints the deployment
uses — the TTS server, a scoring API, the same-origin stylesheet fetch — and no
default is claimed for them here.

`moduleResolution: "url"` is the ESM default and avoids the import-map
constraint entirely.

## Escape hatches

Each of these moves a guarantee from the framework to the host that enables it.

**`trust-markup`** skips sanitization completely
([`PieItemPlayer.svelte:217`](../../packages/players-shared/src/components/PieItemPlayer.svelte)).
It is an observed attribute, so a script on the page can set it on a live
player; a host that renders content it does not fully control should not ship a
page where that attribute is reachable. Accepting it means accepting that
authored markup is host-trusted code.

**`sanitizeMarkup`** replaces the default sanitizer with a caller-supplied
function (same file, line 218). It is a property with no attribute binding, so
only host script sets it. A custom sanitizer owns everything on this page: the
forbid-lists, the custom-element contract, and the `id` preservation that model
lookup depends on.

**`ElementPackagePolicy`** is off by default, and omitting it preserves
trusted-application behaviour: authored `config.elements` decides which
executable packages load. Supplying it restricts execution to exact package
names or `name@version` specs, with exact-semver enforcement on by default.
A deployment whose authoring tier is less trusted than its delivery tier owes
this policy.

## Host obligations

1. Set `allowed-style-origins`.
2. Ship a CSP with `'strict-dynamic'` and inline style permitted.
3. For high-stakes delivery: `hosted=true`, redacted models, host-computed
   outcomes.
4. Keep `trust-markup` unreachable from page script where content is not
   host-trusted.
5. Supply an `ElementPackagePolicy` where authored configs are less trusted than
   the delivery tier.
6. Treat the absolute-overlay residual as accepted, or set `position: relative`
   on `.pie-item-player` for the partial mitigation.
