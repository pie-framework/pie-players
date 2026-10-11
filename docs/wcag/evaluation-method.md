# Evaluation Method

This document is the project's WCAG evaluation method, for contributors
reviewing a change, a package or a feature area for accessibility. It adapts
official WAI evaluation guidance to a component library with demo apps and
local evals.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
  - [Easy Checks - A First Review of Web Accessibility](https://www.w3.org/WAI/test-evaluate/preliminary/)
  - [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- **Project guidance**: the rest of this document

## Credible Evaluation

WAI's evaluation guidance holds that automated tools cannot determine
conformance and that knowledgeable human evaluation is required. A credible
review here combines:

1. automated checks
2. keyboard and focus testing
3. screen reader testing
4. visual checks for contrast, zoom, reflow, and focus appearance
5. code and semantics review for custom elements and dynamic UI

## Evaluation Levels

A review uses the smallest level that matches the task.

### Level 1: Quick Checks

For early implementation review or low-risk changes:

- Run an automated scan where available.
- Do a short keyboard pass.
- Check obvious headings, landmarks, labels, contrast, and focus visibility.
- Use [Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/) as the starting frame.

### Level 2: Component Review

For a package, tool or feature before calling it accessibility-ready:

- Review the component against the relevant criteria in [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md).
- Review the relevant widget guidance in [`patterns-and-widgets.md`](./patterns-and-widgets.md).
- Test keyboard, focus order, focus restoration, live announcements, and visible focus.
- Check both rendered UI behavior and code-level semantics.

### Level 3: Conformance-Style Audit

For a thorough review of a feature area such as `assessment-toolkit` or
`section-player`, the WCAG-EM sequence applies:

1. Define scope.
2. Explore the surfaces and identify critical functionality.
3. Select a representative sample.
4. Evaluate the sample with automated and manual methods.
5. Record findings by WCAG criterion and severity.

[WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) is the official methodology.

## Repo-Specific Workflow

### 1. Scope

The review covers one of:

- a single tool
- a shared UI pattern
- a package
- the integrated demo experience

For package- and feature-level work, scope is usually centered on:

- `packages/assessment-toolkit`
- `packages/section-player`
- `packages/item-player`
- `packages/assessment-player`
- `packages/players-shared`
- individual `packages/tool-*`
- `apps/section-demos`
- `apps/item-demos`
- `apps/assessment-demos`

### 2. Representative Surfaces

The [project surface map](./project-surface-map.md) names the criteria per
surface. These docs describe the surfaces:

- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
- [`../section-player/integration-guide.md`](../section-player/integration-guide.md)
- [`../../packages/section-player/README.md`](../../packages/section-player/README.md)

The demo apps exercise integrated behavior:

- `apps/section-demos`
- `apps/item-demos`
- `apps/assessment-demos`

### 3. Automated Evidence

Test harnesses supply evidence; a passing axe scan does not establish WCAG
conformance. The harnesses are the root `package.json` e2e scripts and the
Playwright specs under `packages/section-player/tests`,
`packages/item-player/tests` and `packages/assessment-player/tests`.

Root CI runs lint, typecheck and the package rules, the build, a critical
Playwright e2e matrix (assessment player, item player, players-shared and print
player) and the sharded section-player e2e suite; the accessibility specs among
them run axe scans. The root pre-push hook runs the full local gate
(`verify:pre-push`, which is `bun run verify:local-pr`) when a push carries new
commits.

### 3.1 Critical Automated Baseline

From the repo root:

```bash
bun run test:e2e:a11y:critical
```

This runs the critical accessibility subset across section, item and assessment
player flows.

### 3.2 Targeted Surface Suites

A change to chrome, shells or layout also runs these, from the repo root:

```bash
export SECTION_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5300)
bun run build:e2e:section-player
bunx playwright test \
  packages/section-player/tests/section-toolbar-tools.spec.ts \
  packages/section-player/tests/section-player-navigation-contract.spec.ts \
  packages/section-player/tests/section-player-reflow.spec.ts \
  packages/section-player/tests/section-demos-chrome-a11y.spec.ts \
  --config packages/section-player/playwright.config.ts

export ITEM_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5400)
bun run build:e2e:item-player
bunx playwright test \
  packages/item-player/tests/item-demos-chrome-a11y.spec.ts \
  --config packages/item-player/playwright.config.ts
```

A change that touches custom-element boundaries also runs:

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

### 4. Manual Passes

#### Keyboard and Focus Pass

Check:

- all functionality is reachable by keyboard
- focus order is logical
- focus never gets trapped unintentionally
- open and close behavior returns focus appropriately
- floating tools and dialogs do not obscure the current focus target

#### Screen Reader Pass

Check:

- landmarks and headings are meaningful
- controls have correct names
- state changes are announced appropriately
- dialogs and overlays announce themselves correctly
- math, TTS, and selection-based features remain understandable

#### Visual Pass

Check:

- contrast
- non-text contrast
- 200% zoom with text resizing (1.4.4)
- 400% zoom reflow (1.4.10); the control-sizing e2e specs run both factors
- narrow-width reflow at 320 CSS px
- visible focus
- target size for compact controls and handles

### 5. Findings

Each finding records:

- WCAG criterion ID and title
- severity
- affected surface or component
- reproduction notes
- why the issue matters to users
- suggested fix direction

## Finding Format

```md
- **WCAG**: 2.4.3 Focus Order (Level A)
- **Severity**: High
- **Surface**: `packages/assessment-toolkit` floating tool shell
- **Issue**: Focus moves behind the active tool window when keyboard users tab out of the shell.
- **Evidence**: Tab can reach background controls while the shell remains open.
- **Fix direction**: Make the shell behave like the dialog model being claimed, or stop presenting it as modal.
```

## Common Evaluation Mistakes

- declaring conformance based on axe or Lighthouse alone
- reviewing only one browser and no assistive technology
- checking only one visual theme
- checking static markup but not dynamic state changes
- testing only a single happy-path route
- using repo evals as if they were the standard text

## In This Project

This repo mixes:

- custom elements
- shadow DOM and light DOM boundaries
- dynamically mounted tool UIs
- floating windows and overlays
- split-pane layouts
- assessment-specific interaction patterns

A valid evaluation therefore inspects rendered semantics and user interaction
in addition to source code and browser automation.
