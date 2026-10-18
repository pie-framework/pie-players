import { goto } from "$app/navigation";
import { page } from "$app/state";

/**
 * Interface locale for the `interface-locale` demo, held in the `locale` search
 * param.
 *
 * That one demo, not the app: a site-wide switcher wrote the chosen tag into
 * every link it was carried through, so a locale picked to look at one recipe
 * followed the reader into the rest — including the demos whose whole point is
 * the English a host that supplies nothing gets. `SectionDemoRuntimePage` reads
 * this only under its `localeSwitcher` prop.
 *
 * The param rather than a store: the demo is then linkable in a second language,
 * which the e2e suite relies on, and a reload cannot lose the choice. Empty means
 * the player is passed nothing, which resolves to `en-US` — not the browser's
 * language — and seeing that is part of what the switcher is for.
 *
 * Reactive by construction: `page` is rune-backed, so a template or a `$derived`
 * that calls this re-runs when the URL changes.
 */
export function demoLocale(): string {
	return page.url.searchParams.get("locale") ?? "";
}

/**
 * A plain `goto`, not a shallow one: shallow routing moves the address
 * bar without invalidating `page.url`, so nothing downstream would re-render.
 * `reset: false` leaves the select focused and keeps a long demo where the
 * reader left it.
 */
export function setDemoLocale(locale: string): void {
	const url = new URL(page.url.href);
	if (locale) url.searchParams.set("locale", locale);
	else url.searchParams.delete("locale");
	void goto(url, { replace: true, reset: false });
}

/** The locales the switcher offers: bundled, generated, and the pseudo-locales. */
export { DEMO_INTERFACE_LOCALES as DEMO_LOCALES } from "./demo-runtime/demo-interface-i18n.js";
