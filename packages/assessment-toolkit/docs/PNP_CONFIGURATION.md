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
│   └── activateAtInit: string[]   # Accepted, not acted on
│
└── settings: AssessmentSettings   # PIE extension
    ├── districtPolicy             # Institutional governance
    │   ├── blockedTools: string[]
    │   ├── requiredTools: string[]
    │   └── policies: Record<string, any>   # Accepted, not acted on
    │
    ├── testAdministration         # Session control
    │   ├── mode: "practice" | "test" | "benchmark"   # Accepted, not acted on
    │   ├── toolOverrides: Record<string, boolean>
    │   └── startDate, endDate: string                # Accepted, not acted on
    │
    └── toolConfigs                # Feature parameters by support id
        ├── calculator: {...}
        └── textToSpeech: {...}

AssessmentItemRef
└── settings: ItemSettings         # Per-item rules
    ├── requiredTools: string[]
    ├── restrictedTools: string[]
    └── toolParameters: Record<string, any>
```

The fields marked "accepted, not acted on" are typed so a host can carry them with the assessment, and their presence counts as policy material: in auto mode a non-empty one turns PNP enforcement on. Nothing reads their values. No tool activates from `activateAtInit`, and the policy engine applies no rule for `districtPolicy.policies`, `testAdministration.mode` or the testing window.

## Configuration Examples

### 1. Student PNP Profile (QTI 3.0 Standard)

The student's Personal Needs Profile is part of the QTI 3.0 `AssessmentEntity`:

```typescript
const assessment: AssessmentEntity = {
  id: "assessment-123",
  name: "Math Assessment",

  // QTI 3.0: Student's documented accessibility needs
  personalNeedsProfile: {
    // Accessibility features this student is authorized to use, by tool id
    supports: [
      "textToSpeech",
      "magnification",     // No packaged tool; reported as an unknown support id
      "calculator",
      "annotationToolbar",
      "lineReader"
    ],

    // Features explicitly prohibited for this student
    prohibitedSupports: [
      "answerEliminator"   // Not allowed per IEP
    ],

    // Accepted, not acted on: no tool activates from this list
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

      // Accepted, not acted on: no policy rule reads these
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
    supports: ["calculator", "textToSpeech", "annotationToolbar"]
  },

  settings: {
    testAdministration: {
      // Accepted, not acted on
      mode: "test",  // "practice" | "test" | "benchmark"

      // Session-specific overrides
      // Proctor can disable tools due to operational issues
      toolOverrides: {
        "textToSpeech": false,  // TTS disabled - audio equipment broken
        "calculator": true      // Calculator explicitly enabled
      },

      // Testing window: accepted, not acted on
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

    // Feature parameters by support id; these override assessment `toolConfigs`
    toolParameters: {
      calculator: {
        type: "basic",
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
  ToolkitCoordinator
} from '@pie-players/pie-assessment-toolkit';
import {
  createPackagedToolRegistry,
  DEFAULT_TOOL_MODULE_LOADERS,
} from '@pie-players/pie-default-tool-loaders';

// 1. Create tool registry; its loaders load each tool's element on first render
const toolRegistry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
});

// 2. Create coordinator with the registry, configured placements and tool providers
const coordinator = new ToolkitCoordinator({
  assessmentId: "spring-2024-ela",
  toolRegistry,
  tools: {
    placement: {
      item: ["calculator", "textToSpeech", "annotationToolbar"],
      section: ["theme"],
      passage: ["textToSpeech", "lineReader"]
    },
    providers: {
      textToSpeech: {
        backend: "polly",
        defaultVoice: "Matthew",
        rate: 1.0,
        engine: "neural"
      }
    }
  }
});

// 3. Configure assessment with all governance levels
const assessment: AssessmentEntity = {
  id: "spring-2024-ela",
  name: "Spring 2024 ELA Assessment",

  // Student's PNP profile (from IEP/504)
  personalNeedsProfile: {
    supports: [
      "textToSpeech",
      "magnification",
      "annotationToolbar",
      "lineReader",
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
    }
  }
};

// 4. Resolve tools for an item
const currentItem: AssessmentItemRef = {
  identifier: "item-1",

  // Item-specific rules
  settings: {
    restrictedTools: [
      "textToSpeech"  // Reading comprehension - no TTS
    ]
  }
};
coordinator.updateAssessment(assessment);
coordinator.updateCurrentItemRef(currentItem);

const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: currentItem.identifier } })
  .visibleTools.map((tool) => tool.toolId);

