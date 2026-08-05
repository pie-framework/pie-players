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

export const BUILTIN_PIE_COLOR_SCHEMES: PieColorSchemeDefinition[] = [
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#9c89ec",
			"--pie-annotation-underline-dark": "#9c89ec",
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#9c89ec",
			"--pie-annotation-underline-dark": "#9c89ec",
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
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
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#9c89ec",
			"--pie-annotation-underline-dark": "#9c89ec",
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
	{
		id: "grey-on-light-grey",
		name: "Grey on Light Grey",
		description: "Low-glare neutral palette",
		variables: {
			"--pie-background": "#ebebeb",
			"--pie-background-dark": "#dcdcdc",
			"--pie-secondary-background": "#d0d0d0",
			"--pie-dropdown-background": "#c4c4c4",
			"--pie-text": "#4a4a4a",
			"--pie-white": "#ebebeb",
			"--pie-black": "#4a4a4a",
			"--pie-primary": "#3d3d3d",
			"--pie-primary-light": "#6f6f6f",
			"--pie-primary-dark": "#2b2b2b",
			"--pie-border": "#4a4a4a",
			"--pie-border-light": "#7a7a7a",
			"--pie-border-dark": "#2b2b2b",
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
			"--pie-button-bg": "#ebebeb",
			"--pie-button-border": "#7a7a7a",
			"--pie-button-color": "#4a4a4a",
			"--pie-button-hover-bg": "#dcdcdc",
			"--pie-button-hover-border": "#4a4a4a",
			"--pie-button-hover-color": "#4a4a4a",
			"--pie-button-active-bg": "#d0d0d0",
			"--pie-button-focus-outline": "#3d3d3d",
			"--pie-focus-checked": "#6f6f6f",
			"--pie-focus-checked-border": "#3d3d3d",
		},
		preview: { bg: "#ebebeb", text: "#4a4a4a", primary: "#3d3d3d" },
	},
	{
		id: "purple-on-light-green",
		name: "Purple on Light Green",
		description: "Color blind friendly, low-glare background",
		variables: {
			"--pie-background": "#cce8d4",
			"--pie-background-dark": "#b8dcc3",
			"--pie-secondary-background": "#a6d0b2",
			"--pie-dropdown-background": "#94c4a1",
			"--pie-text": "#8e2464",
			"--pie-white": "#cce8d4",
			"--pie-black": "#8e2464",
			"--pie-primary": "#6d1a4c",
			"--pie-primary-light": "#b3608e",
			"--pie-primary-dark": "#4f1237",
			"--pie-border": "#8e2464",
			"--pie-border-light": "#a85a86",
			"--pie-border-dark": "#4f1237",
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
			"--pie-button-bg": "#cce8d4",
			"--pie-button-border": "#a85a86",
			"--pie-button-color": "#8e2464",
			"--pie-button-hover-bg": "#b8dcc3",
			"--pie-button-hover-border": "#8e2464",
			"--pie-button-hover-color": "#8e2464",
			"--pie-button-active-bg": "#a6d0b2",
			"--pie-button-focus-outline": "#6d1a4c",
			"--pie-focus-checked": "#8e2464",
			"--pie-focus-checked-border": "#6d1a4c",
		},
		preview: { bg: "#cce8d4", text: "#8e2464", primary: "#6d1a4c" },
	},
	{
		id: "black-on-violet",
		name: "Black on Violet",
		description: "Cool tinted background",
		variables: {
			"--pie-background": "#d4a9de",
			"--pie-background-dark": "#c795d3",
			"--pie-secondary-background": "#b982c8",
			"--pie-dropdown-background": "#ac70bd",
			"--pie-text": "#000000",
			"--pie-white": "#d4a9de",
			"--pie-black": "#000000",
			"--pie-primary": "#4a1259",
			"--pie-primary-light": "#8e4fa1",
			"--pie-primary-dark": "#330d3f",
			"--pie-border": "#000000",
			"--pie-border-light": "#4a4a4a",
			"--pie-border-dark": "#000000",
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "#4221d5",
			"--pie-annotation-underline-dark": "#4221d5",
			"--pie-button-bg": "#d4a9de",
			"--pie-button-border": "#4a4a4a",
			"--pie-button-color": "#000000",
			"--pie-button-hover-bg": "#c795d3",
			"--pie-button-hover-border": "#000000",
			"--pie-button-hover-color": "#000000",
			"--pie-button-active-bg": "#b982c8",
			"--pie-button-focus-outline": "#4a1259",
			"--pie-focus-checked": "#4a1259",
			"--pie-focus-checked-border": "#330d3f",
		},
		preview: { bg: "#d4a9de", text: "#000000", primary: "#4a1259" },
	},
	{
		id: "yellow-on-navy",
		name: "Yellow on Navy",
		description: "Strong contrast on a softened dark blue",
		variables: {
			"--pie-background": "#33508a",
			"--pie-background-dark": "#2b4576",
			"--pie-secondary-background": "#243a63",
			"--pie-dropdown-background": "#1d2f50",
			"--pie-text": "#ffff55",
			"--pie-white": "#33508a",
			"--pie-black": "#ffff55",
			"--pie-primary": "#ffff99",
			"--pie-primary-light": "#ffffc2",
			"--pie-primary-dark": "#e0e04a",
			"--pie-border": "#ffff55",
			"--pie-border-light": "#c2c266",
			"--pie-border-dark": "#e0e04a",
			"--pie-tool-annotation-toolbar-border": "var(--pie-border)",
			"--pie-annotation-underline": "var(--pie-primary)",
			"--pie-annotation-underline-dark": "var(--pie-primary)",
			"--pie-button-bg": "#33508a",
			"--pie-button-border": "#c2c266",
			"--pie-button-color": "#ffff55",
			"--pie-button-hover-bg": "#2b4576",
			"--pie-button-hover-border": "#ffff55",
			"--pie-button-hover-color": "#ffff55",
			"--pie-button-active-bg": "#243a63",
			"--pie-button-focus-outline": "#ffff99",
			"--pie-focus-checked": "#ffff55",
			"--pie-focus-checked-border": "#e0e04a",
		},
		preview: { bg: "#33508a", text: "#ffff55", primary: "#ffff99" },
	},
];

const builtInSchemeMap = new Map(
	BUILTIN_PIE_COLOR_SCHEMES.map((scheme) => [scheme.id, scheme]),
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
