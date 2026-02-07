# Section Player Layout System

## Overview

This document proposes a practical, extensible layout system for the PIE Section Player that supports multiple presentation modes while maintaining simplicity and robustness.

## Current State

The section player currently has two modes based on the `keepTogether` attribute:

1. **Page Mode** (`keepTogether: true`) - [PageModeLayout.svelte](../packages/section-player/src/components/PageModeLayout.svelte)
   - Vertical layout: passages first, then all items
   - Single scrollable area
   - All content visible at once

2. **Item Mode** (`keepTogether: false`) - [ItemModeLayout.svelte](../packages/section-player/src/components/ItemModeLayout.svelte)
   - One item at a time with navigation
   - Passages shown for each item
   - Previous/Next controls

## Proposed Enhancement

### Goals

1. **Maintain backward compatibility** - Existing `keepTogether` behavior unchanged
2. **Add layout variants** - Support different presentation styles within page mode
3. **Section player-specific** - Not a framework-wide concern
4. **Simple API** - Easy to configure without complex DSL
5. **Extensible** - Can add new layouts without major refactoring

### Layout Types

#### 1. Vertical Layout (Current - Default)
```
┌─────────────────────┐
│   Passage 1         │
├─────────────────────┤
│   Passage 2         │
├─────────────────────┤
│   Item 1            │
├─────────────────────┤
│   Item 2            │
├─────────────────────┤
│   Item 3            │
└─────────────────────┘
```

**Use Cases:**
- Traditional test format
- Linear reading flow
- Print-friendly
- Mobile devices

#### 2. Split Panel Layout (New)
```
┌──────────┬──────────┐
│          │          │
│ Passage 1│  Item 1  │
│          │          │
│ Passage 2│  Item 2  │
│          │          │
│ (scroll) │  Item 3  │
│          │          │
│          │ (scroll) │
└──────────┴──────────┘
```

**Use Cases:**
- Reading comprehension assessments
- Passages need constant reference
- Desktop/tablet with wider screens
- Reduces scrolling back-and-forth

#### 3. Tabbed Passages Layout (Future)
```
┌─────────────────────┐
│ [Pass 1] [Pass 2]   │
├─────────────────────┤
│   Passage Content   │
├─────────────────────┤
│   Item 1            │
├─────────────────────┤
│   Item 2            │
└─────────────────────┘
```

**Use Cases:**
- Multiple long passages
- Space-constrained displays
- User-controlled passage switching

## API Design

### Option 1: Layout String Enum (Recommended)

Simple, clear, and extensible:

```typescript
<pie-section-player
  section={sectionData}
  layout="vertical"  // or "split-panel" or "tabbed-passages"
  mode="gather"
  view="candidate"
/>
```

**Pros:**
- Simple API
- Easy to document
- Type-safe in TypeScript
- No learning curve

**Cons:**
- Limited configurability per layout

### Option 2: Layout Configuration Object

More flexible but more complex:

```typescript
<pie-section-player
  section={sectionData}
  layout={{
    type: "split-panel",
    passageWidth: "40%",
    itemWidth: "60%",
    minPassageWidth: "300px",
    responsive: true
  }}
  mode="gather"
  view="candidate"
/>
```

**Pros:**
- Highly configurable
- Can customize spacing, sizing, etc.

**Cons:**
- More complex API
- More validation needed
- Harder to document

### Option 3: Hybrid Approach (Balanced)

String enum with optional overrides:

```typescript
<pie-section-player
  section={sectionData}
  layout="split-panel"
  layout-config={{
    passageWidth: "40%"  // Optional overrides
  }}
  mode="gather"
  view="candidate"
/>
```

**Pros:**
- Simple by default
- Extensible when needed
- Progressive complexity

**Cons:**
- Requires documenting two attributes

## Recommendation: **Option 1 (String Enum)** for MVP

Start simple with predefined layouts. Add configuration options later if needed.

## Implementation Strategy

### Phase 1: Add Layout Attribute (MVP)

1. **Add `layout` prop to PieSectionPlayer**
   ```typescript
   layout = 'vertical' as 'vertical' | 'split-panel'
   ```

2. **Create SplitPanelLayout component**
   - Similar structure to PageModeLayout
   - CSS Grid with two scrollable columns
   - Responsive breakpoint for mobile (falls back to vertical)

3. **Update PieSectionPlayer conditional rendering**
   ```svelte
   {#if isPageMode}
     {#if layout === 'split-panel'}
       <SplitPanelLayout ... />
     {:else}
       <PageModeLayout ... />
     {/if}
   {:else}
     <ItemModeLayout ... />
   {/if}
   ```

4. **Update demos to showcase layouts**

### Phase 2: Add Configuration Options (Future)

