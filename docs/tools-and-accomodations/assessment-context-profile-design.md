# Assessment Context & Profile Design

**Version**: 1.0
**Date**: 2026-01-08
**Status**: Proposal

## Executive Summary

This document proposes a flexible, extensible **Assessment Context Profile** system that abstracts away the complexity of accommodation resolution while providing clear contracts for framework components. The design separates **policy** (how decisions are made) from **mechanism** (how components consume those decisions).

---

## Problem Statement

### Current Challenges

The current accommodation resolution system hardcodes specific concepts:

```typescript
// Current approach - hardcoded precedence
resolveToolsForItem(
  student: AccommodationProfile,
  roster: RosterToolConfiguration,
  item: ItemToolConfig
): ResolvedToolConfig[]
```

**Limitations:**

1. **Fixed precedence**: Roster > Item > Student > Default
2. **Limited to 3 sources**: Doesn't accommodate district settings, administration config, learning objectives, accessibility requirements, etc.
3. **Tool-centric**: Doesn't handle layout preferences, theme preferences, language, or other context
4. **Hard to extend**: Adding new decision factors requires framework changes
5. **Opaque**: Product code can't inspect or override resolution logic

### Real-World Complexity

In production assessment systems, tool/accommodation availability depends on:

- **Student IEP/504 plan**: Legal accommodation requirements
- **District policies**: District-wide tool restrictions (e.g., no calculator for certain grades)
- **Assessment template**: Author-defined tool requirements/restrictions
- **Assessment administration**: Specific test instance settings (e.g., practice vs. summative)
- **Item configuration**: Item-specific requirements (e.g., calculator required for this math problem)
- **Learning objectives**: Skills being assessed (e.g., no spell-check for writing assessment)
- **Security level**: High-stakes vs. formative (affects screen capture, copy/paste)
- **Time/date**: Tools may be enabled/disabled based on test window
- **Student performance**: Adaptive accommodations based on struggle patterns
- **Legal/compliance**: State testing requirements, accessibility laws

### Architectural Goal

**We want PIE to be steered by decisions made elsewhere, without getting into the business of making those decisions.**

---

## Proposed Solution: Assessment Context Profile

### Core Concept

Introduce an **opaque context object** that product code populates, and framework components consume:

```typescript
/**
 * AssessmentContextProfile
 *
 * An opaque profile object that encapsulates ALL decision-making about:
 * - Which tools are available
 * - Which layout should be used
 * - What theme/accessibility settings apply
 * - Any other contextual configuration
 *
 * Framework components consume this profile WITHOUT knowing how decisions were made.
 */
interface AssessmentContextProfile {
  // Identity
  profileId: string;
  studentId?: string;
  assessmentId: string;
  administrationId?: string;

  // Resolved decisions (NOT the inputs that led to these decisions)
  tools: ResolvedToolSet;
  theme: ResolvedThemeConfig;
  layout: ResolvedLayoutPreferences;

  // Optional: Debugging/audit trail
  metadata?: ProfileMetadata;
}
```

### Key Design Principles

#### 1. Separation of Policy and Mechanism

**Policy** (Product responsibility):
- How to resolve tool availability
- How to merge district/IEP/item/administration settings
- What precedence rules apply
- How to handle conflicts

**Mechanism** (Framework responsibility):
- Consume resolved decisions
- Render appropriate UI
- Coordinate tool lifecycle
- Enforce resolved configuration

#### 2. Opaque Resolution

The framework **does NOT care** how the profile was created:

```typescript
// Product code: Complex decision-making
const profile = await myComplexResolver.resolve({
  student: await getStudentWithIEP(studentId),
  district: await getDistrictPolicies(districtId),
  assessment: assessmentTemplate,
  administration: testInstance,
  item: currentItem,
  legalRequirements: await getStateTestingRules(state),
  learningObjectives: item.objectives,
  securityLevel: administration.securityLevel,
  // ... whatever else product needs
});

// Framework: Just consumes the result
const sessionManager = new AssessmentSessionManager({
  assessment,
  loadItem,
  contextProfile: profile  // Opaque to framework
});
```

