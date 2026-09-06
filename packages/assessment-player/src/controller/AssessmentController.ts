import {
	createNewAssessmentSession,
	setCurrentSectionPosition,
	upsertSectionSession,
} from "@pie-players/pie-assessment-toolkit";
import type {
	AssessmentDefinition,
	AssessmentDeliveryPlan,
	AssessmentPlayerHooks,
	AssessmentSession,
	AssessmentSectionInstance,
	AssessmentSessionPersistenceStrategy,
	SectionControllerSessionState,
} from "../types.js";

export interface AssessmentControllerRuntimeState {
	readiness: "bootstrapping" | "hydrating" | "ready" | "error";
	currentSectionIndex: number;
	totalSections: number;
	currentSectionId?: string;
	canNext: boolean;
	canPrevious: boolean;
	visitedSections: number;
	submitted: boolean;
}

export type AssessmentControllerEvent =
	| {
			type: "assessment-route-changed";
			timestamp: number;
			currentSectionIndex: number;
			totalSections: number;
			currentSectionId?: string;
			previousSectionId?: string;
			canNext: boolean;
			canPrevious: boolean;
	  }
	| {
			type: "assessment-session-applied";
			timestamp: number;
	  }
	| {
			type: "assessment-session-changed";
			timestamp: number;
	  }
	| {
			type: "assessment-progress-changed";
			timestamp: number;
			visitedSectionCount: number;
			totalSections: number;
	  }
	| {
			type: "assessment-submission-state-changed";
			timestamp: number;
			submitted: boolean;
	  };

/**
 * Host-facing controller for a single assessment attempt.
 *
 * `AssessmentControllerHandle` is the primary API surface a host
 * application uses after the assessment player signals readiness via
 * the `AssessmentPlayerHooks.onAssessmentControllerReady(handle)` hook.
 *
 * The interface is the contract; the production implementation is
 * `AssessmentController` in this same file. The controller owns
 * cross-section navigation, the assessment session shape (delivery
 * plan + per-section snapshots), and `submit()`. Per-section concerns
 * (item navigation, item sessions, content loading) belong to the
 * embedded `SectionControllerHandle`, not here.
 *
 * Typical lifecycle for a host:
 *
 * ```ts
 * // wired through AssessmentPlayerHooks.onAssessmentControllerReady
 * const unsubscribe = controller.subscribe(handleEvent);
 * // ...later, on save / submit:
 * await controller.persist();
 * await controller.submit();
 * unsubscribe();
 * ```
 */
