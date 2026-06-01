---
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-assessment-toolkit": patch
---

TTS: generate spoken math as SSML for SSML-capable providers (PIE-623)

The generated (no authored `accessibilityCatalogs`) math speech path can now
emit Speech Rule Engine SSML to providers that voice it, while keeping the same
confidence-gated highlighting and plain-text behavior everywhere else.

- `@pie-players/pie-tts`: `TTSProviderCapabilities` gains an optional
  `supportsSSML` flag. It is optional and defaults to `false`, so existing
  provider implementations are unaffected.
- `@pie-players/tts-client-server`: `ServerTTSProvider.getCapabilities()` now
  reports `supportsSSML`. It is conservative — `true` only for the SSML-reliable
  `pie` transport backends (Polly, Google) and `false` for the `custom`
  transport and unknown providers.
- `@pie-players/pie-assessment-toolkit`: the speech composition core assembles a
  DOM-free plan and, for SSML-capable providers, sends SRE SSML for math
  segments with a plain-text speak-time fallback if a provider rejects it. The
  browser Web Speech provider always receives plain text.
- `@pie-players/pie-assessment-toolkit`: fixed word/token-level highlighting for
  generated math SSML. Provider word boundaries on a generated math chunk (raw
  SSML in `speechText`, no catalog span alignment) are now mapped from
  raw-SSML offsets back into spoken-text space, so per-token tracking works the
  same as the authored-SSML path instead of falling back to whole-formula
  block highlighting.
- `@pie-players/pie-assessment-toolkit`: strip the leading `<?xml …?>` prolog
  from Speech Rule Engine SSML so SSML-capable providers (AWS Polly, Google),
  which require the payload to begin with `<speak>`, accept the generated math
  SSML.
