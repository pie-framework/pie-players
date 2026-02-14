# PNP Profile Testing Guide

This guide explains how to use the PNP (Personal Needs Profile) testing and development tools in the Assessment Toolkit.

## Overview

The toolkit provides two main components for PNP development and testing:

1. **PNPProfileTester** - Interactive UI for creating and testing PNP profiles
2. **PNPProvenanceViewer** - Visual display of resolution decisions and explanations

These tools help developers, testers, accessibility teams, and product managers understand and validate PNP resolution behavior.

## PNPProfileTester Component

### Purpose

The `PNPProfileTester` component provides an interactive UI for:

- Selecting example accessibility profiles (blind, low vision, dyslexia, etc.)
- Toggling individual QTI 3.0 standard features
- Adding custom/proprietary features
- Exporting/importing profile configurations
- Real-time testing without modifying production data

### Basic Usage

```typescript
import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';
import type { PersonalNeedsProfile } from '@pie-players/pie-players-shared/types';

let currentProfile: PersonalNeedsProfile | null = null;

function handleProfileChange(profile: PersonalNeedsProfile | null) {
  currentProfile = profile;
  // Apply to your assessment/player
  applyProfileToAssessment(profile);
}
```

```svelte
<PNPProfileTester onProfileChange={handleProfileChange} />
```

### With PNPToolResolver (Recommended)

```typescript
import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';
import {
  PNPToolResolver,
  createDefaultToolRegistry,
} from '@pie-players/pie-assessment-toolkit';

const registry = createDefaultToolRegistry();
const resolver = new PNPToolResolver(registry, true);

function handleProfileChange(profile: PersonalNeedsProfile | null) {
  // Use resolveWithOverride to test profile without modifying assessment
  const result = resolver.resolveWithOverride(baseAssessment, profile);

  // Get enabled tool IDs
  const toolIds = result.tools.filter((t) => t.enabled).map((t) => t.id);

  // Display provenance
  console.log('Resolution summary:', result.provenance.summary);
  console.log('Enabled:', result.provenance.summary.enabled);
  console.log('Blocked:', result.provenance.summary.blocked);

  // Apply to your UI
  updateAvailableTools(toolIds);
}
```

### Component Props

| Prop                    | Type                                                | Default | Description                         |
| ----------------------- | --------------------------------------------------- | ------- | ----------------------------------- |
| `onProfileChange`       | `(profile: PersonalNeedsProfile \| null) => void`   | `() => {}` | Callback when profile changes    |
| `initialProfile`        | `PersonalNeedsProfile \| null`                      | `null`  | Initial profile to load             |
| `compact`               | `boolean`                                           | `false` | Show compact UI (for sidebars)      |
| `allowCustomFeatures`   | `boolean`                                           | `true`  | Allow adding non-standard features  |

### Features

#### 1. Example Profiles

Pre-configured accessibility profiles based on common student needs:

- **Low Vision Support** - Magnification, high contrast, text-to-speech
- **Blind Student Support** - Screen reader, braille, keyboard control
- **Deaf/Hard of Hearing Support** - Captions, sign language, transcripts
- **Dyslexia Support** - Text-to-speech, highlighting, reading guides
- **ADHD Support** - Reduced distraction, timing control, structure
- **Motor Limitations Support** - Keyboard control, voice control, extended time
- **English Language Learner Support** - Translation, glossary, simplified language

#### 2. Feature Toggle

Browse and toggle 95+ QTI 3.0 standard accessibility features organized by category:

- **Visual** - Magnification, contrast, color, display
- **Auditory** - Text-to-speech, captions, audio control
- **Motor** - Keyboard, mouse, voice, switch control
- **Cognitive** - Navigation, timing, language, simplification
- **Content** - Alternatives, annotations, formatting

#### 3. Custom Features

Add proprietary or vendor-specific features not in QTI 3.0 standard:

```typescript
// Example: Add custom features
{
  supports: [
    'magnification',           // Standard QTI 3.0
    'textToSpeech',           // Standard QTI 3.0
    'acme-advanced-calculator' // Custom feature
  ]
}
```

