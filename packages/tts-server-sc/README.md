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
