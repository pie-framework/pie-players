# QTI 3.0 Feature Support in PIE Assessment Toolkit

---

## Executive Summary

The PIE Assessment Toolkit natively supports QTI 3.0 features for standards-compliant assessment delivery. The toolkit uses QTI 3.0 directly (no custom abstractions) and provides composable services that work independently or with AssessmentPlayer.

**Implementation Status:**

- ✅ **Personal Needs Profile (PNP)** - Implemented (native QTI 3.0)
- ✅ **Context Declarations** - Implemented (global variables)
- ✅ **Accessibility Catalogs** - Core service implemented, TTS integration in progress
- ❌ **Stimulus References** - Not implemented

This document provides an overview of QTI 3.0 features and their implementation status in the toolkit.

---

## Table of Contents

1. [Context Declarations (Global Variables)](#1-context-declarations-global-variables)
2. [Accessibility Catalogs (APIP Integration)](#2-accessibility-catalogs-apip-integration)
3. [Personal Needs Profiles (PNP 3.0)](#3-personal-needs-profiles-pnp-30)
4. [Stimulus References (Shared Passages)](#4-stimulus-references-shared-passages)

---

## 1. Context Declarations (Global Variables)

### Status: ✅ Implemented

Context declarations define global variables shared across items in an assessment.

**Use Cases:**

- Shared random seeds (consistent randomization across items)
- Adaptive testing (difficulty adjustment based on performance)
- Shared configuration (currency symbols, measurement units)
- Item dependencies (later items react to earlier responses)

### Implementation

**Service:** `ContextVariableStore` - Standalone, stateless service for managing context variables

**Data Model:**

```typescript
interface ContextDeclaration {
  identifier: string;
  baseType: 'boolean' | 'integer' | 'float' | 'string' | 'identifier' |
            'point' | 'pair' | 'directedPair' | 'duration' | 'file' | 'uri';
  cardinality: 'single' | 'multiple' | 'ordered' | 'record';
  defaultValue?: any;
}

interface AssessmentEntity {
  contextDeclarations?: ContextDeclaration[];
}
```

### Usage

**With AssessmentPlayer:**

```typescript
import { AssessmentPlayer } from '@pie-players/pie-assessment-toolkit';

const assessment = {
  contextDeclarations: [
    { identifier: 'RANDOM_SEED', baseType: 'integer', defaultValue: 42 },
    { identifier: 'DIFFICULTY_LEVEL', baseType: 'string', defaultValue: 'medium' }
  ]
};

const player = new AssessmentPlayer({ assessment, loadItem });

// Access variables
const seed = player.getContextVariable('RANDOM_SEED');
player.setContextVariable('DIFFICULTY_LEVEL', 'hard');

// Get all variables (for passing to PIE elements)
const context = player.getContextVariables();
```

**Standalone (Third-Party Players):**

```typescript
import { ContextVariableStore } from '@pie-players/pie-assessment-toolkit';

const store = new ContextVariableStore(assessment.contextDeclarations);
store.set('RANDOM_SEED', 12345);

// Serialize for session persistence
const state = store.toObject();
saveSession({ ...session, contextVariables: state });

// Restore from session
store.fromObject(savedSession.contextVariables);
```

**Features:**

- ✅ Type validation for all QTI 3.0 base types
- ✅ Automatic session persistence
- ✅ Default value handling
- ✅ Composable (works independently of AssessmentPlayer)
- ✅ Framework agnostic
   private handleItemSessionChange(change: PieSessionChange) {
     // Update local item session
     this.updateItemSession(change);

     // Check if item sets any context variables
     if (change.contextUpdates) {
       for (const [key, value] of Object.entries(change.contextUpdates)) {
         this.contextVariables.set(key, value);
       }
     }
   }
   ```

### Benefits

1. **Cross-Item Randomization:** Ensure consistent random seeds across related items
   ```xml
   <contextDeclaration identifier="RANDOM_SEED" baseType="integer" cardinality="single">
     <defaultValue><value>42</value></defaultValue>
   </contextDeclaration>
   ```

2. **Progressive Testing:** Items can adapt based on previous performance
   ```xml
   <contextDeclaration identifier="DIFFICULTY_LEVEL" baseType="string" cardinality="single">
     <defaultValue><value>medium</value></defaultValue>
   </contextDeclaration>
   ```

3. **Shared Resources:** Multiple items reference same configuration
   ```xml
   <contextDeclaration identifier="CURRENCY_SYMBOL" baseType="string" cardinality="single">
     <defaultValue><value>$</value></defaultValue>
   </contextDeclaration>
   ```

4. **Test-Wide Scoring:** Aggregate scoring across sections
   ```xml
   <contextDeclaration identifier="SECTION_A_SCORE" baseType="float" cardinality="single">
     <defaultValue><value>0.0</value></defaultValue>
   </contextDeclaration>
   ```

### Drawbacks

1. **Complexity:** Adds state management overhead
2. **PIE Element Support:** Requires PIE elements to be context-aware
3. **Serialization:** Context must be persisted in TestSession
4. **Debugging:** Hidden dependencies between items harder to trace
5. **Breaking Change:** Would require PIE element API updates

---

## 2. Accessibility Catalogs (APIP Integration)

### What They Are

Accessibility catalogs provide alternative representations of content for assistive technologies. QTI 3.0 integrates APIP (Accessible Portable Item Protocol) directly:

- **Spoken content:** Text-to-speech scripts
- **Sign language:** Video URLs for signed content
- **Braille:** Braille-ready transcriptions
- **Simplified language:** Plain language alternatives
- **Tactile graphics:** Descriptions for tactile diagrams

### Current Status: ✅ Core Service Implemented

**Data Model:** ✅ Complete
```typescript
interface CatalogCard {
  catalog: string; // 'spoken', 'sign-language', 'braille', etc.
  language?: string;
  content: string;
}

interface AccessibilityCatalog {
  identifier: string;
  cards: CatalogCard[];
}

interface AssessmentEntity {
  accessibilityCatalogs?: AccessibilityCatalog[];
  // ...
}

interface ItemEntity {
  accessibilityCatalogs?: AccessibilityCatalog[];
  // ...
}
```

**Runtime Support:** ✅ Service implemented, ⚠️ TTS integration pending

**Service:** `AccessibilityCatalogResolver` - Standalone service for managing accessibility catalogs

**Location:** `packages/assessment-toolkit/src/services/AccessibilityCatalogResolver.ts`

### Implementation (Complete)

#### 1. AccessibilityCatalogResolver Service

```typescript
import { AccessibilityCatalogResolver } from '@pie-players/pie-assessment-toolkit';

// Initialize with assessment-level catalogs
const resolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs,
  'en-US' // default language
);

// Add item-level catalogs when rendering item
resolver.addItemCatalogs(item.accessibilityCatalogs);

// Resolve alternative content (item-level overrides assessment-level)
const spoken = resolver.getAlternative('prompt-001', {
  type: 'spoken',
  language: 'en-US',
  useFallback: true
});

// Clear item catalogs on navigation
resolver.clearItemCatalogs();
```

#### 2. PIE Integration Pattern

Content references catalogs using `data-catalog-id` attributes:

```html
<pie-prompt>
  <div data-catalog-id="prompt-001">
    <p>What is the main idea?</p>
  </div>
</pie-prompt>

<pie-choices>
  <pie-choice value="A" data-catalog-id="choice-001-A">
    First answer
  </pie-choice>
</pie-choices>
```

#### 3. TTS Integration (In Progress)

```typescript
class TTSService {
  private catalogResolver?: AccessibilityCatalogResolver;

  setCatalogResolver(resolver: AccessibilityCatalogResolver): void {
    this.catalogResolver = resolver;
  }

  async speak(text: string, options?: { catalogId?: string; language?: string }): Promise<void> {
    // Try catalog first
    if (options?.catalogId && this.catalogResolver) {
      const alternative = this.catalogResolver.getAlternative(options.catalogId, {
        type: 'spoken',
        language: options.language,
        useFallback: true
      });
      if (alternative) {
        return this.speakSSML(alternative.content);
      }
    }
    // Fallback to generated TTS
    return this.speakText(text);
  }
}
```

**For detailed integration guide, see:** [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)

### Benefits

1. **Standardized Accessibility:** QTI 3.0 defines standard catalog types
2. **Reduced Custom Work:** No need for vendor-specific accessibility extensions
3. **Cross-Platform Support:** Same catalog works across different players
4. **Multiple Modalities:** Support TTS, sign language, braille simultaneously
5. **Language Support:** Catalog cards can specify language variants
6. **Centralized Management:** All accessibility content in one place

### Drawbacks

1. **Content Creation Burden:** Authors must create alternative representations
2. **Storage Overhead:** Multiple versions of content increase size
3. **Maintenance:** Keeping alternatives in sync with main content
4. **Limited PIE Support:** PIE elements not designed with catalog references
5. **Player Complexity:** Need infrastructure to fetch/render alternatives
6. **Video Hosting:** Sign language videos require external hosting/streaming

### Implementation Status

- ✅ `AccessibilityCatalogResolver` service implemented
- ✅ Assessment-level and item-level catalog support
- ✅ Multi-language resolution with fallback strategies
- ✅ All catalog types supported (spoken, sign-language, braille, simplified-language, tactile, etc.)
- ✅ Service exported from toolkit
- ⚠️ TTSService integration is still in progress

**Documentation:**
- ✅ [Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md) - Complete implementation guide
- ✅ [Quick Start](../accessibility/accessibility-catalogs-quick-start.md) - Developer quick start
- ✅ [Quick Start Examples](../accessibility/accessibility-catalogs-quick-start.md) - Comprehensive examples

---

## 3. Personal Needs Profiles (PNP 3.0)

### Status: ✅ Implemented

Personal Needs Profiles (PNP 3.0) define standardized accessibility accommodations for students (IEP/504 support).

**Native QTI 3.0 Support:** The toolkit uses PNP directly (no custom profile abstractions), resulting in 72% code reduction.

### Data Model

```typescript
interface PersonalNeedsProfile {
  supports: string[];               // Required accessibility supports
  prohibitedSupports?: string[];    // Explicitly disabled supports
  activateAtInit?: string[];        // Auto-activate on assessment start
}

interface AssessmentEntity {
  personalNeedsProfile?: PersonalNeedsProfile;
  settings?: AssessmentSettings;    // Product-specific config
}
```

### Implementation

**Services:**

- `PNPMapper` - Maps QTI 3.0 PNP support IDs to PIE tool identifiers
- `PNPToolResolver` - Resolves tool availability with precedence hierarchy

**Tool Resolution Precedence** (highest to lowest):

1. District Block (absolute veto)
2. Test Administration Override
3. Item Restriction (per-item block)
4. Item Requirement (forces enable)
5. District Requirement
6. PNP Supports (student accommodations)

### Usage

```typescript
import { AssessmentPlayer, PNPToolResolver } from '@pie-players/pie-assessment-toolkit';

const assessment = {
  personalNeedsProfile: {
    supports: ['textToSpeech', 'calculator'],
    activateAtInit: ['textToSpeech']
  },
  settings: {
    districtPolicy: {
      blockedTools: [],
      requiredTools: ['ruler']
    },
    toolConfigs: {
      calculator: { type: 'scientific' }
    }
  }
};

// Simple initialization - tools automatically resolved
const player = new AssessmentPlayer({ assessment, loadItem });

// Or use PNPToolResolver directly
const resolver = new PNPToolResolver();
const tools = resolver.resolveTools(assessment, currentItemRef);
```

**Standard PNP Support IDs:**

```text
textToSpeech    → pie-tool-text-to-speech
calculator      → pie-tool-calculator
ruler           → pie-tool-ruler
protractor      → pie-tool-protractor
highlighter     → pie-tool-annotation-toolbar
lineReader      → pie-tool-line-reader
colorContrast   → pie-theme-contrast
answerMasking   → pie-tool-answer-eliminator
```

**Features:**

- ✅ Native QTI 3.0 (no custom abstractions)
- ✅ District policy support
- ✅ Item-level requirements
- ✅ Test administration overrides
- ✅ Auto-activation support
- ✅ Custom extension support
- ✅ Third-party friendly (composable)

### Benefits

1. **Standardization:** Single format for student accommodations
2. **Portability:** PNP travels with student across platforms
3. **Compliance:** Built-in support for IEP/504 requirements
4. **No Manual Configuration:** Accommodations auto-applied
5. **Audit Trail:** Clear record of what supports were provided
6. **Consistency:** Student gets same experience across assessments
7. **Conflict Resolution:** Explicit support for prohibited accommodations

### Drawbacks

1. **Limited Vocabulary:** PNP defines ~50 standard supports; custom needs may not be covered
2. **Mapping Complexity:** Translating PNP supports to PIE tools requires maintenance
3. **Vendor Lock-In Risk:** PIE-specific tools don't align 1:1 with PNP
4. **Override Conflicts:** PNP vs. item requirements vs. district policies (who wins?)
5. **Privacy Concerns:** PNP contains student accommodation data (PII)
6. **Granularity Mismatch:** PNP is boolean (on/off), PIE tools have rich config
7. **Version Skew:** PNP 3.0 may add new supports not yet in PIE

---

## 4. Stimulus References (Shared Passages)

### What They Are

Stimulus references formalize the concept of shared passages/stimuli across multiple items. Instead of each item embedding the passage, items reference a shared stimulus by identifier.

### Current Status

**Data Model:** ✅ Complete
```typescript
interface StimulusRef {
  identifier: string;
  href: string;
}

interface AssessmentEntity {
  stimulusRefs?: StimulusRef[];
  // ...
}
```

**Runtime Support:** ❌ Not implemented

Stimulus references are defined in the data model but are not supported by the current runtime.

---

## Summary

The PIE Assessment Toolkit provides **native QTI 3.0 support** through composable services that work independently or with AssessmentPlayer.

### Implementation Status

| Feature | Status | Service | Notes |
|---------|--------|---------|-------|
| **Personal Needs Profile** | ✅ Implemented | PNPToolResolver, PNPMapper | Native QTI 3.0, 72% code reduction |
| **Context Declarations** | ✅ Implemented | ContextVariableStore | Session persistence, type-safe |
| **Accessibility Catalogs** | ✅ Core Implemented | AccessibilityCatalogResolver | TTS integration in progress |
| **Stimulus References** | ❌ Not Implemented | N/A | Runtime support not available |

### Key Benefits

- **Standards Compliant**: Uses QTI 3.0 directly (no custom abstractions)
- **Third-Party Friendly**: All services work independently of AssessmentPlayer
- **Composable**: Import only what you need
- **Framework Agnostic**: Works with any JavaScript framework
- **Backward Compatible**: Optional enhancements, existing code unaffected

Current work is focused on completing TTS integration for accessibility catalogs.

---

## References

- [Architecture Overview](../architecture/architecture.md) - Complete system architecture
- [Assessment Toolkit README](../../packages/assessment-toolkit/README.md) - Usage and examples
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
- [TOOL_PROVIDER_SYSTEM](../tools-and-accomodations/tool_provider_system.md) - Native tool provider and runtime details
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md) - Detailed integration guide
- [Accessibility Catalogs TTS Integration](../accessibility/accessibility-catalogs-tts-integration.md) - TTSService integration details
- [Accessibility Catalogs Quick Start](../accessibility/accessibility-catalogs-quick-start.md) - Developer quick reference
- [PNP Third-Party Integration Guide](pnp-third-party-integration-guide.md) - Integrate PNP in any platform

