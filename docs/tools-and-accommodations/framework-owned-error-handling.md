# Framework-Owned Error Handling

This reference is for host integrators. It sets out how the framework reports
errors from tools configuration and toolkit runtime: the error model, which errors
are recoverable, how they propagate through the section-player wrappers, and the
host extension points. `pie-players` owns baseline error handling, so hosts need
no `try/catch` around section-player or toolkit bootstrapping to avoid a blank UI.

By default the framework:

1. Logs deterministic console errors with a stable prefix:
   - `[pie-framework:<kind>:<source>]`
2. Renders a built-in fallback UI for fatal startup failures.
3. Emits a canonical `framework-error` event for optional host reactions.

---

## Error model

`@pie-players/pie-assessment-toolkit` exports the shared error model:

- `FrameworkErrorModel`
- `FrameworkErrorKind`
- `FrameworkErrorSeverity`
- `FrameworkErrorScope`: `cohort` or `runtime`, set by the report site. See
  [Readiness latching](#readiness-latching).
- `toFrameworkErrorModel`, which builds a model from explicit fields. `severity`
  defaults to `error`, `recoverable` to `false`, and `scope` to `runtime`.
- `frameworkErrorFromUnknown`, which converts an unknown error. The conversions
  of tools-config diagnostics and validation results are internal to the toolkit.

---

## Toolkit error boundary

`pie-assessment-toolkit` catches initialization and disposal failures and reports
them through the same framework model.

### Default behavior

- Log to `console.error(...)` with framework prefix.
- Publish a single `FrameworkErrorModel` to the coordinator's
  `FrameworkErrorBus`. The toolkit subscribes once and delivers each error
  as one `framework-error` DOM event and one `onFrameworkError` call; an
  error the coordinator already published is not published again when it
  rethrows into the toolkit.
- Render built-in fallback UI when the error is a fatal bootstrap kind
  (`coordinator-init`, `runtime-init`, `tool-config`) and is not flagged
  recoverable. Non-bootstrap kinds (e.g. `provider-init`, `provider-register`,
  `tts-init`) still fire the canonical event/prop but keep the default
  slot active.

### Coordinator construction failures

When the toolkit constructs its own coordinator, failures surface as:

- `kind: "coordinator-init"`
- `source: "pie-assessment-toolkit"`

That includes strict tool-config validation failures thrown while constructing the
coordinator. The console details still include tool-config diagnostics (for
example, `[tool-config-validation:ToolkitCoordinator.init] ...`), but host logic
should not assume startup tool validation always emits `kind: "tool-config"`.

### Recoverable errors

A recoverable error (`recoverable === true`) is logged and emitted through
`framework-error`, but it neither renders the fatal fallback panel nor moves
section readiness to `error`, and the default slot stays active. No host action is
required; a host that wants to surface one listens to `framework-error`.

| Kind | Raised when | Recoverable | Effect |
| --- | --- | --- | --- |
| `tool-surface` | a tool surface host, the toolkit's mount for a capability's host surface, fails (`severity: "warning"`) | yes | the capability is omitted or keeps its last working element; the assessment and other capabilities continue |
| `tool-module-load` | a toolbar cannot load a tool's module; reported once per tool | unless policy grants the tool; reported again as fatal when a later policy change grants it | the tool is withheld |
| `provider-register` | a tool's provider fails to register | as `tool-module-load` | a console warning |
| `tool-state-load`, `tool-state-save` | the coordinator's tool-state load or save fails | yes | the coordinator carries on without the state |
| `section-controller-dispose` | a section controller fails to dispose | yes | the next section gets a fresh controller |
| `runtime-dispose` | the toolkit's section binding or owned coordinator fails to dispose | yes | none |
| `i18n-locale-load` | an interface-locale catalog fails to load | yes | every string resolves through the English fallback |

`tool-module-load` and `provider-register` follow the tool start-failure policy.
A toolbar tool counts a grant only where enforcement of the learner's Personal
Needs Profile (PNP) is on, so
`pnpEnforcement: "off"` keeps its failures recoverable; a region feature's grant
counts whatever the enforcement, as its decisions do.

A tool that fails after it started reports through the coordinator's
`reportToolFailure(toolId, phase, error)`, once per tool and phase, and is
recoverable whatever the policy, because each report site keeps a recovery:

| Kind | Phase | Recovery |
| --- | --- | --- |
| `tool-request` | a toolbar threw opening a requested tool, or answering whether it hosts one | the request goes unclaimed, or passes that toolbar by |
| `tool-registration` | a registration's relevance check or applicability gate threw | the tool is withheld unless a grant protects it; a throwing gate counts as applicable |
| `tool-state-load`, `tool-state-save` | a tool could not restore or keep its own learner state, as the annotation toolbar's highlights | the tool carries on without it |
| `tool-playback` | speech failed after it started: playback, seeking, or a rate change | the tool stays available; a start failure is `tts-init` |

The coordinator delivers these on a microtask, since the checks run inside a
toolbar's derived state.

### Optional host extension points

- `onFrameworkError?: (errorModel: FrameworkErrorModel) => void` — canonical
  toolkit property. Mirrors the `framework-error` DOM event payload exactly, fires
  exactly once per error.
- `errorRenderer?: (errorModel) => { title?: string; details?: string[] }`

On the `<pie-section-player-…>` layout custom elements the callback is
`runtime.onFrameworkError`. It flows
down through `effectiveRuntime → pie-section-player-base →
pie-assessment-toolkit`, which is the single delivery point — there is
no double-firing across wrapper layers.

A host that observes framework errors without the DOM subscribes to the
coordinator's error bus with the public
`ToolkitCoordinator.subscribeFrameworkErrors(listener)`.

---

## Validation ownership

The runtime resolver (`resolveToolsConfig`) copies `runtime.tools` in its
host-provided shape and throws on nothing. Strict validation runs when the toolkit
builds its coordinator, which reports an invalid tool id there.

---

## Propagation across wrappers

The toolkit's `framework-error` is the only DOM emit. It bubbles and is composed, so it reaches the layout element and `document` once per error. The section-player kernel reads it on the way up to set readiness to `error` for a non-recoverable error, which ends the stage chain with the current stage `failed`.

### Readiness latching

A non-recoverable error latches readiness for the scope its report site set:

| Scope | Kinds | Clears |
| --- | --- | --- |
| `cohort` | `runtime-init` and `section-controller-init` (the section's controller could not start), `element-preload`, `timed-media` | when the learner moves to another section or attempt |
| `runtime` | every other kind, `coordinator-init`, `provider-init`, `provider-register`, `tts-init`, `tool-module-load` and `tool-config` among them | never: every later section runs on the same coordinator |

A kind that is recoverable at one report site and fatal at another, such as
`provider-init` for a tool policy does or does not grant, latches only when fatal.
A host that publishes its own `FrameworkErrorModel` through the coordinator sets
`scope` the same way; one built with `toFrameworkErrorModel` or
`frameworkErrorFromUnknown` defaults to `runtime`.

---

## Event contract

### Canonical event

- `framework-error` — payload is a `FrameworkErrorModel`. Emitted once per
  error by `<pie-assessment-toolkit>` with `bubbles: true, composed: true`,
  so inside a section player it reaches the layout custom element and
  `document`. The canonical `onFrameworkError` callback is delivered once
  per error, regardless of wrapper depth.

### Telemetry mapping

Section-player and toolkit instrumentation bridges emit:

- `pie-toolkit-framework-error`
- `pie-section-framework-error`

---

## Host integration guidance

For baseline safety:

- pass the runtime and tools config as usual
- set `toolConfigStrictness` (`error`, the default, `warn` or `off`)
- add no host-level `try/catch` for bootstrap failure UX

For optional host-specific behavior:

- listen to `framework-error`
- provide `onFrameworkError` and/or `errorRenderer` when needed
