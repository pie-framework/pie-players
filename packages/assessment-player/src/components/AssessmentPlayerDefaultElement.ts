import "@pie-players/pie-section-player/components/section-player-splitpane-element";
import "@pie-players/pie-section-player/components/section-player-vertical-element";
import {
	ASSESSMENT_INSTRUMENTATION_EVENT_MAP,
	attachInstrumentationEventBridge,
	resolveInstrumentationProvider,
} from "@pie-players/pie-players-shared/pie";
import {
	createPieI18n,
	DEFAULT_LOCALE,
} from "@pie-players/pie-players-shared/i18n";
import type { I18nServiceApi } from "@pie-players/pie-players-shared/i18n";
import type { Env } from "@pie-players/pie-players-shared/types";
import { AssessmentController } from "../controller/AssessmentController.js";
import type { AssessmentControllerHandle } from "../controller/AssessmentController.js";
import {
	ASSESSMENT_PLAYER_PUBLIC_EVENTS,
	type AssessmentNavigationRequestedDetail,
	type AssessmentProgressChangedDetail,
	type AssessmentRouteChangedDetail,
	type AssessmentSubmissionStateChangedDetail,
} from "../contracts/public-events.js";
import type {
	AssessmentPlayerProgressSnapshot,
	AssessmentPlayerRuntimeHostContract,
	AssessmentPlayerSnapshot,
} from "../contracts/runtime-host-contract.js";
import { resolveAssessmentSectionPlayerRuntime } from "./assessment-section-player-runtime.js";
import type {
	AssessmentDefinition,
	AssessmentPlayerHooks,
	AssessmentPlayerRuntimeConfig,
} from "../types.js";

interface SectionControllerHandle {
	getSession?: () => unknown;
	applySession?: (
		session: unknown,
		options?: { mode?: string },
	) => Promise<void>;
}

interface SectionPlayerHostElement extends HTMLElement {
	waitForSectionController?: (
		timeoutMs?: number,
	) => Promise<SectionControllerHandle | null>;
	getSectionController?: () => SectionControllerHandle | null;
}

interface TtsServiceHandle {
	stop?: () => void;
	requestControlHandoff?: () => void;
}

interface CoordinatorWithTtsService {
	ttsService?: TtsServiceHandle;
}

const DEFAULT_SECTION_TAG = "pie-section-player-splitpane";
const VERTICAL_SECTION_TAG = "pie-section-player-vertical";

function coerceBooleanLike(
	value: boolean | string | null | undefined,
	fallback = false,
): boolean {
	if (value == null) return fallback;
	if (typeof value === "boolean") return value;
	const n = value.trim().toLowerCase();
	return n === "" || n === "true" || n === "1" || n === "yes";
}

