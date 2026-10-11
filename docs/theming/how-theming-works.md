# How theming works

`<pie-theme>` computes PIE's color tokens and writes them onto one element.
Everything below follows from two CSS rules and one namespace boundary. This
page explains that model for host integrators and component authors.

The [`@pie-players/pie-theme` README](../../packages/theme/README.md) is the
reference for the element's attributes, the runtime API and the custom-scheme
contract. The [theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md)
records accessibility coverage per themed surface, and the
[broad theming contract](../prds/pie-727-broad-theming-contract.md) is the design
record.

## Custom properties

A custom property is a named value. `--pie-background: #ffffff` declares one;
`background: var(--pie-background)` reads it. CSS attaches no meaning to the
name, so a property does nothing until some rule reads it — PIE's element
bundles and player chrome read the `--pie-*` family, which is what makes them
themeable at all. `@pie-players/pie-theme/token-registry.json` lists every
registered token with its owner, scope, category and scheme participation; the
README's [token registry](../../packages/theme/README.md#token-registry) section
sets out which names are registered and what stays stable.

Two rules about custom properties decide the rest of this document.

**They inherit.** Declared on `<html>`, a property is visible to every element
on the page, including inside shadow DOM. One write reaches item content the
host never renders itself.

**An inline declaration beats a stylesheet.** `style="--pie-background: red"` on
an element wins over any stylesheet rule targeting that element, at any
specificity, with no `!important` involved. `<pie-theme scope="document">` writes
inline, so a host stylesheet that declares `--pie-*` cannot compete with a
mounted element — not even one shipping the values pie-theme would have resolved
anyway. Host CSS declares `--pie-*` only in a stylesheet-only integration, where
no element is mounted and the normal cascade applies.

## Resolution order

