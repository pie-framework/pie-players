import type { PieColorSchemeName, PieTokenMap } from "./types.js";

const DEFAULT: PieTokenMap = {
	"--pie-text": "black",
	"--pie-background": "rgba(255,255,255,0)",
	"--pie-background-dark": "#ECEDF1",
	"--pie-secondary-background": "rgba(241,241,241,1)",
	"--pie-dropdown-background": "#E0E1E6",
	"--pie-primary": "#3F51B5",
	"--pie-primary-light": "#9FA8DA",
	"--pie-primary-dark": "#283593",
	"--pie-faded-primary": "#DCDAFB",
	"--pie-secondary": "#F50057",
	"--pie-secondary-light": "#F48FB1",
	"--pie-secondary-dark": "#880E4F",
	"--pie-tertiary": "#146EB3",
	"--pie-tertiary-light": "#D0E2F0",
	"--pie-correct": "#4CAF50",
	"--pie-correct-secondary": "#E8F5E9",
	"--pie-correct-tertiary": "#0EA449",
	"--pie-correct-icon": "#087D38",
	"--pie-incorrect": "#FF9800",
	"--pie-incorrect-secondary": "#FFEBEE",
	"--pie-incorrect-icon": "#BF0D00",
	"--pie-missing": "#D32F2F",
	"--pie-missing-icon": "#6A78A1",
	"--pie-disabled": "grey",
	"--pie-disabled-secondary": "#ABABAB",
	"--pie-border": "#9A9A9A",
	"--pie-border-light": "#D1D1D1",
	"--pie-border-dark": "#646464",
	"--pie-border-gray": "#7E8494",
	"--pie-focus-checked": "#BBDEFB",
	"--pie-focus-checked-border": "#1565C0",
	"--pie-focus-unchecked": "#E0E0E0",
	"--pie-focus-unchecked-border": "#757575",
	"--pie-blue-grey-100": "#F3F5F7",
	"--pie-blue-grey-300": "#C0C3CF",
	"--pie-blue-grey-600": "#7E8494",
	"--pie-blue-grey-900": "#152452",
	"--pie-black": "#000000",
	"--pie-white": "#ffffff",
	"--pie-primary-text": "black",
	"--choice-input-color": "black",
	"--choice-input-selected-color": "#3F51B5",
	"--choice-input-disabled-color": "grey",
	"--feedback-correct-bg-color": "#4CAF50",
	"--feedback-incorrect-bg-color": "#FF9800",
	"--before-right": "100%",
	"--before-top": "5px",
	"--before-border-width": "7px",
	"--before-border-color": "rgb(153, 255, 153)",
	"--arrow-color": "#FF9800",
	"--tick-color": "#ffffff",
	"--line-stroke": "#ffffff",
	"--point-fill": "#000000",
	"--point-stroke": "#ffffff",
	"--correct-answer-toggle-label-color": "#ffffff",
	"--pie-text-secondary": "#666666",
};

const BLACK_ON_WHITE: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#000000",
	"--pie-primary": "#0000cc",
	"--pie-primary-light": "#6666ff",
	"--pie-primary-dark": "#000088",
	"--pie-background": "#ffffff",
	"--pie-background-dark": "#f5f5f5",
	"--pie-secondary-background": "#eeeeee",
	"--pie-border": "#000000",
};

const WHITE_ON_BLACK: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#ffffff",
	"--pie-text-secondary": "#cccccc",
	"--pie-primary": "#ffff00",
	"--pie-primary-light": "#ffff99",
	"--pie-primary-dark": "#cccc00",
	"--pie-background": "#000000",
	"--pie-background-dark": "#1a1a1a",
	"--pie-secondary-background": "#222222",
	"--pie-border": "#ffffff",
	"--pie-white": "#000000",
	"--pie-black": "#ffffff",
};

const ROSE_ON_GREEN: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#3d0022",
	"--pie-primary": "#660044",
	"--pie-primary-light": "#cc6699",
	"--pie-primary-dark": "#440033",
	"--pie-background": "#ccffcc",
	"--pie-background-dark": "#aaeedd",
	"--pie-secondary-background": "#99ddbb",
	"--pie-border": "#3d0022",
};

const YELLOW_ON_BLUE: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#ffff00",
	"--pie-primary": "#ffff66",
	"--pie-primary-light": "#ffffaa",
	"--pie-primary-dark": "#cccc00",
	"--pie-background": "#000066",
	"--pie-background-dark": "#000055",
	"--pie-secondary-background": "#000044",
	"--pie-border": "#ffff00",
};

const BLACK_ON_ROSE: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#000000",
	"--pie-primary": "#880044",
	"--pie-primary-light": "#dd6699",
	"--pie-primary-dark": "#550033",
	"--pie-background": "#ffccdd",
	"--pie-background-dark": "#ffb3cc",
	"--pie-secondary-background": "#ff99bb",
	"--pie-border": "#000000",
};

const LIGHT_GRAY_ON_DARK_GRAY: PieTokenMap = {
	...DEFAULT,
	"--pie-text": "#e0e0e0",
	"--pie-text-secondary": "#bdbdbd",
	"--pie-primary": "#aaaaaa",
	"--pie-primary-light": "#cccccc",
	"--pie-primary-dark": "#888888",
	"--pie-background": "#333333",
	"--pie-background-dark": "#2a2a2a",
	"--pie-secondary-background": "#222222",
	"--pie-border": "#e0e0e0",
};

export const PIE_COLOR_SCHEMES: Record<PieColorSchemeName, PieTokenMap> = {
	default: DEFAULT,
	"black-on-white": BLACK_ON_WHITE,
	"white-on-black": WHITE_ON_BLACK,
	"rose-on-green": ROSE_ON_GREEN,
	"yellow-on-blue": YELLOW_ON_BLUE,
	"black-on-rose": BLACK_ON_ROSE,
	"light-gray-on-dark-gray": LIGHT_GRAY_ON_DARK_GRAY,
};

export const PIE_LIGHT_THEME: PieTokenMap = { ...DEFAULT };
export const PIE_DARK_THEME: PieTokenMap = { ...WHITE_ON_BLACK };

export function getThemeTokens(theme: "light" | "dark"): PieTokenMap {
	return theme === "dark" ? { ...PIE_DARK_THEME } : { ...PIE_LIGHT_THEME };
}

export function getColorSchemeTokens(name: PieColorSchemeName): PieTokenMap {
	return { ...PIE_COLOR_SCHEMES[name] };
}

