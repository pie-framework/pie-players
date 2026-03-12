export const PLAYER_OPTIONS = ["iife", "esm", "preloaded"] as const;
export const MODE_OPTIONS = ["candidate", "scorer"] as const;
export const LAYOUT_OPTIONS = ["splitpane", "vertical"] as const;
export const DEMO_ASSESSMENT_ID = "section-demos-assessment";
export const ATTEMPT_QUERY_PARAM = "attempt";
export const ATTEMPT_STORAGE_KEY = "pie:section-demos:attempt-id";
export const DAISY_THEME_STORAGE_KEY = "pie:section-demos:daisy-theme";
export const TOOLKIT_SCHEME_STORAGE_KEY = "pie-color-scheme";
export const DEFAULT_DAISY_THEME = "light";
export const DAISY_DEFAULT_THEMES = [
	"light",
	"dark",
	"cupcake",
	"bumblebee",
	"emerald",
	"corporate",
	"synthwave",
	"retro",
	"cyberpunk",
	"valentine",
	"halloween",
	"garden",
	"forest",
	"aqua",
	"lofi",
	"pastel",
	"fantasy",
	"wireframe",
	"black",
	"luxury",
	"dracula",
	"cmyk",
	"autumn",
	"business",
	"acid",
	"lemonade",
	"night",
	"coffee",
	"winter",
	"dim",
	"nord",
	"sunset",
	"caramellatte",
	"abyss",
	"silk",
] as const;

export function getUrlEnumParam<T extends string>(
	key: string,
	options: readonly T[],
	fallback: T,
): T {
	if (typeof window === "undefined") return fallback;
	const value = new URLSearchParams(window.location.search).get(key);
	return value && options.includes(value as T) ? (value as T) : fallback;
}

export function createAttemptId(): string {
	return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getOrCreateAttemptId(): string {
	if (typeof window === "undefined") return "attempt-ssr";
	const params = new URLSearchParams(window.location.search);
	const fromUrl = params.get(ATTEMPT_QUERY_PARAM);
	if (fromUrl) {
		window.localStorage.setItem(ATTEMPT_STORAGE_KEY, fromUrl);
		return fromUrl;
	}
	const stored = window.localStorage.getItem(ATTEMPT_STORAGE_KEY);
	if (stored) return stored;
	const next = createAttemptId();
	window.localStorage.setItem(ATTEMPT_STORAGE_KEY, next);
	return next;
}

export function applyDaisyTheme(
	theme: string,
	onAppliedTheme: (nextTheme: string) => void,
): void {
	if (typeof window === "undefined") return;
	const nextTheme = (theme || DEFAULT_DAISY_THEME).trim() || DEFAULT_DAISY_THEME;
	const pieThemeHost =
		(document.querySelector("pie-theme[scope=\"document\"]") as HTMLElement | null) ||
		(document.querySelector("pie-theme") as HTMLElement | null);
	if (pieThemeHost) {
		if (pieThemeHost.getAttribute("theme") !== nextTheme) {
			pieThemeHost.setAttribute("theme", nextTheme);
		}
	} else {
		document.documentElement.setAttribute("data-theme", nextTheme);
	}
	onAppliedTheme(nextTheme);
	window.localStorage.setItem(DAISY_THEME_STORAGE_KEY, nextTheme);
}

export function applyToolkitScheme(scheme: string): void {
	if (typeof window === "undefined") return;
	const nextScheme = (scheme || "default").trim() || "default";
	const pieThemeHost =
		(document.querySelector("pie-theme[scope=\"document\"]") as HTMLElement | null) ||
		(document.querySelector("pie-theme") as HTMLElement | null);
	if (pieThemeHost && pieThemeHost.getAttribute("scheme") !== nextScheme) {
		pieThemeHost.setAttribute("scheme", nextScheme);
	}
	window.localStorage.setItem(TOOLKIT_SCHEME_STORAGE_KEY, nextScheme);
}

export function buildDemoHref(args: {
	targetMode: "candidate" | "scorer";
	selectedPlayerType: string;
	layoutType: "splitpane" | "vertical";
	attemptId: string;
	activeDemoPageId?: string;
}): string {
	if (typeof window === "undefined") return "";
	const url = new URL(window.location.href);
	url.searchParams.set("mode", args.targetMode);
	url.searchParams.set("player", args.selectedPlayerType);
	url.searchParams.set("layout", args.layoutType);
	url.searchParams.set(ATTEMPT_QUERY_PARAM, args.attemptId);
	if (args.activeDemoPageId) {
		url.searchParams.set("page", args.activeDemoPageId);
	}
	return url.toString();
}

export function buildSectionPageHref(args: {
	targetPageId: string;
	roleType: "candidate" | "scorer";
	selectedPlayerType: string;
	layoutType: "splitpane" | "vertical";
	attemptId: string;
}): string {
	if (typeof window === "undefined") return "";
	const url = new URL(window.location.href);
	url.searchParams.set("mode", args.roleType);
	url.searchParams.set("player", args.selectedPlayerType);
	url.searchParams.set("layout", args.layoutType);
	url.searchParams.set(ATTEMPT_QUERY_PARAM, args.attemptId);
	url.searchParams.set("page", args.targetPageId);
	return url.toString();
}
