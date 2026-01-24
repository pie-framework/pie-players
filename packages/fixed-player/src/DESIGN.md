# PIE Fixed Player - Architecture Design

## Summary

This document outlines the architecture for `pie-fixed-player`, a performance-optimized alternative to dynamic PIE loading. It targets clients with fixed sets of question types who can accept trading flexibility for speed.

**Key innovation**: Pre-load element bundles at build time, fetch only data at runtime.

**Two distribution strategies**:
1. **IIFE Strategy**: Pre-bundled, CDN-friendly, zero configuration
2. **Dependency Strategy**: npm peer dependencies, maximum optimization

Both strategies share the same core architecture and toolchain.

---

## Table of Contents

1. [Context & Philosophy](#context--philosophy)
2. [Core Architecture](#core-architecture)
3. [Distribution Strategies](#distribution-strategies)
4. [Build System Architecture](#build-system-architecture)
5. [Testing Architecture](#testing-architecture)
6. [Decision Framework](#decision-framework)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Context & Philosophy

### The Performance-Flexibility Trade-off

#### PIE's Core Philosophy: Flexibility First

**PIE's dynamic loading is the PREFERRED approach** for enterprise platforms because it provides:

- ✅ **Scalability**: Users download only what they encounter
- ✅ **Independent versioning**: Elements update separately
- ✅ **Multi-tenant support**: Different clients use different versions
- ✅ **Zero coordination**: Teams release independently
- ✅ **Future-proof**: New types don't impact existing content

**The cost**: Dynamic loading overhead - network requests to fetch element code.

#### The Architectural Spectrum

```
┌─────────────────────────────────────────────────────────────────┐
│                    Architecture Spectrum                         │
├──────────────────┬──────────────────┬──────────────────────────┤
│ KAS (Monolithic) │ PIE (Dynamic)    │ pie-fixed-player         │
├──────────────────┼──────────────────┼──────────────────────────┤
│ Fastest          │ Good/Better      │ Excellent                │
│ Most limited     │ Most flexible    │ Limited                  │
│ Single app       │ Multi-tenant     │ Single tenant            │
│ Tight coupling   │ Loose coupling   │ Semi-coupled             │
└──────────────────┴──────────────────┴──────────────────────────┘
```

**KAS** (Monolithic): All question types bundled. Fast but inflexible. Ideal for single apps with known types.

**PIE Dynamic**: Modular, on-demand loading. Flexible but slower initial load. Ideal for enterprise platforms.

**pie-fixed-player**: Pre-loaded bundles, data-only runtime. Fast loading with limited flexibility. Ideal for speed-critical apps with fixed requirements.

#### ESM Optimization: Improving Dynamic PIE

PIE is also being enhanced with **ESM (ECMAScript Modules)** alongside IIFE:
- ✅ Reduced bundle sizes (better tree-shaking)
- ✅ Faster browser parsing (native modules)
- ✅ Better caching granularity (per-module)
- ✅ Same flexibility (still dynamic)

ESM optimizes the flexible approach without trading flexibility for speed.

### Previous Attempt: pie-inline-player

**What it did**: Combined item data and element bundles in single `/packaged` endpoint.

**Why it failed**:
- ❌ Large bundle downloads with every request
- ❌ Poor caching (bundles coupled with data)
- ❌ Worse than alternatives (IIFE, ESM separate code from data)

**Key lesson**: Bundling data and code together prevents effective caching.

### The pie-fixed-player Approach

**Core insight**: If clients use a fixed set of elements, load them once at build time.

**Architecture**:
```
Build Time:         Runtime:
┌─────────────┐    ┌──────────────┐
│   Bundle    │    │  Fetch Data  │
│  Elements   │───▶│     Only     │
│  Into App   │    │  (Small API) │
└─────────────┘    └──────────────┘
```

**Benefits**:
- ✅ Bundles loaded once (at build time)
- ✅ Only data fetched at runtime
- ✅ Dramatic API response reduction
- ✅ Maximum caching effectiveness

---

## Core Architecture

### Loading Strategy Comparison

| Approach | Bundle Loading | API Response | Caching | Flexibility | Performance |
|----------|---------------|--------------|---------|-------------|-------------|
| **PIE IIFE** | First request | Small data | Bundle-level | Any elements | Good |
| **PIE ESM** | First request | Small data | Module-level | Any elements | Better |
| **pie-inline-player** | Every request | Very large | Poor | Any elements | Poor |
| **pie-fixed-player** | Build time | Minimal | Build-level | Fixed only | Best |

### Component Architecture

```
┌─────────────────────────────────────────┐
│        pie-fixed-player (Web Component) │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  FixedItemLoader.svelte           │ │
│  │  - Fetches from /data-only        │ │
│  │  - Assumes bundles pre-loaded     │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │  pie-player-initializer.ts        │ │
│  │  (Shared with pie-inline-player)  │ │
│  │  - Initialize pie-player          │ │
│  │  - Configure session              │ │
│  │  - Setup event handlers           │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │  <pie-player> (from CDN)          │ │
│  │  - Renders item                   │ │
│  │  - Uses pre-loaded elements       │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Key architectural decisions**:
- **Shared initialization logic**: `pie-player-initializer.ts` used by both players
- **API separation**: New `/data-only` endpoint (no bundles)
- **Assumption-based loading**: Player assumes elements are available globally
- **Standard web component**: Works with any framework

### API Architecture

**New endpoint**: `/api/item/{id}/data-only`

**Returns**: Item and passage configuration only (no bundles)

```json
{
  "item": { "config": {...}, "id": "..." },
  "passage": { "config": {...} },
  "requiredElements": {
    "item": ["@pie-element/multiple-choice"],
    "passage": []
  }
}
```

---

## Distribution Strategies

### Strategy A: IIFE (Pre-Bundled)

**Architecture**: All elements compiled into single IIFE bundle, included in package.

**How PITS integration works**:
1. Build script determines exact element combination from items
2. Requests bundle from PITS via existing `/bundles` endpoint
3. PITS compiles and returns IIFE bundle containing all requested elements
4. Bundle included directly in npm package

**Implementation**: Use existing PITS infrastructure

PITS already has everything needed:
- `/bundles/@pie-element/multiple-choice@9.9.1+@pie-element/passage@5.3.2/player.js`
- `resolveDependencyMw` middleware handles version resolution (including `@latest`)
- Builder service (`@pie-api-aws/builder`) creates IIFE bundles
- S3 storage caches generated bundles

**Package structure**:
```
@pie-framework/pie-fixed-player-static@1.0.0-abc123.1
├── pie-elements-bundle.js  (Pre-compiled IIFE)
└── pie-fixed-player.js     (Custom element)
```

**Characteristics**:
- ✅ **Zero configuration**: Works immediately after install
- ✅ **CDN friendly**: Can be loaded via unpkg
- ✅ **Universal compatibility**: Works in any environment
- ✅ **No build optimization**: Client doesn't need bundler
- ❌ **Larger package**: Includes full IIFE bundle
- ❌ **No tree-shaking**: Client gets everything

### Strategy B: Dependency (Peer Dependencies)

**Architecture**: Elements declared as peer dependencies, client's bundler handles optimization.

**How dependency inspection works**:
1. Build script determines exact element combination from items
2. For each `element@version`, uses `pacote.manifest()` to fetch package.json
3. Extracts `peerDependencies` from each element's package.json
4. Merges and deduplicates all peer dependencies
5. Generates `peerDependencies` block in output package.json
6. Client's npm/yarn handles installation and bundling

**Implementation approach**:

Build script uses `pacote` (same library PITS uses for resolution) to fetch package.json for each element.

```typescript
import pacote from 'pacote';

async function extractDependencies(elements: BuildDependency[]) {
  const allDeps = {};
  for (const element of elements) {
    const manifest = await pacote.manifest(`${element.name}@${element.version}`);
    // Add element itself
    allDeps[element.name] = element.version;
    // Add its peer dependencies
    Object.assign(allDeps, manifest.peerDependencies || {});
  }
  return allDeps;
}
```

**Why peerDependencies instead of dependencies?**

This is the key architectural decision for Strategy B:

| Aspect | `dependencies` | `peerDependencies` |
|--------|----------------|-------------------|
| **Installation** | Automatically installed with your package | Client must install them separately |
| **Location** | Bundled in your package's node_modules | Installed in client's root node_modules |
| **Optimization** | No client optimization (already bundled) | Client's bundler can optimize (tree-shake, split) |
| **Package size** | Large (includes all element code) | Small (only player code) |
| **Deduplication** | Each package has own copy | Shared across all packages |

**Concrete example for pie-fixed-player**:

```json
// Strategy B - Using peerDependencies
{
  "name": "@pie-framework/pie-fixed-player-static",
  "version": "1.0.0-abc123.1",
  "main": "dist/pie-fixed-player.js",
  "peerDependencies": {
    "@pie-element/multiple-choice": "9.9.1",
    "@pie-element/passage": "5.3.2"
  }
}
```

**What happens when client installs this**:

```bash
npm install @pie-framework/pie-fixed-player-static
```

1. npm sees the peerDependencies
2. npm installs those elements in client's root `node_modules/`
3. Client's bundler (Vite/webpack) can now:
   - Tree-shake unused code from elements
   - Code-split elements into separate chunks
   - Apply optimizations across all dependencies
4. Final client bundle is optimized

**Why this matters**:

```
Regular dependencies approach:
client-app/
  node_modules/
    @pie-framework/pie-fixed-player-static/
      node_modules/
        @pie-element/multiple-choice/  ← Pre-bundled, no optimization
        @pie-element/passage/           ← Pre-bundled, no optimization
    (client can't optimize what's already bundled)

peerDependencies approach:
client-app/
  node_modules/
    @pie-framework/pie-fixed-player-static/  ← Just player code
    @pie-element/multiple-choice/             ← Client can optimize these
    @pie-element/passage/                     ← Client can tree-shake these
```

**Result**: Client's bundler treats PIE elements like any other dependency - full optimization control.

**Package structure**:
```
@pie-framework/pie-fixed-player-static@1.0.0-abc123.1
├── pie-fixed-player.js      (Custom element only)
└── package.json
    └── peerDependencies:
        ├── @pie-element/multiple-choice: "9.9.1"
        ├── @pie-element/passage: "5.3.2"
        └── ... (other elements from client's items)
```

**Characteristics**:
- ✅ **Smallest package**: Only player code
- ✅ **Tree-shaking**: Client bundler optimizes
- ✅ **Better caching**: Elements installed separately
- ✅ **Modern optimization**: Leverages client's build pipeline
- ❌ **Requires bundler**: Client must have build step
- ❌ **More dependencies**: npm installs all elements separately
- ❌ **No CDN usage**: Can't use with unpkg/<script> tags

### Dual Strategy Support

Both strategies can coexist with minimal overhead.

```
Build Script                Package Output
┌────────────────┐         ┌─────────────────────┐
│ mode: 'iife'   │───────▶ │ *-iife package      │
│                │         │ + bundled elements  │
├────────────────┤         ├─────────────────────┤
│ mode: 'deps'   │───────▶ │ * package           │
│                │         │ + peerDependencies  │
└────────────────┘         └─────────────────────┘
```

**Shared code**: Player logic identical, only packaging differs.

---

## Build System Architecture

### Overview

```
Item Configs ──┐ (Extract elements from items)
               │
               ▼
         Element Combination
         {
           "@pie-element/multiple-choice": "9.9.1",
           "@pie-element/passage": "5.3.2"
         }
               │
               ▼
          ┌────────────────────────┐
          │  build-static-package  │
          │  - Fetch IIFE bundle   │
          │  - Compile player      │
          │  - Generate pkg.json   │
          └────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
 IIFE Package      Deps Package
 + bundles         + peerDeps
```

### Element Combination Specification

**Source**: Derived from actual items the client will use.

**How it works**:

1. **Analyze items**: Client provides their item set or item IDs
2. **Extract elements**: Parse `config.elements` from each item (plus passage elements)
3. **Create combination spec**: Unique list of `element@version` pairs
4. **Build package**: Generate static package for that specific combination

**Example item structure**:
```json
{
  "config": {
    "elements": {
      "multiple-choice--version-9-9-1": "@pie-element/multiple-choice@9.9.1"
    }
  },
  "passage": "passage-id@1.0.0"  // May include passage element
}
```

**Extracted combination**:
```json
{
  "@pie-element/multiple-choice": "9.9.1",
  "@pie-element/passage": "5.3.2"
}
```

**Key insight**: Element combinations are **item-driven**, not domain-driven. Each client gets a package tailored to their exact item requirements.

### Element Extraction Process

**Step 1: Parse item elements**
```json
// From item config
"elements": {
  "multiple-choice--version-9-9-1": "@pie-element/multiple-choice@9.9.1"
}
```

**Step 2: Handle passage references**
```json
// Item references passage
"passage": "3210a45d-b8d4-11eb-a1f9-b26203a89760@1.0.0"
```

When an item references a passage:
1. Fetch passage configuration
2. Extract passage's elements from its `config.elements`
3. Add to overall element combination

**Step 3: Deduplicate and normalize**
- Remove duplicate element/version pairs
- Detect version conflicts (multiple versions of same element)
- Create canonical element list

**Result**: Complete set of elements needed to render all specified items and their passages.

### Handling Version Conflicts

**Scenario**: Different items use different versions of the same element.

**Example**:
- Item A uses `@pie-element/multiple-choice@9.9.1`
- Item B uses `@pie-element/multiple-choice@10.0.0`

**Resolution strategies**:

1. **Strict mode** (recommended): Require all items use same version
   - Fail build with clear error message
   - Client must update items to use consistent versions

2. **Latest version**: Automatically use highest version
   - Risk: Older items may not render correctly
   - Requires testing all items with latest version

3. **Multiple packages**: Generate separate packages per version set
   - Client uses different package for different item groups
   - More complex but ensures compatibility

**PIE best practice**: Use sanctioned versions at the organizational level to prevent conflicts from arising.

### Version Strategy

**Package name**: Always `@pie-framework/pie-fixed-player-static`

**Version encoding**: `major.minor.patch-{hash}.{iteration}`

Example: `1.0.0-abc123.5`
- `abc123`: Hash of element combination
- `.5`: Fifth iteration of this combination

**Benefits**:
- Single npm package name (cleaner namespace)
- Version uniquely identifies element set
- Easy to update with same elements
- Clear iteration tracking

### Build Process Flow

1. **Gather item IDs or configs**: Client specifies which items they'll use and provide the org to determine sanctioned versions for these items
2. **Extract element combinations**: 
   - Parse `config.elements` from each item
   - Fetch and parse passage elements if referenced
   - Create unique set of `element@version` pairs
3. **Fetch bundles** (Strategy A - IIFE):
   - Request IIFE bundle from PITS for exact element combination
   - PITS returns compiled bundle with all elements
4. **Analyze dependencies** (Strategy B - Deps):
   - Inspect element packages for the specified versions
   - Extract peer dependencies and requirements
5. **Compile player**: Build Svelte custom element
6. **Generate package.json**:
   - IIFE mode: Include bundle, no dependencies
   - Deps mode: List extracted peer dependencies
7. **Package artifacts**: Create publishable npm package
8. **Generate hash**: Hash the element combination for version identifier

### CLI Integration

```bash
# Build a package from an in-repo config
bun run cli pie-packages:fixed-player-build-package \
  --elements-file configs/fixed-player-static/example.json

# Build + generate a browser test project
bun run cli pie-packages:fixed-player-build-and-test-package \
  --elements-file configs/fixed-player-static/example.json \
  --generate-test-project
```

**CLI responsibilities**:
- Fetch items and extract element combinations (if given item IDs for instance)
- Request IIFE bundles from PITS or analyze npm packages
- Build package from element combination
- Generate test project from template
- Symlink local package for testing
- Start dev server
- (Future) Publish to npm

**Workflow options**:
1. **Item-driven**: Client provides item IDs → system extracts elements
2. **Element-driven**: Client specifies exact element versions → system builds directly