#### 3. Type-Safe Contracts

Each resolved decision has a clear contract:

```typescript
interface ResolvedToolSet {
  available: ToolAvailability[];
  // Optional: Why each tool is available/restricted (for debugging/transparency)
  resolutionTrace?: Map<string, ResolutionExplanation>;
}

interface ToolAvailability {
  toolId: string;
  enabled: boolean;
  required?: boolean;        // Must be used (e.g., item requires calculator)
  alwaysAvailable?: boolean; // Cannot be toggled off (e.g., IEP requirement)
  restricted?: boolean;      // Explicitly blocked (e.g., district policy)
  config?: ToolSpecificConfig;
}
```

---

## Architecture

### Component Interaction

```
┌──────────────────────────────────────────────────────┐
│  Product-Specific Resolution Service                 │
│  (Complex business logic - NOT in PIE framework)     │
│                                                       │
│  - Fetches student IEP, district policies, etc.      │
│  - Applies precedence rules                          │
│  - Resolves conflicts                                │
│  - Creates AssessmentContextProfile                  │
└──────────────────────────────────────────────────────┘
                        ↓ Produces
┌──────────────────────────────────────────────────────┐
│         AssessmentContextProfile                     │
│  (Opaque profile object - PIE interface)             │
│                                                       │
│  tools: { available: [...], resolutionTrace: ... }   │
│  theme: { highContrast: true, fontSize: 1.2 }        │
│  layout: { preferredTemplate: 'two-column' }         │
└──────────────────────────────────────────────────────┘
                        ↓ Consumed by
┌──────────────────────────────────────────────────────┐
│       AssessmentSessionManager                       │
│  (PIE framework component)                           │
│                                                       │
│  - Reads contextProfile.tools.available              │
│  - Applies contextProfile.theme                      │
│  - Passes tool config to ToolCoordinator             │
│  - Enforces "required" and "alwaysAvailable" rules   │
└──────────────────────────────────────────────────────┘
                        ↓ Uses
┌──────────────────────────────────────────────────────┐
│         LayoutEngine                                 │
│  (PIE framework component)                           │
│                                                       │
│  - Reads contextProfile.layout.preferredTemplate     │
│  - Selects appropriate layout template               │
└──────────────────────────────────────────────────────┘
```

### Profile Structure

