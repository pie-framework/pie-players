# Assessment Context Profile System

A flexible, extensible system for resolving assessment configuration based on multiple factors (student accommodations, district policies, item requirements, etc.) without forcing the framework to understand complex policy logic.

## Key Principle: Policy vs. Mechanism

- **Policy** (HOW decisions are made): Product responsibility
- **Mechanism** (HOW components consume decisions): Framework responsibility

The framework provides the mechanism to consume profiles, but products define the policy for creating them.

## Quick Start

### Basic Usage

```typescript
import {
  AssessmentPlayer,
  DefaultProfileResolver
} from '@pie-framework/pie-assessment-toolkit';

// 1. Create resolver
const resolver = new DefaultProfileResolver();

// 2. Resolve profile
const profile = await resolver.resolve({
  assessment: {
    id: 'math-grade-5',
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

// 3. Use profile with player
const player = new AssessmentPlayer({
  assessment: myAssessment,
  loadItem: myItemLoader,
  contextProfile: profile
});

// 4. Query tool availability
console.log(player.isToolEnabled('calculator')); // true
console.log(player.getAvailableTools()); // Array of available tools
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

### ResolutionContext

All inputs that **MAY** influence decisions:

```typescript
interface ResolutionContext {
  // Required
  assessment: AssessmentInput;

  // Optional - depends on what the resolver needs
  student?: StudentInput;
  administration?: AdministrationInput;
  item?: ItemInput;
  district?: DistrictInput;
  organization?: OrganizationInput;

  // Custom inputs (product-specific)
  custom?: Record<string, any>;
}
```

### ProfileResolver

Interface for creating profiles:

```typescript
interface ProfileResolver {
  resolve(context: ResolutionContext): Promise<AssessmentContextProfile>;
}
```

## Usage Patterns

### Pattern 1: Use Reference Resolver

Best for: Standard accommodation patterns

```typescript
const resolver = new DefaultProfileResolver();
const profile = await resolver.resolve({
  assessment: { id: 'test', defaultTools: ['calculator'] },
  student: { id: 'student', accommodations: { tts: true } }
});
```

**Default Precedence:**
1. District block (absolute veto)
2. Administration override
3. Item restriction
4. Item requirement
5. Student IEP/504
6. Student accommodation
7. Assessment default
8. System default

### Pattern 2: Extend Reference Resolver

Best for: Custom rules with mostly standard patterns

```typescript
class MyDistrictResolver extends DefaultProfileResolver {
  protected resolveToolAvailability(
    toolId: string,
    context: ResolutionContext
  ): ToolResolution {
    // Add custom rule
    if (toolId === 'calculator' &&
        context.student?.grade === 3) {
      return {
        enabled: false,
        restricted: true,
        explanation: {
          toolId,
          decision: 'blocked',
          reasons: ['District policy: No calculators for grade 3'],
          sources: ['District Policy']
        }
      };
    }

    // Use standard resolution for everything else
    return super.resolveToolAvailability(toolId, context);
  }
}
```

### Pattern 3: Fully Custom Resolver

Best for: Completely custom logic or external policy engines

```typescript
class ProductSpecificResolver implements ProfileResolver {
  async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
    // Call external API, policy engine, etc.
    const tools = await this.fetchFromPolicyEngine(context);
    const theme = await this.fetchThemeSettings(context);

