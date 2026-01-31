/**
 * This contains copies of the data types we use in PIEOneer. These types, unlike
 * the ones in the datastore package, should not have any dependencies, and might in some
 * cases be more shallow than their originals. The main reason for these is that they should
 * be able to be used in front-end code (as well as the PIEOneer backend code).
 *
 * INCLUDING REFERENCES TO THE DATASTORE PACKAGE INSTEAD WILL MAKE PIEONEER THROW 500
 * EVERYWHERE WITHOUT ANY FURTHER EXPLANATION
 */
export interface BaseEntity {
	id?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface CollectionEntity extends BaseEntity {
	name: string;
	organization: string | OrganizationEntity;
}

export interface OrganizationEntity extends BaseEntity {
	name: string;
	defaultCollection?: string | CollectionEntity;
}

export interface UserEntity extends BaseEntity {
	email: string;
	name?: string;
}

export interface ClientEntity extends BaseEntity {
	name: string;
	secret: string;
	user: string | UserEntity;
	organization: string | OrganizationEntity;
}

export interface AssignmentEntity extends BaseEntity {
	organization: string | OrganizationEntity;
}

export interface SessionEntity extends BaseEntity {
	item: ItemEntity;
	assignment?: string | AssignmentEntity; // TODO: Remove after data is migrated
	organization?: string | OrganizationEntity;
}

export enum SessionEventType {
	SAVE = "save",
	MODEL = "model",
	SCORE = "score",
	MANUAL_SCORE = "manual-score",
}

export enum ScoreType {
	AUTO = "auto",
	MANUAL = "manual",
}

export interface SessionScore {
	points?: number;
	max?: number;
	type?: ScoreType;
	partialScoring?: boolean;
	message?: string;
	errors?: string[];
}

export interface SessionAutoScore extends SessionScore {
	elements?: any[];
	extraProps?: any;
}

export interface SessionManualScore extends SessionScore {}

export interface SessionEventEntity extends BaseEntity {
	session: string | SessionEntity;
	type?: SessionEventType;
	saveEventId?: string;
	score?: number;
}

export enum ModeType {
	GATHER = "gather",
	VIEW = "view",
	EVALUATE = "evaluate",
}

export interface FlatSession {
	id: string;
	assignment: AssignmentEntity;
	item: string;
	data: any[];
	createdAt: Date;
	updatedAt: Date;
	mode: ModeType;
	autoScore: SessionAutoScore;
	manualScore: SessionManualScore;
	events: SessionEventEntity[]; // raw events;
}

export interface SemVerPrerelease {
	tag: string;
	version: number;
}

export interface SemVer {
	major: number;
	minor: number;
	patch: number;
	prerelease: SemVerPrerelease;
}

export interface VersionEntity extends BaseEntity {
	baseId: string;
	signature: string;
	version: SemVer;
}

export interface SearchMetaData {
	[key: string]: any;
}

export interface SearchMetaDataEntity extends BaseEntity {
	searchMetaData?: SearchMetaData;
}

export interface ConfigElements {
	[key: string]: string;
}

export interface PieModel {
	id: string;
	element: string;

	[key: string]: any;
}

export interface ConfigEntity {
	id?: string;
	markup: string;
	elements: ConfigElements;
	models: PieModel[];
	configuration?: Record<string, any>; // NEW: Configure settings for authoring mode