```typescript
/**
 * Complete AssessmentContextProfile interface
 */
export interface AssessmentContextProfile {
  // ===== IDENTITY =====
  profileId: string;           // Unique profile identifier
  studentId?: string;          // Optional student identifier
  assessmentId: string;        // Assessment template ID
  administrationId?: string;   // Specific test instance ID
  itemId?: string;            // Current item (if item-specific)

  // ===== RESOLVED TOOLS =====
  tools: ResolvedToolSet;

  // ===== RESOLVED THEME =====
  theme: ResolvedThemeConfig;

  // ===== RESOLVED LAYOUT =====
  layout: ResolvedLayoutPreferences;

  // ===== RESOLVED ACCESSIBILITY =====
  accessibility?: ResolvedAccessibilityConfig;

  // ===== METADATA (Optional - for debugging/audit) =====
  metadata?: ProfileMetadata;
}

/**
 * Resolved tool set with availability information
 */
export interface ResolvedToolSet {
  // List of available tools with configuration
  available: ToolAvailability[];

  // Optional: Explanation of resolution process (for debugging/transparency)
  resolutionTrace?: Map<string, ResolutionExplanation>;
}

/**
 * Tool availability and configuration
 */
export interface ToolAvailability {
  toolId: string;
  enabled: boolean;

  // Tool enforcement level
  required?: boolean;        // Must be used (item requirement)
  alwaysAvailable?: boolean; // Cannot be toggled off (IEP/504)
  restricted?: boolean;      // Explicitly blocked (district policy)

  // Tool-specific configuration
  config?: ToolSpecificConfig;

  // UI hints
  preOpen?: boolean;         // Open tool automatically
  hint?: string;            // Guidance for students
}

/**
 * Tool-specific configuration (extensible)
 */
export interface ToolSpecificConfig {
  // Calculator
  calculatorType?: 'basic' | 'scientific' | 'graphing' | 'ti-84' | 'ti-108';
  calculatorMode?: 'degree' | 'radian';

  // TTS
  ttsVoice?: string;
  ttsRate?: number;
  ttsHighlightWords?: boolean;

  // Ruler
  rulerUnits?: 'inches' | 'centimeters' | 'both';

  // Answer Eliminator
  eliminatorStrategy?: 'strikethrough' | 'hide' | 'gray-out';
  eliminatorButtonPlacement?: 'left' | 'right' | 'inline';

  // Generic extensibility
  [key: string]: any;
}

/**
 * Resolved theme configuration
 */
export interface ResolvedThemeConfig {
  // Color scheme
  colorScheme?: 'default' | 'high-contrast' | 'dark' | 'custom';
  backgroundColor?: string;
  textColor?: string;

  // Typography
  fontSize?: number;          // Scale factor (1.0 = 100%)
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;

  // High contrast mode
  highContrast?: boolean;

  // Reduced motion
  reducedMotion?: boolean;

  // Custom CSS variables
  customVariables?: Record<string, string>;
}

/**
 * Resolved layout preferences
 */
export interface ResolvedLayoutPreferences {
  // Template selection
  preferredTemplate?: string;  // Suggested template ID
  allowTemplateSelection?: boolean;  // Can student choose layout?

  // Responsive behavior
  mobileOptimized?: boolean;
  tabletOptimized?: boolean;

  // Region preferences
  regionSizes?: Record<string, RegionSize>;  // Initial sizes for resizable regions

  // Experimental
  customLayoutConfig?: Record<string, any>;
}

/**
 * Region sizing
 */
export interface RegionSize {
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  flex?: number;
}

/**
 * Resolved accessibility configuration
 */
export interface ResolvedAccessibilityConfig {
  // Screen reader
  screenReaderOptimized?: boolean;
  ariaLive?: 'off' | 'polite' | 'assertive';

  // Keyboard navigation
  keyboardNavigationEnhanced?: boolean;
  focusIndicatorEnhanced?: boolean;

  // Alternative content
  altTextMode?: 'standard' | 'extended' | 'detailed';
  mathRendering?: 'mathml' | 'svg' | 'aria';

  // Timing
  extendedTime?: number;      // Multiplier (1.5 = 150% time)
  untimed?: boolean;

  // Content modifications
  simplifiedLanguage?: boolean;
  reducedStimuli?: boolean;
}

/**
 * Resolution explanation (for debugging/transparency)
 */
export interface ResolutionExplanation {
  toolId: string;
  decision: 'allowed' | 'required' | 'blocked' | 'restricted';
  reasons: string[];          // Human-readable explanations
  sources: string[];          // Which configs contributed (e.g., "IEP", "District Policy")
  appliedRules?: string[];    // Rule IDs that were evaluated
  overrides?: Override[];     // Any overrides applied
}

/**
 * Override information
 */
export interface Override {
  source: string;             // What overrode (e.g., "District Policy")
  originalValue: any;
  newValue: any;
  reason: string;
}

/**
 * Profile metadata (for debugging/audit)
 */
export interface ProfileMetadata {
  createdAt: Date;
  createdBy?: string;         // Service/user that created profile
  version: string;            // Profile schema version

  // Audit trail
  inputSources?: string[];    // Which configs were consulted
  rulesApplied?: string[];    // Which policy rules were applied

  // Cache info
  cacheable?: boolean;
  cacheKey?: string;
  ttl?: number;              // Seconds until profile should be refreshed

  // Custom metadata
  [key: string]: any;
}
```

---

## Reference Resolver Implementation