export class AssessmentPlayerDefaultElement
	extends HTMLElement
	implements AssessmentPlayerRuntimeHostContract
{
	static get observedAttributes() {
		return [
			"assessment-id",
			"attempt-id",
			"show-navigation",
			"section-player-layout",
			"player-type",
			"debug",
			"locale",
		];
	}

	assessmentId = "";
	attemptId = "";
	/**
	 * Interface locale for this player's own navigation chrome, as a BCP-47 tag.
	 * Empty means the graceful default, `en-US`. Also forwarded to the section
	 * element, which passes it on to the toolkit.
	 */
	locale = "";
	assessment: AssessmentDefinition | null = null;
	env: Env | null = null;
	coordinator: unknown = null;
	hooks: AssessmentPlayerHooks | null = null;
	showNavigation: boolean | string | null | undefined = true;
	sectionPlayerLayout: "splitpane" | "vertical" = "splitpane";
	playerType: "iife" | "esm" | "preloaded" = "iife";
	private _debug: boolean | string | null | undefined = undefined;

	private controller: AssessmentControllerHandle | null = null;
	private controllerReadyPromise: Promise<AssessmentControllerHandle | null> | null =
		null;
	private controllerReadyResolve:
		| ((value: AssessmentControllerHandle | null) => void)
		| null = null;
	/**
	 * This player's own provider rather than a context read. Its navigation sits
	 * beside the section host, not inside it, so there is no published toolkit
	 * context above it to resolve from. Constructed with the English catalog
	 * already resident, so `t` never returns a bare key.
	 */
	private readonly i18n: I18nServiceApi = createPieI18n();
	private unsubscribeI18n?: () => void;
	private sectionHost: HTMLElement | null = null;
	private sectionControllerRef: SectionControllerHandle | null = null;
	/**
	 * Rendered content, tracked so a re-render can replace it without clearing the
	 * announcer below. A live region only announces changes that happen while it is
	 * already in the document, so wiping and rebuilding it each render would make it
	 * silent exactly when it has something to say.
	 */
	private containerRef: HTMLElement | null = null;
	private announcer: HTMLElement | null = null;
	/**
	 * Set for the render a section change causes. `render()` discards the subtree
	 * that holds the focused control, so without this the browser drops focus to
	 * `<body>` and the learner's next Tab restarts at the top of the document.
	 */
	private restoreFocusOnRender = false;
	private unsubscribeController?: () => void;
	private detachInstrumentationBridge?: () => void;
	private _sectionPlayerRuntime: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"] =
		null;
	private readiness: AssessmentPlayerSnapshot["readiness"] = {
		phase: "bootstrapping",
	};

	constructor() {
		super();
		this.controllerReadyPromise = new Promise((resolve) => {
			this.controllerReadyResolve = resolve;
		});
	}

	attributeChangedCallback(
		name: string,
		_oldValue: string | null,
		value: string | null,
	) {
		if (name === "assessment-id") this.assessmentId = value || "";
		if (name === "attempt-id") this.attemptId = value || "";
		if (name === "show-navigation") this.showNavigation = value;
		if (name === "section-player-layout") {
			this.sectionPlayerLayout =
				value === "vertical" ? "vertical" : "splitpane";
		}
		if (name === "player-type") {
			this.playerType = (value as typeof this.playerType) || "iife";
		}
		if (name === "debug") {
			this.debug = value;
		}
		if (name === "locale") {
			this.locale = value || "";
			this.applyLocale();
		}
		if (this.isConnected) {
			void this.bootstrapController();
		}
	}

	/**
	 * Catalog loading is async, so the first paint carries whatever the provider
	 * already holds and the subscription repaints once the requested locale
	 * lands. That is also the change signal a later switch travels on.
	 */
	private applyLocale(): void {
		if (!this.unsubscribeI18n) {
			this.unsubscribeI18n = this.i18n.subscribe?.(() => {
				if (this.isConnected) this.render();
			});
		}
		void this.i18n.setLocale(this.locale || DEFAULT_LOCALE);
		this.forwardLocaleToSection();
	}

	/**
	 * The section element resolves `""` as a locale rather than falling back, so
	 * an unset locale removes the attribute instead of writing an empty one.
	 */
	private forwardLocaleToSection(): void {
		const sectionEl = this.sectionHost?.firstElementChild;
		if (!sectionEl) return;
		if (this.locale) sectionEl.setAttribute("locale", this.locale);
		else sectionEl.removeAttribute("locale");
	}

	get debug(): boolean | string | null | undefined {
		return this._debug;
	}

	set debug(value: boolean | string | null | undefined) {
		this._debug = value;
		this.applyDebugFlag();
	}

	get sectionPlayerRuntime(): AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"] {
		return this._sectionPlayerRuntime;
	}

	set sectionPlayerRuntime(value: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"]) {
		this._sectionPlayerRuntime = value;
		if (this.isConnected) {
			this.attachInstrumentationBridge();
			this.updateCurrentSectionRuntime();
		}
	}

	connectedCallback() {
		if (!this.assessmentId) {
			this.assessmentId = this.getAttribute("assessment-id") || "";
		}
		if (!this.attemptId) {
			this.attemptId = this.getAttribute("attempt-id") || "";
		}
		this.showNavigation =
			this.getAttribute("show-navigation") ?? this.showNavigation;
		const layout = this.getAttribute("section-player-layout");
		this.sectionPlayerLayout =
			layout === "vertical" ? "vertical" : this.sectionPlayerLayout;
		const playerType = this.getAttribute("player-type");
		if (playerType) this.playerType = playerType as typeof this.playerType;
		this.debug = this.getAttribute("debug") ?? this.debug;
		if (!this.locale) this.locale = this.getAttribute("locale") || "";
		this.applyLocale();
		this.attachInstrumentationBridge();
		void this.bootstrapController();
	}

	disconnectedCallback() {
		this.unsubscribeI18n?.();
		this.unsubscribeI18n = undefined;
		this.unsubscribeController?.();
		this.detachInstrumentationBridge?.();
		this.detachInstrumentationBridge = undefined;
		this.hooks?.onAssessmentControllerDispose?.(this.controller || undefined);
	}

	private dispatch(
		name: string,
		detail?: unknown,
		cancelable = false,
	): boolean {
		return this.dispatchEvent(
			new CustomEvent(name, {
				detail,
				bubbles: true,
				composed: true,
				cancelable,
			}),
		);
	}

	private async bootstrapController() {
		if (!this.assessmentId || !this.assessment) {
			this.renderEmptyState("assessment-id and assessment are required");
			return;
		}

		this.readiness = { phase: "bootstrapping" };
		this.render();

		const controller = new AssessmentController({
			assessmentId: this.assessmentId,
			attemptId: this.attemptId || undefined,
			assessment: this.assessment,
			hooks: this.hooks || undefined,
		});

		this.unsubscribeController?.();
		this.controller = controller;
		this.unsubscribeController = controller.subscribe((event) => {
			if (event.type === "assessment-route-changed") {
				this.cleanupTtsForSectionNavigation(
					event satisfies AssessmentRouteChangedDetail,
				);
				this.dispatch(
					ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
					event satisfies AssessmentRouteChangedDetail,
				);
				// A route change is the one render that destroys the focused control.
				this.restoreFocusOnRender = true;
				this.render();
			}
			if (event.type === "assessment-session-applied") {
				this.dispatch(ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionApplied, event);
			}
			if (event.type === "assessment-session-changed") {
				this.dispatch(ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged, event);
			}
			if (event.type === "assessment-progress-changed") {
				this.dispatch(
					ASSESSMENT_PLAYER_PUBLIC_EVENTS.progressChanged,
					event satisfies AssessmentProgressChangedDetail,
				);
			}
			if (event.type === "assessment-submission-state-changed") {
				this.dispatch(
					ASSESSMENT_PLAYER_PUBLIC_EVENTS.submissionStateChanged,
					event satisfies AssessmentSubmissionStateChangedDetail,
				);
			}
		});

		try {
			await controller.initialize();
			this.readiness = { phase: "ready" };
			this.controllerReadyResolve?.(controller);
			this.dispatch(ASSESSMENT_PLAYER_PUBLIC_EVENTS.controllerReady, {
				controller,
			});
			this.hooks?.onAssessmentControllerReady?.(controller);
			this.render();
		} catch (error) {
			this.readiness = { phase: "error" };
			this.dispatch(ASSESSMENT_PLAYER_PUBLIC_EVENTS.error, {
				error,
			});
			this.renderEmptyState("Failed to initialize assessment player");
		}
	}

	private resolveInstrumentationProvider(): unknown {
		return resolveInstrumentationProvider({
			runtimePlayer: this.sectionPlayerRuntime?.player,
			component: "pie-assessment-player-default",
		});
	}

	private attachInstrumentationBridge(): void {
		this.detachInstrumentationBridge?.();
		this.detachInstrumentationBridge = attachInstrumentationEventBridge({
			host: this,
			instrumentationProvider: this.resolveInstrumentationProvider(),
			component: "pie-assessment-player-default",
			eventMap: ASSESSMENT_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "assessment",
				assessmentId: this.assessmentId,
				attemptId: this.attemptId || undefined,
			},
		});
	}

	private renderEmptyState(message: string) {
		const root = document.createElement("div");
		root.className = "pie-assessment-player-empty";
		root.textContent = message;
		this.swapContent(root);
	}

	/**
	 * Replace the rendered content, leaving the announcer in place.
	 */
	private swapContent(next: HTMLElement): void {
		this.containerRef?.remove();
		this.containerRef = next;
		this.appendChild(next);
	}

	/**
	 * The polite live region, created once and never replaced.
	 */
	private ensureAnnouncer(): HTMLElement {
		if (this.announcer?.isConnected) return this.announcer;
		const announcer = document.createElement("div");
		announcer.className = "pie-assessment-player-announcer";
		announcer.setAttribute("role", "status");
		announcer.setAttribute("aria-live", "polite");
		// Atomic because the position is one message; re-reading "Section 3 of 3" whole
		// beats announcing the digit that changed. Matches the shells' own live regions.
		announcer.setAttribute("aria-atomic", "true");
		// Available to assistive technology, absent from the visual layout. `clip` on a
		// 1px box rather than `display: none`, which removes it from the a11y tree too.
		announcer.style.cssText =
			"position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;";
		this.announcer = announcer;
		this.appendChild(announcer);
		return announcer;
	}

	/**
	 * What focus should return to after the re-render, or `null` to leave it alone.
	 *
	 * Only focus this element already owns is repaired. A host that navigates
	 * programmatically may have the learner's focus somewhere else entirely — its own
	 * chrome, another form — and pulling focus in from outside would be a worse bug
	 * than the one being fixed. Those cases still get the announcement.
	 */
	private captureFocusIntent(): "previous" | "next" | "section" | null {
		if (typeof document === "undefined") return null;
		const active = document.activeElement;
		if (!active || !this.contains(active)) return null;
		if (active.classList?.contains("pie-assessment-player-nav-btn")) {
			return active.textContent === "Back" ? "previous" : "next";
		}
		return "section";
	}

	/**
	 * Put focus back where `captureFocusIntent` asked, falling back down a chain that
	 * ends at the section region so no branch can leave focus on `<body>`.
	 *
	 * A nav button that has become disabled cannot take focus — pressing Next into the
	 * last section is exactly when that happens — so the intent degrades to the other
	 * button and then to the region itself.
	 */
	private applyFocusIntent(
		intent: "previous" | "next" | "section",
		buttons: { previous: HTMLButtonElement | null; next: HTMLButtonElement | null },
	): void {
		const candidates: (HTMLElement | null)[] =
			intent === "section"
				? [this.sectionHost]
				: intent === "next"
					? [buttons.next, buttons.previous, this.sectionHost]
					: [buttons.previous, buttons.next, this.sectionHost];
		for (const candidate of candidates) {
			if (!candidate) continue;
			if (candidate instanceof HTMLButtonElement && candidate.disabled) continue;
			candidate.focus();
			if (document.activeElement === candidate) return;
		}
	}

	private buildSectionPlayerTag(): string {
		return this.sectionPlayerLayout === "vertical"
			? VERTICAL_SECTION_TAG
			: DEFAULT_SECTION_TAG;
	}

	private buildSectionRuntime(): Record<string, unknown> {
		return resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime: this.sectionPlayerRuntime,
			playerType: this.playerType,
			attemptId: this.attemptId || undefined,
			env: this.env as Record<string, unknown> | null,
			coordinator: this.coordinator,
		}) as Record<string, unknown>;
	}

	private updateCurrentSectionRuntime(): void {
		const sectionEl = this.sectionHost?.firstElementChild as
			| (HTMLElement & { runtime?: Record<string, unknown> })
			| null;
		if (!sectionEl) return;
		sectionEl.runtime = this.buildSectionRuntime();
	}

	private cleanupTtsForSectionNavigation(
		route: AssessmentRouteChangedDetail,
	): void {
		if (
			route.currentSectionId &&
			route.previousSectionId &&
			route.currentSectionId === route.previousSectionId
		) {
			return;
		}
		const ttsService = (this.coordinator as CoordinatorWithTtsService | null)
			?.ttsService;
		if (!ttsService) return;
		try {
			ttsService.stop?.();
		} catch {}
		try {
			ttsService.requestControlHandoff?.();
		} catch {}
	}

	private syncCurrentSectionSessionIntoAssessment() {
		const controller = this.controller;
		if (!controller) return;
		const sectionController =
			(this.sectionHost?.firstElementChild as any)?.getSectionController?.() ||
			this.sectionControllerRef;
		if (!sectionController?.getSession) return;
		const currentSection = controller.getCurrentSection();
		if (!currentSection) return;
		controller.updateSectionSession(
			currentSection.sectionIdentifier,
			sectionController.getSession(),
		);
	}

	private attachSectionControllerReadyListener(
		target: HTMLElement,
		sectionIdentifier: string,
	): void {
		const sectionEl = target as SectionPlayerHostElement;
		// Svelte 5 custom elements mount their underlying component on a
		// microtask after `connectedCallback` (the mount sits behind an
		// `await Promise.resolve()` inside Svelte's CE wrapper). Property
		// getters for exported functions resolve to `this.$$c?.[name]`,
		// which is `undefined` until the mount microtask completes. Defer
		// the controller-resolve wait with `queueMicrotask` so it runs
		// after Svelte's mount microtask, guaranteeing
		// `waitForSectionController` is bound when we read it. Caller is
		// expected to attach this *after* `appendChild`; the microtask
		// defer is belt-and-suspenders for either ordering.
		queueMicrotask(() => {
			void (async () => {
				const controller =
					(await sectionEl.waitForSectionController?.(5000)) || null;
				this.sectionControllerRef = controller;
				if (!controller) return;
				const saved = this.controller?.getSectionSession(sectionIdentifier);
				if (saved && controller.applySession) {
					await controller.applySession(saved, { mode: "replace" });
				}
			})();
		});
		target.addEventListener("session-changed", () =>
			this.syncCurrentSectionSessionIntoAssessment(),
		);
		target.addEventListener("item-session-changed", () =>
			this.syncCurrentSectionSessionIntoAssessment(),
		);
	}

	private render() {
		const controller = this.controller;
		this.attachInstrumentationBridge();
		// Read before the swap below discards the node that holds focus.
		const focusIntent = this.restoreFocusOnRender
			? this.captureFocusIntent()
			: null;
		this.restoreFocusOnRender = false;
		this.ensureAnnouncer();
		this.sectionControllerRef = null;
		const container = document.createElement("div");
		container.className = "pie-assessment-player-default";

		const style = document.createElement("style");
		style.textContent = `
			:host {
				display: block;
				height: 100%;
				min-height: 0;
			}
			.pie-assessment-player-default {
				display: grid;
				grid-template-rows: auto minmax(0, 1fr);
				height: 100%;
				min-height: 0;
				gap: 0.5rem;
			}
			.pie-assessment-player-navigation {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.5rem;
				border: 1px solid var(--pie-border-light, #e5e7eb);
				border-radius: 0.375rem;
				background: var(--pie-background-light, var(--pie-background, #fff));
			}
			.pie-assessment-player-current-position {
				font-size: 0.9rem;
				font-weight: 600;
			}
			.pie-assessment-player-nav-controls {
				display: flex;
				gap: 0.5rem;
			}
			.pie-assessment-player-nav-btn {
				padding: 0.35rem 0.75rem;
				border: 1px solid var(--pie-border-light, #e5e7eb);
				border-radius: 0.375rem;
				background: var(--pie-background-light, var(--pie-background, #fff));
				cursor: pointer;
			}
			.pie-assessment-player-nav-btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			.pie-assessment-player-section-host {
				min-height: 0;
				height: 100%;
				overflow: hidden;
			}
		`;
		container.appendChild(style);

		const snapshot = this.getSnapshot();
		// One string for three surfaces: the visible position line, the section
		// host's accessible name, and the live announcement on a section change.
		const positionLabel =
			snapshot.navigation.totalSections > 0
				? this.i18n.t("player.assessment.sectionPosition", {
						position: snapshot.navigation.currentIndex + 1,
						total: snapshot.navigation.totalSections,
					})
				: this.i18n.t("player.assessment.noSections");
		let prevButton: HTMLButtonElement | null = null;
		let nextButton: HTMLButtonElement | null = null;
		const showNavigation = coerceBooleanLike(this.showNavigation, true);
		if (showNavigation) {
			const nav = document.createElement("div");
			nav.className = "pie-assessment-player-navigation";
			const pos = document.createElement("div");
			pos.className = "pie-assessment-player-current-position";
			pos.textContent = positionLabel;
			const controls = document.createElement("div");
			controls.className = "pie-assessment-player-nav-controls";
			prevButton = document.createElement("button");
			prevButton.className = "pie-assessment-player-nav-btn";
			prevButton.textContent = this.i18n.t("common.back");
			prevButton.disabled = !snapshot.navigation.canPrevious;
			prevButton.addEventListener("click", () => void this.navigatePrevious());
			nextButton = document.createElement("button");
			nextButton.className = "pie-assessment-player-nav-btn";
			nextButton.textContent = this.i18n.t("common.next");
			nextButton.disabled = !snapshot.navigation.canNext;
			nextButton.addEventListener("click", () => void this.navigateNext());
			controls.appendChild(prevButton);
			controls.appendChild(nextButton);
			nav.appendChild(pos);
			nav.appendChild(controls);
			container.appendChild(nav);
		}

		const sectionHost = document.createElement("div");
		sectionHost.className = "pie-assessment-player-section-host";
		// Named landmark, and the focus target of last resort. `tabindex="-1"` makes it
		// programmatically focusable without adding a tab stop, so a learner Tabbing
		// through the section never lands on the wrapper itself.
		sectionHost.setAttribute("role", "region");
		sectionHost.setAttribute("aria-label", positionLabel);
		sectionHost.tabIndex = -1;
		this.sectionHost = sectionHost;

		const currentSection = controller?.getCurrentSection() || null;
		if (currentSection) {
			const sectionTag = this.buildSectionPlayerTag();
			const sectionEl = document.createElement(sectionTag);
			sectionEl.setAttribute("assessment-id", this.assessmentId);
			sectionEl.setAttribute("section-id", currentSection.sectionIdentifier);
			if (this.attemptId) sectionEl.setAttribute("attempt-id", this.attemptId);
			if (this.locale) sectionEl.setAttribute("locale", this.locale);
			if (this.debug !== undefined && this.debug !== null) {
				const debugValue =
					typeof this.debug === "boolean" ? String(this.debug) : this.debug;
				sectionEl.setAttribute("debug", debugValue);
			}
			(sectionEl as any).section = currentSection.section;
			(sectionEl as any).runtime = this.buildSectionRuntime();
			(sectionEl as any).hooks = {
				cardTitleFormatter: this.hooks?.cardTitleFormatter,
			};
			sectionHost.appendChild(sectionEl);
			this.attachSectionControllerReadyListener(
				sectionEl,
				currentSection.sectionIdentifier,
			);
		}

		container.appendChild(sectionHost);
		this.swapContent(container);

		if (focusIntent) {
			this.applyFocusIntent(focusIntent, {
				previous: prevButton,
				next: nextButton,
			});
			// The visible position indicator changes silently; a learner who is not
			// looking at it gets the section change from here instead.
			this.announceSectionChange(positionLabel);
		}
	}

	/**
	 * Announce the new position, once the live region has been in the document long
	 * enough for the change to register as a change.
	 */
	private announceSectionChange(message: string): void {
		const announcer = this.ensureAnnouncer();
		if (announcer.textContent === message) return;
		announcer.textContent = message;
	}

	private applyDebugFlag(): void {
		if (this.debug === undefined || this.debug === null) return;
		if (typeof window === "undefined") return;
		const debugStr = String(this.debug);
		const debugValue = !(
			debugStr.toLowerCase() === "false" ||
			debugStr === "0" ||
			debugStr === ""
		);
		try {
			(window as any).PIE_DEBUG = debugValue;
		} catch {}
	}

	getSnapshot(): AssessmentPlayerSnapshot {
		const runtime = this.controller?.getRuntimeState() || {
			readiness: this.readiness.phase,
			currentSectionIndex: 0,
			totalSections: 0,
			currentSectionId: undefined,
			canNext: false,
			canPrevious: false,
			visitedSections: 0,
			submitted: false,
		};
		return {
			readiness: {
				phase: runtime.readiness,
			},
			navigation: {
				currentIndex: runtime.currentSectionIndex,
				totalSections: runtime.totalSections,
				canNext: runtime.canNext,
				canPrevious: runtime.canPrevious,
				currentSectionId: runtime.currentSectionId,
			},
			progress: {
				visitedSections: runtime.visitedSections,
				totalSections: runtime.totalSections,
			},
		};
	}

	selectNavigation() {
		return this.getSnapshot().navigation;
	}

	selectReadiness() {
		return this.getSnapshot().readiness;
	}

	selectProgress(): AssessmentPlayerProgressSnapshot {
		return this.getSnapshot().progress;
	}

	navigateTo(indexOrIdentifier: number | string): boolean {
		const nav = this.selectNavigation();
		const currentIndex = nav.currentIndex;
		const currentSectionId = nav.currentSectionId;
		let targetIndex = currentIndex;
		let targetSectionId: string | undefined;
		if (typeof indexOrIdentifier === "number") {
			targetIndex = indexOrIdentifier;
			targetSectionId =
				this.controller?.getSectionAt(targetIndex)?.sectionIdentifier;
		} else {
			targetSectionId = indexOrIdentifier;
			const section = this.controller?.getCurrentSection();
			if (section?.sectionIdentifier === targetSectionId) return true;
		}
		const allowed = this.dispatch(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.navigationRequested,
			{
				fromIndex: currentIndex,
				toIndex: targetIndex,
				fromSectionId: currentSectionId,
				toSectionId: targetSectionId,
				reason: "navigate-to",
			} satisfies AssessmentNavigationRequestedDetail,
			true,
		);
		if (!allowed) return false;
		this.syncCurrentSectionSessionIntoAssessment();
		const moved = this.controller?.navigateTo(indexOrIdentifier) === true;
		if (moved) void this.controller?.persist();
		return moved;
	}

	navigateNext(): boolean {
		const nav = this.selectNavigation();
		const targetSection = this.controller?.getSectionAt(nav.currentIndex + 1);
		const allowed = this.dispatch(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.navigationRequested,
			{
				fromIndex: nav.currentIndex,
				toIndex: nav.currentIndex + 1,
				fromSectionId: nav.currentSectionId,
				toSectionId: targetSection?.sectionIdentifier,
				reason: "navigate-next",
			} satisfies AssessmentNavigationRequestedDetail,
			true,
		);
		if (!allowed) return false;
		this.syncCurrentSectionSessionIntoAssessment();
		const moved = this.controller?.navigateNext() === true;
		if (moved) void this.controller?.persist();
		return moved;
	}

	navigatePrevious(): boolean {
		const nav = this.selectNavigation();
		const targetSection = this.controller?.getSectionAt(nav.currentIndex - 1);
		const allowed = this.dispatch(
			ASSESSMENT_PLAYER_PUBLIC_EVENTS.navigationRequested,
			{
				fromIndex: nav.currentIndex,
				toIndex: nav.currentIndex - 1,
				fromSectionId: nav.currentSectionId,
				toSectionId: targetSection?.sectionIdentifier,
				reason: "navigate-previous",
			} satisfies AssessmentNavigationRequestedDetail,
			true,
		);
		if (!allowed) return false;
		this.syncCurrentSectionSessionIntoAssessment();
		const moved = this.controller?.navigatePrevious() === true;
		if (moved) void this.controller?.persist();
		return moved;
	}

	getAssessmentController(): AssessmentControllerHandle | null {
		return this.controller;
	}

	async waitForAssessmentController(timeoutMs = 5000) {
		if (this.controller) return this.controller;
		const controllerPromise =
			this.controllerReadyPromise ||
			Promise.resolve<AssessmentControllerHandle | null>(null);
		const timeoutPromise = new Promise<null>((resolve) => {
			setTimeout(() => resolve(null), timeoutMs);
		});
		return Promise.race([controllerPromise, timeoutPromise]);
	}
}
