# Accessibility Runtime Patterns

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)
- [Timed media section architecture](../../architecture/timed-media-section.md)

## Problem

Timed media, branching, simulations, overlays, toolbars, TTS, and child item orchestration all create runtime accessibility responsibilities that span elements, item-player, section-player variants, assessment-toolkit services, and host policy.

The repo has strong accessibility expectations, but future cross-cutting workflows need shared runtime patterns so each implementation does not invent focus handoff, cue announcements, media/TTS coordination, and accommodation behavior differently.

## Goals

- Define cross-player accessibility patterns for dynamic assessment workflows.
- Cover focus handoff, keyboard paths, screen-reader announcements, overlays, media controls, captions/transcripts, and accommodation overrides.
- Keep WCAG 2.2 AA as the baseline and call out assessment-specific requirements.
- Reuse existing assessment-toolkit and accessibility catalog infrastructure where possible.
- Provide acceptance criteria that future timed-media, branching, process, and evidence PRDs can consume.

## Non-Goals

- No redesign of every existing component or tool.
- No replacement for element-level accessibility responsibilities in `pie-elements-ng`.
- No generic accessibility service that hides player-specific behavior behind untyped callbacks.
- No host policy for accommodation eligibility, privacy, or proctoring.
- No claim that automated checks alone prove accessibility quality.

## Package And Export Ownership

- Owning package: proposed `@pie-players/pie-assessment-toolkit` for runtime coordination patterns and any shared services.
- Public export path: open question; this may remain a docs contract until implementation PRDs introduce concrete service APIs.
- Consuming packages or apps: `section-player`, `assessment-player`, tools/TTS packages, timed-media section variants, future branching/simulation variants, and demo apps.
- Runtime environment: browser and custom element.

If the accepted PRD adds no public TypeScript export, it should explicitly remain a documentation contract consumed by implementation PRDs.

## Contract Shape

This PRD is primarily a behavioral contract. Future implementation PRDs should consume these pattern requirements:

- predictable focus target when new child content appears;
- keyboard path for all media controls, overlays, tools, cue dialogs, branch decisions, and child item regions;
- screen-reader announcements for cue activation, branch/path changes, pause/resume restrictions, completion, errors, and externally graded states;
- caption and transcript access that remains available when overlays or child questions are active;
- overlay layout rules that avoid obscuring captions, transcripts, media controls, or essential item content;
- TTS/media handoff rules so speech tools and media audio do not compete unexpectedly;
- seek/navigation restriction rules with accommodation override behavior;
- high-contrast, zoom, and reduced-motion expectations;
- non-video alternatives where video itself is not an accessible source.

Documentation sketch only:

```ts
interface RuntimeAccessibilityHandoff {
  reason: "cue-activated" | "branch-changed" | "step-entered" | "overlay-opened" | "error";
  source: InteractionSourceRef;
  focusTarget: "media" | "item" | "tool" | "transcript" | "summary" | "host-defined";
  announcement: string;
}
```

This sketch is not a final API recommendation. The accepted PRD should decide whether a shared type is useful or whether these stay as behavioral acceptance criteria.

## Compatibility

This PRD can affect runtime behavior in future implementations, but it does not itself change current custom elements, player APIs, or session data.

Future implementation PRDs must not depend on generic class names or host/global utility classes for custom-element hooks. Light-DOM custom elements must expose stable `pie-*` or `data-pie-*` hooks.

Accessibility events or projections must observe existing runtime surfaces and preserve PIE tag/id identity when they include element source references.

## Data Ownership And Host Responsibilities

PIE owns:

- runtime accessibility patterns for player and toolkit behavior;
- component-level acceptance criteria for player-owned UI;
- coordination rules for player tools, TTS, media playback, and child item focus;
- tests and manual review expectations for player-owned behavior.

Hosts own:

- accommodation eligibility and policy;
- identity, proctoring, scheduling, and reporting policy;
- content authoring quality, including accurate captions, transcripts, labels, and alternatives;
- host page landmarks outside PIE custom elements;
- assistive technology support claims outside PIE-controlled UI.

## Serialization And Versioning

This PRD does not define persisted or wire-facing data unless a future implementation PRD ratifies accessibility event or handoff types.

If such types are introduced, they must include versioning, validation ownership, unknown-version behavior, and fixtures through the interaction event projection contract.

## Accessibility

This entire PRD is accessibility-scoped. Acceptance criteria for consuming PRDs should include:

- keyboard-only completion paths;
- screen-reader walkthroughs for dynamic state changes;
- captions/transcripts available during media and cue-linked child questions;
- focus restoration after overlays, tools, and errors close;
- high-contrast and 200% zoom layouts;
- reduced-motion behavior for animated timeline/branch transitions;
- manual evidence where automated checks cannot prove quality.

## Standards Or Adapter Impact

This PRD may produce adapter-friendly accessibility event projections, but it does not claim conformance with QTI, LTI, xAPI, Caliper, WCAG certification, or any assistive technology matrix.

Accessibility metadata for media and evidence belongs in their respective shared-contract PRDs. Runtime behavior belongs here and in consuming implementation PRDs.

## Test Plan

Required test coverage for consuming implementations:

- keyboard navigation tests for media controls, tools, overlays, and child item regions;
- focus handoff tests for cue activation, branch changes, errors, and completion;
- screen-reader announcement review, with manual evidence when automated tools are insufficient;
- axe or equivalent automated checks for player-owned UI;
- high-contrast, zoom, reduced-motion, and touch-target checks;
- TTS/media coordination tests where speech and media audio can overlap.

Commands:

```sh
bun run typecheck
bun run test
```

For Playwright-backed accessibility tests, run outside the sandbox.

For custom-element or export-boundary changes, also run:

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

## Rollout And Release Notes

- Changeset required: no for docs-only acceptance; yes if public exports or runtime services are added.
- Migration notes: consuming PRDs should state whether they change focus behavior or keyboard paths.
- Documentation updates: link from timed-media, branching, evidence, tools/TTS, and accessibility docs when accepted.
- Release risk: high for runtime changes, because focus and announcement regressions are user-visible and hard to catch with automation alone.

## Open Questions

- Which patterns belong in toolkit services versus section-player variants?
- Should there be a shared handoff type, or should this remain a behavioral PRD consumed by implementation tests?
- What manual assistive technology review matrix is required for timed-media MVP?
- How should accommodation overrides interact with seek locks, forced pauses, and branch restrictions?
