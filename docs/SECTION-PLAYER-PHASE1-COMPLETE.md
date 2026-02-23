# Section Player - Phase 1 Complete

**Date**: 2026-02-05
**Status**: Phase 1 Implementation Complete ✅

---

## What Was Built

### Core Files Created

1. **[packages/assessment-toolkit/src/player/section/types.ts](../packages/assessment-toolkit/src/player/section/types.ts)**
   - `SectionPlayerConfig` - Configuration interface
   - `ItemNavigationState` - Navigation state for item mode
   - `PassagePlayerInstance` - Wrapper for passage players
   - `ItemPlayerInstance` - Wrapper for item players

2. **[packages/assessment-toolkit/src/player/section/SectionPlayer.ts](../packages/assessment-toolkit/src/player/section/SectionPlayer.ts)**
   - Core `SectionPlayer` class implementation
   - Supports both `keepTogether` modes (page and item)
   - Passage extraction from rubricBlocks and item.passage
   - Player creation and rendering
   - Service integration (TTS, tools, theme, highlight)

3. **[packages/assessment-toolkit/src/player/section/index.ts](../packages/assessment-toolkit/src/player/section/index.ts)**
   - Module exports

4. **Section player usage examples**
   - Complete usage examples were added to demo hosts during phase work
   - Paired passages example
   - Item-by-item example
   - Full assessment structure

### Exports Added

Updated [packages/assessment-toolkit/src/index.ts](../packages/assessment-toolkit/src/index.ts) to export:
- `SectionPlayer` class
- `SectionPlayerConfig` type
- `ItemNavigationState` type
- `ItemPlayerInstance` type
- `PassagePlayerInstance` type

---

## Key Features Implemented

### ✅ Passage Handling

The SectionPlayer correctly handles passages from **two sources**:

1. **Section-level passages** (primary) - From `section.rubricBlocks[]` where `use="passage"`
2. **Item-linked passages** (legacy PIE) - From `itemRef.item.passage`

Both are `PassageEntity` with PIE configs and rendered identically using ItemPlayer.

**Deduplication**: If same passage appears in both sources, it's shown once (by `passage.id`).

```typescript
private extractContent(): void {
  const view = this.config.view || "candidate";
  const passageMap = new Map<string, PassageEntity>();

  // 1. Extract from rubricBlocks (section-level)
  for (const rb of this.config.section.rubricBlocks || []) {
    if (rb.view === view && rb.use === "passage" && rb.passage) {
      passageMap.set(rb.passage.id, rb.passage);
    }
  }

  // 2. Extract items and their linked passages
  for (const itemRef of this.config.section.assessmentItemRefs || []) {
    if (itemRef.item) {
      this.items.push(itemRef.item);

      // Item-linked passage (deduplicated)
      if (itemRef.item.passage && typeof itemRef.item.passage === "object") {
        if (!passageMap.has(itemRef.item.passage.id)) {
          passageMap.set(itemRef.item.passage.id, itemRef.item.passage);
        }
      }
    }
  }

  this.passages = Array.from(passageMap.values());
}
```

### ✅ Two Rendering Modes

**1. Page Mode** (`keepTogether: true`)
- All items and passages rendered together
- No item navigation within section
- Ideal for paired passages, multi-item pages

```typescript
private renderPage(): HTMLElement {
  const container = document.createElement("div");
  container.className = "section-player section-player--page-mode";

  // Instructions
  // Passages
  // All items

  return container;
}
```

**2. Item Mode** (`keepTogether: false`)
- One item at a time
- Passages visible across all items
- Item navigation: `navigateNextItem()`, `navigatePreviousItem()`

```typescript
private renderSingleItem(): HTMLElement {
  const container = document.createElement("div");
  container.className = "section-player section-player--item-mode";

  // Passages (visible for all items)
  // Current item only

  return container;
}
```

### ✅ Service Integration

All services are properly integrated:

- ✅ **EventBus** - Event coordination
- ✅ **ContextVariableStore** - QTI 3.0 context variables
- ✅ **TTSService** - Text-to-speech
- ✅ **ToolCoordinator** - Calculator and tool management
- ✅ **ThemeProvider** - Accessibility themes
- ✅ **HighlightCoordinator** - Annotations and highlighting
- ✅ **I18nService** - Internationalization
- ✅ **DesmosProvider** - Desmos calculator
- ✅ **TIProvider** - TI calculator

### ✅ Player Creation

```typescript
// Passages use 'view' mode (always)
private async createPassagePlayer(passage: PassageEntity): Promise<HTMLElement> {
  const player = document.createElement("pie-esm-player");
  player.setAttribute("config", JSON.stringify(passage.config));
  player.setAttribute("env", JSON.stringify({ mode: "view" }));
  if (this.config.bundleHost) {
    player.setAttribute("bundle-host", this.config.bundleHost);
  }
  return player;
}

// Items use configured mode (gather, view, evaluate, author)
private async createItemPlayer(item: ItemEntity): Promise<HTMLElement> {
  const mode = this.config.mode || "gather";
  const player = document.createElement("pie-esm-player");
  player.setAttribute("config", JSON.stringify(item.config));
  player.setAttribute("env", JSON.stringify({ mode }));
  // ... session restoration, bundle host
  return player;
}
```

### ✅ Session Management

