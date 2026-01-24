# Assessment Context Profile Usage Guide

This guide shows you how to use the profile-based configuration system to define complex accommodation and configuration policies for your assessments.

## Overview

The profile system provides a flexible, extensible way to configure assessments based on multiple factors (student accommodations, district policies, item requirements, etc.) without forcing the framework to understand complex policy logic.

### Key Benefits

- **Separation of Concerns**: Policy (product responsibility) vs. Mechanism (framework responsibility)
- **Flexibility**: Supports any decision factors your product needs
- **Type Safety**: Clear TypeScript interfaces for all configuration
- **Testability**: Easy to mock profiles for testing
- **Extensibility**: Default implementation can be used, extended, or replaced

## Quick Start

### Step 1: Install Package

```bash
npm install @pie-framework/pie-assessment-toolkit
```

### Step 2: Choose Your Approach

#### Option A: Use Default Resolver (Recommended for Most Cases)

Best for: Standard accommodation patterns

```typescript
import {
  AssessmentPlayer,
  DefaultProfileResolver
} from '@pie-framework/pie-assessment-toolkit';

// Create resolver
const resolver = new DefaultProfileResolver();

// Resolve profile
const profile = await resolver.resolve({
  assessment: {
    id: 'my-assessment',
    defaultTools: ['calculator', 'ruler']
  },
  student: {
    id: 'student-123',
    accommodations: {
      textToSpeech: true,
      calculator: true
    }
  }
});

// Use profile
const player = new AssessmentPlayer({
  assessment: myAssessment,
  loadItem: myItemLoader,
  contextProfile: profile
});
```

#### Option B: Extend Default Resolver (Custom Logic)

Best for: Products with some custom accommodation rules

```typescript
import { DefaultProfileResolver } from '@pie-framework/pie-assessment-toolkit';
import type {
  ResolutionContext,
  ToolResolution
} from '@pie-framework/pie-assessment-toolkit';

class MyDistrictResolver extends DefaultProfileResolver {
  protected resolveToolAvailability(
    toolId: string,
    context: ResolutionContext
  ): ToolResolution {
    // Add custom rule: Block calculators for grade 3
    if (toolId === 'calculator' &&
        context.student?.grade === 3 &&
        context.assessment.subject === 'math') {
      return {
        enabled: false,
        restricted: true,
        explanation: {
          toolId,
          decision: 'blocked',
          reasons: ['District policy: No calculators for grade 3 math'],
          sources: ['District Policy']
        }
      };
    }

    // Use standard resolution for everything else
    return super.resolveToolAvailability(toolId, context);
  }
}

// Use custom resolver
const resolver = new MyDistrictResolver();
const profile = await resolver.resolve(context);
```

#### Option C: Implement Custom Resolver (Full Control)

Best for: Products with completely custom resolution logic

```typescript
import type {
  ProfileResolver,
  ResolutionContext,
  AssessmentContextProfile
} from '@pie-framework/pie-assessment-toolkit';

class ProductSpecificResolver implements ProfileResolver {
  async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
    // Call your external API, policy engine, etc.
    const tools = await this.fetchFromPolicyEngine(context);
    const theme = await this.fetchThemeSettings(context);

    return {
      profileId: `custom-${context.assessment.id}`,
      assessmentId: context.assessment.id,
      studentId: context.student?.id,
      tools,
      theme,
      layout: {},
      metadata: {
        createdAt: new Date(),
        createdBy: 'ProductSpecificResolver',
        version: '1.0.0'
      }
    };
  }

  private async fetchFromPolicyEngine(context: ResolutionContext) {
    // Your custom logic
  }
}
```

## Usage Examples

### Example 1: Simple Student Accommodations

```typescript
const resolver = new DefaultProfileResolver();
const profile = await resolver.resolve({
  assessment: {
    id: assessment.id,
    defaultTools: ['ruler']
  },
  student: {
    id: 'student-123',
    accommodations: {
      textToSpeech: true
    },
    preferences: {
      preferredTheme: { fontSize: 18 }
    }
  }
});

const player = new AssessmentPlayer({
  assessment,
  loadItem,
  contextProfile: profile
});
```

### Example 2: IEP Requirements

