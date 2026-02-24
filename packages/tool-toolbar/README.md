# Tool Toolbar (`<pie-tool-toolbar>`)

A **self-contained** tool management component that handles everything: instantiates tools, manages their state, and renders the toolbar UI. Clients can drop it in without any setup.

## Overview

The Tool Toolbar is a complete tool orchestration system that:

- **Instantiates** all configured tool components
- **Manages** tool visibility via `toolCoordinator` store
- **Renders** toolbar UI with buttons
- **Coordinates** z-index and tool lifecycle

## Zero-Setup Usage

### Minimal Example

```html
<pie-tool-toolbar></pie-tool-toolbar>
```

That's it! This gives you all tools with default configuration.

### Custom Tool Selection

```html
<pie-tool-toolbar tools="protractor,ruler,graph"></pie-tool-toolbar>
```

### As Svelte Component

```svelte
<script>
  import ToolToolbar from '$lib/tags/tool-toolbar';
</script>

<ToolToolbar
  tools="protractor,ruler,lineReader,graph,periodicTable"
  position="right"
/>
```

## What It Includes

The toolbar automatically manages these tools:

### Tier 1 Tools (Measurement & Visualization)

- **Protractor** - Angle measurement
- **Ruler** - Length measurement
- **Line Reader** - Reading guide overlay
- **Graph** - Coordinate plane with graphing
- **Periodic Table** - Element reference

## Props

| Prop | Type | Default | Description |
| ------ | ------ | ------- | ----------- |
| `tools` | `String` | All tools | Comma-separated tool IDs to enable |
| `disabled` | `Boolean` | `false` | Disables all buttons |
| `position` | `'left' \| 'right'` | `'right'` | Toolbar placement |
| `showLabels` | `Boolean` | `false` | Show text labels under icons |

## Available Tools

Tool IDs you can use in the `tools` prop:

- `protractor` - Angle measuring tool ✅
- `ruler` - Length measuring tool ✅
- `lineReader` - Reading guide overlay ✅
- `graph` - Coordinate plane ✅
- `periodicTable` - Element reference ✅
- `calculator` - Basic calculator ⚠️ Not yet implemented
- `highlighter` - Text highlighting ⚠️ Not yet implemented (use annotation toolbar instead)

**Note:** Text-to-Speech is integrated into the annotation toolbar (shown when text is selected), not as a standalone tool.

## Architecture

```text
┌──────────────────────────────────┐
│ <pie-tool-toolbar>               │
│  Self-Contained Component        │
├──────────────────────────────────┤
│ ┌──────────────┐ ┌─────────────┐ │
│ │ Toolbar UI   │ │ Tool Store  │ │
│ │ - Buttons    │ │ (Reactive)  │ │
│ │ - State      │←┤             │ │
│ └──────────────┘ └─────────────┘ │
│                                   │
│ ┌─────────────────────────────┐  │
│ │ Tool Instances              │  │
│ │ <ToolProtractor />          │  │
│ │ <ToolRuler />               │  │
│ │ <ToolGraph />               │  │
│ │ ...                         │  │
│ └─────────────────────────────┘  │
│                                   │
│ ┌─────────────────────────────┐  │
│ │ <AnnotationToolbar />       │  │
│ │ (Text selection tools)      │  │
│ └─────────────────────────────┘  │
└──────────────────────────────────┘
```

### No External Dependencies

Unlike typical toolbars, **you don't need**:

- ❌ Separate tool manager component
- ❌ Manual tool instantiation
- ❌ State management setup
- ❌ Event wiring

Everything is built-in!

## Styling

The toolbar uses CSS custom properties:

```css
--tool-toolbar-bg
--tool-toolbar-border
--tool-toolbar-button-bg
--tool-toolbar-button-hover-bg
--tool-toolbar-button-active-bg
--tool-toolbar-focus-color
```

## How It Works

1. **Parse `tools` prop** → Determines which tools to enable
2. **Subscribe to `toolCoordinator`** → Reactive state management
3. **Build button config** → Icons, names, toggle functions
4. **Render toolbar UI** → Buttons with active states
5. **Instantiate tools** → Only render visible tool components
6. **Handle events** → Emit status updates for tool toggles

## Real-World Example

```svelte
<!-- Assessment Player -->
<script>
  import ToolToolbar from '$lib/tags/tool-toolbar';
</script>

<div class="assessment-layout">
  <main>
    <!-- Question content -->
  </main>

  <ToolToolbar
    tools="protractor,ruler,graph"
  />
</div>
```

## Browser-Only

This component requires browser APIs and will not render during SSR. It's wrapped in `{#if browser}` internally.

## Custom Element Tag

`<pie-tool-toolbar>`

- Compiled with `shadow: 'none'` for Light DOM rendering
- Works in any framework or vanilla JS
- Manages all tool lifecycle internally