    return {
      profileId: `custom-${context.assessment.id}`,
      assessmentId: context.assessment.id,
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
}
```

## Advanced Features

### IEP/504 Support

```typescript
const profile = await resolver.resolve({
  assessment: { id: 'test' },
  student: {
    id: 'student',
    iep: {
      requiredTools: ['textToSpeech', 'highlighter'],
      themeRequirements: {
        fontSize: 18,
        highContrast: true
      }
    }
  }
});

// IEP requirements are always available
const tts = profile.tools.available.find(t => t.toolId === 'textToSpeech');
console.log(tts?.alwaysAvailable); // true
```

### Item-Specific Resolution

```typescript
const profile = await resolver.resolve({
  assessment: { id: 'test' },
  student: { id: 'student' },
  item: {
    id: 'question-1',
    requiredTools: ['graphing-calculator'],
    restrictedTools: ['ruler']
  }
});
```

### Resolution Tracing

```typescript
const profile = await resolver.resolve(context);

// Check how a tool was resolved
const trace = profile.tools.resolutionTrace?.get('calculator');
console.log(trace?.decision); // 'allowed' | 'blocked' | 'required'
console.log(trace?.reasons); // ["Tool enabled via student accommodation"]
console.log(trace?.sources); // ["Student Accommodations"]
```

### Profile Caching

```typescript
class ProfileCache {
  private cache = new Map<string, AssessmentContextProfile>();

  async getOrCreateProfile(
    resolver: ProfileResolver,
    context: ResolutionContext
  ): Promise<AssessmentContextProfile> {
    const key = `${context.assessment.id}-${context.student?.id}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const profile = await resolver.resolve(context);
    this.cache.set(key, profile);
    return profile;
  }
}
```

## Testing

### Mock Profiles

```typescript
function createMockProfile(
  overrides?: Partial<AssessmentContextProfile>
): AssessmentContextProfile {
  return {
    profileId: 'mock',
    assessmentId: 'test',
    tools: {
      available: [
        { toolId: 'calculator', enabled: true }
      ]
    },
    theme: { fontSize: 16 },
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

### AssessmentPlayer Profile Methods

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

## Implementation Details

### Core Files

- **[interfaces.ts](./interfaces.ts)** (700+ lines) - Complete type definitions
  - `AssessmentContextProfile` - Opaque profile containing resolved decisions
  - `ProfileResolver` - Interface for creating profiles
  - `ResolutionContext` - All inputs that may influence decisions
  - Input types: `AssessmentInput`, `StudentInput`, `IEPInput`, `Section504Input`, `DistrictInput`, etc.

- **[DefaultProfileResolver.ts](./DefaultProfileResolver.ts)** (400+ lines) - Default implementation
  - 8-level precedence system (District block → System default)
  - Extensible via protected methods
  - Optional resolution tracing

- **[examples.ts](./examples.ts)** (450+ lines) - 9 comprehensive examples
  - Simple usage, IEP/504, district policies, item-specific
  - Custom resolvers (extend and implement from scratch)
  - Profile caching and testing patterns

- **[index.ts](./index.ts)** - Module exports

### Player Integration

The [AssessmentPlayer](../player/AssessmentPlayer.ts) includes profile support:

**New Methods:**

- `getContextProfile()` - Get current profile
- `getAvailableTools()` - Query available tools
- `isToolEnabled(toolId)` - Check if tool is enabled
- `isToolRequired(toolId)` - Check if tool is required
- `getToolConfig(toolId)` - Get tool-specific configuration
- `getLayoutPreferences()` - Get layout preferences

### Documentation

- **[Profile System Design](../../../docs/tools-and-accomodations/assessment-context-profile-design.md)** - Detailed design rationale
- **[Usage Guide](../../../docs/tools-and-accomodations/profile-usage-guide.md)** - Comprehensive usage guide

## Benefits

1. **Separation of Concerns**: Policy logic lives in product code, not framework
2. **Flexibility**: Support any decision factors your product needs
3. **Type Safety**: Clear TypeScript interfaces ensure contract compliance
4. **Testability**: Easy to mock profiles for testing
5. **Extensibility**: Use, extend, or replace default implementation
6. **Debuggability**: Optional resolution traces for debugging
7. **Performance**: Profiles can be cached and reused

## Examples

See [examples.ts](./examples.ts) for comprehensive examples including:
- Simple usage
- IEP/504 accommodations
- District policies
- Item-specific requirements
- Custom resolvers
- Profile caching
- Testing patterns