#### 4. Import/Export

- **Export JSON** - Download current profile as `.json` file
- **Import JSON** - Load profile from file

#### 5. Search and Filter

- Search features by name or ID
- Filter by category (visual, auditory, motor, cognitive, content)

## PNPToolResolver.resolveWithOverride()

### Method Signature

```typescript
resolveWithOverride(
  assessment: AssessmentEntity,
  overrideProfile: PersonalNeedsProfile | null,
  itemRef?: AssessmentItemRef
): ToolResolutionResult
```

### Purpose

**FOR TESTING/DEVELOPMENT ONLY**

Allows direct injection of a PNP profile for testing without modifying the assessment entity. The override profile completely replaces `assessment.personalNeedsProfile` during resolution.

### Parameters

- `assessment` - Base assessment with settings, policies, etc.
- `overrideProfile` - PNP profile to inject (or `null` to test with no profile)
- `itemRef` - Optional item context for item-specific rules

### Returns

```typescript
{
  tools: ResolvedToolConfig[],     // Resolved tool configurations
  provenance: PNPResolutionProvenance // Complete decision trail
}
```

### Use Cases

#### 1. Development UI - Profile Simulation

```typescript
// Test different profiles without changing database
const profiles = [
  { supports: ['magnification', 'textToSpeech'] },
  { supports: ['captions', 'signLanguage'] },
  null, // No profile
];

profiles.forEach((profile) => {
  const result = resolver.resolveWithOverride(assessment, profile);
  console.log(`Profile:`, profile);
  console.log(`Enabled tools:`, result.tools.map((t) => t.id));
});
```

#### 2. Automated Testing

```typescript
import { describe, it, expect } from 'bun:test';

describe('PNP Resolution', () => {
  it('should enable calculator for blind students', () => {
    const blindProfile = {
      supports: ['screenReader', 'textToSpeech', 'calculator'],
    };

    const result = resolver.resolveWithOverride(assessment, blindProfile);
    const calcEnabled = result.tools.find((t) => t.id === 'pie-tool-calculator');

    expect(calcEnabled?.enabled).toBe(true);
  });

  it('should respect district blocks', () => {
    const assessment = {
      ...baseAssessment,
      settings: {
        districtPolicy: {
          blockedTools: ['calculator'],
        },
      },
    };

    const profile = { supports: ['calculator'] };
    const result = resolver.resolveWithOverride(assessment, profile);

    // Calculator should be blocked by district policy (precedence 1)
    const calc = result.tools.find((t) => t.id.includes('calculator'));
    expect(calc).toBe(undefined); // Not in resolved list = blocked
  });
});
```

#### 3. Preview Tools with Profile Simulator

```typescript
// Section preview route with profile testing
let selectedProfile = null;

function applyTestProfile(profile: PersonalNeedsProfile | null) {
  selectedProfile = profile;

  // Resolve tools with test profile
  const result = resolver.resolveWithOverride(assessment, profile, currentItemRef);

  // Update toolkit coordinator
  toolkitCoordinator.updateAllowedTools(result.tools.map((t) => t.id));

  // Show provenance in debug panel
  displayProvenance(result.provenance);
}
```

#### 4. Accessibility Team Validation

```typescript
// Test specific accommodation scenarios
const iepProfiles = [
  {
    name: 'Student A - Visual + Mobility',
    profile: { supports: ['screenMagnifier', 'keyboardControl', 'textToSpeech'] },
  },
  {
    name: 'Student B - Auditory + Language',
    profile: { supports: ['captions', 'signLanguage', 'translatedText'] },
  },
];

iepProfiles.forEach(({ name, profile }) => {
  const result = resolver.resolveWithOverride(assessment, profile);

  console.log(`\n=== ${name} ===`);
  console.log('Enabled tools:', result.tools.map((t) => t.id));
  console.log('Blocked features:', result.provenance.summary.blocked);

  // Generate compliance report
  generateComplianceReport(name, result.provenance);
});
```

### Important Notes

