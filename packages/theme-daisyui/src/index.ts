import {
	registerPieThemeProvider,
	type ThemeProviderAdapter,
	type ThemeVariables,
} from "@pie-players/pie-theme";

export type DaisyThemeTokens = {
	base100?: string;
	base200?: string;
	base300?: string;
	baseContent?: string;
	primary?: string;
	primaryContent?: string;
	secondary?: string;
	secondaryContent?: string;
	accent?: string;
	accentContent?: string;
	neutral?: string;
	neutralContent?: string;
	info?: string;
	success?: string;
	successContent?: string;
	warning?: string;
	error?: string;
	errorContent?: string;
};

function normalize(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function definedEntries(
	variables: Record<string, string | undefined>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(variables).filter((entry): entry is [string, string] =>
			Boolean(entry[1]),
		),
	);
}

function mixCssColors(args: {
	left?: string;
	fallbackLeft: string;
	right?: string;
	fallbackRight: string;
	leftWeight: string;
}): string {
	const left = args.left ?? args.fallbackLeft;
	const right = args.right ?? args.fallbackRight;
	return `color-mix(in srgb, ${left} ${args.leftWeight}, ${right})`;
}

function mixResolvedColors(args: {
	left?: string;
	right?: string;
	leftWeight: string;
}): string | undefined {
	if (!args.left || !args.right) {
		return undefined;
	}
	return `color-mix(in srgb, ${args.left} ${args.leftWeight}, ${args.right})`;
}

export function mapDaisyThemeToPieVariables(
	tokens: DaisyThemeTokens,
): Record<string, string> {
	return definedEntries({
		"--pie-background": tokens.base100 ?? "var(--color-base-100)",
		"--pie-background-dark": tokens.base200 ?? "var(--color-base-200)",
		"--pie-secondary-background": tokens.base200 ?? "var(--color-base-200)",
		"--pie-dropdown-background": tokens.base300 ?? "var(--color-base-300)",
		"--pie-text": tokens.baseContent ?? "var(--color-base-content)",
		"--pie-primary": tokens.primary ?? "var(--color-primary)",
		"--pie-primary-light": mixCssColors({
			left: tokens.primary,
			fallbackLeft: "var(--color-primary)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "60%",
		}),
		"--pie-primary-dark": mixCssColors({
			left: tokens.primary,
			fallbackLeft: "var(--color-primary)",
			right: tokens.baseContent,
			fallbackRight: "var(--color-base-content)",
			leftWeight: "75%",
		}),
		"--pie-faded-primary": mixCssColors({
			left: tokens.primary,
			fallbackLeft: "var(--color-primary)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "20%",
		}),
		"--pie-secondary": tokens.secondary ?? "var(--color-secondary)",
		"--pie-secondary-light": mixCssColors({
			left: tokens.secondary,
			fallbackLeft: "var(--color-secondary)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "60%",
		}),
		"--pie-secondary-dark": mixCssColors({
			left: tokens.secondary,
			fallbackLeft: "var(--color-secondary)",
			right: tokens.baseContent,
			fallbackRight: "var(--color-base-content)",
			leftWeight: "75%",
		}),
		"--pie-tertiary": tokens.accent ?? "var(--color-accent)",
		"--pie-tertiary-light": mixCssColors({
			left: tokens.accent,
			fallbackLeft: "var(--color-accent)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "60%",
		}),
		"--pie-border": tokens.base300 ?? "var(--color-base-300)",
		"--pie-border-light": tokens.base200 ?? "var(--color-base-200)",
		"--pie-border-dark": tokens.neutral ?? "var(--color-neutral)",
		"--pie-border-gray": tokens.base300 ?? "var(--color-base-300)",
		"--pie-correct": tokens.success ?? "var(--color-success)",
		"--pie-correct-secondary": mixCssColors({
			left: tokens.success,
			fallbackLeft: "var(--color-success)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "20%",
		}),
		"--pie-correct-tertiary": tokens.success ?? "var(--color-success)",
		"--pie-correct-icon": tokens.success ?? "var(--color-success)",
		"--pie-incorrect": tokens.error ?? "var(--color-error)",
		"--pie-incorrect-secondary": mixCssColors({
			left: tokens.error,
			fallbackLeft: "var(--color-error)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "20%",
		}),
		"--pie-incorrect-icon": tokens.error ?? "var(--color-error)",
		"--pie-missing": tokens.error ?? "var(--color-error)",
		"--pie-missing-icon": tokens.error ?? "var(--color-error)",
		"--pie-disabled": tokens.base300 ?? "var(--color-base-300)",
		"--pie-disabled-secondary": tokens.base200 ?? "var(--color-base-200)",
		"--pie-focus-checked": mixCssColors({
			left: tokens.primary,
			fallbackLeft: "var(--color-primary)",
			right: tokens.base100,
			fallbackRight: "var(--color-base-100)",
			leftWeight: "20%",
		}),
		"--pie-focus-checked-border": tokens.primary ?? "var(--color-primary)",
		"--pie-focus-unchecked": tokens.base200 ?? "var(--color-base-200)",
		"--pie-focus-unchecked-border": tokens.base300 ?? "var(--color-base-300)",
		"--pie-blue-grey-100": tokens.base100 ?? "var(--color-base-100)",
		"--pie-blue-grey-300": tokens.base200 ?? "var(--color-base-200)",
		"--pie-blue-grey-600": tokens.base300 ?? "var(--color-base-300)",
		"--pie-blue-grey-900": tokens.baseContent ?? "var(--color-base-content)",
		"--pie-black": tokens.neutralContent ?? "var(--color-neutral-content)",
		"--pie-white": tokens.base100 ?? "var(--color-base-100)",
		"--pie-button-bg": tokens.base100 ?? "var(--color-base-100)",
		"--pie-button-border": tokens.base300 ?? "var(--color-base-300)",
		"--pie-button-color": tokens.baseContent ?? "var(--color-base-content)",
		"--pie-button-hover-bg": tokens.base200 ?? "var(--color-base-200)",
		"--pie-button-hover-border": tokens.base300 ?? "var(--color-base-300)",
		"--pie-button-hover-color":
			tokens.baseContent ?? "var(--color-base-content)",
		"--pie-button-active-bg": tokens.base300 ?? "var(--color-base-300)",
		"--pie-button-focus-outline": tokens.primary ?? "var(--color-primary)",
	});
}

