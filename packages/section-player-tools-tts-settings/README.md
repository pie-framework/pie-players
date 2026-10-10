# @pie-players/pie-section-player-tools-tts-settings

Reusable TTS settings development panel for section-player consumers.

This package follows the same integration model as the other `section-player-tools-*` panels:

- side-effect import to register a custom element
- render the element tag where your app manages debug overlays

## Install and register

```ts
import "@pie-players/pie-section-player-tools-tts-settings";
```

## Render

```svelte
<pie-section-player-tools-tts-settings
  toolkitCoordinator={toolkitCoordinator}
  onclose={() => (showTtsPanel = false)}
/>
```

## Routes and coordinator

The panel calls these routes under `apiEndpoint`:

- `GET {base}/polly/voices`
- `GET {base}/google/voices`
- `POST {base}/synthesize`

and applies settings through the toolkit coordinator:

- `getToolConfig("textToSpeech")`
- `updateToolConfig("textToSpeech", ...)`
- `ensureTTSReady()`, whose failure the panel reports instead of closing

## Custom element API

### Attributes / props

- `toolkitCoordinator` (property): assessment toolkit coordinator instance
- `apiEndpoint` (`api-endpoint`, default `/api/tts`): base endpoint for voice/synthesis routes
- `storageKey` (`storage-key`, default `pie:section-player-tools:tts-settings`): localStorage key
- `customProviders` (property, optional): additional provider tabs

### Events

- `close`: emitted when the panel requests to close

Example:

```svelte
<pie-section-player-tools-tts-settings
  toolkitCoordinator={toolkitCoordinator}
  apiEndpoint="/internal/tts"
  storageKey="my-app:dev-panels:tts"
  onclose={handleClose}
/>
```

## Custom provider tabs

`customProviders` adds tabs beyond Browser/Polly/Google. The package exports the
entry contract as types: `CustomProviderDescriptor`, `CustomProviderContext`,
`CustomProviderPreviewResult`, `ProviderApplyResult`,
`ProviderAvailabilityResult`, `PreviewMode` and `PreviewSpeechMark`.

- Keep provider `id` unique and avoid reserved ids: `browser`, `polly`, `google`.
- The panel owns persistence and `updateToolConfig("textToSpeech", ...)`.
- `buildApplyConfig` returns `{ config }`, the `textToSpeech` tool config the tab
  applies. Provider options the host set and the tab does not own are kept.

```ts
import type { CustomProviderDescriptor } from "@pie-players/pie-section-player-tools-tts-settings";

const customProviders: CustomProviderDescriptor[] = [
  {
    id: "acme-tts",
    label: "Acme TTS",
    initialState: { voice: "acme-default", quality: "high" },
    async checkAvailability({ apiEndpoint }) {
      const response = await fetch(`${apiEndpoint}/acme/health`);
      return {
        available: response.ok,
        message: response.ok ? "Acme provider available." : "Acme provider unavailable."
      };
    },
    async buildApplyConfig({ state, apiEndpoint }) {
      return {
        config: {
          backend: "server",
          serverProvider: "custom",
          transportMode: "custom",
          apiEndpoint,
          defaultVoice: state.voice,
          providerOptions: { quality: state.quality }
        }
      };
    }
  }
];
```
