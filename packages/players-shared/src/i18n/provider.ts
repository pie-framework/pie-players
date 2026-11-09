/**
 * The bundled i18n provider.
 *
 * Deliberately imports only the English catalog. The dynamic loader map for every
 * other locale lives in `./catalogs.js`, which players import and tools do not.
 * Tools resolve players-shared from the host's node_modules, so keeping the
 * loader map out of this module keeps locale chunks out of a host bundle that
 * reaches players-shared only through tools.
 *
 * @module @pie-players/pie-players-shared/i18n/provider
 */

import {
	canonicalLanguageTag,
	findClosestLanguageMatch,
	languageTagLookupSequence,
	normalizeLanguageTag,
	toLanguageTag,
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

/** A request's tag in canonical form, or its hyphenated spelling where it is not a tag. */
function requestTag(locale: string | null | undefined): string {
	return canonicalLanguageTag(locale) ?? toLanguageTag(locale);
}

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
 * Catalogs are BCP-47 keyed and resolved through RFC 4647 lookup, and plural
 * categories come from `Intl.PluralRules`. It never writes `dir` or `lang` to
 * `document.documentElement`: an embedded player does not own the host page's
 * root.
 */
export class SimpleI18n implements I18nServiceApi {
	/** Shared across instances and views: `Intl.PluralRules` is not cheap. */
	private static readonly pluralRules = new Map<string, Intl.PluralRules>();

	/** The latest request, canonical; what `getRequestedLocale` names. */
	private requested: string;
	/** The request whose strings are served; moves once its catalog is resident. */
	private active: string;
	/** The catalog serving `active`, resolved against catalogs alone. */
	private activeCatalog: string | undefined;
	private readonly fallbackLocale: string;
	/** Shared by reference with every `withLocale` view. */
	private catalogs: Map<string, MessageCatalog>;
	/** Keyed by normalized tag, so `ES`, `es_ES` and `es-es` reach one set. */
	private customMessages: Record<string, MessageCatalog>;
	private loading: Map<string, Promise<void>>;
	/** Counts `setLocale` calls, so a slow load cannot overwrite a later request. */
	private requests = 0;
	private readonly listeners = new Set<() => void>();
	private config: I18nConfig;

	constructor(config: I18nConfig = {}) {
		this.config = { ...config };
		this.fallbackLocale =
			toLanguageTag(config.fallbackLocale) || DEFAULT_LOCALE;
		this.catalogs = new Map([[DEFAULT_LOCALE, enUS as MessageCatalog]]);
		this.customMessages = {};
		for (const [locale, messages] of Object.entries(
			config.customMessages ?? {},
		)) {
			this.mergeCustomMessages(locale, messages);
		}
		this.loading = new Map();
		this.requested = requestTag(config.locale) || DEFAULT_LOCALE;
		this.active = this.requested;
		this.activeCatalog = this.resolveCatalogLocale(this.active);
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
		await this.setLocale(config.locale ?? this.requested);
	}

	/**
	 * The locale the strings are served in: the resolved catalog locale once
	 * resident, else the most specific host-message tag on the request's
	 * truncation chain, canonical, else the fallback. A request nothing serves
	 * names the fallback, so a chrome root stamped from it never names a
	 * language its text is not in.
	 */
	getLocale(): string {
		if (this.activeCatalog && this.catalogs.has(this.activeCatalog)) {
			return this.activeCatalog;
		}
		const host = this.hostMessageLocale(this.active);
		return host === undefined
			? this.fallbackLocale
			: (canonicalLanguageTag(host) ?? host);
	}

	/**
	 * The latest `setLocale` request (or the configured `locale`), canonical, as
	 * soon as it is made and whatever its load does. `getLocale` names what is
	 * served instead, so the two differ while a catalog loads, after a load
	 * fails, and for a tag nothing ships.
	 */
	getRequestedLocale(): string {
		return this.requested;
	}

	/**
	 * Switch locale.
	 *
	 * Resolves the request against the catalogs this provider can serve, loads
	 * the winner if it is not resident, then notifies subscribers — in that
	 * order, so a component's reactive read re-runs against a catalog that is
	 * already in place rather than against the previous locale. The last call
	 * wins: a call whose load finishes after a later call's leaves the locale
	 * to that later call.
	 */
	async setLocale(locale: LocaleCode): Promise<void> {
		const request = ++this.requests;
		const tag = requestTag(locale) || DEFAULT_LOCALE;
		this.requested = tag;
		// A tag no catalog serves is legitimate: the host may have supplied its own
		// messages for it, and the fallback chain covers whatever those omit.
		const catalog = this.resolveCatalogLocale(tag);

		// The loader is asked only for tags it declares.
		if (
			catalog &&
			!this.catalogs.has(catalog) &&
			this.config.availableLocales?.includes(catalog)
		) {
			try {
				let load = this.loading.get(catalog);
				if (!load) {
					load = this.loadCatalog(catalog).finally(() => {
						this.loading.delete(catalog);
					});
					this.loading.set(catalog, load);
				}
				await load;
			} catch (error) {
				// A superseded request stays silent: the later one reports its own
				// outcome. The current one notifies, since `getRequestedLocale` moved
				// although the served strings did not, and rejects.
				if (request !== this.requests) return;
				this.notify();
				throw error;
			}
		}

		if (request !== this.requests) return;
		this.active = tag;
		this.activeCatalog = catalog;
		this.notify();
	}

	t(key: MessageKeyInput, values?: InterpolationValues): string {
		const message = this.resolveMessage(key);
		if (message === undefined) {
			this.config.onMissingKey?.(key, this.getLocale());
			return key;
		}
		return interpolate(message, values, this.getLocale());
	}

	/**
	 * Translate a plural group.
	 *
	 * The category comes from `Intl.PluralRules` for the active locale, so a
	 * locale with more than two forms resolves correctly: Arabic selects among
	 * zero/one/two/few/many/other, Polish among one/few/many/other.
	 *
	 * Each form resolves on its own, tier by tier (`resolveMessage`): a host
	 * overriding one category leaves the others to the catalog, and a locale's
	 * own `other` wins over the fallback's `one`. A group no source completes is
	 * a miss and returns the key.
	 */
	plural(key: MessageKeyInput, options: PluralOptions): string {
		const message = this.resolveMessage(
			key,
			this.selectPluralCategory(options.count),
		);
		if (message === undefined) {
			this.config.onMissingKey?.(key, this.getLocale());
			return key;
		}
		return interpolate(message, options, this.getLocale());
	}

	getDirection(): TextDirection {
		return localeDirection(this.getLocale());
	}

	/**
	 * Locales this provider can serve: resident catalogs, whatever the loader
	 * declares, and any locale the host supplied messages for.
	 */
	getAvailableLocales(): string[] {
		const tags = new Set<string>([
			...this.catalogs.keys(),
			...(this.config.availableLocales ?? []),
			...Object.keys(this.customMessages).map(
				(tag) => canonicalLanguageTag(tag) ?? tag,
			),
		]);
		return [...tags];
	}

	isLocaleLoaded(locale: LocaleCode): boolean {
		const resolved = this.resolveCatalogLocale(requestTag(locale));
		return resolved !== undefined && this.catalogs.has(resolved);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	hasKey(key: MessageKeyInput): boolean {
		return this.resolveMessage(key) !== undefined;
	}

	/**
	 * Add or override messages for one locale.
	 *
	 * Deep-merged, so a deployment can override a single label without restating
	 * a catalog, and keyed by normalized tag, so `es-mx` and `es-MX` are one
	 * locale's messages.
	 */
	addCustomMessages(locale: string, messages: MessageCatalog): void {
		this.mergeCustomMessages(locale, messages);
		this.notify();
	}

	private mergeCustomMessages(locale: string, messages: MessageCatalog): void {
		const tag = normalizeLanguageTag(locale);
		if (!tag) return;
		this.customMessages[tag] = deepMerge(
			this.customMessages[tag] ?? {},
			messages,
		);
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
		const tag = requestTag(locale) || DEFAULT_LOCALE;
		if (tag === this.active && tag === this.requested) return this;

		const view = new SimpleI18n({ ...this.config, customMessages: {} });
		view.catalogs = this.catalogs;
		view.customMessages = this.customMessages;
		view.loading = this.loading;
		view.requested = tag;
		view.active = tag;
		view.activeCatalog = view.resolveCatalogLocale(tag);
		return view;
	}

	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		try {
			return new Intl.NumberFormat(this.getLocale(), options).format(value);
		} catch {
			return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value);
		}
	}

	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		try {
			return new Intl.DateTimeFormat(this.getLocale(), options).format(date);
		} catch {
			return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
		}
	}

	/** The resolved catalog for a locale, for a host that wants to inspect it. */
	getBundle(
		locale: LocaleCode = this.getLocale(),
	): TranslationBundle | undefined {
		const tag = this.resolveCatalogLocale(requestTag(locale));
		if (!tag) return undefined;
		const translations = this.catalogs.get(tag);
		if (!translations) return undefined;
		return { locale: tag, translations, direction: localeDirection(tag) };
	}

	/**
	 * Which catalog serves a requested tag, under `findClosestLanguageMatch`
	 * over the resident catalogs and the loader's declared tags. Host messages
	 * take no part: they resolve separately (`hostMessageLocale`), so a host
	 * override for `es-MX` cannot hide a shipped `es`.
	 */
	private resolveCatalogLocale(tag: string): string | undefined {
		if (!tag) return undefined;
		return findClosestLanguageMatch(tag, [
			...this.catalogs.keys(),
			...(this.config.availableLocales ?? []),
		]);
	}

	/** The most specific host-message tag on a request's truncation chain, normalized. */
	private hostMessageLocale(tag: string): string | undefined {
		return languageTagLookupSequence(tag).find(
			(step) => this.customMessages[step] !== undefined,
		);
	}

	private async loadCatalog(locale: string): Promise<void> {
		const load = this.config.loadCatalog;
		if (!load) return;
		try {
			this.catalogs.set(locale, await load(locale));
		} catch (error) {
			// Rethrown with the locale named: `setLocale` rejects before switching
			// (it moves the served state only after the load), so the previous
			// locale stays active.
			throw new Error(`Failed to load i18n catalog for locale: ${locale}`, {
				cause: error,
			});
		}
	}

	/**
	 * Two tiers in lookup order: host messages along the active request's
	 * truncation chain (`es-MX`, then `es`) and the active catalog, then host
	 * messages and the catalog for the fallback locale. Host overrides win, so a
	 * deployment can rename one label without forking a catalog.
	 */
	private sourceTiers(): (MessageCatalog | undefined)[][] {
		return [
			[
				...languageTagLookupSequence(this.active).map(
					(step) => this.customMessages[step],
				),
				this.activeCatalog ? this.catalogs.get(this.activeCatalog) : undefined,
			],
			[
				this.customMessages[normalizeLanguageTag(this.fallbackLocale)],
				this.catalogs.get(this.fallbackLocale),
			],
		];
	}

	/**
	 * The text for `key`. The first source that has it decides its shape: a
	 * string is the text, and a plural group resolves `category`, else `other`,
	 * within the first tier that has a group, so a locale's own `other` wins
	 * over the fallback's `one`. A namespace (`t("common")`) is a miss:
	 * returning the object would put one where the caller expects a string.
	 */
	private resolveMessage(
		key: string,
		category?: keyof PluralTranslation,
	): string | undefined {
		const tiers: PluralTranslation[][] = [];
		for (const tier of this.sourceTiers()) {
			const groups: PluralTranslation[] = [];
			for (const source of tier) {
				const node = readPath(source, key);
				if (typeof node === "string") {
					if (tiers.every((t) => t.length === 0) && groups.length === 0) {
						return node;
					}
				} else if (node !== undefined && isPluralGroup(node)) {
					groups.push(node);
				}
			}
			tiers.push(groups);
		}
		for (const groups of tiers) {
			const form = (name: keyof PluralTranslation) =>
				groups.find((group) => typeof group[name] === "string")?.[name];
			const text =
				(category === undefined ? undefined : form(category)) ?? form("other");
			if (text !== undefined) return text;
		}
		return undefined;
	}

	private selectPluralCategory(count: number): keyof PluralTranslation {
		const locale = this.getLocale();
		let rules = SimpleI18n.pluralRules.get(locale);
		if (!rules) {
			try {
				rules = new Intl.PluralRules(locale);
			} catch {
				return count === 1 ? "one" : "other";
			}
			SimpleI18n.pluralRules.set(locale, rules);
		}
		return rules.select(count) as keyof PluralTranslation;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
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

/**
 * Substitute `{name}` placeholders.
 *
 * A finite numeric value renders through `Intl.NumberFormat` for the active
 * locale, so digits and grouping follow CLDR locale defaults: `ar` renders
 * Arabic-Indic digits, `fr` groups with narrow no-break spaces, `en-US` with
 * commas. Catalog text that spells digits out is untouched.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();

function formatNumber(value: number, locale: string): string {
	let formatter = numberFormats.get(locale);
	if (!formatter) {
		try {
			formatter = new Intl.NumberFormat(locale);
		} catch {
			formatter = new Intl.NumberFormat(DEFAULT_LOCALE);
		}
		numberFormats.set(locale, formatter);
	}
	return formatter.format(value);
}

function interpolate(
	text: string,
	values?: InterpolationValues,
	locale?: string,
): string {
	if (!values) return text;
	return text.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = values[name];
		if (value === undefined || value === null) return match;
		if (
			locale !== undefined &&
			typeof value === "number" &&
			Number.isFinite(value)
		) {
			return formatNumber(value, locale);
		}
		return String(value);
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

let defaultProvider: SimpleI18n | undefined;

/**
 * The graceful default: an English-only provider, shared process-wide.
 *
 * `composition-context.md` requires a resolver to work with no publisher
 * present, and this is that state. A tool mounted bare — in `print-player` or
 * an authoring harness — resolves this and renders English rather than
 * leaking raw message keys onto the screen. It carries no locale loader, so it
 * pulls no catalog beyond the English one already in the bundle.
 */
export function getDefaultI18n(): I18nServiceApi {
	if (!defaultProvider) defaultProvider = new SimpleI18n();
	return defaultProvider;
}

/**
 * Resolve a component's interface-locale provider from a published context.
 *
 * Returns a **fresh** object on every call. A
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
/** The rendering surface `resolveInterfaceI18n` promises. */
export interface ResolvedInterfaceI18n extends I18nProvider {
	/** Locale-aware number formatting, at the resolved locale. */
	formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
	/** Locale-aware date formatting, at the resolved locale. */
	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
}

export function resolveInterfaceI18n(
	source: { i18n?: I18nProvider } | null | undefined,
): ResolvedInterfaceI18n {
	const provider = source?.i18n ?? getDefaultI18n();
	// A thin facade rather than the provider itself: cheap to allocate (a handful
	// of times per session, once per republish) and it carries no state of its own,
	// so it cannot drift from the provider it delegates to. The locale formatters
	// are part of the promised surface, so a provider that does not implement
	// them falls through to `Intl` at the locale the provider resolves — the same
	// thing the bundled provider does, and the same graceful default every other
	// optional member here applies.
	return {
		// Canonical, because components read this for `lang` attributes; the
		// provider's own `getLocale()` keeps the tag as resolved for lookups.
		getLocale: () => {
			const locale = provider.getLocale();
			return canonicalLanguageTag(locale) ?? locale;
		},
		getRequestedLocale: () => requestedLocaleOf(provider),
		setLocale: (locale) => provider.setLocale(locale),
		t: (key, values) => provider.t(key, values),
		plural: (key, options) =>
			provider.plural?.(key, options) ?? provider.t(key, options),
		getDirection: () => provider.getDirection?.() ?? "ltr",
		hasKey: (key) => provider.hasKey?.(key) ?? false,
		subscribe: (listener) => provider.subscribe?.(listener) ?? (() => {}),
		formatNumber: (value, options) =>
			provider.formatNumber?.(value, options) ??
			new Intl.NumberFormat(provider.getLocale(), options).format(value),
		formatDate: (value, options) =>
			provider.formatDate?.(value, options) ??
			new Intl.DateTimeFormat(provider.getLocale(), options).format(value),
	};
}

/**
 * Stamp the interface locale's `lang` and `dir` on a chrome element.
 *
 * The imperative form of the `lang={…} dir={…}` pair a template puts on its
 * root, for the elements a template cannot reach: a shadow host whose chrome
 * is slotted light DOM, a shell built with `document.createElement`, a vanilla
 * element stamping itself. Call it from whatever already re-runs on a locale
 * change and on a catalog load: `getLocale()` moves only once the requested
 * catalog is resident, so a stamp taken at setup alone names the locale that
 * rendered before the load.
 */
export function stampInterfaceLocale(
	target: Element,
	provider: Pick<I18nProvider, "getLocale" | "getDirection">,
): void {
	// `lang` takes the canonical form: a host's own provider may report a tag
	// as the host spelled it, and `NL-nl` is a valid request but not a valid
	// attribute value. Every `lang` this repository writes goes through the
	// same rule, so chrome and content stamps match in shape.
	const locale = provider.getLocale();
	target.setAttribute("lang", canonicalLanguageTag(locale) ?? locale);
	target.setAttribute("dir", provider.getDirection?.() ?? "ltr");
}

/** A provider's requested tag, canonical; `getLocale` for one that does not track requests. */
function requestedLocaleOf(
	provider: Pick<I18nProvider, "getLocale" | "getRequestedLocale">,
): string {
	const locale = provider.getRequestedLocale?.() ?? provider.getLocale();
	return canonicalLanguageTag(locale) ?? locale;
}

/**
 * Whether `provider` was already asked for `locale`. An element handed its
 * owner's provider together with the owner's `locale` skips asking again, so a
 * catalog that fails to load is fetched and reported once, by the owner, and
 * not again by every row and player under it.
 */
export function isLocaleRequested(
	provider: Pick<I18nProvider, "getRequestedLocale">,
	locale: string,
): boolean {
	const requested = provider.getRequestedLocale?.();
	if (!requested) return false;
	return (
		(canonicalLanguageTag(requested) ?? requested) ===
		(canonicalLanguageTag(locale) ?? locale)
	);
}

/**
 * Whether a host chose a player's interface locale: it set the player's
 * `locale`, or supplied a provider that was asked for a locale other than
 * `en-US`.
 *
 * A player answers `interfaceLocaleContext` from the first time this holds,
 * and never before it. An element left unanswered labels its chrome in the
 * language its item declares, which is how an item declaring Spanish keeps
 * Spanish labels under a host that sets no locale; a default `en-US` answer
 * would override that declaration. A supplied provider asked for `en-US` is
 * not a choice, because hosts supply one to add catalogs or messages; a host
 * that wants `en-US` chrome over the item's language sets `locale="en-US"`.
 * Once answering, a player keeps answering, so clearing `locale` republishes
 * `en-US` to the elements that subscribed.
 *
 * The toolkit and the item player both decide through this rule. An item
 * player a section mounts receives the toolkit's provider, so it answers only
 * when the toolkit above it would. Callers re-evaluate it on the provider's
 * change signal, since a supplied provider's locale moves without a property
 * change.
 */
export function hostChoseInterfaceLocale(player: {
	locale?: unknown;
	i18n?: Pick<I18nProvider, "getLocale" | "getRequestedLocale"> | null;
}): boolean {
	if (typeof player.locale === "string" && player.locale.trim() !== "") {
		return true;
	}
	// The request, not the served locale: a provider asked for a tag nothing
	// ships serves `en-US`, and the host still chose that tag.
	if (!player.i18n) return false;
	return requestedLocaleOf(player.i18n) !== DEFAULT_LOCALE;
}

/**
 * The tag a player answers `interfaceLocaleContext` with: its `locale`,
 * canonical, from the moment it is set, else its provider's requested tag.
 *
 * The request rather than the players' own catalog match, because elements
 * resolve the tag against their own catalogs: a host asking for `en-GB` or
 * `fr-CA` reaches the elements' catalogs and host messages for that tag
 * whatever the players ship, and neither a players' catalog still loading nor
 * one that failed holds the elements on the previous locale.
 */
export function requestedInterfaceLocale(player: {
	locale?: unknown;
	i18n: Pick<I18nProvider, "getLocale" | "getRequestedLocale">;
}): string {
	const locale = typeof player.locale === "string" ? player.locale.trim() : "";
	if (locale) return requestTag(locale);
	return requestedLocaleOf(player.i18n);
}
