/**
 * Tool system type definitions
 */

// Re-export calculator types from @pie-players/pie-calculator
export type {
	CalculationHistoryEntry,
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
	DesmosCalculatorConfig,
	TICalculatorConfig,
} from "@pie-players/pie-calculator";

export type ToolId = string;

export interface ToolState {
	id: ToolId;
	name: string;
	isVisible: boolean;
	isActive: boolean;
	zIndex: number;
	element?: HTMLElement;
}

export interface ToolPosition {
	x: number;
	y: number;
}

export interface ToolSize {
	width: number;
	height: number;
}

export interface ToolConfig {
	id: ToolId;
	name: string;
	icon?: string;
	enabled: boolean;
	alwaysAvailable?: boolean; // If true, available regardless of assessment config
}

export interface AssessmentToolConfig {
	enabledTools: ToolId[];
	toolSettings?: Record<ToolId, any>;
}

// ===== ARCHITECTURAL ENHANCEMENTS =====

/**
 * Tool allowance: "0" = blocked, "1" = allowed
 * Based on existing platform patterns
 */
export type ToolAllowance = "0" | "1";

/**
 * Roster/Test-level tool configuration
 * Defines default tool availability for an assessment
 */
export interface RosterToolConfiguration {
	rosterId: string;
	testId?: string;
	toolAllowances: Record<string, ToolAllowance>;
	defaultToolConfigs?: Record<string, ToolConfig>;
}

/**
 * Configuration source for tool resolution
 */
export type ConfigurationSource =
	| "roster-block"
	| "item-restriction"
	| "item-requirement"
	| "student-accommodation"
	| "roster-default"
	| "system-default";

/**
 * Resolved tool configuration with source tracking
 */
export interface ResolvedToolConfig extends ToolConfig {
	resolvedFrom: ConfigurationSource;
	required: boolean;
	reason: string;
}

/**
 * Tool resolution result
 */
export interface ToolResolutionResult {
	allowed: boolean;
	reason: string;
	source: ConfigurationSource;
	config?: ToolConfig;
}

/**
 * Item-level tool configuration
 */
export interface ItemToolConfig {
	itemId: string;
	requiredTools?: string[];
	restrictedTools?: string[];
	toolParameters?: Record<string, ItemToolParameters>;
	variantConfig?: ItemVariantConfig;
}

/**
 * Item tool parameters
 */
export interface ItemToolParameters {
	config?: Partial<ToolConfig>;
	hint?: string;
	preOpen?: boolean;
	variants?: Record<string, ItemToolParametersVariant>;
}

/**
 * Item tool parameters variant
 */
export interface ItemToolParametersVariant {
	config?: Partial<ToolConfig>;
	hint?: string;
	preOpen?: boolean;
}

/**
 * Item variant configuration for A/B testing and scaffolding
 */
export interface ItemVariantConfig {
	variantId?: string;
	toolOverrides?: Record<string, ItemToolOverride>;
	adaptations?: ContentAdaptation[];
	experimental?: Record<string, any>;
}

/**
 * Tool override for item variants
 */
export interface ItemToolOverride {
	config?: Partial<ToolConfig>;
	uiVariant?: string;
	parameters?: Record<string, any>;
	replacementTool?: string;
}

/**
 * Content adaptation types
 */
export interface ContentAdaptation {
	type: "scaffolding" | "difficulty" | "language" | "modality" | "custom";
	level: string | number;
	affectedTools?: string[];
	config?: Record<string, any>;
}

/**
 * Variant context for resolution
 */
export interface VariantContext {
	studentId: string;
	sessionId: string;
	language?: string;
	scaffoldingLevel?: number;
	difficultyLevel?: string;
	custom?: Record<string, any>;
}

/**
 * Resolved item configuration with variants applied
 */
export interface ResolvedItemConfig {
	itemId: string;
	requiredTools: string[];
	restrictedTools: string[];
	toolParameters: Record<string, ResolvedItemToolParameters>;
	appliedVariant?: string;
	appliedAdaptations?: ContentAdaptation[];
}

