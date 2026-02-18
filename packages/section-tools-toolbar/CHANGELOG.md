# @pie-players/pie-section-tools-toolbar

## 0.2.9

### Patch Changes

- Add explicit section toolbar visibility controls and prevent empty toolbar gutters.

  `pie-section-player` now supports `show-toolbar` and `toolbar-position="none"`, and the toolbar is not rendered when there are no enabled tools.

## 0.2.8

### Patch Changes

- Make section player imports SSR-safe by deferring custom element module loading to the browser.

  This prevents server-side `HTMLElement` errors when consuming `pie-section-player` in SSR apps and keeps integration hack-free for standard npm consumers.

## 0.2.7

### Patch Changes

- Release patch versions for all deployable packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.7
  - @pie-players/pie-calculator-mathjs@0.1.3
  - @pie-players/pie-players-shared@0.2.4
  - @pie-players/pie-tool-graph@0.1.8
  - @pie-players/pie-tool-line-reader@0.1.8
  - @pie-players/pie-tool-magnifier@0.1.8
  - @pie-players/pie-tool-periodic-table@0.1.8
  - @pie-players/pie-tool-protractor@0.1.8
  - @pie-players/pie-tool-ruler@0.1.8

## 0.2.6

### Patch Changes

- ce5211a: Release all packages after the NodeNext/ESM migration updates.

  This includes explicit `.js` relative import specifiers, NodeNext TypeScript configuration alignment, and dependency/version housekeeping needed for consistent package builds and publishing.

- Updated dependencies [ce5211a]
  - @pie-players/pie-assessment-toolkit@0.2.6
  - @pie-players/pie-calculator-mathjs@0.1.2
  - @pie-players/pie-players-shared@0.2.3
  - @pie-players/pie-tool-graph@0.1.7
  - @pie-players/pie-tool-line-reader@0.1.7
  - @pie-players/pie-tool-magnifier@0.1.7
  - @pie-players/pie-tool-periodic-table@0.1.7
  - @pie-players/pie-tool-protractor@0.1.7
  - @pie-players/pie-tool-ruler@0.1.7

## 0.2.5

### Patch Changes

- Fix section player + PNP consumer packaging reliability.

  - Export toolkit PNP service subpaths used by Svelte component exports
  - Update PNP Svelte components to import from published package exports
  - Add missing section player and section tools toolbar runtime dependencies

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.5
  - @pie-players/pie-tool-graph@0.1.6
  - @pie-players/pie-tool-line-reader@0.1.6
  - @pie-players/pie-tool-magnifier@0.1.6
  - @pie-players/pie-tool-periodic-table@0.1.6
  - @pie-players/pie-tool-protractor@0.1.6
  - @pie-players/pie-tool-ruler@0.1.6

## 0.2.4

### Patch Changes

- ce22976: Release all public PIE packages with the latest toolkit/loader/tag-name updates, publish metadata fixes, and CI/publish hardening improvements.
- Republish packages with correctly resolved internal dependency versions in published metadata.

  This release uses publish-time workspace range resolution, so development keeps `workspace:*`
  while npm artifacts publish concrete dependency ranges.

- Updated dependencies [ce22976]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.4
  - @pie-players/pie-calculator-mathjs@0.1.1
  - @pie-players/pie-players-shared@0.2.2
  - @pie-players/pie-tool-graph@0.1.5
  - @pie-players/pie-tool-line-reader@0.1.5
  - @pie-players/pie-tool-magnifier@0.1.5
  - @pie-players/pie-tool-periodic-table@0.1.5
  - @pie-players/pie-tool-protractor@0.1.5

## 0.2.3

### Patch Changes

- Updated dependencies [6f7d346]
  - @pie-players/pie-assessment-toolkit@0.2.3
  - @pie-players/pie-tool-graph@0.1.4
  - @pie-players/pie-tool-line-reader@0.1.4
  - @pie-players/pie-tool-magnifier@0.1.4
  - @pie-players/pie-tool-periodic-table@0.1.4
  - @pie-players/pie-tool-protractor@0.1.4

## 0.2.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.2
  - @pie-players/pie-tool-graph@0.1.3
  - @pie-players/pie-tool-line-reader@0.1.3
  - @pie-players/pie-tool-magnifier@0.1.3
  - @pie-players/pie-tool-periodic-table@0.1.3
  - @pie-players/pie-tool-protractor@0.1.3

## 0.2.1

### Patch Changes

- Updated dependencies
- Updated dependencies [46295ee]
  - @pie-players/pie-assessment-toolkit@0.2.1
  - @pie-players/pie-players-shared@0.2.1
  - @pie-players/pie-tool-graph@0.1.2
  - @pie-players/pie-tool-line-reader@0.1.2
  - @pie-players/pie-tool-magnifier@0.1.2
  - @pie-players/pie-tool-periodic-table@0.1.2
  - @pie-players/pie-tool-protractor@0.1.2

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
  - @pie-players/pie-tool-graph@0.1.1
  - @pie-players/pie-tool-line-reader@0.1.1
  - @pie-players/pie-tool-magnifier@0.1.1
  - @pie-players/pie-tool-periodic-table@0.1.1
  - @pie-players/pie-tool-protractor@0.1.1
