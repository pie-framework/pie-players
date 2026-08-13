import { type ColorMeasure, createCanvasColorMeasure } from "./contrast.js";
import {
	DAISY_SLOT_CSS_VARIABLES,
	resolveDaisyPieVariables,
} from "./daisyui-mapping.js";
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

let cachedColorMeasure: ColorMeasure | null | undefined;

/**
 * One measurer for the lifetime of the page. Parsing a colour does not depend on
 * which document asked, and a resolution pass touches every corrected slot.
 */
function colorMeasure(): ColorMeasure | null {
	if (cachedColorMeasure === undefined) {
		cachedColorMeasure = createCanvasColorMeasure();
	}
	return cachedColorMeasure;
}

function mapComputedDaisyVars(computed: CSSStyleDeclaration): ThemeVariables {
	return normalizePieThemeVariables(
		resolveDaisyPieVariables({
			read: (slot) =>
				trimCssVar(computed.getPropertyValue(DAISY_SLOT_CSS_VARIABLES[slot])),
			measure: colorMeasure(),
		}),
	);
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
