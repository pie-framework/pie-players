# WCAG Reference Library

This folder contains the project's WCAG 2.2 AA reference library for implementation guidance and evaluation work.

The goal is to keep one place where humans and AI agents can quickly answer:

- What does the standard actually require?
- Which official W3C/WAI source should I use?
- Which patterns matter most in this repo?
- How should I evaluate components and demo routes without overstating conformance?

## Source Policy

This library uses three source classes:

- **Normative standard** - the standard itself
- **Official supporting guidance** - W3C/WAI guidance that explains or operationalizes the standard
- **Project guidance** - repo-specific interpretation and workflow for `pie-players`

If a statement in this library is not backed by an official W3C/WAI URL, it must be treated as project guidance rather than a WCAG fact.

## Start Here

- [`official-sources.md`](./official-sources.md) - Verified W3C/WAI sources and when to use each one
- [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md) - High-signal WCAG 2.2 A/AA criteria for this repo
- [`evaluation-method.md`](./evaluation-method.md) - Accepted evaluation workflow for this project
- [`patterns-and-widgets.md`](./patterns-and-widgets.md) - Official pattern guidance for dialogs, toolbars, splitters, landmarks, names, and keyboard behavior
- [`project-surface-map.md`](./project-surface-map.md) - Where those requirements land in `assessment-toolkit`, `section-player`, and the tools
- [`coverage-matrix.md`](./coverage-matrix.md) - Current automation/manual coverage status by review tier and surface
- [`review-2026-03-20.md`](./review-2026-03-20.md) - Latest project-wide review execution record and findings
- [`agent-reference.md`](./agent-reference.md) - Compact lookup guide for AI agents
- [`reference-index.yaml`](./reference-index.yaml) - Machine-readable index of key sources, criteria, patterns, and repo tags
- [`deferred-issues.md`](./deferred-issues.md) - Confirmed issues and follow-up work that were intentionally deferred from the current fix pass

## How To Use This Library

### If you are implementing a feature

1. Start with [`patterns-and-widgets.md`](./patterns-and-widgets.md).
2. Check the relevant criteria in [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md).
3. Follow the official links from those docs before making accessibility claims.

### If you are reviewing or auditing

1. Start with [`evaluation-method.md`](./evaluation-method.md).
2. Use [`project-surface-map.md`](./project-surface-map.md) to identify likely risk areas.
3. Use the baseline doc to record findings by WCAG criterion.

### If you are an AI agent

1. Start with [`agent-reference.md`](./agent-reference.md) and [`reference-index.yaml`](./reference-index.yaml).
2. Prefer linking to official W3C/WAI sources over paraphrasing from memory.
3. Do not claim compliance based on automated checks alone.

## Relationship To Existing Docs

This library does not replace the existing accessibility and tool-specific docs under `docs/`.

Use those docs for implementation architecture and product-specific behavior:

- [`../accessibility/accessibility-catalogs-quick-start.md`](../accessibility/accessibility-catalogs-quick-start.md)
- [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md)
- [`../accessibility/accessibility-catalogs-tts-integration.md`](../accessibility/accessibility-catalogs-tts-integration.md)
- [`../accessibility/tts-architecture.md`](../accessibility/tts-architecture.md)
- [`../accessibility/tts-authoring-guide.md`](../accessibility/tts-authoring-guide.md)
- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)

Use `docs/evals/` for executable local checks and supporting evidence, not as the WCAG source of truth:

- [`../evals/readme.md`](../evals/readme.md)
