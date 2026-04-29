# @pie-players/tts-server-sc

SchoolCity-backed server-side TTS provider for PIE projects.

This package uses SchoolCity as an internal Renaissance-backed reference implementation
for custom server-side TTS integrations. The intent is to demonstrate a reusable
"custom backend adapter" pattern you can apply to your own TTS service.

## What it does

- Signs short-lived JWT credentials for SchoolCity TTS.
- Calls SchoolCity synthesis endpoint.
- Fetches and normalizes word marks.
- Rebases offsets so marks align to original request text.
- Exposes a provider API compatible with the `@pie-players/tts-server-*` pattern.

## Positioning

- `@pie-players/tts-server-sc` is a host/server integration package.
- It is not a toolkit default option by itself.
- Toolkit defaults remain browser-backed until a host app explicitly configures server/custom TTS.

## Install

```bash
bun add @pie-players/tts-server-sc
```

## Required configuration

- `baseUrl`: SchoolCity TTS endpoint
- `apiKey`: signing key used to mint bearer JWT
- `issuer`: JWT `iss` claim

## Asset fetch allow-list (SSRF defense)

The provider validates every upstream-returned asset URL (audio and speech
marks) before fetching. The allow-list has two modes:

### Default: same-registrable-domain as `baseUrl` (zero config)

If `assetOrigins` is not supplied, the provider permits:

- Exact match of `baseUrl`'s origin, and
- Any URL whose hostname shares the same registrable domain (eTLD+1) as
  `baseUrl`.

This matches the common "service at `x.vendor.tld`, CDN at `y.vendor.tld`"
deployment (e.g. `baseUrl = https://tts.svcdev.schoolcity.com` permits
`https://tts-cdn.svcdev.schoolcity.com` out of the box) without opening the
provider up to arbitrary external hosts. The registrable domain is computed
via the Public Suffix List (`tldts`), so it is correct for multi-label TLDs
(`.co.uk`, `.com.au`, etc.). If `baseUrl` is an IP literal or a hostname
without a recognised public suffix, the provider falls back to strict
single-origin behavior.

### Explicit (recommended for production): exact-origin allow-list

Passing a non-empty `assetOrigins` switches the allow-list to strict
exact-origin matching and disables the registrable-domain fallback:

```ts
await provider.initialize({
  baseUrl: process.env.TTS_SCHOOLCITY_URL!,
  apiKey: process.env.TTS_SCHOOLCITY_API_KEY!,
  issuer: process.env.TTS_SCHOOLCITY_ISS!,
  assetOrigins: [
    "https://tts.svcdev.schoolcity.com",
    "https://tts-cdn.svcdev.schoolcity.com",
  ],
});
```

This is recommended for production because it gives an auditable,
typo-resistant declaration of exactly which CDNs the provider is permitted
to reach, and it rejects a compromised sibling host on the same registrable
domain.

To force strict single-origin behavior without listing any extras, pass
`assetOrigins: [baseUrl]`.

### Private-network deployments (internal CDN / K8s / VPC / air-gapped)

The private-host guard is intentionally opt-out-able for deployments where
the TTS service and its assets legitimately live on a private network —
on-prem CDN, in-cluster Kubernetes service, VPC endpoint, air-gapped
install, etc. Disable the guard and supply an explicit `assetOrigins`
allow-list covering every internal host that may appear in responses:

```ts
await provider.initialize({
  baseUrl: "https://tts.internal.corp.local",
  apiKey: process.env.TTS_SCHOOLCITY_API_KEY!,
  issuer: process.env.TTS_SCHOOLCITY_ISS!,
  blockPrivateAssetHosts: false,
  assetOrigins: [
    "https://tts.internal.corp.local",
    "https://cdn.internal.corp.local",
  ],
});
```

Always pair `blockPrivateAssetHosts: false` with an explicit
`assetOrigins` list. Without one, a compromised or malicious upstream
response could redirect the provider to arbitrary internal hosts inside
your network boundary — which is exactly the SSRF class the guard
defends against.

Cloud-metadata / IMDS endpoints are always blocked (see below), even
when `blockPrivateAssetHosts` is `false`.

### Always-on hardening (not configurable)

- `http:` / `https:` schemes only.
- Cloud-metadata / IMDS endpoints are always rejected —
  `169.254.169.254`, `fd00:ec2::254`, `metadata.google.internal`,
  `metadata.azure.internal`, `metadata.packet.net`,
  `metadata.oci.oraclecloud.com`. There is no legitimate TTS-asset use
  case for these hosts and they return IAM credentials / provisioning
  secrets.
- SSRF-resistant hostname normalization: IPv4-mapped IPv6
  (`::ffff:…`), trailing-dot hostnames (`host.`), bare decimal / hex /
  octal IPv4 encodings are all rewritten before matching so they cannot
  be used to bypass the blocklists.
- Manual redirect handling with a bounded hop count; each redirect target
  is re-validated against the same policy.
- Authorization / cookie headers are scrubbed for cross-origin asset fetches.

Symptom if a URL falls outside the policy:
`SchoolCity asset URL origin is not allow-listed: <url>`,
`SchoolCity asset URL resolves to a private/internal host`, or
`SchoolCity asset URL resolves to a cloud metadata endpoint`. Address by
adding the origin to `assetOrigins`, toggling `blockPrivateAssetHosts`
for private-network deployments, or investigating why an upstream
response is pointing at a metadata endpoint (that is never legitimate).

## Basic usage

```ts
import { SchoolCityServerProvider } from "@pie-players/tts-server-sc";

const provider = new SchoolCityServerProvider();
await provider.initialize({
  baseUrl: process.env.TTS_SCHOOLCITY_URL!,
  apiKey: process.env.TTS_SCHOOLCITY_API_KEY!,
  issuer: process.env.TTS_SCHOOLCITY_ISS!,
  defaultLanguage: "en-US",
  defaultSpeedRate: "medium",
  defaultCache: true,
});

const result = await provider.synthesize({
  text: "Hello world",
  language: "en-US",
  includeSpeechMarks: true,
});
```

## Dogfood adapter example (section-demos shape)

If you need to keep legacy response shape (`audioContent`, `word`) while reusing provider logic:

```ts
const assets = await provider.synthesizeWithAssets({
  text,
  language: lang_id,
  providerOptions: { speedRate, cache },
});

return json({
  audioContent: assets.audioContent,
  word: assets.word,
  speechMarks: assets.speechMarks,
});
```

## Bring-your-own backend mapping

To adapt this package pattern to another custom provider, replace:

- **Auth signer**: `toBearerToken()` strategy (JWT/API key/OAuth as needed)
- **Upstream request shape**: request payload builder (`text`, language, speed/rate fields)
- **Asset contract**: response extraction (`audioContent`, marks URL, or inline marks)
- **Marks parser**: JSONL/JSON parsing and normalization rules
- **Offset normalization**: rebasing logic if upstream marks are not indexed to original text

Keep the provider surface (`initialize`, `synthesize`, `synthesizeWithAssets`) so host
routes can stay thin and consistent.

## Notes on SSML

- The provider accepts plain text and SSML fragments.
- If full `<speak>...</speak>` is provided, it is normalized to avoid nested `<speak>` wrappers when SC applies its own wrapping behavior.
- Mark rebasing is best-effort and intentionally deterministic to keep highlighting stable.
