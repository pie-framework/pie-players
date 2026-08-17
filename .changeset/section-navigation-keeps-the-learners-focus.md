---
"@pie-players/pie-assessment-player": patch
---

Keep keyboard focus and announce the new position when the learner changes section.

`render()` rebuilds the player's whole subtree on a route change, so the control the
learner had just activated was destroyed and the browser dropped focus to `<body>`.
Their next Tab restarted at the top of the document — past the host's chrome and the
accommodations tool bar — and a screen reader announced nothing at all, because the
visible "Section 2 of 3" indicator is not a live region and the section landmark had
no name.

Focus now returns to the control it was on. A control the change disables cannot hold
focus — pressing Back into the first section is exactly when that happens — so the
intent degrades to the other navigation button and then to the section region, which
carries `tabindex="-1"` and a `role="region"` named for the current position. No
branch can end with focus on `<body>`.

Only focus this element already owned is repaired. A host that drives navigation
programmatically may have the learner's focus in its own chrome or another form, and
pulling focus in from outside would be worse than the bug being fixed; those cases
get the announcement without the focus move.

The announcement comes from a polite `role="status"` region created once and kept out
of the render swap, since a live region only announces changes that happen while it is
already in the document. It is empty on load — announcing the starting position would
be noise.

`packages/section-player` needs no equivalent: both shipped layouts render every item
in the section at once, so item selection moves a marker rather than swapping a view,
and focus was verified to survive it.

Covered by four tests in `assessment-player-smoke.spec.ts`. The existing keyboard test
there asserted focus only *before* pressing Enter, and explicitly refocused first,
which is why it never caught this.
