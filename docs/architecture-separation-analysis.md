# Architecture Separation Analysis

## Executive Summary

This document evaluates the assessment toolkit to identify UI-independent interfaces with multiple implementations that would benefit from separation into dedicated core packages, following the successful pattern established with `@pie-players/pie-tts-core`.

## Completed: TTS Architecture ✅

**Status:** Successfully refactored

**Structure:**
- `@pie-players/pie-tts-core` - Pure interfaces (zero dependencies)
- `@pie-players/pie-assessment-toolkit` - BrowserTTSProvider (built-in fallback)
- `@pie-players/pie-tts-polly` - Optional AWS Polly provider

**Benefits Achieved:**
- ✅ Zero UI dependencies in core
- ✅ Clean separation of concerns
- ✅ Pluggable architecture
- ✅ Always-available fallback

## Candidates for Separation

### 1. Calculator Provider System ⭐⭐⭐⭐⭐ (HIGHEST PRIORITY)

**Current State:**
- Interfaces defined in `assessment-toolkit/src/tools/types.ts`
- Multiple implementations: Desmos, TI, Math.js
- Each provider is UI-independent (renders to DOM, but no framework deps)

**Evidence:**
```typescript
// Current location: assessment-toolkit/src/tools/types.ts
export interface CalculatorProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly supportedTypes: CalculatorType[];
  readonly version: string;
  initialize(): Promise<void>;
  createCalculator(type, container, config?): Promise<Calculator>;
  supportsType(type: CalculatorType): boolean;
  destroy(): void;
  getCapabilities(): CalculatorProviderCapabilities;
}

export interface Calculator {
  readonly provider: CalculatorProvider;
  readonly type: CalculatorType;
  getValue(): string;
  setValue(value: string): void;
  clear(): void;
  getHistory?(): CalculationHistoryEntry[];
  evaluate?(expression: string): Promise<string>;
  exportState(): CalculatorState;
  importState(state: CalculatorState): void;
  destroy(): void;
}
```

**Existing Implementations:**
1. **DesmosCalculatorProvider** - Desmos API integration
2. **TICalculatorProvider** - Texas Instruments emulators (TI-84, TI-108, TI-34)
3. **MathJSCalculatorProvider** - Open-source math.js library

**Proposed Structure:**
```
@pie-players/pie-calculator-core/
├── src/
│   ├── provider-interface.ts  # CalculatorProvider, Calculator interfaces
│   ├── types.ts               # CalculatorType, CalculatorState, etc.
│   └── index.ts

@pie-players/pie-calculator-desmos/
├── src/
│   └── desmos-provider.ts     # Desmos implementation
│   └── index.ts

@pie-players/pie-calculator-ti/
├── src/
│   └── ti-provider.ts         # TI emulator implementation
│   └── index.ts

@pie-players/pie-calculator-mathjs/
├── src/
│   └── mathjs-provider.ts     # Math.js implementation (open-source fallback)
│   └── index.ts
```

**Benefits:**
- ✅ **Zero UI dependencies** in core interfaces
- ✅ **Licensing separation** - TI requires commercial license, Desmos requires API key
- ✅ **Pluggable providers** - Easy to add new calculator vendors
- ✅ **Tree-shakeable** - Apps only bundle calculators they use
- ✅ **Open-source fallback** - Math.js provider always available

**Implementation Complexity:** Medium
- ~500 lines of interface definitions to extract
- 3 existing provider implementations to relocate
- No UI framework dependencies to untangle

**Impact:**
- **Bundle Size:** High - Calculator providers are large (Desmos ~200KB, TI >500KB)
- **Licensing:** High - Clear separation of licensed vs open-source
- **Developer Experience:** High - Clear provider selection

---

### 2. Accessibility Catalog System ⭐⭐⭐⭐ (HIGH PRIORITY)

**Current State:**
- Single implementation: `AccessibilityCatalogResolver`
- QTI 3.0 compliant
- No UI dependencies
- Could have alternative implementations (e.g., cloud-based, cached)

**Evidence:**
```typescript
// Current location: assessment-toolkit/src/services/interfaces.ts
export interface IAccessibilityCatalogResolver {
  setDefaultLanguage(language: string): void;
  getDefaultLanguage(): string;
  addItemCatalogs(catalogs: any[]): void;
  clearItemCatalogs(): void;
  hasCatalog(catalogId: string): boolean;
  getAlternative(catalogId: string, options: CatalogLookupOptions): ResolvedCatalog | null;
  getAllAlternatives(catalogId: string): ResolvedCatalog[];
  getStatistics(): CatalogStatistics;
  reset(): void;
  destroy(): void;
}
```

