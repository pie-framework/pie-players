# PIE Section Player - Architecture

**Package**: `@pie-players/pie-section-player`
**Type**: Svelte Web Component
**Status**: Complete ✅

---

## Overview

The PIE Section Player is a **framework-agnostic web component** for rendering QTI 3.0 assessment sections with passages and items. It follows the established pattern in this project of using **Svelte internally** while exposing a **web component externally**.

---

## Architectural Pattern: Hybrid Approach

### Boundary Layer Strategy

```
┌──────────────────────────────────────────────┐
│  Web Component (Framework Agnostic)          │
│  <pie-section-player>                        │  ← External API
│  - Exposed via customElement                 │
│  - Usable in any framework                   │
└────────────────┬─────────────────────────────┘
                 │
    ┌────────────▼────────────┐
    │  Svelte Components      │  ← Internal Implementation
    │  - PieSectionPlayer     │     Pure Svelte for reactivity
    │  - PageModeLayout       │     No web component overhead
    │  - ItemModeLayout       │
    │  - PassageRenderer      │
    │  - ItemRenderer         │
    │  - ItemNavigation       │
    └────────────┬────────────┘
                 │
    ┌────────────▼────────────┐
    │  Leaf Web Components    │  ← Extensibility Points
    │  <pie-esm-player>       │     Framework-agnostic leaves
    └─────────────────────────┘
```

### Why This Pattern?

**✅ Web Components at Boundaries:**
- `<pie-section-player>` - Framework-agnostic external API
- `<pie-esm-player>` - Reusable item/passage rendering
- Clients can use in React, Vue, Angular, vanilla JS

**✅ Svelte Internally:**
- No prop serialization overhead between parent/child
- Full Svelte reactivity and composition
- Clean, maintainable code
- No web component impedance mismatch

**✅ Best of Both Worlds:**
- External: Framework-agnostic web components
- Internal: Reactive Svelte components
- Clear boundaries with explicit contracts

---

## Component Structure

### External API (Web Component)

**`PieSectionPlayer.svelte`**
```svelte
<svelte:options customElement={{ tag: 'pie-section-player', shadow: 'none' }} />

<script>
  // Receives props via attributes
  // Dispatches CustomEvents for communication
  // Uses internal Svelte components for rendering
</script>
```

### Internal Svelte Components (Not Exposed)

1. **`PageModeLayout.svelte`** - Renders all items + passages (keepTogether: true)
2. **`ItemModeLayout.svelte`** - Renders one item at a time (keepTogether: false)
3. **`PassageRenderer.svelte`** - Renders a single passage using `<pie-esm-player>`
4. **`ItemRenderer.svelte`** - Renders a single item using `<pie-esm-player>`
5. **`ItemNavigation.svelte`** - Navigation controls for item mode

### Key Benefits

- **No JSON serialization** between PieSectionPlayer → PageModeLayout (Svelte props)
- **Full reactivity** - `$derived`, `$effect`, `$state` work naturally
- **Composable** - Easy to add new layouts or customize existing ones
- **Testable** - Internal components can be tested independently

---

## Data Flow

### Props (Attributes)

```html
<pie-section-player
  section='{"identifier":"sec-1","keepTogether":true,...}'
  mode="gather"
  view="candidate"
  session-state='{"itemSessions":{}}'
  bundle-host="https://cdn.pie.org"
  esm-cdn-url="https://esm.sh"
></pie-section-player>
```

### Events (CustomEvents)

```javascript
player.addEventListener('section-loaded', (e) => {
  // { sectionId, itemCount, passageCount, isPageMode }
});

player.addEventListener('item-changed', (e) => {
  // { previousItemId, currentItemId, itemIndex, totalItems }
});

player.addEventListener('session-changed', (e) => {
  // { itemId, session, sessionState, itemSessions, timestamp }
});
```

### Internal Communication (Svelte Props)

