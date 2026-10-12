# Documentation

The documentation is grouped by reader. Evaluating PIE Players starts at
[Overview](#overview); embedding the players in a product starts at
[Getting started](#getting-started) and continues through the integration
sections; writing a tool, a provider or an element starts at
[Extending](#extending); working on this repository starts at
[Contributing](#contributing). [Design records](#design-records) hold the
decisions behind the current contracts, including implemented ones, under the
[retention rule](./prds/README.md#retention-and-cleanup).

## Overview

- [Architecture](./architecture/architecture.md): system context, building blocks, packages, sessions, the security model and the integration patterns
- [The case for a new player project](./why-a-new-project.md): what PIE Players changes from `@pie-framework/pie-player-components`, and which layer a host adopts
- [Domain language](../CONTEXT.md): the shared vocabulary for items, sections, sessions, tools and accommodations
- [Security](./security/readme.md): where answer keys travel, hosted mode, the sanitizers' guarantees and the obligations a host keeps
- [WCAG 2.2 AA baseline](./wcag/wcag-2.2-aa-baseline.md) and [deferred issues](./wcag/deferred-issues.md): the conformance target and the confirmed gaps

## Getting started

- [An item](./getting-started.md): render one item, save the response, score it
- [A section with tools](./getting-started-section.md): a passage and items in a layout, with the packaged tools, a learner profile and a saved section session

## Installing and loading

- [Packages and entry points](./install/packages.md): every package by job, which entry points run in Node.js, raw in a browser or through a bundler, and the TypeScript settings
- [Versioning and stability](./install/versioning.md): lockstep versions, pinning, dist-tags and the public surface
- [Loading from a CDN](./install/cdn.md): the browser builds, pinning and Content Security Policy for a page without a build step
- [Loading strategies](./item-player/loading-strategies.md): where element code comes from under `iife`, `esm` and `preloaded`
- [Math rendering](./item-player/math-rendering.md): MathJax under each strategy, its assets, and one MathJax version per page
- [Preloaded player](./preloaded-player/readme.md): the generated package that bundles a fixed element set with the item player

## Item player

- [Item player README](../packages/item-player/README.md): attributes, properties, methods, events and exports
- [Item player architecture](./item-player/overview.md): internal structure, modes and the session lifecycle
- [Scoring and rubrics](./item-player/scoring-and-rubrics.md): browser and server scoring, multi-element items, EBSR, rubrics and manual scoring
- [Backend support](./item-player/backend-support.md): the `backend` property, which loads config and sessions, saves sessions and scores through a server
- [Migrating from the legacy PIE players](./item-player/migration-from-pie-player-components.md): `pie-player-components` mapped property by property and event by event
- [Print player README](../packages/print-player/README.md): worksheets and answer keys from the elements' print views

## Section player

- [Section player README](../packages/section-player/README.md): the layout elements, inputs, host methods, events and readiness
- [Integration guide](./section-player/integration-guide.md): the coordinator, the section controller, tool placement and persistence in a production integration
- [Custom layouts](./section-player/custom-layouts.md): arranging items and passages with `<pie-section-player-kernel-host>` and the panes
- [Formative delivery](./section-player/formative-delivery.md): check-answer delivery, tries, feedback reveal and section mastery
- [Timed media](../packages/section-player/README.md#timed-media): section-level media that reveals items at cue points

## Multi-section assessments

Production assessment players are host-built from the section player and the
toolkit; the assessment player is a reference assembly
([product scope](./architecture/architecture.md#product-scope)).

- [Building a multi-section player](./assessment-player/integration-guide.md): the assessment-session helpers, persistence and navigation, with the reference player as the worked example
- [Assessment player README](../packages/assessment-player/README.md): the reference element's inputs, events and hooks

## Tools and accommodations

- [Tools and accommodations](./tools-and-accomodations/architecture.md): placement, scopes, the policy ladder and learner profiles
- [Assessment toolkit README](../packages/assessment-toolkit/README.md): `ToolkitCoordinator`, its services, `<pie-assessment-toolkit>` and `<pie-item-scope>`
- [Configuring tools](./tools-and-accomodations/tool_provider_system.md): placement, provider configuration, host resolvers and the section player boundary
- [PNP configuration](../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md): learner profiles and how they grant and withdraw tools
- [Default tool loaders](../packages/default-tool-loaders/README.md): the packaged tool set, calculator providers and the tools a program grants to everyone
- [Safe custom tool configuration](./tools-and-accomodations/safe-custom-tool-config.md): validating and sanitizing a custom tool's configuration
- [Framework-owned error handling](./tools-and-accomodations/framework-owned-error-handling.md): how configuration and initialization failures reach the host
- [Dictionary languages and services](./tools-and-accomodations/dictionary-languages-and-services.md): which service answers a lookup, and offering more than one language
- [Non-embedded dictation](./tools-and-accomodations/non-embedded-dictation.md): platform dictation into PIE response surfaces
- [Sign language](../packages/tool-sign-language/README.md): the sign-language video accommodation

## Accessibility and read-aloud

- [Accessibility](./accessibility/README.md): which accessibility document answers which need
- [Accessibility catalogs quick start](./accessibility/accessibility-catalogs-quick-start.md), [integration guide](./accessibility/accessibility-catalogs-integration-guide.md) and [catalogs with TTS](./accessibility/accessibility-catalogs-tts-integration.md): authored spoken text, audio, sign-language video and braille
- [TTS deep dive](./accessibility/tts-deep-dive.md): provider selection, authored and generated speech, playback and highlighting
- [TTS architecture](./accessibility/tts-architecture.md): the TTS packages, where each runs, and how the providers compare
- [TTS authoring guide](./accessibility/tts-authoring-guide.md): writing spoken alternatives, for item authors
- [TTS packages](../packages/tts/README.md): the provider contract, the [server-backed client](../packages/tts-client-server/README.md), the server providers ([core](../packages/tts-server-core/README.md), [Polly](../packages/tts-server-polly/README.md), [Google](../packages/tts-server-google/README.md), [SC adapter](../packages/tts-server-sc/README.md)) and [inline read-aloud](../packages/tool-tts-inline/README.md)
- [AWS Polly setup](./accessibility/aws-polly-setup-guide.md): credentials and voices for the Polly server provider

## Theming, language and operations

- [How theming works](./theming/how-theming-works.md): how `<pie-theme>` resolves tokens and writes them, and how a host carries an accommodation into its own chrome
- [Theme README](../packages/theme/README.md): attributes, runtime API, custom schemes and the token registry
- [Interface strings](../packages/players-shared/src/i18n/README.md): setting the interface locale and supplying message catalogs
- [Instrumentation providers](./architecture/instrumentation-providers.md): provider resolution and the events PIE sends
- [LTI](./integrations/lti.md): launching players from an LTI tool after protocol validation

## Extending

- [Tool registry](../packages/assessment-toolkit/docs/TOOL_REGISTRY.md): registering a tool, its host surfaces and its content dependencies
- [Tool host contract](./tools-and-accomodations/tool_host_contract.md): the runtime guarantees between a tool and its host
- [TTS provider contracts](../packages/tts/README.md) and [calculator provider contracts](../packages/calculator/README.md): the interfaces a custom provider implements; the [calculator adapters](../packages/default-tool-loaders/src/calculator-providers/README.md) are the packaged implementations
- [Shared player runtime](../packages/players-shared/README.md): the element loaders, formative delivery, timed media and media validation the players share
- [Context protocol](../packages/pie-context/README.md), [composition context](./architecture/composition-context.md) and [ADR 0003](./adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md): how elements read settings from their container
- [Patterns and widgets](./wcag/patterns-and-widgets.md): accessible interaction patterns for tool and element UI
- [Element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md): the shape of a PIE element package, in pie-elements-ng

## Contributing

- [Demo system](./setup/demo_system.md): prerequisites, the demo apps and their commands, and how they resolve `@pie-players/*`
- [Environment setup](./setup/environment-setup.md): the demo apps' environment variables
- [Developer patterns](./architecture/developer_patterns.md): state, events, theming, DOM use and test stability in this codebase
- [Section player architecture](../packages/section-player/ARCHITECTURE.md): the section player's internals
- [Releasing](./setup/publishing.md), [publishable packages](./setup/publishable_packages.md) and [library packaging](./setup/library-packaging-strategy.md): the release workflow, the package inventory and the packaging rules
- [Preloaded player builds](../configs/preloaded-player/README.md): set configs, versions, local builds and the workflow that publishes them
- [Calculator test corpora](./development/calculator-external-test-corpora.md): calculator test data CI does not ship
- [Domain language rules](./architecture/domain-language.md): how terms enter `CONTEXT.md`
- WCAG library: [readme](./wcag/readme.md), [official sources](./wcag/official-sources.md), [evaluation method](./wcag/evaluation-method.md), [project surface map](./wcag/project-surface-map.md), [agent reference](./wcag/agent-reference.md) and the [theming WCAG matrix](./architecture/pie-727-theming-wcag-matrix.md)
- [Consumer dependency pad](./integrations/consumer-api-dependencies.md) and its [maintenance procedure](./integrations/consumer-api-dependencies-maintenance.md): which surfaces downstream hosts depend on
- [Theme token inventory](./architecture/pie-727-theme-token-inventory.md): the token admission rule and the inventory behind the registry

## Design records

- [Architecture decision records](./adr/README.md): choices that span PRDs
- [PRDs](./prds/README.md): every PRD with its status, including the [shared contracts](./prds/shared-contracts/README.md)
- [Product-completing work](./architecture/framework-completing-work.md): what lives in PIE and what a host builds, and the evidence required before scheduling it
- [Internationalization](./architecture/internationalization.md) and [interface-locale adoption](./architecture/i18n-interface-locale-adoption.md): interface locale, content language and in-item alternates
- [Instrumentation providers implementation plan](./architecture/instrumentation-providers-implementation-plan.md)
- [Open-source calculator provider](./prds/open-source-calculator-provider.md) and its [implementation specification](./architecture/open-source-calculator-provider-implementation.md): the Cortex provider
- [Scoring design notes](./architecture/scoring-design-notes.md): why scoring is split between browser and server
- [Shared contracts proposal](./architecture/shared-contracts-p0.md): event, session, scoring, media and evidence contracts
- [Timed-media section](./architecture/timed-media-section.md): the design behind the [timed-media section contract](./prds/timed-media-section-contract.md)
- [Theming contract](./prds/pie-727-broad-theming-contract.md)
