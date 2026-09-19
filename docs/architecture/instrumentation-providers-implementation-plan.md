# Instrumentation Providers Implementation Plan

Status: Active — slices, order and evidence gates. The
[design note](./instrumentation-providers.md) owns the model, the ownership
boundary and the open questions; this file owns sequence, done conditions and
release evidence.

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
  OTel code lives in `packages/players-shared/tests/fixtures`.
- Every slice that touches published source carries one `patch` changeset;
  `bun run check:changeset-patch-only` is the gate and pending `minor` entries
  are release blockers.
- Slices 1 through 4 change no host-visible behavior. Slice 5 is the first that
  can change what a host's backend receives, and it does not land before its
  evidence gate clears.

## Slice 1: Probed Readiness

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

This is the last cheap moment for naming: after slice 5 a real backend is
receiving these keys.

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

Gate before landing: refresh the consumer pad by its maintenance procedure,
including the delivery consumer not yet profiled there, and confirm that no host
enables `trackPageActions` without also naming a provider. The 2026-09-18 scan
covered one delivery host and predates the pad's own refresh.

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
built. Host R is fixed in the same push if any name changed; none is planned.

Done when `bun run check:docs` and `bun run verify:pre-commit` pass, and the
changeset for the detection behavior names which listed host is affected and
how.

## Definition Of Done

- The contract is exercised against three backends, of which PIE ships one
  adapter.
- No published surface names a backend PIE does not ship an adapter for.
- An agent that boots after the first player receives telemetry.
- A host that has not set `trackPageActions` receives nothing.
