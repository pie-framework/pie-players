/**
 * Assessment Context Profile System
 *
 * Exports for the profile-based configuration system
 */

// Default implementation
export { DefaultProfileResolver } from "./DefaultProfileResolver";
// Core interfaces
export type {
	AdministrationInput,
	AssessmentContextProfile,
	// Input types
	AssessmentInput,
	DistrictInput,
	IEPInput,
	ItemInput,
	OrganizationInput,
	ProfileMetadata,
	ProfileResolver,
	RegionSize,
	ResolutionContext,
	ResolutionExplanation,
	ResolvedAccessibilitySettings,
	ResolvedLayoutPreferences,
	ResolvedThemeConfig,
	ResolvedToolSet,
	Section504Input,
	StudentInput,
	StudentPreferences,
	ToolAvailability,
	ToolResolution,
	ToolSpecificConfig,
} from "./interfaces";
