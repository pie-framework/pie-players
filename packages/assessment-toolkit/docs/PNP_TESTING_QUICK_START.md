# PNP Profile Testing - Quick Start

## 5-Minute Setup

### 1. Import Component

```typescript
import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';
```

### 2. Add to Your UI

```svelte
<script>
  let currentProfile = null;

  function handleProfileChange(profile) {
    currentProfile = profile;
    console.log('Profile changed:', profile);
  }
</script>

<PNPProfileTester onProfileChange={handleProfileChange} />
```

### 3. Use with Resolver (Recommended)

```typescript
import { PNPToolResolver, createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';

const registry = createDefaultToolRegistry();
const resolver = new PNPToolResolver(registry, true);

function handleProfileChange(profile) {
  // Test profile without modifying assessment
  const result = resolver.resolveWithOverride(assessment, profile);

  // Apply resolved tools
  const toolIds = result.tools.filter(t => t.enabled).map(t => t.id);
  updateTools(toolIds);

  // Show provenance (optional)
  console.log('Enabled:', result.provenance.summary.enabled);
  console.log('Blocked:', result.provenance.summary.blocked);
}
```

## Common Patterns

### Pattern 1: Development Drawer

```svelte
{#if import.meta.env.DEV}
  <div class="drawer drawer-end">
    <input type="checkbox" bind:checked={showTester} />
    <div class="drawer-side">
      <label class="drawer-overlay" on:click={() => showTester = false}></label>
      <div class="p-4 w-96 bg-base-100 min-h-full">
        <h2>PNP Tester</h2>
        <PNPProfileTester onProfileChange={handleProfileChange} />
      </div>
    </div>
  </div>
{/if}
```

### Pattern 2: With Provenance Viewer

```svelte
<script>
  import { PNPProfileTester, PNPProvenanceViewer } from '@pie-players/pie-assessment-toolkit/components';

  let result = null;

  function handleProfileChange(profile) {
    result = resolver.resolveWithOverride(assessment, profile);
  }
</script>

<PNPProfileTester onProfileChange={handleProfileChange} />

{#if result}
  <PNPProvenanceViewer provenance={result.provenance} />
{/if}
```

### Pattern 3: Automated Testing

```typescript
import { describe, it, expect } from 'bun:test';

describe('PNP Resolution', () => {
  it('enables features for blind students', () => {
    const profile = {
      supports: ['textToSpeech', 'screenReader', 'calculator']
    };

    const result = resolver.resolveWithOverride(assessment, profile);

    expect(result.tools.filter(t => t.enabled).length).toBeGreaterThan(0);
    expect(result.provenance.summary.enabled).toBe(3);
  });
});
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onProfileChange` | `(profile) => void` | `() => {}` | Callback when profile changes |
| `initialProfile` | `PersonalNeedsProfile` | `null` | Initial profile to load |
| `compact` | `boolean` | `false` | Show compact UI |
| `allowCustomFeatures` | `boolean` | `true` | Allow custom features |

## Method Signature

```typescript
PNPToolResolver.resolveWithOverride(
  assessment: AssessmentEntity,
  overrideProfile: PersonalNeedsProfile | null,
  itemRef?: AssessmentItemRef
): ToolResolutionResult
```

## Example Profiles

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

## Profile Structure

```typescript
interface PersonalNeedsProfile {
  supports?: string[];           // Feature IDs to enable
  activateAtInit?: string[];     // Auto-open on start
  // ... other QTI 3.0 fields
}

// Example
const profile = {
  supports: [
    'magnification',
    'textToSpeech',
    'highContrastDisplay',
    'calculator'
  ],
  activateAtInit: ['textToSpeech']
};
```

## Resolution Result

```typescript
interface ToolResolutionResult {
  tools: ResolvedToolConfig[];     // Resolved tool configs
  provenance: PNPResolutionProvenance; // Decision trail
}

// Use it
const result = resolver.resolveWithOverride(assessment, profile);

// Get tool IDs
const toolIds = result.tools.filter(t => t.enabled).map(t => t.id);

// Check summary
console.log(result.provenance.summary);
// { totalFeatures: 4, enabled: 3, blocked: 1, ... }

// Get explanation
const calcExplanation = result.provenance.features.get('calculator')?.explanation;
```

## Quick Tips

### ✅ DO

- Use `resolveWithOverride()` for testing only
- Enable provenance: `new PNPToolResolver(registry, true)`
- Test district policy enforcement
- Use in development/staging environments
- Export profiles for sharing

### ❌ DON'T

- Use in production for actual resolution
- Skip provenance tracking (always enable it)
- Modify production assessment entities
- Hardcode profiles in application code
- Forget to test with null profile (no accessibility features)

## One-Liner Examples

```typescript
// Test with no profile
resolver.resolveWithOverride(assessment, null);

// Test with single feature
resolver.resolveWithOverride(assessment, { supports: ['calculator'] });

// Test with example profile
const profile = EXAMPLE_PNP_CONFIGURATIONS.blind;
resolver.resolveWithOverride(assessment, { supports: profile.features });

// Export current profile
JSON.stringify(currentProfile, null, 2);
```

## Troubleshooting

**Q: Profile changes but tools don't update?**
A: Make sure to apply resolved tool IDs to your toolkit coordinator:
```typescript
toolkitCoordinator.updateAllowedTools(result.tools.map(t => t.id));
```

**Q: Custom feature doesn't work?**
A: Register PNP-to-tool mapping:
```typescript
registry.registerPNPSupport('my-feature', 'my-tool-id');
```

**Q: District block not working?**
A: Check provenance to see precedence:
```typescript
console.log(result.provenance.features.get('calculator')?.explanation);
```

## Next Steps

- Read [Complete Testing Guide](./PNP_TESTING.md)
- See [Example Component](../src/components/PNPProfileTester.example.svelte)
- Check [PNP Configuration Guide](./PNP_CONFIGURATION.md)
- Review [Tool Registry Docs](./TOOL_REGISTRY.md)

## Live Example

```svelte
<script lang="ts">
  import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';
  import { PNPToolResolver, createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';

  const registry = createDefaultToolRegistry();
  const resolver = new PNPToolResolver(registry, true);

  let enabledTools = [];

  function handleProfileChange(profile) {
    const result = resolver.resolveWithOverride(
      { id: 'test', name: 'Test', settings: {} },
      profile
    );

    enabledTools = result.tools.filter(t => t.enabled).map(t => t.id);
  }
</script>

<div class="grid grid-cols-2 gap-4">
  <PNPProfileTester onProfileChange={handleProfileChange} />

  <div>
    <h3>Enabled Tools:</h3>
    <ul>
      {#each enabledTools as toolId}
        <li>{toolId}</li>
      {/each}
    </ul>
  </div>
</div>
```

That's it! You're ready to test PNP profiles. 🎉
