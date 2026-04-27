/**
 * Section-player layout-CE public DOM event vocabulary.
 *
 * **Engine routing (M7).** Post-M7-PR-7, the *stage / readiness /
 * framework-error* family is dispatched on the layout CE host by the
 * section runtime engine
 * (`@pie-players/pie-assessment-toolkit/runtime/engine`) — not by an
 * in-CE `$effect` cluster. The kernel attaches the engine to the host
 * (`engine.attachHost({ host, sourceCe, frameworkErrorBus })`), and
 * the engine's DOM-event bridge dispatches `pie-stage-change`,
 * `pie-loading-complete`, and `framework-error`;
 * `legacy-event-bridge.ts` emits the deprecated readiness companions
 * (`readiness-change`, `interaction-ready`, `ready`) for the migration
 * window. `section-controller-ready` is dispatched separately by the
 * kernel's Svelte `createEventDispatcher` (forwarded by each layout
 * CE wrapper); it is **not** emitted by `legacy-event-bridge.ts`. The
 * event payloads are unchanged from pre-M7; consumers do not need to
 * migrate.
 *
 * **Kernel-side Svelte forwards (not engine-routed).** The
 * composition / session / runtime-tier family
 * (`composition-changed`, `session-changed`, `runtime-owned`,
 * `runtime-inherited`) is forwarded by the kernel's Svelte
 * `createEventDispatcher` from `<pie-section-player-base>` events; it
 * does not flow through the engine. This split is intentional: the
 * engine owns lifecycle and error reporting, while composition /
 * session forwarding stays in section-player because the shape is
 * section-player-specific and the engine has no opinion on it.
 *
 * **Inner toolkit emission (M7 PR 6 transitional).**
 * `<pie-assessment-toolkit>` nested inside a layout CE intentionally
 * preserves a duplicate `framework-error` emit during the migration
 * window so consumers that listen on the inner toolkit (rather than
 * the outer layout CE) keep working. The collapse of that dual-emit
 * is tracked in `SectionPlayerLayoutKernel.svelte` and pinned by the
 * dual-emit contract test
 * (`tests/section-player-framework-error-dual-emit.test.ts`,
 * R3-#3 follow-up).
 *
 * Source of truth for the names: `players-shared/src/pie/stages.ts`
 * and the `SectionEngineOutput` discriminator in
 * `assessment-toolkit/src/runtime/core/engine-output.ts`.
 */
export const SECTION_PLAYER_PUBLIC_EVENTS = {
	runtimeOwned: "runtime-owned",
	runtimeInherited: "runtime-inherited",
	/**
	 * Engine-routed (M7). Dispatched by
	 * `framework-error-bridge.ts` on the layout CE host whenever the
	 * engine receives a `framework-error` input. See class doc on
	 * `FrameworkErrorBus` for the back-pressure / fan-out semantics.
	 */
	frameworkError: "framework-error",
	compositionChanged: "composition-changed",
	sessionChanged: "session-changed",
	/**
	 * Engine-routed (M7). One DOM event family carries every stage
	 * transition (`composed` → `engine-ready` → `interactive` →
	 * `disposed`) with the discriminator in `event.detail.stage`.
	 * Dispatched by the engine's `dom-event-bridge.ts` on each
	 * `SectionEngineOutput` of kind `stage-changed`. See
	 * `packages/players-shared/src/pie/stages.ts`.
	 */
	stageChange: "pie-stage-change",
	/**
	 * Engine-routed (M7). Companion to `stageChange`. Fires once per
	 * cohort when every item in the section has finished loading
	 * (`loadedCount === itemCount`), gated by the engine's
	 * `interactive` state. Replaces the legacy `ready` event;
	 * semantics are unchanged.
	 */
	loadingComplete: "pie-loading-complete",
	/**
	 * @deprecated since M6 — new host code should listen for
	 * `stageChange` and filter on `detail.stage === "engine-ready"`,
	 * or use
	 * `IToolkitCoordinator.waitForSectionController(sectionId, attemptId)`
	 * to await a controller handle directly. Still emitted on the
	 * layout CE host by the kernel's Svelte `createEventDispatcher`
	 * (forwarded by each layout CE wrapper); not emitted by
	 * `legacy-event-bridge.ts`.
	 */
	sectionControllerReady: "section-controller-ready",
	/**
	 * @deprecated since M6, engine-routed since M7 — listen for
	 * `stageChange`. The transitions previously surfaced by
	 * `readiness-change` map to the new stage events; the
	 * `readiness.mode = "strict"` knob still gates the `interactive`
	 * transition (now inside the engine's transition function).
	 * Legacy alias still emitted by `legacy-event-bridge.ts`.
	 */
	readinessChange: "readiness-change",
	/**
	 * @deprecated since M6, engine-routed since M7 — listen for
	 * `stageChange` and filter on `detail.stage === "interactive"`.
	 * Legacy alias still emitted by `legacy-event-bridge.ts`.
	 */
	interactionReady: "interaction-ready",
	/**
	 * @deprecated since M6, engine-routed since M7 — listen for
	 * `loadingComplete`. The legacy `ready` event semantics
	 * ("all items loaded") are unchanged but the canonical event
	 * name is `pie-loading-complete`. Legacy alias still emitted by
	 * `legacy-event-bridge.ts`.
	 */
	ready: "ready",
} as const;

export type SectionPlayerPublicEventName =
	(typeof SECTION_PLAYER_PUBLIC_EVENTS)[keyof typeof SECTION_PLAYER_PUBLIC_EVENTS];

export type SectionPlayerReadinessPhase =
	| "bootstrapping"
	| "interaction-ready"
	| "loading"
	| "ready"
	| "error";

export type SectionPlayerReadinessChangeDetail = {
	phase: SectionPlayerReadinessPhase;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	reason?: string;
};

export type SectionPlayerControllerReadyDetail = {
	sectionId: string;
	attemptId?: string;
	controller: unknown;
};
