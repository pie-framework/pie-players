# @pie-players/pie-section-player-tools-tts-settings

`<pie-section-player-tools-tts-settings>` is a development panel for choosing and
previewing a text-to-speech (TTS) provider and voice, then applying the result to
the toolkit's `textToSpeech` tool config. It is a debugging tool for
section-player integrations, outside learner-facing delivery; `apps/section-demos`
mounts it in its debug overlays. It renders as a modal dialog without a shadow
root, with Browser, Polly and Google tabs plus any custom provider tabs.

## Usage

Importing the package registers the custom element:

```ts
import "@pie-players/pie-section-player-tools-tts-settings";
```

```svelte
<pie-section-player-tools-tts-settings
  toolkitCoordinator={toolkitCoordinator}
  onclose={() => (showTtsPanel = false)}
/>
```

## Routes and coordinator

The panel calls these routes under `apiEndpoint`, which the section demos'
[API routes](../../apps/section-demos/src/routes/api/README.md) implement:

- `GET {base}/polly/voices`
- `GET {base}/google/voices`
- `POST {base}/synthesize`

and applies settings through the toolkit coordinator:

- `getToolConfig("textToSpeech")`
- `updateToolConfig("textToSpeech", ...)`
- `ensureTTSReady()`, whose failure the panel reports instead of closing

## Custom element API

### Attributes and properties

- `toolkitCoordinator` (property): assessment toolkit coordinator instance
- `apiEndpoint` (`api-endpoint`, default `/api/tts`): base endpoint for voice/synthesis routes
- `storageKey` (`storage-key`, default `pie:section-player-tools:tts-settings`): `localStorage` key under which the panel keeps the settings it last applied
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
