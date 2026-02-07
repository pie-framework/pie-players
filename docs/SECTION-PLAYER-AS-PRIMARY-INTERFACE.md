# Section Player as Primary Interface - Documentation Update

**Date:** February 7, 2026
**Status:** ✅ Complete

---

## Overview

Updated documentation to reflect that the **PIE Section Player** is the primary container/interface for the assessment toolkit, rather than a higher-level AssessmentPlayer class.

## Changes Made

### 1. [accessibility-catalogs-tts-integration.md](./accessibility-catalogs-tts-integration.md)

**Updated Section: Quick Start**
- Changed from manual service initialization pattern to section player-centric approach
- Emphasized that section player handles catalog lifecycle automatically
- Added clarity that users don't need to manually call `addItemCatalogs()` or `clearItemCatalogs()`
- Updated examples to show JavaScript property binding to section player

**Updated Section: Usage with Section Player**
- Replaced conceptual `AssessmentPlayer` class example with concrete section player integration
- Showed real-world usage pattern from section-demos implementation
- Emphasized automatic SSML extraction and catalog management

**Updated Section: Integration Status**
- Changed from "AssessmentPlayer Integration" to "Section Player Integration"
- Updated completion status to reflect current state

### 2. [tts-architecture.md](./tts-architecture.md)

**Updated Section: QTI 3.0 Integration with Section Player**
- Changed from generic catalog resolution example to section player-specific integration
- Added concrete example showing service initialization and binding
- Emphasized automatic behavior (SSML extraction, catalog management, TTS tool rendering)

**Updated Section: Integration Points**
- Added `PieSectionPlayer` as the primary interface
- Clarified that ItemRenderer and PassageRenderer work within the section player context
- Added "Usage Pattern" explanation emphasizing section player's role

### 3. [accessibility-catalogs-integration-guide.md](./accessibility-catalogs-integration-guide.md)

**Updated Section: Architecture**
- Changed service architecture diagram from "AssessmentPlayer" to "PIE Section Player (Primary)"
- Updated data flow to show automatic SSML extraction and catalog lifecycle management
- Changed catalog priority from "Item-level > Assessment-level" to "Extracted > Item > Assessment"
- Added navigation step showing automatic catalog cleanup

**Updated Section: Section Player Integration** (renamed from AssessmentPlayer Integration)
- Replaced conceptual TypeScript class with concrete JavaScript integration example
- Added "What Happens Automatically" subsection explaining the section player's automatic behaviors
- Removed manual catalog lifecycle management code
- Showed real-world service initialization and binding pattern

**Updated Table of Contents**
- Changed link from "AssessmentPlayer Integration" to "Section Player Integration"

## Key Documentation Principles

### What the Section Player Does Automatically

When services are passed to the section player, it automatically:

1. **SSML Extraction**: Scans content for embedded `<speak>` tags
2. **Catalog Generation**: Creates QTI 3.0 catalog entries with unique IDs
3. **Lifecycle Management**: Adds item catalogs on load, clears on navigation
4. **TTS Tool Rendering**: Shows inline TTS buttons in headers
5. **Catalog Resolution**: Resolves with priority: extracted → item → assessment

### What Users Need to Do

1. **Initialize Services**: Create TTSService, catalogResolver, coordinators
2. **Pass to Section Player**: Set as JavaScript properties (NOT HTML attributes)
3. **Set Section Data**: Provide section configuration

That's it - the section player handles everything else.

## Current Architecture

```
Application Code
  ↓ Creates services
  ↓ Passes services as JS properties
PIE Section Player (Primary Interface)
  ↓ Automatic SSML extraction
  ↓ Automatic catalog lifecycle
  ↓ Automatic TTS tool rendering
PassageRenderer / ItemRenderer
  ↓ Render content
PIE Elements
```

## Implementation Examples

The following files demonstrate the section player integration pattern:

- **Demo Implementation**: [apps/section-demos/src/routes/demo/[[id]]/+page.svelte](../apps/section-demos/src/routes/demo/[[id]]/+page.svelte#L140-L226)
- **Section Player**: [packages/section-player/src/PieSectionPlayer.svelte](../packages/section-player/src/PieSectionPlayer.svelte)
- **SSML Extraction**: [packages/section-player/src/components/PassageRenderer.svelte](../packages/section-player/src/components/PassageRenderer.svelte#L76-L102)

## Future Plans

While a reference **AssessmentPlayer** will eventually be provided as an optional higher-level abstraction, the **PIE Section Player** remains the primary interface for:

- Rendering QTI 3.0 sections with passages and items
- Integrating assessment toolkit services
- Automatic SSML extraction and catalog management
- TTS and accessibility features

The AssessmentPlayer (when implemented) will be a convenience wrapper that:
- Manages multiple sections
- Handles assessment-level navigation
- Coordinates section player instances
- But still delegates to section players for rendering and toolkit integration

## Related Documentation

- [Section Player README](../packages/section-player/README.md) - Complete section player API
- [TTS Integration](../packages/section-player/TTS-INTEGRATION.md) - TTS-specific integration details
- [TTS Architecture](./tts-architecture.md) - Overall TTS system design
- [Accessibility Catalogs Quick Start](./accessibility-catalogs-quick-start.md) - Developer quick reference

---

## Summary

The documentation now accurately reflects that:

1. **Section Player is Primary**: Main interface for toolkit integration
2. **Automatic Management**: SSML extraction and catalog lifecycle handled automatically
3. **Simple Integration**: Just pass services as properties and set section data
4. **No Manual Catalog Management**: Users don't need to call add/clear methods
5. **Real-World Patterns**: Examples match actual implementation in section-demos

This aligns documentation with the current implementation and makes integration patterns clear and straightforward.
