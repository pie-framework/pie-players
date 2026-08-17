/**
 * I18n Type Definitions
 *
 * The provider interface and the key/locale types derived from the English
 * catalog. Defined in `players-shared` to avoid circular dependencies, and kept
 * free of any runtime value so a tool can reach the whole contract through
 * `import type` and compile it away entirely.
 *
 * @module @pie-players/pie-players-shared/i18n/types
 */

import type enUS from "./messages/en-US.js";

/**
 * Locale tags this repository ships a catalog for.
 *
 * Full BCP-47 rather than bare language subtags. Content producers disagree on
 * syntax — the Learnosity transform emits POSIX `nl_NL`, QTI catalog cards carry
 * `xml:lang` — and the resolver normalizes both onto these, so this list is the
 * set of catalogs, not the set of accepted inputs.
 */
export type BundledLocaleCode =
	| "en-US" // English (United States)
	| "nl-NL"; // Dutch (Netherlands)

/**
 * Any locale tag. A host may supply a locale we ship no catalog for and provide
 * its own messages through {@link I18nConfig.customMessages}, so this is
 * deliberately open while still autocompleting the bundled set.
 */
export type LocaleCode = BundledLocaleCode | (string & {});

/**
 * Plural translation forms, keyed by CLDR plural category.
 *
 * Only `other` is required. `Intl.PluralRules` selects the category for the
 * active locale, so a locale with six forms can carry six and a locale with two
 * carries two; a selected category the catalog lacks resolves to `other`.
 */
export interface PluralTranslation {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
}

/** A catalog node: a leaf string, a plural group, or a namespace. */
export type MessageNode =
	| string
	| PluralTranslation
	| { [key: string]: MessageNode };

/** A whole catalog, as one locale module default-exports it. */
export type MessageCatalog = { [key: string]: MessageNode };

type PluralCategoryKey = keyof PluralTranslation;

/**
 * Dot-notation keys of a catalog shape.
 *
 * A plural group terminates the path at the group itself: `plural()` is called
 * with `tools.textToSpeech.charactersSelected`, never with
 * `…charactersSelected.other`. A group is recognized by every one of its keys
 * being a CLDR plural category — the containment has to run this way round,
 * because a group carrying only `one`/`other` does not contain the whole
 * category union.
 */
type NestedKeys<T> = {
	[K in keyof T & string]: T[K] extends string
		? K
		: keyof T[K] extends PluralCategoryKey
			? K
			: T[K] extends object
				? K | `${K}.${NestedKeys<T[K]>}`
				: K;
}[keyof T & string];

/**
 * Every key the English catalog defines.
 *
 * Derived from the catalog's shape rather than maintained alongside it, so a
 * mistyped key is a compile error instead of a raw key rendered on screen. This
 * is what makes the coverage script a completeness check rather than the only
 * line of defence.
 */
export type MessageKey = NestedKeys<typeof enUS>;

/**
 * A key assembled at runtime from an id the catalog cannot enumerate — an
 * element category, a host-authored registration's key. Branded, so the only way
 * to produce one is `dynamicMessageKey` and a mistyped literal stays a compile
 * error at every ordinary call site.
 *
 * The brand is a named property rather than a `unique symbol`: a module-local
 * symbol is not identity-compatible across two emitted copies of this
 * declaration, and packages here resolve `players-shared` to `src` or to `dist`
 * depending on build order.
 */
export type DynamicMessageKey = string & {
	readonly __pieDynamicMessageKey: true;
};

/**
 * A key argument: a catalog key, or an explicitly-asserted computed one. The
 * assertion lives in `provider.ts` as `dynamicMessageKey`, so this module stays
 * type-only.
 */
export type MessageKeyInput = MessageKey | DynamicMessageKey;

/** Interpolation values substituted into `{placeholder}` slots. */
export type InterpolationValues = Record<
	string,
	string | number | boolean | null | undefined
>;

/** Options for {@link I18nProvider.plural}; `count` also interpolates. */
export interface PluralOptions extends InterpolationValues {
	count: number;
}

/** Writing direction of a locale. */
export type TextDirection = "ltr" | "rtl";

/**
 * Translation bundle structure.
 *
 * Retained as the resolved, in-memory form of one locale's catalog.
 */
