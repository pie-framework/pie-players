import { PIE_THEME_SCHEME_PARTICIPATION } from "./scheme-participation.js";
import type { PieThemeSchemeParticipation } from "./token-registry-types.js";
import type {
	PieColorSchemeDescriptor,
	PieColorSchemePreview,
	PieThemeDiagnostic,
	ThemeTokenName,
	ThemeVariables,
} from "./theme-types.js";

type BuiltInColorSchemeDefinition = Readonly<{
	id: string;
	name: string;
	description?: string;
	variables: Readonly<ThemeVariables>;
}>;

type ThemeContrastRelationship = Readonly<{
	foreground: ThemeTokenName;
	background: ThemeTokenName;
	minimum: 3 | 4.5;
	role: string;
}>;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		for (const child of Object.values(value as Record<string, unknown>)) {
			deepFreeze(child);
		}
		Object.freeze(value);
	}
	return value;
}

const LIGHT_BASE_THEME: ThemeVariables = {
	"--pie-text": "black",
	"--pie-disabled": "grey",
	"--pie-disabled-secondary": "#ababab",
	"--pie-correct": "#208537",
	"--pie-correct-secondary": "#e8f5e9",
	"--pie-correct-tertiary": "#087d38",
	"--pie-correct-icon": "#087d38",
	"--pie-incorrect": "#a65f00",
	"--pie-content-emphasis": "#b00000",
	"--pie-incorrect-secondary": "#ffebee",
	"--pie-incorrect-icon": "#bf0d00",
	"--pie-missing": "#d32f2f",
	"--pie-missing-icon": "#6a78a1",
	"--pie-primary": "#3f51b5",
	"--pie-primary-light": "#9fa8da",
	"--pie-primary-dark": "#283593",
	"--pie-faded-primary": "#dcdafb",
	"--pie-secondary": "#f50057",
	"--pie-secondary-light": "#f48fb1",
	"--pie-secondary-dark": "#880e4f",
	"--pie-tertiary": "#146eb3",
	"--pie-tertiary-light": "#d0e2f0",
	"--pie-background": "rgba(255, 255, 255, 0)",
	"--pie-background-dark": "#ecedf1",
	"--pie-secondary-background": "rgba(241, 241, 241, 1)",
	"--pie-dropdown-background": "#e0e1e6",
	"--pie-border": "#8f8f8f",
	"--pie-border-light": "#d1d1d1",
	"--pie-border-dark": "#646464",
	"--pie-border-gray": "#7e8494",
	"--pie-black": "#000000",
	"--pie-white": "#ffffff",
	"--pie-focus-checked": "#bbdefb",
	"--pie-focus-checked-border": "#1565c0",
	"--pie-focus-unchecked": "#e0e0e0",
	"--pie-focus-unchecked-border": "#757575",
	"--pie-blue-grey-100": "#f3f5f7",
	"--pie-blue-grey-300": "#c0c3cf",
	"--pie-blue-grey-600": "#7e8494",
	"--pie-blue-grey-900": "#152452",
	"--pie-font-scale": "1",
	"--pie-button-bg": "#ffffff",
	"--pie-button-border": "#8f8f8f",
	"--pie-button-color": "#374151",
	"--pie-button-hover-bg": "#f9fafb",
	"--pie-button-hover-border": "#8b919c",
	"--pie-button-hover-color": "#111827",
	"--pie-button-active-bg": "#f3f4f6",
	"--pie-button-focus-outline": "#3b82f6",
	// Share by which a component's own fixed hues collapse into the palette. A
	// Base Theme keeps them, because it is a full palette and a hue encoding
	// still reads against it; every scheme below sets 100%, because a
	// two-colour palette is a promise the whole surface has to keep.
	"--pie-fixed-hue-collapse": "0%",
};

// The three component-public accessibility tokens participate in built-in
// schemes, but are not canonical semantic defaults in the published registry.
const LIGHT_BASE_ACCESSIBILITY_VARS: ThemeVariables = {
	"--pie-annotation-underline": "#4221d5",
	"--pie-annotation-underline-dark": "#9c89ec",
	"--pie-tool-annotation-toolbar-border": "#5c5c5c",
};