console.log('Allowed tools:', allowedToolIds);
// Output: ["annotationToolbar"]
//
// Why?
// - calculator: Blocked by district policy (#1)
// - textToSpeech: Restricted for this item (#3), which outranks the district requirement (#5)
// - annotationToolbar: Placed at item level and granted by the profile
// - magnification: No tool is registered under it; the decision carries a
//   `tool-policy.unknownSupportId` diagnostic
// - lineReader: Granted, but this configuration places it at passage level only
```

`settings.toolConfigs` holds feature parameters keyed by support id, and an item's `toolParameters` override them. A feature granted by a PNP support or a requirement carries them as its policy parameters (`ToolPolicyEntry.settings`, `FeaturePolicyDecision.parameters`), which is where the sign-language capability reads `signLang`. Provider configuration, such as the TTS backend and voice in step 2, belongs in `tools.providers`. The server backends (`polly`, `google`, `server`) send requests to the host's TTS server at `apiEndpoint` (default `/api/tts`) through `@pie-players/tts-client-server`, which `@pie-players/pie-default-tool-loaders` installs.

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
import {
  createPackagedToolRegistry,
  DEFAULT_TOOL_MODULE_LOADERS,
} from '@pie-players/pie-default-tool-loaders';

// 1. Create registry and coordinator. The toolbar below renders from this
//    registry, so it carries the loaders for each tool's element.
const registry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
});
const coordinator = new ToolkitCoordinator({
  assessmentId: assessment.id,
  toolRegistry: registry,
  tools: {
    placement: {
      item: ["calculator", "textToSpeech", "annotationToolbar"]
    }
  }
});
coordinator.updateAssessment(assessment);
coordinator.updateCurrentItemRef(currentItem);

// 2. Resolve tools for current context
const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: currentItem.identifier } })
  .visibleTools.map((tool) => tool.toolId);

// 3. Create tool context
const context: ItemToolContext = {
  level: "item",
  assessment,
  section,
  itemRef: currentItem,
  item: itemData
};

// 4. Filter by relevance (Pass 2) and applicability (Pass 3).
//    <pie-item-toolbar> runs both passes itself; this is for a host-built toolbar.
const visibleTools = registry
  .filterVisibleInContext(allowedToolIds, context)
  .filter((tool) => registry.isApplicableToAnyContext(tool.toolId, [context]));

// 5. Render toolbar: it takes the coordinator from the enclosing toolkit
<pie-assessment-toolkit .coordinator={coordinator}>
  <pie-item-toolbar
    .toolRegistry={registry}
    .item={itemData}
  ></pie-item-toolbar>
</pie-assessment-toolkit>
```

Policy inputs reach the toolbar through the coordinator. A toolkit that builds its own coordinator forwards its `assessment` and `currentItemRef` properties to it; a host that passes `coordinator`, as here, binds them with `updateAssessment` and `updateCurrentItemRef`.

### Data Sources

Typical data flow:

```
IEP/504 Database
    ↓
personalNeedsProfile.supports
    ↓
ToolPolicyEngine → allowedToolIds
    ↓
ToolRegistry → visibleTools
    ↓
pie-item-toolbar → rendered buttons
```

### Admin Interfaces

Provide UI for:

1. **District administrators** to configure `districtPolicy`:
   ```typescript
   interface DistrictPolicyEditor {
     blockedTools: string[];     // Multi-select from registered tool ids
     requiredTools: string[];
   }
   ```

2. **Proctors** to set `testAdministration` overrides:
   ```typescript
   interface TestAdminPanel {
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

1. **Name support ids by tool id** - A support id is the `toolId` it grants; translate a profile held in AfA terms (`readingMask`, `answerMasking`) to the tools that serve it
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
4. Is it placed at this level in `tools.placement`? A grant does not place a tool.
5. Does the tool's `isVisibleInContext()` return false? A `required` or `alwaysAvailable` grant skips this check.
6. Does the tool's `isApplicableToContent()` return false for this content? This check removes the tool even under a grant.

### "Tool showing up when it shouldn't"

Check:
1. Is it in `districtPolicy.requiredTools`?
2. Is it in `itemSettings.requiredTools`?
3. Is `toolOverrides` explicitly enabling it?

### "Need custom policy rules"

Register a custom `PolicySource` with the coordinator; the call returns a function that unregisters it:
```typescript
const unregister = coordinator.registerPolicySource({
  id: "district-window",
  refine({ candidates }) {
    return {
      refinedCandidates: candidates.filter((toolId) => toolId !== "calculator")
    };
  }
});
```

## References

- [Tool Registry Architecture](TOOL_REGISTRY.md) - Tool registration and filtering
- [QTI 3.0 PNP Specification](https://www.imsglobal.org/spec/qti/v3p0)
- [IMS AfA 3.0 Specification](https://www.imsglobal.org/spec/afa/v3p0)
