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
	type ThemeMode,
	type ThemeScope,
	type ThemeVariables,
} from "./theme-types.js";
export { DARK_THEME_VARS, LIGHT_THEME_VARS } from "./theme-defaults.js";
export type {
	PieThemeTokenRegistry,
	PieThemeTokenRegistryEntry,
	PieThemeTokenScope,
	PieThemeTokenStatus,
} from "./token-registry-types.js";
export {
	BUILTIN_PIE_COLOR_SCHEMES,
	getPieColorScheme,
	listPieColorSchemes,
	registerPieColorSchemes,
	resolvePieColorSchemeVariables,
	unregisterPieColorScheme,
	type PieColorSchemeDefinition,
	type PieColorSchemePreview,
} from "./color-schemes.js";

definePieTheme();
