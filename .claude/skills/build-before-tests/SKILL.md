---
name: build-before-tests
description: Rebuild affected packages before running tests. Use whenever you are about to run `bun test`, `bun run test`, or `bun run test:e2e:*` after editing package source — especially custom-element packages whose consumers load `dist` exports. Trigger on cues like "run tests", "test failing", "stale dist", "rebuild", "consumer app", "doesn't reflect change", "still old behavior".
---

# Build Before Tests

Canonical rule: [`.cursor/rules/build-before-tests.mdc`](../../../.cursor/rules/build-before-tests.mdc).

## Why this exists

Custom-element packages in this repo are consumed via their package
`exports`, which point at built `dist` artifacts. Apps and other packages
do not load `src/` directly. After editing a package's source, the new
behavior is invisible to consumers (and to e2e tests that exercise CE
entrypoints) until the package is rebuilt. Test failures on stale `dist`
look like real bugs and waste investigation time.

## Pre-test checklist

- [ ] Identify which package(s) had source edits in this change.
- [ ] Identify the **direct** consumers that resolve those packages
      through `dist` exports — usually the demo app under `apps/*` and
      any sibling package that imports the changed CE entrypoint.
- [ ] Rebuild the changed package (and its direct consumers if they emit
      build artifacts):

  ```bash
  bun run build                # all publishable packages (safe default)
  # or, scoped:
  turbo build --filter=@pie-players/<changed-package>...
  ```

- [ ] Run the targeted test:

  ```bash
  bun run test                 # unit / component
  bun run test:e2e:section-player           # use required_permissions: ["all"]
  bun run test:e2e:item-player:multiple-choice
  bun run test:e2e:assessment-player
  ```

  E2E tests must run outside the sandbox — see the `playwright-sandbox`
  skill.

## When in doubt

- If the exact impacted package set is unclear, **rebuild all likely
  affected packages** in the current test path. `bun run build` from the
  repo root is a safe default.
- When test failures could plausibly be caused by stale artifacts,
  rebuild and rerun **once** before deeper debugging. Most "doesn't reflect
  my change" symptoms resolve at this step.

## Related skills

- `custom-elements-boundaries` — for why consumers see `dist`.
- `playwright-sandbox` — for how to invoke `test:e2e:*` outside the
  sandbox.
- `svelte-subscription-safety` — same rebuild rule applies when validating
  reactive behavior changes.
