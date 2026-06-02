# Accessibility Docs

Use this folder as a set of focused references rather than parallel copies of
the same setup flow.

| Need | Read |
| ---- | ---- |
| Catalog resolver basics and direct API examples | [Accessibility Catalogs Quick Start](./accessibility-catalogs-quick-start.md) |
| Section-player and `ToolkitCoordinator` integration | [Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md) |
| Catalog-aware TTS behavior and troubleshooting | [Accessibility Catalogs TTS Integration](./accessibility-catalogs-tts-integration.md) |
| Runtime call flow from toolbar click to speech | [TTS Deep Dive](./tts-deep-dive.md) |
| Package/provider architecture | [TTS Architecture](./tts-architecture.md) |
| Authoring SSML in item content and catalogs | [TTS Authoring Guide](./tts-authoring-guide.md) |
| AWS Polly setup | [AWS Polly Setup Guide](./aws-polly-setup-guide.md) |
| AWS/Polly SSML tag syntax | [AWS SSML Tags Reference](./aws-ssml-tags-reference.md) |

Start with the integration guide for host wiring, then use the deep dive for
runtime behavior and the authoring guide for content-level SSML decisions.

## Current Integration Model

- PIE elements live in `../pie-elements-ng` and provide item capabilities.
- Item configs carry authored content through `config.markup`,
  `config.elements`, and `config.models`.
- Catalog references belong in model or passage HTML via `data-catalog-idref`.
- Section-player integrations pass `ToolkitCoordinator` through
  `runtime.coordinator`; do not assign toolkit services directly to the player
  element.
- Embedded `<speak>` extraction is a preprocessing/import step. Runtime
  registration consumes `config.extractedCatalogs` when they are already present.

## Related

- [WCAG reference library](../wcag/readme.md)
- [WCAG 2.2 AA baseline](../wcag/wcag-2.2-aa-baseline.md)
- [Project accessibility surface map](../wcag/project-surface-map.md)
- [AWS Polly IAM policy](./aws-polly-iam-policy.json)

