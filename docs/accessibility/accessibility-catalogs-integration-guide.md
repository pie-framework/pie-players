# QTI-Inspired Accessibility Catalogs - Integration Guide

<!-- markdownlint-disable MD012 MD031 MD032 MD040 MD060 -->

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration with PIE](#integration-with-pie)
4. [TTSService Integration](#ttsservice-integration)
5. [Section Player Integration](#section-player-integration)
6. [PIE Element Authoring](#pie-element-authoring)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

---

## Overview

QTI 3.0 Accessibility Catalogs provide standardized alternative representations of content for assistive technologies. This guide explains how catalogs integrate with the PIE assessment toolkit at both **assessment-level** and **item-level**.

### Supported Catalog Types

| Type | Description | Use Case | Rendered by PIE |
|------|-------------|----------|-----------------|
| `spoken` | A TTS script (SSML), or a recording of one as a media payload | Screen readers, TTS | Yes — `TTSService` |
| `sign-language` | Signed video, as a structured media payload | Deaf/hard-of-hearing | Yes — section-player item media region, gated on the `signLanguage` PNP support |
| `transcript` | Text transcript of an audio stimulus | Deaf/hard-of-hearing | No — resolvable, host-consumed |
| `braille` | Braille-ready transcriptions | Blind users with refreshable displays | No — resolvable, host-consumed |
| `tactile` | Descriptions for tactile graphics | Tactile diagram readers | No — resolvable, host-consumed |
| `simplified-language` | Plain language alternatives | Cognitive accessibility, ELL | No — resolvable, host-consumed |
| `audio-description` | Extended audio descriptions | Visual content for blind users | No — resolvable, host-consumed |
| `extended-description` | Detailed text descriptions | Complex diagrams/images | No — resolvable, host-consumed |

**Other types are allowed, and unknown ones are reported.** QTI's support
vocabulary is extensible, so `CatalogType` stays open and a token PIE does not
name is still stored and still resolvable by a host that asks for it. Use QTI's
`ext:` prefix for a vendor extension (`ext:custom-pronunciation`) and it passes
without comment. Anything else — including `"spokn"` — is registered but logged,
on both the card side ("stored but no reader asks for that type") and the lookup
side ("cannot match any card"), once per distinct token. The openness is
deliberate; the previous silence was not, since a mistyped card was a valid
`CatalogType` that simply never appeared. `isKnownCatalogType` is exported if a
host wants to check before registering.

### Card Content: String Or Payload

A card carries **either** `content` **or** `payload`, never both, and `catalog`
is the only thing that says which to read — it is QTI's `qti-card@support`, and
QTI gives `qti-card` one content slot:

```typescript
interface CatalogCard {
  catalog: string;    // 'spoken', 'sign-language', 'braille', …
  language?: string;  // the card entry's xml:lang
  content?: string;   // the string form: SSML for `spoken`, text for `braille`
  payload?: CatalogCardPayload;  // the structured form, read according to `catalog`
}
```

`content` is optional because some types have no string form at all. A signing
card needs a second source, a MIME type, a poster and a time range, so it carries
`payload` and no `content`; nothing is mirrored between the two, so there is
never a second copy of the same URL to fall out of sync, and the payload carries
no type tag of its own that could disagree with `catalog`.

Consequences for consumers: select by `catalog` type, then validate the form you
expect. `TTSService` treats a resolved card with no string form as "no catalog"
and falls through to generated speech rather than speaking an empty string, and a
`sign-language` card carrying a bare URL in `content` is reported and ignored
rather than half-rendered.

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PIE Section Player (Primary)               │
│  ┌───────────────────────────────────────────────────┐ │
│  │     AccessibilityCatalogResolver                  │ │
│  │                                                   │ │
│  │  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │ Assessment-     │  │ Item-Level      │       │ │
│  │  │ Level Catalogs  │  │ Catalogs        │       │ │
│  │  │ (Coordinator)   │  │ (Shell-scoped)  │       │ │
│  │  └─────────────────┘  └─────────────────┘       │ │
│  │                                                   │ │
│  │  Resolver: spoken and other catalog cards         │ │
│  └───────────────────────────────────────────────────┘ │
│                         │                               │
│                         ▼                               │
│                  ┌─────────────────────────────────────┐
│                  │  TTSService (spoken catalogs)       │
│                  │  Host-owned consumers for other     │
│                  │  catalog types when needed          │
│                  └─────────────────────────────────────┘
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Coordinator Initialization**: Create `ToolkitCoordinator` with shared
   assessment catalogs in `accessibility.catalogs`.
2. **Section Load**: Pass the coordinator through `sectionPlayer.runtime`.
3. **Item/Passage Render**: Runtime shells register catalogs already present on
   passages, items, models, and `config.extractedCatalogs`.
4. **Content Request**: `TTSService` resolves `data-catalog-idref` references
   for spoken catalogs before falling back to generated speech or visible text.
   Section-player's item card resolves `sign-language` cards for the same item in
   parallel, through the same resolver.
5. **Navigation/Unmount**: Shell lifecycle unregisters scoped item and passage
   catalog registrations.

Step 3 and step 4 have to agree on *where* a catalog is filed, because the
resolver matches owner contexts field by field: a reader that assembled its own
context by hand would silently resolve nothing the day either side gained a
field. So one function decides it — `collectEntityCatalogRegistrations` walks the
three places catalogs hang off an entity (entity-level `accessibilityCatalogs`,
`config.extractedCatalogs`, and each model's own catalogs, the last filed under
that `modelId` so two models can reuse one identifier), and
`catalogOwnerContextFor` builds the context both sides use. Both are exported
from `@pie-players/pie-assessment-toolkit`; readers should call the latter rather
than construct a `CatalogOwnerContext` literal.

---

## Integration with PIE

### SSML Extraction from PIE Content

`SSMLExtractor` can convert embedded `<speak>` SSML tags from item content into
QTI 3.0 accessibility catalogs. Run it as a preprocessing/import step before
rendering, then pass the cleaned config and `config.extractedCatalogs` to the
player. The runtime registers `extractedCatalogs` when shells mount, but it does
not invoke extraction during shell registration.

Signed content has no equivalent. A `sign-language` card is authored or written
by an importer, never lifted out of markup at render time: a counterpart to
`SSMLExtractor` was implemented and removed, because nothing produced the inline
form — the Learnosity transform writes `accessibilityCatalogs` directly — and a
runtime that failed to parse the markup left the video in the visible content,
showing the accommodation to every learner. Inline `<speak>` earns its extractor
because it is real authored content PIE does not control; inline signing video is
not.

#### Why Extraction?

Authors can embed SSML directly in content for convenience:
- Proper pronunciation of technical terms (e.g., "polynomial")
- Math expressions spoken correctly ("x squared minus five x")
- Emphasis and pacing control
- No need to maintain separate catalog files

The extraction step:
1. Extracts SSML before render
2. Generates catalog entries with unique IDs
3. Cleans visual markup (removes SSML tags)
4. Stores catalogs on `config.extractedCatalogs` for runtime registration

#### Complete Transformation Example

**Before (Author Creates This):**

```typescript
{
  identifier: 'q1-quadratic',
  item: {
    id: 'quadratic-q1',
    name: 'Quadratic Question',
    baseId: 'quadratic-q1',
    version: { major: 1, minor: 0, patch: 0 },
    config: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: {
        'multiple-choice': '@pie-element/multiple-choice@latest'
      },
      models: [
        {
          id: 'q1',
          element: 'multiple-choice',
          prompt: `<div>
            <!-- Author embeds SSML for proper math pronunciation -->
            <speak xml:lang="en-US">
              Which method should you use to solve
              <prosody rate="slow">x squared, minus five x, plus six,
              equals zero</prosody>?
            </speak>

            <!-- Visual content for display -->
            <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
          </div>`,
          choiceMode: 'radio',
          choices: [
            {
              value: 'a',
              label: `<speak>The <emphasis>quadratic formula</emphasis></speak>
                      <span>The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<speak><emphasis level="strong">Factoring</emphasis>,
                      because it's easiest</speak>
                      <span>Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<speak>Completing the square</speak>
                      <span>Completing the square</span>`
            },
            {
              value: 'd',
              label: 'Graphing'  // No SSML - will use plain text
            }
          ]
        }
      ]
    }
  }
}
```

**After (Preprocessed Extraction):**

```typescript
{
  identifier: 'q1-quadratic',
  item: {
    id: 'quadratic-q1',
    name: 'Quadratic Question',
    baseId: 'quadratic-q1',
    version: { major: 1, minor: 0, patch: 0 },
    config: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: {
        'multiple-choice': '@pie-element/multiple-choice@latest'
      },

      // ✅ CLEANED: SSML removed, catalog IDs added
      models: [
        {
          id: 'q1',
          element: 'multiple-choice',
          prompt: `<div data-catalog-idref="auto-prompt-q1-0">
            <p><strong>Which method should you use to solve x² - 5x + 6 = 0?</strong></p>
          </div>`,
          choiceMode: 'radio',
          choices: [
            {
              value: 'a',
              label: `<span data-catalog-idref="auto-choice-q1-a-0">The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<span data-catalog-idref="auto-choice-q1-b-0">Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<span data-catalog-idref="auto-choice-q1-c-0">Completing the square</span>`
            },
            {
              value: 'd',
              label: 'Graphing'  // No catalog ID - no SSML found
            }
          ]
        }
      ],

      // ✅ NEW: Extracted SSML catalogs
      extractedCatalogs: [
        {
          identifier: 'auto-prompt-q1-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak xml:lang="en-US">
                Which method should you use to solve
                <prosody rate="slow">x squared, minus five x, plus six,
                equals zero</prosody>?
              </speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-a-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak>The <emphasis>quadratic formula</emphasis></speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-b-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak><emphasis level="strong">Factoring</emphasis>,
                because it's easiest</speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-c-0',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak>Completing the square</speak>`
            }
          ]
        }
      ]
    }
  }
}
```

#### Key Transformations

| Aspect | Before | After |
|--------|--------|-------|
| **Visual Content** | Mixed SSML + HTML | Clean HTML only |
| **Catalog IDs** | None | Auto-generated `data-catalog-idref` |
| **SSML Storage** | Embedded in markup | Separate `extractedCatalogs` array |
| **Structure** | Dual content (speak + visual) | Single visual + catalog reference |

#### TTS Behavior After Extraction

1. **Content-Level TTS (tool-tts-inline):**
   - User clicks speaker icon in header
   - Tool calls `ttsService.speak(text, { catalogId: 'auto-prompt-q1-0' })`
   - Resolver finds SSML in `extractedCatalogs`
   - Polly/Browser speaks with proper math pronunciation and pacing

2. **Floating selection TTS tools that pass catalog IDs:**
   - User selects "The quadratic formula" text
   - Tool detects nearest `data-catalog-idref="auto-choice-q1-a-0"`
   - Calls `ttsService.speak(selectedText, { catalogId: 'auto-choice-q1-a-0' })`
   - Resolver finds SSML with `<emphasis>`
   - Speaks with proper emphasis

   The annotation toolbar read-aloud path intentionally speaks the selected
   visible range and bypasses catalogs.

3. **Plain Text Fallback:**
   - User selects "Graphing" (choice d - no SSML)
   - No catalog ID present
   - TTS uses plain text with browser TTS
   - Still works, just without enhanced pronunciation

#### Extraction Service

**Location:** `packages/assessment-toolkit/src/services/SSMLExtractor.ts`

**Usage:**

```typescript
import { SSMLExtractor } from '@pie-players/pie-assessment-toolkit';

