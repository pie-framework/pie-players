# Instrumentation Providers

Status: Design note. Shipped today: the `InstrumentationProvider` contract,
`BaseInstrumentationProvider`, and the New Relic, console, debug-panel and
composite adapters;
[`architecture.md`](./architecture.md#instrumentation--observability) owns the
current provider semantics and the per-layer event ownership model. Not
implemented: probed readiness, agent detection, the conformance suite, central
attribute naming, and buffering. The DataDog and OpenTelemetry adapters
described here are verified examples of host-owned adapters, not products PIE
ships. Correct this note or mark it historical when the built system diverges.

Owner: PIE Players maintainers

Related:

- [Instrumentation and observability](./architecture.md#instrumentation--observability)
- [Instrumentation providers implementation plan](./instrumentation-providers-implementation-plan.md)
- [ADR 0002: provider contracts are not parameterized by config](../adr/0002-provider-contracts-are-not-parameterized-by-config.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

PIE emits telemetry through `InstrumentationProvider` and owns no backend. The
host owns the agent, the credentials, the sampling policy and the bill. An
adapter binds to a handle the host has already booted; it never loads an SDK,
initializes one, or holds a dependency on one.

## Scope

PIE ships one adapter, for New Relic, because Hosts A and P have that agent on
their pages. Around it ship the contract, probed readiness, central attribute
naming, and detection restricted to that one agent.

DataDog and OpenTelemetry stay unshipped and get exercised anyway. A conformance
suite in `packages/players-shared/tests` runs the contract's whole surface
against the New Relic adapter and against DataDog RUM and OTel fixtures, so "the
contract is not New Relic-shaped" is a test result instead of an assertion. The
fixtures live in the test tree, enter no `exports` map, and are the version the
documentation points at. A published adapter is a standing commitment to a
vendor SDK's drift; the contract is the thing that needed proving, and a test
proves it without taking the commitment on.

The ownership boundary makes that the honest shape. Host-owns-the-agent already
assigns the adapter to whoever owns the agent, so a DataDog adapter is host code
by construction and the fixture is a worked example of code a host writes.

## Ownership boundary

| Concern | Owner |
| --- | --- |
| Agent script, client token, endpoint, session sample rate | Host |
| Which agent is on the page | Host |
| Adapter from the contract to that agent's API | PIE for New Relic, host for everything else |
| Attribute naming, event names, event ownership per layer | PIE |
| Whether PIE sends anything | Host, via `trackPageActions` |

No adapter imports a vendor package or `@opentelemetry/api`. Each declares the
minimal call shape it uses as a local structural type and duck-types the handle,
the way [`provider-guards.ts`](../../packages/players-shared/src/instrumentation/provider-guards.ts)
already duck-types host-supplied providers. That keeps optional peers out of the
published declarations, which [ADR 0002](../adr/0002-provider-contracts-are-not-parameterized-by-config.md)
requires, and leaves vendor SDK version drift on the side of the boundary that
already carries it.

## Consumer position

No external host imports any part of this module.
`CompositeInstrumentationProvider`, `NewRelicInstrumentationProvider` and
`DebugPanelInstrumentationProvider` have exactly one consumer, Host R, recorded
under Programmatic API in
[`consumer-api-dependencies.md`](../integrations/consumer-api-dependencies.md).
That host is internally controlled, so under the downstream-consumer rule in
`AGENTS.md` it is not a constraint: it gets fixed in the same push. Host A,
scanned on 2026-09-18, sets `trackPageActions` nowhere, names
`instrumentationProvider` nowhere, and imports nothing from the module.

The implicit default that detection replaces — `trackPageActions: true` with no
provider named — has one consumer, Host P, which is client-facing and whose
loader configuration the pad records. Its `@pie-players` path renders through
the preloaded `pie-item-player`, where both implicit default instances send to
New Relic: the resource monitor's sends a `pie-resource-load` page action per
tracked resource, retry and error page actions, and a `noticeError` per failure,
and resolution's memoized instance sends a `noticeError` per item-player runtime
error. An instance sends only if the agent was on the page when it initialized,
the latch described under probed readiness. That host's own page loads no agent,
so the agent comes from an outer page, as it does for Host A, and either order is
possible.

The predecessor player on that host's main line never receives its loader
configuration: the host binds it there as a property named `loader-config`, and
that element reads `loaderConfig`. PIE resource telemetry therefore first reaches
that host's account through `pie-item-player`.

That puts what the default sends in a client's account, and three parts of this
design change it. Probed readiness and buffering add volume on pages whose agent
arrives after the player starts. Central attribute naming renames every key the
account receives, which is free until that host's `@pie-players` rollout goes
live and breaks any query on those keys after. Detection binds the adapter the
default already constructs there, so it changes nothing that host receives. The
emission gate does not apply, because that host asked for telemetry, and each
change reaches it when it moves its exact pin.

Renaming is available and declined. The existing export names are accurate and
nothing in the design argues for new ones, so they stay; the freedom is recorded
because the opposite assumption would narrow the design on behalf of nobody.

## Probed readiness

`initialized` means the provider has been configured. `isReady()` evaluates the
live world on every call.

Today [`NewRelicInstrumentationProvider`](../../packages/players-shared/src/instrumentation/providers/NewRelicInstrumentationProvider.ts)
decides once, inside `initialize()`, whether the agent exists and writes that
into `initialized`; `isReady()` re-reads the global but conjoins it with the
latch. A host whose agent boots after the first player resolves therefore has
instrumentation dead for the life of the page, with nothing logged above debug
level. This is a defect independent of any new adapter, and it is the one that
matters most: the topology it breaks — the agent injected by an outer page at a
time neither side predicts — is the topology of the host most likely to enable
tracking.

## Agent detection

Detection answers which sink. `trackPageActions` answers whether anything is
sent, and stays the only switch that does.

A probe tests the callable shape, never a name's truthiness. `window.NREUM` is
the New Relic agent's primary global and `window.newrelic` an alias assigned onto
the same object — `gm.NREUM || (gm.NREUM = {}), void 0 === gm.newrelic &&
(gm.newrelic = gm.NREUM)` in the 1.274 loader — and the standard install snippet
creates `NREUM` as a configuration container before any agent code runs.
Presence proves a New Relic agent is intended, not that its API is attached.
`typeof handle.noticeError === "function" && typeof handle.addPageAction ===
"function"`, over both names, is the whole probe. It is also name-agnostic in the
way that matters: the same test shape finds `DD_RUM.addAction`, which likewise
exists before `init()` has run.

Detection runs on demand inside provider resolution and inside readiness
probing. No timer, no `MutationObserver`, no wrapping of the agent's own ready
callback, no assignment to any global. A negative result is never cached, so an
agent that boots after the first player is found on the next probe. The whole
flakiness budget is a property read on `window`, repeated.

Ordering is explicit and first match wins. A host-supplied
`loaderConfig.instrumentationProvider` beats detection, and `null` disables
instrumentation outright.

Detection is New Relic only and closed. Probing for `DD_RUM` and binding a
PIE-owned adapter to it would ship DataDog support through the back door, and a
detector registry keyed by `providerId` would put a vendor key into a published
surface. A host with any other agent passes its provider explicitly, which works
today, so the new public surface is none. A second backend would be a sibling
internal probe and one more entry in the ordered list.

OpenTelemetry could not be detected in any case. The `@opentelemetry/api` global
registry is keyed by an internal version symbol, and reading it directly couples
PIE to that internal, so an OTel host passes its handle. The asymmetry is
deliberate: detection serves hosts whose agent installs itself on `window`, and
those are exactly the hosts that construct nothing.

Detection is also what makes an attribute-only host work. A provider instance
can only arrive as a JavaScript property, and `loader-config` is a JSON
attribute ([`PieItemPlayer.svelte`](../../packages/item-player/src/PieItemPlayer.svelte)),
so a host that configures players purely through markup cannot name a provider.
With detection it does not need to, and a string-keyed provider registry
addressable from the attribute stays unbuilt.

## Emission gate

Enabling detection must not cause a host that has not asked for telemetry to
start populating its observability account.

The constraint is the release model. Every release is a `patch` under the
fixed-version policy, and Host A and Host R both track the `0.3.x` line through
caret ranges, so a published behavior change reaches them on their next install
with no code change on their side; Host V pins an exact patch and upgrades
deliberately. A default that detected an agent and began sending would put
unbudgeted event volume into a client's account through a patch bump.

## Host A's telemetry topology

Verified against that host's checkout on 2026-09-18 by a scan over 119 source,
template and manifest files. It consumes nothing from this module and builds its
own New Relic service instead, reconstructing by hand the numbers PIE is in a
position to report directly: it subscribes to PIE's `content-loaded` events,
separates the passage completion from the item completion so one section cannot
count twice, measures against a `performance` mark its own launch emits, and
publishes page actions under its own attribute prefix. One derived duration also
goes to its own backend for durable storage.
[`consumer-api-dependencies.md`](../integrations/consumer-api-dependencies.md)
owns that host's dependency rows; this section records only what bears on the
design, and its scan predates the pad's own next refresh.

Three consequences.

**PIE's load-path events are a second measurement of a quantity that host
already derives.** Its numbers are taken from outside the boundary and include
its own bootstrap; PIE's would be taken from inside. Both are legitimate and they
will not agree. PIE's events are named and documented as what PIE observed, which
is what keeps the two from reading as one metric that disagrees with itself.

**A sink is not always an observability backend.** That host routes one derived
number to durable storage, because a load time that feeds reporting cannot live
only in a telemetry account. The contract has no notion of a durable sink, and an
adapter that posts to a host endpoint satisfies it. Host-implemented, like every
adapter but one.

**Its service latches the handle exactly the way PIE's adapter does.** It
captures the global once during configuration and every method no-ops while that
field is falsy. Its own page loads no agent, so the agent arrives from an outer
page neither repository controls. The same page therefore gives the same defect
two independent chances to silence telemetry. PIE fixes its own half by probing.

Under this design that host opts in by setting `trackPageActions: true` and
constructing nothing. Detection finds the agent, and PIE's events inherit the
global custom attributes its service has already set, because New Relic applies
custom attributes to every subsequent page action. The correlation comes for
free, and the two attribute prefixes coexist without collision.

## One default factory

Two independent implicit defaults exist:
[`instrumentation-provider-resolution.ts`](../../packages/players-shared/src/pie/instrumentation-provider-resolution.ts)
memoizes a module-level New Relic instance, and
[`resource-monitor.ts`](../../packages/players-shared/src/pie/resource-monitor.ts)
constructs a fresh one per monitor and manages its lifecycle. Both collapse
behind one internal factory. Resolution is the seam: every player element already
routes through `resolveInstrumentationProvider`, and the resource monitor's own
default is redundant with it.

## Attribute naming

The contract's attribute bags are flat and New Relic-shaped. Naming is applied
centrally, in the base class, and settled before a real backend holds PIE's
keys, which [consumer position](#consumer-position) ties to one host's rollout.
After that, renaming means breaking dashboards that exist.

| Contract | New Relic | DataDog RUM | OpenTelemetry |
| --- | --- | --- | --- |
| `trackError(error, attrs)` | `noticeError(error, attrs)` | `addError(error, context)` | Log record, `ERROR` severity, `exception.*` attributes |
| `trackEvent(name, attrs)` | `addPageAction(name, attrs)` | `addAction(name, context)` | Log record carrying the event name |
| `trackMetric(name, value)` | Event, `metric:` prefix | Event, `metric:` prefix | Event, `metric:` prefix |
| `setUserContext(id, attrs)` | `setUserId` + `setCustomAttribute` | `setUser` | Resource or log attributes |
| `setGlobalAttributes(attrs)` | `setCustomAttribute` per key | `setGlobalContextProperty` per key | Resource attributes |

The base class owns the `pie.*` prefix; per-backend reshaping stays in the
adapter. DataDog RUM nests custom attributes under a `context` namespace and
sanitizes them for cardinality, so flat NRQL-shaped keys arrive one level down.
OTel expects dotted semconv-style keys, and `exception.type` /
`exception.message` / `exception.stacktrace` for errors. A stable prefix applied
in one place gives all three consistent facets.

In OTel terms this surface is logs: discrete errors and events with attribute
bags, no spans and no durations as first-class. Browser logs is the least settled
part of the OTel JS stack, which the design inherits once rather than per vendor.

## Metric semantics

`trackMetric` stays event-shaped, which is what the base class already does — a
`metric:`-prefixed event name with `metricValue` and `metricName` in the bag —
and no adapter overrides it. Two of the three candidate backends cannot express a
metric: the New Relic browser agent at 1.274 exposes `noticeError`,
`addPageAction`, `setCustomAttribute`, `setUserId`, `interaction` and
`addToTrace` with no metric primitive, and DataDog RUM's `addAction` is the same
shape. Only OTel has counters and histograms. The method has no production
consumer; the debug panel is the only thing that reads it.

## Trade-offs

**An OTel example in place of per-vendor examples.** Grafana Faro, Splunk RUM and
Elastic APM RUM are OTel underneath, and Honeycomb and Grafana Cloud take OTLP
directly, so one example reaches all of them. The trade: OTLP-shaped data is less
idiomatic in each vendor's UI than that vendor's own SDK would produce.

**Detection instead of required configuration.** A host gets its existing agent
wired up with one boolean, at the cost of behavior that depends on page state PIE
does not control. Bounded by the emission gate: detection changes which sink
receives data and cannot change whether data is sent.

**No vendor dependency.** Nothing to maintain, version or ship, at the cost of
duck-typing the handle — an agent that renames a method degrades to a silent
no-op rather than a type error. The same trade the toolkit's host-supplied TTS
`customProviders` already makes.

**Product analytics stays out.** Amplitude, Segment and GA4 are reachable through
the same contract and are excluded: this is an operational telemetry surface, and
routing learner behavior through it would blur the per-layer event ownership that
[`architecture.md`](./architecture.md#ownership-model-no-semantic-overlap)
defines.

## Buffering

`guardedOperation` in [`BaseInstrumentationProvider`](../../packages/players-shared/src/instrumentation/providers/BaseInstrumentationProvider.ts)
discards silently. The earliest events are the ESM and IIFE adapter load failures
and the resource monitor's retries — the most diagnostic ones, and the ones most
likely to fire before a deferred agent is up. A bounded ring buffer in the base
class, flushed on the first successful readiness probe, turns silent loss into a
delayed send. Sampling applies at enqueue so the buffer cannot distort the rate.

Backdating is the flush's one subtlety. `newrelic.addPageAction` and
`DD_RUM.addAction` both stamp at call time, so flushed records land at the flush
instant. `trackEvent` already writes an ISO `timestamp` into the attribute bag
before delegating, so event time survives in the attributes and queries read it
there. OTel accepts an explicit record timestamp and needs no workaround.

## Open questions

- The shape of the OTel handle a host passes: a `Logger`, or a minimal
  `emit(record)` function PIE declares itself. Writing the fixture settles it,
  and the conformance suite pins whichever wins.
- The ring buffer bound, and whether errors and events get separate bounds so a
  flood of resource retries cannot evict a load failure.
