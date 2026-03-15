# Documentation Index

This folder contains the active documentation set for `pie-players`. The focus is on current public APIs, runtime boundaries, and integration patterns rather than design history or migration notes.

## Start Here

- [`item-player/overview.md`](./item-player/overview.md) - Core item-player architecture and standalone usage
- [`section-player/client-architecture-tutorial.md`](./section-player/client-architecture-tutorial.md) - Section-player and assessment-toolkit integration guide
- [`../packages/section-player/README.md`](../packages/section-player/README.md) - Current public section-player API and host-facing patterns
- [`../packages/item-player/README.md`](../packages/item-player/README.md) - Current item-player API reference

## Architecture

- [`architecture/architecture.md`](./architecture/architecture.md) - System-level architecture across item player, section player, and toolkit
- [`architecture/developer_patterns.md`](./architecture/developer_patterns.md) - Project implementation patterns and boundary guidance
- [`architecture/types-and-utilities-contract.md`](./architecture/types-and-utilities-contract.md) - Shared contracts and utility expectations

## Item Player

- [`item-player/overview.md`](./item-player/overview.md) - Architecture and runtime behavior
- [`item-player/loading-strategies.md`](./item-player/loading-strategies.md) - IIFE, ESM, and preloaded loading strategies
- [`item-player/migration-from-pie-player-components.md`](./item-player/migration-from-pie-player-components.md) - Upgrade guide from `@pie-framework/pie-player-components`
- [`preloaded-player/readme.md`](./preloaded-player/readme.md) - Preloaded bundle workflow

## Section Player

- [`section-player/client-architecture-tutorial.md`](./section-player/client-architecture-tutorial.md) - Production-oriented integration and controller patterns
- [`../packages/section-player/ARCHITECTURE.md`](../packages/section-player/ARCHITECTURE.md) - Package architecture and layout authoring boundaries

## Assessment Player

- [`assessment-player/client-architecture-tutorial.md`](./assessment-player/client-architecture-tutorial.md) - Production-oriented integration guide and host boundary philosophy
- [`assessment-player/architecture.md`](./assessment-player/architecture.md) - Target architecture for assessment-player layering, contracts, and extensibility
- [`assessment-player/implementation-plan.md`](./assessment-player/implementation-plan.md) - Implementation and post-build conformance checklist

## Accessibility And TTS

- [`accessibility/accessibility-catalogs-quick-start.md`](./accessibility/accessibility-catalogs-quick-start.md) - Quick start for accessibility catalogs
- [`accessibility/accessibility-catalogs-integration-guide.md`](./accessibility/accessibility-catalogs-integration-guide.md) - Runtime integration patterns for catalogs
- [`accessibility/accessibility-catalogs-tts-integration.md`](./accessibility/accessibility-catalogs-tts-integration.md) - How catalogs connect to TTS flows
- [`accessibility/tts-architecture.md`](./accessibility/tts-architecture.md) - TTS system architecture and provider model
- [`accessibility/tts-authoring-guide.md`](./accessibility/tts-authoring-guide.md) - Authoring guidance for spoken alternatives
- [`accessibility/aws-polly-setup-guide.md`](./accessibility/aws-polly-setup-guide.md) - AWS Polly setup
- [`accessibility/aws-ssml-tags-reference.md`](./accessibility/aws-ssml-tags-reference.md) - SSML authoring reference

## WCAG Reference

- [`wcag/readme.md`](./wcag/readme.md) - WCAG reference library entry point
- [`wcag/official-sources.md`](./wcag/official-sources.md) - Verified W3C/WAI source list
- [`wcag/wcag-2.2-aa-baseline.md`](./wcag/wcag-2.2-aa-baseline.md) - High-signal criteria for this repo
- [`wcag/evaluation-method.md`](./wcag/evaluation-method.md) - Review workflow and evidence expectations
- [`wcag/patterns-and-widgets.md`](./wcag/patterns-and-widgets.md) - Widget and interaction guidance
- [`wcag/project-surface-map.md`](./wcag/project-surface-map.md) - Surface-to-criteria map across the project
- [`wcag/agent-reference.md`](./wcag/agent-reference.md) - Compact AI-agent lookup

## Tools And Accommodations

- [`tools-and-accomodations/architecture.md`](./tools-and-accomodations/architecture.md) - Overall tools and accommodations architecture
- [`tools-and-accomodations/tool_provider_system.md`](./tools-and-accomodations/tool_provider_system.md) - Tool provider configuration and integration patterns
- [`tools-and-accomodations/tool_host_contract.md`](./tools-and-accomodations/tool_host_contract.md) - Host and tool runtime contract

## Setup And Publishing

- [`setup/environment-setup.md`](./setup/environment-setup.md) - Local environment setup
- [`setup/publishing.md`](./setup/publishing.md) - Publishing workflow
- [`setup/publishable_packages.md`](./setup/publishable_packages.md) - Publishable package inventory
- [`setup/cdn_usage.md`](./setup/cdn_usage.md) - CDN and loader usage
- [`setup/npm_token_setup.md`](./setup/npm_token_setup.md) - npm token setup
- [`setup/demo_system.md`](./setup/demo_system.md) - Demo app and harness overview

## Supporting Specs

- [`evals/readme.md`](./evals/readme.md) - Eval/spec documentation for local behavior checks
