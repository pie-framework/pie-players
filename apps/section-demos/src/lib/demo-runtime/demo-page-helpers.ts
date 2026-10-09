import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";
import { applyPieColorScheme, DAISYUI_THEME_CATALOG } from "@pie-players/pie-theme";
import type {
	AssessmentEntity,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";

export const PLAYER_OPTIONS = ["iife", "esm", "preloaded"] as const;
export const MODE_OPTIONS = ["candidate", "scorer"] as const;
export const LAYOUT_OPTIONS = ["splitpane", "vertical"] as const;
export const DEMO_ASSESSMENT_ID = "section-demos-assessment";
export const ATTEMPT_QUERY_PARAM = "attempt";
export const ATTEMPT_STORAGE_KEY = "pie:section-demos:attempt-id";
export const DAISY_THEME_STORAGE_KEY = "pie:section-demos:daisy-theme";
export const TOOLKIT_SCHEME_STORAGE_KEY = "pie-color-scheme";
export const DEFAULT_DAISY_THEME = "light";
export const DAISY_DEFAULT_THEMES = DAISYUI_THEME_CATALOG;

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
	const nextTheme =
		(theme || DEFAULT_DAISY_THEME).trim() || DEFAULT_DAISY_THEME;
	const pieThemeHost =
		(document.querySelector(
			'pie-theme[scope="document"]',
		) as HTMLElement | null) ||
		(document.querySelector("pie-theme") as HTMLElement | null);
	document.documentElement.setAttribute("data-theme", nextTheme);
	if (pieThemeHost) {
		if (pieThemeHost.getAttribute("theme") !== nextTheme) {
			pieThemeHost.setAttribute("theme", nextTheme);
		}
	}
	onAppliedTheme(nextTheme);
	window.localStorage.setItem(DAISY_THEME_STORAGE_KEY, nextTheme);
}

export function applyToolkitScheme(scheme: string): void {
	if (typeof window === "undefined") return;
	applyPieColorScheme(scheme, { persistenceKey: TOOLKIT_SCHEME_STORAGE_KEY });
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

/**
 * The assessment a demo binds: tool policy reads the profile from the bound
 * assessment only. A section's own profile overrides the universal one.
 *
 * Only the profile is bound. District policy and test administration have their
 * own demos, and placeholders here would make every demo assert precedence it
 * does not exercise.
 */
export function demoAssessmentFor(
	section: {
		personalNeedsProfile?: PersonalNeedsProfile;
		settings?: { personalNeedsProfile?: PersonalNeedsProfile };
	} | null,
): AssessmentEntity | null {
	if (!section) return null;
	return {
		id: DEMO_ASSESSMENT_ID,
		personalNeedsProfile:
			section.personalNeedsProfile ??
			section.settings?.personalNeedsProfile ??
			createUniversalPersonalNeedsProfile(),
	};
}

/**
 * Bind the demo's assessment on a coordinator the demo constructs and passes
 * in `runtime.coordinator`; the player forwards its `assessment` property only
 * to a coordinator it owns.
 *
 * Safe to call repeatedly: the engine compares the assessment structurally, so
 * re-binding the same profile emits no policy-change event.
 */
export function bindDemoAssessment(
	coordinator: {
		updateAssessment?: (assessment: AssessmentEntity | null) => void;
	} | null,
	section: Parameters<typeof demoAssessmentFor>[0],
): void {
	if (typeof coordinator?.updateAssessment !== "function") return;
	const assessment = demoAssessmentFor(section);
	if (assessment) coordinator.updateAssessment(assessment);
}

/**
 * Call `onChange` once per section session change. The layout element bubbles
 * one `session-changed` per change, after the section controller has applied
 * it. Returns the unsubscribe, so an `$effect` returns it as its teardown.
 */
export function onSectionSessionChanged(
	layout: EventTarget | null | undefined,
	onChange: () => void,
): (() => void) | undefined {
	if (!layout) return undefined;
	layout.addEventListener("session-changed", onChange);
	return () => layout.removeEventListener("session-changed", onChange);
}
