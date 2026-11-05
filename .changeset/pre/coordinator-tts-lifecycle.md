---
"@pie-players/pie-assessment-toolkit": patch
---

The toolkit coordinator no longer carries the text-to-speech lifecycle. Its
initialization, readiness, reconfiguration, degradation tracking and
missing-provider report move to `services/tts/tts-lifecycle.ts` — the toolkit's
TTS-specific area, where the capability may be named — and the coordinator now
answers only generic questions about it (`ownsTool`, `isStarted`) through a
`TtsLifecycleHost` adapter bound once at construction. The packaged default
provider configs move to `services/tool-provider-defaults.ts`, a
capability-naming module like `support-conflicts.ts`, so applying a default is
no longer a capability decision in the neutral layer. Hosts see no change:
every public method keeps its name and signature, and the read-aloud-typed
config accessors take their literal from `TTS_TOOL_ID`, so the id is named
where the capability lives.

With the coordinator clean, `check:capability-neutrality` now holds it to
capability-neutrality — the gate covered a named file list that the
coordinator, the toolkit's largest service, sat outside, so a capability
branch added there would have passed CI. It now validates 20 core files, and a
`toolId === "calculator"` branch in the coordinator fails it.
