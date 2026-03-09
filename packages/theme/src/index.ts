import { PieThemeElement, definePieTheme } from "./theme-element.js";

export { PieThemeElement, definePieTheme };
export {
	DAISYUI_THEME_PROVIDER_ADAPTER,
	getPieThemeProvider,
	listPieThemeProviders,
	registerPieThemeProvider,
	resolveProviderVariables,
	unregisterPieThemeProvider,
	type ThemeProviderAdapter,
} from "./providers.js";
export {
	isThemeMode,
	isThemeScope,
	normalizePieThemeVariables,
	type ThemeMode,
	type ThemeScope,
	type ThemeVariables,
} from "./theme-types.js";
export { DARK_THEME_VARS, LIGHT_THEME_VARS } from "./theme-defaults.js";
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
