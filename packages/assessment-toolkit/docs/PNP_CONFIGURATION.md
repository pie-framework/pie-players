# PNP Configuration Guide

How a host configures tool governance: the student's Personal Needs and Preferences (PNP) profile, whose baseline is AfA PNP 3.0, plus PIE's district, test-administration and item settings. This guide is for integrators who fill in those inputs and need to predict which tools a toolbar shows.

## Overview

Placement decides which tools a toolbar can show. Policy then reads four inputs, by tool id:

1. **Student profile** (AfA PNP 3.0): the student's documented accessibility needs
2. **District policy** (PIE extension): institutional governance rules
3. **Test administration** (PIE extension): session-level operational control
4. **Item settings** (PIE extension): per-item requirements and restrictions, applied on the item's own toolbar

A grant is a profile support, a requirement, or a test-administration override set to `true`. A grant protects a placed tool from the registry's relevance filter, and puts no unplaced tool on a toolbar.

Among the policy inputs, only a block removes a placed tool: a district block, an item restriction, a prohibited support, or an override set to `false`. [Precedence](#precedence) orders them.

## Data structure

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

Policy reads the profile of the bound assessment: the `assessment` property of a section player or toolkit that builds its coordinator, or `coordinator.updateAssessment` on a coordinator the host passes. A section carries no profile, because a profile is learner data and section content is shared by every learner. The section player warns once when a section carries one.

## Configuration examples

### Student profile

The profile is part of the `AssessmentEntity`. A support id is the `toolId` it grants. Translate a profile held in AfA PNP 3.0 terms (`line-reader`, `answer-masking`) to the tools that serve them (`lineReader`, `answerEliminator`), as [Support ids](TOOL_REGISTRY.md#support-ids) lists.

```typescript
const assessment: AssessmentEntity = {
  id: "assessment-123",
  name: "Math Assessment",

  personalNeedsProfile: {
    // Supports granted to this student, by tool id
    supports: [
      "textToSpeech",
      "magnification",     // No packaged tool; reported as an unknown support id
      "calculator",
      "annotationToolbar",
      "lineReader"
    ],

    // Supports withdrawn for this student; each is a block
    prohibitedSupports: [
      "answerEliminator"
    ]
  },

  sections: [...]
};
```

Profiles typically come from IEP (Individualized Education Program) documents, 504 accommodation plans, or a student accessibility-profile database.

### District policy

```typescript
const assessment: AssessmentEntity = {
  id: "state-test-456",
  name: "State Standardized Math Test",

  personalNeedsProfile: {
    supports: ["calculator", "textToSpeech", "magnification"]
  },

  settings: {
    districtPolicy: {
      // Blocked regardless of the profile
      blockedTools: [
        "calculator"       // State test rule: No calculators on this assessment
      ],

      // Required for every student taking this assessment
      requiredTools: [
        "textToSpeech"
      ]
    }
  }
};
```

District assessment coordinators, state testing agencies and accessibility offices typically set these. A district block outranks every other input, profile supports included. A district requirement applies to every student taking the assessment; the model has no condition for a sub-group.

A required tool still needs a placement and the host's permission. Any of these host gates keeps it off the toolbars:

- `tools.policy.blocked`
- a non-empty `tools.policy.allowed` that omits it
- a disabled provider
- its absence from every level of `tools.placement`

The decision then carries a `tool-policy.requiredToolBlocked` diagnostic whose `details.hostRule` and `details.hostValue` name the gate. A tool placed at another level is served there and raises nothing at this one.

### Test administration

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

Proctors, testing-center staff or the testing platform set these per session, for technical issues (broken audio) or test security.

`toolOverrides` is keyed by tool id. `false` withdraws the tool for the session, and only a district block outranks it. `true` grants it, ranking below the blocks and above every requirement and profile support. A `true` override carries `alwaysAvailable`, so the item toolbar's relevance check does not withdraw it. When a requirement names the same tool, the entry is also `required`, and a host gate that removes it raises `tool-policy.requiredToolBlocked`. When an item restriction or a profile prohibition withdraws a tool an override grants, the decision carries a `tool-policy.overrideBlocked` diagnostic naming the rule.

### Item settings

Content authors require or restrict tools per item:

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

Item authors and item-bank systems set these. Typical uses: block the calculator on mental math, require the graph tool on a graphing problem, block TTS on a reading-comprehension item.

#### Scope of item settings

An item's settings govern the decisions scoped to that item: its own item-level toolbar, and the feature decisions its content asks with the item's scope.

They reach the coordinator through the `settings` property of the item's `<pie-item-scope>`. The section player fills it from each item's `AssessmentItemRef.settings`; a host composing its own item player sets it on the scope it wraps the player in. A host driving a coordinator without the elements files them with `coordinator.registerItemSettings(itemId, settings)`, under the item's canonical id, which is the id its item toolbar scopes decisions by. The call returns the function that withdraws them.

Section-, assessment- and passage-level toolbars ignore item settings: placement there is the host's choice for content every item shares, and the items on the page are not aggregated into it. When a mounted item's `restrictedTools` or `requiredTools` names a tool the placement puts on such a toolbar:

- the decision carries a `tool-policy.itemSettingNotApplied` diagnostic, whose details name the `itemId`, the `settings` keys and the `toolbarLevel`
- the coordinator logs a warning once per tool and item

Place the tool at item level to enforce the setting per item. An item whose decisions [PNP enforcement](#pnp-enforcement) leaves off raises no diagnostic.

## Precedence

For each tool id, the first rule that matches decides. The rule id is what a decision's `rule` and the policy provenance record.

| # | Rule id | Input | Effect |
| --- | --- | --- | --- |
| 1 | `district-block` | `districtPolicy.blockedTools` | Block |
| 2 | `test-admin-override` | `toolOverrides[toolId] === false` | Block for the session |
| 3 | `item-restriction` | item `restrictedTools` | Block, on the item's own toolbar and scope |
| 4 | `pnp-prohibited` | `personalNeedsProfile.prohibitedSupports` | Block |
| 5 | `test-admin-override` | `toolOverrides[toolId] === true` | Grant for the session (`alwaysAvailable`) |
| 6 | `item-requirement` | item `requiredTools` | Grant (`required`), on the item's own toolbar and scope |
| 7 | `district-requirement` | `districtPolicy.requiredTools` | Grant (`required`) |
| 8 | `pnp-support` | `personalNeedsProfile.supports` | Grant (`alwaysAvailable`) |

No rule places a tool: a grant keeps a placed tool through relevance filtering, and a tool missing from `tools.placement` at a level stays off that level's toolbar.

## PNP enforcement

`tools.pnpEnforcement` decides whether toolbar decisions apply the policy inputs above:

- `"on"`: every toolbar decision applies them.
- `"off"`: toolbar decisions read placement and host policy (`tools.policy`, providers) only.
- omitted (auto-mode): a decision applies them when the bound assessment carries policy material — profile `supports` or `prohibitedSupports`, district `blockedTools` or `requiredTools`, or a test-administration override. A decision scoped to an item also applies them when that item's settings require or restrict a tool, and that turns enforcement on for the item's decisions only.

`coordinator.setPnpEnforcement(mode)` overrides the configured mode at runtime; `"on"` and `"off"` stick across assessment swaps, and `null` returns to the configured mode. A toolkit that builds its own coordinator forwards `tools.pnpEnforcement` to it.

Feature decisions (`decideFeaturePolicy`, for a capability that renders as its own surface) apply the policy inputs whatever the mode. Tool parameters reach every entry whatever the mode. A provider failure denies a toolbar tool only where an enforced decision grants it.

## Complete configuration example

All four inputs together:

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
        "textToSpeech"  // Required for every student on this assessment
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
// - magnification: No tool is registered under it; the coordinator's
//   `getPolicyInputs().diagnostics` carries a `tool-policy.unknownSupportId`
// - lineReader: Granted, but this configuration places it at passage level only
// - The passage toolbar still shows textToSpeech: item settings reach only the
//   item's own toolbar, and the decision carries a
//   `tool-policy.itemSettingNotApplied` diagnostic
```

### Tool parameters

`settings.toolParameters` holds feature parameters keyed by support id, and an item's `toolParameters` override them on the item's own toolbar and scope. Every tool policy shows carries them as its policy parameters (`ToolPolicyEntry.parameters`, `FeaturePolicyDecision.parameters`), whether or not a grant admits it and whatever `pnpEnforcement` is.

The calculator reads `type` as its default flavor, the answer eliminator `strategy` (`strikethrough` or `mask`), and the sign-language capability `signLang`. `ToolParameterMap` in `@pie-players/pie-players-shared/types` types them.

Provider configuration, such as the TTS backend and voice in step 2, belongs in `tools.providers`. The `server` backend sends requests to the host's TTS server at `apiEndpoint` (default `/api/tts`) through `@pie-players/tts-client-server`, which `@pie-players/pie-default-tool-loaders` installs.

## Precedence examples

The `#N` references are rows of the [precedence](#precedence) table.

### District block wins

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

### Item restriction wins

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

### Item requirement on an item-placed tool

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

### Test-administration override

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

## Integration checklist

### Data population

- [ ] **Profile**: load from the student's IEP/504 or accessibility-profile records
- [ ] **District policy**: configure in assessment administration
- [ ] **Test administration**: set at session creation time
- [ ] **Item settings**: author during item development

### API integration

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
const decision = coordinator.decideToolPolicy({
  level: "item",
  scope: { level: "item", scopeId: currentItem.identifier }
});

// 3. Create tool context
const context: ItemToolContext = {
  level: "item",
  assessment,
  section,
  itemRef: currentItem,
  item: itemData
};

// 4. Filter by relevance (Pass 2) and applicability (Pass 3); a granted
//    entry skips relevance. <pie-item-toolbar> does this itself; this is for a
//    host-built toolbar.
const visibleToolIds = registry.filterDecidedToolIds(decision.visibleTools, "item", [context]);
```

Then render the toolbar. It takes the coordinator from the enclosing toolkit and the item's identity from the enclosing item scope:

```html
<pie-assessment-toolkit .coordinator={coordinator}>
  <pie-item-scope item-id="item-1" .item={itemData} .settings={currentItem.settings}>
    <pie-item-toolbar .toolRegistry={registry}></pie-item-toolbar>
  </pie-item-scope>
</pie-assessment-toolkit>
```

Policy inputs reach the toolbar through the coordinator. A toolkit that builds its own coordinator forwards its `assessment` property to it, and the section players forward theirs to that toolkit. A host that passes `coordinator`, as here, binds the assessment with `updateAssessment`. Item settings arrive either way through each item's `<pie-item-scope>` registration; the explicit `registerItemSettings` in step 1 is for a host that decides without the elements.

### Data flow

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

## Troubleshooting

The coordinator logs each policy diagnostic as a console warning once per code, tool and item. `coordinator.onPolicyDiagnostic(listener)` hands the host the same diagnostics, starting with those already reported, and returns an unsubscribe function. A change to the policy inputs or to PNP enforcement reports a conflict that survives it once more.

### Granted tool missing from a toolbar

Check, in order:

1. Is it blocked by `districtPolicy.blockedTools`?
2. Is it disabled in `testAdministration.toolOverrides`?
3. Is it in the item's `restrictedTools`, on the item's own toolbar, or in `personalNeedsProfile.prohibitedSupports`? Either withdraws a tool a `true` override grants, and the decision carries a `tool-policy.overrideBlocked` diagnostic.
4. Is it placed at this level in `tools.placement`? A grant does not place a tool.
5. Is [PNP enforcement](#pnp-enforcement) off for this decision? Then the profile grants nothing and the next check applies.
6. Does the tool's `isVisibleInContext()` return false? A `required` or `alwaysAvailable` grant skips this check.
7. Does the tool's `isApplicableToContent()` return false for this content? This check removes the tool even under a grant.

### Blocked tool still on a toolbar

Check:

1. Is it in `districtPolicy.requiredTools`?
2. Is it in the item's `requiredTools`, on the item's own toolbar?
3. Is `toolOverrides` explicitly enabling it?
4. Is [PNP enforcement](#pnp-enforcement) off for this decision? Then no block applies.
5. Is an item's restriction meant to withdraw it from a section-, assessment- or passage-level toolbar? Item settings do not reach those toolbars; the decision's `tool-policy.itemSettingNotApplied` diagnostic names the item. Place the tool at item level instead.

### Custom policy rules

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

- [Tool Registry Reference](TOOL_REGISTRY.md) - Tool registration and filtering
- [IMS AfA PNP 3.0 Information Model](https://www.imsglobal.org/spec/afa/v3p0/info)
