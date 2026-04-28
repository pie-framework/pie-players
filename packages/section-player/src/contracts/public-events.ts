/**
 * Section-player layout-CE public DOM event vocabulary.
 *
 * **Engine routing (M7).** The *stage / loading-complete /
 * framework-error* family is dispatched on the layout CE host by the
 * section runtime engine
 * (`@pie-players/pie-assessment-toolkit/runtime/engine`) — not by an
 * in-CE `$effect` cluster. The kernel attaches the engine to the host
 * (`engine.attachHost({ host, sourceCe, frameworkErrorBus })`), and
 * the engine's DOM-event bridge dispatches `pie-stage-change`,
 * `pie-loading-complete`, and `framework-error`.
 * `section-controller-ready` is dispatched separately by the kernel's
 * Svelte `createEventDispatcher` (forwarded by each layout CE
 * wrapper).
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
 * **Removed in the broad architecture review compat sweep.** The
 * deprecated readiness aliases (`readiness-change`,
 * `interaction-ready`, `ready`) and their `legacy-event-bridge.ts`
 * are gone. Hosts that previously listened for them migrate to:
 *   - `readiness-change` → `pie-stage-change` (the readiness phase
 *     is also reachable via `selectReadiness()` /
 *     `getSnapshot().readiness`).
 *   - `interaction-ready` → `pie-stage-change` filtered on
 *     `detail.stage === "interactive"`.
 *   - `ready` → `pie-loading-complete`.
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
	 * `SectionEngineOutput` of kind `stage-change`. See
	 * `packages/players-shared/src/pie/stages.ts`.
	 */
	stageChange: "pie-stage-change",
	/**
	 * Engine-routed (M7). Companion to `stageChange`. Fires once per
	 * cohort when every item in the section has finished loading
	 * (`loadedCount === itemCount`), gated by the engine's
	 * `interactive` state.
	 */
	loadingComplete: "pie-loading-complete",
	/**
	 * @deprecated since M6 — new host code should listen for
	 * `stageChange` and filter on `detail.stage === "engine-ready"`,
	 * or use
	 * `IToolkitCoordinator.waitForSectionController(sectionId, attemptId)`
	 * to await a controller handle directly. Still emitted on the
	 * layout CE host by the kernel's Svelte `createEventDispatcher`
	 * (forwarded by each layout CE wrapper).
	 */
	sectionControllerReady: "section-controller-ready",
} as const;

export type SectionPlayerPublicEventName =
	(typeof SECTION_PLAYER_PUBLIC_EVENTS)[keyof typeof SECTION_PLAYER_PUBLIC_EVENTS];

/**
 * Readiness phase reported by the engine's readiness derivation. The
 * type is named after the deprecated `readiness-change` event for
 * backward compatibility with consumers that imported it via the
 * kernel's `selectReadiness()` selector — the *event name* is gone,
 * but the readiness payload itself is still the canonical shape.
 */
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