```typescript
const resolver = new DefaultProfileResolver();
const profile = await resolver.resolve({
  assessment: { id: assessment.id },
  student: {
    id: studentId,
    iep: {
      requiredTools: ['textToSpeech', 'highlighter'],
      themeRequirements: {
        fontSize: 18,
        highContrast: true
      }
    }
  }
});

const player = new AssessmentPlayer({
  assessment,
  loadItem,
  contextProfile: profile
});

// IEP requirements are automatically enforced
console.log(player.isToolRequired('textToSpeech')); // true
```

### Example 3: District Policies

```typescript
const resolver = new DefaultProfileResolver();
const profile = await resolver.resolve({
  assessment: { id: assessment.id },
  student: { id: studentId },
  district: {
    id: 'district-001',
    blockedTools: ['calculator'], // Block calculators on state tests
    policies: {
      stateTest: true
    }
  }
});

// District blocks override everything else
const player = new AssessmentPlayer({
  assessment,
  loadItem,
  contextProfile: profile
});
```

### Example 4: Item-Specific Requirements

```typescript
const profile = await resolver.resolve({
  assessment: { id: assessment.id },
  student: { id: studentId },
  item: {
    id: 'question-789',
    requiredTools: ['graphing-calculator'], // Item requires graphing calc
    restrictedTools: ['ruler'] // Block ruler for this item
  }
});

const player = new AssessmentPlayer({
  assessment,
  loadItem,
  contextProfile: profile
});
```

## Core Concepts

### AssessmentContextProfile

An opaque profile object containing **resolved decisions**:

```typescript
interface AssessmentContextProfile {
  profileId: string;
  assessmentId: string;
  studentId?: string;

  // Resolved decisions (not the inputs)
  tools: ResolvedToolSet;
  theme: ResolvedThemeConfig;
  layout: ResolvedLayoutPreferences;
  accessibility?: ResolvedAccessibilitySettings;

  // Optional debugging/audit trail
  metadata?: ProfileMetadata;
}
```

### Resolution Precedence (Default Resolver)

The default resolver uses this precedence (highest to lowest):

1. **District block** - Absolute veto
2. **Administration override** - Per-administration settings
3. **Item restriction** - Item-specific blocks
4. **Item requirement** - Item requires the tool
5. **Student IEP/504** - Legal requirements
6. **Student accommodation** - Student preferences/needs
7. **Assessment default** - Assessment-level settings
8. **System default** - Framework defaults

## Advanced Features

### Resolution Traces

Profiles include optional resolution traces for debugging:

```typescript
const profile = await resolver.resolve(context);

// Check how a specific tool was resolved
const trace = profile.tools.resolutionTrace?.get('calculator');
if (trace) {
  console.log('Decision:', trace.decision); // 'allowed' | 'blocked' | 'required'
  console.log('Reasons:', trace.reasons); // Array of explanation strings
  console.log('Sources:', trace.sources); // Array of configuration sources
  console.log('Precedence:', trace.precedenceOrder); // Resolution order
}
```

### Profile Caching

```typescript
class ProfileCache {
  private cache = new Map<string, AssessmentContextProfile>();

  async getOrCreateProfile(
    resolver: ProfileResolver,
    context: ResolutionContext
  ): Promise<AssessmentContextProfile> {
    const cacheKey = `${context.assessment.id}-${context.student?.id || 'anon'}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const profile = await resolver.resolve(context);
    this.cache.set(cacheKey, profile);
    return profile;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage
const cache = new ProfileCache();
const profile = await cache.getOrCreateProfile(resolver, context);
```

### Item-Specific Resolution

When navigating between items, re-resolve with item context:

```typescript
async function onItemChanged(itemId: string) {
  const currentItem = await loadItem(itemId);

  // Re-resolve profile with item context
  const profile = await resolver.resolve({
    assessment: { id: 'test-123' },
    student: { id: 'student-456', accommodations: { calculator: true } },
    item: {
      id: itemId,
      requiredTools: currentItem.requiredTools,
      restrictedTools: currentItem.restrictedTools
    }
  });

  // Create new player with updated profile
  // (Current implementation doesn't support dynamic profile updates)
}
```

## Testing

### Mock Profiles

```typescript
import type { AssessmentContextProfile } from '@pie-framework/pie-assessment-toolkit';

