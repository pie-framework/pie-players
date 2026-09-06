# PIE Assessment Player Demos

Demonstrations for the PIE assessment player and toolkit host integration.

## Running the Demos

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). For this
app:

```bash
bun run dev:assessment -- --rebuild
bun run dev:assessment
```

For section-player, toolkit, toolbar, and tool package iteration, run the build
watcher in a second terminal:

```bash
bun run build:watch:section-tools
```

For assessment-player or shared runtime changes, rebuild the changed package
before refreshing so the demo does not load stale `dist` output.

The assessment demos run on `http://localhost:5500` by default.

Use root scripts rather than running `bun run dev` directly inside
`apps/assessment-demos`; root scripts apply shared monorepo startup behavior.

## Persistence lab (R2)

Open `/persistence-lab` after starting the demo. The development-only page and
`/api/persistence-lab/[attemptId]` endpoints use the **built** assessment player,
its public controller, and its existing persistence strategy. The attempt ID in
the URL lets a reload read the same saved attempt. “Start a new attempt” opens an
isolated attempt. No production host or credentials are needed.

The server stores the complete JSON snapshot in a separate SQLite database at
`<OS temporary directory>/pie-assessment-demos/persistence-lab.sqlite`. It commits
the snapshot and write log in one transaction before responding. It deliberately
uses last-writer-wins storage: it supplies no hidden ordering, retry, or
coalescing policy that could conceal an assessment-controller defect. The lab is
a single-process reference host, not an authoritative submission service.
The page and fault endpoints return 404 in the built app.

The controls select the **next strategy write**, then reset to normal:

- **Commit and acknowledge:** return HTTP 200 after the SQLite commit.
- **Hold until released:** expose a pending write with Release and Reject
  buttons. A held write does not touch the saved snapshot; it rejects after
  60 seconds if left alone.
- **Reject before commit:** return HTTP 503 without replacing saved state.
- **Commit, then fail acknowledgement:** commit but return HTTP 504, modeling
  an intermediary failure after storage accepted the write. Reading the attempt
  reveals the commit; a failed response alone cannot determine whether it saved.

Navigation captures the active answer through the public controller but does
not initiate saves. Use Save explicitly to control the request sequence. The
lab displays server commits, caller promise outcomes, the controller's submitted
flag, and successful submission-event count separately so contradictions remain
visible. It adds no compensating client save queue or submission error handling.

Reproduce the two open defects:

1. Choose an answer in section 1. Select Hold and Save. Navigate to section 2,
   choose another answer, and Save normally. Wait for the newer write to commit,
   then release the older write. Reload: the older section-1 snapshot wins.
2. On a new attempt, choose an answer, select Reject, and Submit. The server
   records no commit and the error hook reports rejection, but the controller
   reports submitted and the submit promise resolves.

### Regression coverage

`packages/assessment-player/tests/assessment-persistence-lab.spec.ts` runs in the
existing assessment-player suite and the local pre-push/CI gates. Every test uses
a unique attempt, reads actual HTTP/SQLite results, and deletes its own rows.
It covers answer/navigation/reload with browser storage cleared, attempt
isolation, manual release and keyboard access at 320px, failed acknowledgement,
and the two R2 invariants. JSON observations are attached to the test report.
Fault controls and pending HTTP requests are scoped to one running demo server;
this does not test process-crash recovery or competing production writers.

Run only the lab:

```bash
bun run build:e2e:assessment-player
bunx playwright test packages/assessment-player/tests/assessment-persistence-lab.spec.ts --config packages/assessment-player/playwright.config.ts
```

The three lab/transport tests must pass. The two R2 tests assert the **desired**
behavior and currently use `test.fail` immediately before their final invariant
assertion. Setup, transport, storage, and reload errors are not expected failures.
The save-race test gives the newer request a bounded one-second admission window
before releasing the old write; it also works when a repaired writer serializes
that second request until release. It asserts the final state after both settle,
not a specific queue implementation.

To see the two defects as ordinary failing tests:

```bash
PIE_R2_STRICT=1 bunx playwright test packages/assessment-player/tests/assessment-persistence-lab.spec.ts --config packages/assessment-player/playwright.config.ts --grep R2
```

When repairing R2, remove the two expected-failure annotations and this temporary
strict-mode switch in the same change. An unexpected pass currently fails the
suite, so an implementation change cannot silently leave obsolete markers.
The lab is evidence for this explicit reference contract. It does not refresh
Host V/A/R verification dates or decide backend finalization, receipts,
multitab conflict handling, or retry after an uncertain outcome. The
[remediation tracker](../../docs/architecture/delivery-reliability-remediation-plan.md#r2--saves-race-and-submission-can-falsely-succeed)
continues to own R2's repair status.
