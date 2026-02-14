# PNP Configuration Guide

This guide explains how integrators configure tool governance rules using QTI 3.0 Personal Needs Profiles (PNP) and PIE's assessment settings.

## Overview

Tool availability is determined by combining:
1. **Student PNP profile** (QTI 3.0 standard) - Student's documented accessibility needs
2. **District policy** (implementation-specific) - Institutional governance rules
3. **Test administration** (implementation-specific) - Session-level operational control
4. **Item settings** (QTI 3.0 standard) - Per-item requirements/restrictions

## Data Structure Hierarchy

```
AssessmentEntity
├── personalNeedsProfile           # QTI 3.0: Student's PNP profile
│   ├── supports: string[]         # Enabled accessibility features
│   ├── prohibitedSupports: string[]
│   └── activateAtInit: string[]
│
└── settings: AssessmentSettings   # PIE extension
    ├── districtPolicy             # Institutional governance
    │   ├── blockedTools: string[]
    │   └── requiredTools: string[]
    │
    ├── testAdministration         # Session control
    │   ├── mode: "practice" | "test" | "benchmark"
    │   └── toolOverrides: Record<string, boolean>
    │
    └── toolConfigs                # Tool-specific settings
        ├── calculator: {...}
        └── tts: {...}

AssessmentItemRef
└── settings: ItemSettings         # Per-item rules
    ├── requiredTools: string[]
    ├── restrictedTools: string[]
    └── toolParameters: Record<string, any>
```

## Configuration Examples

### 1. Student PNP Profile (QTI 3.0 Standard)

The student's Personal Needs Profile is part of the QTI 3.0 `AssessmentEntity`:

```typescript
const assessment: AssessmentEntity = {
  id: "assessment-123",
  name: "Math Assessment",

  // QTI 3.0: Student's documented accessibility needs
  personalNeedsProfile: {
    // Accessibility features this student is authorized to use
    supports: [
      "textToSpeech",      // QTI 3.0 standard
      "magnification",     // QTI 3.0 standard
      "calculator",        // QTI 3.0 standard
      "highlighting",      // QTI 3.0 standard
      "readingMask"        // QTI 3.0 standard
    ],

    // Features explicitly prohibited for this student
    prohibitedSupports: [
      "answerMasking"      // Not allowed per IEP
    ],

    // Features to auto-activate at assessment start
    activateAtInit: [
      "textToSpeech",
      "magnification"
    ]
  },

  sections: [...]
};
```

**Source**: Typically populated from:
- IEP (Individualized Education Program) documents
- 504 accommodation plans
- Student accessibility profile database
- Parent/student preferences (when allowed)

### 2. District Policy (Institutional Governance)

District policies enforce institutional rules and legal compliance:

```typescript
const assessment: AssessmentEntity = {
  id: "state-test-456",
  name: "State Standardized Math Test",

  personalNeedsProfile: {
    supports: ["calculator", "textToSpeech", "magnification"]
  },

  settings: {
    // District/organization governance rules
    districtPolicy: {
      // Absolute veto: These tools are blocked regardless of PNP
      blockedTools: [
        "calculator"       // State test rule: No calculators on this assessment
      ],

      // Required for all students in this district
      requiredTools: [
        "textToSpeech"     // District mandates TTS for all ELL students
      ],

      // Additional policies (extensible)
      policies: {
        allowTranslation: false,
        proctorRequired: true
      }
    }
  }
};
```

**Source**: Typically configured by:
- District assessment coordinators
- State/provincial testing agencies
- Institutional accessibility offices
- Legal compliance departments

**Precedence**: District blocks override everything, including IEP accommodations (legal requirement trumps individual preference).

### 3. Test Administration (Session Control)

Test administrators can make session-level adjustments:

```typescript
const assessment: AssessmentEntity = {
  id: "class-quiz-789",
  name: "Chapter 5 Quiz",

  personalNeedsProfile: {
    supports: ["calculator", "textToSpeech", "highlighting"]
  },

  settings: {
    testAdministration: {
      // Testing mode
      mode: "test",  // "practice" | "test" | "benchmark"

      // Session-specific overrides
      // Proctor can disable tools due to operational issues
      toolOverrides: {
        "textToSpeech": false,  // TTS disabled - audio equipment broken
        "calculator": true      // Calculator explicitly enabled
      },

      // Testing window
      startDate: "2024-03-15T08:00:00Z",
      endDate: "2024-03-15T10:00:00Z"
    }
  }
};
```

**Source**: Typically set by:
- Test proctors/administrators
- Testing center staff
- Automated testing platform (practice vs. live)
- Session management systems