	[key: string]: any;
}

export interface ConfigContainerEntity extends BaseEntity {
	config: ConfigEntity;
}

export interface PassageEntity
	extends VersionEntity,
		ConfigContainerEntity,
		SearchMetaDataEntity {
	name: string;
	retired?: boolean;
	published?: boolean;
	// Search result highlights from OpenSearch (keyed by field name)
	highlights?: Record<string, string[]>;
}

export interface ItemEntity
	extends VersionEntity,
		ConfigContainerEntity,
		SearchMetaDataEntity {
	name?: string;
	passage?: string | PassageEntity;
	retired?: boolean;
	published?: boolean;
	configuration?: any;
	// Search result highlights from OpenSearch (keyed by field name)
	highlights?: Record<string, string[]>;
}

export interface AssignmentSessionData {
	assignment: AssignmentEntity;
	sessions: FlatSession[];
	items: ItemEntity[];
	error?: string;
}

/**
 * Metadata specifically for interpretation by clients, typically containing
 * options that are relevant for the user interface. This is not indexed for search.
 */
export interface SettingsMetaData {
	[key: string]: any;
}

/**
 * Objects that contain metadata in the settings property, which is NOT indexed for search
 * but typically only relevant for particular client cases.
 */
export interface SettingsMetaDataEntity {
	settings?: SettingsMetaData;
}

/**
 * A reference to an item with optionally a title, settings and metadata.
 */
export interface QuestionEntity
	extends SearchMetaDataEntity,
		SettingsMetaDataEntity {
	id?: string;
	title?: string;
	itemVId: string;
	item?: ItemEntity;
}

// ============================================================================
// QTI-aligned assessment model (QTI 2.x compatible shape)
// ============================================================================

export interface RubricBlock {
	id?: string;
	view:
		| "author"
		| "candidate"
		| "proctor"
		| "scorer"
		| "testConstructor"
		| "tutor";
	use?: "instructions" | "passage" | "rubric";

	/**
	 * Embedded HTML content (QTI 3.0 Approach 1).
	 * Use HTML5 data-* attributes within content for metadata like passage grouping.
	 * Mutually exclusive with stimulusRef.
	 */
	content?: string;

	/**
	 * Reference to shared stimulus (QTI 3.0 Approach 2).
	 * When present, the renderer should resolve and fetch the stimulus content.
	 * Mutually exclusive with content.
	 */
	stimulusRef?: StimulusRef;
}

/**
 * QTI-like assessment item reference (maps to qti-assessment-item-ref).
 * This is the canonical way to reference items from an assessment definition.
 */
export interface AssessmentItemRef
	extends SearchMetaDataEntity {
	id?: string;
	identifier: string;
	itemVId: string;
	href?: string;
	title?: string;
	fixed?: boolean;
	required?: boolean;
	weight?: number;
	item?: ItemEntity;

	/** Item-level settings for tool requirements */
	settings?: ItemSettings;
}

export interface QtiAssessmentSection
	extends SearchMetaDataEntity,
		SettingsMetaDataEntity {
	id?: string;
	identifier: string;
	title?: string;
	visible?: boolean;
	required?: boolean;
	keepTogether?: boolean;

	sections?: QtiAssessmentSection[];

	/**
	 * QTI 3.0: Assessment item references (items in this section).
	 * Maps to qti-assessment-item-ref in QTI 3.0 XML.
	 */
	assessmentItemRefs?: AssessmentItemRef[];

	// Shared context (passages/instructions/rubrics) for this section
	rubricBlocks?: RubricBlock[];

	sort?: string;
}

export interface TestPart {
	id?: string;
	identifier: string;
	navigationMode: "linear" | "nonlinear";
	submissionMode: "individual" | "simultaneous";
	sections: QtiAssessmentSection[];
}

// ============================================================================
// QTI 3.0 Types
// ============================================================================

export interface ContextDeclaration {
	identifier: string;
	baseType: 'boolean' | 'integer' | 'float' | 'string' | 'identifier' |
						'point' | 'pair' | 'directedPair' | 'duration' | 'file' | 'uri';
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	defaultValue?: any;
}

export interface CatalogCard {
	catalog: string; // 'spoken', 'sign-language', 'braille', etc.
	language?: string;
	content: string;
}

export interface AccessibilityCatalog {
	identifier: string;
	cards: CatalogCard[];
}

export interface PersonalNeedsProfile {
	supports: string[];
	prohibitedSupports?: string[];
	activateAtInit?: string[];
}

/**
 * QTI 3.0: Reference to a shared stimulus (passage).
 * Maps to qti-assessment-stimulus-ref element.
 */
export interface StimulusRef {
	/** Unique identifier for the stimulus (required) */
	identifier: string;

