# QTI-Inspired Accessibility Catalogs - Integration Guide

<!-- markdownlint-disable MD012 MD031 MD032 MD040 MD060 -->

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration with PIE](#integration-with-pie)
4. [TTSService Integration](#ttsservice-integration)
5. [Section Player Integration](#section-player-integration)
6. [Print Player Integration](#print-player-integration)
7. [PIE Element Authoring](#pie-element-authoring)
8. [Usage Examples](#usage-examples)
9. [Best Practices](#best-practices)

---

## Overview

QTI 3.0 Accessibility Catalogs provide standardized alternative representations of content for assistive technologies. This guide explains how catalogs integrate with the PIE assessment toolkit at both **assessment-level** and **item-level**.

### Supported Catalog Types

| Type | Description | Use Case | Rendered by PIE |
|------|-------------|----------|-----------------|
| `spoken` | A TTS script (SSML), or a recording of one as a media payload | Screen readers, TTS | Yes — `TTSService` |
| `sign-language` | Signed video, as a structured media payload | Deaf/hard-of-hearing | Yes — once a host registers `@pie-players/pie-tool-sign-language`: the section player's media region, gated on the `signLanguage` PNP support |
| `transcript` | Text transcript of an audio stimulus | Deaf/hard-of-hearing | Yes — the packaged `transcript` capability, above the item or passage in the section and print players; gated on the `transcript` PNP support unless the card sets `visibility: "always"` |
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
`CatalogType` that simply never appeared. A host that wants to check before
registering imports `isKnownCatalogType` from
`@pie-players/pie-assessment-toolkit/services/AccessibilityCatalogResolver`.

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
   Capabilities on the cards' content surfaces resolve their own catalog types
   for the same item or passage in parallel, through the same resolver:
   `transcript` from the packaged set, `sign-language` once a host registers it.
5. **Navigation/Unmount**: Shell lifecycle unregisters scoped item and passage
   catalog registrations.

Step 3 and step 4 have to agree on *where* a catalog is filed. The resolver owns
that agreement: `registerOwner(...)` walks entity-level
`accessibilityCatalogs`, `config.extractedCatalogs`, and each model's own
catalogs, filing the last under its `modelId` so two models can reuse one
identifier. `forOwner(...)` binds reads and observation to the matching owner;
content capabilities receive only its immutable snapshot. Direct lookup clients
such as TTS should build their context with `catalogOwnerContextFor(...)` rather
than assemble a `CatalogOwnerContext` literal.

---

## Integration with PIE

### SSML Extraction from PIE Content

`SSMLExtractor` can convert embedded `<speak>` SSML tags from item content into
QTI 3.0 accessibility catalogs. Run it as a preprocessing/import step before
rendering, then pass the cleaned config and `config.extractedCatalogs` to the
player. The runtime registers `extractedCatalogs` when shells mount, but it does
not invoke extraction during shell registration.

Signed content has no extractor: a `sign-language` card is authored or written
by an importer, and a signing video left in markup renders as ordinary content
to every learner.

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
              label: `<span><speak>The <emphasis>quadratic formula</emphasis></speak>The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<span><speak><emphasis level="strong">Factoring</emphasis>,
                      because it's easiest</speak>Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<span><speak>Completing the square</speak>Completing the square</span>`
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

      // SSML removed, catalog IDs added
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
              label: `<span data-catalog-idref="auto-choice-q1-a-1">The quadratic formula</span>`
            },
            {
              value: 'b',
              label: `<span data-catalog-idref="auto-choice-q1-b-2">Factoring, because it's easiest</span>`
            },
            {
              value: 'c',
              label: `<span data-catalog-idref="auto-choice-q1-c-3">Completing the square</span>`
            },
            {
              value: 'd',
              label: 'Graphing'  // No catalog ID - no SSML found
            }
          ]
        }
      ],

      // Extracted SSML catalogs
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
          identifier: 'auto-choice-q1-a-1',
          cards: [
            {
              catalog: 'spoken',
              language: 'en-US',
              content: `<speak>The <emphasis>quadratic formula</emphasis></speak>`
            }
          ]
        },
        {
          identifier: 'auto-choice-q1-b-2',
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
          identifier: 'auto-choice-q1-c-3',
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

The extractor docks each catalog to the element directly around its `<speak>`, which is why each
choice label wraps its SSML and its visible text in one `<span>`. A `<speak>` with no enclosing
element still yields a catalog, with no `data-catalog-idref` to reach it from the content, and the
extractor warns. The trailing number comes from a counter on the extractor instance that runs
until `reset()`, so the choices number on from the prompt.

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
   - Tool calls `ttsService.speak(readingTarget, { catalogId: 'auto-prompt-q1-0' })`
   - Resolver finds SSML in `extractedCatalogs`
   - Polly/Browser speaks with proper math pronunciation and pacing

2. **Selection read-aloud (annotation toolbar):**
   - User selects "The quadratic formula" and presses read-aloud
   - Toolbar calls `ttsService.speak(range, { contentRoot, catalogContext })`,
     with the catalog context of the shell holding the selection
   - The selection holds choice a's `data-catalog-idref` node whole, so its
     card is spoken, with the authored `<emphasis>`
   - Selecting only "quadratic" holds part of the node, and speaks the
     selected visible text

3. **Plain Text Fallback:**
   - Choice d ("Graphing") carries no SSML and no `data-catalog-idref`
   - TTS speaks its visible text
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

- the composed catalog path, checked before card resolution, and the card a
  `catalogId` names;
- the generated-speech and visible-text collectors, via
  `isNodeExcludedFromSpeech`;
- structural pause boundaries, so a suppressed node leaves no audible seam;
- a range target, the annotation-toolbar selection path. `Range.toString()`
  honours no DOM filter, so the range itself is filtered. A selection wholly
  inside suppressed content speaks nothing; one that spans it speaks the rest,
  with highlight offsets from the same filtered text.

`ttsService.speak` takes only a DOM target, an element or a range, so no caller
can hand it text the filter has not seen.

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

const prompt = document.querySelector('[data-catalog-idref="prompt-001"]');
if (prompt) {
  await ttsService.speak(prompt, { catalogId: 'prompt-001', language: 'en-US' });
}
```

For normal section-player delivery, prefer `ToolkitCoordinator`; it creates and
wires the resolver, TTS service, and highlighting service together. Use direct
`TTSService` calls for tests, custom host controls, or focused service
experiments.

### Integration with PNP

```typescript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import type { PersonalNeedsProfile } from '@pie-players/pie-players-shared/types';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createPackagedToolRegistry();

function createCoordinatorForProfile(profile: PersonalNeedsProfile) {
  const supportsTts = profile.supports.includes('textToSpeech');

  return new ToolkitCoordinator({
    assessmentId: 'assessment-1',
    toolRegistry,
    tools: {
      placement: {
        section: ['lineReader', 'ruler'],
        item: supportsTts ? ['textToSpeech'] : [],
        passage: supportsTts ? ['textToSpeech'] : [],
      },
      providers: supportsTts
        ? {
            textToSpeech: {
              backend: 'browser',
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
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// Create a single runtime coordinator for the assessment surface.
const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  toolRegistry,
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
        backend: 'browser',
      },
    },
  },
});

// Pass the coordinator to the section player through runtime.
const sectionPlayer = document.querySelector('pie-section-player-splitpane');
sectionPlayer.runtime = {
  ...(sectionPlayer.runtime ?? {}),
  assessmentId: assessment.id,
  coordinator,
  tools: coordinator.config.tools,
};

// Set section data
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

## Print Player Integration

`<pie-print>` resolves the item's catalogs itself. A print job is one learner with
one profile, decided once, so there is no coordinator to build and no lifecycle to
manage: the profile goes on the config beside the item.

```javascript
import '@pie-players/pie-print-player';

const player = document.querySelector('pie-print');
player.config = {
  // The PIE config. Catalogs written onto a model arrive with it; entity-root and
  // extractor-generated ones are passed as `accessibilityCatalogs` /
  // `extractedCatalogs` on the same object.
  item: itemEntity.config,
  options: { role: 'student' },
  accessibility: {
    personalNeedsProfile: student.personalNeedsProfile,
    // Optional, and only where a program has them.
    settings: assessment.settings,
    itemSettings: itemRef.settings,
  },
};
```

Four properties of that:

- **Eligibility runs the same eight-level precedence delivery runs**, so a district
  block outranks the learner's profile on paper as it does on screen.
- **An alternate in play prints inline and unconditionally**, above the item
  content. There is nothing to reveal on paper and no control to press.
- **An alternate an item declares as authored presentation prints with no
  `accessibility` at all.** An item family designed to be delivered with its
  transcript on screen is not an accommodation. An accommodation card with no
  profile supplied prints nothing.
- **Video alternates do not print.** Print opens the in-flow host slot and not the
  docked-media one, because on paper a video is a blank rectangle.

The alternates land in a `.pie-print-alternates` block, each preceded by a
`.pie-print-alternates__label` carrying the capability's name — paper has no
accessibility tree, so the name is rendered rather than left to `aria-label`.

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
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: 'demo-assessment',
  toolRegistry,
  tools: {
    placement: {
      item: ['textToSpeech'],
      passage: ['textToSpeech'],
      section: [],
    },
    providers: {
      textToSpeech: {
        backend: 'browser',
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

// A missing language falls back to the resolver's default language ('en-US'
// unless it was constructed with another), then to a card in any language
const german = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'de-DE' // Not available
});

// useFallback defaults to true; false returns a de-DE card or null
const germanOnly = resolver.getAlternative('welcome-message', {
  type: 'spoken',
  language: 'de-DE',
  useFallback: false
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
   - `useFallback` defaults to `true`; pass `false` where a card in another language is worse than none
   - Log when catalogs are missing (for content QA)

### Accessibility

1. **Indicate Alternative Availability:**
   ```html
   <div data-catalog-idref="prompt-001" class="has-alternatives">
     <span class="a11y-badge" role="img" aria-label="Available in multiple formats">A11y</span>
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
- [Nemeth Braille Code](https://www.brailleauthority.org/nemeth-code)
