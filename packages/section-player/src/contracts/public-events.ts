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
 *
 * **Toolkit events (not engine-routed).** The composition / session /
 * runtime-tier family (`composition-changed`, `session-changed`,
 * `runtime-owned`, `runtime-inherited`) is dispatched by
 * `<pie-assessment-toolkit>` and bubbles through the layout CE host to
 * `document`; no section-player component re-dispatches it, so each
 * listener receives each dispatch once. It does not flow through the
 * engine: the engine owns lifecycle and error reporting, and has no
 * opinion on composition or session shape.
 *
 * **`framework-error` single-emit on the layout host.**
 * `<pie-assessment-toolkit>` nested inside a layout CE still
 * dispatches its own `framework-error` (with `bubbles: true,
 * composed: true`) so direct toolkit consumers keep working. The
 * kernel's `handleFrameworkError` listener intercepts that bubbled
 * emit at `<pie-section-player-base>` and calls
 * `event.stopPropagation()`, leaving the engine-bridge emit on the
 * layout host as the single canonical DOM surface for
 * section-player consumers. `tests/section-player-event-delivery.spec.ts`
 * pins one delivery per error on the layout host and none on
 * `document`.
 *
 * Lifecycle should be consumed through canonical events:
 *   - `readiness-change` → `pie-stage-change` (the readiness phase
 *     is also reachable via `selectReadiness()` /
 *     `getSnapshot().readiness`).
 *   - `interaction-ready` → `pie-stage-change` filtered on
 *     `detail.stage === "interactive"`.
 *   - `ready` → `pie-loading-complete`.
 *
 * Controller readiness is available through
 * `waitForSectionController(timeoutMs)` / `getSectionController()` on the
 * layout CE, or by filtering `pie-stage-change` for
 * `detail.stage === "engine-ready"`.
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
} as const;

export type SectionPlayerPublicEventName =
	(typeof SECTION_PLAYER_PUBLIC_EVENTS)[keyof typeof SECTION_PLAYER_PUBLIC_EVENTS];

/**
 * Readiness phase reported by the engine's readiness derivation. The
 * type preserves the readiness payload shape used by
 * `selectReadiness()`.
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