export interface AssessmentControllerHandle {
	/**
	 * Bootstrap the controller: build the delivery plan, ensure a
	 * session exists, and run `hydrate()` once. The owning element
	 * publishes readiness and invokes `onAssessmentControllerReady`.
	 *
	 * Called by the assessment player when the player CE mounts. Hosts
	 * normally do not call this directly.
	 */
	initialize(): Promise<void>;
	/** Retire this attempt, detach listeners, and notify its disposal hook once. */
	dispose(): Promise<void>;
	/**
	 * Load and apply a previously persisted assessment session via the
	 * registered `AssessmentSessionPersistenceStrategy`. Falls back to
	 * a fresh session when no snapshot exists. Emits
	 * `assessment-session-applied` on a successful load.
	 */
	hydrate(): Promise<void>;
	/**
	 * Save the current assessment session via the registered
	 * persistence strategy.
	 *
	 * Hosts call this on whatever cadence they choose (debounced on
	 * change, on visibility change, on submit). `submit()` always
	 * `persist()`s as its final step.
	 */
	persist(): Promise<void>;
	/**
	 * Return the current `AssessmentSession` snapshot — delivery plan
	 * realization, navigation state, and the per-section session map.
	 *
	 * This is the same shape exchanged with the persistence strategy
	 * and with the section controllers under each section.
	 */
	getSession(): AssessmentSession | null;
	/**
	 * Return a live navigation/runtime snapshot — readiness, current
	 * section index/id, total sections, `canNext` / `canPrevious`,
	 * visited count, and submission state.
	 *
	 * Intended for chrome rendering and runtime introspection (debug
	 * panels, navigation buttons). Use `getSession()` for persistence.
	 */
	getRuntimeState(): AssessmentControllerRuntimeState;
	/**
	 * Navigate to a section by zero-based index or by section
	 * identifier. Emits `assessment-route-changed`,
	 * `assessment-session-changed`, and `assessment-progress-changed`
	 * on success. Returns `false` for out-of-range indices and unknown
	 * identifiers.
	 */
	navigateTo(indexOrIdentifier: number | string): boolean;
	/**
	 * Advance to the next section. Returns `false` when already at the
	 * last section. Same emission contract as `navigateTo`.
	 */
	navigateNext(): boolean;
	/**
	 * Step back to the previous section. Returns `false` when already
	 * at the first section. Same emission contract as `navigateTo`.
	 */
	navigatePrevious(): boolean;
	/**
	 * Mark the assessment as submitted, emit
	 * `assessment-submission-state-changed`, and `persist()` the final
	 * snapshot.
	 */
	submit(): Promise<void>;
	/**
	 * Subscribe to the controller's typed event stream
	 * (`AssessmentControllerEvent` discriminated union:
	 * `assessment-route-changed`, `assessment-session-applied`,
	 * `assessment-session-changed`, `assessment-progress-changed`,
	 * `assessment-submission-state-changed`).
	 *
	 * Returns a disposer.
	 */
	subscribe(listener: (event: AssessmentControllerEvent) => void): () => void;
	/**
	 * Return the `AssessmentSectionInstance` the runtime currently
	 * considers active (delivery-plan entry at the current section
	 * index). Returns `null` when the delivery plan is empty.
	 */
	getCurrentSection(): AssessmentSectionInstance | null;
	/**
	 * Return the delivery-plan entry at a specific zero-based index, or
	 * `null` if the index is out of range. Used for chrome that needs
	 * to render section labels / metadata for non-current sections.
	 */
	getSectionAt(index: number): AssessmentSectionInstance | null;
	/**
	 * Return the persisted snapshot for a specific section
	 * (`SectionControllerSessionState`), or `null` if no snapshot has been
	 * recorded yet.
	 *
	 * This is the snapshot shape produced by the embedded
	 * `SectionControllerHandle.getSession()` for that section.
	 */
	getSectionSession(sectionId: string): SectionControllerSessionState | null;
	/**
	 * Persist (in-memory) a snapshot for a specific section into the
	 * assessment session and emit `assessment-session-changed`. Used by
	 * the per-section bridge to roll up `SectionController` state into
	 * the assessment session before the next `persist()`.
	 */
	updateSectionSession(
		sectionId: string,
		session: SectionControllerSessionState | null,
	): void;
}

function now() {
	return Date.now();
}

