# QTI 3.0 Feature Support in PIE Assessment Toolkit

**Status:** Personal Needs Profile ✅ | Context Declarations ✅ | Accessibility Catalogs ✅ (Core)
**Date:** January 28, 2026
**Version:** 1.1.0

---

## Executive Summary

The PIE Assessment Toolkit natively supports QTI 3.0 features for standards-compliant assessment delivery. The toolkit uses QTI 3.0 directly (no custom abstractions) and provides composable services that work independently or with AssessmentPlayer.

**Implementation Status:**

- ✅ **Personal Needs Profile (PNP)** - Fully implemented (native QTI 3.0)
- ✅ **Context Declarations** - Fully implemented (global variables)
- ✅ **Accessibility Catalogs** - Core service complete (Phase 2) - TTS integration in progress
- 📋 **Stimulus References** - Planned (Phase 3)

This document provides an overview of QTI 3.0 features and their implementation status in the toolkit.

---

## Table of Contents

1. [Context Declarations (Global Variables)](#1-context-declarations-global-variables)
2. [Accessibility Catalogs (APIP Integration)](#2-accessibility-catalogs-apip-integration)
3. [Personal Needs Profiles (PNP 3.0)](#3-personal-needs-profiles-pnp-30)
4. [Stimulus References (Shared Passages)](#4-stimulus-references-shared-passages)
5. [Implementation Strategy](#5-implementation-strategy)
6. [Priority Recommendations](#6-priority-recommendations)

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

### Implementation Effort

- **Backend (AssessmentPlayer):** 2-3 days
- **PIE Element Updates:** Varies per element (opt-in feature)
- **Testing:** 1-2 days
- **Documentation:** 1 day

**Total:** ~1 week for core implementation

### Use Case Priority

**Medium-High** - Valuable for advanced assessments with:
- Item randomization needs
- Adaptive testing
- Multi-item scenarios with shared context

---

## 2. Accessibility Catalogs (APIP Integration)

### What They Are

Accessibility catalogs provide alternative representations of content for assistive technologies. QTI 3.0 integrates APIP (Accessible Portable Item Protocol) directly:

- **Spoken content:** Text-to-speech scripts
- **Sign language:** Video URLs for signed content
- **Braille:** Braille-ready transcriptions
- **Simplified language:** Plain language alternatives
- **Tactile graphics:** Descriptions for tactile diagrams

### Current Status: ✅ Core Service Implemented (Phase 2)

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

#### 3. TTS Integration (In Progress - Phase 2)

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

**For detailed integration guide, see:** [Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md)

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

**Phase 1: Core Infrastructure** ✅ **COMPLETE**
- ✅ `AccessibilityCatalogResolver` service implemented
- ✅ Assessment-level and item-level catalog support
- ✅ Multi-language resolution with fallback strategies
- ✅ All catalog types supported (spoken, sign-language, braille, simplified-language, tactile, etc.)
- ✅ Comprehensive examples created
- ✅ Service exported from toolkit
- ✅ Demo integrated into example site

**Phase 2: TTS Integration** ⚠️ **IN PROGRESS**
- ✅ Interface updated (ITTSService)
- ⏸️ TTSService implementation (pending)
- ⏸️ AssessmentPlayer integration (pending)
- ⏸️ Auto-detect catalog IDs from DOM (pending)

**Phase 3: Extended Catalog Types** 📋 **PLANNED**
- 📋 Sign language video player
- 📋 Braille renderer
- 📋 Simplified language transformer
- 📋 UI indicators for available alternatives

**Documentation:**
- ✅ [Integration Guide](./accessibility-catalogs-integration-guide.md) - Complete implementation guide
- ✅ [Quick Start](./accessibility-catalogs-quick-start.md) - Developer quick start
- ✅ [Quick Start Examples](./accessibility-catalogs-quick-start.md) - Comprehensive examples

### Use Case Priority

**High** - Critical for:
- Section 508 compliance
- WCAG AAA accessibility
- State/federal assessment contracts
- International markets requiring multi-language accessibility

**Recommended Implementation Order:**
1. TTS catalog integration (highest ROI)
2. Sign language video (regulatory requirement in some markets)
3. Braille (specialized need, smaller market)

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
      calculator: { type: 'scientific', provider: 'desmos' }
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

### How It Could Work

#### Implementation Approach

1. **Map PNP supports to PIE tools:**
   ```typescript
   const PNP_TO_PIE_TOOL_MAPPING: Record<string, string> = {
     'textToSpeech': 'pie-tool-text-to-speech',
     'calculator': 'pie-tool-calculator',
     'ruler': 'pie-tool-ruler',
     'protractor': 'pie-tool-protractor',
     'highlighter': 'pie-tool-annotation-toolbar',
     'lineReader': 'pie-tool-line-reader',
     'colorContrast': 'pie-tool-color-scheme',
     'eliminator': 'pie-tool-answer-eliminator',
   };
   ```

2. **Apply PNP during player initialization:**
   ```typescript
   class AssessmentPlayer {
     private applyPersonalNeedsProfile(profile: PersonalNeedsProfile) {
       // Enable required supports
       for (const support of profile.supports) {
         const toolId = PNP_TO_PIE_TOOL_MAPPING[support];
         if (toolId) {
           this.toolCoordinator.enableTool(toolId, { required: true });
         }
       }

       // Disable prohibited supports
       for (const prohibited of profile.prohibitedSupports ?? []) {
         const toolId = PNP_TO_PIE_TOOL_MAPPING[prohibited];
         if (toolId) {
           this.toolCoordinator.disableTool(toolId, { locked: true });
         }
       }

       // Auto-activate specified supports
       for (const activate of profile.activateAtInit ?? []) {
         const toolId = PNP_TO_PIE_TOOL_MAPPING[activate];
         if (toolId) {
           this.toolCoordinator.activateTool(toolId);
         }
       }
     }
   }
   ```

3. **Merge with context profile system:**
   ```typescript
   function resolveToolAvailability(
     assessment: AssessmentEntity,
     contextProfile: AssessmentContextProfile
   ): ToolAvailability[] {
     const pnp = assessment.personalNeedsProfile;
     const baseTools = contextProfile.tools;

     // PNP takes precedence over context profile
     return baseTools.map(tool => {
       const support = getPNPSupportForTool(tool.toolId);

       if (pnp?.supports.includes(support)) {
         return { ...tool, enabled: true, required: true };
       }
       if (pnp?.prohibitedSupports?.includes(support)) {
         return { ...tool, enabled: false, restricted: true };
       }

       return tool;
     });
   }
   ```

4. **Extend PNP beyond standard PIE tools:**
   ```typescript
   const EXTENDED_PNP_SUPPORTS = {
     'fontSize': (value: string) => {
       document.documentElement.style.fontSize = value;
     },
     'lineSpacing': (value: number) => {
       document.documentElement.style.lineHeight = String(value);
     },
     'colorContrast': (value: 'high' | 'low' | 'inverted') => {
       this.themeProvider.setContrastMode(value);
     },
     'readingMask': () => {
       this.toolCoordinator.activateTool('pie-tool-line-reader');
     },
   };
   ```

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

### Implementation Effort

**Phase 1: Core PNP Support** (1 week)
- Map PNP supports to existing PIE tools
- Apply on assessment load
- Override tool availability based on PNP

**Phase 2: Advanced Configuration** (1-2 weeks)
- Support PNP parameters (not just boolean)
- Handle conflicts between PNP and context profile
- Add prohibitedSupports enforcement

**Phase 3: Extended PNP Features** (1 week)
- Theme adjustments (font size, line spacing, contrast)
- Auto-activation logic for activateAtInit
- Session logging of applied accommodations

**Total:** 3-4 weeks

### Use Case Priority

**High** - Essential for:
- K-12 assessments (IEP/504 compliance)
- State/federal contracts
- Accessibility-first organizations
- Districts with high accommodation rates

**Recommended Approach:**
1. Start with PNP → PIE tool mapping (80% of use cases)
2. Add extended theme/font adjustments
3. Build admin UI for PNP management (separate from player)

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

### How It Could Work

#### Implementation Approach

1. **Load stimuli during assessment initialization:**
   ```typescript
   class AssessmentPlayer {
     private stimulusCache: Map<string, StimulusContent> = new Map();

     private async loadStimuli(assessment: AssessmentEntity) {
       for (const ref of assessment.stimulusRefs ?? []) {
         const content = await this.fetchStimulus(ref.href);
         this.stimulusCache.set(ref.identifier, content);
       }
     }

     private async fetchStimulus(href: string): Promise<StimulusContent> {
       // Could be:
       // - HTML content
       // - Image/diagram
       // - Video/audio
       // - Embedded data table
       const response = await fetch(href);
       return { html: await response.text() };
     }
   }
   ```

2. **Inject stimulus into item context:**
   ```typescript
   private async renderItem(itemId: string) {
     const item = await this.loadItem(itemId);

     // Check if item references a stimulus
     const stimulusId = this.getItemStimulusReference(item);
     const stimulus = stimulusId ? this.stimulusCache.get(stimulusId) : null;

     await piePlayer.render({
       item,
       session,
       stimulus  // Inject shared stimulus
     });
   }
   ```

3. **Add UI component for stimulus display:**
   ```svelte
   <script lang="ts">
     export let stimulus: StimulusContent | null;
     export let position: 'left' | 'right' | 'top' = 'left';
   </script>

   {#if stimulus}
     <aside class="stimulus-panel {position}">
       {@html stimulus.html}
     </aside>
   {/if}
   ```

4. **Support split-screen layout:**
   ```typescript
   class AssessmentPlayer {
     private layoutMode: 'single' | 'split' = 'single';

     private determineLayo(item: ItemEntity) {
       const hasStimulus = this.getItemStimulusReference(item);
       return hasStimulus ? 'split' : 'single';
     }
   }
   ```

### Benefits

1. **Performance:** Load passage once, use across multiple items
2. **Consistency:** All items see identical stimulus content
3. **Cache Efficiency:** Browser caches stimulus separately
4. **Bandwidth Savings:** Don't send same passage in every item
5. **Easier Authoring:** Update passage in one place
6. **Better UX:** Keep passage visible while navigating items
7. **Standardized Layout:** QTI defines where stimulus appears

### Drawbacks

1. **Layout Complexity:** Split-screen UI is complex to implement well
2. **Responsive Design:** Mobile devices have limited screen space
3. **PIE Element Changes:** Items need to know they reference stimuli
4. **Loader Logic:** Need smart pre-loading of stimuli
5. **Navigation Coupling:** Stimulus must persist across item transitions
6. **Print Mode:** How to handle stimuli in print layouts?
7. **Accessibility:** Screen reader handling of persistent stimulus

### Implementation Effort

**Phase 1: Basic Stimulus Support** (2 weeks)
- Fetch and cache stimuli during load
- Inject into item context
- Simple "above item" layout

**Phase 2: Split-Screen UI** (2-3 weeks)
- Responsive split layout
- User-resizable panels
- Mobile-friendly collapsible stimulus

**Phase 3: Advanced Features** (1-2 weeks)
- Pre-load next item's stimulus
- Smooth transitions between items
- Print-friendly layouts
- Accessibility improvements

**Total:** 5-7 weeks

### Use Case Priority

**Medium-High** - Valuable for:
- Reading comprehension assessments (ELA)
- Science assessments with data tables/diagrams
- Any assessment with multi-item passages
- Performance optimization for large passages

**Recommended Approach:**
1. Start with simple "above item" layout
2. Add split-screen for desktop users
3. Use collapsible panels on mobile

---

## 5. Implementation Strategy

### Phased Rollout

#### Phase 1: Foundation (2-3 weeks)
**Goal:** Runtime support for most impactful features

1. **Context Declarations** - Basic implementation
   - Initialize context variables
   - Pass to items (no-op for PIE elements that don't use it)
   - Persist in TestSession

2. **PNP Tool Mapping** - Core functionality
   - Map PNP supports to PIE tools
   - Apply on assessment load
   - Override tool availability

**Deliverables:**
- Context system working
- PNP applied automatically
- No breaking changes to existing assessments

#### Phase 2: Accessibility (4-6 weeks)
**Goal:** Full accessibility catalog support

1. **TTS Catalog Integration**
   - Extend TTSService to use catalogs
   - Auto-detect spoken content
   - Fallback to generated TTS

2. **Sign Language Video** (if needed)
   - Video player integration
   - UI toggle for sign language

**Deliverables:**
- Assessment-level TTS catalogs working
- Sign language support (optional)
- Improved accessibility compliance

#### Phase 3: Advanced Features (4-6 weeks)
**Goal:** Stimulus references and advanced PNP

1. **Stimulus References**
   - Fetch and cache stimuli
   - Split-screen UI
   - Mobile-friendly layout

2. **Extended PNP**
   - Theme adjustments
   - Font/spacing controls
   - prohibitedSupports enforcement

**Deliverables:**
- Shared passages working
- Full PNP feature set
- Production-ready QTI 3.0 player

### Backward Compatibility

**Strategy:** All QTI 3.0 features are opt-in

- Assessments without QTI 3.0 fields work unchanged
- Legacy flat format continues to work
- New features activate only when data present

**No breaking changes** - Existing assessments unaffected

### Testing Strategy

1. **Unit Tests**
   - Test each feature in isolation
   - Mock QTI 3.0 data structures
   - Verify fallback behavior

2. **Integration Tests**
   - End-to-end assessment with QTI 3.0 features
   - Test feature interactions
   - Performance testing with large catalogs

3. **Accessibility Testing**
   - Screen reader compatibility
   - Keyboard navigation
   - WCAG compliance verification

4. **Cross-Browser Testing**
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers (iOS Safari, Chrome Mobile)
   - Assistive technology compatibility

---

## 6. Priority Recommendations

### Must-Have (High ROI, Low Risk)

1. **Personal Needs Profiles** - Phase 1 implementation
   - **Why:** Immediate compliance value, maps to existing tools
   - **Effort:** 1 week
   - **Risk:** Low (graceful fallback)

2. **TTS Catalog Integration** - Phase 2
   - **Why:** Improves accessibility with minimal effort
   - **Effort:** 1-2 weeks
   - **Risk:** Low (extends existing TTS system)

### Should-Have (High Value, Medium Effort)

3. **Stimulus References** - Phase 3
   - **Why:** Performance gains, better UX for passage-based assessments
   - **Effort:** 5-7 weeks
   - **Risk:** Medium (UI complexity)

4. **Context Declarations** - Phase 1
   - **Why:** Enables advanced assessment patterns
   - **Effort:** 1 week
   - **Risk:** Low (PIE elements can ignore if not needed)

### Nice-to-Have (Specialized Use Cases)

5. **Sign Language Catalogs** - Phase 2 (optional)
   - **Why:** Required in some markets, but specialized
   - **Effort:** 2 weeks
   - **Risk:** Medium (video hosting/streaming)

6. **Braille Catalogs** - Phase 2 (optional)
   - **Why:** Specialized need, smaller market
   - **Effort:** 2-3 weeks
   - **Risk:** High (hardware dependencies)

### Recommended Timeline

**Q1 2026:** Phase 1 (Foundation)
- ✅ Data model complete (done)
- PNP tool mapping
- Context declarations

**Q2 2026:** Phase 2 (Accessibility)
- TTS catalog integration
- Sign language (if needed)
- Extended PNP features

**Q3 2026:** Phase 3 (Advanced)
- Stimulus references
- Performance optimization
- Production hardening

---

## Summary

The PIE Assessment Toolkit provides **native QTI 3.0 support** through composable services that work independently or with AssessmentPlayer.

### Implementation Status

| Feature | Status | Service | Notes |
|---------|--------|---------|-------|
| **Personal Needs Profile** | ✅ Implemented | PNPToolResolver, PNPMapper | Native QTI 3.0, 72% code reduction |
| **Context Declarations** | ✅ Implemented | ContextVariableStore | Session persistence, type-safe |
| **Accessibility Catalogs** | ✅ Core Complete | AccessibilityCatalogResolver | Phase 2, TTS integration in progress |
| **Stimulus References** | 📋 Planned | StimulusManager | Phase 3, layout integration |

### Key Benefits

- **Standards Compliant**: Uses QTI 3.0 directly (no custom abstractions)
- **Third-Party Friendly**: All services work independently of AssessmentPlayer
- **Composable**: Import only what you need
- **Framework Agnostic**: Works with any JavaScript framework
- **Backward Compatible**: Optional enhancements, existing code unaffected

### Next Steps

**Phase 2:** Accessibility Catalogs - Core Complete ✅

- ✅ Core service (AccessibilityCatalogResolver) implemented
- ✅ All catalog types supported (spoken, braille, sign-language, simplified-language, tactile, etc.)
- ✅ Two-level system (assessment + item catalogs)
- ✅ Comprehensive examples and documentation
- 🚧 **In Progress:** TTSService integration for automatic catalog playback
- 📋 **Planned:** PIE authoring tools for catalog creation

See [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) for details.

**Phase 3:** Stimulus References (shared passages/stimuli)

- Reading comprehension passages
- Shared diagrams/images
- Split-view layouts
- Extends existing layout system

---

## References

- [Architecture Overview](ARCHITECTURE.md) - Complete system architecture
- [Assessment Toolkit README](../packages/assessment-toolkit/src/README.md) - Usage and examples
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
- [TOOL_PROVIDER_SYSTEM](./TOOL_PROVIDER_SYSTEM.md) - Native tool provider and runtime details
- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Phase 2 complete guide
- [Accessibility Catalogs TTS Integration](accessibility-catalogs-tts-integration.md) - TTSService integration (Phase 2)
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [PNP Third-Party Integration Guide](pnp-third-party-integration-guide.md) - Integrate PNP in any platform

---

**Last Updated:** January 28, 2026
