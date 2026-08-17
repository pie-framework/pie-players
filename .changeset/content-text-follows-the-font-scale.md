---
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
---

Scale the learner-facing text that sits outside the scaled content hosts.

`font-sizes.css` scales `pie-item-shell`, `pie-passage-shell` and
`pie-item-player`, and text inside them that inherits its size follows. Five
declarations did not, and four of them are text a learner reads: the item and
passage card titles, the formative status line carrying tries-remaining and
correctness, the item player's build warning, and the tabbed layout's tab labels.
At the 175% preset the item body grew and those stayed put.

The cards are the reason inheritance was never going to cover it — a card *wraps*
the shell that gets scaled, so nothing above these rules carries the scaled size.
Each now reads `--pie-font-scale` directly, root-relative rather than as an `em`
factor, because the scaled hosts nest inside the cards and an `em` factor would
compound a requested 1.25 into 1.56.

The tab label was a hard `12px`, the last pixel type size in the content path. It
ignored the accommodation and the reader's own browser font size together, so tab
labels stayed 12px beside body text at 175%. It is `0.75rem` now — the same 12px
at a default root, diverging only for a host that moves the root size, which is
what using rem is for.

Nothing changes when no host opts in: `var(--pie-font-scale, 1)` resolves to 1 and
every one of these renders exactly as before.

Tool and debug chrome is deliberately excluded. An accommodation applies to what
the learner reads, and a calculator keypad growing with the passage is a layout
problem rather than an accommodation.