**Use Cases**:
- Technical issues (TTS audio broken, disable for this session)
- Practice mode (enable all tools for learning)
- Test security (disable features for high-stakes tests)

### 4. Item-Level Settings (Content Requirements)

Content authors can require or restrict tools per item:

```typescript
const itemRef: AssessmentItemRef = {
  identifier: "question-42",
  href: "items/question-42.json",

  settings: {
    // Tools REQUIRED for this specific item
    requiredTools: [
      "calculator",      // Multi-step computation problem
      "graph"           // Graph interpretation required
    ],

    // Tools BLOCKED for this specific item
    restrictedTools: [
      "calculator"      // Mental math question - calculator would invalidate
    ],

    // Item-specific tool configuration
    toolParameters: {
      calculator: {
        type: "basic",                    // Only basic calculator, not scientific
        allowedFunctions: ["+", "-", "*", "/"]
      },
      graph: {
        domain: [-10, 10],
        range: [-10, 10],
        gridEnabled: true
      }
    }
  }
};
```

**Source**: Typically configured by:
- Assessment item authors
- Content development teams
- Subject matter experts
- QTI item bank systems

**Use Cases**:
- Mental math questions (block calculator)
- Graphing problems (require graph tool)
- Formula-heavy items (require calculator)
- Reading comprehension (no TTS to test reading ability)

## Complete Configuration Example

Here's a complete example showing how all levels interact:

```typescript
import {
  createDefaultToolRegistry,
  PNPToolResolver
} from '@pie-players/pie-assessment-toolkit';

// 1. Create tool registry
const toolRegistry = createDefaultToolRegistry();

// 2. Create PNP resolver
const pnpResolver = new PNPToolResolver(toolRegistry);

// 3. Configure assessment with all governance levels
const assessment: AssessmentEntity = {
  id: "spring-2024-ela",
  name: "Spring 2024 ELA Assessment",

  // Student's PNP profile (from IEP/504)
  personalNeedsProfile: {
    supports: [
      "textToSpeech",
      "magnification",
      "highlighting",
      "readingMask",
      "calculator"
    ],
    activateAtInit: ["textToSpeech", "magnification"]
  },

  // District/institutional governance
  settings: {
    districtPolicy: {
      blockedTools: [
        "calculator"  // District blocks calculator on ELA tests
      ],
      requiredTools: [
        "textToSpeech"  // District mandates TTS for all ELL students
      ]
    },

    // Test administration session control
    testAdministration: {
      mode: "test",
      toolOverrides: {
        // Proctor can make session-specific adjustments
      }
    },

    // Tool provider configurations
    toolConfigs: {
      tts: {
        provider: "polly",
        voice: "Matthew",
        rate: 1.0,
        providerOptions: {
          engine: "neural"
        }
      }
    }
  },

  sections: [{
    identifier: "section-1",
    items: [{
      identifier: "item-1",
      href: "items/reading-passage.json",

      // Item-specific rules
      settings: {
        restrictedTools: [
          "textToSpeech"  // Reading comprehension - no TTS
        ]
      }
    }]
  }]
};

// 4. Resolve tools for an item
const currentItem = assessment.sections[0].items[0];
const allowedToolIds = pnpResolver.getAllowedToolIds(assessment, currentItem);

console.log('Allowed tools:', allowedToolIds);
// Output: ["magnification", "highlighting", "readingMask"]
//
// Why?
// - calculator: Blocked by district policy (#1)
// - textToSpeech: Restricted for this item (#3)
// - magnification: Allowed (no restrictions)
// - highlighting: Allowed (no restrictions)
// - readingMask: Allowed (no restrictions)
```

## Precedence Resolution Examples

### Example 1: District Block Wins

```typescript
{
  personalNeedsProfile: {
    supports: ["calculator"]  // Student has calculator in IEP
  },
  settings: {
    districtPolicy: {
      blockedTools: ["calculator"]  // District blocks it anyway
    }
  }
}
// Result: calculator BLOCKED
// District policy (#1) overrides PNP supports (#6)
```

### Example 2: Item Restriction Wins

```typescript
{
  personalNeedsProfile: {
    supports: ["calculator"]  // Student has calculator in IEP
  },
  settings: {
    // No district block
  },
  itemSettings: {
    restrictedTools: ["calculator"]  // Mental math question
  }
}
// Result: calculator BLOCKED for this item only
// Item restriction (#3) overrides PNP supports (#6)
```

### Example 3: Item Requirement Forces Enable