	/** URL/path to the stimulus content (required) */
	href: string;
}

/**
 * Reference to question and sorting info within a section.
 */
export interface SectionQuestionRef {
	questionId: string;
	sort?: string;
}

/**
 * Questions can optionally be grouped in sections (legacy).
 */
export interface AssessmentSection
	extends SearchMetaDataEntity,
		SettingsMetaDataEntity {
	id?: string;
	title?: string;
	sort?: string;
	questions: SectionQuestionRef[];
}

export interface AssessmentEntity
	extends BaseEntity,
		SearchMetaDataEntity {
	name?: string;
	title?: string;
	identifier?: string;
	description?: string;

	/** Enhanced structured settings for assessment configuration */
	settings?: AssessmentSettings;

	/** QTI version - '3.0' for QTI 3.0 format */
	qtiVersion?: '3.0';

	/** QTI 3.0: Context declarations (global shared variables) */
	contextDeclarations?: ContextDeclaration[];

	/** QTI 3.0: Integrated APIP accessibility catalogs */
	accessibilityCatalogs?: AccessibilityCatalog[];

	/** QTI 3.0: Personal Needs Profile (PNP 3.0) */
	personalNeedsProfile?: PersonalNeedsProfile;

	/** QTI 3.0: Stimulus references (shared passages) */
	stimulusRefs?: StimulusRef[];

	/** Legacy: Flat questions array */
	questions?: QuestionEntity[];

	/** Legacy: Simple sections */
	sections?: AssessmentSection[];

	/**
	 * QTI 3.0: testParts structure (authoritative for QTI format).
	 */
	testParts?: TestPart[];
}

/**
 * Enhanced settings structure for assessment configuration.
 * Provides structured fields for district policies, test administration,
 * tool configurations, and theme settings while remaining extensible.
 */
export interface AssessmentSettings {
	/** District/organization policies */
	districtPolicy?: {
		blockedTools?: string[]; // PNP support IDs that are blocked
		requiredTools?: string[]; // PNP support IDs that are required
		policies?: Record<string, any>;
	};

	/** Test administration configuration */
	testAdministration?: {
		mode?: 'practice' | 'test' | 'benchmark';
		toolOverrides?: Record<string, boolean>; // Override specific PNP supports
		startDate?: string;
		endDate?: string;
	};

	/** Tool-specific provider configurations */
	toolConfigs?: {
		calculator?: {
			provider?: 'desmos' | 'ti' | 'mathjs';
			type?: 'basic' | 'scientific' | 'graphing' | 'ti-84' | 'ti-108';
			settings?: Record<string, any>;
		};
		textToSpeech?: {
			provider?: 'browser' | 'polly' | 'custom';
			voice?: string;
			rate?: number;
			pitch?: number;
		};
		[toolId: string]: any; // Other tool configs
	};

	/** Theme configuration (not in PNP) */
	themeConfig?: {
		colorScheme?: 'default' | 'high-contrast' | 'dark';
		fontSize?: number;
		fontFamily?: string;
		lineHeight?: number;
		reducedMotion?: boolean;
	};

	/** Product-specific extensions */
	[key: string]: any;
}

/**
 * Item-level settings for tool requirements.
 * Used in AssessmentItemRef.settings to specify item-specific tool needs.
 */
export interface ItemSettings {
	requiredTools?: string[]; // PNP support IDs required for this item
	restrictedTools?: string[]; // PNP support IDs blocked for this item
	toolParameters?: Record<string, any>; // Tool-specific config per item