1. **Testing Only** - This method is for development, testing, and preview tools. Production code should use `resolveToolsWithProvenance()` with the assessment's actual PNP.

2. **Override Replaces Entire Profile** - The override completely replaces `assessment.personalNeedsProfile`. It does NOT merge with existing profile.

3. **Policies Still Apply** - District policies, test administration overrides, and item restrictions from the assessment/item settings are still enforced.

4. **Use with Provenance** - Always enable provenance (`new PNPToolResolver(registry, true)`) when using overrides to see exactly how decisions are made.

## Complete Integration Example

Here's a full example showing PNPProfileTester + PNPToolResolver + PNPProvenanceViewer:

```svelte
<script lang="ts">
  import {
    PNPProfileTester,
    PNPProvenanceViewer,
  } from '@pie-players/pie-assessment-toolkit/components';
  import {
    PNPToolResolver,
    createDefaultToolRegistry,
  } from '@pie-players/pie-assessment-toolkit';
  import type { PersonalNeedsProfile } from '@pie-players/pie-players-shared/types';

  // Your assessment data
  export let assessment;
  export let currentItemRef;

  // Create resolver
  const registry = createDefaultToolRegistry();
  const resolver = new PNPToolResolver(registry, true);

  // State
  let testProfile: PersonalNeedsProfile | null = null;
  let resolutionResult = null;
  let showTester = $state(false);
  let showProvenance = $state(false);

  function handleProfileChange(profile: PersonalNeedsProfile | null) {
    testProfile = profile;

    // Resolve with test profile
    resolutionResult = resolver.resolveWithOverride(
      assessment,
      profile,
      currentItemRef
    );

    // Apply to toolkit coordinator
    toolkitCoordinator.updateAllowedTools(
      resolutionResult.tools.filter((t) => t.enabled).map((t) => t.id)
    );
  }
</script>

<!-- Your assessment player UI -->
<div class="assessment-player">
  <!-- ... player content ... -->

  <!-- Dev Tools Toggle (only show in development) -->
  {#if import.meta.env.DEV}
    <div class="fixed bottom-4 right-4 space-x-2">
      <button
        class="btn btn-sm btn-outline"
        on:click={() => (showTester = !showTester)}
      >
        {showTester ? 'Hide' : 'Show'} PNP Tester
      </button>
      <button
        class="btn btn-sm btn-outline"
        on:click={() => (showProvenance = !showProvenance)}
        disabled={!resolutionResult}
      >
        {showProvenance ? 'Hide' : 'Show'} Provenance
      </button>
    </div>
  {/if}
</div>

<!-- PNP Profile Tester Drawer -->
{#if showTester}
  <div class="drawer drawer-end">
    <div class="drawer-side z-50">
      <label
        class="drawer-overlay"
        on:click={() => (showTester = false)}
      ></label>
      <div class="p-4 w-96 bg-base-100 min-h-full">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold">PNP Profile Tester</h2>
          <button
            class="btn btn-sm btn-circle"
            on:click={() => (showTester = false)}
          >
            ✕
          </button>
        </div>
        <PNPProfileTester onProfileChange={handleProfileChange} />
      </div>
    </div>
  </div>
{/if}

<!-- Provenance Viewer Modal -->
{#if showProvenance && resolutionResult}
  <dialog class="modal modal-open">
    <div class="modal-box max-w-4xl">
      <button
        class="btn btn-sm btn-circle absolute right-2 top-2"
        on:click={() => (showProvenance = false)}
      >
        ✕
      </button>
      <h3 class="font-bold text-lg mb-4">PNP Resolution Provenance</h3>
      <PNPProvenanceViewer provenance={resolutionResult.provenance} />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button on:click={() => (showProvenance = false)}>close</button>
    </form>
  </dialog>
{/if}
```

## Best Practices

### 1. Development Environment Only

Only show PNP testing tools in development:

```svelte
{#if import.meta.env.DEV}
  <PNPProfileTester onProfileChange={handleProfileChange} />
{/if}
```

### 2. Feature Flags for Staging

Use feature flags for staging/preview environments:

