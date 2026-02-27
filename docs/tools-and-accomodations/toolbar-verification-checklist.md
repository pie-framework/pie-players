# Toolbar Verification Checklist

Use this checklist before and after each incremental toolbar refactor step.

## Target Demo

- URL: `http://localhost:5300/demo/question-passage?player=iife&layout=split-panel&mode=candidate&esmSource=remote`

## Manual Checks

1. Toolbars render
- Passage/question header toolbars render.
- Section right-rail toolbar renders.
- Buttons are visible and not broken/misaligned.

2. Tool activation works
- Question-level calculator activates without runtime errors.
- Question-level answer eliminator activates without runtime errors.
- Question-level TTS control activates without runtime errors.

3. Console health
- No unresolved import errors.
- No module specifier errors (for example, `Failed to resolve module specifier ...`).
- No thrown errors on tool button click.

## Optional Scripted Smoke Check

- Run: `node scripts/verify-toolbar-smoke.mjs`
- Override URL with: `TOOLBAR_SMOKE_URL=<url> node scripts/verify-toolbar-smoke.mjs`

The scripted check validates rendering and basic click-path stability and fails on console/runtime import-resolution errors.