Add optional `layout-config` attribute for fine-tuning:
```typescript
layoutConfig = {} as {
  passageWidth?: string;
  itemWidth?: string;
  gap?: string;
  // ...future options
}
```

### Phase 3: Additional Layouts (Future)

- Tabbed passages
- Sidebar passages (fixed position)
- Overlay passages (modal on demand)
- Custom layouts via plugin system

## Component Architecture

### File Structure
```
packages/section-player/src/
├── PieSectionPlayer.svelte          # Main component
├── components/
│   ├── layouts/
│   │   ├── PageModeLayout.svelte    # Vertical (renamed from PageModeLayout)
│   │   ├── SplitPanelLayout.svelte  # NEW: Side-by-side
│   │   ├── TabbedLayout.svelte      # FUTURE
│   │   └── layout-utils.ts          # Shared layout utilities
│   ├── PassageRenderer.svelte
│   ├── ItemRenderer.svelte
│   └── ItemModeLayout.svelte        # Unchanged
```

### SplitPanelLayout.svelte Implementation

```svelte
<script lang="ts">
  import type { PassageEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
  import PassageRenderer from '../PassageRenderer.svelte';
  import ItemRenderer from '../ItemRenderer.svelte';

  let {
    passages,
    items,
    itemSessions = {},
    mode = 'gather',
    bundleHost = '',
    esmCdnUrl = 'https://esm.sh',
    playerVersion = 'latest',
    useLegacyPlayer = true,
    ttsService = null,
    toolCoordinator = null,
    highlightCoordinator = null,
    onsessionchanged
  }: {
    passages: PassageEntity[];
    items: ItemEntity[];
    itemSessions?: Record<string, any>;
    mode?: 'gather' | 'view' | 'evaluate' | 'author';
    bundleHost?: string;
    esmCdnUrl?: string;
    playerVersion?: string;
    useLegacyPlayer?: boolean;
    ttsService?: any;
    toolCoordinator?: any;
    highlightCoordinator?: any;
    onsessionchanged?: (itemId: string, session: any) => void;
  } = $props();

  function handleItemSessionChanged(itemId: string) {
    return (event: CustomEvent) => {
      if (onsessionchanged) {
        onsessionchanged(itemId, event.detail);
      }
    };
  }
</script>

<div class="split-panel-layout">
  <!-- Left: Passages -->
  <div class="passages-panel">
    {#if passages.length > 0}
      {#each passages as passage (passage.id)}
        <PassageRenderer
          {passage}
          {bundleHost}
          {esmCdnUrl}
          {ttsService}
          {toolCoordinator}
          {highlightCoordinator}
          class="passage-item"
        />
      {/each}
    {:else}
      <div class="empty-state">No passages</div>
    {/if}
  </div>

  <!-- Right: Items -->
  <div class="items-panel">
    {#each items as item, index (item.id || index)}
      <div class="item-wrapper" data-item-index={index}>
        <ItemRenderer
          {item}
          {mode}
          session={itemSessions[item.id || '']}
          {bundleHost}
          {esmCdnUrl}
          {playerVersion}
          {useLegacyPlayer}
          {ttsService}
          {toolCoordinator}
          {highlightCoordinator}
          onsessionchanged={handleItemSessionChanged(item.id || '')}
          class="item-content"
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .split-panel-layout {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 1rem;
    height: calc(100vh - 200px); /* Adjust based on header/footer */
    padding: 1rem;
  }

  .passages-panel,
  .items-panel {
    overflow-y: auto;
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
  }

  .passages-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .passages-panel :global(.passage-item) {
    padding: 1rem;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }

  .items-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .item-wrapper {
    padding: 1rem;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: #999;
  }

  /* Responsive: Fall back to vertical on narrow screens */
  @media (max-width: 1024px) {
    .split-panel-layout {
      grid-template-columns: 1fr;
      height: auto;
    }

    .passages-panel,
    .items-panel {
      height: auto;
      max-height: none;
    }
  }

  /* Tablet: 50/50 split */
  @media (min-width: 1025px) and (max-width: 1440px) {
    .split-panel-layout {
      grid-template-columns: 50% 50%;
    }
  }

  /* Large screens: Original 40/60 split */
  @media (min-width: 1441px) {
    .split-panel-layout {
      grid-template-columns: 40% 60%;
    }
  }
</style>
```

## Responsive Behavior

### Split Panel Layout Breakpoints

- **Mobile (<1024px)**: Fall back to vertical layout
- **Tablet (1024-1440px)**: 50/50 split
- **Desktop (>1440px)**: 40/60 split (passages narrower)

### User Controls (Future Enhancement)

Add resizable splitter:
```
┌────────────┬───────────┐
│  Passages  ║  Items    │  ← Draggable divider
│            ║           │
└────────────┴───────────┘
```

## Testing Strategy

1. **Unit Tests**
   - Layout component rendering
   - Prop handling
   - Session management

