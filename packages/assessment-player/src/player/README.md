# PIE Assessment Toolkit - Assessment Player

This directory contains an **optional assessment player implementation** showing how to wire toolkit services together.

## Purpose

- **Learning**: See how services work together
- **Quick Start**: Products can use as-is or extend
- **Customization**: Extend or copy patterns

Products like Quiz Engine can ignore this and use toolkit services directly.

## What's Included

- **AssessmentPlayer** - Core player class with navigation and state management
- **ReferenceAssessmentLayout** - Complete assessment UI using reference layout
- Linear navigation (sequential items)
- Basic session state management
- Event wiring examples

## Architecture

The default implementation consists of two parts:

1. **AssessmentPlayer** (`AssessmentPlayer.ts`)
   - Core business logic
   - Navigation and state management
   - Integration with assessment toolkit services
   - Framework-agnostic (plain TypeScript class)

2. **ReferenceAssessmentLayout** (TBD)
   - Visual presentation layer
   - Uses `ReferenceLayout` from `../reference-layout`
   - Wires AssessmentPlayer to visual components
   - Demonstrates complete assessment UI

This separation allows:
- **AssessmentPlayer** to be used with any layout
- **ReferenceLayout** to be used independently or with other players
- Products to mix and match components as needed

## What's Not Included (Product-Specific)

- Backend integration (each product different)
- Adaptive navigation algorithms
- Branching logic
- Scoring/grading
- LTI integration
- Authentication/authorization

## Usage

### Using ReferenceAssessmentLayout (Recommended)

The simplest way to get a complete assessment UI:

```svelte
<script>
  import AssessmentLayout from '@pie-players/pie-assessment-player/Layout.svelte';
</script>

<AssessmentLayout
  {assessment}
  {organizationId}
  bundleHost="prod"
/>
```

### Using AssessmentPlayer Directly

If you want to use your own layout:

```typescript
import { AssessmentPlayer } from '@pie-players/pie-assessment-player/player';

const player = new AssessmentPlayer({
  assessment,
  organizationId,
  bundleHost,
  mode: 'gather',
  role: 'student',
  // ...
});

// Subscribe to state changes
player.onNavigationChange((state) => {
  // Handle navigation state
});

player.onItemChange((item) => {
  // Handle item changes
});

// Navigate to first item
await player.start();
```

### Using ReferenceLayout Directly

If you want to use the reference layout with a different player:

```svelte
<script>
  import { ReferenceLayout } from '$lib/assessment-toolkit/reference-layout';
  // ... create your own player instance
</script>

<ReferenceLayout {player} {assessment} />
```

### Using Services Directly

If you want complete control:

```typescript
import { TypedEventBus, ToolCoordinator, TTSService } from '$lib/assessment-toolkit';

// Wire up services yourself
const eventBus = new TypedEventBus();
const toolCoordinator = new ToolCoordinator();
const ttsService = TTSService.getInstance();
// ...
```

## Directory Structure

```
reference-implementation/
├── index.ts                    # Exports AssessmentPlayer and layout
├── AssessmentPlayer.ts # Core player class (business logic)
├── ReferenceAssessmentLayout.svelte # Complete UI wrapper (TBD)
└── README.md                   # This file

reference-layout/               # Reference layout implementation
├── ReferenceLayout.svelte      # Main layout component
├── components/                 # Sub-components
└── README.md                   # Layout-specific docs
```

## Status

🚧 **Under development** - Implementation in progress.

### Completed
- ✅ AssessmentPlayer class
- ✅ Navigation and state management
- ✅ Integration with assessment toolkit services

### In Progress
- 🚧 ReferenceAssessmentLayout wrapper
- 🚧 ReferenceLayout implementation
- 🚧 Visual components

See [../reference-layout/LAYOUT-PLAN.md](../reference-layout/LAYOUT-PLAN.md) for detailed implementation plan.
