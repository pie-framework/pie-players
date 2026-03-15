import type {
	AssessmentSection,
	Env,
	TestPart,
} from "@pie-players/pie-players-shared/types";

export interface SectionSessionSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface AssessmentSessionNavigationState {
	currentSectionIndex: number;
	visitedSectionIdentifiers: string[];
	currentSectionIdentifier?: string;
}

export interface AssessmentSessionRealization {
	seed: string;
	sectionIdentifiers: string[];
}

export interface AssessmentSectionSessionState {
	sectionIdentifier: string;
	updatedAt: string;
	session: SectionSessionSnapshot | null;
}

export interface AssessmentSession {
	version: 1;
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	navigationState: AssessmentSessionNavigationState;
	realization: AssessmentSessionRealization;
	sectionSessions: Record<string, AssessmentSectionSessionState>;
	contextVariables?: Record<string, unknown>;
}

export interface AssessmentSectionInstance {
	stageIdentifier?: string;
	stageIndex: number;
	sectionIndex: number;
	sectionIdentifier: string;
	section: AssessmentSection;
}

export interface AssessmentDeliveryPlan {
	sections: AssessmentSectionInstance[];
}

export interface AssessmentDeliveryPlanContext {
	assessmentId: string;
	attemptId?: string;
	assessment: AssessmentDefinition | null;
}

export interface AssessmentDeliveryPlanFactoryDefaults {
	createDefaultDeliveryPlan: () => AssessmentDeliveryPlan;
}

export interface AssessmentSessionPersistenceContext {
	assessmentId: string;
	attemptId?: string;
}

export interface AssessmentSessionPersistenceStrategy {
	loadSession(
		context: AssessmentSessionPersistenceContext,
	): AssessmentSession | null | Promise<AssessmentSession | null>;
	saveSession(
		context: AssessmentSessionPersistenceContext,
		session: AssessmentSession | null,
	): void | Promise<void>;
	clearSession?(
		context: AssessmentSessionPersistenceContext,
	): void | Promise<void>;
}

export interface AssessmentSessionPersistenceFactoryDefaults {
	createDefaultPersistence: () =>
		| AssessmentSessionPersistenceStrategy
		| Promise<AssessmentSessionPersistenceStrategy>;
}

export interface AssessmentPlayerHooks {
	createAssessmentDeliveryPlan?: (
		context: AssessmentDeliveryPlanContext,
		defaults: AssessmentDeliveryPlanFactoryDefaults,
	) => AssessmentDeliveryPlan | Promise<AssessmentDeliveryPlan>;
	createAssessmentSessionPersistence?: (
		context: AssessmentSessionPersistenceContext,
		defaults: AssessmentSessionPersistenceFactoryDefaults,
	) =>
		| AssessmentSessionPersistenceStrategy
		| Promise<AssessmentSessionPersistenceStrategy>;
	onBeforeAssessmentHydrate?: (
		context: AssessmentSessionPersistenceContext,
	) => void | Promise<void>;
	onBeforeAssessmentPersist?: (
		context: AssessmentSessionPersistenceContext,
		session: AssessmentSession | null,
	) => void | Promise<void>;
	onAssessmentControllerReady?: (controller: unknown) => void | Promise<void>;
	onAssessmentControllerDispose?: (controller: unknown) => void | Promise<void>;
	onError?: (
		error: Error,
		context: {
			phase:
				| "delivery-plan-create"
				| "session-load"
				| "session-save"
				| "controller-init"
				| "controller-dispose"
				| "navigation";
			details?: Record<string, unknown>;
		},
	) => void;
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

export interface AssessmentDefinition {
	id?: string;
	identifier?: string;
	title?: string;
	testParts?: TestPart[];
	sections?: AssessmentSection[];
}

export interface AssessmentPlayerRuntimeConfig {
	assessmentId?: string;
	attemptId?: string;
	assessment?: AssessmentDefinition | null;
	env?: Env;
	hooks?: AssessmentPlayerHooks;
}
