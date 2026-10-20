import {
	BUNDLED_LOCALES,
	createPieI18n,
	loadBundledCatalog,
	PSEUDO_LOCALE_EXPANDED,
	PSEUDO_LOCALE_RTL,
	pseudoLocalize,
	type I18nServiceApi,
} from "@pie-players/pie-players-shared/i18n";
import {
	GENERATED_LOCALES,
	loadGeneratedCatalog,
} from "@pie-players/pie-i18n-generated";

/**
 * Every locale the `localeSwitcher` demo offers: the bundled catalogs, the
 * optional generated tier, and the two pseudo-locales.
 */
export const DEMO_INTERFACE_LOCALES = [
	...BUNDLED_LOCALES,
	...GENERATED_LOCALES,
	PSEUDO_LOCALE_EXPANDED,
	PSEUDO_LOCALE_RTL,
];

/**
 * The provider the `localeSwitcher` demo hands the player through
 * `runtime.i18n` — the composition the generated tier's README shows, plus the
 * pseudo-locales registered as host messages. Bundled first, so a reviewed
 * catalog wins over a generated one for the same tag; the pseudo-locales are
 * host messages and resolve ahead of any catalog.
 *
 * The `locale` attribute still names the locale. The provider is built without
 * one, so an empty switcher keeps `en-US` — the chrome a host that supplies
 * nothing gets, which is part of what the switcher demonstrates.
 */
export async function createDemoInterfaceI18n(): Promise<I18nServiceApi> {
	const pseudo = pseudoLocalize(await loadBundledCatalog("en-US"));
	return createPieI18n({
		availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
		loadCatalog: (locale) =>
			loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale)),
		customMessages: {
			[PSEUDO_LOCALE_EXPANDED]: pseudo,
			[PSEUDO_LOCALE_RTL]: pseudo,
		},
	});
}
