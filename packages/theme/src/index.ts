import { PieThemeElement, definePieTheme } from "./theme-element.js";

export { PieThemeElement, definePieTheme };
export {
	DAISYUI_THEME_PROVIDER_ADAPTER,
	getPieThemeProvider,
	PIE_THEME_PROVIDER_NONE,
	listPieThemeProviders,
	registerPieThemeProvider,
	resolveProviderVariables,
	unregisterPieThemeProvider,
	type ThemeProviderAdapter,
} from "./providers.js";
export {
	DAISY_SLOT_CSS_VARIABLES,
	DAISYUI_PIE_TOKEN_MAP,
	resolveDaisyPieVariables,
	type DaisyMappingEntry,
	type DaisySlot,
} from "./daisyui-mapping.js";
export {
	createCanvasColorMeasure,
	type ColorMeasure,
} from "./contrast.js";
export {
	isThemeMode,
	isThemeScope,
	normalizePieThemeVariables,
	type ColorSchemeSnapshot,
	type PieColorSchemeDescriptor,
	type PieColorSchemePreview,
	type PieThemeDiagnostic,
	type PieThemeDiagnosticCode,
	type PieThemeObserver,
	type PieThemeResolutionStatus,
	type RegisteredPieColorScheme,
	type RegistrationReceipt,
	type ResolvePieThemeInput,
	type ThemeResolution,
	type ThemeMode,
	type ThemeScope,
	type ThemeTokenName,
	type ThemeVariables,
	type Unsubscribe,
} from "./theme-types.js";
export type {
	PieThemeSchemeParticipation,
	PieThemeTokenRegistry,
	PieThemeTokenRegistryEntry,
	PieThemeTokenScope,
	PieThemeTokenStatus,
} from "./token-registry-types.js";
export {
	listPieColorSchemes,
	observePieColorSchemes,
	registerPieColorSchemes,
	resolvePieTheme,
} from "./color-schemes.js";

definePieTheme();
