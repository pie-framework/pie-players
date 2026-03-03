import {
	normalizePieThemeVariables,
	type ThemeVariables,
} from "./theme-types.js";

export type PieColorSchemePreview = {
	bg: string;
	text: string;
	primary: string;
};

export type PieColorSchemeDefinition = {
	id: string;
	name: string;
	description?: string;
	variables: ThemeVariables;
	preview?: PieColorSchemePreview;
};

const BUILTIN_SCHEMES: PieColorSchemeDefinition[] = [
	{
		id: "default",
		name: "Default",
		description: "Standard PIE colors",
		variables: {},
		preview: { bg: "#ffffff", text: "#000000", primary: "#3f51b5" },
	},
	{
		id: "black-on-white",
		name: "Black on White",
		description: "High contrast for readability",
		variables: {
			"--pie-background": "#ffffff",
			"--pie-background-dark": "#f5f5f5",
			"--pie-secondary-background": "#eeeeee",
			"--pie-dropdown-background": "#e0e0e0",
			"--pie-text": "#000000",
			"--pie-white": "#ffffff",
			"--pie-black": "#000000",
			"--pie-primary": "#0000cc",
			"--pie-primary-light": "#6666ff",
			"--pie-primary-dark": "#000088",
			"--pie-border": "#000000",
			"--pie-border-light": "#666666",
			"--pie-border-dark": "#000000",
			"--pie-button-bg": "#ffffff",
			"--pie-button-border": "#666666",
			"--pie-button-color": "#000000",
			"--pie-button-hover-bg": "#f5f5f5",
			"--pie-button-hover-border": "#000000",
			"--pie-button-hover-color": "#000000",
			"--pie-button-active-bg": "#eeeeee",
			"--pie-button-focus-outline": "#0000cc",
			"--pie-focus-checked": "#0066ff",
			"--pie-focus-checked-border": "#0000cc",
		},
		preview: { bg: "#ffffff", text: "#000000", primary: "#0000cc" },
	},
	{
		id: "white-on-black",
		name: "White on Black",
		description: "Inverse high contrast",
		variables: {
			"--pie-background": "#000000",
			"--pie-background-dark": "#1a1a1a",
			"--pie-secondary-background": "#222222",
			"--pie-dropdown-background": "#2a2a2a",
			"--pie-text": "#ffffff",
			"--pie-white": "#000000",
			"--pie-black": "#ffffff",
			"--pie-primary": "#ffff00",
			"--pie-primary-light": "#ffff99",
			"--pie-primary-dark": "#cccc00",
			"--pie-border": "#ffffff",
			"--pie-border-light": "#cccccc",
			"--pie-border-dark": "#ffffff",
			"--pie-button-bg": "#000000",
			"--pie-button-border": "#cccccc",
			"--pie-button-color": "#ffffff",
			"--pie-button-hover-bg": "#1a1a1a",
			"--pie-button-hover-border": "#ffffff",
			"--pie-button-hover-color": "#ffffff",
			"--pie-button-active-bg": "#222222",
			"--pie-button-focus-outline": "#ffff00",
			"--pie-focus-checked": "#ffff00",
			"--pie-focus-checked-border": "#ffff00",
		},
		preview: { bg: "#000000", text: "#ffffff", primary: "#ffff00" },
	},
	{
		id: "rose-on-green",
		name: "Rose on Green",
		description: "Color blind friendly (protanopia/deuteranopia)",
		variables: {
			"--pie-background": "#ccffcc",
			"--pie-background-dark": "#aaeedd",
			"--pie-secondary-background": "#99ddbb",
			"--pie-dropdown-background": "#88cc99",
			"--pie-text": "#3d0022",
			"--pie-white": "#ccffcc",
			"--pie-black": "#3d0022",
			"--pie-primary": "#660044",
			"--pie-primary-light": "#cc6699",
			"--pie-primary-dark": "#440033",
			"--pie-border": "#3d0022",
			"--pie-border-light": "#663344",
			"--pie-border-dark": "#220011",
			"--pie-button-bg": "#ccffcc",
			"--pie-button-border": "#663344",
			"--pie-button-color": "#3d0022",
			"--pie-button-hover-bg": "#aaeedd",
			"--pie-button-hover-border": "#3d0022",
			"--pie-button-hover-color": "#3d0022",
			"--pie-button-active-bg": "#99ddbb",
			"--pie-button-focus-outline": "#660044",
			"--pie-focus-checked": "#880055",
			"--pie-focus-checked-border": "#660044",
		},
		preview: { bg: "#ccffcc", text: "#3d0022", primary: "#660044" },
	},
	{
		id: "yellow-on-blue",
		name: "Yellow on Blue",
		description: "Strong contrast scheme",
		variables: {
			"--pie-background": "#000066",
			"--pie-background-dark": "#000055",
			"--pie-secondary-background": "#000044",
			"--pie-dropdown-background": "#000033",
			"--pie-text": "#ffff00",
			"--pie-white": "#000066",
			"--pie-black": "#ffff00",
			"--pie-primary": "#ffff66",
			"--pie-primary-light": "#ffffaa",
			"--pie-primary-dark": "#cccc00",
			"--pie-border": "#ffff00",
			"--pie-border-light": "#aaaa66",
			"--pie-border-dark": "#cccc00",
			"--pie-button-bg": "#000066",
			"--pie-button-border": "#aaaa66",
			"--pie-button-color": "#ffff00",
			"--pie-button-hover-bg": "#000055",
			"--pie-button-hover-border": "#ffff00",
			"--pie-button-hover-color": "#ffff00",
			"--pie-button-active-bg": "#000044",
			"--pie-button-focus-outline": "#ffff66",
			"--pie-focus-checked": "#ffff00",
			"--pie-focus-checked-border": "#cccc00",
		},
		preview: { bg: "#000066", text: "#ffff00", primary: "#ffff66" },
	},
	{
		id: "black-on-rose",
		name: "Black on Rose",
		description: "Warm tinted background",
		variables: {
			"--pie-background": "#ffccdd",
			"--pie-background-dark": "#ffb3cc",
			"--pie-secondary-background": "#ff99bb",
			"--pie-dropdown-background": "#ff88aa",
			"--pie-text": "#000000",
			"--pie-white": "#ffccdd",
			"--pie-black": "#000000",
			"--pie-primary": "#880044",
			"--pie-primary-light": "#dd6699",
			"--pie-primary-dark": "#550033",
			"--pie-border": "#000000",
			"--pie-border-light": "#555555",
			"--pie-border-dark": "#000000",
			"--pie-button-bg": "#ffccdd",
			"--pie-button-border": "#555555",
			"--pie-button-color": "#000000",
			"--pie-button-hover-bg": "#ffb3cc",
			"--pie-button-hover-border": "#000000",
			"--pie-button-hover-color": "#000000",
			"--pie-button-active-bg": "#ff99bb",
			"--pie-button-focus-outline": "#880044",
			"--pie-focus-checked": "#880044",
			"--pie-focus-checked-border": "#550033",
		},
		preview: { bg: "#ffccdd", text: "#000000", primary: "#880044" },
	},
	{
		id: "light-gray-on-dark-gray",
		name: "Light Gray on Dark Gray",
		description: "Reduced brightness for light sensitivity",
		variables: {
			"--pie-background": "#333333",
			"--pie-background-dark": "#2a2a2a",
			"--pie-secondary-background": "#222222",
			"--pie-dropdown-background": "#1a1a1a",
			"--pie-text": "#e0e0e0",
			"--pie-white": "#333333",
			"--pie-black": "#e0e0e0",
			"--pie-primary": "#aaaaaa",
			"--pie-primary-light": "#cccccc",
			"--pie-primary-dark": "#888888",
			"--pie-border": "#e0e0e0",
			"--pie-border-light": "#cccccc",
			"--pie-border-dark": "#ffffff",
			"--pie-button-bg": "#333333",
			"--pie-button-border": "#cccccc",
			"--pie-button-color": "#e0e0e0",
			"--pie-button-hover-bg": "#2a2a2a",
			"--pie-button-hover-border": "#ffffff",
			"--pie-button-hover-color": "#e0e0e0",
			"--pie-button-active-bg": "#222222",
			"--pie-button-focus-outline": "#aaaaaa",
			"--pie-focus-checked": "#cccccc",
			"--pie-focus-checked-border": "#aaaaaa",
		},
		preview: { bg: "#333333", text: "#e0e0e0", primary: "#aaaaaa" },
	},
];

