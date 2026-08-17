import { goto } from "$app/navigation";
import { page } from "$app/state";
import { BUNDLED_LOCALES } from "@pie-players/pie-players-shared/i18n";

/**
 * Interface locale for the demo chrome, held in the `locale` search param.
 *
 * The param rather than a store: a demo is then linkable in a second language,
 * which the e2e suite already relies on, and a reload cannot lose the choice.
 * Empty means the demo passes the players nothing, which resolves to `en-US` —
 * not the browser's language — and seeing that is part of what the switcher is
 * for.
 *
 * Reactive by construction: `page` is rune-backed, so a template or a `$derived`
 * that calls this re-runs when the URL changes.
 */
export function demoLocale(): string {
	return page.url.searchParams.get("locale") ?? "";
}

/**
 * `goto` rather than shallow `replaceState`: shallow routing moves the address
 * bar without invalidating `page.url`, so nothing downstream would re-render.
 * `keepFocus` leaves the select focused, and `noScroll` keeps a long demo where
 * the reader left it.
 */
export function setDemoLocale(locale: string): void {
	const url = new URL(page.url);
	if (locale) url.searchParams.set("locale", locale);
	else url.searchParams.delete("locale");
	void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
}

/** The locales the players ship a catalog for. */
export const DEMO_LOCALES = BUNDLED_LOCALES;
