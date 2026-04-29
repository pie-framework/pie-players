---
name: playwright-sandbox
description: Run Playwright (and any command that triggers Playwright via lefthook) outside the agent sandbox. Use whenever invoking `git push`, `bun run test:e2e:*`, `bunx playwright`, `bun playwright`, or any helper script that imports `@playwright/test`. Trigger on cues like "git push", "playwright", "test:e2e", "browser launch", "Chromium", "headless shell", "lefthook", "pre-push hook".
---

# Playwright and Sandboxed Execution

Canonical rule: [`.cursor/rules/playwright-sandbox.mdc`](../../../.cursor/rules/playwright-sandbox.mdc).
Pre-push hook config: [`lefthook.yml`](../../../lefthook.yml).
Playwright configs: `packages/*/playwright.config.ts`.

## Why this exists

Playwright cannot install browsers, spawn a web server, or launch
Chromium inside the default agent sandbox. Symptoms inside the sandbox:

- `browserType.launch: Executable doesn't exist at .../chrome-headless-shell-<n>/...`
- Dev-server start timeouts.
- Silent network blocks when Playwright tries to download browser
  binaries.

Each sandbox session also gets a fresh per-session temp directory, so
even if you let Playwright download a browser, the next session re-pays
the ~90 MB download. Running outside the sandbox reuses the shared
`~/Library/Caches/ms-playwright/` cache.

## Rule

Invoke any Playwright-triggering command with
`required_permissions: ["all"]` (the safest level). At minimum
`["full_network"]` plus write access to the Playwright browser cache, but
prefer `["all"]` — `git push` also triggers `check:publint` and other
scripts that write to caches outside the workspace.

## What needs `required_permissions: ["all"]`

- `git push` — the `pre-push` lefthook runs:
  - `bun run test:e2e:section-player:critical`
  - `bun run test:e2e:item-player:multiple-choice`
  - `bun run test:e2e:assessment-player`
- Any `bun run test:e2e:*` script.
- `bunx playwright …` / `bun playwright …` (install, test, codegen).
- Helper scripts that import `@playwright/test` (e.g. `verify-*.mjs`,
  ad-hoc DOM verification scripts, screenshot capture).
- `bun run test` / `bun test` in packages whose `tests/` directory
  contains Playwright `*.spec.ts` files (most `packages/*-player/tests/`).

## Practical pattern (Shell tool call)

```text
required_permissions: ["all"]
```

Example invocation:

```bash
bun run test:e2e:section-player:critical
```

…with `required_permissions: ["all"]` set on the shell call.

## Related

- [`.cursor/rules/build-before-tests.mdc`](../../../.cursor/rules/build-before-tests.mdc)
  — rebuild consumers before running e2e so stale `dist/` artefacts don't
  confuse the failure mode.
- The `build-before-tests` skill describes the rebuild discipline that
  pairs with this one.