PIE provides a **default implementation** that products can use as-is or as a starting point:

```typescript
/**
 * DefaultProfileResolver
 *
 * A simple, extensible resolver that implements common precedence patterns.
 * Products can use this directly, extend it, or implement their own resolver.
 */
export class DefaultProfileResolver implements ProfileResolver {
  /**
   * Resolve profile for an assessment session
   */
  async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
    const tools = await this.resolveTools(context);
    const theme = await this.resolveTheme(context);
    const layout = await this.resolveLayout(context);
    const accessibility = await this.resolveAccessibility(context);

    return {
      profileId: this.generateProfileId(context),
      studentId: context.student?.id,
      assessmentId: context.assessment.id,
      administrationId: context.administration?.id,
      tools,
      theme,
      layout,
      accessibility,
      metadata: {
        createdAt: new Date(),
        createdBy: 'DefaultProfileResolver',
        version: '1.0',
        inputSources: this.getInputSources(context),
      }
    };
  }

  /**
   * Resolve tool availability
   *
   * Default precedence:
   * 1. District block (highest)
   * 2. Administration override
   * 3. Item restriction
   * 4. Item requirement
   * 5. Student IEP/504
   * 6. Student accommodation profile
   * 7. Assessment default
   * 8. System default (lowest)
   */
  protected async resolveTools(context: ResolutionContext): Promise<ResolvedToolSet> {
    const available: ToolAvailability[] = [];
    const resolutionTrace = new Map<string, ResolutionExplanation>();

    // Collect all tool IDs mentioned anywhere
    const allToolIds = this.collectToolIds(context);

    for (const toolId of allToolIds) {
      const resolution = this.resolveToolAvailability(toolId, context);

      if (resolution.enabled) {
        available.push({
          toolId,
          enabled: true,
          required: resolution.required,
          alwaysAvailable: resolution.alwaysAvailable,
          restricted: false,
          config: resolution.config,
          preOpen: resolution.preOpen,
          hint: resolution.hint,
        });
      }

      resolutionTrace.set(toolId, resolution.explanation);
    }

    return { available, resolutionTrace };
  }

  /**
   * Resolve individual tool (override point for custom logic)
   */
  protected resolveToolAvailability(
    toolId: string,
    context: ResolutionContext
  ): ToolResolution {
    const reasons: string[] = [];
    const sources: string[] = [];

    // 1. District block
    if (context.district?.blockedTools?.includes(toolId)) {
      return {
        enabled: false,
        required: false,
        alwaysAvailable: false,
        explanation: {
          toolId,
          decision: 'blocked',
          reasons: ['Blocked by district policy'],
          sources: ['District Policy'],
        }
      };
    }

    // 2. Administration override
    if (context.administration?.toolOverrides?.[toolId]?.blocked) {
      return {
        enabled: false,
        required: false,
        alwaysAvailable: false,
        explanation: {
          toolId,
          decision: 'blocked',
          reasons: ['Blocked by test administration'],
          sources: ['Test Administration'],
        }
      };
    }

    // 3. Item restriction
    if (context.item?.restrictedTools?.includes(toolId)) {
      reasons.push('Restricted for this specific item');
      sources.push('Item Configuration');
      return {
        enabled: false,
        required: false,
        alwaysAvailable: false,
        explanation: { toolId, decision: 'restricted', reasons, sources }
      };
    }

    // 4. Item requirement
    if (context.item?.requiredTools?.includes(toolId)) {
      reasons.push('Required for this item');
      sources.push('Item Configuration');
      return {
        enabled: true,
        required: true,
        alwaysAvailable: false,
        config: context.item?.toolParameters?.[toolId]?.config,
        preOpen: context.item?.toolParameters?.[toolId]?.preOpen,
        hint: context.item?.toolParameters?.[toolId]?.hint,
        explanation: { toolId, decision: 'required', reasons, sources }
      };
    }

    // 5. Student IEP/504
    if (context.student?.iep?.requiredAccommodations?.includes(toolId)) {
      reasons.push('Required by IEP/504 plan');
      sources.push('IEP/504');
      return {
        enabled: true,
        required: false,
        alwaysAvailable: true,  // IEP accommodations cannot be turned off
        config: context.student?.iep?.toolConfigs?.[toolId],
        explanation: { toolId, decision: 'allowed', reasons, sources }
      };
    }

    // 6. Student accommodation profile
    if (context.student?.accommodations?.[toolId] === true) {
      reasons.push('Enabled via student accommodation profile');
      sources.push('Student Profile');
      return {
        enabled: true,
        required: false,
        alwaysAvailable: false,
        config: context.student?.toolConfigs?.[toolId],
        explanation: { toolId, decision: 'allowed', reasons, sources }
      };
    }

    // 7. Assessment default
    if (context.assessment?.defaultTools?.includes(toolId)) {
      reasons.push('Enabled by assessment default');
      sources.push('Assessment Configuration');
      return {
        enabled: true,
        required: false,
        alwaysAvailable: false,
        config: context.assessment?.toolConfigs?.[toolId],
        explanation: { toolId, decision: 'allowed', reasons, sources }
      };
    }

    // 8. System default (not allowed)
    return {
      enabled: false,
      required: false,
      alwaysAvailable: false,
      explanation: {
        toolId,
        decision: 'blocked',
        reasons: ['Not configured in any source'],
        sources: ['System Default'],
      }
    };
  }

  // Similar methods for theme, layout, accessibility...
}

/**
 * Resolution context input
 */
export interface ResolutionContext {
  // Core entities
  student?: StudentContext;
  assessment: AssessmentContext;
  administration?: AdministrationContext;
  item?: ItemContext;
  district?: DistrictContext;

  // Additional context
  timestamp?: Date;
  deviceInfo?: DeviceInfo;
  sessionInfo?: SessionInfo;

  // Extensibility
  custom?: Record<string, any>;
}

/**
 * Student context (provided by product)
 */
export interface StudentContext {
  id: string;
  accommodations?: Record<string, boolean>;
  toolConfigs?: Record<string, ToolSpecificConfig>;
  iep?: IEPContext;
  languagePreference?: string;
  devicePreferences?: DevicePreferences;
}

/**
 * IEP/504 context
 */
export interface IEPContext {
  active: boolean;
  requiredAccommodations: string[];
  toolConfigs?: Record<string, ToolSpecificConfig>;
  themeRequirements?: Partial<ResolvedThemeConfig>;
}

/**
 * District context (provided by product)
 */
export interface DistrictContext {
  id: string;
  blockedTools?: string[];
  requiredTools?: string[];
  defaultTheme?: Partial<ResolvedThemeConfig>;
  policies?: Record<string, any>;
}

/**
 * Assessment context (from assessment template)
 */
export interface AssessmentContext {
  id: string;
  defaultTools?: string[];
  toolConfigs?: Record<string, ToolSpecificConfig>;
  theme?: Partial<ResolvedThemeConfig>;
  layoutPreference?: string;
}

/**
 * Administration context (specific test instance)
 */
export interface AdministrationContext {
  id: string;
  toolOverrides?: Record<string, { blocked?: boolean; config?: ToolSpecificConfig }>;
  themeOverride?: Partial<ResolvedThemeConfig>;
  securityLevel?: 'practice' | 'formative' | 'summative' | 'high-stakes';
}

/**
 * Item context (current question)
 */
export interface ItemContext {
  id: string;
  requiredTools?: string[];
  restrictedTools?: string[];
  toolParameters?: Record<string, ItemToolParameters>;
}
```

