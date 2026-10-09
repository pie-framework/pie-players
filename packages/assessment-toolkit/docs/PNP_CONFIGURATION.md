# PNP Configuration Guide

This guide explains how integrators configure tool governance with a student's Personal Needs Profile (PNP), whose baseline is AfA PNP 3.0, and PIE's assessment settings.

## Overview

Placement decides which tools a toolbar can show. Policy then reads four inputs, by tool id:
1. **Student PNP profile** (AfA PNP 3.0) - Student's documented accessibility needs
2. **District policy** (PIE extension) - Institutional governance rules
3. **Test administration** (PIE extension) - Session-level operational control
4. **Item settings** (PIE extension) - Per-item requirements and restrictions, applied on the item's own toolbar

A grant (a profile support, a requirement or a test-administration override set to `true`) protects a placed tool from the registry's relevance filter and carries its `toolConfigs` parameters. Among the policy inputs, only a block removes a placed tool: a district block, an item restriction, a prohibited support, or an override set to `false`. A grant puts no unplaced tool on a toolbar.

## Data Structure Hierarchy

```
AssessmentEntity
├── personalNeedsProfile           # AfA PNP 3.0: Student's PNP profile
│   ├── supports: string[]         # Granted support ids
│   └── prohibitedSupports: string[]
│
└── settings: AssessmentSettings   # PIE extension
    ├── districtPolicy             # Institutional governance
    │   ├── blockedTools: string[]
    │   └── requiredTools: string[]
    │
    ├── testAdministration         # Session control
    │   └── toolOverrides: Record<string, boolean>
    │
    └── toolConfigs                # Feature parameters by support id
        ├── calculator: {...}
        └── textToSpeech: {...}

AssessmentItemRef
└── settings: ItemSettings         # Per-item rules, registered by the item's <pie-item-scope>
    ├── requiredTools: string[]
    ├── restrictedTools: string[]
    └── toolParameters: Record<string, any>
```

Policy reads the profile of the bound assessment: the `assessment` property of a section player or toolkit that builds its coordinator, or `coordinator.updateAssessment` on a coordinator the host passes. A section carries no profile: a profile is learner data, and section content is shared by every learner. The section player warns once when a section carries one.

## Configuration Examples

### 1. Student PNP Profile (AfA PNP 3.0)

The student's Personal Needs Profile is part of the `AssessmentEntity`:

```typescript
const assessment: AssessmentEntity = {
  id: "assessment-123",
  name: "Math Assessment",

  // Student's documented accessibility needs
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
      ]
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
      // Session-specific overrides
      // Proctor can disable tools due to operational issues
      toolOverrides: {
        "textToSpeech": false,  // TTS disabled - audio equipment broken
        "calculator": true      // Calculator explicitly enabled
      }
    }
  }
};
```

**Source**: Typically set by:
- Test proctors/administrators
- Testing center staff
- Automated testing platform
- Session management systems

**Use Cases**:
- Technical issues (TTS audio broken, disable for this session)
- Test security (disable features for high-stakes tests)

**Precedence**: `toolOverrides` is keyed by tool id. `false` withdraws the tool for the session, and only a district block outranks it. `true` grants it, below a district block, the item's `restrictedTools` and the profile's `prohibitedSupports`, and above item and district requirements and profile supports. When a restriction or prohibition withdraws a tool an override grants, the decision carries a `tool-policy.overrideBlocked` diagnostic naming the rule. With no override, a district requirement still outranks a prohibition. A `true` override is a grant like a PNP support: the entry carries `alwaysAvailable`, so the item toolbar's relevance check does not withdraw it.

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

#### Scope of item settings

An item's settings govern the decisions scoped to that item: its own item-level toolbar, and the feature decisions its content asks with the item's scope. They reach the coordinator through the item's `<pie-item-scope>`, whose `settings` property carries them. The section player fills it from each item's `AssessmentItemRef.settings`; a host composing its own item player sets it on the scope it wraps the player in. A host driving a coordinator without the elements files them with `coordinator.registerItemSettings(itemId, settings)`, under the item's canonical id, which is the id its item toolbar scopes decisions by. The call returns the function that withdraws them.

Section-, assessment- and passage-level toolbars ignore item settings. Placement there is the host's choice for content every item shares, and the items on the page are not aggregated into it. When a mounted item's `restrictedTools` or `requiredTools` names a tool the placement puts on such a toolbar, the decision carries a `tool-policy.itemSettingNotApplied` diagnostic, whose details name the `itemId`, the `settings` keys and the `toolbarLevel`, and the coordinator logs a warning once per tool and item. Place the tool at item level to enforce the setting per item. An item whose decisions PNP enforcement leaves off raises no diagnostic.

In auto-mode (no `pnpEnforcement` set), an item's settings turn enforcement on for the decisions scoped to that item, and for no others.

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
    ]
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
      toolOverrides: {
        // Proctor can make session-specific adjustments
      }
    }
  }
};

