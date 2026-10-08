/**
 * Section-player layout-CE public DOM event vocabulary.
 *
 * **Engine routing (M7).** `pie-stage-change` and `pie-loading-complete`
 * are dispatched on the layout CE host by the section runtime engine
 * (`@pie-players/pie-assessment-toolkit/runtime/engine`), bubbling and
 * composed. The kernel attaches the engine to the host
 * (`engine.attachHost({ host, sourceCe })`); the engine is the only stage
 * emitter.
 *
 * **Toolkit events (not engine-routed).** `framework-error` and the
 * composition / session / runtime-tier family (`composition-changed`,
 * `session-changed`, `runtime-owned`, `runtime-inherited`) are dispatched
 * by `<pie-assessment-toolkit>` and bubble through the layout CE host to
 * `document`; no section-player component re-dispatches them, so each
 * listener receives each dispatch once. The kernel reads `framework-error`
 * on the way up to set the readiness error signal.
 * `tests/section-player-event-delivery.spec.ts` pins one delivery per error
 * on the layout host and on `document`.
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
	 * Dispatched once per error by `<pie-assessment-toolkit>`, bubbling and
	 * composed; it reaches the layout CE host and `document`.
	 */
	frameworkError: "framework-error",
	compositionChanged: "composition-changed",
	sessionChanged: "session-changed",
	/**
	 * Engine-routed (M7). One DOM event family carries every stage
	 * transition (`composed` → `engine-ready` → `interactive` →
	 * `disposed`) with the discriminator in `event.detail.stage`.
	 * Dispatched by the engine's `dom-event-bridge.ts` on each
	 * `SectionEngineOutput` of kind `stage-change`; `status` is `entered`,
	 * or `failed` / `skipped` when a framework error ends the chain. See
	 * `packages/players-shared/src/pie/stages.ts`.
	 */
	stageChange: "pie-stage-change",
	/**
	 * Engine-routed (M7). Companion to `stageChange`. Fires once per
	 * cohort, once the section controller is ready and the section's
	 * element pre-warm has resolved for the current items: the same
	 * condition that moves a layout element to `interactive`.
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
