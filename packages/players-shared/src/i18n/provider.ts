/**
 * The bundled i18n provider.
 *
 * Deliberately imports only the English catalog. The dynamic loader map for every
 * other locale lives in `./catalogs.js`, which players import and tools do not:
 * every player and tool `vite.config.ts` sets `external: []`, so anything
 * reachable from a tool's entry inlines into that tool's bundle. Keeping the
 * loader map out of this module is what stops a locale chunk from being emitted
 * into eighteen tool bundles that will never call `setLocale`.
 *
 * @module @pie-players/pie-players-shared/i18n/provider
 */

import {
	findBestLanguageMatch,
	normalizeLanguageTag,
} from "./language-tags.js";
import enUS from "./messages/en-US.js";
import type {
	DynamicMessageKey,
	I18nConfig,
	I18nProvider,
	I18nServiceApi,
	InterpolationValues,
	LocaleCode,
	MessageCatalog,
	MessageKeyInput,
	MessageNode,
	PluralOptions,
	PluralTranslation,
	TextDirection,
	TranslationBundle,
} from "./types.js";

/** The locale every fallback chain terminates at. */
export const DEFAULT_LOCALE = "en-US";

/**
 * Assert that a runtime-assembled string is a message key.
 *
 * Every other call site passes a literal checked against `MessageKey`, so a
 * typo is a compile error. This is the one escape hatch, for a key built from an
 * id the catalog cannot enumerate — a host-supplied element category, a
 * colour-scheme id. Unchecked, like any assertion: pair it with `hasKey` where a
 * miss must not reach the screen.
 */
export function dynamicMessageKey(key: string): DynamicMessageKey {
	return key as DynamicMessageKey;
}

/**
 * Right-to-left primary language subtags.
 *
 * Consulted only where `Intl.Locale.prototype.textInfo` is unavailable — it is
 * the authoritative CLDR answer but shipped late in Safari, and an assessment
 * laid out left-to-right for an Arabic reader is not a graceful degradation.
 * Replaces a four-entry list that omitted every subtag below.
 */
const RTL_LANGUAGES = new Set([
	"ar", // Arabic
	"ckb", // Central Kurdish
	"dv", // Dhivehi
	"fa", // Persian
	"he",
	"iw", // Hebrew, current and legacy subtags
	"ks", // Kashmiri
	"ku", // Kurdish
	"nqo", // N'Ko
	"ps", // Pashto
	"sd", // Sindhi
	"syr", // Syriac
	"ug", // Uyghur
	"ur", // Urdu
	"yi", // Yiddish
]);

const PLURAL_CATEGORIES = new Set([
	"zero",
	"one",
	"two",
	"few",
	"many",
	"other",
]);

function isPluralGroup(node: MessageNode): node is PluralTranslation {
	if (typeof node !== "object" || node === null) return false;
	const keys = Object.keys(node);
	return keys.length > 0 && keys.every((key) => PLURAL_CATEGORIES.has(key));
}

/**
 * Writing direction of a locale tag.
 *
 * Exported because the catalog resolver and the TTS voice selector need it
 * without constructing a provider.
 */
