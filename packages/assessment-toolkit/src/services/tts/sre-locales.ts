// SRE loads each locale's rule tables at runtime, from a public CDN unless it is
// handed a source. One static import per table SRE ships in
// `speech-rule-engine/lib/mathmaps` lets the host's bundler emit each as a lazy
// chunk served from the host's own origin. No `with { type: "json" }`: bundlers
// infer JSON from the extension, while Vite's dev server and Bun's bundler turn
// a table into JavaScript and keep the attribute, which a browser then rejects.
const SRE_LOCALE_TABLES: Record<string, () => Promise<{ default: unknown }>> = {
	af: () => import("speech-rule-engine/lib/mathmaps/af.json"),
	base: () => import("speech-rule-engine/lib/mathmaps/base.json"),
	ca: () => import("speech-rule-engine/lib/mathmaps/ca.json"),
	da: () => import("speech-rule-engine/lib/mathmaps/da.json"),
	de: () => import("speech-rule-engine/lib/mathmaps/de.json"),
	en: () => import("speech-rule-engine/lib/mathmaps/en.json"),
	es: () => import("speech-rule-engine/lib/mathmaps/es.json"),
	euro: () => import("speech-rule-engine/lib/mathmaps/euro.json"),
	fr: () => import("speech-rule-engine/lib/mathmaps/fr.json"),
	hi: () => import("speech-rule-engine/lib/mathmaps/hi.json"),
	it: () => import("speech-rule-engine/lib/mathmaps/it.json"),
	ko: () => import("speech-rule-engine/lib/mathmaps/ko.json"),
	nb: () => import("speech-rule-engine/lib/mathmaps/nb.json"),
	nemeth: () => import("speech-rule-engine/lib/mathmaps/nemeth.json"),
	nn: () => import("speech-rule-engine/lib/mathmaps/nn.json"),
	sv: () => import("speech-rule-engine/lib/mathmaps/sv.json"),
};

// SRE's `custom` loader contract: called with a locale name, resolving to that
// locale's table as a JSON string or an already-parsed object. SRE falls back
// to English when a table fails to load.
const loadPackagedSreLocale = async (locale: string): Promise<unknown> => {
	if (!Object.hasOwn(SRE_LOCALE_TABLES, locale)) {
		throw new Error(`speech-rule-engine ships no locale table for "${locale}"`);
	}
	return (await SRE_LOCALE_TABLES[locale]()).default;
};

// SRE's own test for fetching tables over HTTP (`common/system_external.js`).
// Elsewhere it reads them from its package directory, which Node's ESM loader
// could not replace with the imports above: it requires the attribute.
const sreFetchesTables = (): boolean =>
	(typeof window !== "undefined" && typeof window.document !== "undefined") ||
	typeof (globalThis as { DedicatedWorkerGlobalScope?: unknown })
		.DedicatedWorkerGlobalScope !== "undefined";

/**
 * The `setupEngine` options naming where SRE reads locale tables from: the
 * host's `json` (a base URL or path) or `custom` (a loader) when its
 * `engineOptions` set either, otherwise the packaged tables wherever SRE would
 * fetch them. SRE prefers `custom` over `json`, so the packaged loader is left
 * out whenever the host names a source.
 */
export const sreLocaleSource = (
	engineOptions: Record<string, unknown> = {},
): Record<string, unknown> => {
	const { json, custom } = engineOptions;
	if (json || custom) {
		return { ...(json ? { json } : {}), ...(custom ? { custom } : {}) };
	}
	return sreFetchesTables() ? { custom: loadPackagedSreLocale } : {};
};

let startupLocaleSource = sreLocaleSource();

/**
 * Sets the source SRE loads its start-up locales from; see `./sre-engine.ts`.
 * Only a call made before that module first loads has any effect.
 */
export const setSreStartupLocaleSource = (
	engineOptions?: Record<string, unknown>,
): void => {
	startupLocaleSource = sreLocaleSource(engineOptions);
};

export const sreStartupLocaleSource = (): Record<string, unknown> =>
	startupLocaleSource;
