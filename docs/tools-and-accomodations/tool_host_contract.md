# Toolkit Tool Host Contract

This contract defines the minimum runtime guarantees between host components
(`pie-assessment-toolkit`, section players, shells) and toolkit-managed tools.

## Scope

- Applies to all toolkit-managed tools (`pie-tool-*`).
- Applies to shell-aware tools (item/passage/region-scoped tools).
- Does not change item player internals.

## Required Contexts

- A runtime tool consumes `assessmentToolkitRuntimeContext` when it reads
  something from it — a coordinator, the TTS service, the catalog resolver, the
  `ndsIcons` flag. Connecting is a pure read: no host-side registration, and
  nothing the toolkit counts. A tool that connects and discards the value buys a
  retry timer and nothing else, so a tool taking everything it needs through the
  params seam does not connect.
- Shell-aware tools must consume `assessmentToolkitShellContext`, and
  region-aware tools `assessmentToolkitRegionScopeContext`. Both carry scope a
  tool cannot obtain another way, so for those the requirement is unconditional.

Use contract helpers exported from `@pie-players/pie-assessment-toolkit`:

- `connectToolRuntimeContext(host, onValue)`
- `connectToolShellContext(host, onValue)`
- `connectToolRegionScopeContext(host, onValue)`

These helpers include provider-announcement handling and retry behavior so late
provider registration is tolerated.

## Event Semantics

Cross-boundary events (tool -> host, shell -> host, host -> tool) must be:

- `bubbles: true`
- `composed: true`

Use helpers:

- `createCrossBoundaryEvent(name, detail)`
- `dispatchCrossBoundaryEvent(target, name, detail)`

## Initialization Guarantees

Tools must tolerate delayed context arrival and context re-binding:

- tool can mount before provider exists
- tool reconnects when provider becomes available
- tool cleans up subscriptions on unmount

## Host / Overlay Root Contract

Tools must not infer runtime scope from `parentElement` chains. Host/root
elements should be explicit inputs or context-derived values.

Allowed root sources:

1. explicit prop passed from host
2. region scope context (`scopeElement`)
3. shell context (`scopeElement`) as fallback

## Item Metadata And Render Context

Hosts that need content-specific tool behavior should register
`toolContextResolvers`, not override packaged tool registrations. Section
player hosts usually supply them on `runtime.toolContextResolvers`; direct
toolkit consumers may pass the same map to `ToolkitCoordinator` or the
`<pie-assessment-toolkit>` JS property. A resolver runs only after the framework
has applied placement, provider config, host policy, and PNP/profile gates. It
may hide a surviving tool for the current scope or attach render params for the
tool to consume.

For calculators, the resolver params are:

```ts
{
  calculatorType: "basic" | "scientific";
  availableTypes: Array<"basic" | "scientific">;
}
```

The packaged calculator reads these values through
`toolbarContext.getToolRenderParams("calculator")` and applies them to the
toolbar button plus calculator element. Content metadata therefore stays in
host code, while PNP/profile restrictions remain framework-owned and higher
precedence.

## Backend Endpoints for Tool Providers

Tools that call an external service (calculators, server-backed TTS,
translation, dictionary, etc.) reach that service through **host-owned**
backend endpoints. The framework does not ship authentication,
rate-limiting, or secret management for these routes — it exposes typed
provider hooks plus an origin-based header-scrubbing policy and delegates
the rest to the host.

Any `/api/...` route referenced by a toolkit provider must be:

- authenticated by the host under the same session boundary as the
  assessment itself,
- rate-limited (keyed on student / attempt where the vendor bills per
  request),
- kept free of vendor credentials on the client side unless the vendor's
  own protections (origin-pinning, short-lived tokens) make that
  intentional.

### Auth surfaces the framework exposes

- **`authFetcher`** — optional provider runtime hook, typed as
  `() => Promise<Partial<TConfig>>`. Called during provider initialization
  in `ToolProviderRegistry`; the return value is merged into the provider
  config before `initialize()`. Calculator composition does not invent an
  endpoint; a host that chooses runtime delivery supplies this hook explicitly.
  See
  [`packages/default-tool-loaders/src/registrations/calculator.ts`](../../packages/default-tool-loaders/src/registrations/calculator.ts).
- **`authToken` + `apiEndpoint`** — `ServerTTSProvider` configuration. The
  token is sent as `Authorization: Bearer <token>` on synthesis requests.
  Host obtains the token (via its own identity provider or through
  `authFetcher`) and supplies it in config.
- **`assetOrigins`** — `ServerTTSProvider` allow-list of origins that may
  receive the `Authorization` header when the provider follows URLs
  returned by the TTS server (custom-transport audio and speech-mark
  URLs). Defaults to the origin of `apiEndpoint`; malformed or
  non-`http(s)` URLs are always rejected. This is the one piece of
  provider-backend security the framework enforces directly. See
  [`packages/tts-client-server/src/ServerTTSProvider.ts`](../../packages/tts-client-server/src/ServerTTSProvider.ts).

