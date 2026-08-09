---
"@pie-players/pie-tool-line-reader": patch
---

Replace the line reader highlight/obscure modes with a single window view: a fully transparent pane that leaves underlying page content visible, surrounded on all four edges by an obscuring frame (black at 80% opacity by default, themeable via `--pie-tool-line-reader-frame-color`), with 4px rounded corners and a subtle drop shadow. Drag and `+`/`-` now resize the reading window, and the color cycling (`C`) and mode toggle (`M`) shortcuts are removed. Also fixes the resize handle hit test, which matched a class name the markup never rendered.

Make the frame's masking a host setting rather than a student one. How much surrounding context a test taker can still see trades against reading focus, which is a decision a programme makes for its whole population, so `--pie-tool-line-reader-frame-opacity` is now the only way to change it: the keyboard-only `[`/`]` adjustment — undiscoverable to anyone not reading the tool's aria-label, and with no pointer equivalent — is gone, and the component no longer writes the opacity inline, so a host declaration wins without `!important`.

Promote the frame's masking properties to registered host contract. `--pie-tool-line-reader-frame-opacity`, `--pie-tool-line-reader-frame-color`, and `--pie-tool-line-reader-control-color` are now `component-public` entries in `packages/theme/src/token-registry.json` instead of package-private internals, since a deployment is expected to configure them and needs the compatibility guarantee that carries. The control colour is registered as the fill's companion: the glyphs sit on the frame and default to white for a dark scrim, so a light fill has to set it too and keep 3:1 against the fill. `--pie-tool-line-reader-outline-color` stays package-private.

Add frame controls: a close button that hides the tool through the coordinator (also reachable with `Escape`), a reading-window resize handle, and a frame resize handle that adjusts the frame band height and the overall width. All three are real focusable buttons that meet the 24x24 minimum target size, and each drag has an arrow-key equivalent on the focused handle.

Keep the window readable in every PIE colour scheme: the frame stays a dark scrim rather than following `--pie-text` (an ink-coloured scrim cannot mask its own scheme's text, and a light one glares in a dark scheme), and an ink hairline plus an ink-derived shadow supply the window boundary that a dark scrim on a dark page cannot show on its own. New `--pie-tool-line-reader-outline-color` hook.

Draw the frame as one element's border box instead of four abutting boxes. Four translucent boxes each antialias their shared edge, so whenever layout landed off whole pixels (page zoom, fractional font scale) the junctions rendered at partial coverage and showed as light seams between the side edges and the top/bottom bands.

Fix the keyboard move shortcuts going dead after a click: pressing the frame calls `preventDefault` to start a drag, which also suppressed the press's default focus, so the tool never became the focus target and arrow keys went to the page instead. Both the frame and the resize handles now claim focus explicitly (with `preventScroll`).