```typescript
const showPnpTester = import.meta.env.DEV || user.hasRole('admin') || config.enablePnpTesting;
```

### 3. Always Use Provenance

Enable provenance tracking to understand resolution decisions:

```typescript
const resolver = new PNPToolResolver(registry, true); // Enable provenance
```

### 4. Document Custom Features

If using custom features, document them clearly:

```typescript
// Custom features for Acme Assessment Platform
const CUSTOM_FEATURES = {
  'acme-advanced-calculator': 'Scientific calculator with CAS',
  'acme-formula-sheet': 'Auto-populating formula reference',
  'acme-scratch-work': 'Digital scratch work with export',
};
```

### 5. Test District Policies

Test that district policies override student profiles:

```typescript
const testCases = [
  {
    name: 'District blocks calculator',
    districtPolicy: { blockedTools: ['calculator'] },
    studentProfile: { supports: ['calculator', 'textToSpeech'] },
    expectedResult: 'calculator blocked, textToSpeech enabled',
  },
  // ... more test cases
];
```

## Troubleshooting

### Profile Changes Not Applying

**Problem**: Changing profile in tester doesn't update tools

**Solution**: Make sure to apply resolved tools to your toolkit coordinator:

```typescript
function handleProfileChange(profile) {
  const result = resolver.resolveWithOverride(assessment, profile);

  // Must update coordinator with new tool IDs
  toolkitCoordinator.updateAllowedTools(result.tools.map((t) => t.id));
}
```

### Custom Features Not Working

**Problem**: Custom feature added but tool doesn't appear

**Solution**: Custom features need PNP-to-tool mapping in registry:

```typescript
registry.registerPNPSupport('my-custom-feature', 'my-custom-tool-id');
```

Or use the feature ID directly as tool ID.

### District Policy Not Blocking

**Problem**: Student profile overrides district blocks

**Solution**: Check precedence - district blocks (level 1) should always win:

```typescript
const result = resolver.resolveWithOverride(assessment, profile);

// Check provenance to see why
const feature = result.provenance.features.get('calculator');
console.log(feature.explanation); // Shows which rule won
```

## Related Documentation

- [PNP Configuration Guide](./PNP_CONFIGURATION.md) - PNP structure and precedence
- [Tool Registry Architecture](./TOOL_REGISTRY.md) - Tool registration and mapping
- [PIE API Integration](./PIE_API_PNP_INTEGRATION.md) - Server-side PNP resolution
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - Official standard
- [IMS AfA 3.0](https://www.imsglobal.org/spec/afa/v3p0) - Accessibility features catalog

## API Reference

### PNPProfileTester Component

```typescript
interface PNPProfileTesterProps {
  /** Callback when profile changes */
  onProfileChange?: (profile: PersonalNeedsProfile | null) => void;

  /** Initial profile to load */
  initialProfile?: PersonalNeedsProfile | null;

  /** Show compact view */
  compact?: boolean;

  /** Allow custom feature entry */
  allowCustomFeatures?: boolean;
}
```

### PNPToolResolver.resolveWithOverride()

```typescript
/**
 * Resolve tools with test/override PNP profile
 * FOR TESTING/DEVELOPMENT ONLY
 */
resolveWithOverride(
  assessment: AssessmentEntity,
  overrideProfile: PersonalNeedsProfile | null,
  itemRef?: AssessmentItemRef
): ToolResolutionResult;
```

### Example PNP Configurations

```typescript
import { EXAMPLE_PNP_CONFIGURATIONS } from '@pie-players/pie-assessment-toolkit';

// Available profiles:
EXAMPLE_PNP_CONFIGURATIONS.lowVision;
EXAMPLE_PNP_CONFIGURATIONS.blind;
EXAMPLE_PNP_CONFIGURATIONS.deafHardOfHearing;
EXAMPLE_PNP_CONFIGURATIONS.dyslexia;
EXAMPLE_PNP_CONFIGURATIONS.adhd;
EXAMPLE_PNP_CONFIGURATIONS.motorLimitations;
EXAMPLE_PNP_CONFIGURATIONS.englishLearner;
```
