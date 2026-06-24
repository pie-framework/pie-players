# CONTEXT.md Format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A concise description of the term}
_Avoid_: Purchase, transaction

**Authored Content**:
The assessment or item markup and config supplied by an authoring system.
_Avoid_: HTML blob, item body

**Runtime Host**:
The consuming app that embeds PIE players and owns persistence, identity, policy, and reporting.
_Avoid_: Client, wrapper

## Relationships

- A **Runtime Host** loads **Authored Content** into a player custom element.
- An **Attempt** records learner progress for a section, item, or assessment.
- **Tool Policy** decides which tools are available for a given assessment context.

## Example dialogue

> **Dev:** "Does PIE persist the **Attempt**?"
> **Domain expert:** "No — PIE produces runtime state and projections; the **Runtime Host** owns durable persistence."

## Flagged ambiguities

- "session" was used for both runtime subscription state and persisted attempt data — resolved: use **Runtime Session** for in-memory runtime state and **Attempt** for learner progress.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously, call it out in "Flagged ambiguities" with a clear resolution.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.
- **Write an example dialogue.** A conversation between a dev and a domain expert that demonstrates how the terms interact naturally and clarifies boundaries between related concepts.

## Single vs multi-context repos

**Single context (most repos):** One `CONTEXT.md` at the repo root.

**Multiple contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, where they live, and how they relate to each other:

```md
# Context Map

## Contexts

- [Assessment Delivery](./packages/assessment-player/CONTEXT.md) — coordinates sections, navigation, submission, and rollup state
- [Section Runtime](./packages/section-player/CONTEXT.md) — delivers multi-item sections and section-level tools
- [Assessment Toolkit](./packages/assessment-toolkit/CONTEXT.md) — owns shared runtime services, tool policy, and host-facing contracts

## Relationships

- **Assessment Delivery → Section Runtime**: Assessment delivery delegates each section to the section runtime.
- **Section Runtime → Assessment Toolkit**: Section runtime consumes shared services and policy decisions.
- **Assessment Toolkit → Runtime Host**: Toolkit contracts expose projections and events; the host owns persistence and reporting.
```

The skill infers which structure applies:

- If `CONTEXT-MAP.md` exists, read it to find contexts
- If only a root `CONTEXT.md` exists, single context
- If neither exists, create a root `CONTEXT.md` lazily when the first term is resolved

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.
