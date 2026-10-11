# Instrumentation Providers Implementation Plan

Status: Active. Slices 1 and 4 have landed; slices 2, 3, 5, 6 and 7 are open.

This plan sequences the instrumentation work for contributors. The
[design note](./instrumentation-providers.md) owns the model, the ownership
boundary and the open questions; this file owns sequence, done conditions and
release evidence. When the open slices land, the design note's status line
records the outcome and this plan retires.

Owner: PIE Players maintainers

Related:

- [Instrumentation providers design note](./instrumentation-providers.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)
- [Consumer API dependencies maintenance](../integrations/consumer-api-dependencies-maintenance.md)

## Sequencing Rules

- One slice per branch, each landing green on its own. No slice depends on a
  later one to be correct.
- No slice adds an entry to a published `exports` map, and no published surface
  gains the name of a backend PIE does not ship an adapter for. The DataDog and
  OTel code belongs in `packages/players-shared/tests/fixtures`, which slice 3
  creates.
- Every slice that touches published source carries one `patch` changeset;
  `bun run check:changeset-patch-only` is the gate and pending `minor` entries
  are release blockers.
- Slices 3 and 4 change no host-visible behavior. Slices 1, 2 and 6 change what
  the backend of Host P, a consumer in the
  [consumer API dependencies](../integrations/consumer-api-dependencies.md)
  record, receives, as the design note's
  [consumer position](./instrumentation-providers.md#consumer-position)
  records. Slice 5 does not land before its evidence gate clears.

## Slice 1: Probed Readiness

Landed in a0408d4a.

`initialized` means configured. `isReady()` probes the live global on every
call, and `NewRelicInstrumentationProvider` resolves its handle per call instead
of latching one in `initialize()`. The shape probe —
`noticeError` and `addPageAction` both callable, over `window.newrelic` and
`window.NREUM` — lives in one internal module and is not exported.

Done when a provider configured before its agent exists sends after the agent
appears, asserted in `packages/players-shared/tests`, and the existing
instrumentation tests pass unchanged in intent. No `exports` change.

## Slice 2: Central Attribute Naming

The `pie.*` prefix is applied once, in `BaseInstrumentationProvider`, for
PIE-originated attributes. Per-backend reshaping — DataDog's `context` nesting,
OTel's `exception.*` — stays in the adapter.

Done when every PIE-emitted attribute passes through one function and the
design note's mapping table is asserted by tests.

Naming stops being cheap once a real backend receives these keys, which for
Host P starts with its `@pie-players` rollout, independent of slice 5.

## Slice 3: Conformance Suite And Fixtures

`instrumentation-provider-conformance.test.ts` plus DataDog RUM and OTel
adapters under `tests/fixtures`. The suite asserts the whole contract surface:
readiness probing rather than latching, the filter/sample/transform order,
timestamp stamping, the event shape `trackMetric` produces, attribute
prefixing, and degradation to a no-op when the handle is missing a method.

Done when it passes against the New Relic, console, composite and debug-panel
adapters and both fixtures, and when an adapter that latches readiness fails
it. This slice is what carries the claim that the contract is not vendor-shaped.

## Slice 4: One Default Factory

Landed in da9e2f71.

The module-level memoized instance in `instrumentation-provider-resolution.ts`
and the per-monitor construction in `resource-monitor.ts` collapse behind one
internal factory at the resolution seam. The resource monitor stops
constructing its own provider.

Done when a resource monitor with no injected provider receives the resolved
default, and `manageProviderLifecycle` semantics for injected providers are
unchanged.

## Slice 5: Detection, New Relic Only

When `trackPageActions` is true and no provider is named, the factory probes and
binds. One entry, closed list.

Gate before landing: refresh the consumer pad by its maintenance procedure and
confirm that no host enables `trackPageActions` without also naming a provider.
The gate fails on Host P; the design note's consumer position records what
detection and the earlier slices change for that host.

Done when the pad is refreshed or its commit trailer recorded,
`bun run check:consumer-pad` is green, and a page carrying an agent with
`trackPageActions` unset or false is asserted to send nothing.

## Slice 6: Buffering

A bounded ring buffer in the base class, flushed on the first successful
readiness probe, with sampling applied at enqueue. The bound and whether errors
and events get separate bounds are open in the design note and are decided in
this slice.

Done when events emitted before readiness arrive after it in order with their
`timestamp` attribute intact, and when the eviction policy the slice chooses is
asserted.

## Slice 7: Documentation And Release

Package READMEs and the player tutorials describe probed readiness and
detection. The design note's status paragraph moves each item from intended to
built. No export is renamed; a rename would need Host R, the module's one
programmatic consumer, fixed in the same change.

Done when `bun run check:docs` and `bun run verify:pre-commit` pass, and the
changeset for the detection behavior states which configuration starts sending
(`trackPageActions: true` with no provider named) and what it sends.

## Definition Of Done

- The contract is exercised against three backends, of which PIE ships an
  adapter for one.
- No published surface names a backend PIE does not ship an adapter for.
- An agent that boots after the first player receives telemetry.
- A host that has not set `trackPageActions` receives nothing.
