# Changelog

All notable changes to `@pie-framework/pie-inline-player` will be documented in this file.

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
- Config parsing logs now use debug level (only shown when debug=true)
- Improved log message clarity and consistency

## [1.0.0] - 2025-10-16

### Added
- Initial release of pie-inline-player
- Dynamic bundle loading from `/api/item/[id]/packaged` endpoint
- Server-side model filtering via PieControllerService
- Custom events: `load-complete`, `session-changed`, `player-error`

### Features
- Uses `player.js` bundles (elements only, no controllers)
- Server-processed models for consistent behavior with pie-fixed-player
- Compatible with pie-player API
- Dynamic bundle loading via blob URLs
- Support for stimulus items (passage + content)
- External stylesheet support with scoping
- Custom element name validation with `makeUniqueTags`

### Architecture
- Custom element with shadow: 'none'
- Unified architecture with pie-fixed-player
- Event dispatching from custom element host
- Reactive state management with Svelte 5
- Performance tracking markers

### Purpose
- **Development/Testing**: Matches pie-player API exactly for testing
- **Isolated Testing**: Uses dynamically loaded bundles without client dependencies
- **Reference Implementation**: Shows how dynamic loading can work with server-processed models

---

**Note**: This player is primarily for development and testing. For production with fixed element sets, use `pie-fixed-player-static`.

