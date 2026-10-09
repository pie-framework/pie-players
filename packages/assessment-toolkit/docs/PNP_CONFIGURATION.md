# PNP Configuration Guide

This guide explains how integrators configure tool governance with a student's Personal Needs Profile (PNP), whose baseline is AfA PNP 3.0, and PIE's assessment settings.

## Overview

Placement decides which tools a toolbar can show. Policy then reads four inputs, by tool id:
1. **Student PNP profile** (AfA PNP 3.0) - Student's documented accessibility needs
2. **District policy** (PIE extension) - Institutional governance rules
3. **Test administration** (PIE extension) - Session-level operational control
4. **Item settings** (PIE extension) - Per-item requirements and restrictions, applied on the item's own toolbar

A grant (a profile support, a requirement or a test-administration override set to `true`) protects a placed tool from the registry's relevance filter. Among the policy inputs, only a block removes a placed tool: a district block, an item restriction, a prohibited support, or an override set to `false`. A grant puts no unplaced tool on a toolbar.

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
    └── toolParameters             # Feature parameters by support id
        ├── calculator: { type }
        └── answerEliminator: { strategy }

AssessmentItemRef
└── settings: ItemSettings         # Per-item rules, registered by the item's <pie-item-scope>
    ├── requiredTools: string[]
    ├── restrictedTools: string[]
    └── toolParameters: Record<string, Record<string, unknown>>
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

A required tool still needs a placement and the host's permission. When `tools.policy.blocked`, a non-empty `tools.policy.allowed`, a disabled provider or the absence of the tool from every level of `tools.placement` keeps it off the toolbars, the decision carries a `tool-policy.requiredToolBlocked` diagnostic whose `details.hostRule` and `details.hostValue` name the host gate. A tool placed at another level is served there and raises nothing at this one.

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

**Precedence**: `toolOverrides` is keyed by tool id. `false` withdraws the tool for the session, and only a district block outranks it. `true` grants it, below a district block, the item's `restrictedTools` and the profile's `prohibitedSupports`, and above item and district requirements and profile supports. When a restriction or prohibition withdraws a tool an override grants, the decision carries a `tool-policy.overrideBlocked` diagnostic naming the rule. The full order is district block, `false` override, item restriction, profile prohibition, `true` override, item requirement, district requirement, profile support. A `true` override is a grant like a PNP support: the entry carries `alwaysAvailable`, so the item toolbar's relevance check does not withdraw it. A requirement naming the same tool keeps its mandate under the override: the entry is also `required`, and a host gate that removes it raises `tool-policy.requiredToolBlocked`.

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
      "graph"            // Graph interpretation required
    ],

    // Tools BLOCKED for this specific item
    restrictedTools: [
      "textToSpeech"     // Reading-fluency item - read-aloud would invalidate it
    ],

    // Feature parameters by support id; these override the assessment's `toolParameters`
    toolParameters: {
      calculator: { type: "scientific" }
    }
  }
};
```

#### Scope of item settings

An item's settings govern the decisions scoped to that item: its own item-level toolbar, and the feature decisions its content asks with the item's scope. They reach the coordinator through the item's `<pie-item-scope>`, whose `settings` property carries them. The section player fills it from each item's `AssessmentItemRef.settings`; a host composing its own item player sets it on the scope it wraps the player in. A host driving a coordinator without the elements files them with `coordinator.registerItemSettings(itemId, settings)`, under the item's canonical id, which is the id its item toolbar scopes decisions by. The call returns the function that withdraws them.

Section-, assessment- and passage-level toolbars ignore item settings. Placement there is the host's choice for content every item shares, and the items on the page are not aggregated into it. When a mounted item's `restrictedTools` or `requiredTools` names a tool the placement puts on such a toolbar, the decision carries a `tool-policy.itemSettingNotApplied` diagnostic, whose details name the `itemId`, the `settings` keys and the `toolbarLevel`, and the coordinator logs a warning once per tool and item. Place the tool at item level to enforce the setting per item. An item whose decisions [PNP enforcement](#pnp-enforcement) leaves off raises no diagnostic.

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

## PNP enforcement

`tools.pnpEnforcement` decides whether toolbar decisions apply the policy inputs above:

- `"on"`: every toolbar decision applies them.
- `"off"`: toolbar decisions read placement and host policy (`tools.policy`, providers) only.
- omitted (auto-mode): a decision applies them when the bound assessment carries policy material — profile `supports` or `prohibitedSupports`, district `blockedTools` or `requiredTools`, or a test-administration override. A decision scoped to an item also applies them when that item's settings require or restrict a tool, and that turns enforcement on for the item's decisions only.

`coordinator.setPnpEnforcement(mode)` overrides the configured mode at runtime; `"on"` and `"off"` stick across assessment swaps, and `null` returns to the configured mode. A toolkit that builds its own coordinator forwards `tools.pnpEnforcement` to it.

Feature decisions (`decideFeaturePolicy`, for a capability that renders as its own surface) apply the policy inputs whatever the mode. Tool parameters reach every entry whatever the mode. A provider failure denies a toolbar tool only where an enforced decision grants it.

## Complete Configuration Example

Here's a complete example showing how all levels interact:

```typescript
import {
  ToolkitCoordinator
} from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// 1. Create tool registry; its loaders load each tool's element on first render
const toolRegistry = createPackagedToolRegistry();

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
        backend: "server",
        serverProvider: "polly",
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
// - textToSpeech: Restricted for this item (#3), which outranks the district requirement (#7)
// - annotationToolbar: Placed at item level and granted by the profile
// - magnification: No tool is registered under it; the decision carries a
//   `tool-policy.unknownSupportId` diagnostic
// - lineReader: Granted, but this configuration places it at passage level only
// - The passage toolbar still shows textToSpeech: item settings reach only the
//   item's own toolbar, and the decision carries a
//   `tool-policy.itemSettingNotApplied` diagnostic
```

`settings.toolParameters` holds feature parameters keyed by support id, and an item's `toolParameters` override them. Every tool policy shows carries them as its policy parameters (`ToolPolicyEntry.parameters`, `FeaturePolicyDecision.parameters`), whether or not a grant admits it and whatever `pnpEnforcement` is; the item's entry applies on the item's own toolbar and scope. The calculator reads `type` as its default flavor, the answer eliminator `strategy` (`strikethrough` or `mask`), and the sign-language capability `signLang`; `ToolParameterMap` in `@pie-players/pie-players-shared/types` types them. Provider configuration, such as the TTS backend and voice in step 2, belongs in `tools.providers`. The `server` backend sends requests to the host's TTS server at `apiEndpoint` (default `/api/tts`) through `@pie-players/tts-client-server`, which `@pie-players/pie-default-tool-loaders` installs.

## Precedence Resolution Examples

### Example 1: District Block Wins

```typescript
const assessment = {
  personalNeedsProfile: {
    supports: ["calculator"]  // Student has calculator in IEP
  },
  settings: {
    districtPolicy: {
      blockedTools: ["calculator"]  // District blocks it anyway
    }
  }
};
// Result: calculator BLOCKED
// District policy (#1) overrides PNP supports (#8)
```

### Example 2: Item Restriction Wins

```typescript
const assessment = {
  personalNeedsProfile: {
    supports: ["calculator"]  // Student has calculator in IEP
  }
};
// The item's settings, registered by its <pie-item-scope>
const itemSettings: ItemSettings = {
  restrictedTools: ["calculator"]  // Mental math question
};
// Result: calculator BLOCKED on this item's own toolbar only
// Item restriction (#3) overrides PNP supports (#8). A section-level
// calculator stays and reports `tool-policy.itemSettingNotApplied`.
```

### Example 3: Item Requirement on an Item-Placed Tool

```typescript
const assessment = {
  personalNeedsProfile: {
    supports: []  // Student doesn't have calculator in PNP
  }
};
const itemSettings: ItemSettings = {
  requiredTools: ["calculator"]  // Complex computation problem
};
// Result: a calculator placed at item level stays on this item's own
// toolbar through relevance filtering.
// The requirement (#6) places nothing: without an item-level placement,
// no calculator renders.
```

### Example 4: Test Admin Override

```typescript
const assessment = {
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
};
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
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

