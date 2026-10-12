# Accessibility Docs

These docs cover accessibility catalogs, read-aloud (TTS), signing and audio
accommodations in pie-players. This page routes each reader to the doc that owns
their question.

## Host Integrators

Wiring a player so learners get read-aloud and alternates:

| Need | Read |
| ---- | ---- |
| First catalog, wired end to end | [Accessibility Catalogs Quick Start](./accessibility-catalogs-quick-start.md) |
| Catalog model, scope, language fallback and section-player wiring | [Accessibility Catalogs](./accessibility-catalogs-integration-guide.md) |
| A card that is not spoken, and other TTS troubleshooting | [Accessibility Catalogs TTS Integration](./accessibility-catalogs-tts-integration.md) |
| TTS provider configuration (browser or server) | [Assessment toolkit: Minimal Server-Backed TTS Config](../../packages/assessment-toolkit/README.md#minimal-server-backed-tts-config) |
| Personal needs profile (PNP) and tool policy | [PNP Configuration](../../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md) |
| Sign-language (ASL) video | [`@pie-players/pie-tool-sign-language`](../../packages/tool-sign-language/README.md); design in the [Sign Language (ASL) Support PRD](../prds/sign-language-asl-support.md) |
| Audio transcripts and autoplay control | [Audio Accommodations PRD](../prds/audio-accommodations.md) |
| Dictation through the operating system or assistive technology | [Non-Embedded Dictation](../tools-and-accomodations/non-embedded-dictation.md) |
| AWS Polly credentials | [AWS Polly Setup Guide](./aws-polly-setup-guide.md) |

The section player takes the `ToolkitCoordinator` on `runtime.coordinator` and
registers each item's catalogs as it mounts
([Section Player Integration](./accessibility-catalogs-integration-guide.md#section-player-integration)).
Extracting embedded `<speak>` is a preprocessing step the host runs
([SSML Extraction](./accessibility-catalogs-integration-guide.md#ssml-extraction-from-pie-content)).

## Item Authors

| Need | Read |
| ---- | ---- |
| SSML in item content and `spoken` cards, by provider | [TTS Authoring Guide](./tts-authoring-guide.md) |
| Where `data-catalog-idref` goes, and card types | [Catalog References in Content](./accessibility-catalogs-integration-guide.md#catalog-references-in-content) |

PIE elements live in [pie-elements-ng](https://github.com/pie-framework/pie-elements-ng).

## TTS Provider Authors

| Need | Read |
| ---- | ---- |
| The provider contract | [`@pie-players/pie-tts`](../../packages/tts/README.md) |
| Browser client for a server route | [`@pie-players/tts-client-server`](../../packages/tts-client-server/README.md) |
| Server provider base, cache and errors | [`@pie-players/tts-server-core`](../../packages/tts-server-core/README.md) |
| Shipped server providers | [Polly](../../packages/tts-server-polly/README.md), [Google](../../packages/tts-server-google/README.md), [SC adapter](../../packages/tts-server-sc/README.md) |
| Inline read-aloud tool | [`@pie-players/pie-tool-tts-inline`](../../packages/tool-tts-inline/README.md) |

## Contributors

| Need | Read |
| ---- | ---- |
| Runtime call flow from toolbar click to highlighted word | [TTS Deep Dive](./tts-deep-dive.md) |
| Package and provider architecture | [TTS Architecture](./tts-architecture.md) |
| WCAG 2.2 AA review library | [WCAG reference library](../wcag/readme.md), [baseline](../wcag/wcag-2.2-aa-baseline.md), [surface map](../wcag/project-surface-map.md) |
| Least-privilege Polly policy | [AWS Polly IAM policy](./aws-polly-iam-policy.json) |
