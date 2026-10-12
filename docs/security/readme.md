# Security

The trust boundary the players enforce for authored content, the limits their
sanitizers accept by design, and the obligations that fall to the host because
the framework cannot enforce them from inside a page it does not own.

Scope is the delivery surface (`pie-item-player`, `pie-section-player`,
`pie-assessment-player`, `pie-print-player`) and the authored content it
renders. The section and assessment players render each item through
`<pie-item-player>`, so the item player's controls below govern them too. The
print player sanitizes with the same lists and has its own `trust-markup`.
Transport security, authentication, and the integrity of the pipeline that
produced an item belong to the host.

## Host obligations

1. Leave `allowed-style-origins` unset, or list only the origins the
   deployment serves CSS from ([External stylesheets](#external-stylesheets)).
2. Send a `Content-Security-Policy` with a per-response nonce and
   `'strict-dynamic'`, inline styles allowed, and the origins the loading
   strategy and tools reach ([Content-Security-Policy](#content-security-policy)).
3. For proctored or high-stakes delivery: `hosted=true`, models redacted before
   they reach the browser, and outcomes the host computes
   ([Delivery integrity](#delivery-integrity)).
4. Keep `trust-markup` unreachable from page script wherever content is not
   host-trusted ([Escape hatches](#escape-hatches)).
5. Supply an `ElementPackagePolicy` where authored configs are less trusted than
   the delivery tier ([Escape hatches](#escape-hatches)).
6. Accept the absolute-positioned overlay residual, or set `position: relative`
   on `.pie-item-player` for the partial mitigation
   ([Accepted residual](#accepted-residual-absolute-positioned-overlays)).

## Trust boundary

Three parties meet in a rendered item.

**The host page is trusted.** It supplies `config`, `env` and every attribute,
and it reaches into the player's light DOM at will. No control here defends
against the embedding page.

**Authored content is untrusted.** `config.markup`, `passage.markup`, the
`style` attributes inside them, the rich-content fields of `config.models[]`,
and `config.resources.stylesheets[].url` all arrive from an authoring pipeline
whose authors are not engineers of the delivering product. Markup and its
`style` attributes cross
[`sanitizeItemMarkup`](../../packages/players-shared/src/security/sanitize-item-markup.ts).
Models reach their elements verbatim, so each element owns how it renders its
model's rich-content fields. Stylesheet URLs cross
[`validateExternalStyleUrl`](../../packages/players-shared/src/security/validate-style-url.ts)
([External stylesheets](#external-stylesheets)). Tool icons supplied as inline
SVG cross
[`sanitizeSvgIcon`](../../packages/players-shared/src/security/sanitize-svg-icon.ts).

**Element packages are trusted by default.** `config.elements` names executable
code, fetched by package and version from a bundle host or CDN and registered as
custom elements. The default path constrains nothing about which package a
config may name, so authored data selects the code that renders it.
[`ElementPackagePolicy`](../../packages/players-shared/src/loaders/element-package-policy.ts)
closes that when a host opts in.

## Light DOM and the absence of containment

`pie-item-player` declares `shadow: "none"`
([`PieItemPlayer.svelte`](../../packages/item-player/src/PieItemPlayer.svelte)),
so host styles reach rendered assessment content: theme tokens, color schemes,
`--pie-font-scale` and the rest of the accommodation chain apply to authored
markup because no shadow boundary intercepts them. [`AGENTS.md`](../../AGENTS.md)
records the mixed `shadow: "open"` / `shadow: "none"` strategy as a design
decision.

The price is that authored CSS is not contained. The container carries
`display: block` and nothing else (no positioned ancestor, no `contain`, no
stacking context), so nothing between an authored node and the initial
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
drop it: an authored `<svg><style>` restyles host chrome outside the item. Both
elements are in DOMPurify's default `FORBID_CONTENTS`, so their text is dropped
with the tag and never surfaces as visible item text.

Event-handler attributes are forbidden explicitly as well as by DOMPurify's own
block-list, together with `formaction` and `xlink:href`. Non-http(s) protocols
are rejected: `ALLOW_UNKNOWN_PROTOCOLS: false` closes `javascript:` and
unmarked `data:` URLs.

`style` attributes are filtered per declaration by
[`sanitizeStyleAttribute`](../../packages/players-shared/src/security/sanitize-style-attribute.ts),
an `afterSanitizeAttributes` hook on each sanitizer's memoized DOMPurify
instance. It removes two declaration classes:

- any value carrying `url()`, `image-set()`, `-webkit-image-set()` or `src()`,
  which would make the browser request an arbitrary origin on every render and
  report back which learner saw which item;
- `position: fixed`, which leaves the item's box entirely.

Everything else is kept, because authored items use inline styles for ordinary
per-element presentation. Filtering runs against the parsed CSSOM, so a
CSS-escaped spelling (`\75 rl(` for `url(`) and a value containing a quoted
semicolon both resolve before the check sees them, and a declaration the engine
did not parse is dropped. An attribute with nothing forbidden is returned
byte-identical, so a serialization round-trip never expands authored shorthands
into longhands.

What survives by design:

- **`pie-*` custom elements**, via `CUSTOM_ELEMENT_HANDLING.tagNameCheck`.
  Versioned tags (`pie-*--version-*`) are authored content contracts, and a
  generic allow-list that dropped unknown tags would break them.
- **MathML DOMPurify drops**: elementary math (`mstack`, `mlongdiv` and their
  groups, rows, lines and carries, with their attributes), `mspace`'s
  `linebreak`, `semantics`, `annotation`, `mprescripts`, `none` and prefixed
  MathML such as `<mml:math>`, which the math adapter typesets. `annotation-xml`
  stays out: it is an HTML integration point.
- **The PIE attribute contract**: `id`, `class`, `style`, `slot`, `role`,
  `tabindex`, `data-*`, `aria-*`, `pie-*`, `model-*`, `session-*`, `config-*`,
  `context-*`, via `CUSTOM_ELEMENT_ATTR_REGEX`.
- **Unprefixed `id` values.** `SANITIZE_NAMED_PROPS` stays `false`: it would
  prefix every `id` with `user-content-`, and
  [`updateSinglePieElement`](../../packages/players-shared/src/pie/updates.ts)
  matches models to elements by strict `config.models[].id === element.id`
  equality, so enabling it silently breaks model lookup for every item.
  `SANITIZE_DOM: true` keeps the DOM-clobbering defenses that motivate
  named-prop sanitization, so the trade costs the `id` prefixing alone.

Under SSR the sanitizer returns an empty string, so untrusted markup never
reaches prerender output; the live renderer re-sanitizes on hydrate.

## Accepted residual: absolute-positioned overlays

An authored `position: absolute; inset: 0; width: 100vw; height: 100vh` still
paints over the host page. `position: absolute` and `position: sticky` are kept:
sticky cannot leave its containing block, and absolute is load-bearing for
accessibility. MathJax's `mjx-assistive-mml` carries
`position: absolute; width: 1px; height: 1px; overflow: hidden` to expose MathML
to a screen reader while hiding it visually
([`tts-math-aware-text-processing.test.ts`](../../packages/assessment-toolkit/tests/tts-math-aware-text-processing.test.ts)).

Measured in Chromium against the candidate container styles
([PR #335](https://github.com/pie-framework/pie-players/pull/335)):

| container style | overlay geometry | host chrome above the item |
| --- | --- | --- |
| today (`display: block`) | anchored to the viewport, 100vw x 100vh | covered |
| `position: relative` or `contain: layout` | anchored to the item container, still 100vw x 100vh | protected |
| `contain: paint` | painting clipped to the container | protected |
| `isolation: isolate` | anchored to the viewport, unchanged | covered |

A containing block is a partial mitigation. It moves the overlay's origin onto
the item, protecting host chrome laid out above it, while the box still extends
a full viewport past the container, so anything after it stays covered.

Only paint containment contains, and it clips, including the `overflow-x: auto`
reflow wrappers `sanitizeItemMarkup` inserts for WCAG 1.4.10 Reflow at 400%
zoom. That clipping is why print rendering already opts out of those wrappers
with `wrapOverwideContent: false`
([`markup-processor.ts`](../../packages/print-player/src/markup-processor.ts)).
Paint containment would reproduce it on screen, where the wrappers are the only
route to the rest of a wide table.

`isolation: isolate` buys nothing: the overlay wins by positioning against the
initial containing block, and z-index plays no part.

What stays reachable is visual disruption by whoever already authors the item's
content, with no channel behind it: `<script>`, `<form>` and `<style>` are
forbidden and `url()` is filtered, so an overlay can cover things and can
neither execute nor transmit. Accepted as a consequence of the light-DOM
decision. A host that wants the partial mitigation sets `position: relative` on
`.pie-item-player` from its own stylesheet. Light DOM makes that reachable, and
for light-DOM custom elements those class names are public API.

## Delivery integrity

`role` and `mode` are not a security boundary. `add-correct-response`, `env`
and `mode` are public observed attributes on `<pie-item-player>`
([`PieItemPlayer.svelte`](../../packages/item-player/src/PieItemPlayer.svelte)),
so any script on the page sets any of them. `populateCorrectResponses`, in the
shared item renderer
([`players-shared/src/components/PieItemPlayer.svelte`](../../packages/players-shared/src/components/PieItemPlayer.svelte)),
then escalates by design:
[`getCorrectResponseEnv`](../../packages/players-shared/src/pie/correct-response-env.ts)
forces `role: "instructor"`, gated only on `env.mode !== "evaluate"`. With
`add-correct-response` set, the player asks every element controller for its
correct-response session in the learner's browser.

The precondition is client-side controllers, and that is the default. The item
player's `resolveBundleType()` returns `clientPlayer` whenever the player is not
hosted. `hosted` is unset by default and resolves as
`hosted ?? isDeliveryBackendEnabled(backend)`, so a player is hosted only when
the host sets `hosted` or enables `backend.delivery`. `clientPlayer` bundles
carry the controllers, so in the default configuration the answer key and the
scoring logic are both in the browser. The exposure is the bundle type, and an
attribute flip adds nothing to it: removing `add-correct-response` from a page
changes nothing about what the loaded controllers can compute.

![Element controller placement: by default the controller runs in the browser with the authored model, answer key included, and scores through provideScore(); hosted, it runs on the server behind the backend, sends the delivery view only its view model, and scores through score()](../img/element-controller-flow.excalidraw.svg)

A proctored or high-stakes delivery therefore needs all three of:

1. `hosted=true`, or `backend.delivery`, which implies it, so
   `resolveBundleType()` selects `player` bundles: elements only, no
   controllers.
   [`strategy="iife"`](../item-player/loading-strategies.md#strategyiife) gives
   the bundle-type selection per strategy.
2. `config.models[]` stripped of key-bearing and rationale fields before it
   reaches the browser. The players pass models through to elements verbatim;
   nothing in this repo redacts them.
3. Outcomes the host computes, handed to the controller.
   `SectionController.recordFormativeTry`
   ([host controls](../section-player/formative-delivery.md#host-controls))
   accepts outcomes computed anywhere, including on the host's server
   ([seam obligations](../architecture/framework-completing-work.md#seam-obligations)).
   The shipped [Check answer control](../section-player/formative-delivery.md#check-control)
   scores in the browser through the item player's `provideScore()`, so
   server-scored Tries need a host-rendered control that calls
   `recordFormativeTry`.

The formative flow reveals solutions in the browser by design, under an
authored policy: `envOverrideFor`
([`formative/state.ts`](../../packages/players-shared/src/formative/state.ts))
projects `role: "instructor"` onto a revealed item when the resolved feedback
level is `solution`. That is an intended reveal to a learner who has spent a
Try, and it is independent of the delivery case above: a host that cannot
afford client-side keys configures the policy accordingly and never relies on
`env` to withhold them.

## External stylesheets

[`validateExternalStyleUrl`](../../packages/players-shared/src/security/validate-style-url.ts)
rejects protocols other than http(s). With `allowed-style-origins` unset, its
default, it accepts same-origin URLs only; set, it accepts only the origins it
lists, the page's own included only when listed. Authored content reaches this
path through `config.resources.stylesheets[].url`, alongside the
host-controlled `external-style-urls` attribute.

The two origin classes are handled asymmetrically
([`external-styles.ts`](../../packages/item-player/src/utils/external-styles.ts),
`acquireScopedExternalStyle` and `ensureCrossOriginExternalStyle`):

- **Same-origin** CSS is fetched, passed through `scopeStylesheetCss`, and
  appended to `document.head` scoped to `.pie-item-player.<scope>`.
- **Cross-origin** CSS is appended to `document.head` as a bare
  `<link rel="stylesheet">` with no scoping at all, because a cross-origin
  fetch without CORS headers cannot be read to scope it. Its rules apply
  document-wide.

So an authored stylesheet from a listed cross-origin host restyles the host
page. List only the origins the deployment serves CSS from; the allow-list is
the only control on this path.

## Content-Security-Policy

The players load element bundles by injecting `<script>` tags
([`iife-adapter.ts`](../../packages/players-shared/src/loaders/iife-adapter.ts),
`defaultLoadBundleScript`), and the ESM strategy injects a
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
Dynamic `import()` inherits the nonce of the script that initiated it, which is
why rows 2 and 3 load an unlisted origin and row 4, with no nonce in play, does
not.

### Base policy

Every strategy starts from this policy:

```
default-src 'self';
script-src 'nonce-{per-response}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:;
media-src 'self' https:;
object-src 'none';
base-uri 'none';
```

- `script-src`: the host's own player bundle carries the nonce, since
  `'strict-dynamic'` propagates trust from it.
- `'unsafe-inline'` in `style-src` is load-bearing. Under `style-src 'self'`
  alone, Chromium blocks both authored `style` attributes (`style-src-attr`)
  and the `<style>` element the same-origin stylesheet path appends
  (`style-src-elem`), so authored presentation and scoped host CSS fail
  silently. `'strict-dynamic'` is script-only, and a nonce cannot help because
  the injected `<style>` carries none.
- `img-src` and `media-src` cover authored media and TTS audio.
- `object-src 'none'` and `base-uri 'none'` cost nothing, since the sanitizer
  already forbids `<object>`, `<embed>` and `<base>`.
- `connect-src` also lists the deployment's own endpoints, such as the TTS
  server or a scoring API, which no default here covers.

Each strategy then adds the origins its element code and math rendering reach.
Measured in Chromium against items with math, each strategy renders its math
and assistive MathML with no violations under the base policy plus its
additions. A page that loads the section player's browser build from a CDN adds
what [CDN usage](../install/cdn.md#content-security-policy) lists.

### `iife` origins

`iife` bundles arrive by `<script src>` from the bundle host, by default
`https://proxy.pie-api.com/bundles/` (`loaderOptions.bundleHost` overrides it),
which `'strict-dynamic'` admits. The element bundles render with MathJax 3,
which loads its fonts from `unpkg.com` (`@pie-lib/math-rendering-module` sets
its `fontURL`, with no override). Its speech rule engine fetches its mathmaps
from `cdn.jsdelivr.net` when the player loads its first `iife` item, and throws
an uncaught error when that request is blocked:

```
connect-src 'self' https://cdn.jsdelivr.net;
font-src 'self' data: https://unpkg.com;
```

Generated preloaded-player builds that carry an IIFE bundle take the same
additions.

### `esm` origins

Element modules and their dependencies load from `cdn.jsdelivr.net`, or from
`loaderOptions.esmCdnUrl`, and the loader fetches package metadata from the
same origin, so `connect-src` lists the `esmCdnUrl` origin when one is set.
Element builds on `@pie-element/shared-math-rendering-mathjax` 0.1.3 or later,
and the player's renderer for item markup math, load MathJax's fonts and speech
data from the element CDN
([MathJax assets](../item-player/math-rendering.md#mathjax-assets)). Builds on
adapters up to 0.1.2 load them from `cdn.jsdelivr.net` whatever `esmCdnUrl`
names, and so does the MathJax 4 that their page-global builds load. With
jsDelivr as both:

```
connect-src 'self' https://cdn.jsdelivr.net;
font-src 'self' data: https://cdn.jsdelivr.net;
```

With the esm.sh provider, package metadata, element builds and MathJax assets
come from `https://raw.esm.sh` and shared dependencies from the `esmCdnUrl`
origin ([ESM CDN providers](../item-player/loading-strategies.md#esm-cdn-providers)),
so `raw.esm.sh` takes jsDelivr's place in both directives; jsDelivr stays for
adapters up to 0.1.2.

### `preloaded` origins

The element modules come from the host's own bundle. Their MathJax fonts and
speech data load from the origin a generated package or the host's build output
is served from, or from the root or URLs the host registers
([MathJax assets](../item-player/math-rendering.md#mathjax-assets)). Builds from
the current generator bundle ESM elements with MathJax inside their chunks and
serve its fonts and speech data from their own `dist/mathjax/npm/`, so their
math adds no origin. Elements on adapters up to 0.1.2 take the `esm` additions
for jsDelivr.

### Speech workers

Speech loads only once a student turns on Semantic Enrichment, and the
measurements above leave it off. MathJax runs it in a `blob:` worker that
imports `speech-worker.js` from its URL or the asset root with `importScripts`
and fetches the speech rules from beside it. A policy that sets `worker-src`
or `child-src` lists `blob:` there.

### Tool origins

- **Cortex calculator.** `data:` in `font-src` carries its bundled MathLive
  fonts. Its evaluation worker is a script the host's bundler emits among the
  host's own assets. The base policy sets no `worker-src`, so `'strict-dynamic'`
  in `script-src` admits the worker; a policy that sets `worker-src` or
  `child-src` lists `'self'` there. Loaded cross-origin, as from the section
  player's browser build on a CDN, the worker starts from a `blob:` URL.
- **Math speech in TTS.** The toolkit loads speech-rule-engine's base, English
  and Spanish tables from chunks in the host's bundle, which adds no origin. A
  table for another locale loads from the `json` URL or `custom` loader the host
  names in the math speech `engineOptions`.
- **Toolbar icons and fonts.** Toolbars that render Font Awesome icons load Font
  Awesome Free 6.5.2 from `cdn.jsdelivr.net` when the page has no Font Awesome
  stylesheet. Their buttons from the Renaissance Next Design System (NDS) load
  Roboto from `ui.renaissance.com` when the page has no stylesheet whose URL
  contains `Roboto`, and that CDN serves the font files to Renaissance origins
  only. A page showing those toolbars adds
  `https://cdn.jsdelivr.net https://ui.renaissance.com` to `style-src` and
  `font-src`, or supplies both stylesheets itself; a page off a Renaissance
  origin links its own Roboto. A page that links Font Awesome Pro gets the
  design's Light glyphs; with Free, its own or the toolbar's, they render in
  Solid.
- **Desmos and GeoGebra calculators.** The providers inject the vendor's script,
  `https://www.desmos.com/api/v1.12/calculator.js` and, unless the host names
  another `scriptUrl`, `https://www.geogebra.org/apps/deployggb.js`, which
  `'strict-dynamic'` admits.

### Policies without `'strict-dynamic'`

Without `'strict-dynamic'`, a host-source entry covers the IIFE bundle URL but
not the import map, which is an inline script element that cannot be given a
nonce from outside the adapter. The ESM strategy then loads through
es-module-shims, as it does where Firefox rejects the map, but the policy still
refuses MathJax's injected script.

Each injected `<script src>` needs its origin in `script-src`: the bundle host
for `iife`, and for the MathJax 4 that page-global element builds inject under
`esm` and `preloaded`, `cdn.jsdelivr.net` up to adapter 0.1.2 and the asset
root's origin from adapter 0.1.3. Elements that bundle MathJax inject none.

### Firefox and es-module-shims

In Firefox the ESM strategy loads through es-module-shims whenever the browser
rejects its import map
([Browsers that reject late import maps](../item-player/loading-strategies.md#browsers-that-reject-late-import-maps)).
es-module-shims fetches module sources, which `connect-src` already admits, and
imports them as `blob:` URLs, which the nonce admits. Measured in Firefox, the
base policy plus the `esm` additions loads with no violations.

## Escape hatches

Each of these moves a guarantee from the framework to the host that enables it.

**`trust-markup`** skips sanitization completely (the `trustMarkup` prop of the
shared item renderer,
[`PieItemPlayer.svelte`](../../packages/players-shared/src/components/PieItemPlayer.svelte)).
It is an observed attribute, so a script on the page can set it on a live
player; a host that renders content it does not fully control should not ship a
page where that attribute is reachable. Accepting it means accepting that
authored markup is host-trusted code.

**`sanitizeMarkup`** replaces the default sanitizer with a caller-supplied
function (the `sanitizeMarkup` prop in the same file). It is a property with no
attribute binding, so only host script sets it. A custom sanitizer owns
everything on this page: the forbid-lists, the custom-element contract, and the
`id` preservation that model lookup depends on.

**`ElementPackagePolicy`** is off by default, and omitting it keeps
trusted-application behavior: authored `config.elements` decides which
executable packages load. Supplying it restricts execution to exact package
names or `name@version` specs, with exact-semver enforcement on by default.
Hosts pass it as `loaderOptions.elementPackagePolicy`. A deployment whose
authoring tier is less trusted than its delivery tier owes this policy.
