# PIE Assessment Player

`@pie-players/pie-assessment-player` provides assessment-level orchestration custom elements.

It coordinates section flow and assessment session state while delegating section rendering to `@pie-players/pie-section-player` and shared services to `@pie-players/pie-assessment-toolkit`.

Primary entrypoint:

- `@pie-players/pie-assessment-player`

## Debug logging

Assessment-player now exposes a `debug` option on `pie-assessment-player-default`.

- Enable verbose debug logs: `<pie-assessment-player-default debug="true">`
- Disable verbose debug logs: `<pie-assessment-player-default debug="false">` (or `debug="0"`)

The setting is forwarded to the rendered section-player instance and also applies
the global flag (`window.PIE_DEBUG`) for shared runtime logging behavior.

Component registration entrypoints:

- `@pie-players/pie-assessment-player/components/assessment-player-default-element`
- `@pie-players/pie-assessment-player/components/assessment-player-shell-element`

## Instrumentation and observability

Assessment-player instrumentation is provider-agnostic and built on the shared
`InstrumentationProvider` contract used across players.

Canonical provider injection paths:

- `sectionPlayerRuntime.player.loaderConfig.instrumentationProvider`
- `sectionPlayerPlayer.loaderConfig.instrumentationProvider` (fallback)

Provider semantics:

- With `trackPageActions: true`, missing/`undefined` provider values use the default New Relic provider path.
- `instrumentationProvider: null` explicitly disables instrumentation.
- Invalid provider objects are ignored (optional debug warning), also no-op.
- Existing `item-player` behavior remains the compatibility anchor.
- To keep production telemetry while debugging, use `CompositeInstrumentationProvider`
  with `NewRelicInstrumentationProvider` and `DebugPanelInstrumentationProvider`.
- Toolkit telemetry forwarding uses the same provider path, so tool/backend
  operational events appear in production providers and debug overlays.

Assessment-player owned canonical stream:

- `pie-assessment-controller-ready`
- `pie-assessment-navigation-requested`
- `pie-assessment-route-changed`
- `pie-assessment-session-applied`
- `pie-assessment-session-changed`
- `pie-assessment-progress-changed`
- `pie-assessment-submission-state-changed`
- `pie-assessment-error`

Ownership boundary: assessment-player owns assessment semantics only. Section
and toolkit semantics remain in their own streams to avoid overlap. Bridge
dedupe is a safety net, not the primary correctness mechanism.

Toolkit tool/backend operational stream (when toolkit is mounted):

- `pie-tool-init-start|success|error`
- `pie-tool-backend-call-start|success|error`
- `pie-tool-library-load-start|success|error`
