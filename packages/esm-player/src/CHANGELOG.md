# Changelog

All notable changes to `@pie-framework/pie-esm-player` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Resource monitoring events (`pie-resource-load-failed`, `pie-resource-retry-failed`, `pie-resource-retry-success`, `pie-resource-load-success`, `pie-resource-load-error`) now properly dispatched even when resources load before initial container scan completes
- Fixed timing issue where resources loading before MutationObserver scan would be missed
- Added retroactive resource tracking for resources detected by PerformanceObserver that weren't in initial scan
- Improved resource monitor lifecycle handling when container element changes
- Fixed ShadyDOM compatibility for resource retry logic (avoided element cloning for link elements)

### Added
- `debug` prop for controllable logging (debug/info/warn/error levels)
- Support for global `window.PIE_DEBUG` flag for runtime debugging
- Resource monitoring events for tracking asset loading, retries, and failures

### Changed
- Replaced 86 console.* calls with proper logger utility (reduced to 84 calls)
- Most logs now use debug level (only shown when debug=true)
- Removed redundant log prefixes (logger adds component name automatically)
- Improved log message clarity and consistency

## [1.0.0] - 2025-10-15

### Added
- Initial release of pie-esm-player
- Native ESM module loading via import maps
- Dynamic CDN-based element loading (default: esm.sh)
- Custom events: `load-complete`, `session-changed`, `player-error`

### Features
- Modern ESM architecture for optimal tree-shaking
- Import map generation for version management
- Controller support for client-side model filtering
- Support for stimulus items (passage + content)
- External stylesheet support with scoping
- Configurable CDN URL (`esmCdnUrl` prop)
- Configurable probe timeout and cache TTL

### Architecture
- Custom element with shadow: 'none'
- Dynamic import maps for module resolution
- Version-based element registration
- Reactive state management with Svelte 5
- Performance tracking markers

### Purpose
- **Next-Generation Loading**: Leverages native ESM for optimal performance
- **Development/Testing**: Full ESM support for future PIE element packages
- **CDN Flexibility**: Configurable CDN base URL for different deployment scenarios

---

**Note**: This is an experimental player for ESM-based PIE elements. For production use with IIFE bundles, use `pie-fixed-player-static` or `pie-inline-player`.