---

## Usage Examples

### Example 1: Simple - Use Reference Resolver

```typescript
import { DefaultProfileResolver } from '@pie-framework/pie-assessment-toolkit';

const resolver = new DefaultProfileResolver();

const profile = await resolver.resolve({
  student: {
    id: 'S123',
    accommodations: { textToSpeech: true, calculator: true }
  },
  assessment: {
    id: 'A456',
    defaultTools: ['ruler', 'protractor']
  },
  item: {
    id: 'Q789',
    requiredTools: ['calculator']
  }
});

const sessionManager = new AssessmentSessionManager({
  assessment,
  loadItem,
  contextProfile: profile
});
```

### Example 2: Custom Resolver - District-Specific Logic

```typescript
class MyDistrictProfileResolver extends DefaultProfileResolver {
  /**
   * Override tool resolution to add district-specific logic
   */
  protected resolveToolAvailability(
    toolId: string,
    context: ResolutionContext
  ): ToolResolution {
    // Custom logic: Block calculators for grade 3 math
    if (toolId === 'calculator' &&
        context.student?.grade === 3 &&
        context.assessment?.subject === 'math') {
      return {
        enabled: false,
        required: false,
        alwaysAvailable: false,
        explanation: {
          toolId,
          decision: 'blocked',
          reasons: ['District policy: No calculators for 3rd grade math'],
          sources: ['District Policy'],
        }
      };
    }

    // Custom logic: Auto-enable text-to-speech for ELL students
    if (toolId === 'textToSpeech' && context.student?.ell === true) {
      return {
        enabled: true,
        required: false,
        alwaysAvailable: true,
        explanation: {
          toolId,
          decision: 'allowed',
          reasons: ['Auto-enabled for English Language Learners'],
          sources: ['District ELL Policy'],
        }
      };
    }

    // Fall back to standard resolution
    return super.resolveToolAvailability(toolId, context);
  }
}
```

