import "@pie-players/pie-section-player/components/section-player-splitpane-element";
import "@pie-players/pie-section-player/components/section-player-vertical-element";
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
import type {
	AssessmentDefinition,
	AssessmentPlayerHooks,
	AssessmentPlayerRuntimeConfig,
} from "../types.js";

interface SectionControllerHandle {
	getSession?: () => unknown;
	applySession?: (session: unknown, options?: { mode?: string }) => Promise<void>;
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
		];
	}

	assessmentId = "";
	attemptId = "";
	assessment: AssessmentDefinition | null = null;
	env: Env | null = null;
	coordinator: unknown = null;
	hooks: AssessmentPlayerHooks | null = null;
	sectionPlayerRuntime: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"] = null;
	sectionPlayerPlayer: AssessmentPlayerRuntimeConfig["sectionPlayerPlayer"] = null;
	showNavigation: boolean | string | null | undefined = true;
	sectionPlayerLayout: "splitpane" | "vertical" = "splitpane";
	playerType: "iife" | "esm" | "preloaded" = "iife";

	private controller: AssessmentControllerHandle | null = null;
	private controllerReadyPromise: Promise<AssessmentControllerHandle | null> | null =
		null;
	private controllerReadyResolve: ((value: AssessmentControllerHandle | null) => void) | null =
		null;
	private sectionHost: HTMLElement | null = null;
	private sectionControllerRef: SectionControllerHandle | null = null;
	private unsubscribeController?: () => void;
	private readiness: AssessmentPlayerSnapshot["readiness"] = {
		phase: "bootstrapping",
	};

	constructor() {
		super();
		this.controllerReadyPromise = new Promise((resolve) => {
			this.controllerReadyResolve = resolve;
		});
	}

	attributeChangedCallback(name: string, _oldValue: string | null, value: string | null) {
		if (name === "assessment-id") this.assessmentId = value || "";
		if (name === "attempt-id") this.attemptId = value || "";
		if (name === "show-navigation") this.showNavigation = value;
		if (name === "section-player-layout") {
			this.sectionPlayerLayout = value === "vertical" ? "vertical" : "splitpane";
		}
		if (name === "player-type") {
			this.playerType = (value as typeof this.playerType) || "iife";
		}
		if (this.isConnected) {
			void this.bootstrapController();
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
		void this.bootstrapController();
	}

	disconnectedCallback() {
		this.unsubscribeController?.();
		this.hooks?.onAssessmentControllerDispose?.(this.controller || undefined);
	}

	private dispatch(name: string, detail?: unknown, cancelable = false): boolean {
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
				this.dispatch(
					ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
					event satisfies AssessmentRouteChangedDetail,
				);
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

		await controller.initialize();
		this.readiness = { phase: "ready" };
		this.controllerReadyResolve?.(controller);
		this.dispatch(ASSESSMENT_PLAYER_PUBLIC_EVENTS.controllerReady, {
			controller,
		});
		this.hooks?.onAssessmentControllerReady?.(controller);
		this.render();
	}

	private renderEmptyState(message: string) {
		this.innerHTML = "";
		const root = document.createElement("div");
		root.className = "pie-assessment-player-empty";
		root.textContent = message;
		this.appendChild(root);
	}

	private buildSectionPlayerTag(): string {
		return this.sectionPlayerLayout === "vertical"
			? VERTICAL_SECTION_TAG
			: DEFAULT_SECTION_TAG;
	}

	private syncCurrentSectionSessionIntoAssessment() {
		const controller = this.controller;
		if (!controller) return;
		const sectionController =
			this.sectionControllerRef ||
			(this.sectionHost?.firstElementChild as any)?.getSectionController?.();
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
		target.addEventListener("section-controller-ready", async (event: Event) => {
			const detail = (event as CustomEvent<{ controller?: SectionControllerHandle }>)
				.detail;
			this.sectionControllerRef = detail?.controller || null;
			const saved = this.controller?.getSectionSession(sectionIdentifier);
			if (saved && this.sectionControllerRef?.applySession) {
				await this.sectionControllerRef.applySession(saved, { mode: "replace" });
			}
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
		this.innerHTML = "";
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
				background: var(--pie-background-light, #fff);
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
				background: var(--pie-background-light, #fff);
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
		const showNavigation = coerceBooleanLike(this.showNavigation, true);
		if (showNavigation) {
			const nav = document.createElement("div");
			nav.className = "pie-assessment-player-navigation";
			const pos = document.createElement("div");
			pos.className = "pie-assessment-player-current-position";
			pos.textContent =
				snapshot.navigation.totalSections > 0
					? `Section ${snapshot.navigation.currentIndex + 1} of ${snapshot.navigation.totalSections}`
					: "No sections";
			const controls = document.createElement("div");
			controls.className = "pie-assessment-player-nav-controls";
			const prevButton = document.createElement("button");
			prevButton.className = "pie-assessment-player-nav-btn";
			prevButton.textContent = "Back";
			prevButton.disabled = !snapshot.navigation.canPrevious;
			prevButton.addEventListener("click", () => void this.navigatePrevious());
			const nextButton = document.createElement("button");
			nextButton.className = "pie-assessment-player-nav-btn";
			nextButton.textContent = "Next";
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
		this.sectionHost = sectionHost;

		const currentSection = controller?.getCurrentSection() || null;
		if (currentSection) {
			const sectionTag = this.buildSectionPlayerTag();
			const sectionEl = document.createElement(sectionTag);
			sectionEl.setAttribute("assessment-id", this.assessmentId);
			sectionEl.setAttribute("section-id", currentSection.sectionIdentifier);
			if (this.attemptId) sectionEl.setAttribute("attempt-id", this.attemptId);
			sectionEl.setAttribute("player-type", this.playerType);
			(sectionEl as any).section = currentSection.section;
			if (this.env) (sectionEl as any).env = this.env;
			if (this.coordinator) (sectionEl as any).coordinator = this.coordinator;
			if (this.sectionPlayerRuntime) {
				(sectionEl as any).runtime = this.sectionPlayerRuntime;
			}
			if (this.sectionPlayerPlayer) {
				(sectionEl as any).player = this.sectionPlayerPlayer;
			}
			this.attachSectionControllerReadyListener(
				sectionEl,
				currentSection.sectionIdentifier,
			);
			sectionHost.appendChild(sectionEl);
		}

		container.appendChild(sectionHost);
		this.appendChild(container);
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
			targetSectionId = this.controller?.getSectionAt(targetIndex)?.sectionIdentifier;
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
			this.controllerReadyPromise || Promise.resolve<AssessmentControllerHandle | null>(null);
		const timeoutPromise = new Promise<null>((resolve) => {
			setTimeout(() => resolve(null), timeoutMs);
		});
		return Promise.race([controllerPromise, timeoutPromise]);
	}
}
