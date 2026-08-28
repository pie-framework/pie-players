---
"@pie-players/pie-theme": patch
---

Publish the light Base Theme's `--pie-background` as opaque `#ffffff`.

It shipped as `rgba(255, 255, 255, 0)` from the first commit so PIE content revealed whatever surface the host painted behind it. The cost outgrew the capability: components across `pie-players`, `pie-lib` and `pie-elements` read the token as an opaque surface fill, which produced see-through dropdown menus and bleeding passage headings (PIE-940, PIE-853), and the token registry itself describes it as a page *or component surface* background that component hooks may fall back through. Two declared contrast relationships, the annotation underline and the annotation toolbar boundary, were permanently `contrast-unmeasurable` because their effective contrast depended on a backdrop the theme could not see; both are certified now, and `parseOpaqueColor` no longer special-cases the value.

`--pie-background` remains the page token. A host that wants its own surface to show through PIE content sets the token itself, which is the same override any other palette change uses. Hosts already setting it opaque, or painting an opaque surface behind PIE content, see no change — the value they resolve is unchanged in the dark base theme and in all ten colour schemes, which set it explicitly.

The change reaches the element repos with no edit there. `pie-lib` resolves `color.background()` to `var(--pie-background, …)` and every use of its own transparent default is that fallback rather than a literal, so roughly 150 call sites across `pie-lib` and `pie-elements` follow the theme, the inline-dropdown menu among them. `pie-lib`'s default still applies wherever PIE elements render with no `<pie-theme>` mounted.

Surfaces should still resolve through a surface role — `--pie-white`, `--pie-background-dark`, `--pie-dropdown-background`, `--pie-secondary-background` — rather than through the page token, since a host may point `--pie-background` anywhere. Component comments and docs that justified avoiding it by its transparency now state that role reason instead.
