/**
 * Assessment Context Profile System
 *
 * Provides a flexible, extensible system for resolving assessment configuration
 * based on multiple factors (student accommodations, district policies, item
 * requirements, etc.) without forcing the framework to understand policy logic.
 *
 * Key Principle: POLICY vs. MECHANISM separation
 * - Policy (HOW decisions are made): Product responsibility
 * - Mechanism (HOW components consume decisions): Framework responsibility
 */

/**
 * AssessmentContextProfile
 *
 * An opaque profile object that encapsulates ALL resolved decisions about:
 * - Which tools are available
 * - Which layout should be used
 * - What theme/accessibility settings apply
 * - Any other contextual configuration
 *
 * Framework components consume this profile WITHOUT knowing how decisions were made.
 */
export interface AssessmentContextProfile {
	// Identity
	profileId: string;
	studentId?: string;
	assessmentId: string;
	administrationId?: string;

	// Resolved decisions (NOT the inputs that led to these decisions)
	tools: ResolvedToolSet;
	theme: ResolvedThemeConfig;
	layout: ResolvedLayoutPreferences;
	accessibility?: ResolvedAccessibilitySettings;

	// Optional: Debugging/audit trail
	metadata?: ProfileMetadata;
}

/**
 * Resolved tool set with availability decisions
 */
export interface ResolvedToolSet {
	available: ToolAvailability[];
	resolutionTrace?: Map<string, ResolutionExplanation>;
}

/**
 * Tool availability decision
 */
export interface ToolAvailability {
	toolId: string;
	enabled: boolean;
	required?: boolean; // Must be used (e.g., item requires calculator)
	alwaysAvailable?: boolean; // Cannot be toggled off (e.g., IEP requirement)
	restricted?: boolean; // Explicitly blocked (e.g., district policy)
	config?: ToolSpecificConfig;
}

/**
 * Tool-specific configuration (provider-specific settings)
 */
export interface ToolSpecificConfig {
	// Calculator config
	calculatorType?:
		| "basic"
		| "scientific"
		| "graphing"
		| "ti-84"
		| "ti-108"
		| "ti-34-mv";
	calculatorProvider?: "desmos" | "mathjs" | "ti";
	calculatorSettings?: Record<string, any>;

	// TTS config
	ttsProvider?: "browser" | "polly" | "custom";
	ttsVoice?: string;
	ttsRate?: number;
	ttsPitch?: number;

	// Generic config
	[key: string]: any;
}

/**
 * Resolved theme configuration
 */
export interface ResolvedThemeConfig {
	colorScheme?: "default" | "high-contrast" | "dark" | "custom";
	backgroundColor?: string;
	textColor?: string;
	fontSize?: "small" | "normal" | "large" | "xlarge" | number;
	fontFamily?: string;
	lineHeight?: number;
	letterSpacing?: number;
	highContrast?: boolean;
	reducedMotion?: boolean;
	customVariables?: Record<string, string>;

	/** I18n configuration */
	locale?: string; // Current locale or 'auto' for browser detection
	fallbackLocale?: string; // Fallback locale (default 'en')
	allowLocaleChange?: boolean; // Whether locale can be changed (false for IEP lock)
}

/**
 * Resolved layout preferences
 */
export interface ResolvedLayoutPreferences {
	preferredTemplate?: string;
	allowTemplateSelection?: boolean;
	mobileOptimized?: boolean;
	tabletOptimized?: boolean;
	regionSizes?: Record<string, RegionSize>;
	customLayoutConfig?: Record<string, any>;
}

/**
 * Region size configuration
 */
export interface RegionSize {
	width?: string;
	height?: string;
	minWidth?: string;
	maxWidth?: string;
	minHeight?: string;
	maxHeight?: string;
	flex?: number;
}

/**
 * Resolved accessibility settings
 */
export interface ResolvedAccessibilitySettings {
	screenReaderOptimized?: boolean;
	keyboardNavigationEnhanced?: boolean;
	focusIndicatorStyle?: "default" | "enhanced" | "high-contrast";
	skipLinks?: boolean;
	ariaLiveRegions?: boolean;
	customA11ySettings?: Record<string, any>;
}

/**
 * Profile metadata for debugging and audit
 */
export interface ProfileMetadata {
	createdAt: Date;
	createdBy: string;
	version: string;
	inputSources?: string[];
	customMetadata?: Record<string, any>;
}