### Example 3: Fully Custom Resolver

```typescript
class MyComplexResolver implements ProfileResolver {
  async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
    // Fetch data from multiple services
    const [iepData, districtPolicies, stateRules, learningObjectives] = await Promise.all([
      this.iepService.getStudentIEP(context.student.id),
      this.districtService.getPolicies(context.district.id),
      this.stateService.getTestingRules(context.assessment.state),
      this.objectivesService.getObjectives(context.item.id),
    ]);

    // Custom resolution logic
    const tools = await this.complexToolResolution({
      iepData,
      districtPolicies,
      stateRules,
      learningObjectives,
      context,
    });

    return {
      profileId: uuidv4(),
      studentId: context.student.id,
      assessmentId: context.assessment.id,
      tools,
      theme: this.resolveTheme(context, iepData),
      layout: this.resolveLayout(context),
      metadata: {
        createdAt: new Date(),
        createdBy: 'MyComplexResolver',
        version: '2.1',
        inputSources: ['IEP', 'District', 'State', 'Learning Objectives'],
      }
    };
  }
}
```

### Example 4: Profile Caching

```typescript
class CachedProfileResolver implements ProfileResolver {
  constructor(
    private innerResolver: ProfileResolver,
    private cache: ProfileCache
  ) {}

  async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
    const cacheKey = this.buildCacheKey(context);

    const cached = await this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    const profile = await this.innerResolver.resolve(context);
    await this.cache.set(cacheKey, profile, { ttl: 3600 });

    return profile;
  }
}
```

---

## Framework Consumption

### AssessmentSessionManager Integration

