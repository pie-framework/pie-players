# PNP Third-Party Integration Guide

**Date:** January 28, 2026
**Target Audience:** Third-party assessment player developers
**Purpose:** Using PIE Assessment Toolkit PNP services without AssessmentPlayer

---

## Overview

The PIE Assessment Toolkit's QTI 3.0 Personal Needs Profile (PNP) implementation is designed as **composable services** that can be used independently of the AssessmentPlayer. This guide shows how to integrate PNP support into your own assessment player.

---

## Architecture: Composable Services

The PNP implementation consists of two standalone services:

```typescript
┌─────────────────────────────────────────┐
│  PNPMapper (Pure Functions)             │
│  - Maps PNP support IDs ↔ PIE tool IDs  │
│  - No dependencies                      │
│  - Stateless functions                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  PNPToolResolver (Stateless Class)      │
│  - Resolves tool availability           │
│  - Implements precedence hierarchy      │
│  - No internal state                    │
│  - No AssessmentPlayer dependency       │
└─────────────────────────────────────────┘
```

**Key characteristics:**
- ✅ No singleton dependencies
- ✅ No framework dependencies
- ✅ No AssessmentPlayer dependencies
- ✅ Pure functions and stateless classes
- ✅ Can be instantiated multiple times
- ✅ Thread-safe (no shared mutable state)

---

## Current Implementation Analysis

### ✅ What Works Well for Third-Party Use

#### 1. PNPMapper is Perfect
```typescript
// Pure functions - completely third-party friendly
import {
  mapPNPSupportToToolId,
  mapToolIdToPNPSupport,
  registerCustomPNPMapping,
  getAllPNPSupports,
  isPNPSupportRegistered,
  PNP_TO_PIE_TOOL_MAP,
  PIE_TOOL_TO_PNP_MAP
} from '@pie-framework/assessment-toolkit';

// Use in any context
const toolId = mapPNPSupportToToolId('calculator'); // 'pie-tool-calculator'
```

**Why it works:**
- Pure functions, no state
- No dependencies on other services
- Extensible (registerCustomPNPMapping)
- Simple, focused API

#### 2. PNPToolResolver is Stateless
```typescript
// Stateless class - can be instantiated anywhere
import { PNPToolResolver } from '@pie-framework/assessment-toolkit';

const resolver = new PNPToolResolver();

// No configuration needed, just use it
const tools = resolver.resolveTools(assessment, itemRef);
```

**Why it works:**
- No constructor dependencies
- No internal state
- All inputs passed as method parameters
- Can create multiple instances safely

#### 3. Clean Type Definitions
```typescript
// Types are well-defined and exported
import type {
  ResolvedToolConfig,
  PersonalNeedsProfile,
  AssessmentSettings,
  ItemSettings
} from '@pie-framework/assessment-toolkit';
```

---

## Basic Third-Party Integration

### Example 1: Minimal PNP Support

```typescript
import {
  PNPToolResolver,
  mapPNPSupportToToolId
} from '@pie-framework/assessment-toolkit';

class MyAssessmentPlayer {
  private pnpResolver = new PNPToolResolver();

  async loadAssessment(assessment: QTI3Assessment) {
    // Resolve tools from PNP
    const tools = this.pnpResolver.resolveTools(assessment);

    // Use resolved tools in your player
    tools.forEach(tool => {
      if (tool.enabled) {
        this.registerTool(tool.id, tool.settings);
      }
    });

    // Auto-activate tools from PNP
    const autoActivate = this.pnpResolver.getAutoActivateTools(assessment);
    autoActivate.forEach(toolId => this.activateTool(toolId));
  }

  async renderItem(itemRef: AssessmentItemRef) {
    // Resolve tools for this specific item
    const tools = this.pnpResolver.resolveTools(
      this.currentAssessment,
      itemRef
    );

    // Check if specific tool is allowed for this item
    const calculatorAllowed = tools.find(
      t => t.id === 'pie-tool-calculator'
    )?.enabled;

    this.renderItemUI(itemRef, { calculatorAllowed });
  }
}
```

