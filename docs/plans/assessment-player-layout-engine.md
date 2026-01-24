# Assessment player + layout engine rollout

## Status

- **State**: draft (approved direction; implementation pending)
- **Owner**: PIE Players
- **Last updated**: 2026-01-13

## Goals

1. Fix the `/assessment` example so items actually render.
2. Make `<pie-assessment-player>` the **convenient one-tag embed** with a good baked-in **SchoolCity-style layout**.
3. Ensure `@pie-framework/pie-assessment-toolkit` remains **usable without** `<pie-assessment-player>` (DIY hosts can reuse tools + services).
4. Implement the **Question Layout Engine** architecture (template-driven layout composition) as a real, shippable system.
5. Support **both**:
   - legacy stimulus config shape (`{ pie, passage }`) like `pie-player-components`
   - QTI assessment-like structure (`testParts/sections/...`) in addition to the current `AssessmentEntity.questions/sections`
6. Update documentation to reflect these architecture decisions.

## Key architecture decisions

### Orchestrator

- The headless “orchestrator” (navigation + item loading + session persistence + services wiring) should be a toolkit class named:
  - **`AssessmentSessionManager`** (rename from current `AssessmentPlayer`).
- `<pie-assessment-player>` is the **UI tag** (convenience wrapper), not the core orchestrator.

### Layout engine + rendering

- Implement **headless** `LayoutEngine` in `@pie-framework/pie-assessment-toolkit`:
  - template registry
  - selection logic
  - region sizing + persistence hooks (panel widths, etc.)
- Provide **rendering** primarily via **toolkit web components** (custom elements) so hosts can compose via HTML tags.

### Web components availability

Most *visual* parts of the assessment toolkit should be available as **custom elements** (HTML5 tags), packaged in `@pie-framework/pie-assessment-toolkit`.

- Standalone, composable subcomponents must have stable prop/event contracts so a host can build their own player UI without `<pie-assessment-player>`.

## Deliverables (high-level)

### A) Fix the example

- `/assessment` renders items by default.
- Passage-based templates show passage + item split by default (stimulus behavior).

### B) Toolkit: headless + web component layers

#### Headless (TS/JS)

- `AssessmentSessionManager` (renamed orchestrator)
- `LayoutEngine` (headless template engine)
- Navigation helpers supporting both current and QTI-like shapes

#### Web components (custom elements)

- `pie-layout-engine` (wraps LayoutEngine; emits template/resize events)
- `pie-assessment-session` (wraps AssessmentSessionManager; emits state events)
- `pie-assessment-layout` (batteries-included SchoolCity-style composition)
- Standalone UI subcomponents (also usable directly):
  - `pie-assessment-header`
  - `pie-assessment-nav`
  - `pie-assessment-content`
  - `pie-assessment-tools`
  - `pie-assessment-footer`

### C) `<pie-assessment-player>` baked-in experience

- `@pie-framework/pie-assessment-player` composes the toolkit layout web components and ships the recommended “SchoolCity-style” baked-in UI.

## Implementation checklist

### 1) Fix `/assessment` example data wiring

- [ ] Fix `itemBank` keying mismatch (template IDs vs `item.id`).
- [ ] Implement stimulus default for passage templates:
  - [ ] choose template passage config (`passage` example)
  - [ ] wrap question configs as `{ pie, passage }`
  - [ ] exclude standalone passage from navigation

### 2) Add `LayoutEngine` module to `assessment-toolkit`

- [ ] Create `packages/assessment-toolkit/src/layout-engine/*`
- [ ] Export from `packages/assessment-toolkit/src/index.ts`
- [ ] Minimal templates:
  - [ ] `single-column-standard`
  - [ ] `passage-left-item-right` (SchoolCity baseline)

### 3) QTI-like structure support

- [ ] Extend navigation parsing to understand `testParts/sections/...` in addition to `AssessmentEntity.questions/sections`.
- [ ] Ensure next/prev + question dropdown works for both.

### 4) Rename orchestrator to `AssessmentSessionManager`

- [ ] Rename toolkit `AssessmentPlayer` class to `AssessmentSessionManager`.
- [ ] Keep backward compatibility export (temporary) or provide migration path (decide during implementation).

### 5) Toolkit web components for layout + session

- [ ] Implement custom elements (shadow: none) for:
  - [ ] session manager wrapper (`pie-assessment-session`)
  - [ ] layout engine wrapper (`pie-layout-engine`)
  - [ ] SchoolCity layout composition (`pie-assessment-layout`)
  - [ ] standalone subcomponents listed above
- [ ] Passage rendering rules:
  - [ ] if current item config is stimulus (`{ pie, passage }`), render two item players (passage + item)
  - [ ] else render single item
- [ ] Tools integration:
  - [ ] use `<pie-tool-toolbar>` with injected coordinators/services (JS properties)

### 6) Refactor `<pie-assessment-player>` to use toolkit layout tags

- [ ] `<pie-assessment-player>` becomes the convenient wrapper around `pie-assessment-layout`.

### 7) Error states

- [ ] Improve “item could not be loaded” messaging using `ItemLoadError.code` (`ITEM_NOT_FOUND`, `NO_ITEM_BANK_OR_FETCH_CONFIG`, etc).

### 8) Documentation updates (must ship with code)

- [ ] `docs/ARCHITECTURE.md`: orchestrator naming + toolkit vs player tag responsibilities
- [ ] `docs/question-layout-engine-architecture.md`: update status + map to shipped components/tags
- [ ] `packages/assessment-toolkit/src/player/README.md`: rename + DIY host guidance
- [ ] `packages/tool-toolbar/README.md`: explicit “use toolbar in custom host” example
- [ ] root `README.md`: integration options (A: `<pie-assessment-player>`, B: DIY + toolkit)

## Acceptance criteria

- `/assessment` shows content for selected templates (no blank items).
- Passage-based template shows a passage panel + item panel by default.
- `<pie-assessment-player>` renders with SchoolCity-style layout.
- A host can reuse toolkit services + `<pie-tool-toolbar>` without `<pie-assessment-player>`.
- QTI-like structure can be navigated (at least next/prev + select question).
- Docs updated to reflect the final architecture.

