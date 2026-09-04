# Section Demos API Routes

This directory contains SvelteKit API routes used by section demos for development/testing.

## Available Endpoints

### TTS API

**Routes**:

- `POST /api/tts/synthesize` - Synthesize speech from text
- `POST /api/tts/sc` - Proxy SchoolCity-style custom transport synthesis
- `GET /api/tts/voices` - Get available voices
- `GET /api/tts/polly/voices` - Get AWS Polly voices
- `GET /api/tts/google/voices` - Get Google Cloud TTS voices

`/api/tts/*` routes in section-demos implement the PIE transport contract. Custom URL-based
integrations are expected to run through backend translation using `transportMode: "custom"`
at the client provider boundary.

`POST /api/tts/sc` requires server env vars with no defaults:

- `TTS_SCHOOLCITY_URL`
- `TTS_SCHOOLCITY_API_KEY`
- `TTS_SCHOOLCITY_ISS`
- `TTS_SCHOOLCITY_ASSET_ORIGINS` (optional, comma-separated) — exact origins the
  provider is permitted to fetch synthesized audio / speech-mark assets from.
  When set, it replaces the default policy with a strict exact-origin allow-list
  (recommended for production; fully auditable). When unset, the provider
  permits `TTS_SCHOOLCITY_URL`'s origin plus any host on the same registrable
  domain (eTLD+1) — e.g. setting `TTS_SCHOOLCITY_URL=https://tts.svcdev.schoolcity.com`
  automatically permits `https://tts-cdn.svcdev.schoolcity.com`. Regardless of
  this setting, the provider always rejects private/metadata hostnames,
  non-http(s) schemes, and cross-origin redirects that escape the policy.

`/api/tts/sc` in section-demos is a host-owned demo/reference adapter route backed by
`@pie-players/tts-server-sc`. It demonstrates custom provider integration boundaries and
is intentionally not a toolkit built-in default option.

### Desmos Calculator Auth

**Route**: `GET /api/tools/desmos/auth`

Returns the demo application's Desmos API key for the browser's documented
`calculator.js` request. Responses are `private, no-store`. When
`DESMOS_API_KEY` is absent, the route returns an empty compatibility response so
existing local demos still exercise the legacy unkeyed Desmos URL; that fallback
does not grant or imply a Desmos license.

> **Demo only — intentionally unauthenticated.** This route returns the
> configured `DESMOS_API_KEY` with no session check. Do not deploy as-is; a real
> host must restrict delivery to authorized users and supply a Trial or
> Commercial Tier key licensed for that application. Runtime delivery keeps the
> key out of static bundles but cannot hide it from the browser, because Desmos
> requires it in the CDN URL. Do not proxy or self-host `calculator.js` unless a
> Desmos partner agreement grants that right. See
> [`docs/tools-and-accomodations/tool_host_contract.md#backend-endpoints-for-tool-providers`](../../../../../docs/tools-and-accomodations/tool_host_contract.md#backend-endpoints-for-tool-providers).

### Dictionary And Picture Dictionary

**Routes**:

- `POST /api/tools/dictionary` - Look up definitions for a keyword
- `POST /api/tools/picture-dictionary` - Look up pictures for a keyword
- `GET /api/tools/picture-dictionary/glyph/[slug]` - Serve one generated demo picture

A fixed word list and generated SVG glyphs, sized for the words in the demo passages.
PIE ships no dictionary endpoint — the corpus behind one is licensed per programme — so
these exist to give the packaged tools something to answer with locally, and are not a
reference implementation of a real corpus.

> **Demo only — intentionally unauthenticated.** The packaged tools call a host
> endpoint `same-origin`, so a real deployment puts its route behind the same session
> check as the assessment itself.

### Session Hydration Demo DB

**Routes**:

- `POST /api/session-demo/bootstrap` - Clear+seed (or clear-only) normalized session tables
- `GET /api/session-demo/state` - Return DB tables and reconstructed section snapshots
- `GET /api/session-demo/snapshot` - Return one section snapshot (`assessmentId`, `sectionId`, `attemptId`)
- `PUT /api/session-demo/snapshot` - Upsert one section snapshot
- `DELETE /api/session-demo/snapshot` - Delete one section snapshot

These endpoints back the `session-hydrate-db` demo and are intentionally lightweight for local use.

## Notes

- The translation demo API has been removed.
- All remaining endpoints support CORS via OPTIONS handler.