### Example 2: Custom Tool Mapping

```typescript
import {
  PNPToolResolver,
  registerCustomPNPMapping
} from '@pie-framework/assessment-toolkit';

// Register your custom tools with PNP supports
registerCustomPNPMapping('x-my-periodic-table', 'my-tool-periodic-table');
registerCustomPNPMapping('x-my-graphing', 'my-tool-graphing');

// Now resolver will recognize your custom tools
const resolver = new PNPToolResolver();
const tools = resolver.resolveTools(assessment);

// Your custom tools appear in resolved config
tools.forEach(tool => {
  console.log(tool.id); // Includes 'my-tool-periodic-table', etc.
});
```

### Example 3: Precedence Customization

While the resolver has built-in precedence, you can implement custom logic:

```typescript
import { PNPToolResolver } from '@pie-framework/assessment-toolkit';

class CustomPNPResolver extends PNPToolResolver {
  // Override to add custom precedence logic
  resolveTools(assessment, itemRef) {
    const baseTools = super.resolveTools(assessment, itemRef);

    // Apply your custom rules
    return this.applyCustomPolicies(baseTools, assessment);
  }

  private applyCustomPolicies(tools, assessment) {
    // Example: Your org has special calculator rules
    return tools.map(tool => {
      if (tool.id === 'pie-tool-calculator' && this.isSpecialCase(assessment)) {
        return { ...tool, enabled: false };
      }
      return tool;
    });
  }
}

// Use your custom resolver
const resolver = new CustomPNPResolver();
```

---

## Advanced Integration Patterns

### Pattern 1: Tool Registry System

```typescript
import { PNPToolResolver } from '@pie-framework/assessment-toolkit';

class ToolRegistry {
  private resolver = new PNPToolResolver();
  private registeredTools = new Map<string, ToolHandler>();

  /**
   * Initialize tools based on assessment PNP
   */
  async initialize(assessment: QTI3Assessment) {
    const tools = this.resolver.resolveTools(assessment);

    // Register enabled tools
    for (const tool of tools) {
      if (tool.enabled) {
        await this.loadAndRegisterTool(tool);
      }
    }

    // Auto-activate PNP specified tools
    const autoActivate = this.resolver.getAutoActivateTools(assessment);
    for (const toolId of autoActivate) {
      this.activateTool(toolId);
    }
  }

  /**
   * Update tool availability for specific item
   */
  updateForItem(assessment: QTI3Assessment, itemRef: AssessmentItemRef) {
    const tools = this.resolver.resolveTools(assessment, itemRef);

    // Enable/disable tools based on item requirements
    for (const tool of tools) {
      if (tool.enabled) {
        this.enableTool(tool.id);
      } else {
        this.disableTool(tool.id);
      }

      // Mark required tools (cannot be hidden)
      if (tool.required || tool.alwaysAvailable) {
        this.markAsRequired(tool.id);
      }
    }
  }

  private async loadAndRegisterTool(tool: ResolvedToolConfig) {
    // Your tool loading logic
    const handler = await this.toolLoader.load(tool.id, tool.settings);
    this.registeredTools.set(tool.id, handler);
  }
}
```

### Pattern 2: Dynamic Configuration

```typescript
import { PNPToolResolver } from '@pie-framework/assessment-toolkit';

class DynamicConfigManager {
  private resolver = new PNPToolResolver();

  /**
   * Get tool configuration for current context
   */
  getToolConfig(
    assessment: QTI3Assessment,
    itemRef: AssessmentItemRef,
    toolId: string
  ): ToolSettings | null {
    // Get resolved tools
    const tools = this.resolver.resolveTools(assessment, itemRef);

    // Find specific tool
    const tool = tools.find(t => t.id === toolId);

    if (!tool?.enabled) {
      return null;
    }

    // Merge settings from multiple sources
    return {
      ...this.getDefaultSettings(toolId),
      ...tool.settings,
      required: tool.required,
      alwaysAvailable: tool.alwaysAvailable,
      source: tool.source
    };
  }

  /**
   * Check if tool can be toggled by user
   */
  isToolToggleable(
    assessment: QTI3Assessment,
    itemRef: AssessmentItemRef,
    toolId: string
  ): boolean {
    const tools = this.resolver.resolveTools(assessment, itemRef);
    const tool = tools.find(t => t.id === toolId);

    // Cannot toggle if required or always available (PNP support)
    return tool?.enabled &&
           !tool.required &&
           !tool.alwaysAvailable;
  }
}
```