/**
 * Resolved item tool parameters
 */
export interface ResolvedItemToolParameters extends ItemToolParameters {
	finalConfig: ToolConfig;
}

/**
 * Library configuration for external dependencies
 */
export interface LibraryConfig {
	id: string;
	url: string;
	fallbackUrls?: string[];
	globalVar?: string;
	dependencies?: string[];
	integrity?: string;
	crossorigin?: "anonymous" | "use-credentials";
	timeout?: number;
	async?: boolean;
	defer?: boolean;
	retry?: RetryConfig;
}

/**
 * Retry configuration for library loading
 */
export interface RetryConfig {
	maxAttempts: number;
	delay: number;
	backoffMultiplier?: number;
}

/**
 * Library loader statistics
 */
export interface LoaderStats {
	loaded: string[];
	failed: string[];
	pending: string[];
	cacheHits: number;
	cacheMisses: number;
	totalLoadTime: number;
}

/**
 * Base interface that all tool components should implement
 */
export interface Tool {
	/** Unique identifier for this tool */
	id: ToolId;

	/** Display name */
	name: string;

	/** Show the tool */
	show(): void;

	/** Hide the tool */
	hide(): void;

	/** Toggle visibility */
	toggle(): void;

	/** Cleanup when tool is destroyed */
	destroy?(): void;
}

/**
 * Tool categories for organizational purposes
 */
export enum ToolCategory {
	STANDALONE = "standalone",
	CONTENT_INTERACTIVE = "content-interactive",
	SERVICE_DEPENDENT = "service-dependent",
}

/**
 * Tool metadata
 */
export interface ToolMetadata {
	id: ToolId;
	name: string;
	description: string;
	category: ToolCategory;
	icon?: string;
	dependencies?: string[];
}

/**
 * Tool Coordinator interface
 * Manages tool registration, visibility, and z-index coordination
 */
export interface ToolCoordinator {
	/** Bring an element to the front (highest z-index) */
	bringToFront(element: HTMLElement): void;
	/** Register a tool with the coordinator */
	registerTool(id: ToolId, name: string, element?: HTMLElement): void;

	/** Unregister a tool */
	unregisterTool(id: ToolId): void;

	/** Show a tool */
	showTool(id: ToolId): void;

	/** Hide a tool */
	hideTool(id: ToolId): void;

	/** Toggle a tool's visibility */
	toggleTool(id: ToolId): void;

	/** Update a tool's element reference */
	updateToolElement(id: ToolId, element: HTMLElement): void;

	/** Hide all tools */
	hideAllTools(): void;

	/** Get the state of a specific tool */
	getToolState(id: ToolId): ToolState | undefined;

	/** Check if a tool is visible */
	isToolVisible(id: ToolId): boolean;
}

// ===== SERVICE INTERFACES (Architectural Enhancements) =====

/**
 * Accommodation Resolver Service
 * Resolves final tool configuration by merging roster, student, and item configs
 * Precedence: Roster block > Item restriction > Item requirement > Student accommodation > Roster default
 */
