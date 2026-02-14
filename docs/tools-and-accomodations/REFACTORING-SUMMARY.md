# Tool Registry Refactoring - Summary

**Date**: 2026-02-13
**Status**: ✅ Design Approved, Ready for Implementation

---

## What We're Doing

Refactoring the tool system to use a **registry-based architecture** with a clear **two-pass visibility model**.

---

## Key Goals (Confirmed)

### 1. Flexible Tool Placement ✅
**Goal**: "Configure which tools render on question toolbars, tool toolbars, and anything else. Don't hardcode/limit this."

**Solution**: Integrators configure placement, framework doesn't hardcode.

---

### 2. Configurable Tools ✅
**Goal**: "While providing good defaults (calculators, TTS typically go on element/question level), we don't hard-code/limit this."

**Solution**:
- Framework provides `createDefaultToolRegistry()` with PIE tools
- Integrators can add/remove/override any tool
- No hardcoded tool lists

---

### 3. Two-Pass Visibility Model ✅

#### Pass 1: Orchestrator Decides Allowance
**Goal**: "PNP is built by the orchestrator and decides a first pass on which tools are available"

**Owner**: `PNPToolResolver` (existing service, minor update)

**What it does**:
- Applies PNP + district policies + test settings + item requirements
- Returns: `allowedToolIds: string[]`
- No content inspection

**Example**:
```typescript
const allowedToolIds = resolver.resolveAllowedTools(assessment, itemRef);
// ['calculator', 'textToSpeech'] - based on student PNP
```

---

#### Pass 2: Tools Decide Relevance
**Goal**: "The orchestrator should ask the tools that it thinks should be visible, if THEY think they should be"

**Owner**: Each tool's `isVisibleInContext(context)` method

**What it does**:
- Tool receives full context (item, element, assessment)
- Tool inspects content (has math? has choices? has text?)
- Tool returns: boolean (relevant or not)

**Example**:
```typescript
// Orchestrator says calculator is ALLOWED
// Tool inspects element and says "not relevant, no math"
calculatorReg.isVisibleInContext(context) → false
// Button hidden even though allowed
```

---

#### One-Way Veto Power
**Goal**: "It cannot work the other way around, so a tool can never decide to override the orchestrator when the orchestrator thinks it should not be visible"

**Enforcement**: Architecture pattern
```typescript
// Filter chain enforces this
const visibleTools = allowedToolIds  // ← Orchestrator gate (Pass 1)
  .map(id => registry.get(id))
  .filter(tool => tool.isVisibleInContext(context)); // ← Tool filter (Pass 2)
```

**Rule**: `Button Visible = (Orchestrator: ALLOWED) AND (Tool: RELEVANT)`

---

## Architecture Components

### What's New 🆕

1. **ToolRegistry** - Central tool metadata and factories
2. **ToolContext** - Rich context types (assessment/section/item/passage/element)
3. **ToolButton** - Generic button component
4. **ToolButtonGroup** - Generic toolbar renderer
5. **Tool Registrations** - Each tool exports registration

### What Stays ✅

1. **ToolCoordinator** - Unchanged (z-index, visibility)
2. **PNP Hierarchy** - Unchanged (precedence rules)
3. **Tool Components** - Unchanged (calculator, TTS, ruler, etc.)
4. **All Services** - Unchanged (TTS, highlight, theme, etc.)

### What Gets Deleted ❌

1. **tool-calculator-inline** - Duplicate button component
2. **tool-tts-inline** - Duplicate button component
3. **PNPMapper** - Hardcoded mapping (moves to registry)

---

## Benefits

### For Framework
- ✅ Clear two-pass model (orchestrator → tool)
- ✅ No duplication (-910 lines)
- ✅ One-way veto enforced by architecture
- ✅ Type-safe context

### For Integrators
- ✅ Full control over tool placement
- ✅ Easy to add custom tools
- ✅ Override visibility logic
- ✅ Query tool metadata for UIs
- ✅ No need to fork framework

### For Tool Authors
- ✅ Rich context for smart decisions
- ✅ Access to element models
- ✅ Self-contained registration

---

## Implementation Plan

See [tool-registry-implementation-guide.md](tool-registry-implementation-guide.md) for detailed plan.

**Timeline**: 3-4 weeks (15-22 days)

### Phases
1. **Core Infrastructure** (3-4 days) - ToolRegistry, ToolContext, update PNPToolResolver
2. **Tool Registrations** (4-5 days) - Create registrations for all PIE tools
3. **Generic Components** (2-3 days) - ToolButton, ToolButtonGroup
4. **Update Toolbars** (2-3 days) - Refactor QuestionToolBar, SectionToolsToolbar
5. **Cleanup** (1-2 days) - Delete inline tools, PNPMapper
6. **Documentation** (2-3 days) - Update all docs
7. **Examples** (1-2 days) - Update example app

---

## Complete Documentation

- **[tool-registry-architecture.md](tool-registry-architecture.md)** - Full architecture with two-pass model
- **[tool-registry-implementation-guide.md](tool-registry-implementation-guide.md)** - Step-by-step implementation
- **[tool-registry-refactoring-comparison.md](../tool-registry-refactoring-comparison.md)** - Current vs. proposed comparison

---

## Next Steps

1. ✅ Documentation complete
2. ⏭️ Begin Phase 1: Core Infrastructure
3. ⏭️ Implement and test incrementally
4. ⏭️ Update examples and docs as we go

---

## Approval

✅ **Design approved by framework owner**
✅ **Two-pass model confirmed**
✅ **One-way veto power confirmed**
✅ **Ready for implementation**