### Pattern 3: Audit Trail / Debugging

```typescript
import { PNPToolResolver, mapToolIdToPNPSupport } from '@pie-framework/assessment-toolkit';

class PNPAuditor {
  private resolver = new PNPToolResolver();

  /**
   * Generate human-readable explanation of tool availability
   */
  explainToolAvailability(
    assessment: QTI3Assessment,
    itemRef: AssessmentItemRef,
    toolId: string
  ): string {
    const tools = this.resolver.resolveTools(assessment, itemRef);
    const tool = tools.find(t => t.id === toolId);

    if (!tool) {
      // Tool is not available - figure out why
      return this.explainWhyBlocked(assessment, itemRef, toolId);
    }

    // Tool is available - explain source
    const pnpSupport = mapToolIdToPNPSupport(toolId);

    switch (tool.source) {
      case 'pnp':
        return `Enabled by student PNP (support: ${pnpSupport})`;
      case 'district':
        return `Required by district policy`;
      case 'item':
        return `Required for this specific item`;
      case 'settings':
        return `Enabled by assessment settings`;
      default:
        return `Enabled from ${tool.source}`;
    }
  }

  private explainWhyBlocked(
    assessment: QTI3Assessment,
    itemRef: AssessmentItemRef,
    toolId: string
  ): string {
    const settings = assessment.settings as AssessmentSettings;
    const itemSettings = itemRef?.settings as ItemSettings;
    const pnpSupport = mapToolIdToPNPSupport(toolId);

    // Check each blocking condition
    if (settings?.districtPolicy?.blockedTools?.includes(pnpSupport || toolId)) {
      return `Blocked by district policy`;
    }

    if (itemSettings?.restrictedTools?.includes(pnpSupport || toolId)) {
      return `Restricted for this specific item`;
    }

    if (assessment.personalNeedsProfile?.prohibitedSupports?.includes(pnpSupport || '')) {
      return `Prohibited by student PNP`;
    }

    return `Not enabled (not in PNP supports or settings)`;
  }

  /**
   * Generate full audit report
   */
  generateAuditReport(
    assessment: QTI3Assessment,
    itemRef?: AssessmentItemRef
  ): AuditReport {
    const tools = this.resolver.resolveTools(assessment, itemRef);

    return {
      timestamp: new Date(),
      assessmentId: assessment.id,
      itemId: itemRef?.id,
      pnpSupports: assessment.personalNeedsProfile?.supports || [],
      pnpProhibited: assessment.personalNeedsProfile?.prohibitedSupports || [],
      districtBlocked: (assessment.settings as AssessmentSettings)?.districtPolicy?.blockedTools || [],
      districtRequired: (assessment.settings as AssessmentSettings)?.districtPolicy?.requiredTools || [],
      itemRestricted: itemRef?.settings?.restrictedTools || [],
      itemRequired: itemRef?.settings?.requiredTools || [],
      resolvedTools: tools.map(t => ({
        id: t.id,
        enabled: t.enabled,
        source: t.source,
        required: t.required,
        alwaysAvailable: t.alwaysAvailable
      }))
    };
  }
}

interface AuditReport {
  timestamp: Date;
  assessmentId: string;
  itemId?: string;
  pnpSupports: string[];
  pnpProhibited: string[];
  districtBlocked: string[];
  districtRequired: string[];
  itemRestricted: string[];
  itemRequired: string[];
  resolvedTools: Array<{
    id: string;
    enabled: boolean;
    source: string;
    required?: boolean;
    alwaysAvailable?: boolean;
  }>;
}
```

---