export function localeDirection(locale: string): TextDirection {
	try {
		const textInfo = (
			new Intl.Locale(locale) as { textInfo?: { direction?: string } }
		).textInfo;
		if (textInfo?.direction === "rtl" || textInfo?.direction === "ltr") {
			return textInfo.direction;
		}
	} catch {
		// Not a tag `Intl.Locale` accepts; the subtag check below still answers.
	}
	const language = normalizeLanguageTag(locale).split("-")[0] ?? "";
	return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

/**
 * The browser's preferred locale, or `DEFAULT_LOCALE` where there is no
 * `navigator` — so this is safe in Node, which `players-shared` must remain.
 *
 * Nothing calls this by default. Under fixed lockstep patch-only versioning a
 * rendered-string change reaches a host's live delivery on their next install
 * with no build signal on their side, so auto-detection would silently switch an
 * English deployment's chrome on a Dutch-configured laptop. A host that wants
 * detection opts into it.
 */
export function detectBrowserLocale(): string {
	if (typeof navigator === "undefined") return DEFAULT_LOCALE;
	return navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE;
}

/**
 * The bundled provider.
 *
 * Retains the `SimpleI18n` name and the `I18nServiceApi` surface it published
 * before adoption. What changed is behaviour that had no caller: catalogs are
 * BCP-47 keyed and resolved through RFC 4647 lookup rather than string equality,
 * `dir`/`lang` are no longer written to `document.documentElement` (an embedded
 * player has no business writing the host page's root), and plural categories
 * come from `Intl.PluralRules` alone.
 */
export class SimpleI18n implements I18nServiceApi {
	/** Shared across instances and views: `Intl.PluralRules` is not cheap. */
	private static readonly pluralRules = new Map<string, Intl.PluralRules>();

	private locale: string;
	private readonly fallbackLocale: string;
	/** Shared by reference with every `withLocale` view. */
	private catalogs: Map<string, MessageCatalog>;
	private customMessages: Record<string, MessageCatalog>;
	private loading: Map<string, Promise<void>>;
	private readonly listeners = new Set<() => void>();
	private config: I18nConfig;

	constructor(config: I18nConfig = {}) {
		this.config = { ...config };
		this.fallbackLocale = normalizeTag(config.fallbackLocale) || DEFAULT_LOCALE;
		this.catalogs = new Map([[DEFAULT_LOCALE, enUS as MessageCatalog]]);
		this.customMessages = { ...(config.customMessages ?? {}) };
		this.loading = new Map();
		this.locale = this.resolveLocaleTag(config.locale) ?? DEFAULT_LOCALE;
	}

	/**
	 * Set the locale, loading its catalog first.
	 *
	 * Convenience over `setLocale` for a host that constructs the provider and
	 * configures it in two steps. Never falls back to the browser locale; see
	 * {@link detectBrowserLocale}.
	 */
	async initialize(config: I18nConfig): Promise<void> {
		this.config = { ...this.config, ...config };
		if (config.customMessages) {
			for (const [locale, messages] of Object.entries(config.customMessages)) {
				this.addCustomMessages(locale, messages);
			}
		}
		await this.setLocale(config.locale ?? this.locale);
	}

	getLocale(): string {
		return this.locale;
	}

	/**
	 * Switch locale.
	 *
	 * Resolves the request against the catalogs this provider can serve, loads
	 * the winner if it is not resident, then notifies subscribers — in that
	 * order, so a component's reactive read re-runs against a catalog that is
	 * already in place rather than against the previous locale.
	 */
	async setLocale(locale: LocaleCode): Promise<void> {
		const resolved = this.resolveLocaleTag(locale);
		if (!resolved) {
			// A locale we ship no catalog for is legitimate: the host may have
			// supplied its own messages for it. Honour the tag and let the
			// fallback chain cover whatever those messages omit.
			this.locale = normalizeTag(locale) || DEFAULT_LOCALE;
			this.notify();
			return;
		}

		if (!this.catalogs.has(resolved)) {
			const inFlight = this.loading.get(resolved);
			if (inFlight) {
				await inFlight;
			} else {
				const load = this.loadCatalog(resolved);
				this.loading.set(resolved, load);
				try {
					await load;
				} finally {
					this.loading.delete(resolved);
				}
			}
		}

		this.locale = resolved;
		this.notify();
	}

	t(key: MessageKeyInput, values?: InterpolationValues): string {
		const message = this.lookup(key);
		if (message === undefined) {
			this.config.onMissingKey?.(key, this.locale);
			return key;
		}
		return interpolate(message, values);
	}

	/**
	 * Translate a plural group.
	 *
	 * The category comes from `Intl.PluralRules` for the active locale, so a
	 * locale with more than two forms resolves correctly: Arabic selects among
	 * zero/one/two/few/many/other, Polish among one/few/many/other. A category the
	 * catalog does not carry resolves to `other`.
	 */
	plural(key: MessageKeyInput, options: PluralOptions): string {
		const group = this.lookupNode(key);
		if (group === undefined || !isPluralGroup(group)) {
			return this.t(key, options);
		}
		const category = this.selectPluralCategory(options.count);
		const form = group[category] ?? group.other;
		return interpolate(form, options);
	}

	getDirection(): TextDirection {
		return localeDirection(this.locale);
	}

	/**
	 * Locales this provider can serve: resident catalogs, whatever the loader
	 * declares, and any locale the host supplied messages for.
	 */
	getAvailableLocales(): string[] {
		const tags = new Set<string>([
			...this.catalogs.keys(),
			...(this.config.availableLocales ?? []),
			...Object.keys(this.customMessages),
		]);
		return [...tags];
	}

	isLocaleLoaded(locale: LocaleCode): boolean {
		const resolved = this.resolveLocaleTag(locale);
		return resolved !== undefined && this.catalogs.has(resolved);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	hasKey(key: MessageKeyInput): boolean {
		return this.lookup(key) !== undefined;
	}

	/**
	 * Add or override messages for one locale.
	 *
	 * Deep-merged, so a deployment can override a single label without restating
	 * a catalog.
	 */
	addCustomMessages(locale: string, messages: MessageCatalog): void {
		const tag = normalizeTag(locale);
		this.customMessages[tag] = deepMerge(
			this.customMessages[tag] ?? {},
			messages,
		);
		this.notify();
	}

	/**
	 * A view of this provider fixed to another locale.
	 *
	 * Catalogs, in-flight loads and custom messages are shared by reference, so
	 * `setLocale` through either side is visible to both and no catalog is parsed
	 * twice. This is what lets two players on one page render different chrome
	 * locales: the locale is per-view, the catalogs are per-provider.
	 */
	withLocale(locale: LocaleCode): I18nServiceApi {
		const resolved = this.resolveLocaleTag(locale) ?? normalizeTag(locale);
		if (resolved === this.locale) return this;

		const view = new SimpleI18n({ ...this.config, locale: resolved });
		view.locale = resolved || DEFAULT_LOCALE;
		view.catalogs = this.catalogs;
		view.customMessages = this.customMessages;
		view.loading = this.loading;
		return view;
	}

	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		try {
			return new Intl.NumberFormat(this.locale, options).format(value);
		} catch {
			return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value);
		}
	}

	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		try {
			return new Intl.DateTimeFormat(this.locale, options).format(date);
		} catch {
			return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
		}
	}

	/** The resolved catalog for a locale, for a host that wants to inspect it. */
	getBundle(locale: LocaleCode = this.locale): TranslationBundle | undefined {
		const tag = this.resolveLocaleTag(locale);
		if (!tag) return undefined;
		const translations = this.catalogs.get(tag);
		if (!translations) return undefined;
		return { locale: tag, translations, direction: localeDirection(tag) };
	}

	/**
	 * Which shipped catalog serves a requested tag.
	 *
	 * RFC 4647 lookup first, so `nl-BE` reaches `nl-NL` through `nl`; then
	 * primary-subtag widening, so a bare `nl` reaches the regional `nl-NL`
	 * catalog we actually ship. POSIX `nl_NL` normalizes on the way in, which is
	 * the form the Learnosity transform emits.
	 */
	private resolveLocaleTag(locale: LocaleCode | undefined): string | undefined {
		if (!locale) return undefined;
		const available = this.getAvailableLocales();
		const exactOrPrefix = findBestLanguageMatch(locale, available);
		if (exactOrPrefix) return exactOrPrefix;

		const requestedLanguage = normalizeLanguageTag(locale).split("-")[0];
		if (!requestedLanguage) return undefined;
		return available.find(
			(candidate) =>
				normalizeLanguageTag(candidate).split("-")[0] === requestedLanguage,
		);
	}

	private async loadCatalog(locale: string): Promise<void> {
		const load = this.config.loadCatalog;
		if (!load) return;
		try {
			this.catalogs.set(locale, await load(locale));
		} catch (error) {
			// A failed load is not fatal: the fallback chain still resolves every
			// key to English. Rethrowing here would take down a player over a
			// missing chunk.
			throw new Error(`Failed to load i18n catalog for locale: ${locale}`, {
				cause: error,
			});
		}
	}

	/**
	 * Resolution order for one key. Host overrides for the active locale win, so
	 * a deployment can rename one label without forking a catalog.
	 */
	private lookupNode(key: string): MessageNode | undefined {
		const sources = [
			this.customMessages[this.locale],
			this.catalogs.get(this.locale),
			this.customMessages[this.fallbackLocale],
			this.catalogs.get(this.fallbackLocale),
		];
		for (const source of sources) {
			const hit = readPath(source, key);
			if (hit !== undefined) return hit;
		}
		return undefined;
	}

	private lookup(key: string): string | undefined {
		const node = this.lookupNode(key);
		if (typeof node === "string") return node;
		// A key landing on a namespace (`t("common")`) or on a plural group is a
		// miss, not a hit: returning the object would put one where the caller
		// expects a string, and interpolating it throws.
		if (node !== undefined && isPluralGroup(node)) return node.other;
		return undefined;
	}

	private selectPluralCategory(count: number): keyof PluralTranslation {
		let rules = SimpleI18n.pluralRules.get(this.locale);
		if (!rules) {
			try {
				rules = new Intl.PluralRules(this.locale);
			} catch {
				return count === 1 ? "one" : "other";
			}
			SimpleI18n.pluralRules.set(this.locale, rules);
		}
		return rules.select(count) as keyof PluralTranslation;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}