```svelte
<!-- No serialization - direct Svelte reactivity -->
<PageModeLayout
  {passages}           <!-- PassageEntity[] -->
  {items}              <!-- ItemEntity[] -->
  {itemSessions}       <!-- Record<string, any> -->
  {mode}               <!-- string -->
/>
```

---

## Rendering Modes

### Page Mode (`keepTogether: true`)

**Use Case**: Paired passages, multi-item pages, print assessments

**Component**: `PageModeLayout.svelte`

**Renders**:
- All passages (deduplicated)
- All items simultaneously
- No navigation controls

### Item Mode (`keepTogether: false`)

**Use Case**: Linear assessments, adaptive tests, item-by-item delivery

**Component**: `ItemModeLayout.svelte`

**Renders**:
- All passages (persistent across items)
- Current item only
- Previous/Next navigation controls

---

## Passage Extraction

Passages are extracted from **two sources** and deduplicated by ID:

### 1. Section-Level (QTI 3.0 Style)

```typescript
section.rubricBlocks
  .filter(rb => rb.view === 'candidate' && rb.use === 'passage')
  .map(rb => rb.passage)
```

### 2. Item-Linked (Legacy PIE)

```typescript
section.assessmentItemRefs
  .map(ref => ref.item?.passage)
  .filter(p => p && typeof p === 'object')
```

### Deduplication

```typescript
const passageMap = new Map<string, PassageEntity>();
// Add from both sources
passages = Array.from(passageMap.values());
```

---

## Session Management

### Initialization Contract

Section player accepts host-facing `sessionState` as the only session input.
When omitted, it initializes an empty canonical attempt state internally.

Host/integrator persists `sessionState` directly (no canonical attempt payload required).

### Restoration

```svelte
<ItemRenderer
  item={currentItem}
  session={itemSessions[currentItem.id]}  <!-- Restore from props -->
/>
```

### Updates

```svelte
// Internal session updates flow through runtime context:
// ItemRenderer -> reportSessionChanged(itemId, detail) -> section-level canonical update.
//
// Section player then emits host-facing CustomEvent('session-changed', detail).
```

---

## Why Not Web Components Throughout?

### Problems with Web Component Composition

❌ **Prop Serialization:**
```svelte
<!-- Web component: Must serialize to JSON -->
<my-child-component
  data={JSON.stringify(complexObject)}  <!-- Serialization overhead -->
></my-child-component>

<!-- Svelte: Direct object passing -->
<MyChildComponent data={complexObject} />  <!-- Zero overhead -->
```

❌ **No Reactivity:**
```svelte
<!-- Web component: Manual updates required -->
<my-child items={JSON.stringify(items)}></my-child>
<!-- If items changes, must manually update attribute -->

<!-- Svelte: Automatic reactivity -->
<MyChild {items} />  <!-- Auto-updates when items changes -->
```

❌ **Event Complexity:**
```svelte
<!-- Web component: CustomEvents only -->
<my-child onupdate={handleUpdate}></my-child>
<!-- Must use addEventListener, manually cleanup -->

<!-- Svelte: Direct function props -->
<MyChild onupdate={handleUpdate} />  <!-- Automatic cleanup -->
```

### Where Web Components Make Sense

✅ **Product Boundaries** - Between assessment player and client apps
✅ **Extensibility Points** - Where clients may provide custom implementations
✅ **Leaf Components** - Self-contained, minimal parent-child communication

---

## Comparison to Other Players

### Same Pattern as Existing Players

**`@pie-players/pie-esm-player`**:
- Svelte component with `<svelte:options customElement>`
- Uses internal Svelte components (`PieItemPlayer.svelte`)
- Published as web component

**Legacy assessment runtime**:
- A separate wrapper runtime was previously used
- Section-player now serves as the supported assessment runtime surface

**`@pie-players/pie-section-player`** (NEW):
- Pure Svelte components internally
- Exposes web component externally
- Uses `<pie-esm-player>` for item/passage rendering