**Types:**
```typescript
export type CatalogType =
  | 'spoken'
  | 'sign-language'
  | 'braille'
  | 'tactile'
  | 'simplified-language'
  | 'audio-description'
  | 'extended-description'
  | string;

export interface CatalogLookupOptions {
  type: CatalogType;
  language?: string;
  useFallback?: boolean;
}

export interface ResolvedCatalog {
  catalogId: string;
  type: CatalogType;
  language?: string;
  content: string;
  source: 'assessment' | 'item';
}
```

**Potential Implementations:**
1. **InMemoryCatalogResolver** (current) - In-memory catalog storage
2. **CloudCatalogResolver** - Fetch catalogs from CDN/API
3. **CachedCatalogResolver** - Local storage + fallback

**Proposed Structure:**
```
@pie-players/pie-accessibility-core/
├── src/
│   ├── catalog-interface.ts   # IAccessibilityCatalogResolver
│   ├── types.ts               # CatalogType, ResolvedCatalog, etc.
│   └── index.ts
```

**Current Implementation Location:**
- Keep `AccessibilityCatalogResolver` in assessment-toolkit (it's the reference implementation)
- Core package only contains interfaces

**Benefits:**
- ✅ **QTI 3.0 standardization** - Pure interface definition
- ✅ **Alternative storage strategies** - Cloud, local, hybrid
- ✅ **Third-party integrations** - External catalog services
- ⚠️ **Single implementation currently** - Lower immediate value

**Implementation Complexity:** Low
- ~200 lines of interface definitions
- No existing alternative implementations
- Already well-abstracted

**Impact:**
- **Bundle Size:** Low - Interfaces are small
- **Standards Compliance:** High - QTI 3.0 ecosystem
- **Developer Experience:** Medium - Enables custom implementations

**Recommendation:** Consider combining with Theme/I18n in a `@pie-players/pie-services-core` package

---

### 3. Theme Provider System ⭐⭐⭐ (MEDIUM PRIORITY)

**Current State:**
- Single implementation: `ThemeProvider`
- Uses CSS custom properties (no framework deps)
- Could have alternative implementations (Tailwind, CSS-in-JS)

**Evidence:**
```typescript
// Current location: assessment-toolkit/src/services/interfaces.ts
export interface IThemeProvider {
  applyTheme(config: ThemeConfig): void;
  getCurrentTheme(): Required<ThemeConfig>;
  reset(): void;
  destroy(): void;
}

export interface ThemeConfig {
  highContrast?: boolean;
  fontSize?: FontSize;
  backgroundColor?: string;
  foregroundColor?: string;
  accentColor?: string;
  // ... more color options
}
```

**Potential Implementations:**
1. **CSSVarThemeProvider** (current) - CSS custom properties
2. **TailwindThemeProvider** - Tailwind CSS classes
3. **EmotionThemeProvider** - CSS-in-JS (Emotion/styled-components)
4. **MaterialThemeProvider** - Material Design theming

**Benefits:**
- ✅ **Framework flexibility** - Support different styling approaches
- ✅ **Accessibility standards** - WCAG compliance interface
- ⚠️ **Current implementation sufficient** - CSS vars work everywhere

**Implementation Complexity:** Low
- ~100 lines of interface definitions
- Single implementation currently

**Impact:**
- **Bundle Size:** Low
- **Framework Support:** Medium
- **Developer Experience:** Low - Current solution works well

**Recommendation:** **Keep in assessment-toolkit** - Current implementation is universal enough

---

### 4. Highlight Coordinator ⭐⭐ (LOW PRIORITY)

**Current State:**
- Single implementation: `HighlightCoordinator`
- DOM-based (uses CSS Highlight API when available)
- No framework dependencies

**Evidence:**
```typescript
export interface IHighlightCoordinator {
  highlightRange(range: Range, type: HighlightType, color: HighlightColor): void;
  clearHighlights(type: HighlightType): void;
  clearAll(): void;
  isSupported(): boolean;
}
```

**Benefits:**
- ✅ **Clean interface**
- ⚠️ **Unlikely to have alternatives** - DOM API is standard

**Recommendation:** **Keep in assessment-toolkit** - Browser APIs are the only reasonable implementation

---

### 5. Tool Coordinator ⭐⭐ (LOW PRIORITY)

**Current State:**
- Single implementation: `ToolCoordinator`
- Manages z-index and visibility
- No framework dependencies

**Evidence:**
```typescript
export interface IToolCoordinator {
  registerTool(id, name, element?, layer?): void;
  unregisterTool(id: string): void;
  showTool(id: string): void;
  hideTool(id: string): void;
  bringToFront(element: HTMLElement): void;
  getToolState(id: string): ToolState | undefined;
  subscribe(listener: () => void): () => void;
}
```

**Benefits:**
- ✅ **Clean interface**
- ⚠️ **Unlikely to have alternatives** - DOM manipulation is standard

**Recommendation:** **Keep in assessment-toolkit** - Implementation is straightforward

---

## Recommendations Summary

### Immediate Action Items

#### 1. Extract Calculator Providers ⭐⭐⭐⭐⭐ (HIGHEST ROI)

**Create:**
```
@pie-players/pie-calculator-core       # Interfaces only
@pie-players/pie-calculator-desmos     # Desmos provider
@pie-players/pie-calculator-ti         # TI emulator provider
@pie-players/pie-calculator-mathjs     # Open-source fallback
```

**Benefits:**
- Massive bundle size savings (optional 500KB+ calculators)
- Clear licensing boundaries (TI license, Desmos API key)
- Open-source fallback always available
- Easy to add new calculator vendors

**Effort:** Medium (3-5 hours)

**Impact:** ⭐⭐⭐⭐⭐ Very High

---

#### 2. Consider: Unified Services Core ⭐⭐⭐

Instead of separate packages for each service, consider:

```
@pie-players/pie-services-core
├── accessibility/
│   ├── catalog-interface.ts    # IAccessibilityCatalogResolver
│   └── types.ts
├── theme/
│   ├── theme-interface.ts      # IThemeProvider
│   └── types.ts
├── highlight/
│   ├── highlight-interface.ts  # IHighlightCoordinator
│   └── types.ts
├── i18n/
│   └── i18n-interface.ts       # II18nService (re-export)
└── index.ts
```

**Benefits:**
- Single core package for all service interfaces
- Easier to maintain
- Clearer dependency graph
- Still zero UI dependencies

**Drawbacks:**
- Couples otherwise unrelated services
- Harder to version independently

**Recommendation:** Only if multiple services need extraction. For now, **prioritize calculator providers only**.

---

### Keep in Assessment Toolkit

The following should **remain in assessment-toolkit** as they:
1. Have single implementations
2. Use standard DOM/Browser APIs
3. Are unlikely to have alternatives

- ThemeProvider (CSS custom properties work universally)
- HighlightCoordinator (CSS Highlight API is standard)
- ToolCoordinator (DOM manipulation is straightforward)
- AccessibilityCatalogResolver (single implementation, well-integrated)

---

## Architecture Principles

Based on the successful TTS refactoring, apply these principles:

1. **Zero Dependencies in Core** - Interface packages must have no runtime dependencies
2. **Multiple Implementations Required** - Only extract if 2+ real implementations exist or are planned
3. **UI Independence** - Core packages must have no framework dependencies
4. **Always-Available Fallback** - At least one implementation must be built into toolkit
5. **Clear Licensing Boundaries** - Separate commercial/licensed providers from open-source
6. **Bundle Size Impact** - Prioritize extraction where providers are large (>100KB)

---

## Implementation Priority

### Phase 1 (Recommended Now)
1. ✅ **Calculator Provider System** - Highest impact, clear separation

### Phase 2 (If Needed)
2. **Accessibility Catalog Core** - If external catalog services emerge
3. **Unified Services Core** - If multiple services need extraction

### Not Recommended
- Theme Provider (current implementation is universal)
- Highlight Coordinator (browser API is standard)
- Tool Coordinator (straightforward implementation)

---

## Conclusion

**Primary Recommendation:** Extract the **Calculator Provider System** following the TTS architecture pattern. This provides:
- Massive bundle savings (500KB+)
- Clear licensing boundaries
- Open-source fallback
- Pluggable architecture

**Secondary Recommendation:** Monitor for need to extract accessibility catalog interfaces if:
- Cloud-based catalog services emerge
- Third-party catalog integrations are needed
- Multiple storage strategies become necessary

All other services should remain in assessment-toolkit as their current implementations are sufficient and universal.