2. **Visual Tests**
   - Each layout variant
   - Responsive breakpoints
   - Overflow handling

3. **Integration Tests**
   - Layout switching
   - Session persistence across layouts
   - Event forwarding

4. **Accessibility Tests**
   - Keyboard navigation
   - Screen reader compatibility
   - Focus management in split panels

## Migration Path

### For Consumers

**Current usage (unchanged):**
```html
<pie-section-player
  section={sectionData}
  mode="gather"
/>
```
*Defaults to vertical layout (backward compatible)*

**New usage:**
```html
<pie-section-player
  section={sectionData}
  layout="split-panel"
  mode="gather"
/>
```

### For Framework Developers

1. Add `layout` prop with default `'vertical'`
2. Create new layout components in `layouts/` folder
3. Update main player to route to correct layout
4. Add tests and documentation
5. Update demos

## Alternative: QTI-Native Approach

Instead of custom `layout` attribute, leverage QTI 3.0 metadata:

```xml
<qti-assessment-section identifier="section1" keepTogether="true">
  <qti-meta>
    <qti-meta-entry key="pie:layout">split-panel</qti-meta-entry>
  </qti-meta>
  ...
</qti-assessment-section>
```

**Pros:**
- Keeps layout in content
- Portable across platforms
- No custom attributes

**Cons:**
- Harder to override at runtime
- Requires QTI parsing
- Less obvious API

**Recommendation:** Support both - QTI metadata as default, attribute as override.

## Security Considerations

- No custom HTML/CSS injection in layout configs
- Validate layout string against enum
- Sanitize any future custom layout templates

## Performance Considerations

- Lazy-load layout components (code-splitting)
- Use CSS Grid/Flexbox (hardware accelerated)
- Virtual scrolling for long item lists (future)
- Memoize layout calculations

## Accessibility Considerations

### Split Panel Layout

- **Landmarks**: Use `<aside>` for passages, `<main>` for items
- **Skip Links**: "Skip to items" link at top
- **Focus Management**: Preserve focus when items update
- **Keyboard Navigation**: Tab order follows visual flow (passages, then items)
- **Screen Readers**: Announce panel structure and relationships
- **Responsive**: Ensure mobile fallback is fully accessible

### Future Layouts

- Each layout must meet WCAG 2.1 AA
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Provide alternative navigation for complex layouts

## Documentation Requirements

1. **API Reference**
   - `layout` prop documentation
   - Layout type descriptions with use cases
   - Responsive behavior per layout

2. **Migration Guide**
   - How to adopt new layouts
   - Backward compatibility notes

3. **Developer Guide**
   - How to create custom layouts
   - Layout component contract
   - Testing custom layouts

4. **User Guide**
   - When to use each layout
   - Visual examples
   - Accessibility features

## Success Metrics

- ✅ Backward compatibility maintained (no breaking changes)
- ✅ Simple API (single attribute for common cases)
- ✅ Extensible (easy to add new layouts)
- ✅ Responsive (works on mobile/tablet/desktop)
- ✅ Accessible (WCAG 2.1 AA compliant)
- ✅ Performant (no jank on scroll)
- ✅ Well-documented (API + examples)

## Open Questions

1. **Default layout for new content?**
   - Keep `vertical` as default for backward compatibility
   - Recommend `split-panel` for new reading comprehension assessments

2. **Should layout be configurable per item?**
   - No, keep it section-level for MVP
   - Future: Support item-level overrides via QTI metadata

3. **Custom layouts via plugins?**
   - Not for MVP
   - Future: Allow registering custom layout components

4. **Layout switching at runtime?**
   - Not for MVP (requires session persistence consideration)
   - Future: Allow user preference toggle

## References

### Internal
- [Current Architecture](./question-layout-engine-architecture.md)
- [PageModeLayout.svelte](../packages/section-player/src/components/PageModeLayout.svelte)
- [ItemModeLayout.svelte](../packages/section-player/src/components/ItemModeLayout.svelte)

### Learnosity's Approach

Based on research of Learnosity's open-source demos and documentation, Learnosity uses two main strategies:

#### 1. Rendering Types

Learnosity offers three distinct rendering modes via the `rendering_type` parameter:

**`inline` rendering**:
- Questions embedded directly into editorial content
- No fixed assessment player UI
- Questions appear contextually within HTML content using `<span class="learnosity-item" data-reference="item-id"></span>`
- Maximum flexibility for formative assessments
- Similar to our PIE ESM player approach

**`assess` rendering**:
- Fixed-form assessment player with structured UI
- Traditional test-taking interface
- Navigation, progress indicators, timers built-in
- Default behavior for summative assessments

**`activities` rendering**:
- Pre-authored activities from Author API
- Fixed configuration defined at authoring time
- Similar to activities created in Learnosity Author site