function normalizeTag(locale: LocaleCode | undefined): string {
	return locale ? locale.trim().replace(/_/g, "-") : "";
}

function readPath(
	source: MessageCatalog | undefined,
	key: string,
): MessageNode | undefined {
	if (!source) return undefined;
	let current: MessageNode | undefined = source;
	for (const part of key.split(".")) {
		if (typeof current !== "object" || current === null) return undefined;
		current = (current as Record<string, MessageNode>)[part];
		if (current === undefined) return undefined;
	}
	return current;
}

function interpolate(text: string, values?: InterpolationValues): string {
	if (!values) return text;
	return text.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = values[name];
		return value === undefined || value === null ? match : String(value);
	});
}

function deepMerge(target: MessageCatalog, source: MessageCatalog) {
	const result: MessageCatalog = { ...target };
	for (const [key, value] of Object.entries(source)) {
		const existing = result[key];
		if (
			value &&
			typeof value === "object" &&
			existing &&
			typeof existing === "object"
		) {
			result[key] = deepMerge(
				existing as MessageCatalog,
				value as MessageCatalog,
			);
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * The graceful default: an English-only provider, shared process-wide.
 *
 * `composition-context.md` requires a resolver to work with no publisher
 * present, and this is that state. A tool mounted bare — in `print-player`, in
 * Studio preview, in an authoring harness — resolves this and renders English
 * rather than leaking raw message keys onto the screen. It carries no locale
 * loader, so it pulls no catalog beyond the 5 KB English one already in the
 * bundle.
 */
let defaultProvider: SimpleI18n | undefined;

export function getDefaultI18n(): I18nServiceApi {
	if (!defaultProvider) defaultProvider = new SimpleI18n();
	return defaultProvider;
}

/**
 * Resolve a component's interface-locale provider from a published context.
 *
 * Returns a **fresh** object on every call, and that is the whole point. A
 * provider is mutable: `setLocale` swaps its catalog in place, so its identity is
 * unchanged before and after a locale load. A reactive `$derived` reading the
 * provider directly therefore never invalidates, and a label rendered while the
 * catalog was still loading stays English forever — the exact silent failure
 * `composition-context.md` records for a context published without a change
 * signal, and it is silent here too because English is a plausible answer.
 *
 * Deriving this instead gives the component a value whose identity tracks the
 * context republish, so the strings built from it re-render. Call it inside
 * `$derived`, never once at setup:
 *
 * ```ts
 * const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
 * ```
 *
 * A context with no provider — no publisher at all — resolves to the English-only
 * default rather than nothing, which is the graceful default the pull pattern
 * requires.
 */
export function resolveInterfaceI18n(
	source: { i18n?: I18nProvider } | null | undefined,
): I18nProvider {
	const provider = source?.i18n ?? getDefaultI18n();
	// A thin facade rather than the provider itself: cheap to allocate (a handful
	// of times per session, once per republish) and it carries no state of its own,
	// so it cannot drift from the provider it delegates to.
	return {
		getLocale: () => provider.getLocale(),
		setLocale: (locale) => provider.setLocale(locale),
		t: (key, values) => provider.t(key, values),
		plural: (key, options) =>
			provider.plural?.(key, options) ?? provider.t(key, options),
		getDirection: () => provider.getDirection?.() ?? "ltr",
		hasKey: (key) => provider.hasKey?.(key) ?? false,
		subscribe: (listener) => provider.subscribe?.(listener) ?? (() => {}),
	};
}