export interface AccommodationResolver {
	/**
	 * Resolve final tools for an item given all configuration sources
	 */
	resolveToolsForItem(
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ResolvedToolConfig[];

	/**
	 * Check if a specific tool is allowed
	 */
	isToolAllowed(
		toolType: string,
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ToolResolutionResult;

	/**
	 * Get resolution trace for debugging
	 */
	getResolutionTrace(
		toolType: string,
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ResolutionTrace;
}

/**
 * Accommodation profile (student-level tool permissions)
 */
export interface AccommodationProfile {
	studentId: string;
	testId?: string;
	rosterId?: string;
	accommodations: Record<string, boolean>;
}

/**
 * Resolution trace for debugging
 */
export interface ResolutionTrace {
	toolType: string;
	steps: ResolutionStep[];
	finalDecision: ToolResolutionResult;
}

/**
 * Resolution step in trace
 */
export interface ResolutionStep {
	source: ConfigurationSource;
	decision: "allow" | "block" | "require" | "skip";
	reason: string;
	config?: Partial<ToolConfig>;
}

/**
 * Variant Resolver Service
 * Resolves item configuration considering variants
 */
export interface VariantResolver {
	/**
	 * Resolve variant configuration for an item
	 */
	resolveVariant(
		itemConfig: ItemToolConfig,
		context: VariantContext,
	): ResolvedItemConfig;
}

/**
 * Library Loader Service
 * Dynamically loads external libraries with retry and fallback support
 */
export interface LibraryLoader {
	/**
	 * Load a JavaScript library
	 */
	loadScript(library: LibraryConfig): Promise<void>;

	/**
	 * Load a stylesheet
	 */
	loadStylesheet(url: string, targetRoot?: Document | ShadowRoot): Promise<void>;

	/**
	 * Check if a library is already loaded
	 */
	isLoaded(libraryId: string): boolean;

	/**
	 * Preload multiple libraries in parallel
	 */
	preload(libraries: LibraryConfig[]): Promise<void>;

	/**
	 * Unload a library (remove script tag)
	 */
	unload(libraryId: string): void;

	/**
	 * Get loader statistics
	 */
	getStats(): LoaderStats;
}

// Calculator types now exported from @pie-players/pie-calculator (see top of file)

/**
 * PIE Response Component Interface
 * For tool-to-response integration (e.g., calculator inserting into text field)
 */
export interface PIEResponseComponent {
	readonly responseId: string;
	readonly responseType: PIEResponseType;

	getCapabilities(): ResponseCapabilities;
	canAccept(content: string, format: ContentFormat): boolean;
	insertContent(
		content: string,
		options: InsertionOptions,
	): Promise<InsertionResult>;
	getContent(format?: ContentFormat): string;
	getCursorPosition(): number | null;
	setCursorPosition(position: number): void;
	focus(): void;
	isFocused(): boolean;
	validate(content: string, format: ContentFormat): ValidationResult;
}

/**
 * PIE response types
 */
export type PIEResponseType =
	| "text-entry"
	| "extended-text-entry"
	| "math-inline"
	| "math-block"
	| "numeric"
	| "multiple-choice"
	| "custom";

/**
 * Response capabilities
 */
export interface ResponseCapabilities {
	acceptsPlainText?: boolean;
	acceptsLatex?: boolean;
	acceptsNumeric?: boolean;
	acceptsHtml?: boolean;
	acceptsFormattedText?: boolean;
	supportedFormats: ContentFormat[];
	supportsReplacement?: boolean;
	supportsInsertion?: boolean;
	supportsAppend?: boolean;
	maxLength?: number;
	allowedCharacters?: string;
}

/**
 * Content formats
 */
export type ContentFormat =
	| "plain-text"
	| "latex"
	| "mathml"
	| "numeric"
	| "html"
	| "markdown"
	| "formatted-text";

/**
 * Insertion options for response content
 */
export interface InsertionOptions {
	mode: "replace" | "insert" | "append";
	format: ContentFormat;
	position?: number;
	select?: boolean;
	focus?: boolean;
	source?: {
		toolId: string;
		toolType: string;
		timestamp: number;
	};
}

/**
 * Insertion result
 */
export interface InsertionResult {
	success: boolean;
	error?: string;
	insertedLength?: number;
	finalCursorPosition?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	errors?: ValidationError[];
	warnings?: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
	code: string;
	message: string;
	position?: number;
}

/**
 * Response Discovery Service
 * Finds and manages PIE response components for tool integration
 */
export interface ResponseDiscoveryService {
	getActiveResponse(): PIEResponseComponent | null;
	getResponse(responseId: string): PIEResponseComponent | null;
	getAllResponses(): PIEResponseComponent[];
	getResponsesAccepting(format: ContentFormat): PIEResponseComponent[];
	registerResponse(response: PIEResponseComponent): void;
	unregisterResponse(responseId: string): void;
	signalActive(responseId: string): void;
	signalInactive(responseId: string): void;
	onActiveResponseChanged(
		listener: (response: PIEResponseComponent | null) => void,
	): void;
}
