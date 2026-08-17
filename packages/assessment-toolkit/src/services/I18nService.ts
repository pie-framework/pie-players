/**
 * I18nService
 *
 * The toolkit's view of the shared i18n provider: a delegating wrapper over
 * `SimpleI18n` from `players-shared` that adds toolkit-scoped logging and wires
 * the lazy catalog loaders.
 *
 * It was once a near-verbatim second copy of that class — same fields, same
 * lookup, same plural selection. Duplicate implementations of one contract drift
 * silently, because nothing fails when only one of them is fixed. Keep this a
 * wrapper.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	I18nConfig,
	I18nProvider,
	I18nServiceApi,
	InterpolationValues,
	LocaleCode,
	MessageCatalog,
	MessageKeyInput,
	PluralOptions,
	TextDirection,
} from "@pie-players/pie-players-shared/i18n";
import { createPieI18n } from "@pie-players/pie-players-shared/i18n";
import { createLogger } from "../utils/logger.js";

const log = createLogger("I18nService");

export type {
	I18nConfig,
	I18nProvider,
	I18nServiceApi,
	InterpolationValues,
	LocaleCode,
	MessageCatalog,
	MessageKeyInput,
	PluralOptions,
	TextDirection,
};

/**
 * Toolkit-scoped i18n service.
 *
 * Serves every locale this repository ships, English resident and the rest
 * lazily loaded.
 */
export class I18nService implements I18nServiceApi {
	private readonly i18n: I18nServiceApi;

	constructor(config: I18nConfig = {}) {
		this.i18n = createPieI18n(config);
		log("I18nService created", {
			locale: this.i18n.getLocale(),
			fallbackLocale: config.fallbackLocale ?? "en-US",
		});
	}

	/**
	 * Set the locale, loading its catalog first.
	 *
	 * Never falls back to the browser locale: a rendered-string change reaches a
	 * host's live delivery on their next install with no build signal on their
	 * side, so the locale has to be something the host asked for.
	 */
	async initialize(config: I18nConfig): Promise<void> {
		log(`Initializing with locale: ${config.locale ?? this.i18n.getLocale()}`);
		await this.i18n.initialize(config);
	}

	t(key: MessageKeyInput, values?: InterpolationValues): string {
		return this.i18n.t(key, values);
	}

	plural(key: MessageKeyInput, options: PluralOptions): string {
		return this.i18n.plural(key, options);
	}

	getLocale(): string {
		return this.i18n.getLocale();
	}

	async setLocale(locale: LocaleCode): Promise<void> {
		log(`Setting locale to: ${locale}`);
		await this.i18n.setLocale(locale);
	}

	getDirection(): TextDirection {
		return this.i18n.getDirection();
	}

	getAvailableLocales(): string[] {
		return this.i18n.getAvailableLocales();
	}

	isLocaleLoaded(locale: LocaleCode): boolean {
		return this.i18n.isLocaleLoaded(locale);
	}

	subscribe(listener: () => void): () => void {
		return this.i18n.subscribe(listener);
	}

	hasKey(key: MessageKeyInput): boolean {
		return this.i18n.hasKey(key);
	}

	addCustomMessages(locale: string, messages: MessageCatalog): void {
		this.i18n.addCustomMessages(locale, messages);
	}

	withLocale(locale: LocaleCode): I18nProvider {
		return this.i18n.withLocale(locale);
	}

	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		return this.i18n.formatNumber?.(value, options) ?? String(value);
	}

	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		return this.i18n.formatDate?.(date, options) ?? date.toISOString();
	}
}
