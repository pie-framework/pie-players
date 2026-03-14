# Documentation Index

This folder contains active technical docs. Historical one-off plans, completion notes, and fix logs have been removed to reduce drift and duplication.

Current status: core runtime custom elements now run with shadow DOM enabled (`shadow: "open"`), while item player internals remain intentionally out of scope.

## Architecture

- [`architecture/architecture.md`](./architecture/architecture.md) - System-level architecture
- [`architecture/developer_patterns.md`](./architecture/developer_patterns.md) - Project code style and implementation patterns

## Item Player

- [`item-player/overview.md`](./item-player/overview.md) - Architecture and standalone usage
- [`item-player/loading-strategies.md`](./item-player/loading-strategies.md) - IIFE, ESM, and preloaded loading strategies
- [`item-player/migration-from-pie-player-components.md`](./item-player/migration-from-pie-player-components.md) - Upgrade guide from `@pie-framework/pie-player-components`

## Section Player

- [`section-player/section-structure-design.md`](./section-player/section-structure-design.md)
- [`section-player/qti3-paired-passages-design.md`](./section-player/qti3-paired-passages-design.md)
- [`section-player/qti-3.0-feature-support.md`](./section-player/qti-3.0-feature-support.md)
- [`section-player/client-architecture-tutorial.md`](./section-player/client-architecture-tutorial.md) - Production-focused client integration and SectionController patterns

## Accessibility / TTS

- [`accessibility/accessibility-catalogs-quick-start.md`](./accessibility/accessibility-catalogs-quick-start.md)
- [`accessibility/accessibility-catalogs-integration-guide.md`](./accessibility/accessibility-catalogs-integration-guide.md)
- [`accessibility/accessibility-catalogs-tts-integration.md`](./accessibility/accessibility-catalogs-tts-integration.md)
- [`accessibility/tts-architecture.md`](./accessibility/tts-architecture.md)
- [`accessibility/tts-authoring-guide.md`](./accessibility/tts-authoring-guide.md)
- [`accessibility/tts-synchronization-best-practices.md`](./accessibility/tts-synchronization-best-practices.md)
- [`accessibility/aws-polly-setup-guide.md`](./accessibility/aws-polly-setup-guide.md)
- [`accessibility/aws-ssml-tags-reference.md`](./accessibility/aws-ssml-tags-reference.md)

## WCAG / Accessibility Review

- [`wcag/readme.md`](./wcag/readme.md) - Entry point for the WCAG reference library
- [`wcag/official-sources.md`](./wcag/official-sources.md) - Verified W3C/WAI sources and when to use them
- [`wcag/wcag-2.2-aa-baseline.md`](./wcag/wcag-2.2-aa-baseline.md) - High-signal criteria for this repo
- [`wcag/evaluation-method.md`](./wcag/evaluation-method.md) - Repo evaluation workflow grounded in WAI guidance
- [`wcag/patterns-and-widgets.md`](./wcag/patterns-and-widgets.md) - Widget and interaction guidance for implementation work
- [`wcag/project-surface-map.md`](./wcag/project-surface-map.md) - Surface-to-criteria map across the project

## Tools & Accommodations

- [`tools-and-accomodations/tool_provider_system.md`](./tools-and-accomodations/tool_provider_system.md) - Tool registry/provider system
- [`tools-and-accomodations/tool_host_contract.md`](./tools-and-accomodations/tool_host_contract.md) - Host/tool runtime integration contract
- [`tools-and-accomodations/architecture.md`](./tools-and-accomodations/architecture.md)
- [`tools-and-accomodations/tool-registry-architecture.md`](./tools-and-accomodations/tool-registry-architecture.md)
- [`tools-and-accomodations/toolbar-verification-checklist.md`](./tools-and-accomodations/toolbar-verification-checklist.md)

## Integration

- [`integration/section_player_integration_guide.md`](./integration/section_player_integration_guide.md) - Section player CE API, events, and integration
- [`integration/assessment-toolkit-section-player-getting-started.md`](./integration/assessment-toolkit-section-player-getting-started.md) - Getting started with assessment toolkit + section player

## Setup / Publishing

- [`setup/environment-setup.md`](./setup/environment-setup.md)
- [`setup/publishing.md`](./setup/publishing.md)
- [`setup/publishable_packages.md`](./setup/publishable_packages.md)
- [`setup/cdn_usage.md`](./setup/cdn_usage.md)
- [`setup/npm_token_setup.md`](./setup/npm_token_setup.md)
- [`setup/demo_system.md`](./setup/demo_system.md)