	[key: string]: any; // Product extensions
}

export interface SanctionedVersionEntity extends BaseEntity {
	organization?: string | OrganizationEntity; // if set, this is an organization specific matcher, otherwise, it's global
	match: string; // semver match expression, e.g. '1.*'
	pie: string; // e.g. @pie-element/calculator
	version: string; // e.g. 2.14.24
}

export enum SanctionedVersionChangeStatus {
	PENDING = "pending",
	IN_PROGRESS = "in_progress",
	COMPLETED = "completed",
	FAILED = "failed",
}

export interface SanctionedVersionChangeRequest {
	pie: string;
	match: string;
	version: string;
}

export interface SanctionedVersionChangeEntity extends BaseEntity {
	organization?: string | OrganizationEntity;
	createdBy: string | UserEntity;
	status: SanctionedVersionChangeStatus;
	requestedChanges: SanctionedVersionChangeRequest[];
	beforeState: SanctionedVersionEntity[];
	summary?: string;
	jobId: string;
}

export type PlayerMode = "gather" | "view" | "evaluate" | "browse" | "author";

export type PlayerRole = "student" | "instructor";

export interface Env {
	mode: PlayerMode;
	role: PlayerRole;
	partialScoring?: boolean;
}

export interface OutcomeResponse {
	id: string;
	element: string;
	score?: number;
	empty?: boolean;
	completed?: boolean;

	[key: string]: any;
}

export interface PieController {
	model(model: PieModel, sessionData: any[], env?: any): Promise<PieModel>;

	outcome(sessionData: any[], env?: any): Promise<OutcomeResponse>;

	score: (config: object, session: object, env: object) => Promise<object>;
	createCorrectResponseSession: (
		config: object,
		env: object,
	) => Promise<object>;
	validate: (model: object, config: object) => any;
}

export interface PieItemElement {
	[elementName: string]: string;
}

export type BundleInfo = {
	url: string;
	hash: string;
};

interface PieDefaultModel {
	// supports 'excess' properties as may be defined in pie models
	// https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#strict-object-literal-assignment-checking
	[x: string]: any;
}

interface PieContent {
	id: string;
	/**
	 * Set of elements to include in the pie, provided in the format `{'element-name': 'mpm-package-name'}`
	 */
	elements: PieItemElement;

	/** Models for each PIE included in the item */
	models: PieModel[];

	markup: string;

	bundle?: BundleInfo;

	defaultExtraModels?: {
		[key: string]: PieDefaultModel;
	};
}

interface AdvancedItemConfig {
	id: string;
	pie: PieContent;
	passage?: PieContent;
	instructorResources?: [PieContent];
	defaultExtraModels?: {
		[key: string]: PieDefaultModel;
	};
}

export type ItemConfig = PieContent | AdvancedItemConfig;

/**
 * During the loading of elements from PIE bundles, we do a trick where we make
 * editor components available as web components by appending this to the element name.
 */
export const editorPostFix = "-pie-editor--";

export type ModelUpdatedDetail = {
	update: any;
	reset: boolean;
};

export class ModelUpdatedEvent extends CustomEvent<ModelUpdatedDetail> {
	static TYPE = "model.updated";

	constructor(
		readonly update: any,
		readonly reset: boolean = false,
	) {
		super(ModelUpdatedEvent.TYPE, { bubbles: true, detail: { update, reset } });
	}
}

export type DeleteDone = (e?: Error) => void;

export type DeleteImageDetail = {
	src: string;
	done: DeleteDone;
};

export class DeleteImageEvent extends CustomEvent<DeleteImageDetail> {
	static TYPE = "delete.image";

	constructor(
		readonly src: string,
		readonly done: DeleteDone,
	) {
		super(DeleteImageEvent.TYPE, { bubbles: true, detail: { src, done } });
	}
}

export interface ImageHandler {
	isPasted?: boolean;
	cancel: () => void;
	done: (err?: Error, src?: string) => void;
	fileChosen: (file: File) => void;
	progress: (percent: number, bytes: number, total: number) => void;
}

export class InsertImageEvent extends CustomEvent<ImageHandler> {
	static TYPE = "insert.image";

