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

## Default behavior

Without adapters, the panel uses the existing route contract:

- base endpoint: `/api/tts`
- voices routes:
  - `GET {base}/polly/voices`
  - `GET {base}/google/voices`
- synthesize route:
  - `POST {base}/synthesize`

and applies settings via toolkit coordinator:

- `getToolConfig("textToSpeech")`
- `updateToolConfig("textToSpeech", ...)`
- optional `ensureTTSReady(...)`

## Custom element API

### Attributes / props

- `toolkitCoordinator` (`Object`): assessment toolkit coordinator instance
- `apiEndpoint` (`String`, default `/api/tts`): base endpoint for voice/synthesis routes
- `storageKey` (`String`, default `pie:section-player-tools:tts-settings`): localStorage key
- `adapters` (`Object`, optional): override fetching/synthesis behavior
- `customProviders` (`Array`, optional): register additional provider tabs (JS adapters and/or custom elements)

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

## Adapter overrides

Use adapters when your host app cannot or should not expose the default route contract.

## Custom provider tabs

You can add provider tabs beyond Browser/Polly/Google through `customProviders`.

- Keep provider `id` unique and avoid reserved ids: `browser`, `polly`, `google`.
- The panel still owns persistence and `updateToolConfig("textToSpeech", ...)`.
- Provider apply returns normalized output: `{ config, message? }`.

### JS adapter mode

```ts
const customProviders = [
  {
    id: "acme-tts",
    label: "Acme TTS",
    mode: "adapter",
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
          backend: "acme-tts",
          transportMode: "custom",
          apiEndpoint,
          defaultVoice: state.voice,
          providerOptions: { quality: state.quality }
        },
        message: "Applied Acme TTS settings."
      };
    }
  }
];
```

### Custom element mode (CE bridge)

`mode: "component"` providers can emit normalized events that the panel consumes:

- `change` with `detail: { state: Record<string, unknown> }`
- `availability` with `detail: { available: boolean, message?: string, detail?: string }`
- `apply-request` with `detail: { config: Record<string, unknown>, message?: string }`
- `preview-request` (panel triggers provider `preview` hook if supplied)

Example descriptor:

```ts
const customProviders = [
  {
    id: "vendor-x",
    label: "Vendor X",
    mode: "component",
    tagName: "my-vendor-tts-provider-tab",
    componentProps: { tenant: "district-a" },
    async buildApplyConfig({ state, apiEndpoint }) {
      return {
        config: {
          backend: "vendor-x",
          transportMode: "custom",
          apiEndpoint,
          providerOptions: state
        }
      };
    }
  }
];
```

### Adapter shape

```ts
type TtsSettingsAdapters = {
  fetchPollyVoices?: (args: {
    endpoint: string;
    language: string;
    gender: string;
    engine: "standard" | "neural";
    url: URL;
  }) => Promise<Array<{ id?: string; name?: string; languageCode?: string; gender?: string }>>;
  fetchGoogleVoices?: (args: {
    endpoint: string;
    language: string;
    gender: string;
    voiceType: string;
    url: URL;
  }) => Promise<Array<{ id?: string; name?: string; languageCode?: string; gender?: string }>>;
  synthesizeProbe?: (args: {
    endpoint: string;
    provider: "polly" | "google";
    body: Record<string, unknown>;
  }) => Promise<{
    audio: string;
    contentType?: string;
    speechMarks?: Array<{ time: number; start: number; end: number }>;
  }>;
};
```

### Example with custom adapters

```svelte
<script lang="ts">
  import "@pie-players/pie-section-player-tools-tts-settings";

  const adapters = {
    async fetchPollyVoices({ endpoint, language, gender, engine }) {
      const response = await fetch(`${endpoint}/providers/polly/voices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, gender, engine })
      });
      const payload = await response.json();
      return Array.isArray(payload?.voices) ? payload.voices : [];
    },
    async fetchGoogleVoices({ endpoint, language, gender, voiceType }) {
      const response = await fetch(`${endpoint}/providers/google/voices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, gender, voiceType })
      });
      const payload = await response.json();
      return Array.isArray(payload?.voices) ? payload.voices : [];
    },
    async synthesizeProbe({ endpoint, provider, body }) {
      const response = await fetch(`${endpoint}/providers/${provider}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || `Preview failed (${response.status})`);
      }
      return response.json();
    }
  };
</script>

<pie-section-player-tools-tts-settings
  toolkitCoordinator={toolkitCoordinator}
  apiEndpoint="/tts-gateway"
  {adapters}
  onclose={() => (showTtsPanel = false)}
/>
```