---

## Build Output

```
dist/
├── pie-section-player.js        # 97KB (27KB gzipped)
├── pie-section-player.js.map
├── pie-section-player.d.ts
└── index.d.ts
```

**Usage**:
```html
<script type="module">
  import '@pie-players/pie-section-player';
</script>

<pie-section-player section='{...}'></pie-section-player>
```

---

## Integration with Assessment Toolkit

The **Section Player is the primary interface** for integrating assessment toolkit services.

### Service Integration Pattern

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  AccessibilityCatalogResolver,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const catalogResolver = new AccessibilityCatalogResolver(
  assessment.accessibilityCatalogs || [],
  'en-US'
);

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);
ttsService.setHighlightCoordinator(highlightCoordinator);

// Pass services to section player (JavaScript properties, NOT HTML attributes)
const sectionPlayer = document.getElementById('section-player');
sectionPlayer.ttsService = ttsService;
sectionPlayer.toolCoordinator = toolCoordinator;
sectionPlayer.highlightCoordinator = highlightCoordinator;
sectionPlayer.catalogResolver = catalogResolver;

// Section player automatically:
// - Extracts SSML from passages and items
// - Manages item-level catalog lifecycle
// - Renders TTS tools inline in headers
// - Handles catalog resolution
```

### Future: AssessmentPlayer Integration

A reference `AssessmentPlayer` may be implemented as a convenience wrapper for multi-section assessments. It would:
- Manage navigation across sections
- Coordinate section player instances
- Provide assessment-level state management
- But delegate to section players for rendering and toolkit integration

The section player remains the primary interface for toolkit services.

---

## Key Design Decisions

### 1. Hybrid Architecture ✅

- **External**: Web components for framework agnosticism
- **Internal**: Svelte for reactivity and composition
- **Boundaries**: Clear contracts at product boundaries

### 2. No Vanilla TypeScript Controller ✅

Unlike `AssessmentPlayer` (which has a TS class + Svelte wrapper), the `SectionPlayer` is **pure Svelte**:
- Simpler architecture
- Better reactivity
- Easier to maintain
- Still exposed as web component

### 3. Reuse Existing Players ✅

Uses `<pie-esm-player>` for all item and passage rendering:
- No reimplementation
- Consistent rendering
- Extensibility maintained

---

## Future Enhancements

### Phase 2: Enhanced Layouts

Add support for paired passage layouts:
- Tabs layout
- Side-by-side layout
- Stacked layout
- Collapsible layout

Create new internal components:
- `PairedPassageTabs.svelte`
- `PairedPassageSideBySide.svelte`

### Phase 3: Tool Integration ✅ Complete

**Status**: Implemented

Tool coordination from assessment-toolkit integrated:
- ✅ TTS service integration with automatic SSML extraction
- ✅ ToolCoordinator for z-index management
- ✅ HighlightCoordinator for CSS Custom Highlight API
- ✅ AccessibilityCatalogResolver for QTI 3.0 catalogs

Services passed via JavaScript properties (not HTML attributes).

See [TTS-INTEGRATION.md](./TTS-INTEGRATION.md) for complete details.

### Phase 4: Enhanced Layouts

Add support for paired passage layouts:
- Tabs layout
- Side-by-side layout
- Stacked layout
- Collapsible layout

Create new internal components:
- `PairedPassageTabs.svelte`
- `PairedPassageSideBySide.svelte`

---

## Related Documents

- [README.md](./README.md) - Usage documentation
- [demo.html](./demo.html) - Live demo
- [SECTION-PLAYER-IMPLEMENTATION-PLAN.md](../../docs/SECTION-PLAYER-IMPLEMENTATION-PLAN.md) - Original plan
- [SECTION-STRUCTURE-DESIGN.md](../../docs/SECTION-STRUCTURE-DESIGN.md) - Data model design
