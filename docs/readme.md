# Documentation Index

This folder contains the maintained documentation set for `pie-players`. The
focus is on current public APIs, runtime boundaries, integration patterns, and
contract decisions. Completed implementation plans are excluded unless they are
accepted PRDs or ADRs retained as current contract and decision references; see
[`prds/README.md`](./prds/README.md#retention-and-cleanup).

## Start Here

- Section demo onboarding (canonical local flow):
  1. `bun install`
  2. `bun run dev:section -- --rebuild` (first run)
  3. `bun run dev:section` (daily run)
- Packaging boundary contract (Node-safe vs browser-only packages):
  - [`setup/library-packaging-strategy.md`](./setup/library-packaging-strategy.md)
- [`item-player/overview.md`](./item-player/overview.md) - Core item-player architecture and standalone usage
- [`section-player/client-architecture-tutorial.md`](./section-player/client-architecture-tutorial.md) - Section-player and assessment-toolkit integration guide
- [`../packages/section-player/README.md`](../packages/section-player/README.md) - Current public section-player API and host-facing patterns
- [`../packages/item-player/README.md`](../packages/item-player/README.md) - Current item-player API reference

## Architecture

- [`architecture/architecture.md`](./architecture/architecture.md) - System-level architecture across item player, section player, and toolkit
- [`architecture/developer_patterns.md`](./architecture/developer_patterns.md) - Project implementation patterns and boundary guidance
- [`architecture/composition-context.md`](./architecture/composition-context.md) - How container-owned facts (heading depth, arbitration, scope) reach the descendants that need them
- [`adr/`](./adr/) - Decision records for choices that span PRDs: sequencing, rejected alternatives, trade-offs
- [`architecture/domain-language.md`](./architecture/domain-language.md) - Format and admission rules for the root `CONTEXT.md` domain glossary
- [`architecture/framework-completing-work.md`](./architecture/framework-completing-work.md) - The scope discriminant: what PIE builds regardless of consumer, what it refuses, and the seam obligations that make refusing defensible
- [`architecture/shared-contracts-p0.md`](./architecture/shared-contracts-p0.md) - Pre-PRD architecture proposal for shared event, session, scoring, media, evidence, and adapter contracts
- [`architecture/internationalization.md`](./architecture/internationalization.md) - Interface locale, content language, and in-item language alternates as three separate concerns
- [`architecture/timed-media-section.md`](./architecture/timed-media-section.md) - Pre-PRD architecture proposal for video-linked/timed-media sections
- [`architecture/types-and-utilities-contract.md`](./architecture/types-and-utilities-contract.md) - Shared contracts and utility expectations

## Item Player

- [`item-player/overview.md`](./item-player/overview.md) - Architecture and runtime behavior
- [`item-player/loading-strategies.md`](./item-player/loading-strategies.md) - IIFE, ESM, and preloaded loading strategies
- [`item-player/scoring-and-rubrics.md`](./item-player/scoring-and-rubrics.md) - Item scoring, multi-element aggregation, EBSR, and rubric/manual-scoring behavior
- [`prds/formative-delivery-contract.md`](./prds/formative-delivery-contract.md) - PRD for check-answer delivery: Try state, feedback reveal as a per-item `env` projection, and section mastery over the client-side scoring path
- [`item-player/migration-from-pie-player-components.md`](./item-player/migration-from-pie-player-components.md) - Migration from `@pie-framework/pie-player-components`
- [`preloaded-player/readme.md`](./preloaded-player/readme.md) - Preloaded bundle workflow

## Section Player

- [`section-player/client-architecture-tutorial.md`](./section-player/client-architecture-tutorial.md) - Production-oriented integration and controller patterns
- [`../packages/section-player/ARCHITECTURE.md`](../packages/section-player/ARCHITECTURE.md) - Package architecture and layout authoring boundaries

## Assessment Player

- [`assessment-player/client-architecture-tutorial.md`](./assessment-player/client-architecture-tutorial.md) - Production-oriented integration guide and host boundary philosophy

## Integrations

- [`integrations/lti.md`](./integrations/lti.md) - Launching players from an LTI tool host after protocol validation
- [`integrations/consumer-api-dependencies.md`](./integrations/consumer-api-dependencies.md) - Which surfaces downstream hosts actually depend on, and which break silently
- [`integrations/consumer-api-dependencies-maintenance.md`](./integrations/consumer-api-dependencies-maintenance.md) - Harness-neutral procedure for refreshing that pad

## Theming

- [`theming/how-theming-works.md`](./theming/how-theming-works.md) - How `<pie-theme>` resolves tokens and writes them, why a host stylesheet cannot override them, and how a host carries an accommodation into its own chrome
- [`../packages/theme/README.md`](../packages/theme/README.md) - Element attributes, runtime API, registered custom schemes, and the token registry

## Accessibility And TTS

- [`accessibility/accessibility-catalogs-quick-start.md`](./accessibility/accessibility-catalogs-quick-start.md) - Quick start for accessibility catalogs
- [`accessibility/accessibility-catalogs-integration-guide.md`](./accessibility/accessibility-catalogs-integration-guide.md) - Runtime integration patterns for catalogs
- [`accessibility/accessibility-catalogs-tts-integration.md`](./accessibility/accessibility-catalogs-tts-integration.md) - How catalogs connect to TTS flows
- [`accessibility/tts-architecture.md`](./accessibility/tts-architecture.md) - TTS system architecture and provider model
- [`accessibility/tts-authoring-guide.md`](./accessibility/tts-authoring-guide.md) - Authoring guidance for spoken alternatives
- [`accessibility/aws-polly-setup-guide.md`](./accessibility/aws-polly-setup-guide.md) - AWS Polly setup
- [`accessibility/aws-ssml-tags-reference.md`](./accessibility/aws-ssml-tags-reference.md) - SSML authoring reference
- [`prds/sign-language-asl-support.md`](./prds/sign-language-asl-support.md) - PRD for sign-language (ASL) delivery; section-player renders `sign-language` catalogs in a per-item media region, gated on the `signLanguage` PNP support
- [`prds/audio-accommodations.md`](./prds/audio-accommodations.md) - PRD for the audio transcript accommodation and autoplay control; retires a pre-toolkit CSS-class gate by transforming Star content into catalog cards in the `pie-api-aws` import pipeline

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
- [`tools-and-accomodations/safe-custom-tool-config.md`](./tools-and-accomodations/safe-custom-tool-config.md) - Safe host-side custom tool configuration patterns
- [`tools-and-accomodations/dictionary-languages-and-services.md`](./tools-and-accomodations/dictionary-languages-and-services.md) - Which service answers a lookup, and offering more than one dictionary language

## Setup And Publishing

- [`development/demo-workspace-resolution.md`](./development/demo-workspace-resolution.md) - How demo apps resolve `@pie-players/*` (`dist/` and Vite aliases)
- [`development/calculator-external-test-corpora.md`](./development/calculator-external-test-corpora.md) - Calculator test data that CI does not ship: the on-demand GSM8K corpus, and the open-source suites mined for cases
- [`setup/environment-setup.md`](./setup/environment-setup.md) - Local environment setup
- [`setup/demo_system.md`](./setup/demo_system.md) - Canonical root demo commands and run orchestration
- [`setup/publishing.md`](./setup/publishing.md) - Publishing workflow
- [`setup/publishable_packages.md`](./setup/publishable_packages.md) - Publishable package inventory
- [`setup/library-packaging-strategy.md`](./setup/library-packaging-strategy.md) - Packaging strategy for bundler reliability and runtime boundary contracts
- [`setup/cdn_usage.md`](./setup/cdn_usage.md) - CDN and loader usage
- [`setup/npm_token_setup.md`](./setup/npm_token_setup.md) - npm token setup