const extractor = new SSMLExtractor();
const result = extractor.extractFromItemConfig(item.config);

// Update config with cleaned content
item.config = result.cleanedConfig;
item.config.extractedCatalogs = result.catalogs;
```

**Integration Points:**
- Content import/preprocessing can run `SSMLExtractor`
- Runtime registration reads `config.extractedCatalogs`
- Shell mount/unmount handles scoped catalog registration lifecycle

### Catalog References in PIE Content

PIE elements provide the interaction capability. Authored content and catalog
references live in item config model fields and passage/rubric HTML. Use
`data-catalog-idref` in those HTML strings, and keep the PIE element `id`
aligned with `config.models[].id`.

```typescript
const item = {
  accessibilityCatalogs: [
    {
      identifier: 'prompt-001',
      cards: [{ catalog: 'spoken', language: 'en-US', content: '<speak>What is the main idea?</speak>' }]
    },
    {
      identifier: 'choice-001-A',
      cards: [{ catalog: 'spoken', language: 'en-US', content: '<speak>Choice A. Plants need sunlight.</speak>' }]
    }
  ],
  config: {
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="prompt-001">What is the main idea?</div>',
        choices: [
          { value: 'a', label: '<span data-catalog-idref="choice-001-A">Plants need sunlight to grow.</span>' },
          { value: 'b', label: '<span data-catalog-idref="choice-001-B">Water is essential for life.</span>' }
        ]
      }
    ]
  }
};
```

```html
<!-- Passage or rubric HTML can also reference a shared catalog. -->
<div data-catalog-idref="passage-photosynthesis">
  <p>Photosynthesis is the process by which...</p>