export function applyDaisyThemeToElement(
	element: HTMLElement,
	tokens: DaisyThemeTokens,
) {
	const variables = mapDaisyThemeToPieVariables(tokens);
	for (const [key, value] of Object.entries(variables)) {
		element.style.setProperty(key, value);
	}
}

export function mapResolvedDaisyThemeToPieVariables(
	tokens: DaisyThemeTokens,
): Record<string, string> {
	return definedEntries({
		"--pie-background": tokens.base100,
		"--pie-background-dark": tokens.base200,
		"--pie-secondary-background": tokens.base200,
		"--pie-dropdown-background": tokens.base300,
		"--pie-text": tokens.baseContent,
		"--pie-primary": tokens.primary,
		"--pie-primary-light": mixResolvedColors({
			left: tokens.primary,
			right: tokens.base100,
			leftWeight: "60%",
		}),
		"--pie-primary-dark": mixResolvedColors({
			left: tokens.primary,
			right: tokens.baseContent,
			leftWeight: "75%",
		}),
		"--pie-faded-primary": mixResolvedColors({
			left: tokens.primary,
			right: tokens.base100,
			leftWeight: "20%",
		}),
		"--pie-secondary": tokens.secondary,
		"--pie-secondary-light": mixResolvedColors({
			left: tokens.secondary,
			right: tokens.base100,
			leftWeight: "60%",
		}),
		"--pie-secondary-dark": mixResolvedColors({
			left: tokens.secondary,
			right: tokens.baseContent,
			leftWeight: "75%",
		}),
		"--pie-tertiary": tokens.accent,
		"--pie-tertiary-light": mixResolvedColors({
			left: tokens.accent,
			right: tokens.base100,
			leftWeight: "60%",
		}),
		"--pie-border": tokens.base300,
		"--pie-border-light": tokens.base200,
		"--pie-border-dark": tokens.neutral,
		"--pie-border-gray": tokens.base300,
		"--pie-correct": tokens.success,
		"--pie-correct-secondary": mixResolvedColors({
			left: tokens.success,
			right: tokens.base100,
			leftWeight: "20%",
		}),
		"--pie-correct-tertiary": tokens.success,
		"--pie-correct-icon": tokens.success,
		"--pie-incorrect": tokens.error,
		"--pie-incorrect-secondary": mixResolvedColors({
			left: tokens.error,
			right: tokens.base100,
			leftWeight: "20%",
		}),
		"--pie-incorrect-icon": tokens.error,
		"--pie-missing": tokens.error,
		"--pie-missing-icon": tokens.error,
		"--pie-disabled": tokens.base300,
		"--pie-disabled-secondary": tokens.base200,
		"--pie-focus-checked": mixResolvedColors({
			left: tokens.primary,
			right: tokens.base100,
			leftWeight: "20%",
		}),
		"--pie-focus-checked-border": tokens.primary,
		"--pie-focus-unchecked": tokens.base200,
		"--pie-focus-unchecked-border": tokens.base300,
		"--pie-blue-grey-100": tokens.base100,
		"--pie-blue-grey-300": tokens.base200,
		"--pie-blue-grey-600": tokens.base300,
		"--pie-blue-grey-900": tokens.baseContent,
		"--pie-black": tokens.neutralContent,
		"--pie-white": tokens.base100,
		"--pie-button-bg": tokens.base100,
		"--pie-button-border": tokens.base300,
		"--pie-button-color": tokens.baseContent,
		"--pie-button-hover-bg": tokens.base200,
		"--pie-button-hover-border": tokens.base300,
		"--pie-button-hover-color": tokens.baseContent,
		"--pie-button-active-bg": tokens.base300,
		"--pie-button-focus-outline": tokens.primary,
	});
}