const builtInSchemeMap = new Map(
	BUILTIN_SCHEMES.map((scheme) => [scheme.id, scheme]),
);
const customSchemeMap = new Map<string, PieColorSchemeDefinition>();

function normalizeScheme(
	scheme: PieColorSchemeDefinition,
): PieColorSchemeDefinition | null {
	const id = scheme.id?.trim();
	if (!id) {
		return null;
	}
	const name = scheme.name?.trim() || id;
	const normalizedVars = normalizePieThemeVariables(scheme.variables);
	if (Object.keys(normalizedVars).length === 0 && id !== "default") {
		console.warn(
			`[pie-theme] color scheme "${id}" does not define valid --pie-* variables.`,
		);
	}
	return {
		id,
		name,
		description: scheme.description,
		preview: scheme.preview,
		variables: normalizedVars,
	};
}

export function listPieColorSchemes(): PieColorSchemeDefinition[] {
	return [...builtInSchemeMap.values(), ...customSchemeMap.values()];
}

export function getPieColorScheme(
	schemeId: string | null | undefined,
): PieColorSchemeDefinition | undefined {
	if (!schemeId) {
		return builtInSchemeMap.get("default");
	}
	return customSchemeMap.get(schemeId) ?? builtInSchemeMap.get(schemeId);
}

export function resolvePieColorSchemeVariables(
	schemeId: string | null | undefined,
): ThemeVariables {
	return getPieColorScheme(schemeId)?.variables ?? {};
}

export function registerPieColorSchemes(
	schemes: PieColorSchemeDefinition[],
	options: { overwrite?: boolean } = {},
): void {
	const overwrite = options.overwrite ?? true;
	for (const rawScheme of schemes) {
		const scheme = normalizeScheme(rawScheme);
		if (!scheme) {
			continue;
		}
		if (!overwrite && customSchemeMap.has(scheme.id)) {
			continue;
		}
		customSchemeMap.set(scheme.id, scheme);
	}
}

export function unregisterPieColorScheme(schemeId: string): void {
	if (!schemeId || builtInSchemeMap.has(schemeId)) {
		return;
	}
	customSchemeMap.delete(schemeId);
}