</div>
```

### Two Cards of One Type: Script and Recording

A `spoken` node may carry both a reading script and a recording of it, in the same
language. This is APIP's pattern, kept by QTI 3's migration guidance: the script
is what the recording was generated from and its fallback when the clip cannot
play.

```typescript
{
  identifier: 'prompt-1',
  cards: [
    { catalog: 'spoken', language: 'en-US', content: '<speak>A plant absorbs…</speak>' },
    { catalog: 'spoken', language: 'en-US', payload: { media: { /* audio */ } } },
  ],
}
```

A card carries exactly one of `content` or `payload`, so the slot is already the
discriminator and no extra field is needed. A lookup picks one with `form`:

```typescript
resolver.getAlternative('prompt-1', { type: 'spoken', language: 'en-US', form: 'payload' });
```

`form` is a **preference, not a filter**: an absent preferred form still returns
the other card, so callers check what they got. It applies *within* a language
rung and never across one — a recording in the requested language beats a script
in that language, but a script in the requested language beats a recording in
another. Omit `form` for first-match resolution.

`getAllAlternatives` keys on type, language **and** form, so both cards are
reported.

### Recorded Audio as a Spoken Alternate

A `spoken` card may carry a recording instead of a script. QTI 3 treats the two as
the *same* support, so this is not a separate accommodation and needs no separate
PNP entitlement.

```typescript
{
  catalog: 'spoken',
  language: 'en-US',
  payload: {
    media: {
      version: 1,
      id: 'prompt-audio',
      kind: 'audio',
      sources: [{ src: '/audio/prompt.mp3', type: 'audio/mpeg' }],
    },
    fragment: { startSeconds: 4, endSeconds: 9 },  // optional slice of a longer file
  },
}
```

- **Highlighting is the node as a block**, not word by word: a recording emits no
  word-boundary events. Word-level highlighting stays on the synthesized path.
- **`media.kind` must be `audio`.** A video filed under `spoken` is refused, so
  signing and speech cards cannot swap roles.
- **The first source is used.** An `<audio>` element with alternative `<source>`
  children signals failure through a path that is awkward to observe, and a
  dependable fallback matters more than encoding negotiation.
- **`fragment` becomes a Media Fragments URI**, with the end bound enforced by the
  player because browser support for it is inconsistent.
- **The rate setting applies** via `playbackRate`; voice selection does not.
- **Failure degrades to the script** — playback retries the node with its
  `content` card. With no script authored, the failure is reported rather than
  silently skipped.
- **Suppression still wins**, below.

The `read-aloud-accommodations` section demo exercises all of this, including a
clip that fails to load.

### Suppressing Read-Aloud

Some content must be shown and never spoken — items where reading *is* the
construct, such as decoding and spelling. `data-tts-suppress` marks an element and
its subtree not-to-be-spoken:

```html
<p>
  Which word begins with the same sound as
  <span data-tts-suppress="all">cake</span>?