function createMockProfile(
  overrides?: Partial<AssessmentContextProfile>
): AssessmentContextProfile {
  return {
    profileId: 'mock-profile',
    assessmentId: 'mock-assessment',
    tools: {
      available: [
        { toolId: 'calculator', enabled: true },
        { toolId: 'ruler', enabled: true }
      ]
    },
    theme: {
      colorScheme: 'default',
      fontSize: 16
    },
    layout: {},
    ...overrides
  };
}

// Use in tests
test('player respects required tools', () => {
  const profile = createMockProfile({
    tools: {
      available: [
        { toolId: 'calculator', enabled: true, required: true }
      ]
    }
  });

  const player = new AssessmentPlayer({
    assessment: mockAssessment,
    loadItem: mockLoader,
    contextProfile: profile
  });

  expect(player.isToolRequired('calculator')).toBe(true);
});
```

## API Reference

### AssessmentPlayer

#### Configuration

```typescript
interface ReferencePlayerConfig {
  assessment: AssessmentEntity;
  loadItem: LoadItem;

  // Profile-based configuration
  contextProfile?: AssessmentContextProfile;

  // Other config...
}
```

#### Profile Methods

```typescript
class AssessmentPlayer {
  // Get current profile
  getContextProfile(): AssessmentContextProfile | null;

  // Query tools
  getAvailableTools(): ToolAvailability[];
  isToolEnabled(toolId: string): boolean;
  isToolRequired(toolId: string): boolean;
  getToolConfig(toolId: string): any | undefined;

  // Get layout preferences
  getLayoutPreferences(): any;
}
```

### ProfileResolver Interface

```typescript
interface ProfileResolver {
  resolve(context: ResolutionContext): Promise<AssessmentContextProfile>;

  // Optional partial resolution methods
  resolveTools?(context: ResolutionContext): Promise<ResolvedToolSet>;
  resolveTheme?(context: ResolutionContext): Promise<ResolvedThemeConfig>;
  resolveLayout?(context: ResolutionContext): Promise<ResolvedLayoutPreferences>;
}
```

### DefaultProfileResolver

```typescript
class DefaultProfileResolver implements ProfileResolver {
  // Main resolution method
  resolve(context: ResolutionContext): Promise<AssessmentContextProfile>;

  // Partial resolution methods
  resolveTools(context: ResolutionContext): Promise<ResolvedToolSet>;
  resolveTheme(context: ResolutionContext): Promise<ResolvedThemeConfig>;
  resolveLayout(context: ResolutionContext): Promise<ResolvedLayoutPreferences>;

  // Override these for custom logic
  protected resolveToolAvailability(toolId: string, context: ResolutionContext): ToolResolution;
  protected buildToolConfig(toolId: string, context: ResolutionContext): ToolSpecificConfig | undefined;
  protected collectAllToolIds(context: ResolutionContext): Set<string>;
}
```

## FAQ

### Q: Do I need to use profiles?

**A:** Yes, if you need to configure tools, themes, or accommodations. The profile system is the recommended way to configure the assessment player.

### Q: Can I use the player without a profile?

**A:** Yes, but you won't have any tools or custom configuration. The profile is optional but recommended for most use cases.

### Q: How do I handle item-specific resolution?

**A:** Include the item in your resolution context when navigating:
```typescript
const profile = await resolver.resolve({
  assessment: { id: 'test' },
  student: { id: 'student' },
  item: { id: 'question-1', requiredTools: ['calculator'] }
});
```

### Q: Can I cache profiles?

**A:** Yes! Profiles are plain objects that can be cached for performance.

### Q: What if my resolution logic is async (calls APIs)?

**A:** The `resolve()` method is already async. Make your custom resolver methods async as needed.

### Q: How do I integrate with external policy engines?

**A:** Implement ProfileResolver from scratch:
```typescript
class PolicyEngineResolver implements ProfileResolver {
  async resolve(context) {
    const policyDecision = await this.policyEngineClient.evaluate(context);
    return this.convertToProfile(policyDecision);
  }
}
```

## Support

For questions or issues:
- GitHub Issues: https://github.com/pie-framework/pie-players/issues
- Documentation: `/packages/assessment-toolkit/src/profile/README.md`
- Examples: `/packages/assessment-toolkit/src/profile/examples.ts`