	constructor(readonly handler: ImageHandler) {
		super(InsertImageEvent.TYPE, { bubbles: true, detail: handler });
	}
}

export type DeleteSoundDetail = {
	src: string;
	done: DeleteDone;
};

export class DeleteSoundEvent extends CustomEvent<DeleteSoundDetail> {
	static TYPE = "delete.sound";

	constructor(
		readonly src: string,
		readonly done: DeleteDone,
	) {
		super(DeleteSoundEvent.TYPE, { bubbles: true, detail: { src, done } });
	}
}

export interface SoundHandler {
	cancel: () => void;
	done: (err?: Error, src?: string) => void;
	fileChosen: File;
	progress: (percent: number, bytes: number, total: number) => void;
}

export class InsertSoundEvent extends CustomEvent<SoundHandler> {
	static TYPE = "insert.sound";

	constructor(readonly handler: SoundHandler) {
		super(InsertSoundEvent.TYPE, { bubbles: true, detail: handler });
	}
}

export const isPassageEntity = (
	passage: string | PassageEntity | undefined,
): passage is PassageEntity => typeof passage === "object" && passage !== null;

export function isPrerelease(version: any): version is SemVer {
	return (
		typeof version === "object" &&
		version !== null &&
		typeof version.major === "number" &&
		typeof version.minor === "number" &&
		typeof version.patch === "number" &&
		!!version.prerelease && // Check if prerelease exists
		typeof version.prerelease.tag === "string" &&
		typeof version.prerelease.version === "number"
	);
}

export function formatVersion(semVer: SemVer): string {
	if (!semVer) return "";
	const base = [semVer.major, semVer.minor, semVer.patch].join(".");
	if (isPrerelease(semVer)) {
		const prerelease = [semVer.prerelease.tag, semVer.prerelease.version].join(
			".",
		);
		return `${base}-${prerelease}`;
	}
	return base;
}

export interface PieElement extends HTMLElement {
	model: PieModel;
	configuration: any;
	session: any[];
}

export type SessionChangedDetail = {
	complete: boolean;
	component: any;
};

export class SessionChangedEvent extends CustomEvent<SessionChangedDetail> {
	static TYPE = "session-changed";

	constructor(
		readonly component: string,
		readonly complete: boolean,
	) {
		super(SessionChangedEvent.TYPE, {
			bubbles: true,
			composed: true,
			detail: { complete, component },
		} as any);
	}
}

interface ItemCfg extends ConfigEntity {}

interface ItemWPassageCfg {
	pie: ItemCfg;
	passage: ConfigEntity;
}

export interface LoadResponse {
	js: {
		view: string[];
	};
	item: ItemCfg | ItemWPassageCfg;
	session: {
		id: string;
		data: any[];
	};
}

export interface Tracker {
	track(message: string, ...args: any[]): void;

	start(label: string): void;

	end(label: string, metadata?: { [key: string]: any }): void;
}

/**
 * Interface for storing tracker messages with timestamps
 */
/**
 * Interface for storing tracker messages with timestamps
 */
export interface TrackerMessage {
	timestamp: Date;
	message: string;
	args: any[];
	formattedMessage: string; // Added formatted message with interpolated args
}

/**
 * Enhanced tracker that stores messages with timestamps
 */
export interface EnhancedTracker extends Tracker {
	/**
	 * Get all raw tracker messages ordered by timestamp (ascending)
	 */
	getMessages(): TrackerMessage[];

	/**
	 * Get a formatted multi-line representation of all tracker messages
	 */
	getFormattedMessages(): string;
}

export interface ScoreResponse {
	session: FlatSession;
	score: SessionScore;
	empty?: boolean;

