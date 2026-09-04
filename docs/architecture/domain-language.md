# Domain Language Format

The root [`CONTEXT.md`](../../CONTEXT.md) names the concepts shared by PIE
Players and its runtime hosts, so ownership and behavior can be discussed
without renegotiating vocabulary each time. It carries domain language only —
implementation notes belong in an architecture note, and scope decisions in a
PRD or ADR.

A term enters `CONTEXT.md` when it has been resolved and is worth preserving.
Terms are not added to complete a set.

## Structure

Each domain area gets a `## <Area> Language` block and a matching
`## <Area> Relationships` block. `Example dialogue` and `Flagged ambiguities`
attach where the ambiguity actually lives — file-level while there is one area,
per-area once several compete for the same word.

```md
## <Area> Language

**Authored Content**:
The assessment or item markup and config supplied by an authoring system.
_Avoid_: HTML blob, item body

**Runtime Host**:
The consuming app that embeds PIE players and owns persistence, identity,
policy, and reporting.
_Avoid_: Client, wrapper

## <Area> Relationships

- A **Runtime Host** loads **Authored Content** into a player custom element.
- An **Attempt** records learner progress for a section, item, or assessment.
- **Tool Policy** decides which tools are available for a given assessment context.

## Example dialogue

> **Dev:** "Does PIE persist the **Attempt**?"
> **Domain expert:** "No — PIE produces runtime state and projections; the
> **Runtime Host** owns durable persistence."

## Flagged ambiguities

- "session" was used for both runtime subscription state and persisted attempt
  data — resolved: use **Runtime Session** for in-memory runtime state and
  **Attempt** for learner progress.
```

## Rules

- **Be opinionated.** Where several words exist for one concept, pick one and
  list the rest under `_Avoid_`.
- **Keep definitions tight.** One sentence. Define what the term IS.
- **Flag conflicts explicitly.** An ambiguous term goes in `Flagged ambiguities`
  with its resolution, so the next reader sees that the collision was decided
  rather than missed.
- **Show relationships.** Bold the term names and express cardinality where it
  is knowable.
- **Only terms specific to this domain.** Timeouts, error types and utility
  patterns stay out however heavily the code uses them.
- **Write the example dialogue.** A dev-to-domain-expert exchange demonstrates
  the boundary between two adjacent terms faster than a third definition does.

## Single file

PIE Players keeps one `CONTEXT.md` at the repo root. Splitting it into
per-package files under a root `CONTEXT-MAP.md` is the path if the vocabulary
ever stops being shared, which requires the areas to have genuinely separate
languages rather than separate headings.
