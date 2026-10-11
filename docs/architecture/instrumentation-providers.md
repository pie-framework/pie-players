# Instrumentation Providers

Status: Active

Shipped: the `InstrumentationProvider` contract, `BaseInstrumentationProvider`,
the New Relic, console, debug-panel and composite adapters, probed readiness, the
one default factory, [provider resolution](#provider-resolution) and the
[operational events](#operational-events). Designed and not built: agent
detection, the conformance suite, central attribute naming and buffering; the
[implementation plan](./instrumentation-providers-implementation-plan.md)
sequences them. The DataDog and OpenTelemetry adapters described here are
examples of host-owned adapters, and PIE ships neither.
[`architecture.md`](./architecture.md#instrumentation) owns the
per-layer event ownership model.

Owner: PIE Players maintainers

Related:

- [Architecture: Instrumentation](./architecture.md#instrumentation)
- [Instrumentation providers implementation plan](./instrumentation-providers-implementation-plan.md)
- [ADR 0002: provider contracts are not parameterized by config](../adr/0002-provider-contracts-are-not-parameterized-by-config.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

This note is the design record for how PIE emits telemetry. It is for
contributors changing the instrumentation module; a host wiring a provider needs
only [Provider resolution](#provider-resolution) and
[Operational events](#operational-events).

PIE emits telemetry through `InstrumentationProvider` and owns no backend. The
host owns the agent, the credentials, the sampling policy and the bill. An
adapter binds to a handle the host has already booted; it never loads an SDK,
initializes one, or holds a dependency on one.

## Scope

PIE ships one vendor adapter, for New Relic, because two of the hosts embedding
PIE today have that agent on their pages; the console, debug-panel and composite
adapters are vendor-neutral. The contract and probed readiness ship with it.
Central attribute naming and detection restricted to that one agent are designed
here and not built.

DataDog and OpenTelemetry stay unshipped. The design exercises them through a
conformance suite in `packages/players-shared/tests` that runs the contract's
whole surface against the New Relic adapter and against DataDog RUM and OTel
fixtures, so "the contract is not New Relic-shaped" becomes a test result
instead of an assertion. Neither the suite nor the fixtures exist yet. The
fixtures belong in the test tree, enter no `exports` map, and are the version
the documentation points at. A published adapter is a standing commitment to a
vendor SDK's drift; the contract is the thing that needed proving, and a test
proves it without taking the commitment on.

The ownership boundary already assigns the adapter to whoever owns the agent, so
a DataDog adapter is host code by construction and the fixture is a worked
example of code a host writes.

## Ownership boundary

| Concern | Owner |
| --- | --- |
| Agent script, client token, endpoint, session sample rate | Host |
| Which agent is on the page | Host |
| Adapter from the contract to that agent's API | PIE for New Relic, host for everything else |
| Attribute naming, event names, event ownership per layer | PIE |
| Whether PIE sends anything | Host, via `trackPageActions` or by passing a provider |

No adapter imports a vendor package or `@opentelemetry/api`. Each declares the
minimal call shape it uses as a local structural type and duck-types the handle,
the way [`provider-guards.ts`](../../packages/players-shared/src/instrumentation/provider-guards.ts)
already duck-types host-supplied providers. That keeps optional peers out of the
published declarations, which [ADR 0002](../adr/0002-provider-contracts-are-not-parameterized-by-config.md)
requires, and leaves vendor SDK version drift on the side of the boundary that
already carries it.

## Consumer position

The [consumer API dependencies](../integrations/consumer-api-dependencies.md)
record owns each host's dependency rows and pins; this section records what bears
on the design. No external host imports any part of this module.
`CompositeInstrumentationProvider`, `NewRelicInstrumentationProvider` and
`DebugPanelInstrumentationProvider` have one consumer, Host R, recorded there under
Programmatic API. That host is internally controlled, so it is no constraint: a
break is fixed in the same change.

The implicit default that detection replaces, `trackPageActions: true` with no
provider named, has one consumer, Host P, which is client-facing. Its
`@pie-players` path renders through the preloaded `pie-item-player`, where the
implicit default sends New Relic a `pie-resource-load` page action per tracked
resource, retry and error page actions and a `noticeError` per failure from the
resource monitor, and a `noticeError` per item-player runtime error. It sends
whenever the agent is on the page at the moment it tracks, as described under
[Probed readiness](#probed-readiness). The agent there comes from an outer page,
so either order is possible, and PIE resource telemetry first reaches that host's
account through `pie-item-player`.

That puts what the default sends in a client's account, and three parts of this
design change it. Probed readiness, which has shipped, makes the default send
from the agent's arrival on, which adds volume on pages whose agent arrives after
the player starts; buffering adds what it tracked before it arrived. Central
attribute naming renames every key the account receives, which is free until
that host's `@pie-players` rollout goes live and breaks any query on those keys
after. Detection binds the adapter the default already constructs there, and
the one default factory moved the resource monitor onto that instance, so
neither changes what that host receives. The emission gate does not apply,
because that host asked for telemetry, and each change reaches it when it moves
its exact pin.

The existing export names stay. They are accurate and nothing in the design
argues for new ones, though no external consumer would block a rename.

## Probed readiness

`initialized` means the provider has been configured. `isReady()` evaluates the
live world on every call.

[`NewRelicInstrumentationProvider`](../../packages/players-shared/src/instrumentation/providers/NewRelicInstrumentationProvider.ts)
sets `initialized` in `initialize()` whether or not the agent is there. Both
`isReady()` and every send look the agent up through
[`new-relic-agent.ts`](../../packages/players-shared/src/instrumentation/new-relic-agent.ts),
the shape probe described under agent detection, which no package entry point
exports. A provider initialized before the agent boots therefore sends from the
agent's arrival on; what it tracked earlier is dropped until buffering lands. The
topology this serves, the agent injected by an outer page at a time neither side
predicts, is the topology of the host most likely to enable tracking. A latch in
`initialize()` is the alternative, and it leaves instrumentation dead for the life
of any page whose agent boots after the first player resolves.

## Agent detection

Detection answers which sink. `trackPageActions` answers whether anything is
sent, and stays the only switch that does.

A probe tests the callable shape, never a name's truthiness. `window.NREUM` is
the New Relic agent's primary global and `window.newrelic` an alias the loader
assigns onto the same object, and the standard install snippet creates `NREUM` as
a configuration container before any agent code runs.
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
fixed-version policy, so a published behavior change reaches a host on a caret
range on its next install with no code change on its side, while a host on an
exact pin takes it when it moves the pin; the
[consumer API dependencies](../integrations/consumer-api-dependencies.md) record
lists each host's range or pin. A default that detected an agent and began
sending would put unbudgeted event volume into a client's account through a patch
bump.

## Host-built telemetry

A host can build its own New Relic service beside PIE, deriving load timings from
PIE's public `content-loaded` events and its own launch marks and publishing them
under its own attribute prefix. Three consequences follow for this design.

**PIE's load-path events are a second measurement of a quantity such a host
already derives.** The host measures from outside the boundary, including its own
bootstrap; PIE measures from inside. Both are legitimate and they will not agree.
PIE's events are named and documented as what PIE observed, which keeps the two
from reading as one metric that disagrees with itself.

**A sink is not always an observability backend.** A load time that feeds
reporting cannot live only in a telemetry account, so a host may route it to
durable storage. The contract has no notion of a durable sink, and an adapter
that posts to a host endpoint satisfies it, host-implemented like every adapter
but one.

**Opting in takes one boolean.** Under this design such a host sets
`trackPageActions: true` and constructs nothing. Detection finds the agent, and
PIE's events inherit the global custom attributes the host's own service has set,
because New Relic applies custom attributes to every subsequent page action. The
correlation comes for free, and the two attribute prefixes coexist without
collision.

## One default factory

The implicit New Relic default has one source: the module-level instance
[`instrumentation-provider-resolution.ts`](../../packages/players-shared/src/pie/instrumentation-provider-resolution.ts)
memoizes. Resolution is the seam. Every player element routes through
`resolveInstrumentationProvider`, and
[`resource-monitor.ts`](../../packages/players-shared/src/pie/resource-monitor.ts)
takes the provider its player resolves and constructs none, so
`instrumentationProvider: null` and an invalid provider silence it as they
silence every other emitter. The monitor leaves a provider's lifecycle to
whoever passed it in, which is what makes sharing one instance safe.

## Provider resolution

`resolveInstrumentationProvider` reads `instrumentationProvider` and
`trackPageActions` from a player's `loaderConfig`: the section-layer elements
read `runtime.player.loaderConfig`, the item player its own `loaderConfig`, and
the toolkit the item-player configuration it is given.

| `instrumentationProvider` | Resolves to |
| --- | --- |
| Unset or `undefined` | The shared New Relic default when `trackPageActions` is `true`; otherwise none |
| `null` | None, whatever `trackPageActions` says |
| An object meeting the `InstrumentationProvider` contract | That object |
| Anything else | None, with a debug-mode warning; it does not fall back to the default |

`trackPageActions` defaults to `false`. A provider that resolves still sends
only while its own `isReady()` is true.

## Operational events

A resolved provider receives three streams.

**Toolkit telemetry.** `ToolkitCoordinator` emits these, and
`<pie-assessment-toolkit>` forwards each to `trackEvent` with
`instrumentationLayer: "toolkit"` and the assessment, section and attempt ids. A
name ending in `-error`, or a payload carrying `errorType`, also goes to
`trackError`. Tool events carry `toolId`.

| Events | Emitted by |
| --- | --- |
| `pie-toolkit-coordinator-ready`, `pie-toolkit-section-controller-ready`, `pie-toolkit-section-controller-disposed` | `ToolkitCoordinator` |
| `pie-toolkit-provider-registered`, `pie-toolkit-provider-ready` | `ToolkitCoordinator` |
| `pie-toolkit-tool-state-loaded`, `pie-toolkit-tool-config-updated` | `ToolkitCoordinator` |
| `pie-toolkit-tts-init-start\|success\|error`, `pie-tool-init-fallback` | `ToolkitCoordinator` |
| `pie-tool-init-start\|success\|error` | `ToolkitCoordinator` and `ToolProviderRegistry` |
| `pie-tool-backend-call-start\|success\|error` | `ToolProviderRegistry`, the Desmos provider, the server TTS provider |
| `pie-tool-library-load-start\|success\|error` | The TTS tool provider, the Desmos and GeoGebra providers, the lazy calculator provider |
| `pie-tool-operation-start\|success\|error` | The Cortex calculator, for `operation: "evaluate"` |
| `pie-tool-playback-start\|resume\|pause\|stop\|error\|state-changed` | `TTSService` |

**Bridged public events.** Each layer maps a fixed set of its public DOM events
onto `pie-toolkit-*`, `pie-section-*`, `pie-item-*` and `pie-assessment-*` names
([`instrumentation-event-map.ts`](../../packages/players-shared/src/pie/instrumentation-event-map.ts)).
The item map carries only `correct-responses-populated`, so the learner
responses in `session-changed` reach no provider by default. The item player
also sends a `trackError` per runtime error.

**Loader and resource events.** These also need `trackPageActions: true`: the
resource monitor's `pie-resource-load`, `pie-resource-retry` and
`pie-resource-load-error`; the IIFE loader's `pie-iife-bundle-retry`,
`pie-iife-bundle-retry-success` and `pie-iife-bundle-retry-timeout`; the ESM
loader's `pie-esm-shared-dependency-conflict`; and `pie-mathjax-version-conflict`
and `pie-mathjax-no-asset-root`. The monitor and both loaders also send a
`trackError` per failure.

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
`metric:`-prefixed event name with `metricValue` and `metricName` in the bag.
The console adapter overrides it to format the log line, and the composite
adapter fans it out to its providers. Two of the three candidate backends cannot
express a metric: the New Relic browser agent exposes `noticeError`,
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
[`architecture.md`](./architecture.md#instrumentation)
defines.

## Buffering

`guardedOperation` in [`BaseInstrumentationProvider`](../../packages/players-shared/src/instrumentation/providers/BaseInstrumentationProvider.ts)
discards silently. The earliest events are the ESM and IIFE adapter load failures
and the resource monitor's retries — the most diagnostic ones, and the ones most
likely to fire before a deferred agent is up. A bounded ring buffer in the base
class, flushed on the first successful readiness probe, turns silent loss into a
delayed send. Sampling applies at enqueue so the buffer cannot distort the rate.

A flush backdates through the attributes. `newrelic.addPageAction` and
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