</p>
```

| Value                | Effect                                                            |
| -------------------- | ----------------------------------------------------------------- |
| `computer-read-aloud` | Not spoken by PIE's TTS.                                          |
| `all`                | Not spoken by PIE's TTS, and the host should also hide it from AT. |
| `screen-reader`      | Aimed at assistive technology only — **still machine-read aloud**. |

One value, not a list. An unrecognized or empty value suppresses anyway and logs
why: a token that fell through on a typo would speak the word the item was
measuring, with no visible symptom.

**Not a catalog card, and not a PNP field.** A suppression card would carry
neither `content` nor `payload` and would only work on docked nodes, and it has to
be enforceable in the selection read-aloud path, which consults no catalog.
`prohibitedSupports` is the learner declining a support; this is the item saying
"not here, for anyone", so it overrides an entitlement and beats an authored
`spoken` card on the same node.

**Enforced in every path that produces speech**, since a filter on one of them is
a filter a candidate can walk around:

- the composed catalog path, checked before card resolution;
- the generated-speech and visible-text collectors, via
  `isNodeExcludedFromSpeech`;
- structural pause boundaries, so a suppressed node leaves no audible seam;
- `speakRange`, the annotation-toolbar selection path. It passes
  `range.toString()` straight through and `Range.toString()` honours no DOM
  filter, so it filters the range itself. A selection wholly inside suppressed
  content speaks nothing; one that spans it speaks the rest, with highlight
  offsets from the same filtered text.

A host passing its own string to `ttsService.speak(text, { ignoreCatalogs: true })`
bypasses this — there is no DOM to filter. Pass a `contentElement`, or a `Range`
via `speakRange`.

**Speech-only, with no braille or signing equivalent.** The test is whether a
modality preserves the information the item measures. Speech destroys spelling;
braille preserves it, so braille of a spelling item is how a blind candidate takes
that test; signing preserves it only when the signer fingerspells. For signing
that decides it: the fact lives in the recording and is known to the signer, not
to whoever authors an attribute, and suppression is per node while a signed
alternate is one video per item — so the only available rule would withhold a deaf
candidate's whole translation over one word.

**Importing QTI content.** QTI 3 spells this `data-qti-suppress-tts`, same
vocabulary and placement. PIE reads only `data-tts-suppress`, following its own
`data-tts-*` family, so an importer maps it on the way in; accepting both
spellings is how one fact under two names starts disagreeing with itself.

### Multi-Level Catalog Support

```typescript
// Assessment-level catalog (shared across items)
const assessment = {
  accessibilityCatalogs: [
    {
      identifier: 'shared-passage-001',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>...' },
        { catalog: 'braille', language: 'en', content: '⠠⠏⠓⠕⠞⠕...' }
      ]
    }
  ]
};