/**
 * Resolution explanation for debugging
 */
export interface ResolutionExplanation {
	toolId: string;
	decision: "allowed" | "blocked" | "required";
	reasons: string[];
	sources: string[];
	precedenceOrder?: string[];
}

/**
 * ProfileResolver interface
 *
 * Implementations of this interface determine HOW profiles are created.
 * Products can use the reference implementation, extend it, or replace entirely.
 */
export interface ProfileResolver {
	/**
	 * Resolve a complete profile from the given context
	 */
	resolve(context: ResolutionContext): Promise<AssessmentContextProfile>;

	/**
	 * Resolve tools only (partial resolution)
	 */
	resolveTools?(context: ResolutionContext): Promise<ResolvedToolSet>;

	/**
	 * Resolve theme only (partial resolution)
	 */
	resolveTheme?(context: ResolutionContext): Promise<ResolvedThemeConfig>;

	/**
	 * Resolve layout only (partial resolution)
	 */
	resolveLayout?(
		context: ResolutionContext,
	): Promise<ResolvedLayoutPreferences>;
}

/**
 * Resolution context - all inputs that MAY influence decisions
 *
 * Note: Not all implementations will use all fields.
 * This is intentionally flexible to support various resolution strategies.
 */
export interface ResolutionContext {
	// Required
	assessment: AssessmentInput;

	// Optional - depends on what the resolver needs
	student?: StudentInput;
	administration?: AdministrationInput;
	item?: ItemInput;
	district?: DistrictInput;
	organization?: OrganizationInput;

	// Custom inputs (product-specific)
	custom?: Record<string, any>;
}

/**
 * Assessment input for resolution
 */
export interface AssessmentInput {
	id: string;
	title?: string;
	subject?: string;
	gradeLevel?: string | number;
	defaultTools?: string[];
	defaultTheme?: Partial<ResolvedThemeConfig>;
	defaultLayout?: string;
	custom?: Record<string, any>;
}

/**
 * Student input for resolution
 */
export interface StudentInput {
	id: string;
	grade?: string | number;
	accommodations?: Record<string, boolean | any>;
	iep?: IEPInput;
	section504?: Section504Input;
	preferences?: StudentPreferences;
	custom?: Record<string, any>;
}

/**
 * IEP (Individualized Education Program) input
 */
export interface IEPInput {
	requiredTools?: string[];
	requiredAccommodations?: Record<string, any>;
	themeRequirements?: Partial<ResolvedThemeConfig>;
}

/**
 * Section 504 plan input
 */
export interface Section504Input {
	requiredTools?: string[];
	requiredAccommodations?: Record<string, any>;
	themeRequirements?: Partial<ResolvedThemeConfig>;
}

/**
 * Student preferences
 */
export interface StudentPreferences {
	preferredTheme?: Partial<ResolvedThemeConfig>;
	preferredLayout?: string;
	preferredTools?: string[];
	preferredLocale?: string; // Student's preferred language
}

/**
 * Administration input for resolution
 */
export interface AdministrationInput {
	id: string;
	assessmentId: string;
	mode?: "practice" | "test" | "benchmark";
	startDate?: Date;
	endDate?: Date;
	toolOverrides?: Record<string, boolean>;
	themeOverrides?: Partial<ResolvedThemeConfig>;
	custom?: Record<string, any>;
}

/**
 * Item input for resolution (current item context)
 */
export interface ItemInput {
	id: string;
	requiredTools?: string[];
	restrictedTools?: string[];
	toolParameters?: Record<string, any>;
	custom?: Record<string, any>;
}

/**
 * District input for resolution
 */
export interface DistrictInput {
	id: string;
	blockedTools?: string[];
	requiredTools?: string[];
	policies?: Record<string, any>;
	custom?: Record<string, any>;
}

/**
 * Organization input for resolution
 */
export interface OrganizationInput {
	id: string;
	defaultTheme?: Partial<ResolvedThemeConfig>;
	defaultLayout?: string;
	allowedTools?: string[];
	custom?: Record<string, any>;
}

/**
 * Tool resolution result (internal helper type)
 */
export interface ToolResolution {
	enabled: boolean;
	required?: boolean;
	alwaysAvailable?: boolean;
	restricted?: boolean;
	config?: ToolSpecificConfig;
	explanation?: ResolutionExplanation;
}
