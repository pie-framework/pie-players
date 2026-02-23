# Tool Template Guide

This document provides a complete template for creating new assessment tools.

## Naming Convention

**Package Name Pattern:** `@pie-framework/pie-tool-{name}`

Examples:
- `@pie-framework/pie-tool-protractor`
- `@pie-framework/pie-tool-ruler`
- `@pie-framework/pie-tool-calculator`
- `@pie-framework/pie-tool-highlighter`

## Directory Structure

```
src/lib/tags/tool-{name}/
├── package.json              # Package metadata
├── tool-{name}.svelte        # Main Svelte component
├── index.ts                  # Export barrel
└── README.md                 # Tool documentation
```

## File Templates

### 1. package.json

```json
{
  "name": "@pie-framework/pie-tool-{name}",
  "version": "1.0.0",
  "type": "module",
  "description": "{Brief description of the tool}",
  "keywords": [
    "pie",
    "assessment",
    "tool",
    "{name}"
  ],
  "svelte": "./tool-{name}.svelte",
  "main": "./index.ts",
  "exports": {
    ".": {
      "svelte": "./tool-{name}.svelte",
      "import": "./index.ts"
    }
  },
  "files": [
    "tool-{name}.svelte",
    "index.ts",
    "README.md"
  ],
  "peerDependencies": {
    "svelte": "^4.0.0"
  },
  "license": "MIT"
}
```

### 2. tool-{name}.svelte

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  import type { Tool } from '$lib/assessment-toolkit/tools';

  // Props
  export let visible: boolean = false;
  export let toolId: string = '{name}';

  // State
  let containerEl: HTMLDivElement;
  let isDragging = false;
  let position = { x: 100, y: 100 };
  let dragStart = { x: 0, y: 0 };

  // Tool interface implementation
  const tool: Tool = {
    id: toolId,
    name: '{Name}',
    show: () => { visible = true; },
    hide: () => { visible = false; },
    toggle: () => { visible = !visible; }
  };

  // Drag handlers
  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStart = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    toolCoordinator.bringToFront(toolId);
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      position = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleClose() {
    toolCoordinator.hideTool(toolId);
  }

  onMount(() => {
    toolCoordinator.registerTool(toolId, '{Name}', containerEl);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  onDestroy(() => {
    toolCoordinator.unregisterTool(toolId);
  });

  $: if (containerEl) {
    toolCoordinator.updateToolElement(toolId, containerEl);
  }
</script>

{#if visible}
  <div
    bind:this={containerEl}
    class="tool-{name}"
    style="left: {position.x}px; top: {position.y}px;"
    on:mousedown={handleMouseDown}
    role="dialog"
    aria-label="{Name} Tool"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="tool-header">
      <span class="tool-title">{Name}</span>
      <button 
        class="close-btn" 
        on:click={handleClose} 
        aria-label="Close {name}"
      >
        ×
      </button>
    </div>

    <!-- Tool content goes here -->
    <div class="tool-body">
      <!-- Add your tool's UI here -->
    </div>
  </div>
{/if}

<style>
  .tool-{name} {
    position: fixed;
    min-width: 200px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    cursor: move;
    user-select: none;
  }

  .tool-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    border-radius: 8px 8px 0 0;
    cursor: move;
  }

  .tool-title {
    font-weight: 600;
    font-size: 14px;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #e0e0e0;
    color: #333;
  }

  .tool-body {
    padding: 12px;
  }
</style>
```

### 3. index.ts

```typescript
export { default as Tool{Name} } from './tool-{name}.svelte';
```

### 4. README.md

```markdown
# {Name} Tool

Brief description of what this tool does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

\`\`\`svelte
<script>
  import { Tool{Name} } from '$lib/tags/tool-{name}';
  import { toolCoordinator } from '$lib/assessment-toolkit/tools';
  
  let show{Name} = false;
  
  $: {
    const state = toolCoordinator.getToolState('{name}');
    show{Name} = state?.isVisible ?? false;
  }
</script>

<button on:click={() => toolCoordinator.toggleTool('{name}')}>
  Toggle {Name}
</button>

<Tool{Name} visible={show{Name}} toolId="{name}" />
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `false` | Controls tool visibility |
| `toolId` | `string` | `'{name}'` | Unique identifier for the tool |

## Interactions

### Moving
- Click and drag to move the tool around the screen

### Closing
- Click the × button to close
- Or call `toolCoordinator.hideTool('{name}')`

## Implementation Details

[Add specific implementation details here]

## Accessibility

- `role="dialog"`: Identifies as a dialog
- `aria-label`: Provides accessible name
- `tabindex="-1"`: Allows programmatic focus
- Close button has descriptive label

## Future Enhancements

- [ ] Enhancement 1
- [ ] Enhancement 2
```

## Integration Steps

### 1. Create the Tool

```bash
mkdir src/lib/tags/tool-{name}
cd src/lib/tags/tool-{name}

# Create files from templates above
touch package.json
touch tool-{name}.svelte
touch index.ts
touch README.md
```

### 2. Add to Host Runtime

In your host runtime shell component:

```svelte
<script lang="ts">
  import { Tool{Name} } from '$lib/tags/tool-{name}';
  
  let show{Name} = false;
  
  $: {
    const state = toolCoordinator.getToolState('{name}');
    show{Name} = state?.isVisible ?? false;
  }
</script>

<!-- In tool panel -->
<button 
  class="btn btn-square btn-ghost btn-sm"
  class:btn-active={show{Name}}
  on:click={() => toolCoordinator.toggleTool('{name}')}
  aria-label="{Name}"
>
  <svg><!-- Icon SVG --></svg>
</button>

<!-- At bottom of component -->
<Tool{Name} visible={show{Name}} toolId="{name}" />
```

### 3. Test

1. Start the dev server
2. Navigate to an assessment
3. Click the tool button
4. Verify:
   - Tool appears/disappears on toggle
   - Tool is draggable
   - Tool comes to front when clicked
   - Close button works
   - Tool state persists correctly

## Checklist

- [ ] Created directory `src/lib/tags/tool-{name}/`
- [ ] Added `package.json` with correct naming
- [ ] Implemented `tool-{name}.svelte` component
- [ ] Created `index.ts` export
- [ ] Wrote `README.md` documentation
- [ ] Integrated with assessment player
- [ ] Added tool button to UI
- [ ] Tested all interactions
- [ ] Verified accessibility
- [ ] Added to git

## Examples

See existing tools for reference:
- `src/lib/tags/tool-protractor/` - Simple measurement tool

