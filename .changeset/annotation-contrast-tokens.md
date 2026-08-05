---
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-theme": patch
---

Give the annotation toolbar outline and the annotation underline their own contrast-checked tokens, so neither depends on a token that cannot satisfy WCAG 2.2 SC 1.4.11.

## Toolbar outline

The floating toolbar's stroke is the only boundary between it and the content
behind it, so it has to clear 3:1 against both. It was derived from
`--pie-border`, which cannot carry that: the DaisyUI bridge maps that token to
`--color-base-300`, a surface tint rather than a boundary colour — `#eeeeee` at
1.16:1 on the light base, `#15191e` at 1.12:1 on the dark one.

The outline now reads a new `--pie-tool-annotation-toolbar-border`, defaulting to
a measured `light-dark(#5c5c5c, #949494)` pair — dark grey on light surfaces,
light grey on dark ones.

Both arms are measured against the surfaces the toolbar is actually drawn on
rather than against pure white and pure black. Real theme bases are off-white and
off-black, and a grey chosen at the edge of passing against an extreme drops under
threshold on everything else: across DaisyUI's 21 light and 14 dark themes, every
light surface needs a grey no lighter than `#828282` and every dark surface one no
darker than `#878787`. Those ranges are disjoint, so one value cannot serve both
and `light-dark()` is the mechanism. `#5c5c5c` holds 5.22:1 as its worst case on
the light surfaces and `#949494` holds 3.56:1 on the dark ones.

`@pie-players/pie-theme` then hands the last word back to palettes that do choose
a boundary colour deliberately:

- `[data-theme="dark"]` and `pie-theme[theme="dark"]` pin the dark arm,
  `#949494`. `light-dark()` keys off the declared `color-scheme`, which pie-theme
  does not set, so without this a pie-theme dark page would take the light arm.
- All ten `data-color-scheme` accessibility palettes map the outline to their own
  `--pie-border`, which each picks for maximum contrast against its own
  background. This rule sits after the dark rule deliberately — the two have
  equal specificity and a scheme can be active on a dark page. The schemes are
  named rather than matched with a bare `[data-color-scheme]`, so an unknown id
  cannot pull in the `:root` values (`--pie-border` is `#9a9a9a`, which misses 3:1
  on white).

- Each palette also fixes which underline value applies. The underline default is
  selected by `[data-theme]`, which reports what the *page* declares rather than
  which scheme is active — so a host declaring itself light while running a dark
  scheme pinned the light value over a dark background.

  The colours themselves were never the problem, so they are unchanged: `#4221d5`
  and `#9c89ec` clear 3:1 between them on nine of the ten backgrounds, and each
  scheme is simply given the arm that suits its own. Both states get that one
  value, because within a scheme the background is fixed regardless of what
  `data-theme` reports. Worst case is 4.33:1 (`light-gray-on-dark-gray`).

  `yellow-on-navy` is the sole exception: its `#33508a` background is mid-tone and
  neither arm reaches 3:1 (1.10 light, 2.71 dark), so there alone the underline
  defers to the palette's own `--pie-primary` (`#ffff99`, 7.54:1) — the same
  deference the outline makes to `--pie-border`.

  All three tokens are declared in both delivery routes: per scheme in
  `color-schemes.ts`, so `<pie-theme scheme="…">` applies them as inline styles
  with no CSS import, and in `color-schemes.css` for hosts that set
  `data-color-scheme` themselves.

`--pie-tool-annotation-toolbar-border` is registered as a `component-public`
token. Hosts overriding it must keep 3:1 against both the toolbar surface and the
content behind it.

## Annotation underline

`::highlight(annotation-underline)` took its colour from `--pie-primary`, a theme
accent chosen against one background and therefore illegible on the other. It now
reads `--pie-annotation-underline` (default `#4221d5`) and
`--pie-annotation-underline-dark` (default `#9c89ec`). One value cannot serve
both: `#4221d5` is 2.41:1 on black and `#9c89ec` is 2.85:1 on white. Each state
gets its own token so overriding one never silently moves the other, and so
either can beat a host-set `--pie-primary` — a `var()` fallback can never
override a value the host actually set.

The `prefers-color-scheme` media query only reports the OS preference, which is a
guess at what the page is showing. Three mutually exclusive `[data-theme]` rules
now override it: explicit `light` and `dark` take the matching default, and any
other value — including DaisyUI theme ids — follows that theme's accent, falling
back to the light default. All three carry attribute selectors, so they outrank
the bare rules including the one inside the media query, whatever the source
order.

## Upgrade note

Two host overrides stop having their old effect, which is the point of the change
rather than a side effect of it:

- Setting `--pie-border` no longer recolours the annotation toolbar outline; set
  `--pie-tool-annotation-toolbar-border`.
- Setting `--pie-primary` no longer recolours the annotation underline; set
  `--pie-annotation-underline` and `--pie-annotation-underline-dark`. A host that
  declares `data-theme` with neither token set still follows its accent.