// 1. Create registry and coordinator. The toolbar below renders from this
//    registry, so it carries the loaders for each tool's element.
const registry = createPackagedToolRegistry();
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

3. **Item authors** to configure item settings:
   ```typescript
   interface ItemSettingsEditor {
     requiredTools: string[];    // Multi-select from available tools
     restrictedTools: string[];  // Multi-select from available tools
     toolParameters: Record<string, Record<string, unknown>>;
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

The coordinator logs each policy diagnostic as a console warning once per code, tool and item. `coordinator.onPolicyDiagnostic(listener)` hands the host the same diagnostics, starting with those already reported, and returns an unsubscribe function. A change to the policy inputs or to PNP enforcement reports a conflict that survives it once more.

### "Tool not showing up even though it's in PNP"

Check precedence hierarchy in order:
1. Is it blocked by `districtPolicy.blockedTools`?
2. Is it disabled in `testAdministration.toolOverrides`?
3. Is it in the item's `restrictedTools`, on the item's own toolbar, or in `personalNeedsProfile.prohibitedSupports`? Either withdraws a tool a `true` override grants, and the decision carries a `tool-policy.overrideBlocked` diagnostic.
4. Is it placed at this level in `tools.placement`? A grant does not place a tool.
5. Is [PNP enforcement](#pnp-enforcement) off for this decision? Then the profile grants nothing and the next check applies.
6. Does the tool's `isVisibleInContext()` return false? A `required` or `alwaysAvailable` grant skips this check.
7. Does the tool's `isApplicableToContent()` return false for this content? This check removes the tool even under a grant.

### "Tool showing up when it shouldn't"

Check:
1. Is it in `districtPolicy.requiredTools`?
2. Is it in the item's `requiredTools`, on the item's own toolbar?
3. Is `toolOverrides` explicitly enabling it?
4. Is [PNP enforcement](#pnp-enforcement) off for this decision? Then no block applies.
5. Is an item's restriction meant to withdraw it from a section-, assessment- or passage-level toolbar? Item settings do not reach those toolbars; the decision's `tool-policy.itemSettingNotApplied` diagnostic names the item. Place the tool at item level instead.

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