## Potential Improvements for Third-Party Use

### Enhancement 1: Explicit Precedence Configuration

**Current:** Precedence is hardcoded in PNPToolResolver

**Improvement:** Allow third-party players to configure precedence

```typescript
// Proposed API
interface PrecedenceConfig {
  order: PrecedenceRule[];
}

type PrecedenceRule =
  | 'district-block'
  | 'test-admin-override'
  | 'item-restriction'
  | 'item-requirement'
  | 'district-requirement'
  | 'pnp-supports';

// Usage
const resolver = new PNPToolResolver({
  precedence: {
    order: [
      'district-block',     // Highest
      'item-restriction',
      'pnp-supports',       // PNP takes precedence over district requirements
      'district-requirement',
      'item-requirement',
      'test-admin-override' // Lowest
    ]
  }
});
```

**Implementation approach:**
- Add optional constructor parameter
- Default to current hardcoded order (backward compatible)
- Use configured order in `resolveSupport()` method

### Enhancement 2: Plugin System for Custom Resolution Logic

**Current:** Must extend class to customize

**Improvement:** Plugin hooks for custom logic

```typescript
// Proposed API
interface ResolutionPlugin {
  name: string;
  priority: number;
  shouldApply: (context: ResolutionContext) => boolean;
  apply: (toolId: string, context: ResolutionContext) => Partial<ResolvedToolConfig> | null;
}

// Usage
const customPlugin: ResolutionPlugin = {
  name: 'my-org-policy',
  priority: 100,
  shouldApply: (ctx) => ctx.assessment.settings?.myOrgPolicy !== undefined,
  apply: (toolId, ctx) => {
    // Custom logic
    if (toolId === 'calculator' && isSpecialCase(ctx)) {
      return { enabled: false, source: 'custom' };
    }
    return null;
  }
};

const resolver = new PNPToolResolver({
  plugins: [customPlugin]
});
```

### Enhancement 3: Batch Resolution with Caching

**Current:** No caching, re-resolves every time

**Improvement:** Optional caching for performance

```typescript
// Proposed API
const resolver = new PNPToolResolver({
  cache: {
    enabled: true,
    ttl: 60000, // Cache for 60 seconds
    maxSize: 100 // Max 100 cached results
  }
});

// Cached resolution
const tools1 = resolver.resolveTools(assessment, itemRef); // Computes
const tools2 = resolver.resolveTools(assessment, itemRef); // Returns cached

// Clear cache when assessment changes
resolver.clearCache();
```

### Enhancement 4: Validation and Warnings

**Current:** Silent fallback for invalid data

**Improvement:** Validation with helpful warnings

```typescript
// Proposed API
const resolver = new PNPToolResolver({
  validation: {
    strict: false,        // Throw errors vs. warnings
    warnUnknownSupports: true,
    warnInvalidSettings: true,
    warnPrecedenceConflicts: true
  },
  onWarning: (warning: ValidationWarning) => {
    console.warn(`PNP Warning: ${warning.message}`, warning.details);
  }
});

// Validation warnings
interface ValidationWarning {
  type: 'unknown-support' | 'invalid-settings' | 'precedence-conflict';
  message: string;
  details: any;
}
```

---

## Recommended Usage Patterns

### ✅ DO: Create Resolver Instance Per Player

```typescript
class MyPlayer {
  private pnpResolver = new PNPToolResolver();

  // Each player instance has its own resolver
}
```

### ✅ DO: Re-resolve on Item Navigation

```typescript
async navigateToItem(itemRef: AssessmentItemRef) {
  // Re-resolve tools for new item context
  const tools = this.pnpResolver.resolveTools(this.assessment, itemRef);
  this.updateToolbar(tools);
}
```

### ✅ DO: Use Helper Methods

```typescript
// Use specific methods for common checks
const calculatorEnabled = this.pnpResolver.isToolEnabled(
  'pie-tool-calculator',
  assessment,
  itemRef
);

const autoActivate = this.pnpResolver.getAutoActivateTools(assessment);
```