export function readDaisyThemeTokensFromElement(
	element: HTMLElement,
): DaisyThemeTokens | null {
	const computed = getComputedStyle(element);
	const tokens: DaisyThemeTokens = {
		base100: normalize(computed.getPropertyValue("--color-base-100")),
		base200: normalize(computed.getPropertyValue("--color-base-200")),
		base300: normalize(computed.getPropertyValue("--color-base-300")),
		baseContent: normalize(computed.getPropertyValue("--color-base-content")),
		primary: normalize(computed.getPropertyValue("--color-primary")),
		primaryContent: normalize(
			computed.getPropertyValue("--color-primary-content"),
		),
		secondary: normalize(computed.getPropertyValue("--color-secondary")),
		secondaryContent: normalize(
			computed.getPropertyValue("--color-secondary-content"),
		),
		accent: normalize(computed.getPropertyValue("--color-accent")),
		accentContent: normalize(
			computed.getPropertyValue("--color-accent-content"),
		),
		neutral: normalize(computed.getPropertyValue("--color-neutral")),
		neutralContent: normalize(
			computed.getPropertyValue("--color-neutral-content"),
		),
		info: normalize(computed.getPropertyValue("--color-info")),
		success: normalize(computed.getPropertyValue("--color-success")),
		successContent: normalize(
			computed.getPropertyValue("--color-success-content"),
		),
		warning: normalize(computed.getPropertyValue("--color-warning")),
		error: normalize(computed.getPropertyValue("--color-error")),
		errorContent: normalize(computed.getPropertyValue("--color-error-content")),
	};

	return tokens.base100 || tokens.primary || tokens.baseContent ? tokens : null;
}

export const daisyThemeProviderAdapter: ThemeProviderAdapter = {
	id: "daisyui",
	canRead(target: HTMLElement): boolean {
		return Boolean(readDaisyThemeTokensFromElement(target));
	},
	read(target: HTMLElement): ThemeVariables {
		const tokens = readDaisyThemeTokensFromElement(target);
		return tokens ? mapResolvedDaisyThemeToPieVariables(tokens) : {};
	},
};

export function registerDaisyThemeProvider(): void {
	registerPieThemeProvider(daisyThemeProviderAdapter);
}