function sanitizeId(input: string): string {
	return input.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function createAssessmentAttemptSessionIdentifier(args: {
	assessmentId: string;
	attemptId?: string;
}): string {
	if (args.attemptId) {
		return `aas_v1_${sanitizeId(args.assessmentId)}_${sanitizeId(args.attemptId)}`;
	}
	const storage = getBrowserLocalStorage();
	const anon = storage ? getOrCreateAnonymousDeviceId(storage) : "anon";
	return `aas_v1_${sanitizeId(args.assessmentId)}_${sanitizeId(anon)}`;
}

function getBrowserLocalStorage(): Storage | null {
	try {
		if (typeof window === "undefined") return null;
		return window.localStorage;
	} catch {
		return null;
	}
}

function getOrCreateAnonymousDeviceId(storage: Storage): string {
	const key = "pie:assessment-player:anonymous-device-id";
	const existing = storage.getItem(key);
	if (existing) return existing;
	const created = `anon-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
	storage.setItem(key, created);
	return created;
}

function flattenSections(
	assessment: AssessmentDefinition | null,
): AssessmentSectionInstance[] {
	if (!assessment) return [];
	const instances: AssessmentSectionInstance[] = [];
	const testParts = assessment.testParts || [];
	if (testParts.length > 0) {
		testParts.forEach((part, stageIndex) => {
			(part.sections || []).forEach((section, sectionIndex) => {
				instances.push({
					stageIdentifier: part.identifier,
					stageIndex,
					sectionIndex: instances.length,
					sectionIdentifier:
						section.identifier || `section-${stageIndex}-${sectionIndex}`,
					section,
				});
			});
		});
		return instances;
	}
	(assessment.sections || []).forEach((section, index) => {
		instances.push({
			stageIdentifier: "default",
			stageIndex: 0,
			sectionIndex: index,
			sectionIdentifier: section.identifier || `section-${index}`,
			section,
		});
	});
	return instances;
}

export class AssessmentController implements AssessmentControllerHandle {
	private listeners = new Set<(event: AssessmentControllerEvent) => void>();
	private deliveryPlan: AssessmentDeliveryPlan = { sections: [] };
	private session: AssessmentSession | null = null;
	private readiness: AssessmentControllerRuntimeState["readiness"] =
		"bootstrapping";
	private submitted = false;
	private persistenceStrategy?: AssessmentSessionPersistenceStrategy;
	private initializationPromise?: Promise<void>;
	private disposalPromise?: Promise<void>;
	private disposed = false;
	private readonly storageContext;

	constructor(
		private readonly args: {
			assessmentId: string;
			attemptId?: string;
			assessment: AssessmentDefinition | null;
			hooks?: AssessmentPlayerHooks;
		},
	) {
		this.storageContext = {
			assessmentId: args.assessmentId,
			attemptId: args.attemptId,
		};
	}

	private emit(event: AssessmentControllerEvent): void {
		if (this.disposed) return;
		for (const listener of this.listeners) listener(event);
	}

	private assertActive(): void {
		if (!this.disposed) return;
		const error = new Error("Assessment controller has been disposed");
		error.name = "AbortError";
		throw error;
	}

	private handleError(
		error: unknown,
		phase:
			| "delivery-plan-create"
			| "session-load"
			| "session-save"
			| "controller-init"
			| "controller-dispose"
			| "navigation",
		details?: Record<string, unknown>,
	): void {
		const e = error instanceof Error ? error : new Error(String(error));
		this.args.hooks?.onError?.(e, { phase, details });
	}

	private async getPersistenceStrategy(): Promise<AssessmentSessionPersistenceStrategy> {
		if (this.persistenceStrategy) return this.persistenceStrategy;
		const defaults = {
			createDefaultPersistence: (): AssessmentSessionPersistenceStrategy => {
				const storage = getBrowserLocalStorage();
				const key = `pie:assessment-controller:v1:${this.storageContext.assessmentId}:${this.storageContext.attemptId || "default"}`;
				return {
					async loadSession() {
						if (!storage) return null;
						const raw = storage.getItem(key);
						if (!raw) return null;
						try {
							return JSON.parse(raw);
						} catch {
							return null;
						}
					},
					async saveSession(_context, session) {
						if (!storage) return;
						storage.setItem(key, JSON.stringify(session));
					},
					async clearSession() {
						if (!storage) return;
						storage.removeItem(key);
					},
				};
			},
		};
		this.persistenceStrategy =
			(await this.args.hooks?.createAssessmentSessionPersistence?.(
				this.storageContext,
				defaults,
			)) ?? (await defaults.createDefaultPersistence());
		return this.persistenceStrategy;
	}

	private async createDeliveryPlan(): Promise<AssessmentDeliveryPlan> {
		const defaults = {
			createDefaultDeliveryPlan: (): AssessmentDeliveryPlan => ({
				sections: flattenSections(this.args.assessment),
			}),
		};
		const context = {
			assessmentId: this.args.assessmentId,
			attemptId: this.args.attemptId,
			assessment: this.args.assessment,
		};
		return (
			(await this.args.hooks?.createAssessmentDeliveryPlan?.(
				context,
				defaults,
			)) ?? defaults.createDefaultDeliveryPlan()
		);
	}

	private ensureSession(): AssessmentSession {
		if (this.session) return this.session;
		const sectionIds = this.deliveryPlan.sections.map(
			(s) => s.sectionIdentifier,
		);
		this.session = createNewAssessmentSession({
			assessmentAttemptSessionIdentifier:
				createAssessmentAttemptSessionIdentifier({
					assessmentId: this.args.assessmentId,
					attemptId: this.args.attemptId,
				}),
			assessmentId: this.args.assessmentId,
			seed: `${this.args.assessmentId}:${this.args.attemptId || "default"}`,
			sectionIdentifiers: sectionIds,
		});
		return this.session;
	}

	async initialize(): Promise<void> {
		this.assertActive();
		return (this.initializationPromise ??= this.initializeOnce());
	}

	private async initializeOnce(): Promise<void> {
		let errorPhase: "delivery-plan-create" | null = "delivery-plan-create";
		try {
			this.readiness = "bootstrapping";
			const plan = await this.createDeliveryPlan();
			this.assertActive();
			this.deliveryPlan = plan;
			this.ensureSession();
			// hydrate reports its own phase. The outer initialization must reject
			// the same failure without reporting it twice or announcing readiness.
			errorPhase = null;
			await this.hydrate();
			this.assertActive();
			this.readiness = "ready";
		} catch (error) {
			try {
				if (!this.disposed) {
					this.readiness = "error";
					if (errorPhase) this.handleError(error, errorPhase);
				}
			} catch (reportError) {
				console.error("Assessment error hook failed", reportError);
			}
			throw error;
		}
	}

	async hydrate(): Promise<void> {
		this.assertActive();
		this.readiness = "hydrating";
		try {
			await this.args.hooks?.onBeforeAssessmentHydrate?.(this.storageContext);
			this.assertActive();
			const strategy = await this.getPersistenceStrategy();
			this.assertActive();
			const loaded = await strategy.loadSession(this.storageContext);
			this.assertActive();
			if (loaded) {
				this.session = loaded;
			}
			this.ensureSession();
			this.readiness = "ready";
			if (loaded) this.emit({ type: "assessment-session-applied", timestamp: now() });
			this.assertActive();
		} catch (error) {
			try {
				if (!this.disposed) {
					this.readiness = "error";
					this.handleError(error, "session-load");
				}
			} catch (reportError) {
				console.error("Assessment error hook failed", reportError);
			}
			throw error;
		}
	}

	dispose(): Promise<void> {
		if (this.disposalPromise) return this.disposalPromise;
		this.disposed = true;
		this.listeners.clear();
		this.session = null;
		this.deliveryPlan = { sections: [] };
		this.readiness = "error";
		this.disposalPromise = Promise.resolve().then(async () => {
			try {
				await this.args.hooks?.onAssessmentControllerDispose?.(this);
			} catch (error) {
				this.handleError(error, "controller-dispose");
				throw error;
			}
		});
		return this.disposalPromise;
	}

	async persist(): Promise<void> {
		this.assertActive();
		try {
			const strategy = await this.getPersistenceStrategy();
			if (this.disposed) return;
			await this.args.hooks?.onBeforeAssessmentPersist?.(
				this.storageContext,
				this.session,
			);
			if (this.disposed) return;
			await strategy.saveSession(this.storageContext, this.session);
		} catch (error) {
			if (!this.disposed) this.handleError(error, "session-save");
		}
	}

	getSession(): AssessmentSession | null {
		return this.session;
	}

	getRuntimeState(): AssessmentControllerRuntimeState {
		const snapshot = this.buildNavigationSnapshot();
		const visitedSections =
			this.session?.navigationState.visitedSectionIdentifiers.length || 0;
		return {
			readiness: this.readiness,
			currentSectionIndex: snapshot.currentSectionIndex,
			totalSections: snapshot.totalSections,
			currentSectionId: snapshot.currentSectionId,
			canNext: snapshot.canNext,
			canPrevious: snapshot.canPrevious,
			visitedSections,
			submitted: this.submitted,
		};
	}

	private buildNavigationSnapshot() {
		const totalSections = this.deliveryPlan.sections.length;
		const currentSectionIndex = Math.max(
			0,
			Math.min(
				totalSections > 0 ? totalSections - 1 : 0,
				this.session?.navigationState.currentSectionIndex || 0,
			),
		);
		const currentSection = this.deliveryPlan.sections[currentSectionIndex];
		return {
			currentSectionIndex,
			totalSections,
			currentSectionId: currentSection?.sectionIdentifier,
			canNext: currentSectionIndex < totalSections - 1,
			canPrevious: currentSectionIndex > 0,
		};
	}

	private setIndex(nextIndex: number): boolean {
		if (this.disposed) return false;
		const snapshot = this.buildNavigationSnapshot();
		if (nextIndex < 0 || nextIndex >= snapshot.totalSections) return false;
		const previousSectionId = snapshot.currentSectionId;
		const nextSection = this.deliveryPlan.sections[nextIndex];
		this.session = setCurrentSectionPosition(this.ensureSession(), {
			currentSectionIndex: nextIndex,
			currentSectionIdentifier: nextSection?.sectionIdentifier,
		});
		const nextSnapshot = this.buildNavigationSnapshot();
		this.emit({
			type: "assessment-route-changed",
			timestamp: now(),
			currentSectionIndex: nextSnapshot.currentSectionIndex,
			totalSections: nextSnapshot.totalSections,
			currentSectionId: nextSnapshot.currentSectionId,
			previousSectionId,
			canNext: nextSnapshot.canNext,
			canPrevious: nextSnapshot.canPrevious,
		});
		if (this.disposed) return false;
		this.emit({ type: "assessment-session-changed", timestamp: now() });
		if (this.disposed) return false;
		this.emit({
			type: "assessment-progress-changed",
			timestamp: now(),
			visitedSectionCount:
				this.ensureSession().navigationState.visitedSectionIdentifiers.length,
			totalSections: nextSnapshot.totalSections,
		});
		return true;
	}

	navigateTo(indexOrIdentifier: number | string): boolean {
		if (typeof indexOrIdentifier === "number") {
			return this.setIndex(indexOrIdentifier);
		}
		const idx = this.deliveryPlan.sections.findIndex(
			(s) => s.sectionIdentifier === indexOrIdentifier,
		);
		if (idx < 0) return false;
		return this.setIndex(idx);
	}

	navigateNext(): boolean {
		const current = this.buildNavigationSnapshot();
		return this.setIndex(current.currentSectionIndex + 1);
	}

	navigatePrevious(): boolean {
		const current = this.buildNavigationSnapshot();
		return this.setIndex(current.currentSectionIndex - 1);
	}

	async submit(): Promise<void> {
		this.assertActive();
		this.submitted = true;
		this.emit({
			type: "assessment-submission-state-changed",
			timestamp: now(),
			submitted: true,
		});
		await this.persist();
	}

	subscribe(listener: (event: AssessmentControllerEvent) => void): () => void {
		if (this.disposed) return () => {};
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getCurrentSection(): AssessmentSectionInstance | null {
		const current = this.buildNavigationSnapshot();
		return this.getSectionAt(current.currentSectionIndex);
	}

	getSectionAt(index: number): AssessmentSectionInstance | null {
		return this.deliveryPlan.sections[index] || null;
	}

	getSectionSession(sectionId: string): SectionControllerSessionState | null {
		if (this.disposed) return null;
		const entry = this.ensureSession().sectionSessions[sectionId];
		return entry?.session || null;
	}

	updateSectionSession(
		sectionId: string,
		session: SectionControllerSessionState | null,
	): void {
		if (this.disposed) return;
		this.session = upsertSectionSession(this.ensureSession(), {
			sectionIdentifier: sectionId,
			sectionSession: session,
		});
		this.emit({ type: "assessment-session-changed", timestamp: now() });
	}
}
