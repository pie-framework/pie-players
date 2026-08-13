import {
	DAISY_SLOT_CSS_VARIABLES,
	createCanvasColorMeasure,
	registerPieThemeProvider,
	resolveDaisyPieVariables,
	type ColorMeasure,
	type DaisySlot,
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

let cachedColorMeasure: ColorMeasure | null | undefined;

function colorMeasure(): ColorMeasure | null {
	if (cachedColorMeasure === undefined) {
		cachedColorMeasure = createCanvasColorMeasure();
	}
	return cachedColorMeasure;
}

/**
 * PIE variables whose values are CSS expressions: a slot this caller supplied, or
 * a `var()` reference to DaisyUI's own for the ones it did not.
 *
 * No measurer, deliberately. A `var()` reference is not a colour, so contrast
 * cannot be measured here, and the tokens that need a legible value take their
 * pessimistic fixed weight instead. `mapResolvedDaisyThemeToPieVariables` is the
 * one to use when the values are real colours.
 */
export function mapDaisyThemeToPieVariables(
	tokens: DaisyThemeTokens,
): Record<string, string> {
	return resolveDaisyPieVariables({
		read: (slot) => tokens[slot] ?? `var(${DAISY_SLOT_CSS_VARIABLES[slot]})`,
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

/** PIE variables from resolved colours, so contrast can be measured. */
export function mapResolvedDaisyThemeToPieVariables(
	tokens: DaisyThemeTokens,
): Record<string, string> {
	return resolveDaisyPieVariables({
		read: (slot) => tokens[slot],
		measure: colorMeasure(),
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