```typescript
// Restore item sessions
private getItemSession(itemId: string): any | undefined {
  return this.config.itemSessions?.[itemId];
}

// Apply to player
if (session) {
  player.setAttribute("session", JSON.stringify(session));
}
```

---

## Usage Example

```typescript
import { SectionPlayer } from '@pie-players/assessment-toolkit';

// Create section player
const sectionPlayer = new SectionPlayer({
  section: qtiSection,  // Fully resolved with passages and items
  mode: 'gather',
  view: 'candidate',
  bundleHost: 'https://cdn.pie.org',
  services: {
    eventBus,
    contextStore,
    ttsService,
    toolCoordinator
  }
});

// Initialize (creates players)
await sectionPlayer.initialize();

// Render
const container = document.getElementById('section-container');
container.appendChild(sectionPlayer.render());

// For item mode: navigate
await sectionPlayer.navigateNextItem();

// Access current item
const item = sectionPlayer.getCurrentItem();

// Listen to changes
sectionPlayer.onNavigationChange((state) => {
  console.log('Navigation state:', state);
});

// Cleanup
sectionPlayer.destroy();
```

---

## What's Next

### Phase 2: Refactor AssessmentPlayer

**Goal**: Simplify AssessmentPlayer to use SectionPlayer

**Tasks**:
1. Update AssessmentPlayer to instantiate SectionPlayer for each section
2. Remove item rendering logic from AssessmentPlayer
3. Move service instantiation to AssessmentPlayer (inject into SectionPlayer)
4. Update navigation to work at section level
5. Test backward compatibility

### Phase 3: Add Svelte Component

**Goal**: Create Svelte wrapper for SectionPlayer

**Tasks**:
1. Create `SectionPlayerComponent.svelte`
2. Handle player lifecycle (mount, update, unmount)
3. Add reactive bindings for navigation state
4. Add slot support for custom layouts

### Phase 4: Layout Engine

**Goal**: Implement paired passage layout modes

**Tasks**:
1. Implement tabs layout
2. Implement side-by-side layout
3. Implement stacked layout
4. Implement collapsible/accordion layout
5. Add responsive behavior

---

## Testing Checklist

### Unit Tests Needed

- [ ] Passage extraction (rubricBlocks + item.passage)
- [ ] Passage deduplication by ID
- [ ] View filtering (candidate, scorer, author)
- [ ] Page mode rendering
- [ ] Item mode rendering
- [ ] Item navigation in item mode
- [ ] Session restoration
- [ ] Service injection
- [ ] Event emission

### Integration Tests Needed

- [ ] SectionPlayer with AssessmentPlayer
- [ ] Multiple sections in assessment
- [ ] Section-to-section navigation
- [ ] Tool coordination across sections
- [ ] Context variable persistence

---

## Success Criteria (Phase 1) ✅

- ✅ SectionPlayer can render a section with `keepTogether: true`
- ✅ SectionPlayer can render a section with `keepTogether: false`
- ✅ Handles passages from rubricBlocks (section-level)
- ✅ Handles passages from item.passage (item-linked)
- ✅ Deduplicates passages correctly
- ✅ All services (TTS, Theme, Tools) integrated
- ✅ Player creation for passages and items
- ✅ Session management for items
- ✅ Event handling and lifecycle methods
- ✅ Usage examples created
- ✅ **Builds successfully with TypeScript compilation**

## Build Status

✅ **SectionPlayer compiles successfully!**

Build artifacts created in `dist/player/section/`:
- `SectionPlayer.js` / `SectionPlayer.d.ts`
- `types.js` / `types.d.ts`
- `index.js` / `index.d.ts`

All SectionPlayer code compiles without errors. The package has some pre-existing TypeScript errors in `src/tools/calculators/ti-provider.ts` that are unrelated to the SectionPlayer implementation.

---

## Design Decisions

### 1. Simple Direct Implementation

No strategy pattern - just conditional logic based on `keepTogether`:

```typescript
if (this.isPageMode()) {
  return this.renderPage();
} else {
  return this.renderSingleItem();
}
```

**Rationale**: Only two modes, no evolution expected.

### 2. PIE-Native Entities

We use `PassageEntity` and `ItemEntity` with PIE configs, not HTML strings or external references.

**Rationale**: QTI-aligned structure, PIE-native content. No loading logic in players.

### 3. Service Injection

All services are injected via config, with fallback to new instances.

**Rationale**: Testable, flexible, allows sharing services between AssessmentPlayer and SectionPlayer.

### 4. Two-Source Passage Handling

Support both `rubricBlocks` and `item.passage` for backward compatibility.

**Rationale**: Legacy PIE assessments use `item.passage`. New QTI 3.0-aligned assessments use `rubricBlocks`.

---

## Related Documents

- [Section Player Implementation Plan](./SECTION-PLAYER-IMPLEMENTATION-PLAN.md) - Full 6-phase plan
- [Section Structure Design](./SECTION-STRUCTURE-DESIGN.md) - Data model rationale
- [QTI 3.0 Paired Passages Design](./qti3-paired-passages-design.md) - Paired passage specifics
- [Architecture](./ARCHITECTURE.md) - Overall architecture

---

## Notes

- Phase 1 is **standalone** - SectionPlayer can be used independently of AssessmentPlayer
- AssessmentPlayer still works with its old logic (Phase 2 will refactor it)
- No breaking changes to existing APIs
- All new code follows existing patterns and conventions
