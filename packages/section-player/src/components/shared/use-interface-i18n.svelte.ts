/**
 * Interface-locale resolution for section-player components.
 *
 * The pull half of the composition-context pattern: the toolkit publishes the
 * provider, and any descendant that renders a string of its own resolves it
 * here. One helper rather than the same eight lines in a dozen components, and
 * one place where the graceful default lives.
 *
 * The returned object's `t` re-runs whenever the toolkit republishes its runtime
 * context — on a locale change, and again once a lazily loaded catalog is
 * resident. A component that reads `t` inside `$derived` therefore re-renders;
 * one that captures the string in a plain `const` pins whatever rendered first,
 * which is the same failure mode as a published context with no change signal.
 */

import {
	type AssessmentToolkitRuntimeContext,
	connectToolRuntimeContext,
} from "@pie-players/pie-assessment-toolkit";
import type {
	I18nProvider,
	InterpolationValues,
	MessageKeyInput,
	PluralOptions,
	TextDirection,
} from "@pie-players/pie-players-shared/i18n/types";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

export interface InterfaceI18n {
	/** The resolved provider: the published one, or the English-only default. */
	readonly provider: I18nProvider;
	/** Active locale tag, for stamping `lang`. */
	readonly locale: string;
	/** Writing direction, for stamping `dir`. */
	readonly direction: TextDirection;
	t(key: MessageKeyInput, values?: InterpolationValues): string;
	plural(key: MessageKeyInput, options: PluralOptions): string;
}

/**
 * Resolve the interface-locale provider for a component.
 *
 * @param getHost Returns the element to make the context request from. Any
 *   element inside the player works: requests bubble to the toolkit's provider.
 *   Returning `undefined` before the element is bound is expected, and the
 *   connection is made when it appears.
 */
export function useInterfaceI18n(
	getHost: () => HTMLElement | null | undefined,
): InterfaceI18n {
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);

	$effect(() => {
		const host = getHost();
		if (!host) return;
		// `connectToolRuntimeContext` retries and listens for provider
		// announcements, so a toolkit that mounts after this component still
		// reaches it.
		return connectToolRuntimeContext(host, (value) => {
			runtimeContext = value;
		});
	});

	const provider = $derived(resolveInterfaceI18n(runtimeContext));

	return {
		get provider() {
			return provider;
		},
		get locale() {
			return provider.getLocale();
		},
		get direction() {
			return provider.getDirection?.() ?? "ltr";
		},
		t(key, values) {
			return provider.t(key, values);
		},
		plural(key, options) {
			return provider.plural?.(key, options) ?? provider.t(key, options);
		},
	};
}