const DARK_BASE_THEME: ThemeVariables = {
	"--pie-text": "#ffffff",
	"--pie-disabled": "#999999",
	"--pie-disabled-secondary": "#777777",
	"--pie-correct": "#00ff00",
	"--pie-correct-secondary": "#003300",
	"--pie-correct-tertiary": "#00cc00",
	"--pie-correct-icon": "#00ff00",
	"--pie-incorrect": "#ff3333",
	"--pie-content-emphasis": "#ff6666",
	"--pie-incorrect-secondary": "#330000",
	"--pie-incorrect-icon": "#ff0000",
	"--pie-missing": "#ff6666",
	"--pie-missing-icon": "#6666ff",
	"--pie-primary": "#ffff00",
	"--pie-primary-light": "#ffff99",
	"--pie-primary-dark": "#cccc00",
	"--pie-faded-primary": "#666600",
	"--pie-secondary": "#ff00ff",
	"--pie-secondary-light": "#ff99ff",
	"--pie-secondary-dark": "#cc00cc",
	"--pie-tertiary": "#00ffff",
	"--pie-tertiary-light": "#99ffff",
	"--pie-background": "#000000",
	"--pie-background-dark": "#1a1a1a",
	"--pie-secondary-background": "#222222",
	"--pie-dropdown-background": "#2a2a2a",
	"--pie-border": "#ffffff",
	"--pie-border-light": "#cccccc",
	"--pie-border-dark": "#ffffff",
	"--pie-border-gray": "#aaaaaa",
	"--pie-black": "#ffffff",
	"--pie-white": "#000000",
	"--pie-focus-checked": "#ffff00",
	"--pie-focus-checked-border": "#ffff00",
	"--pie-focus-unchecked": "#666666",
	"--pie-focus-unchecked-border": "#ffffff",
	"--pie-blue-grey-100": "#2a2a2a",
	"--pie-blue-grey-300": "#555555",
	"--pie-blue-grey-600": "#999999",
	"--pie-blue-grey-900": "#ffffff",
	"--pie-font-scale": "1",
	"--pie-button-bg": "#1f2937",
	"--pie-button-border": "#535e6d",
	"--pie-button-color": "#f9fafb",
	"--pie-button-hover-bg": "#374151",
	"--pie-button-hover-border": "#6b7280",
	"--pie-button-hover-color": "#ffffff",
	"--pie-button-active-bg": "#4b5563",
	"--pie-button-focus-outline": "#93c5fd",
	"--pie-fixed-hue-collapse": "0%",
};

const DARK_BASE_ACCESSIBILITY_VARS: ThemeVariables = {
	"--pie-annotation-underline": "#9c89ec",
	"--pie-annotation-underline-dark": "#9c89ec",
	"--pie-tool-annotation-toolbar-border": "#949494",
};

const BASE_THEMES = deepFreeze({
	light: { ...LIGHT_BASE_THEME, ...LIGHT_BASE_ACCESSIBILITY_VARS },
	dark: { ...DARK_BASE_THEME, ...DARK_BASE_ACCESSIBILITY_VARS },
});

