# Architecture Decision Records

One file per decision that is hard to reverse, surprising without its context, or
a genuine trade-off between named alternatives. Everything else belongs in a PRD
(what to build), an architecture note (how a subsystem works), or a commit
message (why this change).

A decision earns a record when a reader who finds the code later would otherwise
ask "why not the obvious thing?" and have nowhere to look.

Records are append-only. A superseded record keeps its number, gains a
`Superseded by` line, and is not edited into agreement with the newer one — the
sequence is the value.

Numbering is sequential from `0001`. The filename is
`NNNN-<kebab-case-decision>.md`.

## Records

- [`0001-formative-delivery-before-timed-media.md`](./0001-formative-delivery-before-timed-media.md) — formative delivery ships before timed media, so cue policy composes with Try state instead of inventing a weaker gate