```typescript
export interface AssessmentSessionManagerConfig {
  assessment: AssessmentEntity;
  loadItem: LoadItem;

  // NEW: Profile-based configuration
  contextProfile?: AssessmentContextProfile;

  // DEPRECATED: Legacy individual configs (for backward compatibility)
  mode?: 'gather' | 'view' | 'evaluate' | 'author';
  role?: 'student' | 'instructor';
  // ... other legacy props
}

export class AssessmentSessionManager {
  private contextProfile: AssessmentContextProfile | null = null;

  constructor(config: AssessmentSessionManagerConfig) {
    this.contextProfile = config.contextProfile || null;

    // Apply profile-based configuration
    if (this.contextProfile) {
      this.applyContextProfile(this.contextProfile);
    }
  }

  private applyContextProfile(profile: AssessmentContextProfile): void {
    // Apply theme
    if (profile.theme && this.themeProvider) {
      this.themeProvider.applyTheme(profile.theme);
    }

    // Configure tools
    this.availableTools = profile.tools.available.map(t => ({
      toolId: t.toolId,
      enabled: t.enabled,
      required: t.required || false,
      alwaysAvailable: t.alwaysAvailable || false,
      config: t.config,
    }));

    // Store layout preferences (for layout engine)
    this.layoutPreferences = profile.layout;
  }

  /**
   * Get tools available for current context
   */
  getAvailableTools(): ToolAvailability[] {
    return this.availableTools;
  }

  /**
   * Check if tool is required (cannot be disabled)
   */
  isToolRequired(toolId: string): boolean {
    const tool = this.availableTools.find(t => t.toolId === toolId);
    return tool?.required || tool?.alwaysAvailable || false;
  }

  /**
   * Get resolution explanation for debugging
   */
  getToolResolutionExplanation(toolId: string): ResolutionExplanation | null {
    return this.contextProfile?.tools.resolutionTrace?.get(toolId) || null;
  }
}
```

### LayoutEngine Integration

```typescript
export class LayoutEngine {
  selectTemplate(context: LayoutContext): LayoutTemplate {
    // Check if profile specifies preferred template
    const preferredTemplate = context.layoutPreferences?.preferredTemplate;

    if (preferredTemplate) {
      const template = this.getTemplate(preferredTemplate);
      if (template) {
        return template;
      }
    }

    // Fall back to content-based selection
    return this.contentBasedSelection(context);
  }
}
```

---

## Migration Strategy

### Phase 1: Add Profile Support (Non-Breaking)

- Add `contextProfile` optional parameter to `AssessmentSessionManagerConfig`
- Keep existing accommodation resolver for backward compatibility
- Framework checks: if `contextProfile` provided, use it; else use legacy approach

### Phase 2: Provide Reference Implementation

- Ship `DefaultProfileResolver` in toolkit
- Document migration guide
- Provide examples for common scenarios

### Phase 3: Deprecate Legacy Approach

- Mark old `AccommodationResolverImpl` as deprecated
- Update docs to show profile-based approach as primary
- Provide automated migration tool

### Phase 4: Remove Legacy (Major Version)

- Remove deprecated accommodation resolver
- `contextProfile` becomes required
- Clean up backward compatibility code

---

## Benefits

### For Framework (PIE)

1. **Simplicity**: Framework doesn't need to understand complex policy logic
2. **Extensibility**: Products can add any decision factors without framework changes
3. **Testability**: Profile creation is testable independently of UI
4. **Performance**: Profiles can be pre-computed, cached, CDN-distributed

### For Products

1. **Flexibility**: Full control over resolution logic
2. **Compliance**: Easy to implement district/state-specific rules
3. **Auditability**: Resolution trace provides transparency
4. **Reusability**: Same profile can drive multiple framework instances

### For Students/Educators

1. **Consistency**: Same rules apply across all PIE-based assessments
2. **Transparency**: Explanation of why tools are available/unavailable
3. **Reliability**: Decisions made once, applied consistently

---

## Open Questions

1. **Profile Versioning**: How to handle profile schema evolution?
2. **Real-time Updates**: Should profiles be mutable during assessment?
3. **Profile Distribution**: How to efficiently distribute profiles (API, CDN, embedded)?
4. **Validation**: Should framework validate profiles or trust product input?
5. **Partial Profiles**: Support for item-by-item profile resolution?

---

## Recommendation

**Adopt the AssessmentContextProfile pattern** with these immediate steps:

1. Define core interfaces (this document)
2. Implement default resolver with common patterns
3. Add profile support to AssessmentSessionManager (backward compatible)
4. Document migration guide with examples
5. Gather feedback from production integration

This approach provides maximum flexibility while maintaining clear contracts between product and framework code.
