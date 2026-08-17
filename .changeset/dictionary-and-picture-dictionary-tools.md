---
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
---

Add dictionary and picture dictionary tools, and make the shell's focus trap
shadow-aware so a hosted tool's own controls are reachable by keyboard.

`pie-tool-dictionary` and `pie-tool-picture-dictionary` are floating panels opened from
the toolbar, each with a term field and a results area. Neither ships an endpoint: the
corpus behind a dictionary is licensed per programme, so a host supplies one through
`endpoint` for the built-in POST shaping, or assigns the element's `lookup` property to
use its own client. With neither, the panel says no service is configured rather than
offering a field that fails silently.

Neither declares a universal support id. A dictionary is a granted accommodation, and on
a vocabulary item it is construct-relevant, so handing it to every learner by default
would change what the item measures.

Both accept a `term` from whatever selection affordance a host offers, and neither
depends on one. A sighted keyboard-only learner cannot originate a text selection in
non-editable content — Chromium does not extend one with Shift+Arrow there without caret
browsing, an OS toggle absent on mobile — so a selection-only dictionary is unreachable
for them. The panel's field is the keyboard route, which is why it exists.

That route did not work until the focus trap was fixed. `createFocusTrap` collected
focusables with `querySelectorAll`, which stops at a shadow boundary; every tool in this
repo renders into `shadow: "open"`, so the trap saw only the shell's own chrome. Tab
cycled those nine controls and the hosted tool's content was unreachable by keyboard
entirely — for the calculator, graph, periodic table and theme panels as much as for
these two. Collection now descends into open shadow roots, and skips `tabindex="-1"`,
which belongs to programmatic focus rather than the tab order.

A lookup distinguishes "no entry for this word" from "the service did not answer",
because collapsing them tells a learner their word is not real when the network is down.
A term longer than four words is refused without a request. Picture URLs that are not
`https:`, protocol-relative, or same-origin are dropped rather than rendered, and a
picture's caption becomes its `alt` — the picture is the definition, so it is never
decorative.

Covered by unit tests over the lookup and focus-collection logic, and by
`packages/section-player/tests/section-dictionary-tools.spec.ts`, which drives the tool
from the keyboard alone in a browser.
