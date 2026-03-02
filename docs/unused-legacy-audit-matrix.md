# Unused/Legacy Audit Matrix

This file records the cleanup baseline used for the staged removals.

## Packages

| Candidate | Signal | Risk | Decision |
| --- | --- | --- | --- |
| `@pie-players/pie-tool-toolbar` | No in-repo runtime imports; only docs/lockfile references | Medium (possible external consumers) | Remove from workspace and publish inventory in this cleanup |
| `@pie-players/pie-print-player` | No in-repo runtime imports | Medium-High (likely externally consumed package) | Keep for now |
| `@pie-players/pie-theme-daisyui` | No in-repo runtime imports, but docs and CSS export use | Medium-High (design-system style consumption may be external) | Keep for now |

## Source Files

| Candidate | Signal | Risk | Decision |
| --- | --- | --- | --- |
| `packages/section-player/src/controllers/SectionControllerEventAdapter.ts` | No source references found | Low | Remove |
| `packages/section-player/src/controllers/SectionToolkitService.ts` | No source references found | Low | Remove |
| `packages/section-player/src/controllers/SessionPersistenceStrategy.ts` | No source references found | Low | Remove |

## Dependencies

| Candidate | Signal | Risk | Decision |
| --- | --- | --- | --- |
| root `@tiptap/*`, `lowlight`, `@sveltejs/kit`, `svelte`, `daisyui` | Duplicated with app-level deps; root runtime imports not needed | Low | Remove from root manifest |
| `@types/katex` in `packages/math-renderer-katex` | Not referenced and likely redundant with built-in KaTeX types | Low | Remove |

## API Routes

| Candidate | Signal | Risk | Decision |
| --- | --- | --- | --- |
| `/api/tts/polly/voices` | Not referenced by section demo UI | Medium (direct endpoint users possible) | Keep (restored to preserve explicit provider endpoint support) |
| `/api/tts/google/voices` | Not referenced by section demo UI | Medium (direct endpoint users possible) | Keep (restored to preserve explicit provider endpoint support) |
| `/api/tts/voices` | Referenced in API docs and serves unified route | Low | Keep |
| `/api/tts/synthesize` | Core functionality route | Low | Keep |
