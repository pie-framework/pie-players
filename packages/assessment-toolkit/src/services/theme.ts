import type {
	PieColorSchemeName,
	PieThemeMode,
	PieThemeScope,
	PieTokenMap,
} from "@pie-players/pie-players-shared/theming";

export interface ThemeConfig {
	theme?: PieThemeMode;
	scope?: PieThemeScope;
	colorScheme?: PieColorSchemeName;
	variables?: PieTokenMap;
}