![Theme resolution: the base theme, provider output, color scheme and variables merge in order, each overwriting the tokens set before it; the provider reads the host stylesheet's palette through getComputedStyle, and the scheme comes from the registered color schemes; the result is written inline on the target, the html element under scope document or the pie-theme element under scope self, which also carries data-theme, data-color-scheme and color-scheme; PIE content inherits the tokens](../img/theming-resolution-order.excalidraw.svg)

Four overlays merge in order, each overwriting tokens the previous one set.

1. **Base theme.** `theme="light|dark|auto"`, where `auto` follows
   `prefers-color-scheme`. There are exactly two base palettes. Any other theme
   id — every DaisyUI name among them — resolves to the light base, while the
   string itself still reaches `data-theme` for the host's own stylesheet to
   match on.
2. **Provider output.** Colors derived from whatever palette the host page
   already has.
3. **Color scheme.** A resolved accommodation, replacing the palette it
   participates in.
4. **`variables`.** A JSON object on the element, for deliberate per-instance
   overrides.

`scope="document"` writes the result onto `<html>`; `scope="self"` writes onto
the element, which scopes a palette to one subtree.

Alongside the values the element stamps selector hooks — `data-theme` carrying
the theme (for `auto`, the light or dark it resolved to), `data-color-scheme`
the requested scheme id, omitted for `default` — and sets the `color-scheme` CSS
property, but only from a resolved scheme. See
[The `color-scheme` collision](#the-color-scheme-collision).

## Provider adapters

`provider` decides where step 2's colors come from, which is the choice between
PIE content looking like PIE and looking like the host. Both are legitimate:
a vendor embedding items in its own branded app wants the second, and anyone
reviewing content, comparing two releases or printing wants the first, because a
canonical palette is the reproducible one.

- `none` resolves no adapter, leaving the base theme's own palette. Identical in
  every host.
- `auto`, the default, lets any registered adapter that can read the target win.
- A provider id names one explicitly.

One adapter ships: `daisyui`. It reads twelve DaisyUI slots off the target with
`getComputedStyle` and maps them onto 49 `--pie-*` tokens through
`DAISYUI_PIE_TOKEN_MAP`, which is the sole source for that mapping.

It corrects as it maps, and that is why the integration is an adapter rather
than a stylesheet. DaisyUI picks `--color-success` to sit legibly behind
`--color-success-content`, not against the page, so PIE painting it as text is
frequently unreadable. For those tokens the adapter measures the resolved color
on a canvas and blends toward the ink until the pair clears 4.5:1, or 3:1 for a
control boundary. CSS cannot measure a color, so a stylesheet can only apply a
fixed pessimistic blend to every slot whether it needs one or not.

`registerPieThemeProvider` is the extension point. A host on another token
vocabulary registers an adapter that reads `--acme-*` and returns `--pie-*`, and
`auto` finds it with no change to the markup.

## Token namespaces

pie-theme's base theme, provider output and color schemes write `--pie-*` and
nothing else. The `variables` attribute writes whatever `--*` names the host
passes, so a host prefix reaches the target only when the host puts it there.

That boundary decides two things. Switching a theme recolors PIE content and
leaves host chrome to the host, which is correct for presentation. And a host
that wants its own chrome to follow PIE aliases in its own stylesheet, in the
direction that works:

```css
[data-color-scheme] {
  --color-base-100: var(--pie-background);
  --color-base-content: var(--pie-text);
  --color-primary: var(--pie-primary);
  /* one line per slot the chrome reads */
}
```

No dependency, and it wins because pie-theme writes no `--color-*` of its own;
a `--color-*` name the host passes in `variables` is written inline and beats
it. The same shape serves any vocabulary, which is what a non-DaisyUI design
system needs regardless.

Gate that block on `[data-color-scheme]` rather than applying it always.
`<pie-theme>` stamps the attribute only for a scheme, so the gate hands the
chrome to PIE's palette while an accommodation is active and leaves it to the
host's own theme on every ordinary page.

![Token namespaces: pie-theme writes --pie-* tokens and data-color-scheme onto the theme target, and PIE content inherits them; host chrome reads the host's own --color-* palette, and while a scheme is set an alias block in the host stylesheet points those tokens at --pie-*](../img/theming-token-namespaces.excalidraw.svg)

## Themes versus color schemes

A theme is presentation. A color scheme is an accommodation under WCAG 2.2 AA —
1.4.1, 1.4.3 and 1.4.11 — and the distinction is enforced rather than
conventional.

- A built-in scheme replaces every color it participates in, rather than
  tinting an existing palette.
- Every built-in sets `--pie-fixed-hue-collapse: 100%`, folding a component's
  own fixed hues into the palette, because a two-color palette cannot carry
  meaning in hue. A custom scheme keeps such an encoding by declaring `0%`
  itself.
- Registration validates each token against the registry's
  required/optional/excluded participation, atomically per entry, and the
  resolver contrast-measures the result and warns.
- A requested id that is not registered resolves to `unavailable`: the base and
  provider result stands, the id is retained on the element, and a scheme
  registered later takes effect.

## Authored colors

A color written into authored markup — an inline `color`, `background-color`
or border color, `<font color>`, `bgcolor` — outranks any stylesheet that
applies a scheme, so it would survive the scheme: dark ink on a dark page, light
text on a gray header row. PIE elements mark each such element in their model
HTML, and `sanitizeItemMarkup` marks item and passage markup, both through
[`markAuthoredColors`](https://github.com/pie-framework/pie-elements-ng/blob/develop/packages/shared/utils/src/authored-colors.ts)
in `@pie-element/shared-utils`. The content stylesheet
overrides marked elements under `[data-color-scheme]`:

- Ink and border colors take the scheme's `--pie-text` and `--pie-border`.
- A near-white fill, usually the page the text was pasted from, becomes
  transparent.
- Any other fill — a header row, a highlight, a figure's shading — inverts. It
  takes the scheme's ink and its content takes the scheme's page, the pair the
  scheme certifies, so the fill still stands out and its text stays legible.

The default theme stamps no `data-color-scheme`, so authored colors render as
written. Gradients, background images and colors inside MathJax output carry no
marker and stay as authored.

Inside an inverted fill the neutral tokens swap: `--pie-text`, `--pie-black` and
`--pie-border` take the scheme's page, `--pie-background` and `--pie-white` its
ink, so a dropdown or blank an element renders in a shaded cell inverts with the
cell. Accent and feedback tokens keep their values — a deliberate trade: no
inverted palette to maintain per scheme, at the cost of those colors being
certified against the page rather than the fill. The ink and page are captured on
the element carrying `data-color-scheme`, which is where its tokens are
declared, so a scoped `<pie-theme>` inverts to its own scheme.

A host that installs its own copy of `components.css` under `@scope` gets the
overrides only when the `data-color-scheme` element sits inside the scope root,
because a scoped selector cannot match an ancestor of that root.

## The `color-scheme` collision

`color-scheme` is a CSS property with a fixed meaning of its own, unrelated to
PIE's color schemes: it tells the browser whether to paint its own widgets —
`select` text, scrollbars, checkboxes, native date pickers — light or dark.
Custom properties cannot reach those. Only this keyword can.

`<pie-theme>` sets it from a resolved scheme only, choosing the keyword by
whether black or white contrasts better against the resolved `--pie-background`.
A base theme leaves it alone, because a host stylesheet already declares the
polarity of its own themes, and restating that from PIE's palette would take the
decision away from every host that never asked for an accommodation. Clearing a
scheme restores the host's own declaration rather than deleting it. A background
the resolver cannot read as an opaque color also leaves it alone.

The consequence for a host: driving `theme="dark"` into the element does not
darken native controls. That stays the host's own `color-scheme` declaration to
make.
