# @pie-players/pie-tool-answer-eliminator

## 0.2.5

### Patch Changes

- ce22976: Release all public PIE packages with the latest toolkit/loader/tag-name updates, publish metadata fixes, and CI/publish hardening improvements.
- Updated dependencies [ce22976]
  - @pie-players/pie-assessment-toolkit@0.2.4
  - @pie-players/pie-players-shared@0.2.2

## 0.2.4

### Patch Changes

- Updated dependencies [6f7d346]
  - @pie-players/pie-assessment-toolkit@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.2

## 0.2.2

### Patch Changes

- Updated dependencies
- Updated dependencies [46295ee]
  - @pie-players/pie-assessment-toolkit@0.2.1
  - @pie-players/pie-players-shared@0.2.1

## 0.2.1

### Patch Changes

- 42ed80f: Fix section player entry point and answer eliminator TypeScript error

  - Removed redundant static tool imports from section-player entry point (tools are loaded dynamically by assessment-toolkit)
  - Fixed TypeScript error in answer-eliminator by removing reference to non-existent currentQuestionId property

## 0.2.0

### Minor Changes

- 8584a3f: Initial 0.1.0 release of PIE section player and dependencies

  This release includes:

  ## New Packages

  ### Section Player

  - **@pie-players/pie-section-player** - QTI 3.0 compliant section player with support for passages, rubric blocks, page/item modes, and comprehensive tooling integration

  ### Player Variants

  - **@pie-players/pie-esm-player** - ESM-based player for modern module loading
  - **@pie-players/pie-fixed-player** - Fixed player for static content
  - **@pie-players/pie-iife-player** - IIFE player for bundle-based loading
  - **@pie-players/pie-inline-player** - Inline player for embedded scenarios

  ### Tools

  - **@pie-players/pie-section-tools-toolbar** - Section-level toolbar for assessment tools
  - **@pie-players/pie-tool-answer-eliminator** - Answer elimination tool with element-level state tracking
  - **@pie-players/pie-tool-tts-inline** - Inline text-to-speech controls

  ### Core Libraries

  - **@pie-players/pie-assessment-toolkit** - Core toolkit with tool coordination, TTS services, and accessibility features
  - **@pie-players/pie-players-shared** - Shared types and utilities
  - **@pie-players/tts-client-server** - Client-side TTS provider for server API integration
  - **@pie-players/pie-calculator-desmos** - Desmos calculator provider for graphing and scientific calculators

  ## Publishing Fixes

  All packages now properly configured for npm publishing:

  - ✅ ESM-only format (no UMD mixing)
  - ✅ CDN fields (unpkg/jsdelivr) for browser loading
  - ✅ Correct exports configuration
  - ✅ Public access configured
  - ✅ TypeScript declarations included

  ## Features

  ### Section Player

  - QTI 3.0 section structure support
  - Passage handling with deduplication
  - Rubric blocks (stimulus, instructions, rubric classes)
  - Page mode (all items visible) and item mode (one at a time)
  - Multiple layout options (split-panel, vertical)
  - Session management and restoration
  - Comprehensive event system

  ### Assessment Toolkit

  - Tool coordination system
  - TTS integration (Browser and Polly providers)
  - Answer eliminator with element-level state
  - Accessibility catalog support
  - Highlight coordination

  ### Element Loading

  - Multiple player types (ESM, IIFE, Fixed, Inline)
  - Element pre-loading optimization
  - Import map support
  - Local ESM CDN for testing

  ## Development Tools

  - Local ESM CDN plugin for testing packages before publishing
  - Section-demos app with UI toggles for different player modes
  - Comprehensive testing infrastructure

### Patch Changes

- Updated dependencies [8584a3f]
  - @pie-players/pie-assessment-toolkit@0.2.0
  - @pie-players/pie-players-shared@0.2.0
