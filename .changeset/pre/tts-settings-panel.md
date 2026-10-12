---
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-players-shared": patch
---

The TTS settings panel drops its `adapters` prop and component-mode provider tabs; custom providers implement the exported `CustomProviderDescriptor`, whose context no longer carries `toolkitCoordinator` and whose apply and preview results no longer carry `message` or `note`. Apply waits for `ensureTTSReady()` and keeps the panel open with the error when the backend fails to start. Stopping a preview, switching tabs or starting a toolkit read ends the preview and releases its audio. The Google voice-type and gender filters stay in panel storage, and an unlisted Google voice applies as unset. The panel's strings are localised under `debug.tts.*`.