const passage = {
  content: '<div data-catalog-idref="shared-passage-001">Photosynthesis is the process...</div>'
};

// Item-level catalog (item-specific)
const item = {
  accessibilityCatalogs: [
    {
      identifier: 'prompt-photo-001',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>...' },
        { catalog: 'simplified-language', language: 'en', content: 'What do plants need?' }
      ]
    }
  ],
  config: {
    markup: '<multiple-choice id="photo-q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'photo-q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="prompt-photo-001">What do plants need?</div>',
        choices: []
      }
    ]
  }
};
```

**Resolution Priority:** Item/model-scoped catalogs override assessment-level catalogs for the same identifier.

---

## TTSService Integration

### Catalog-Aware TTS

```typescript
import { TTSService, AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

const resolver = new AccessibilityCatalogResolver(assessmentCatalogs, 'en-US');
const ttsService = new TTSService();

ttsService.setCatalogResolver(resolver);

await ttsService.speak('Visible fallback text', {
  catalogId: 'prompt-001',
  language: 'en-US',
  contentElement: document.querySelector('[data-catalog-idref="prompt-001"]') ?? undefined
});
```

For normal section-player delivery, prefer `ToolkitCoordinator`; it creates and
wires the resolver, TTS service, and highlighting service together. Use direct
`TTSService` calls for tests, custom host controls, or focused service
experiments.

### Integration with PNP

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

function createCoordinatorForProfile(profile: PersonalNeedsProfile) {
  const supportsTts = profile.supports.includes('textToSpeech');

  return new ToolkitCoordinator({
    assessmentId: 'assessment-1',
    tools: {
      placement: {
        section: ['lineReader', 'ruler'],
        item: supportsTts ? ['textToSpeech'] : [],
        passage: supportsTts ? ['textToSpeech'] : [],
      },
      providers: supportsTts
        ? {
            textToSpeech: {
              settings: { backend: 'browser' },
            },
          }
        : {},
    },
  });
}
```

---

## Section Player Integration

The **PIE Section Player** is the primary interface for integrating accessibility catalogs with the assessment toolkit.

### Complete Integration Example

```javascript
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import {
  ToolkitCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Create a single runtime coordinator for the assessment surface.
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  accessibility: {
    catalogs: assessment.accessibilityCatalogs ?? [],
    language: 'en-US',
  },
  tools: {
    placement: {
      item: ['textToSpeech'],
      passage: ['textToSpeech'],
      section: ['lineReader', 'ruler'],
    },
    providers: {
      textToSpeech: {
        settings: { backend: 'browser' },
      },
    },
  },
});

// Pass the coordinator to the section player through runtime.
const sectionPlayer = document.querySelector('pie-section-player-splitpane');
sectionPlayer.runtime = {
  ...(sectionPlayer.runtime ?? {}),
  coordinator,
  tools: coordinator.config.tools,
};

// Set section data
sectionPlayer.assessmentId = assessment.id;
sectionPlayer.sectionId = section.identifier;
sectionPlayer.attemptId = attempt.id;
sectionPlayer.section = section;

// The section player now automatically:
// - renders passage/item TTS tools from the coordinator config
// - wires section-level runtime services through the shared toolkit boundary
// - coordinates catalog-aware TTS behavior for the active section
```

### What Happens Automatically

When you configure catalog-aware TTS through the section player runtime:

1. **Catalog Registration**: Registers catalogs already present on passages,
   items, models, and `config.extractedCatalogs`
2. **Lifecycle Management**: Unregisters shell-scoped catalog registrations on
   navigation/unmount
3. **TTS Tool Rendering**: Shows inline TTS buttons when the coordinator enables
   `textToSpeech`
4. **Catalog Resolution**: Resolves `data-catalog-idref` for spoken catalogs,
   then falls back to generated speech or visible text

**You don't need to manually manage catalog lifecycle** - the section player handles it.

---

## PIE Element Authoring

### PIE Elements Provide Capabilities

PIE elements live in the sibling `../pie-elements-ng` repo and provide the
interaction capability: multiple choice, drag-and-drop, constructed response,
and so on. A player loads those element packages, registers the custom elements,
and passes each element its `model`, `session`, and `env`.

The authored content belongs in the item config. Catalog-aware TTS metadata is
therefore carried by item-level catalogs, `config.extractedCatalogs`, and
`data-catalog-idref` markers in model HTML. PIE elements should render their
model content and preserve those markers; they do not need React hooks or
element-local catalog resolver plumbing.

```typescript
const item = {
  id: 'item-1',

  accessibilityCatalogs: [
    {
      identifier: 'item-prompt',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>Question one. <break time="300ms"/> What is two plus two?</speak>'
        }
      ]
    },
    {
      identifier: 'choice-a',
      cards: [
        {
          catalog: 'spoken',
          language: 'en-US',
          content: '<speak>Choice A. <break time="200ms"/> Three</speak>'
        }
      ]
    }
  ],

  config: {
    markup: '<multiple-choice id="q1"></multiple-choice>',
    elements: {
      'multiple-choice': '@pie-element/multiple-choice@latest'
    },
    models: [
      {
        id: 'q1',
        element: 'multiple-choice',
        prompt: '<div data-catalog-idref="item-prompt">What is 2 + 2?</div>',
        choices: [
          { label: '<span data-catalog-idref="choice-a">3</span>', value: 'a' },
          { label: '<span>4</span>', value: 'b' }
        ]
      }
    ]
  }
};
```

---

## Usage Examples

### Example 1: Basic TTS with Catalogs

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  tools: {
    placement: {
      item: ['textToSpeech'],
      passage: ['textToSpeech'],
      section: [],
    },
    providers: {
      textToSpeech: {
        settings: { backend: 'browser' },
      },
    },
  },
});

