# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "Assessment delivery is composed from assessment-player plus section-player runtimes, not a separate copied runtime stack."
- **Integration patterns between contracts.** "Tool policy decisions flow through the assessment toolkit contract rather than direct tool-package imports."
- **Technology choices that carry lock-in.** Custom-element packaging strategy, Svelte runes patterns, persisted session shape, or release tooling. Not every library — just choices that are expensive to unwind.
- **Boundary and scope decisions.** "PIE owns runtime projections; hosts own durable persistence, identity, policy, reporting, and standards certification unless an adapter PRD says otherwise." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We keep versioned `pie-*--version-*` tags in authored markup because custom elements cannot be redefined." Anything where a reasonable reader might otherwise simplify it away.
- **Constraints not visible in the code.** "Playwright must run outside the Cursor sandbox." "All publishable packages release in lockstep as patch bumps."
- **Rejected alternatives when the rejection is non-obvious.** If you considered normalizing model IDs, importing package source from a consumer, or splitting package versions independently and rejected it, record why.
