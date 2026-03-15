import type {
	AssessmentDefinition,
	AssessmentDeliveryPlan,
	AssessmentPlayerHooks,
	AssessmentSession,
	AssessmentSectionInstance,
	AssessmentSessionPersistenceStrategy,
	SectionSessionSnapshot,
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

export interface AssessmentControllerHandle {
	initialize(): Promise<void>;
	hydrate(): Promise<void>;
	persist(): Promise<void>;
	getSession(): AssessmentSession | null;
	getRuntimeState(): AssessmentControllerRuntimeState;
	navigateTo(indexOrIdentifier: number | string): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	submit(): Promise<void>;
	subscribe(listener: (event: AssessmentControllerEvent) => void): () => void;
	getCurrentSection(): AssessmentSectionInstance | null;
	getSectionAt(index: number): AssessmentSectionInstance | null;
	getSectionSession(sectionId: string): SectionSessionSnapshot | null;
	updateSectionSession(
		sectionId: string,
		session: SectionSessionSnapshot | null,
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

function nowIso(): string {
	return new Date().toISOString();
}

function createNewAssessmentSession(args: {
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	seed: string;
	sectionIdentifiers: string[];
}): AssessmentSession {
	const startedAt = nowIso();
	const firstSection = args.sectionIdentifiers[0];
	return {
		version: 1,
		assessmentAttemptSessionIdentifier: args.assessmentAttemptSessionIdentifier,
		assessmentId: args.assessmentId,
		startedAt,
		updatedAt: startedAt,
		navigationState: {
			currentSectionIndex: 0,
			visitedSectionIdentifiers: firstSection ? [firstSection] : [],
			currentSectionIdentifier: firstSection,
		},
		realization: {
			seed: args.seed,
			sectionIdentifiers: args.sectionIdentifiers,
		},
		sectionSessions: {},
	};
}

function upsertSectionSession(
	session: AssessmentSession,
	args: {
		sectionIdentifier: string;
		sectionSession: SectionSessionSnapshot | null;
	},
): AssessmentSession {
	const updatedAt = nowIso();
	return {
		...session,
		updatedAt,
		sectionSessions: {
			...session.sectionSessions,
			[args.sectionIdentifier]: {
				sectionIdentifier: args.sectionIdentifier,
				updatedAt,
				session: args.sectionSession,
			},
		},
	};
}

function setCurrentSectionPosition(
	session: AssessmentSession,
	args: {
		currentSectionIndex: number;
		currentSectionIdentifier?: string;
	},
): AssessmentSession {
	const visited = new Set(session.navigationState.visitedSectionIdentifiers || []);
	if (args.currentSectionIdentifier) visited.add(args.currentSectionIdentifier);
	return {
		...session,
		navigationState: {
			...session.navigationState,
			currentSectionIndex: args.currentSectionIndex,
			currentSectionIdentifier: args.currentSectionIdentifier,
			visitedSectionIdentifiers: Array.from(visited),
		},
	};
}

function flattenSections(assessment: AssessmentDefinition | null): AssessmentSectionInstance[] {
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
	private readiness: AssessmentControllerRuntimeState["readiness"] = "bootstrapping";
	private submitted = false;
	private persistenceStrategy?: AssessmentSessionPersistenceStrategy;
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
		for (const listener of this.listeners) listener(event);
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
			(await this.args.hooks?.createAssessmentDeliveryPlan?.(context, defaults)) ??
			defaults.createDefaultDeliveryPlan()
		);
	}

	private ensureSession(): AssessmentSession {
		if (this.session) return this.session;
		const sectionIds = this.deliveryPlan.sections.map((s) => s.sectionIdentifier);
		this.session = createNewAssessmentSession({
			assessmentAttemptSessionIdentifier: createAssessmentAttemptSessionIdentifier({
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
		try {
			this.readiness = "bootstrapping";
			this.deliveryPlan = await this.createDeliveryPlan();
			this.ensureSession();
			await this.hydrate();
			this.readiness = "ready";
			await this.args.hooks?.onAssessmentControllerReady?.(this);
		} catch (error) {
			this.readiness = "error";
			this.handleError(error, "controller-init");
		}
	}

	async hydrate(): Promise<void> {
		this.readiness = "hydrating";
		try {
			await this.args.hooks?.onBeforeAssessmentHydrate?.(this.storageContext);
			const strategy = await this.getPersistenceStrategy();
			const loaded = await strategy.loadSession(this.storageContext);
			if (loaded) {
				this.session = loaded;
				this.emit({ type: "assessment-session-applied", timestamp: now() });
			}
			this.ensureSession();
			this.readiness = "ready";
		} catch (error) {
			this.readiness = "error";
			this.handleError(error, "session-load");
		}
	}

	async persist(): Promise<void> {
		try {
			const strategy = await this.getPersistenceStrategy();
			await this.args.hooks?.onBeforeAssessmentPersist?.(
				this.storageContext,
				this.session,
			);
			await strategy.saveSession(this.storageContext, this.session);
		} catch (error) {
			this.handleError(error, "session-save");
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
		this.emit({ type: "assessment-session-changed", timestamp: now() });
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
		this.submitted = true;
		this.emit({
			type: "assessment-submission-state-changed",
			timestamp: now(),
			submitted: true,
		});
		await this.persist();
	}

	subscribe(listener: (event: AssessmentControllerEvent) => void): () => void {
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

	getSectionSession(sectionId: string): SectionSessionSnapshot | null {
		const entry = this.ensureSession().sectionSessions[sectionId];
		return (entry?.session || null) as SectionSessionSnapshot | null;
	}

	updateSectionSession(
		sectionId: string,
		session: SectionSessionSnapshot | null,
	): void {
		this.session = upsertSectionSession(this.ensureSession(), {
			sectionIdentifier: sectionId,
			sectionSession: session,
		});
		this.emit({ type: "assessment-session-changed", timestamp: now() });
	}
}
