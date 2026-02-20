# Reference Layout

A reference assessment layout implementation for PIE assessments.

## Overview

This directory contains a complete layout implementation demonstrating a production-ready assessment interface. It provides:

- Three-column layout (passage | item | notes)
- Top bar with accommodations and assessment controls
- Navigation bar with question selector and numbered navigation
- Bottom bar with item-level tools
- Item-specific inline tools (answer eliminator, notes)

## Architecture

This layout is **presentation-only** - it orchestrates visual layout but delegates all business logic to:
- `AssessmentPlayer` for navigation and state management
- Assessment Toolkit services (ToolCoordinator, TTSService, etc.)
- Existing tool components from `/lib/tags/tool-*`

## Components

### Main Component

- **ReferenceLayout.svelte** - Main layout orchestrator

### Sub-Components

- **AssessmentHeader.svelte** - Top bar with accommodations and assessment actions
- **AssessmentNavigation.svelte** - Question selector and numbered navigation
- **AssessmentContent.svelte** - Three-column content container
  - **PassagePanel.svelte** - Left column for passages (optional)
  - **ItemPanel.svelte** - Middle column for questions/items
  - **NotesPanel.svelte** - Right sidebar for notes (optional)
- **AssessmentToolsBar.svelte** - Bottom bar with item-level tools
- **AssessmentFooter.svelte** - Footer with navigation and actions

## Usage

### Direct Usage

```svelte
<script>
  import { AssessmentPlayer } from '$lib/assessment-toolkit/reference-implementation';
  import { ReferenceLayout } from '$lib/assessment-toolkit/reference-layout';

  const player = new AssessmentPlayer({
    assessment,
    organizationId,
    bundleHost,
    mode: 'gather',
    role: 'student',
    // ...
  });
</script>

<ReferenceLayout {player} {assessment} />
```

### Via Reference Implementation

The reference implementation provides a wrapper that uses this layout:

```svelte
<script>
  import { ReferenceAssessmentLayout } from '$lib/assessment-toolkit/reference-implementation';
</script>

<ReferenceAssessmentLayout {assessment} {organizationId} />
```

## Key Features

### Tool Placement

Tools are visually grouped into different areas but use the same interface:

1. **Accommodations (Top Right)**
   - Audio (TTS)
   - Translation
   - Contrast (Color Scheme)
   - Fullscreen

2. **Assessment Actions (Top Center)**
   - Overall Instructions
   - Resources
   - Review Summary
   - Finish Later
   - Flag Question

3. **Item-Level Tools (Bottom Bar)**
   - Calculator
   - Graph
   - Periodic Table
   - Protractor
   - Line Reader
   - Text Magnifier
   - Ruler

4. **Item-Specific (Inline)**
   - Answer Eliminator (inline with choices)
   - Notes (right sidebar)

### Passage Support

- Automatically detects passages from items
- Loads passages on demand
- Renders passages in left column using `<pie-iife-player>`

### Responsive Design

- Desktop: Full three-column layout
- Tablet: Hides notes column, two-column layout
- Mobile: Single column with tools in menu

## Dependencies

This layout requires:

- `AssessmentPlayer` from `reference-implementation`
- Assessment Toolkit services (ToolCoordinator, TTSService, etc.)
- Existing tool components from `/lib/tags/tool-*`
- `<pie-iife-player>` for rendering items and passages

## Status

🚧 **Under development** - Implementation in progress. See [LAYOUT-PLAN.md](./LAYOUT-PLAN.md) for detailed implementation plan.

## Related Documentation

- [LAYOUT-PLAN.md](./LAYOUT-PLAN.md) - Detailed implementation plan
- [../reference-implementation/README.md](../reference-implementation/README.md) - Reference implementation documentation
- [../../docs/tools-high-level-architecture.md](../../docs/tools-high-level-architecture.md) - Tools architecture overview

