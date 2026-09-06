---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-tts-inline": patch
---

Keep tabs, read-aloud buttons, calculator controls, and scroll hints usable in
narrow delivery hosts. Stop estimating browser zoom from outer/inner window
widths: a normal 320px host could render the plain read-aloud trigger at 3.66px.
Controls now follow browser scaling; plain and NDS triggers keep matching sizes.
Item and passage toolbars wrap when enlarged text needs more space. Section
toolbar buttons retain their size and scroll fully into view on keyboard focus.
Calculator headers wrap while the tool content scrolls independently. Reading
panels fit beside or below their trigger, remain reachable in a short magnified
viewport, and paint above the question pane's scroll hint.
Assessment demos scroll their diagnostic chrome when magnified instead of
squeezing the nested player to zero height.

Remove the `@pie-players/pie-players-shared/ui/zoom-compensation` export
and its internal Svelte wrapper. Retain `--pie-section-player-tab-zoom-comp` in
the registry as deprecated; it no longer affects layout. Hosts A and R use the
affected delivery surfaces in the consumer inventory. Their controls change
size under constrained layouts and magnification; recorded imports name neither
retired surface, with a fresh checkout check still pending.