#### 2. Regions Configuration

Within the `assess` and `activities` modes, Learnosity provides a `regions` configuration in the Items API initialization:

```javascript
config: {
    title: 'Demo activity',
    subtitle: 'Student Name',
    regions: 'main'  // or custom configuration
}
```

**Key Observations:**

1. **Simple Default**: The most common usage is `regions: 'main'` which provides the standard assessment player layout
2. **Customizable**: Regions can be customized to control which UI elements appear and where
3. **UI Personalization**: The regions feature allows "personalizing and extending the Assessment player layout"
4. **Not Content Layout**: Regions appear to control **UI elements** (navigation, progress, tools) rather than **content positioning** (passages vs items)

#### 3. Content Positioning Strategy

Based on the demos examined:

- **Inline mode**: Content layout is entirely controlled by the hosting page's HTML/CSS
- **Assess mode**: Learnosity appears to handle passage/item layout internally without exposed configuration
- **No explicit two-column option**: No evidence of a "passage left, items right" configuration parameter

**Implications for PIE:**

1. Learnosity's flexibility comes from having **distinct rendering modes** for different use cases
2. Layout customization focuses on **UI chrome** (regions) not content positioning
3. The **inline mode** provides ultimate flexibility but requires host application to handle layout
4. Traditional assessment mode appears to use **vertical layout** as the standard

### External Patterns
Based on common assessment platform patterns:
- **Two-panel reading passages**: Used by SAT, ACT digital formats
- **Vertical flow**: Traditional paper test simulation (Learnosity default)
- **Inline embedding**: Learnosity's approach for formative assessments
- **Tabbed content**: Common in learning management systems

### QTI 3.0 Spec
- [QTI 3.0 Assessment Section](https://www.imsglobal.org/spec/qti/v3p0/impl#h.assessment-section)
- [Metadata Extensions](https://www.imsglobal.org/spec/qti/v3p0/impl#h.metadata)

## Research Summary: Learnosity's Layout Strategy

### What Learnosity Does

After researching Learnosity's open-source demos and documentation, here's what I found:

**1. Multiple Rendering Modes (Not Layout Variants)**

Learnosity solves layout flexibility through **distinct rendering types** rather than layout configuration:

- **`inline`**: Questions embedded in custom HTML/CSS - host controls everything
- **`assess`**: Standard assessment player - Learnosity controls layout (appears to be vertical)
- **`activities`**: Pre-authored from Author API

**2. Regions = UI Chrome, Not Content Layout**

The `config.regions` parameter controls **UI elements** (navigation, tools, progress bars), NOT content positioning (passages vs items).

```javascript
config: {
    regions: 'main'  // Controls which UI elements appear, not content layout
}
```

**3. No Evidence of Split-Panel Configuration**

- No `layout: "split-panel"` or similar parameter found
- No passage positioning options (left/right/top)
- Vertical layout appears to be the standard for assess mode
- Maximum flexibility achieved through `inline` mode where host provides layout

### Key Insights for PIE

1. **Learnosity's flexibility comes from mode switching**, not layout configuration within a mode
2. Their `regions` feature is about **customizing UI chrome**, not content positioning
3. For maximum layout control, they rely on **inline rendering** where the host application handles layout
4. Traditional assessment mode uses **vertical layout** as the standard approach

### Recommended Strategy for PIE

Based on this research and assessment platform patterns, I recommend:

**Phase 1: Simple Layout Enum (MVP)**

```typescript
<pie-section-player
  layout="vertical"  // or "split-panel"
  section={sectionData}
/>
```

**Why This Approach:**

1. **Simpler than Learnosity**: We provide layout variants within our player, they require switching rendering modes
2. **More flexible than competitors**: Many platforms only offer vertical layout
3. **Progressive enhancement**: Start simple, can add configuration options later if needed
4. **Clear use cases**: Vertical for traditional tests, split-panel for reading comprehension

**What We Won't Do (Learning from Learnosity):**

- ❌ Complex regions-based UI customization system (too much complexity for our needs)
- ❌ Multiple rendering modes (we already have different players for different needs)
- ❌ Authoring-time-only configuration (want runtime flexibility)

**What We Will Do (Improving on Learnosity):**

- ✅ Simple string enum for layout selection
- ✅ Responsive behavior (mobile fallback to vertical)
- ✅ Clear, documented use cases for each layout
- ✅ Section player-specific (not framework-wide)

## Next Steps

1. **Validate approach** with stakeholders
2. **Prototype SplitPanelLayout** component
3. **Update PieSectionPlayer** with layout routing
4. **Add to section-demos** app with layout selector
5. **Document API** and usage patterns
6. **Gather feedback** from users
7. **Consider future enhancements**:
   - Optional configuration object for fine-tuning
   - Resizable splitter for split-panel mode
   - Additional layouts based on user feedback