const BUILT_IN_COLOR_SCHEMES: readonly BuiltInColorSchemeDefinition[] =
	deepFreeze([
		{
			id: "black-on-white",
			name: "Black on White",
			description: "High contrast for readability",
			variables: {
				"--pie-text": "#000000",
				"--pie-disabled": "#666666",
				"--pie-disabled-secondary": "#888888",
				"--pie-correct": "#006600",
				"--pie-correct-secondary": "#ccffcc",
				"--pie-correct-tertiary": "#008800",
				"--pie-correct-icon": "#004400",
				"--pie-incorrect": "#cc0000",
				"--pie-content-emphasis": "#cc0000",
				"--pie-incorrect-secondary": "#ffcccc",
				"--pie-incorrect-icon": "#990000",
				"--pie-missing": "#cc0000",
				"--pie-missing-icon": "#000099",
				"--pie-primary": "#0000cc",
				"--pie-primary-light": "#6666ff",
				"--pie-primary-dark": "#000088",
				"--pie-faded-primary": "#ccccff",
				"--pie-secondary": "#cc0066",
				"--pie-secondary-light": "#ff99cc",
				"--pie-secondary-dark": "#990044",
				"--pie-tertiary": "#006699",
				"--pie-tertiary-light": "#99ccff",
				"--pie-background": "#ffffff",
				"--pie-background-dark": "#f5f5f5",
				"--pie-secondary-background": "#eeeeee",
				"--pie-dropdown-background": "#e0e0e0",
				"--pie-border": "#000000",
				"--pie-border-light": "#666666",
				"--pie-border-dark": "#000000",
				"--pie-border-gray": "#555555",
				"--pie-black": "#000000",
				"--pie-white": "#ffffff",
				"--pie-focus-checked": "#0066ff",
				"--pie-focus-checked-border": "#0000cc",
				"--pie-focus-unchecked": "#cccccc",
				"--pie-focus-unchecked-border": "#000000",
				"--pie-blue-grey-100": "#f5f5f5",
				"--pie-blue-grey-300": "#cccccc",
				"--pie-blue-grey-600": "#666666",
				"--pie-blue-grey-900": "#000000",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "white-on-black",
			name: "White on Black",
			description: "Inverse high contrast",
			variables: {
				"--pie-text": "#ffffff",
				"--pie-disabled": "#999999",
				"--pie-disabled-secondary": "#777777",
				"--pie-correct": "#00ff00",
				"--pie-correct-secondary": "#003300",
				"--pie-correct-tertiary": "#00cc00",
				"--pie-correct-icon": "#00ff00",
				"--pie-incorrect": "#ff3333",
				"--pie-content-emphasis": "#ff3333",
				"--pie-incorrect-secondary": "#330000",
				"--pie-incorrect-icon": "#ff0000",
				"--pie-missing": "#ff6666",
				"--pie-missing-icon": "#6666ff",
				"--pie-primary": "#ffff00",
				"--pie-primary-light": "#ffff99",
				"--pie-primary-dark": "#cccc00",
				"--pie-faded-primary": "#666600",
				"--pie-secondary": "#ff00ff",
				"--pie-secondary-light": "#ff99ff",
				"--pie-secondary-dark": "#cc00cc",
				"--pie-tertiary": "#00ffff",
				"--pie-tertiary-light": "#99ffff",
				"--pie-background": "#000000",
				"--pie-background-dark": "#1a1a1a",
				"--pie-secondary-background": "#222222",
				"--pie-dropdown-background": "#2a2a2a",
				"--pie-border": "#ffffff",
				"--pie-border-light": "#cccccc",
				"--pie-border-dark": "#ffffff",
				"--pie-border-gray": "#aaaaaa",
				"--pie-black": "#ffffff",
				"--pie-white": "#000000",
				"--pie-focus-checked": "#ffff00",
				"--pie-focus-checked-border": "#ffff00",
				"--pie-focus-unchecked": "#666666",
				"--pie-focus-unchecked-border": "#ffffff",
				"--pie-blue-grey-100": "#2a2a2a",
				"--pie-blue-grey-300": "#555555",
				"--pie-blue-grey-600": "#999999",
				"--pie-blue-grey-900": "#ffffff",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "rose-on-green",
			name: "Rose on Green",
			description: "Color blind friendly (protanopia/deuteranopia)",
			variables: {
				"--pie-text": "#3d0022",
				"--pie-disabled": "#996677",
				"--pie-disabled-secondary": "#bb8899",
				"--pie-correct": "#004400",
				"--pie-correct-secondary": "#aaffaa",
				"--pie-correct-tertiary": "#006600",
				"--pie-correct-icon": "#003300",
				"--pie-incorrect": "#aa0044",
				"--pie-content-emphasis": "#aa0044",
				"--pie-incorrect-secondary": "#ffccdd",
				"--pie-incorrect-icon": "#880033",
				"--pie-missing": "#aa0044",
				"--pie-missing-icon": "#440044",
				"--pie-primary": "#660044",
				"--pie-primary-light": "#cc6699",
				"--pie-primary-dark": "#440033",
				"--pie-faded-primary": "#ddbbcc",
				"--pie-secondary": "#880055",
				"--pie-secondary-light": "#dd99bb",
				"--pie-secondary-dark": "#550033",
				"--pie-tertiary": "#770044",
				"--pie-tertiary-light": "#dd99bb",
				"--pie-background": "#ccffcc",
				"--pie-background-dark": "#aaeedd",
				"--pie-secondary-background": "#99ddbb",
				"--pie-dropdown-background": "#88cc99",
				"--pie-border": "#3d0022",
				"--pie-border-light": "#663344",
				"--pie-border-dark": "#220011",
				"--pie-border-gray": "#664455",
				"--pie-black": "#3d0022",
				"--pie-white": "#ccffcc",
				"--pie-focus-checked": "#880055",
				"--pie-focus-checked-border": "#660044",
				"--pie-focus-unchecked": "#aaddbb",
				"--pie-focus-unchecked-border": "#3d0022",
				"--pie-blue-grey-100": "#ccffdd",
				"--pie-blue-grey-300": "#99ddbb",
				"--pie-blue-grey-600": "#668877",
				"--pie-blue-grey-900": "#3d0022",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "yellow-on-blue",
			name: "Yellow on Blue",
			description: "Strong contrast scheme",
			variables: {
				"--pie-text": "#ffff00",
				"--pie-disabled": "#9999aa",
				"--pie-disabled-secondary": "#aaaacc",
				"--pie-correct": "#00ff00",
				"--pie-correct-secondary": "#003333",
				"--pie-correct-tertiary": "#00cc00",
				"--pie-correct-icon": "#00ff00",
				"--pie-incorrect": "#ff6666",
				"--pie-content-emphasis": "#ff6666",
				"--pie-incorrect-secondary": "#331111",
				"--pie-incorrect-icon": "#ff3333",
				"--pie-missing": "#ff6666",
				"--pie-missing-icon": "#99ff99",
				"--pie-primary": "#ffff66",
				"--pie-primary-light": "#ffffaa",
				"--pie-primary-dark": "#cccc00",
				"--pie-faded-primary": "#666633",
				"--pie-secondary": "#ffaa00",
				"--pie-secondary-light": "#ffcc66",
				"--pie-secondary-dark": "#cc8800",
				"--pie-tertiary": "#ffee00",
				"--pie-tertiary-light": "#ffff99",
				"--pie-background": "#000066",
				"--pie-background-dark": "#000055",
				"--pie-secondary-background": "#000044",
				"--pie-dropdown-background": "#000033",
				"--pie-border": "#ffff00",
				"--pie-border-light": "#aaaa66",
				"--pie-border-dark": "#cccc00",
				"--pie-border-gray": "#8888aa",
				"--pie-black": "#ffff00",
				"--pie-white": "#000066",
				"--pie-focus-checked": "#ffff00",
				"--pie-focus-checked-border": "#cccc00",
				"--pie-focus-unchecked": "#333366",
				"--pie-focus-unchecked-border": "#ffff00",
				"--pie-blue-grey-100": "#000055",
				"--pie-blue-grey-300": "#333377",
				"--pie-blue-grey-600": "#6666aa",
				"--pie-blue-grey-900": "#ffff00",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "black-on-rose",
			name: "Black on Rose",
			description: "Warm tinted background",
			variables: {
				"--pie-text": "#000000",
				"--pie-disabled": "#666666",
				"--pie-disabled-secondary": "#888888",
				"--pie-correct": "#006600",
				"--pie-correct-secondary": "#ccffcc",
				"--pie-correct-tertiary": "#007000",
				"--pie-correct-icon": "#004400",
				"--pie-incorrect": "#990000",
				"--pie-content-emphasis": "#990000",
				"--pie-incorrect-secondary": "#ffdddd",
				"--pie-incorrect-icon": "#770000",
				"--pie-missing": "#990000",
				"--pie-missing-icon": "#000099",
				"--pie-primary": "#880044",
				"--pie-primary-light": "#dd6699",
				"--pie-primary-dark": "#550033",
				"--pie-faded-primary": "#ffccdd",
				"--pie-secondary": "#aa0055",
				"--pie-secondary-light": "#ff99cc",
				"--pie-secondary-dark": "#770033",
				"--pie-tertiary": "#990044",
				"--pie-tertiary-light": "#ffaacc",
				"--pie-background": "#ffccdd",
				"--pie-background-dark": "#ffb3cc",
				"--pie-secondary-background": "#ff99bb",
				"--pie-dropdown-background": "#ff88aa",
				"--pie-border": "#000000",
				"--pie-border-light": "#555555",
				"--pie-border-dark": "#000000",
				"--pie-border-gray": "#444444",
				"--pie-black": "#000000",
				"--pie-white": "#ffccdd",
				"--pie-focus-checked": "#880044",
				"--pie-focus-checked-border": "#550033",
				"--pie-focus-unchecked": "#ffddee",
				"--pie-focus-unchecked-border": "#000000",
				"--pie-blue-grey-100": "#ffeef5",
				"--pie-blue-grey-300": "#ffccdd",
				"--pie-blue-grey-600": "#cc6688",
				"--pie-blue-grey-900": "#000000",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "light-gray-on-dark-gray",
			name: "Light Gray on Dark Gray",
			description: "Reduced brightness for light sensitivity",
			variables: {
				"--pie-text": "#e0e0e0",
				"--pie-disabled": "#999999",
				"--pie-disabled-secondary": "#888888",
				"--pie-correct": "#00cc00",
				"--pie-correct-secondary": "#003300",
				"--pie-correct-tertiary": "#00bb00",
				"--pie-correct-icon": "#00ff00",
				"--pie-incorrect": "#ff6a6a",
				"--pie-content-emphasis": "#ff6a6a",
				"--pie-incorrect-secondary": "#331111",
				"--pie-incorrect-icon": "#ff0000",
				"--pie-missing": "#ff6a6a",
				"--pie-missing-icon": "#6868ff",
				"--pie-primary": "#aaaaaa",
				"--pie-primary-light": "#cccccc",
				"--pie-primary-dark": "#888888",
				"--pie-faded-primary": "#555555",
				"--pie-secondary": "#bbbbbb",
				"--pie-secondary-light": "#dddddd",
				"--pie-secondary-dark": "#999999",
				"--pie-tertiary": "#cccccc",
				"--pie-tertiary-light": "#eeeeee",
				"--pie-background": "#333333",
				"--pie-background-dark": "#2a2a2a",
				"--pie-secondary-background": "#222222",
				"--pie-dropdown-background": "#1a1a1a",
				"--pie-border": "#e0e0e0",
				"--pie-border-light": "#cccccc",
				"--pie-border-dark": "#ffffff",
				"--pie-border-gray": "#aaaaaa",
				"--pie-black": "#e0e0e0",
				"--pie-white": "#333333",
				"--pie-focus-checked": "#cccccc",
				"--pie-focus-checked-border": "#aaaaaa",
				"--pie-focus-unchecked": "#555555",
				"--pie-focus-unchecked-border": "#e0e0e0",
				"--pie-blue-grey-100": "#2a2a2a",
				"--pie-blue-grey-300": "#555555",
				"--pie-blue-grey-600": "#999999",
				"--pie-blue-grey-900": "#e0e0e0",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "grey-on-light-grey",
			name: "Grey on Light Grey",
			description: "Low-glare neutral palette",
			variables: {
				"--pie-text": "#4a4a4a",
				"--pie-disabled": "#757575",
				"--pie-disabled-secondary": "#8f8f8f",
				"--pie-correct": "#145c1e",
				"--pie-correct-secondary": "#dde9de",
				"--pie-correct-tertiary": "#1a7526",
				"--pie-correct-icon": "#0e3f15",
				"--pie-incorrect": "#8c1c1c",
				"--pie-content-emphasis": "#8c1c1c",
				"--pie-incorrect-secondary": "#eddcdc",
				"--pie-incorrect-icon": "#6f1616",
				"--pie-missing": "#8c1c1c",
				"--pie-missing-icon": "#33406b",
				"--pie-primary": "#3d3d3d",
				"--pie-primary-light": "#6f6f6f",
				"--pie-primary-dark": "#2b2b2b",
				"--pie-faded-primary": "#dcdcdc",
				"--pie-secondary": "#4a4a4a",
				"--pie-secondary-light": "#8f8f8f",
				"--pie-secondary-dark": "#2b2b2b",
				"--pie-tertiary": "#3d3d3d",
				"--pie-tertiary-light": "#c4c4c4",
				"--pie-background": "#ebebeb",
				"--pie-background-dark": "#dcdcdc",
				"--pie-secondary-background": "#d0d0d0",
				"--pie-dropdown-background": "#c4c4c4",
				"--pie-border": "#4a4a4a",
				"--pie-border-light": "#7a7a7a",
				"--pie-border-dark": "#2b2b2b",
				"--pie-border-gray": "#6f6f6f",
				"--pie-black": "#4a4a4a",
				"--pie-white": "#ebebeb",
				"--pie-focus-checked": "#6f6f6f",
				"--pie-focus-checked-border": "#3d3d3d",
				"--pie-focus-unchecked": "#e0e0e0",
				"--pie-focus-unchecked-border": "#4a4a4a",
				"--pie-blue-grey-100": "#f0f0f0",
				"--pie-blue-grey-300": "#d0d0d0",
				"--pie-blue-grey-600": "#6f6f6f",
				"--pie-blue-grey-900": "#2b2b2b",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "purple-on-light-green",
			name: "Purple on Light Green",
			description: "Color blind friendly, low-glare background",
			variables: {
				"--pie-text": "#8e2464",
				"--pie-disabled": "#5f7266",
				"--pie-disabled-secondary": "#7c8f83",
				"--pie-correct": "#14591f",
				"--pie-correct-secondary": "#d8ecdc",
				"--pie-correct-tertiary": "#1a7328",
				"--pie-correct-icon": "#0e3d16",
				"--pie-incorrect": "#8c1c1c",
				"--pie-content-emphasis": "#8c1c1c",
				"--pie-incorrect-secondary": "#f0dcdc",
				"--pie-incorrect-icon": "#6f1616",
				"--pie-missing": "#8c1c1c",
				"--pie-missing-icon": "#33406b",
				"--pie-primary": "#6d1a4c",
				"--pie-primary-light": "#b3608e",
				"--pie-primary-dark": "#4f1237",
				"--pie-faded-primary": "#b8dcc3",
				"--pie-secondary": "#a02b72",
				"--pie-secondary-light": "#c76d9d",
				"--pie-secondary-dark": "#6d1a4c",
				"--pie-tertiary": "#8e2464",
				"--pie-tertiary-light": "#e2c6d5",
				"--pie-background": "#cce8d4",
				"--pie-background-dark": "#b8dcc3",
				"--pie-secondary-background": "#a6d0b2",
				"--pie-dropdown-background": "#94c4a1",
				"--pie-border": "#8e2464",
				"--pie-border-light": "#a85a86",
				"--pie-border-dark": "#4f1237",
				"--pie-border-gray": "#5f7266",
				"--pie-black": "#8e2464",
				"--pie-white": "#cce8d4",
				"--pie-focus-checked": "#8e2464",
				"--pie-focus-checked-border": "#6d1a4c",
				"--pie-focus-unchecked": "#dcefe2",
				"--pie-focus-unchecked-border": "#8e2464",
				"--pie-blue-grey-100": "#e2f2e7",
				"--pie-blue-grey-300": "#a6d0b2",
				"--pie-blue-grey-600": "#5f7266",
				"--pie-blue-grey-900": "#4f1237",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "black-on-violet",
			name: "Black on Violet",
			description: "Cool tinted background",
			variables: {
				"--pie-text": "#000000",
				"--pie-disabled": "#5c5c5c",
				"--pie-disabled-secondary": "#7a7a7a",
				"--pie-correct": "#0d4f16",
				"--pie-correct-secondary": "#e0cfe6",
				"--pie-correct-tertiary": "#0f4d17",
				"--pie-correct-icon": "#093a0f",
				"--pie-incorrect": "#7d1414",
				"--pie-content-emphasis": "#7d1414",
				"--pie-incorrect-secondary": "#eccfd0",
				"--pie-incorrect-icon": "#5c0f0f",
				"--pie-missing": "#7d1414",
				"--pie-missing-icon": "#2b2b6b",
				"--pie-primary": "#4a1259",
				"--pie-primary-light": "#8e4fa1",
				"--pie-primary-dark": "#330d3f",
				"--pie-faded-primary": "#c795d3",
				"--pie-secondary": "#6d1a7d",
				"--pie-secondary-light": "#a95cb8",
				"--pie-secondary-dark": "#4a1259",
				"--pie-tertiary": "#4a1259",
				"--pie-tertiary-light": "#e2cbe8",
				"--pie-background": "#d4a9de",
				"--pie-background-dark": "#c795d3",
				"--pie-secondary-background": "#b982c8",
				"--pie-dropdown-background": "#ac70bd",
				"--pie-border": "#000000",
				"--pie-border-light": "#4a4a4a",
				"--pie-border-dark": "#000000",
				"--pie-border-gray": "#4a4a4a",
				"--pie-black": "#000000",
				"--pie-white": "#d4a9de",
				"--pie-focus-checked": "#4a1259",
				"--pie-focus-checked-border": "#330d3f",
				"--pie-focus-unchecked": "#e2cbe8",
				"--pie-focus-unchecked-border": "#000000",
				"--pie-blue-grey-100": "#ece0f0",
				"--pie-blue-grey-300": "#c795d3",
				"--pie-blue-grey-600": "#6d5c73",
				"--pie-blue-grey-900": "#000000",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
		{
			id: "yellow-on-navy",
			name: "Yellow on Navy",
			description: "Strong contrast on a softened dark blue",
			variables: {
				"--pie-text": "#ffff55",
				"--pie-disabled": "#9aa4bd",
				"--pie-disabled-secondary": "#7d88a3",
				"--pie-correct": "#7fe08a",
				"--pie-correct-secondary": "#1d3a24",
				"--pie-correct-tertiary": "#a0dda9",
				"--pie-correct-icon": "#a8f0b0",
				"--pie-incorrect": "#ffbebe",
				"--pie-content-emphasis": "#ffbebe",
				"--pie-incorrect-secondary": "#3d1d1d",
				"--pie-incorrect-icon": "#ffb3b3",
				"--pie-missing": "#ffbebe",
				"--pie-missing-icon": "#b3c2ff",
				"--pie-primary": "#ffff99",
				"--pie-primary-light": "#ffffc2",
				"--pie-primary-dark": "#e0e04a",
				"--pie-faded-primary": "#2b4576",
				"--pie-secondary": "#ffd95c",
				"--pie-secondary-light": "#ffeaa0",
				"--pie-secondary-dark": "#e0bb3d",
				"--pie-tertiary": "#ffff99",
				"--pie-tertiary-light": "#ffffcc",
				"--pie-background": "#33508a",
				"--pie-background-dark": "#2b4576",
				"--pie-secondary-background": "#243a63",
				"--pie-dropdown-background": "#1d2f50",
				"--pie-border": "#ffff55",
				"--pie-border-light": "#c2c266",
				"--pie-border-dark": "#e0e04a",
				"--pie-border-gray": "#9aa4bd",
				"--pie-black": "#ffff55",
				"--pie-white": "#33508a",
				"--pie-focus-checked": "#ffff55",
				"--pie-focus-checked-border": "#e0e04a",
				"--pie-focus-unchecked": "#243a63",
				"--pie-focus-unchecked-border": "#ffff55",
				"--pie-blue-grey-100": "#2b4576",
				"--pie-blue-grey-300": "#4a6aa8",
				"--pie-blue-grey-600": "#9aa4bd",
				"--pie-blue-grey-900": "#ffff55",
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
				"--pie-fixed-hue-collapse": "100%",
			},
		},
	]);

const BUILT_IN_SCHEMES_BY_ID = new Map(
	BUILT_IN_COLOR_SCHEMES.map((scheme) => [scheme.id, scheme]),
);

const DEFAULT_SCHEME_DESCRIPTOR: PieColorSchemeDescriptor = deepFreeze({
	id: "default",
	name: "Default",
	description: "Standard PIE colors",
	kind: "default",
	preview: createPieColorSchemePreview({
		...LIGHT_BASE_THEME,
		// The live light Base Theme intentionally reveals its host surface. A
		// catalog swatch has no such surface, so composite it on white explicitly.
		"--pie-background": "#ffffff",
	}),
});

const REQUIRED_SCHEME_TOKENS = Object.freeze(
	Object.entries(PIE_THEME_SCHEME_PARTICIPATION)
		.filter(([, participation]) => participation === "required")
		.map(([token]) => token as ThemeTokenName)
		.sort(),
);

const OPTIONAL_SCHEME_TOKENS = Object.freeze(
	Object.entries(PIE_THEME_SCHEME_PARTICIPATION)
		.filter(([, participation]) => participation === "optional")
		.map(([token]) => token as ThemeTokenName)
		.sort(),
);

/**
 * Named semantic relationships are the accessibility contract. Token names
 * alone do not say whether a color is text, a fill, or a boundary.
 */
const PIE_THEME_CONTRAST_RELATIONSHIPS: readonly ThemeContrastRelationship[] =
	deepFreeze([
		{
			foreground: "--pie-text",
			background: "--pie-background",
			minimum: 4.5,
			role: "ordinary text",
		},
		{
			// Where a fixed hue collapses to: a component folding its own encoding
			// into the palette lands on this surface with this ink, so the pair has
			// to hold on its own and not only against the page.
			foreground: "--pie-text",
			background: "--pie-background-dark",
			minimum: 4.5,
			role: "recessed surface text",
		},
		{
			foreground: "--pie-tertiary",
			background: "--pie-background",
			minimum: 4.5,
			role: "link text",
		},
		{
			foreground: "--pie-correct",
			background: "--pie-background",
			minimum: 4.5,
			role: "correct feedback text",
		},
		{
			foreground: "--pie-correct-tertiary",
			background: "--pie-background",
			minimum: 4.5,
			role: "correct feedback text",
		},
		{
			foreground: "--pie-incorrect",
			background: "--pie-background",
			minimum: 4.5,
			role: "incorrect feedback text",
		},
		{
			foreground: "--pie-missing",
			background: "--pie-background",
			minimum: 4.5,
			role: "missing-response text",
		},
		{
			foreground: "--pie-correct-icon",
			background: "--pie-background",
			minimum: 3,
			role: "correct feedback icon",
		},
		{
			foreground: "--pie-incorrect-icon",
			background: "--pie-background",
			minimum: 3,
			role: "incorrect feedback icon",
		},
		{
			foreground: "--pie-missing-icon",
			background: "--pie-background",
			minimum: 3,
			role: "missing-response icon",
		},
		{
			foreground: "--pie-border",
			background: "--pie-background",
			minimum: 3,
			role: "control boundary",
		},
		{
			foreground: "--pie-focus-checked-border",
			background: "--pie-background",
			minimum: 3,
			role: "checked-control focus boundary",
		},
		{
			foreground: "--pie-focus-unchecked-border",
			background: "--pie-background",
			minimum: 3,
			role: "unchecked-control focus boundary",
		},
		{
			foreground: "--pie-button-color",
			background: "--pie-button-bg",
			minimum: 4.5,
			role: "button text",
		},
		{
			foreground: "--pie-button-color",
			background: "--pie-button-active-bg",
			minimum: 4.5,
			role: "active button text",
		},
		{
			foreground: "--pie-button-border",
			background: "--pie-background",
			minimum: 3,
			role: "button boundary",
		},
		{
			foreground: "--pie-button-hover-color",
			background: "--pie-button-hover-bg",
			minimum: 4.5,
			role: "hovered button text",
		},
		{
			foreground: "--pie-button-hover-border",
			background: "--pie-background",
			minimum: 3,
			role: "hovered button boundary",
		},
		{
			foreground: "--pie-button-focus-outline",
			background: "--pie-background",
			minimum: 3,
			role: "button focus indicator",
		},
		{
			foreground: "--pie-button-focus-outline",
			background: "--pie-button-bg",
			minimum: 3,
			role: "button focus indicator against its control",
		},
		{
			foreground: "--pie-button-focus-outline",
			background: "--pie-button-hover-bg",
			minimum: 3,
			role: "hovered button focus indicator",
		},
		{
			foreground: "--pie-button-focus-outline",
			background: "--pie-button-active-bg",
			minimum: 3,
			role: "active button focus indicator",
		},
		{
			foreground: "--pie-annotation-underline",
			background: "--pie-background",
			minimum: 3,
			role: "annotation underline",
		},
		{
			foreground: "--pie-tool-annotation-toolbar-border",
			background: "--pie-background",
			minimum: 3,
			role: "annotation toolbar boundary",
		},
	]);

type Rgb = Readonly<{ r: number; g: number; b: number }>;

function parseOpaqueColor(value: string): Rgb | null {
	const normalized = value.trim().toLowerCase();
	if (normalized === "black") return { r: 0, g: 0, b: 0 };
	if (normalized === "white") return { r: 255, g: 255, b: 255 };
	if (normalized === "rgba(255, 255, 255, 0)") {
		// The transparent light Base Theme is an externally observed behavior. Its
		// effective contrast depends on the host backdrop and cannot be certified
		// from the token value alone.
		return null;
	}
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(normalized);
	if (hex) {
		const expanded =
			hex[1].length === 3
				? [...hex[1]].map((channel) => channel.repeat(2)).join("")
				: hex[1];
		const numeric = Number.parseInt(expanded, 16);
		return {
			r: (numeric >> 16) & 255,
			g: (numeric >> 8) & 255,
			b: numeric & 255,
		};
	}
	const rgb =
		/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/.exec(
			normalized,
		);
	if (!rgb || (rgb[4] !== undefined && Number.parseFloat(rgb[4]) !== 1)) {
		return null;
	}
	const channels = rgb.slice(1, 4).map(Number);
	if (channels.some((channel) => channel < 0 || channel > 255)) {
		return null;
	}
	return { r: channels[0], g: channels[1], b: channels[2] };
}

function channelLuminance(channel: number): number {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
	return (
		0.2126 * channelLuminance(color.r) +
		0.7152 * channelLuminance(color.g) +
		0.0722 * channelLuminance(color.b)
	);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function resolveColor(
	variables: Readonly<ThemeVariables>,
	token: ThemeTokenName,
	seen = new Set<string>(),
): string | undefined {
	if (seen.has(token)) return undefined;
	seen.add(token);
	const value = variables[token]?.trim();
	if (!value) return undefined;
	const reference = /^var\(\s*(--pie-[a-z0-9-]+)\s*\)$/i.exec(value);
	return reference
		? resolveColor(variables, reference[1] as ThemeTokenName, seen)
		: value;
}

export function diagnoseThemeContrast(
	variables: Readonly<ThemeVariables>,
	schemeId?: string,
	relevantTokens?: ReadonlySet<string>,
): readonly PieThemeDiagnostic[] {
	const diagnostics: PieThemeDiagnostic[] = [];
	for (const relationship of PIE_THEME_CONTRAST_RELATIONSHIPS) {
		if (
			relevantTokens &&
			!relevantTokens.has(relationship.foreground) &&
			!relevantTokens.has(relationship.background)
		) {
			continue;
		}
		const foregroundValue = resolveColor(variables, relationship.foreground);
		const backgroundValue = resolveColor(variables, relationship.background);
		const foreground = foregroundValue
			? parseOpaqueColor(foregroundValue)
			: null;
		const background = backgroundValue
			? parseOpaqueColor(backgroundValue)
			: null;
		if (!foreground || !background) {
			diagnostics.push({
				code: "contrast-unmeasurable",
				severity: "warning",
				message: `Could not measure ${relationship.role} contrast for ${relationship.foreground} against ${relationship.background}.`,
				schemeId,
				token: relationship.foreground,
			});
			continue;
		}
		const ratio = contrastRatio(foreground, background);
		if (ratio < relationship.minimum) {
			diagnostics.push({
				code: "contrast-too-low",
				severity: "warning",
				message: `${relationship.role} contrast is ${ratio.toFixed(2)}:1; ${relationship.minimum}:1 is required.`,
				schemeId,
				token: relationship.foreground,
			});
		}
	}
	return Object.freeze(diagnostics);
}

export function getBaseThemeVariables(
	baseTheme: "light" | "dark",
): Readonly<ThemeVariables> {
	return BASE_THEMES[baseTheme];
}

export function listBuiltInColorSchemeDefinitions(): readonly BuiltInColorSchemeDefinition[] {
	return BUILT_IN_COLOR_SCHEMES;
}

export function getBuiltInColorSchemeDefinition(
	id: string,
): BuiltInColorSchemeDefinition | undefined {
	return BUILT_IN_SCHEMES_BY_ID.get(id);
}

export function getDefaultColorSchemeDescriptor(): PieColorSchemeDescriptor {
	return DEFAULT_SCHEME_DESCRIPTOR;
}

export function createPieColorSchemePreview(
	variables: Readonly<ThemeVariables>,
): PieColorSchemePreview {
	return deepFreeze({
		bg:
			variables["--pie-background"] ??
			variables["--pie-secondary-background"] ??
			"#ffffff",
		text: variables["--pie-text"] ?? "#000000",
		primary: variables["--pie-primary"] ?? "#3f51b5",
	});
}

export function getSchemeParticipation(
	token: string,
): PieThemeSchemeParticipation | undefined {
	return PIE_THEME_SCHEME_PARTICIPATION[
		token as keyof typeof PIE_THEME_SCHEME_PARTICIPATION
	];
}

export function getRequiredSchemeTokens(): readonly ThemeTokenName[] {
	return REQUIRED_SCHEME_TOKENS;
}

export function getOptionalSchemeTokens(): readonly ThemeTokenName[] {
	return OPTIONAL_SCHEME_TOKENS;
}

export function createBuiltInColorSchemeDescriptor(
	definition: BuiltInColorSchemeDefinition,
): PieColorSchemeDescriptor {
	return deepFreeze({
		id: definition.id,
		name: definition.name,
		description: definition.description,
		kind: "built-in",
		preview: createPieColorSchemePreview(definition.variables),
	});
}

function validateBuiltInDefinitions(): string[] {
	const required = new Set(REQUIRED_SCHEME_TOKENS);
	const ids = new Set<string>();
	const failures: string[] = [];
	for (const scheme of BUILT_IN_COLOR_SCHEMES) {
		if (ids.has(scheme.id)) {
			failures.push(`duplicate built-in id ${scheme.id}`);
		}
		ids.add(scheme.id);
		const actual = new Set(Object.keys(scheme.variables));
		const missing = [...required].filter((token) => !actual.has(token));
		const extra = [...actual].filter(
			(token) => !required.has(token as ThemeTokenName),
		);
		if (missing.length > 0) {
			failures.push(`${scheme.id} missing: ${missing.join(", ")}`);
		}
		if (extra.length > 0) {
			failures.push(
				`${scheme.id} has non-required tokens: ${extra.join(", ")}`,
			);
		}
		for (const diagnostic of diagnoseThemeContrast(
			scheme.variables,
			scheme.id,
		)) {
			failures.push(`${scheme.id}: ${diagnostic.message}`);
		}
	}
	return failures;
}

function validateBaseThemes(): string[] {
	const failures: string[] = [];
	for (const baseTheme of ["light", "dark"] as const) {
		const measurableVariables =
			baseTheme === "light"
				? { ...BASE_THEMES.light, "--pie-background": "#ffffff" }
				: BASE_THEMES.dark;
		for (const diagnostic of diagnoseThemeContrast(
			measurableVariables,
			`${baseTheme}-base`,
		)) {
			failures.push(`${baseTheme}: ${diagnostic.message}`);
		}
	}
	return failures;
}

/** Build-time invariant check; browser entries only read the frozen definitions. */
export function assertCanonicalThemeDefinitions(): void {
	const failures = [...validateBaseThemes(), ...validateBuiltInDefinitions()];
	if (failures.length > 0) {
		throw new Error(
			`Invalid canonical PIE theme definitions:\n- ${failures.join("\n- ")}`,
		);
	}
}
