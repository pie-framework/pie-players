import type {
	AssessmentSection,
	AssessmentSession,
	AssessmentSectionSessionState,
	AssessmentSessionNavigationState,
	AssessmentSessionRealization,
	Env,
	SectionControllerSessionState,
	TestPart,
} from "@pie-players/pie-players-shared/types";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";

/**
 * Re-exported so every existing import site keeps its specifier. These shapes are
 * canonical in `@pie-players/pie-players-shared/types`.
 *
 * `SectionControllerSessionState` replaces a local `SectionSessionSnapshot` that
 * declared only `currentItemIndex`, `visitedItemIdentifiers` and `itemSessions`.
 * The runtime always carried the full snapshot — both `upsertSectionSession`
 * implementations pass the object through by reference — so the narrow type never
 * lost data; it made the `formative` and `timedMedia` slices unreadable from here
 * without a cast, which is why the assessment layer could not roll up mastery it
 * was already persisting.
 */
export type {
	AssessmentSession,
	AssessmentSectionSessionState,
	AssessmentSessionNavigationState,
	AssessmentSessionRealization,
	SectionControllerSessionState,
};

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
	cardTitleFormatter?: (
		context: Record<string, unknown>,
	) => string | null | undefined;
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

export interface SectionPlayerLoaderOverrides {
	loaderConfig?: LoaderConfig;
	loaderOptions?: Record<string, unknown>;
	[key: string]: unknown;
}

export type SectionPlayerRuntimeOverrides = SectionPlayerRuntimeConfig & {
	player?:
		| (SectionPlayerRuntimeConfig["player"] & SectionPlayerLoaderOverrides)
		| null;
	[key: string]: unknown;
};

export interface AssessmentPlayerRuntimeConfig {
	assessmentId?: string;
	attemptId?: string;
	assessment?: AssessmentDefinition | null;
	env?: Env;
	debug?: boolean | string;
	/**
	 * Optional section-player runtime overrides passed through by assessment-player.
	 * Useful for advanced configuration such as runtime.player.loaderConfig observability wiring.
	 */
	sectionPlayerRuntime?: SectionPlayerRuntimeOverrides | null;
	hooks?: AssessmentPlayerHooks;
}
