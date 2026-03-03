import { normalizePieThemeVariables, type ThemeVariables } from "./theme-types.js";

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

function mapComputedDaisyVars(computed: CSSStyleDeclaration): ThemeVariables {
	const value = (key: string) => trimCssVar(computed.getPropertyValue(key));
	return normalizePieThemeVariables({
		"--pie-background": value("--color-base-100"),
		"--pie-background-dark": value("--color-base-200"),
		"--pie-secondary-background": value("--color-base-200"),
		"--pie-dropdown-background": value("--color-base-300"),
		"--pie-text": value("--color-base-content"),
		"--pie-primary": value("--color-primary"),
		"--pie-primary-light": value("--color-primary"),
		"--pie-primary-dark": value("--color-primary"),
		"--pie-secondary": value("--color-secondary"),
		"--pie-secondary-light": value("--color-secondary"),
		"--pie-secondary-dark": value("--color-secondary"),
		"--pie-tertiary": value("--color-accent"),
		"--pie-tertiary-light": value("--color-accent"),
		"--pie-border": value("--color-base-300"),
		"--pie-border-light": value("--color-base-200"),
		"--pie-border-dark": value("--color-neutral"),
		"--pie-border-gray": value("--color-base-300"),
		"--pie-correct": value("--color-success"),
		"--pie-correct-secondary": value("--color-success-content"),
		"--pie-correct-tertiary": value("--color-success"),
		"--pie-correct-icon": value("--color-success"),
		"--pie-incorrect": value("--color-error"),
		"--pie-incorrect-secondary": value("--color-error-content"),
		"--pie-incorrect-icon": value("--color-error"),
		"--pie-missing": value("--color-warning"),
		"--pie-missing-icon": value("--color-warning"),
		"--pie-disabled": value("--color-base-300"),
		"--pie-disabled-secondary": value("--color-base-200"),
		"--pie-focus-checked": value("--color-primary"),
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

