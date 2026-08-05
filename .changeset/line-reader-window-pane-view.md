---
"@pie-players/pie-tool-line-reader": patch
---

Replace the line reader highlight/obscure modes with a single window view: a fully transparent pane that leaves underlying page content visible, surrounded on all four edges by an obscuring frame (black at 80% opacity by default, themeable via `--pie-tool-line-reader-frame-color` and `--pie-tool-line-reader-frame-opacity`), with 4px rounded corners and a subtle drop shadow. Drag and `+`/`-` now resize the reading window, `[`/`]` adjust frame opacity, and the color cycling (`C`) and mode toggle (`M`) shortcuts are removed. Also fixes the resize handle hit test, which matched a class name the markup never rendered.

Add frame controls: a close button that hides the tool through the coordinator (also reachable with `Escape`), a reading-window resize handle, and a frame resize handle that adjusts the frame band height and the overall width. All three are real focusable buttons that meet the 24x24 minimum target size, and each drag has an arrow-key equivalent on the focused handle.

Keep the window readable in every PIE colour scheme: the frame stays a dark scrim rather than following `--pie-text` (an ink-coloured scrim cannot mask its own scheme's text, and a light one glares in a dark scheme), and an ink hairline plus an ink-derived shadow supply the window boundary that a dark scrim on a dark page cannot show on its own. New `--pie-tool-line-reader-outline-color` hook.

Draw the frame as one element's border box instead of four abutting boxes. Four translucent boxes each antialias their shared edge, so whenever layout landed off whole pixels (page zoom, fractional font scale) the junctions rendered at partial coverage and showed as light seams between the side edges and the top/bottom bands.

Fix the keyboard move shortcuts going dead after a click: pressing the frame calls `preventDefault` to start a drag, which also suppressed the press's default focus, so the tool never became the focus target and arrow keys went to the page instead. Both the frame and the resize handles now claim focus explicitly (with `preventScroll`).