const player = document.querySelector('pie-section-player-splitpane');
player.runtime = {
  ...(player.runtime ?? {}),
  coordinator,
  tools: coordinator.config.tools,
};
player.section = sectionWithAccessibilityCatalogs;

// TTS uses authored alternatives when the rendered content exposes matching data-catalog-idref values.
```

### Example 2: Multi-Language Support

```typescript
const resolver = new AccessibilityCatalogResolver(
  [
    {
      identifier: 'welcome-message',
      cards: [
        { catalog: 'spoken', language: 'en-US', content: '<speak>Welcome...</speak>' },
        { catalog: 'spoken', language: 'es-ES', content: '<speak>Bienvenido...</speak>' },
        { catalog: 'spoken', language: 'fr-FR', content: '<speak>Bienvenue...</speak>' }
      ]
    }
  ],
  'en-US' // Default language
);

// Get English version
const english = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'en-US'
});

// Get Spanish version
const spanish = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'es-ES'
});

// Fallback to default if language not available
const german = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'de-DE', // Not available
  useFallback: true  // Falls back to 'en-US'
});
```

## Best Practices

### Content Authoring

1. **Catalog Identifiers:**
   - Use descriptive, hierarchical IDs: `prompt-item-001`, `choice-item-001-A`
   - Keep consistent naming across items
   - Prefix shared catalogs: `shared-passage-photosynthesis`

2. **SSML for Spoken Content:**
   ```xml
   <speak>
     <prosody rate="medium" pitch="medium">
       This is the main content.
       <break time="500ms"/>
       Use breaks for pacing.
       <emphasis level="strong">Emphasize</emphasis> important words.
     </prosody>
   </speak>
   ```

3. **Multi-Language Support:**
   - Provide language codes: `en-US`, `es-ES`, `fr-FR`
   - Always include a default language version
   - Use regional variants when pronunciation differs

4. **Braille Guidelines:**
   - Use appropriate braille codes (Nemeth for math, UEB for text)
   - Test with actual braille displays if possible
   - Provide both contracted and uncontracted versions if needed

5. **Simplified Language:**
   - Use short sentences (5-10 words)
   - Avoid complex vocabulary
   - Use bullet points and lists
   - Include visual supports (icons, images)

### Performance

1. **Lazy Loading:**
   - Keep large item catalogs on the item/model payload that needs them
   - Let shell mount/unmount register and unregister item-scoped catalogs
   - Keep shared assessment catalogs in coordinator accessibility config

2. **Caching:**
   - Cache resolved catalogs to avoid repeated lookups
   - Use browser cache for external resources (videos, audio)

3. **Fallback Strategy:**
   - Always have a fallback to default content
   - Use `useFallback: true` for critical content
   - Log when catalogs are missing (for content QA)

### Accessibility

1. **Indicate Alternative Availability:**
   ```html
   <div data-catalog-idref="prompt-001" class="has-alternatives">
     <span class="a11y-badge" aria-label="Available in multiple formats">A11y</span>
     Regular content here...
   </div>
   ```

2. **User Control:**
   - Let users choose their preferred format
   - Remember preferences across sessions
   - Provide easy toggles between formats

3. **Testing:**
   - Test with actual assistive technologies
   - Validate SSML markup
   - Check braille output with users
   - Test video captions and transcripts

---

## References

- [Section Player Client Guide](../section-player/client-architecture-tutorial.md)
- [APIP Specification](https://www.imsglobal.org/apip) - IMS Global APIP standard
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Nemeth Braille Code](http://www.brailleauthority.org/nemeth/nemeth.pdf)

