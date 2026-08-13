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
const themeProviderObservers = new Set<() => void>();

function notifyThemeProviderObservers(): void {
	for (const listener of [...themeProviderObservers]) {
		try {
			listener();
		} catch {
			console.warn(
				"[pie-theme] A theme-provider observer threw while receiving an update.",
			);
		}
	}
}

/**
 * Provider mode that resolves nothing, leaving this package's shipped defaults
 * in place.
 *
 * `"auto"` lets any registered adapter that can read the target win, which on a
 * DaisyUI page means PIE tokens follow `--color-*`. This is how a host asks for
 * the palette it would have had before adopting a provider — the first question
 * to answer when colours differ between two environments.
 *
 * Distinct from naming an unregistered provider, which lands in the same place
 * by accident. `unregisterPieThemeProvider` cannot remove this one because it is
 * not in the registry at all, so the mode cannot be taken away from a host.
 */
export const PIE_THEME_PROVIDER_NONE = "none";

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
	if (adapter.id === PIE_THEME_PROVIDER_NONE) {
		console.warn(
			`[pie-theme] Theme-provider id "${PIE_THEME_PROVIDER_NONE}" is reserved.`,
		);
		return;
	}
	if (themeProviderRegistry.get(adapter.id) === adapter) {
		return;
	}
	themeProviderRegistry.set(adapter.id, adapter);
	notifyThemeProviderObservers();
}

export function unregisterPieThemeProvider(providerId: string): void {
	if (!providerId) {
		return;
	}
	if (providerId === DAISYUI_THEME_PROVIDER_ADAPTER.id) {
		return;
	}
	if (themeProviderRegistry.delete(providerId)) {
		notifyThemeProviderObservers();
	}
}

/** Package-internal invalidation used by connected pie-theme elements. */
export function observePieThemeProviders(listener: () => void): () => void {
	themeProviderObservers.add(listener);
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		themeProviderObservers.delete(listener);
	};
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
	// Before the registry lookup and before the documentElement retry below: the
	// point of this mode is that nothing resolves, and a retry against a themed
	// <html> would put the provider's values back.
	if (providerMode === PIE_THEME_PROVIDER_NONE) {
		return {};
	}
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