// 4. Resolve tools for an item's own toolbar
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
// The item's <pie-item-scope> does this when it mounts with `settings`.
coordinator.registerItemSettings(currentItem.identifier, currentItem.settings!);

const allowedToolIds = coordinator
  .decideToolPolicy({ level: "item", scope: { level: "item", scopeId: currentItem.identifier } })
  .visibleTools.map((tool) => tool.toolId);

console.log('Allowed tools:', allowedToolIds);
// Output: ["annotationToolbar"]
//
// Why?
// - calculator: Blocked by district policy (#1)
// - textToSpeech: Restricted for this item (#3), which outranks the district requirement (#6)
// - annotationToolbar: Placed at item level and granted by the profile
// - magnification: No tool is registered under it; the decision carries a
//   `tool-policy.unknownSupportId` diagnostic
// - lineReader: Granted, but this configuration places it at passage level only
```

`settings.toolConfigs` holds feature parameters keyed by support id, and an item's `toolParameters` override them. A feature granted by a PNP support, a requirement or a test-administration override carries them as its policy parameters (`ToolPolicyEntry.settings`, `FeaturePolicyDecision.parameters`), which is where the sign-language capability reads `signLang`. Provider configuration, such as the TTS backend and voice in step 2, belongs in `tools.providers`. The server backends (`polly`, `google`, `server`) send requests to the host's TTS server at `apiEndpoint` (default `/api/tts`) through `@pie-players/tts-client-server`, which `@pie-players/pie-default-tool-loaders` installs.

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
// District policy (#1) overrides PNP supports (#7)
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
// Result: calculator BLOCKED on this item's own toolbar only
// Item restriction (#3) overrides PNP supports (#7). A section-level
// calculator stays and reports `tool-policy.itemSettingNotApplied`.
```

### Example 3: Item Requirement on an Item-Placed Tool

```typescript
{
  personalNeedsProfile: {
    supports: []  // Student doesn't have calculator in PNP
  },
  itemSettings: {
    requiredTools: ["calculator"]  // Complex computation problem
  }
}
// Result: calculator ENABLED on this item's own toolbar
// Item requirement (#5) forces enablement there
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
coordinator.registerItemSettings(currentItem.identifier, currentItem.settings!);

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
```

5. Render the toolbar. It takes the coordinator from the enclosing toolkit and
   the item's identity from the enclosing item scope:

```html
<pie-assessment-toolkit .coordinator={coordinator}>
  <pie-item-scope item-id="item-1" .item={itemData} .settings={currentItem.settings}>
    <pie-item-toolbar .toolRegistry={registry}></pie-item-toolbar>
  </pie-item-scope>
</pie-assessment-toolkit>
```

Policy inputs reach the toolbar through the coordinator. A toolkit that builds its own coordinator forwards its `assessment` property to it, and the section players forward theirs to that toolkit. A host that passes `coordinator`, as here, binds the assessment with `updateAssessment`. Item settings arrive either way through each item's `<pie-item-scope>` registration; the explicit `registerItemSettings` in step 1 is for a host that decides without the elements.

### Data Sources

Typical data flow:

```
tools.placement (host)            IEP/504 database → personalNeedsProfile
    ↓                                                 districtPolicy, testAdministration, item settings
ToolPolicyEngine: placed tools, minus blocks; grants mark entries required/alwaysAvailable
    ↓
ToolRegistry → visibleTools (relevance filter skips granted entries)
    ↓
pie-item-toolbar → rendered buttons
```

The profile and settings change which placed tools survive and how they are parameterized. They never add a tool placement leaves out.

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

1. **Name support ids by tool id** - A support id is the `toolId` it grants; translate a profile held in AfA PNP 3.0 terms (`line-reader`, `answer-masking`) to the tools that serve them (`lineReader`, `answerEliminator`), as [Support ids](TOOL_REGISTRY.md#support-ids) lists
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
3. Is it in `itemSettings.restrictedTools`, on the item's own toolbar, or in `personalNeedsProfile.prohibitedSupports`? Either withdraws a tool a `true` override grants, and the decision carries a `tool-policy.overrideBlocked` diagnostic.
4. Is it placed at this level in `tools.placement`? A grant does not place a tool.
5. Does the tool's `isVisibleInContext()` return false? A `required` or `alwaysAvailable` grant skips this check.
6. Does the tool's `isApplicableToContent()` return false for this content? This check removes the tool even under a grant.

### "Tool showing up when it shouldn't"

Check:
1. Is it in `districtPolicy.requiredTools`?
2. Is it in `itemSettings.requiredTools`, on the item's own toolbar?
3. Is `toolOverrides` explicitly enabling it?
4. Is an item's restriction meant to withdraw it from a section-, assessment- or passage-level toolbar? Item settings do not reach those toolbars; the decision's `tool-policy.itemSettingNotApplied` diagnostic names the item. Place the tool at item level instead.

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
- [IMS AfA PNP 3.0 Information Model](https://www.imsglobal.org/spec/afa/v3p0/info)