	[key: string]: any;
}

export interface VersionDiff {
	version: SemVer;
	previousVersion: SemVer | null;
	createdAt: Date;
	changes: {
		added: Record<string, any>;
		removed: Record<string, any>;
		modified: Record<
			string,
			{
				previous: any;
				current: any;
			}
		>;
	};
	changeCount: number;
}

export interface RoleToOrganizationsMapping {
	id?: string;
	role: string;
	organizations: OrganizationEntity[] | string[];
	createdAt?: Date;
	updatedAt?: Date;
}

// CMS Types (copied from @pie-api-aws/datastore to avoid importing server-only package)
export enum StandardType {
	ROOT = 0,
	SUBJECT = 1,
	LEVEL = 2,
	STANDARD = 3,
}

export interface HierarchyInfo {
	root?: {
		id: string;
		guid: string;
		title: string;
	};
	subject?: {
		id: string;
		guid: string;
		title: string;
	};
	level?: {
		id: string;
		guid: string;
		title: string;
		grades: number[];
	};
}

export interface CmsLearningStandardEntity extends BaseEntity {
	guid: string;
	abbr?: string;
	type: StandardType;
	parentId?: string;
	parentGuid?: string;
	path?: string;
	depth: number;
	ancestors: string[];
	hierarchy?: HierarchyInfo;
	title?: string;
	description?: string;
	sequence?: string;
	orderIndex?: number;
	subjectArea?: string;
	subjectName?: string;
	category?: string;
	abType?: string;
	abLabel?: string;
	setName?: string;
	publication?: string;
	adopted?: string;
	grades: number[];
	gradeNames?: string[];
	properties: Record<string, string>;
	status?: "active" | "retired" | "deprecated";
	lastModifiedAt?: Date;
	replacesGuid?: string;
	replacedByGuid?: string;
	descriptionHtml?: string;
	lastSyncedAt?: Date;
}

export interface ItemBankConfig {
	collectionId: string;
	subject?: string;
	gradeLevels?: number[];
	orderIndex: number;
}

export interface DOKDistribution {
	dok1?: number;
	dok2?: number;
	dok3?: number;
	dok4?: number;
}

export interface AssessmentGoal {
	dokDistribution?: DOKDistribution;
	constructedResponseCount?: number;
	passageGoals?: string;
	totalItemCount?: {
		target?: number;
		min?: number;
		max?: number;
	};
}

export interface StudioImportMetadata {
	studioAssessmentProgramId?: string;
	studioPublicId?: string;
	importedAt?: Date;
}

export interface CmsBlueprintEntity extends BaseEntity {
	name: string;
	description?: string;
	subject?: string;
	standardSet?: string;
	gradeLevels: number[];
	states?: string[];
	itemBankConfigs: ItemBankConfig[];
	assessmentGoal?: AssessmentGoal;
	claimFramework?: "SBAC" | "PARCC" | "STATE" | "CUSTOM";
	claimTargets?: string[];
	useSBACClusterTarget?: boolean;
	clusters?: string[];
	studioImportMetadata?: StudioImportMetadata;
	originalPrompt?: string;
}

export interface CmsBlueprintItemEntity extends BaseEntity {
	blueprintId: string;
	standardGuid: string;
	count: number;
	details?: string;
	assessmentId?: string;
}

// Assessment Authoring Types
export type AssessmentMode = "view" | "author";

export interface AssessmentAuthoringCallbacks {
	onItemAdded?: (item: QuestionEntity, index: number) => void;
	onItemRemoved?: (itemId: string, index: number) => void;
	onItemMoved?: (fromIndex: number, toIndex: number) => void;
	onItemUpdated?: (itemId: string, updates: Partial<QuestionEntity>) => void;
	onAssessmentUpdated?: (assessment: AssessmentEntity) => void;
	onSectionAdded?: (section: AssessmentSection, index: number) => void;
	onSectionRemoved?: (sectionId: string, index: number) => void;
	onSectionUpdated?: (
		sectionId: string,
		updates: Partial<AssessmentSection>,
	) => void;
}