### Production-recommended patterns

- **Calculator (Desmos).** Loading from `desmos.com` requires an API key licensed
  for the application. Desmos's documented integration places that key in the
  browser's `calculator.js` URL, so `authFetcher` can keep it out of source and
  static bundles but cannot keep it secret from an authorized browser user. A
  host-provided endpoint must require the assessment session, return
  `Cache-Control: private, no-store`, and issue only the key assigned to that
  application. The framework has no script-proxy path: Desmos documents
  self-hosting as a partner option, so copying, caching, proxying, or self-hosting
  the vendor script requires rights in the application's Desmos agreement. The
  Trial Tier is limited to personal non-commercial use or a 90-day internal
  evaluation; production end-user and internal business use require the
  Commercial Tier unless a separate written agreement applies.
- **Calculator (GeoGebra).** The PIE adapter loads GeoGebra's official
  `deployggb.js` and shows the required attribution. GeoGebra permits its full
  application/web services for qualifying non-commercial use under its current
  terms; commercial deployment requires a separate agreement. A custom
  `provider.init.scriptUrl` is not permission to mirror or self-host GeoGebra —
  use it only when the deployment's agreement grants that right.
- **Calculator (Cortex).** The `calculator-cortex` provider bundles MathLive,
  Cortex Compute Engine, JSXGraph, fonts, and its evaluation worker. It requires
  no key, service endpoint, CDN, or runtime network request. The package notices
  record the exact open-source license choices. Learner expressions are parsed
  and evaluated in the worker and reach JSXGraph only as sampled numeric arrays;
  the integration does not compile or execute learner-authored JavaScript.
- **Server-backed TTS.** Follow the security section of
  [`packages/tts-server-polly/examples/INTEGRATION-GUIDE.md#security-considerations`](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md#security-considerations)
  — JWT or session-cookie check in a SvelteKit `handle` hook on
  `/api/tts/*`, rate-limit keyed on client identity, AWS / Google
  credentials via environment variables or IAM roles (never returned to
  the client). Explicitly set `assetOrigins` on the client provider to
  the set of CDN origins your TTS server legitimately returns asset URLs
  for; the default covers same-origin only. For a reference
  server-side allow-list the same shape is implemented for SchoolCity
  via `TTS_SCHOOLCITY_ASSET_ORIGINS` — see
  [`apps/section-demos/src/routes/api/README.md`](../../apps/section-demos/src/routes/api/README.md).
- **New or custom providers.** Anything that adds an `authFetcher` or
  `apiEndpoint` inherits this contract. If the provider follows URLs
  returned by its backend, it must replicate the same origin-based
  header-scrubbing that `ServerTTSProvider` does.

### What's at risk if this is missed

- Unauthenticated `/api/tools/desmos/auth` in production → an application API
  key delivered to callers who are not authorized to use the licensed
  application. Runtime delivery is access control and static-bundle hygiene, not
  a way to make the browser-loaded key secret.
- Unauthenticated `/api/tts/synthesize` → anyone on the internet can
  consume the host's Polly / Google credits; also a content-generation
  abuse surface (arbitrary text pushed through the TTS pipeline).
- `includeAuthOnAssetFetch: true` without a correct `assetOrigins` list
  → a compromised or misconfigured TTS server can return a cross-origin
  URL and exfiltrate the bearer token on the follow-up fetch.
- Server-only vendor credentials in client bundles or client-side config →
  permanent leak via the shipped JavaScript; again, rotation is the only
  remediation. This does not describe Desmos's application key, which its
  documented browser integration requires in the script URL.

### Demo endpoints are not production-grade

The routes in `apps/section-demos/src/routes/api/` are intentionally
unauthenticated and exist for local development and e2e specs. In
particular, `GET /api/tools/desmos/auth` returns the configured
`DESMOS_API_KEY` with no session check. When it is absent, the demo returns an
empty compatibility response and the adapter preserves the historical unkeyed
load. That behavior keeps existing local clients running; it does not grant or
imply a Desmos license. Do not copy this route verbatim into a production
deployment — use it only as a shape reference, require the host's auth
middleware, and use a key/tier licensed for the deployed application.

### Related documentation

- [`./tool_provider_system.md`](./tool_provider_system.md) — provider
  configuration model and where `authFetcher` / `apiEndpoint` come from
- [`../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md`](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md)
  — end-to-end TTS integration, including security considerations and a
  SvelteKit `hooks.server.ts` sketch
- [`../../packages/tts-client-server/README.md`](../../packages/tts-client-server/README.md)
  — `ServerTTSProvider` configuration, including `assetOrigins` and
  `includeAuthOnAssetFetch`
- [`../../packages/assessment-toolkit/src/services/tool-providers/DesmosToolProvider.ts`](../../packages/assessment-toolkit/src/services/tool-providers/DesmosToolProvider.ts)
  — Desmos provider config (`apiKey`) and browser-delivery boundary
