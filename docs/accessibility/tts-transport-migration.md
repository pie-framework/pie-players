# TTS Transport Migration (Pre-1.0)

This note summarizes the TTS configuration changes introduced for multi-provider transport adapters.

## What Changed

- Server-backed TTS now supports explicit transport translation modes.
- Custom URL-based backend contracts are handled by adapter translation, while preserving browser/Polly/Google.
- Endpoint validation and endpoint path behavior are now configurable.

## Old vs New Config Keys

| Previous Key | New/Preferred Key | Notes |
| --- | --- | --- |
| `backend` | `backend` | Still used (`browser`, `polly`, `google`, `server`) |
| `provider` | `provider` / `serverProvider` | `custom` can be used for non-standard server contracts |
| `apiEndpoint` | `apiEndpoint` | Still required for server-backed modes |
| _none_ | `transportMode` | `pie` (default) or `custom` |
| _none_ | `endpointMode` | `synthesizePath` (default PIE) or `rootPost` |
| _none_ | `endpointValidationMode` | `voices`, `endpoint`, or `none` |
| _none_ | `includeAuthOnAssetFetch` | Forward bearer auth to URL-based assets |

## Backend Matrix

- `browser`: local Web Speech API (no server endpoint required)
- `polly`: server-backed PIE transport (`/synthesize`, inline marks)
- `google`: server-backed PIE transport (`/synthesize`, inline marks)
- `server` + `custom`: server-backed mode using root POST + `audioContent`/`word` URLs

## Custom Transport Example

```ts
toolkitCoordinator.updateToolConfig("tts", {
	enabled: true,
	backend: "server",
	serverProvider: "custom",
	apiEndpoint: "https://tts.custom.example/v1",
	transportMode: "custom",
	endpointMode: "rootPost",
	endpointValidationMode: "none",
	includeAuthOnAssetFetch: true,
	language: "en-US",
	rate: 1.0,
	providerOptions: {
		cache: true,
	},
});
```

## Breaking Change Checklist For Client Projects

- Confirm server-backed config now sets the correct `transportMode`.
- Confirm endpoint mode matches backend contract (`rootPost` for custom transport APIs).
- If your backend returns URL-based assets, decide whether to enable `includeAuthOnAssetFetch`.
- Re-run TTS flows for:
  - play/pause/resume/stop
  - word highlighting alignment
  - language/rate controls
  - rapid replay/seek-style restart behavior
