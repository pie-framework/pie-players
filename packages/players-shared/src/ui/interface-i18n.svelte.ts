/**
 * A custom element's interface locale, resolved as `<pie-item-player>` resolves its own. The `i18n`
 * property's provider wins; without one, a provider is built here on first use. `locale` drives
 * whichever provider is in play, and with no `locale` a supplied provider keeps the locale its
 * owner set. An element that hands its provider to the elements it renders, as `<pie-item-list>`
 * does to its rows and each row to its player, builds one for all of them.
 *
 * Source-only: a sibling resolves it through `svelte-source-aliases.ts`.
 */

import {
	createPieI18n,
	DEFAULT_LOCALE,
	type I18nProvider,
	reportInterfaceLocaleLoadError,
	resolveInterfaceI18n,
} from "@pie-players/pie-players-shared/i18n";
import { untrack } from "svelte";

export interface InterfaceI18n {
	/** The provider in play, stable across catalog loads, for handing to nested elements. */
	readonly provider: I18nProvider;
	/** A fresh facade on every locale change and catalog load, so labels read through it re-render. */
	readonly messages: ReturnType<typeof resolveInterfaceI18n>;
}

export function useInterfaceI18n(
	host: HTMLElement,
	source: string,
	props: () => { i18n?: I18nProvider | null; locale?: string },
): InterfaceI18n {
	let owned: I18nProvider | undefined;
	const provider = $derived(props().i18n ?? (owned ??= createPieI18n()));
	let version = $state(0);

	$effect(() =>
		provider.subscribe?.(() => {
			version += 1;
		}),
	);
	$effect(() => {
		const { locale } = props();
		const requested = typeof locale === "string" ? locale.trim() : "";
		const target = provider;
		if (!requested && target !== owned) return;
		untrack(() => {
			// Every key still resolves through the English fallback chain, so a failed load is reported, not fatal.
			void Promise.resolve(target.setLocale(requested || DEFAULT_LOCALE)).catch((error) => {
				reportInterfaceLocaleLoadError(host, source, error);
			});
		});
	});
	// `version` is an argument, so a TypeScript pass that drops a bare `void version` keeps the dependency.
	const messages = $derived(facade(provider, version));

	return {
		get provider() {
			return provider;
		},
		get messages() {
			return messages;
		},
	};
}

function facade(provider: I18nProvider, _version: number): ReturnType<typeof resolveInterfaceI18n> {
	return resolveInterfaceI18n({ i18n: provider });
}