export interface TranslationBundle {
	locale: string;
	translations: MessageCatalog;
	direction: TextDirection;
}

/**
 * Provider configuration.
 */
export interface I18nConfig {
	/** Initial locale. Defaults to `en-US`; never auto-detected. */
	locale?: LocaleCode;

	/** Locale every missing key falls back to. Defaults to `en-US`. */
	fallbackLocale?: LocaleCode;

	/**
	 * Loader for a locale this repository ships. Omitted, only the statically
	 * bundled English catalog and any `customMessages` are available — which is
	 * exactly what a tool bundle wants, so no locale chunk is emitted into it.
	 */
	loadCatalog?: (locale: string) => Promise<MessageCatalog>;

	/** Locale tags {@link loadCatalog} can serve. */
	availableLocales?: readonly string[];

	/**
	 * Host-supplied messages, keyed by locale tag. Consulted ahead of the
	 * bundled catalog for the same locale, so a deployment can override one
	 * label without forking a catalog, and can supply a locale we do not ship.
	 */
	customMessages?: Record<string, MessageCatalog>;

	/** Called once per missing key per lookup. */
	onMissingKey?: (key: string, locale: string) => void;

	/** Reserved for provider-level diagnostics. */
	debug?: boolean;
}

/**
 * The contract components resolve against.
 *
 * Deliberately small and free of Svelte, DOM and framework types: a component
 * declares `i18n?: I18nProvider`, and a host is free to implement it over
 * i18next, ICU MessageFormat or its own catalog rather than take ours.
 */
export interface I18nProvider {
	/** Active locale tag, canonicalized to the resolved catalog's tag. */
	getLocale(): string;

	/**
	 * Switch locale, loading its catalog if a loader is configured.
	 *
	 * Subscribers are notified once the catalog is in place, so a component's
	 * reactive read re-runs against the new locale rather than the old one.
	 */
	setLocale(locale: LocaleCode): Promise<void> | void;

	/** Translate a key, interpolating `{placeholder}` slots. */
	t(key: MessageKeyInput, values?: InterpolationValues): string;

	/** Translate a plural group, selecting the category for `options.count`. */
	plural?(key: MessageKeyInput, options: PluralOptions): string;

	/**
	 * Writing direction of the active locale.
	 *
	 * Components stamp this onto their own host's `dir`. `direction` is an
	 * inherited CSS property, so one attribute on the host crosses a shadow
	 * boundary into the component's content with no per-node wiring.
	 */
	getDirection?(): TextDirection;

	/**
	 * A view of this provider fixed to another locale.
	 *
	 * Two players on one page can render different interface locales without either
	 * mutating the other's active locale. A provider that cannot produce a view
	 * omits this, and callers fall back to the provider itself.
	 */
	withLocale?(locale: LocaleCode): I18nProvider;

	/** Observe locale and catalog changes. Returns an unsubscribe function. */
	subscribe?(listener: () => void): () => void;

	/** Whether a key resolves in the active locale or its fallback chain. */
	hasKey?(key: MessageKeyInput): boolean;

	/** Locale tags this provider can serve. */
	getAvailableLocales?(): string[];

	/** Whether a locale's catalog is already resident. */
	isLocaleLoaded?(locale: LocaleCode): boolean;

	/** Locale-aware number formatting. */
	formatNumber?(value: number, options?: Intl.NumberFormatOptions): string;

	/** Locale-aware date formatting. */
	formatDate?(date: Date, options?: Intl.DateTimeFormatOptions): string;
}

/**
 * The full service surface of the bundled provider.
 *
 * `I18nProvider` is what components depend on; this is what the provider and
 * the toolkit's `I18nService` wrapper implement, so the optional members above
 * are all present here.
 */
export interface I18nServiceApi extends I18nProvider {
	initialize(config: I18nConfig): Promise<void>;
	plural(key: MessageKeyInput, options: PluralOptions): string;
	getDirection(): TextDirection;
	getAvailableLocales(): string[];
	isLocaleLoaded(locale: LocaleCode): boolean;
	subscribe(listener: () => void): () => void;
	hasKey(key: MessageKeyInput): boolean;
	addCustomMessages(locale: string, messages: MessageCatalog): void;
	withLocale(locale: LocaleCode): I18nProvider;
}
