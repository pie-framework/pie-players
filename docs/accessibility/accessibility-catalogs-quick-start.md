# Accessibility Catalogs Quick Start

This quick start takes one item from an authored spoken card to audible
read-aloud in the section player. It is for host integrators trying catalogs for
the first time; the [Accessibility Catalogs](./accessibility-catalogs-integration-guide.md)
guide defines the model in full.

An accessibility catalog attaches alternative representations to one piece of
content, one card per type and language. The types are `spoken` (a TTS script or
a recording), `sign-language`, `transcript`, `braille`, `tactile`,
`simplified-language`, `audio-description` and `extended-description`. PIE
renders `spoken`, `transcript` and, once a host registers its tool,
`sign-language`; a host reads the others through the resolver
([Supported Catalog Types](./accessibility-catalogs-integration-guide.md#supported-catalog-types)).

## 1. Author a Spoken Card

The item carries the catalog, and the prompt references it with
`data-catalog-idref`:

```javascript
const item = {
  id: 'item-1',
  accessibilityCatalogs: [
    {
      identifier: 'prompt-001',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>What is two plus two?</speak>',
        },
      ],
    },
  ],
  config: {
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@x.y.z',
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="prompt-001">What is 2 + 2?</div>',
        choiceMode: 'radio',
        choices: [
          { value: 'a', label: '4' },
          { value: 'b', label: '5' },
        ],
      },
    ],
  },
};
```

## 2. Wire the Section Player

The coordinator places the read-aloud tool on each item, and the section player
registers the item's catalogs when the item mounts:

```javascript
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'quick-start',
  toolRegistry: createPackagedToolRegistry(),
  accessibility: { language: 'en-US' },
  tools: {
    placement: { item: ['textToSpeech'] },
    providers: { textToSpeech: { backend: 'browser' } },
  },
});
coordinator.updateAssessment({
  id: 'quick-start',
  personalNeedsProfile: { supports: ['textToSpeech'] },
});

const sectionPlayer = document.querySelector('pie-section-player-splitpane');
sectionPlayer.runtime = {
  assessmentId: 'quick-start',
  coordinator,
  tools: coordinator.config.tools,
};
sectionPlayer.sectionId = 'section-1';
sectionPlayer.attemptId = 'attempt-1';
sectionPlayer.section = {
  identifier: 'section-1',
  assessmentItemRefs: [{ identifier: 'item-1', item }],
};
```

## 3. Press Read-Aloud

The item toolbar shows the read-aloud button. Pressing it speaks the prompt's
`spoken` card in place of the prompt's visible text, then the choices' visible
text. The browser provider speaks the card's text and drops its markup; a server
provider voices the SSML
([Minimal Server-Backed TTS Config](../../packages/assessment-toolkit/README.md#minimal-server-backed-tts-config)).

## Direct Resolver Lookups

Tests and content tooling read catalogs without a player through
`AccessibilityCatalogResolver`:

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

const resolver = new AccessibilityCatalogResolver(item.accessibilityCatalogs, 'en-US');

const spoken = resolver.getAlternative('prompt-001', { type: 'spoken', language: 'en-US' });
// spoken?.content is the SSML; null when no card matches
```

## Further Reading

The [Accessibility Catalogs](./accessibility-catalogs-integration-guide.md) guide
covers what this quick start leaves out:

- [Card content](./accessibility-catalogs-integration-guide.md#card-content-string-or-payload):
  a card carries `content` or `payload`; signing video and recorded audio use
  the structured form.
- [Script and recording](./accessibility-catalogs-integration-guide.md#two-cards-of-one-type-script-and-recording):
  one node can carry a reading script and a recording of it in the same
  language.
- [Suppressing read-aloud](./accessibility-catalogs-integration-guide.md#suppressing-read-aloud):
  `data-tts-suppress` withholds content from read-aloud for items where reading
  is the construct, overriding an authored card and the learner's entitlement.
- [Catalog scope](./accessibility-catalogs-integration-guide.md#catalog-scope)
  and [language fallback](./accessibility-catalogs-integration-guide.md#language-fallback):
  assessment-level catalogs shared across items, and one card per language.
- [Supported types](./accessibility-catalogs-integration-guide.md#supported-catalog-types):
  an unknown type is stored and logged; QTI's `ext:` prefix marks a deliberate
  vendor extension.

Signed alternates need the host to register
[`@pie-players/pie-tool-sign-language`](../../packages/tool-sign-language/README.md);
[Sign Language (ASL) Support](../prds/sign-language-asl-support.md) covers the
signing card and its gating. The [TTS authoring guide](./tts-authoring-guide.md)
covers SSML for `spoken` cards. For accessibility review, the
[WCAG reference library](../wcag/readme.md) lists the
[criteria most likely to affect alternative content and TTS](../wcag/wcag-2.2-aa-baseline.md).
