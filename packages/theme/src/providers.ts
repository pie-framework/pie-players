import {
	type ColorMeasure,
	createCanvasColorMeasure,
	legibleColorAgainst,
} from "./contrast.js";
import {
	normalizePieThemeVariables,
	type ThemeVariables,
} from "./theme-types.js";

export interface ThemeProviderAdapter {
	readonly id: string;
	canRead(target: HTMLElement): boolean;
	read(target: HTMLElement): ThemeVariables;
}

const themeProviderRegistry = new Map<string, ThemeProviderAdapter>();

function trimCssVar(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
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

let cachedColorMeasure: ColorMeasure | null | undefined;

/**
 * One measurer for the lifetime of the page. Parsing a colour does not depend on
 * which document asked, and a resolution pass touches every feedback slot.
 */
function colorMeasure(): ColorMeasure | null {
	if (cachedColorMeasure === undefined) {
		cachedColorMeasure = createCanvasColorMeasure();
	}
	return cachedColorMeasure;
}

function mapComputedDaisyVars(computed: CSSStyleDeclaration): ThemeVariables {
	const value = (key: string) => trimCssVar(computed.getPropertyValue(key));
	/**
	 * DaisyUI's semantic slots are background colours: `--color-success` is
	 * chosen to sit behind `--color-success-content`, not to be read against the
	 * page. PIE's feedback tokens are foregrounds — the assessment toolkit paints
	 * them as `color:` — so taking a slot verbatim puts a pale fill where a
	 * legible mark belongs. Measured across DaisyUI's shipped themes, that left
	 * the correct and incorrect marks between 1.2:1 and 2.9:1 against the page.
	 */
	const feedbackColor = (slot: string): string | undefined =>
		legibleColorAgainst({
			hue: value(slot),
			text: value("--color-base-content"),
			background: value("--color-base-100"),
			measure: colorMeasure(),
		});
	return normalizePieThemeVariables({
		"--pie-background": value("--color-base-100"),
		"--pie-background-dark": value("--color-base-200"),
		"--pie-secondary-background": value("--color-base-200"),
		"--pie-dropdown-background": value("--color-base-300"),
		"--pie-text": value("--color-base-content"),
		"--pie-primary": value("--color-primary"),
		"--pie-primary-light": mixResolvedColors({
			left: value("--color-primary"),
			right: value("--color-base-100"),
			leftWeight: "60%",
		}),
		"--pie-primary-dark": mixResolvedColors({
			left: value("--color-primary"),
			right: value("--color-base-content"),
			leftWeight: "75%",
		}),
		"--pie-faded-primary": mixResolvedColors({
			left: value("--color-primary"),
			right: value("--color-base-100"),
			leftWeight: "20%",
		}),
		"--pie-secondary": value("--color-secondary"),
		"--pie-secondary-light": mixResolvedColors({
			left: value("--color-secondary"),
			right: value("--color-base-100"),
			leftWeight: "60%",
		}),
		"--pie-secondary-dark": mixResolvedColors({
			left: value("--color-secondary"),
			right: value("--color-base-content"),
			leftWeight: "75%",
		}),
		"--pie-tertiary": value("--color-accent"),
		"--pie-tertiary-light": mixResolvedColors({
			left: value("--color-accent"),
			right: value("--color-base-100"),
			leftWeight: "60%",
		}),
		"--pie-border": value("--color-base-300"),
		"--pie-border-light": value("--color-base-200"),
		"--pie-border-dark": value("--color-neutral"),
		"--pie-border-gray": value("--color-base-300"),
		"--pie-correct": feedbackColor("--color-success"),
		"--pie-correct-secondary": mixResolvedColors({
			left: value("--color-success"),
			right: value("--color-base-100"),
			leftWeight: "20%",
		}),
		"--pie-correct-tertiary": feedbackColor("--color-success"),
		"--pie-correct-icon": feedbackColor("--color-success"),
		"--pie-incorrect": feedbackColor("--color-error"),
		"--pie-incorrect-secondary": mixResolvedColors({
			left: value("--color-error"),
			right: value("--color-base-100"),
			leftWeight: "20%",
		}),
		"--pie-incorrect-icon": feedbackColor("--color-error"),
		// Warning, not error: an unanswered question is not a wrong one. Both
		// resolving to `--color-error` made the two states the same colour under
		// every DaisyUI theme, which is the mapping the rest of PIE declares --
		// pie-elements-ng keys `--pie-missing` to `warning`, and the toolkit's
		// `.pie-warning` rule paints it.
		"--pie-missing": feedbackColor("--color-warning"),
		"--pie-missing-icon": feedbackColor("--color-warning"),
		"--pie-disabled": value("--color-base-300"),
		"--pie-disabled-secondary": value("--color-base-200"),
		"--pie-focus-checked": mixResolvedColors({
			left: value("--color-primary"),
			right: value("--color-base-100"),
			leftWeight: "20%",
		}),
		"--pie-focus-checked-border": value("--color-primary"),
		"--pie-focus-unchecked": value("--color-base-200"),
		"--pie-focus-unchecked-border": value("--color-base-300"),
		"--pie-blue-grey-100": value("--color-base-100"),
		"--pie-blue-grey-300": value("--color-base-200"),
		"--pie-blue-grey-600": value("--color-base-300"),
		"--pie-blue-grey-900": value("--color-base-content"),
		"--pie-black": value("--color-neutral-content"),
		"--pie-white": value("--color-base-100"),
		"--pie-button-bg": value("--color-base-100"),
		"--pie-button-border": value("--color-base-300"),
		"--pie-button-color": value("--color-base-content"),
		"--pie-button-hover-bg": value("--color-base-200"),
		"--pie-button-hover-border": value("--color-base-300"),
		"--pie-button-hover-color": value("--color-base-content"),
		"--pie-button-active-bg": value("--color-base-300"),
		"--pie-button-focus-outline": value("--color-primary"),
	});
}

export const DAISYUI_THEME_PROVIDER_ADAPTER: ThemeProviderAdapter = {
	id: "daisyui",
	canRead(target) {
		const computed = getComputedStyle(target);
		return Boolean(
			trimCssVar(computed.getPropertyValue("--color-base-100")) ||
				trimCssVar(computed.getPropertyValue("--color-base-content")) ||
				trimCssVar(computed.getPropertyValue("--color-primary")),
		);
	},
	read(target) {
		return mapComputedDaisyVars(getComputedStyle(target));
	},
};

themeProviderRegistry.set(
	DAISYUI_THEME_PROVIDER_ADAPTER.id,
	DAISYUI_THEME_PROVIDER_ADAPTER,
);

export function registerPieThemeProvider(adapter: ThemeProviderAdapter): void {
	if (!adapter?.id) {
		return;
	}
	themeProviderRegistry.set(adapter.id, adapter);
}

export function unregisterPieThemeProvider(providerId: string): void {
	if (!providerId) {
		return;
	}
	if (providerId === DAISYUI_THEME_PROVIDER_ADAPTER.id) {
		return;
	}
	themeProviderRegistry.delete(providerId);
}

export function listPieThemeProviders(): ThemeProviderAdapter[] {
	return [...themeProviderRegistry.values()];
}

export function getPieThemeProvider(
	providerId: string,
): ThemeProviderAdapter | undefined {
	return themeProviderRegistry.get(providerId);
}

export function resolveProviderVariables(args: {
	target: HTMLElement;
	provider?: string | null;
}): ThemeVariables {
	const providerMode = args.provider?.trim() || "auto";
	const resolveFromTarget = (target: HTMLElement): ThemeVariables => {
		if (providerMode && providerMode !== "auto") {
			const provider = themeProviderRegistry.get(providerMode);
			if (!provider || !provider.canRead(target)) {
				return {};
			}
			return normalizePieThemeVariables(provider.read(target));
		}

		for (const provider of themeProviderRegistry.values()) {
			if (!provider.canRead(target)) {
				continue;
			}
			return normalizePieThemeVariables(provider.read(target));
		}
		return {};
	};

	const resolved = resolveFromTarget(args.target);
	if (Object.keys(resolved).length > 0) {
		return resolved;
	}

	if (
		typeof document !== "undefined" &&
		args.target !== document.documentElement
	) {
		return resolveFromTarget(document.documentElement);
	}

	return {};
}