```typescript
{
  personalNeedsProfile: {
    supports: []  // Student doesn't have calculator in PNP
  },
  itemSettings: {
    requiredTools: ["calculator"]  // Complex computation problem
  }
}
// Result: calculator ENABLED for this item
// Item requirement (#4) forces enablement
```

### Example 4: Test Admin Override

```typescript
{
  personalNeedsProfile: {
    supports: ["textToSpeech"]  // Student has TTS in IEP
  },
  settings: {
    testAdministration: {
      toolOverrides: {
        "textToSpeech": false  // Audio equipment broken
      }
    }
  }
}
// Result: textToSpeech BLOCKED for this session
// Test admin override (#2) blocks for operational reasons
```

## Integration Checklist

When integrating the PNP system, ensure you:

### Data Population

- [ ] **PNP Profile**: Load from IEP/504 database
- [ ] **District Policy**: Configure in assessment administration UI
- [ ] **Test Administration**: Set at session creation time
- [ ] **Item Settings**: Author during item development

### API Integration

```typescript
// 1. Create registry and resolver
const registry = createDefaultToolRegistry();
const resolver = new PNPToolResolver(registry);

// 2. Resolve tools for current context
const allowedToolIds = resolver.getAllowedToolIds(assessment, currentItem);

// 3. Create tool context
const context: ItemToolContext = {
  level: "item",
  assessment,
  section,
  itemRef: currentItem,
  item: itemData
};

// 4. Filter by relevance (Pass 2)
const visibleTools = registry.filterVisibleInContext(allowedToolIds, context);

// 5. Render toolbar
<ToolButtonGroup
  {registry}
  {allowedToolIds}
  {context}
  onToolClick={handleToolClick}
/>
```

### Data Sources

Typical data flow:

```
IEP/504 Database
    ↓
personalNeedsProfile.supports
    ↓
PNPToolResolver → allowedToolIds
    ↓
ToolRegistry → visibleTools
    ↓
ToolButtonGroup → rendered buttons
```

### Admin Interfaces

Provide UI for:

1. **District administrators** to configure `districtPolicy`:
   ```typescript
   interface DistrictPolicyEditor {
     blockedTools: string[];     // Select from QTI_STANDARD_ACCESS_FEATURES
     requiredTools: string[];
     policies: Record<string, any>;
   }
   ```

2. **Proctors** to set `testAdministration` overrides:
   ```typescript
   interface TestAdminPanel {
     mode: "practice" | "test" | "benchmark";
     toolOverrides: Record<string, boolean>;  // Per-tool toggles
   }
   ```

3. **Item authors** to configure `itemSettings`:
   ```typescript
   interface ItemSettingsEditor {
     requiredTools: string[];    // Multi-select from available tools
     restrictedTools: string[];  // Multi-select from available tools
     toolParameters: Record<string, any>;
   }
   ```

## Best Practices

1. **Use QTI 3.0 standard features** - Check `QTI_STANDARD_ACCESS_FEATURES` before custom IDs
2. **Document governance rules** - Explain why certain tools are blocked/required
3. **Audit trail** - Log who makes policy decisions and when
4. **Test precedence** - Verify district blocks actually override PNP
5. **Graceful degradation** - Handle missing/invalid tool IDs
6. **User feedback** - Explain to students why a tool isn't available

## Troubleshooting

### "Tool not showing up even though it's in PNP"

Check precedence hierarchy in order:
1. Is it blocked by `districtPolicy.blockedTools`?
2. Is it disabled in `testAdministration.toolOverrides`?
3. Is it in `itemSettings.restrictedTools`?
4. Does the tool's `isVisibleInContext()` return false?

### "Tool showing up when it shouldn't"

Check:
1. Is it in `districtPolicy.requiredTools`?
2. Is it in `itemSettings.requiredTools`?
3. Is `toolOverrides` explicitly enabling it?

### "Need custom precedence rules"

Extend `PNPToolResolver`:
```typescript
class CustomPNPResolver extends PNPToolResolver {
  protected resolveSupport(supportId: string, context: ResolutionContext) {
    // Custom precedence logic
    // Then call super.resolveSupport() or implement fully
  }
}
```

## References

- [Tool Registry Architecture](TOOL_REGISTRY.md) - Tool registration and filtering
- [QTI 3.0 PNP Specification](https://www.imsglobal.org/spec/qti/v3p0)
- [IMS AfA 3.0 Specification](https://www.imsglobal.org/spec/afa/v3p0)
- [QTI Standard Access Features](../src/services/pnp-standard-features.ts)
