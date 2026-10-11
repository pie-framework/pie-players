# WCAG Reference Library

This folder is the project's WCAG 2.2 AA reference library, for contributors
and AI agents implementing or reviewing pie-players UI. It records what the
standard requires, which official W3C/WAI source answers which question, which
patterns matter in this repo, and how to evaluate components and demo routes
without overstating conformance.

## Source Policy

This library uses three source classes:

- **Normative standard** - the standard itself
- **Official supporting guidance** - W3C/WAI guidance that explains or operationalizes the standard
- **Project guidance** - repo-specific interpretation and workflow for `pie-players`

A statement in this library that no official W3C/WAI URL backs is project guidance.

## Library Contents

- [`official-sources.md`](./official-sources.md) - The W3C/WAI sources and which question each answers
- [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md) - The WCAG 2.2 A and AA criteria that matter most here, plus labeled AAA additions
- [`evaluation-method.md`](./evaluation-method.md) - Accepted evaluation workflow for this project
- [`patterns-and-widgets.md`](./patterns-and-widgets.md) - Official pattern guidance for dialogs, toolbars, splitters, landmarks, names and keyboard behavior, and the pattern each PIE widget implements
- [`project-surface-map.md`](./project-surface-map.md) - Where those requirements land in each package and feature area
- [`agent-reference.md`](./agent-reference.md) - Compact lookup guide for AI agents
- [`reference-index.yaml`](./reference-index.yaml) - Machine-readable index of key sources, criteria, patterns, and repo tags
- [`deferred-issues.md`](./deferred-issues.md) - Confirmed active issues and evidence gaps that still need follow-up

## Reading Paths

### Implementing a Feature

1. Start with [`patterns-and-widgets.md`](./patterns-and-widgets.md).
2. Check the relevant criteria in [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md).
3. Follow the official links from those docs before making accessibility claims.

### Reviewing or Auditing

1. Start with [`evaluation-method.md`](./evaluation-method.md).
2. Use [`project-surface-map.md`](./project-surface-map.md) to identify likely risk areas.
3. Use the baseline doc to record findings by WCAG criterion.

### AI Agents

1. Start with [`agent-reference.md`](./agent-reference.md) and [`reference-index.yaml`](./reference-index.yaml).
2. Prefer linking to official W3C/WAI sources over paraphrasing from memory.
3. Do not claim conformance based on automated checks alone.

## Related Docs

The accessibility and tool docs under `docs/` own implementation architecture and
product behavior:

- [`../accessibility/README.md`](../accessibility/README.md)
- [`../accessibility/accessibility-catalogs-quick-start.md`](../accessibility/accessibility-catalogs-quick-start.md)
- [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md)
- [`../accessibility/accessibility-catalogs-tts-integration.md`](../accessibility/accessibility-catalogs-tts-integration.md)
- [`../accessibility/tts-deep-dive.md`](../accessibility/tts-deep-dive.md)
- [`../accessibility/tts-architecture.md`](../accessibility/tts-architecture.md)
- [`../accessibility/tts-authoring-guide.md`](../accessibility/tts-authoring-guide.md)
- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
- [`../architecture/pie-727-theming-wcag-matrix.md`](../architecture/pie-727-theming-wcag-matrix.md) - WCAG 2.2 AA coverage for every themed surface

Playwright tests and manual assistive-technology review are evidence for a
conformance judgment; neither establishes conformance alone.
