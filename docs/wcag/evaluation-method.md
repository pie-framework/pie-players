# Evaluation Method

This document describes the project's accepted WCAG evaluation method.

It is based on official WAI evaluation guidance, adapted for a component-library repo with demo apps and local evals.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
  - [Easy Checks - A First Review of Web Accessibility](https://www.w3.org/WAI/test-evaluate/preliminary/)
  - [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- **Project guidance**: the rest of this document

## What Counts As A Credible WCAG Evaluation

WAI's evaluation guidance is explicit about two important points:

- automated tools help, but they are not enough to determine conformance
- knowledgeable human evaluation is required

In this repo, that means a credible review combines:

1. automated checks
2. keyboard and focus testing
3. screen reader testing
4. visual checks for contrast, zoom, reflow, and focus appearance
5. code and semantics review for custom elements and dynamic UI

## Evaluation Levels

Use the smallest level that matches the task.

### Level 1: quick checks

Use this for early implementation review or low-risk changes.

- Run an automated scan where available.
- Do a short keyboard pass.
- Check obvious headings, landmarks, labels, contrast, and focus visibility.
- Use [Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/) as the starting frame.

### Level 2: component review

Use this for a package, tool, or feature before calling it accessibility-ready.

- Review the component against the relevant criteria in [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md).
- Review the relevant widget guidance in [`patterns-and-widgets.md`](./patterns-and-widgets.md).
- Test keyboard, focus order, focus restoration, live announcements, and visible focus.
- Check both rendered UI behavior and code-level semantics.

### Level 3: conformance-style audit

Use this for a thorough review of a feature area such as `assessment-toolkit` or `section-player`.

Follow the WCAG-EM-style sequence:

1. Define scope.
2. Explore the surfaces and identify critical functionality.
3. Select a representative sample.
4. Evaluate the sample with automated and manual methods.
5. Record findings by WCAG criterion and severity.

For the official methodology frame, use [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/).

## Repo-Specific Workflow

### 1. Define scope

Decide whether the review is about:

- a single tool
- a shared UI pattern
- a package
- the integrated demo experience

For package- and feature-level work, scope is usually centered on:

- `packages/assessment-toolkit`
- `packages/section-player`
- `packages/players-shared`
- individual `packages/tool-*`
- `apps/section-demos`
- `apps/item-demos`

### 2. Identify representative surfaces

Use project docs and demos to pick the right review surface:

- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
- [`../section-player/client-architecture-tutorial.md`](../section-player/client-architecture-tutorial.md)
- [`../../packages/section-player/README.md`](../../packages/section-player/README.md)

Use demo apps to exercise integrated behavior:

- `apps/section-demos`
- `apps/item-demos`

### 3. Gather supporting automated evidence

Use existing test harnesses and local evals as supporting evidence, not as proof of conformance.

Relevant repo references:

- [`../evals/readme.md`](../evals/readme.md)
- `package.json` e2e scripts at the repo root
- Playwright coverage under `packages/section-player/tests` and `packages/item-player/tests`

Project rule:

- passing an axe scan does **not** equal WCAG conformance
- passing a local eval does **not** equal WCAG conformance

They are evidence inputs, not the final conclusion.

### 4. Run the manual passes

#### Keyboard and focus pass

Check:

- all functionality is reachable by keyboard
- focus order is logical
- focus never gets trapped unintentionally
- open and close behavior returns focus appropriately
- floating tools and dialogs do not obscure the current focus target

#### Screen reader pass

Check:

- landmarks and headings are meaningful
- controls have correct names
- state changes are announced appropriately
- dialogs and overlays announce themselves correctly
- math, TTS, and selection-based features remain understandable

#### Visual pass

Check:

- contrast
- non-text contrast
- 200% zoom
- narrow-width reflow
- visible focus
- target size for compact controls and handles

### 5. Record findings

Findings should be recorded with:

- WCAG criterion ID and title
- severity
- affected surface or component
- reproduction notes
- why the issue matters to users
- suggested fix direction

## Recommended Finding Format

Use this shape consistently:

```md
- **WCAG**: 2.4.3 Focus Order (Level A)
- **Severity**: High
- **Surface**: `packages/assessment-toolkit` floating tool shell
- **Issue**: Focus moves behind the active tool window when keyboard users tab out of the shell.
- **Evidence**: Tab can reach background controls while the shell remains open.
- **Fix direction**: Make the shell behave like the dialog model being claimed, or stop presenting it as modal.
```

## Common Evaluation Mistakes

Avoid these shortcuts:

- declaring compliance based on axe or Lighthouse alone
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

Because of that, code review and runtime behavior review both matter. A valid evaluation here must inspect rendered semantics and user interaction, not only source code or only browser automation.
