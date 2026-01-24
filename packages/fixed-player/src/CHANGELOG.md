# Changelog

All notable changes to `@pie-framework/pie-fixed-player-static` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Resource monitoring events (`pie-resource-load-failed`, `pie-resource-retry-failed`, `pie-resource-retry-success`, `pie-resource-load-success`, `pie-resource-load-error`) now properly dispatched even when resources load before initial container scan completes
- Fixed timing issue where resources loading before MutationObserver scan would be missed
- Added retroactive resource tracking for resources detected by PerformanceObserver that weren't in initial scan
- Improved resource monitor lifecycle handling when container element changes

### Added
- `debug` prop for controllable logging (debug/info/warn/error levels)
- Support for global `window.PIE_DEBUG` flag for runtime debugging
- Comprehensive logging with emoji prefixes (✅, ⚠️, ❌, ℹ️)
- Resource monitoring events for tracking asset loading, retries, and failures

### Changed
- Replaced all console.* calls with proper logger utility
- Improved log message clarity and consistency

## [1.0.0-351df72.8] - 2025-10-16

### Fixed
- Event dispatching from custom element host (load-complete, session-changed, player-error)
- Events now correctly bubble to parent listeners

## [1.0.0-351df72.7] - 2025-10-16

### Fixed
- Added missing `pie-stimulus-layout` fallback for stimulus items
- Improved stimulus item rendering with simple two-column flexbox layout

## [1.0.0-351df72.6] - 2025-10-16

### Fixed
- Custom element name validation (ensured all element names contain hyphens)
- Applied `makeUniqueTags` utility to transform simple element names (e.g., `hotspot` → `hotspot--version-9-1-0`)

## [1.0.0-351df72.5] - 2025-10-16

### Fixed
- Unified architecture with pie-inline-player
- Server-side model processing via PieControllerService
- Consistent behavior between local and published packages

## [1.0.0-351df72.4] - 2025-10-16

### Added
- Complete npm package metadata (`main`, `module`, `types`, `exports`)
- SSR safety guards (browser detection)
- Hydration mismatch prevention (deterministic class names)
- Safe New Relic tracking (try-catch guards)

### Fixed
- 0px width/height rendering issue (added `width: 100%` to containers)
- Package distribution structure (`files` array in package.json)

### Changed
- Improved package.json for proper npm publishing

## [1.0.0-351df72.3] - 2025-10-16

### Fixed
- External stylesheet loading and scoping
- Added support for `externalStyleUrls` prop
- Added support for `config.resources.stylesheets`

## [1.0.0-351df72.2] - 2025-10-16

### Added
- Initial release of pie-fixed-player
- Pre-bundled element support for performance optimization
- Server-side model filtering via player/load endpoint
- Custom events: `load-complete`, `session-changed`, `player-error`

### Features
- Uses `player.js` bundles (elements only, no controllers)
- Server-processed models for consistent behavior
- Compatible with pie-player API
- SSR-safe implementation
- Support for stimulus items (passage + content)
- External stylesheet support with scoping
- New Relic tracking integration
- Deterministic class names for styling

### Architecture
- Custom element with shadow: 'none'
- Reactive state management with Svelte 5
- Event dispatching from custom element host
- Performance tracking markers

## [1.0.0-24d9476.1] - 2025-10-15

### Added
- Initial proof-of-concept implementation
- Basic element loading and rendering

---

**Note**: Versions use format `MAJOR.MINOR.PATCH-<element-hash>.<iteration>` where:
- `element-hash`: Deterministic hash of bundled element combinations
- `iteration`: Build number for same element combination