### ❌ DON'T: Cache Resolver Results Across Items

```typescript
// DON'T do this
class MyPlayer {
  private cachedTools: ResolvedToolConfig[]; // ❌ Wrong - stale for different items

  // DO this instead
  getCurrentTools(itemRef: AssessmentItemRef): ResolvedToolConfig[] {
    return this.pnpResolver.resolveTools(this.assessment, itemRef);
  }
}
```

### ❌ DON'T: Modify Resolved Config Objects

```typescript
// DON'T mutate resolved tools
const tools = resolver.resolveTools(assessment);
tools[0].enabled = false; // ❌ Wrong - modifies shared object

// DO create new objects if needed
const modifiedTools = tools.map(t => ({
  ...t,
  enabled: myCustomLogic(t)
}));
```

---

## Testing with PNP Services

### Unit Test Example

```typescript
import { PNPToolResolver } from '@pie-framework/assessment-toolkit';

describe('MyPlayer with PNP', () => {
  it('should enable tools from PNP supports', () => {
    const resolver = new PNPToolResolver();

    const assessment = {
      personalNeedsProfile: {
        supports: ['calculator', 'textToSpeech']
      }
    };

    const tools = resolver.resolveTools(assessment);

    expect(tools).toContainEqual(
      expect.objectContaining({
        id: 'pie-tool-calculator',
        enabled: true,
        alwaysAvailable: true,
        source: 'pnp'
      })
    );
  });

  it('should respect district blocks', () => {
    const resolver = new PNPToolResolver();

    const assessment = {
      personalNeedsProfile: {
        supports: ['calculator']
      },
      settings: {
        districtPolicy: {
          blockedTools: ['calculator']
        }
      }
    };

    const tools = resolver.resolveTools(assessment);

    // Calculator blocked despite PNP support
    expect(tools.find(t => t.id === 'pie-tool-calculator')).toBeUndefined();
  });
});
```

---

## Migration from Custom Systems

### If You Have Existing Tool Configuration Logic

```typescript
// Your existing system
class YourExistingPlayer {
  private enabledTools: string[];

  private loadToolConfig(assessment: any) {
    // Your custom logic
    this.enabledTools = this.parseYourConfig(assessment.toolConfig);
  }
}

// Migration to PNP
class YourMigratedPlayer {
  private pnpResolver = new PNPToolResolver();

  private loadToolConfig(assessment: QTI3Assessment) {
    // Use PNP resolver
    const tools = this.pnpResolver.resolveTools(assessment);

    // Convert to your format if needed
    this.enabledTools = tools
      .filter(t => t.enabled)
      .map(t => t.id);

    // Or use resolved tools directly
    this.tools = tools;
  }
}
```

---

## Summary

### Current State: ✅ Already Third-Party Friendly

The PNP implementation is **already well-designed for third-party use**:

- ✅ Stateless classes
- ✅ No singleton dependencies
- ✅ No AssessmentPlayer coupling
- ✅ Simple, focused API
- ✅ Pure functions (PNPMapper)
- ✅ Well-typed interfaces

### Recommended Enhancements (Optional)

For even better third-party experience:

1. **Configurable precedence** - Let players customize rule order
2. **Plugin system** - Hooks for custom resolution logic
3. **Caching** - Optional performance optimization
4. **Validation** - Helpful warnings for invalid data

### Getting Started

```typescript
// Install
npm install @pie-framework/assessment-toolkit

// Import
import {
  PNPToolResolver,
  mapPNPSupportToToolId,
  registerCustomPNPMapping
} from '@pie-framework/assessment-toolkit';

// Use
const resolver = new PNPToolResolver();
const tools = resolver.resolveTools(assessment, itemRef);
```

**That's it!** No other dependencies or setup required.

---

## Support

For questions or issues with PNP integration:

- GitHub Issues: https://github.com/pie-framework/pie-players/issues
- Documentation: https://github.com/pie-framework/pie-players/tree/main/docs

---

**Document Version**: 1.0
**Last Updated**: January 28, 2026
**Target**: Third-party assessment player developers
