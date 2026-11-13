import { createContext } from "./types.js";

/**
 * The interface locale a player renders its own chrome in, for the PIE
 * elements inside it to render theirs in the same one.
 *
 * A host sets it once on its player (the `locale` attribute, or a provider
 * it supplies), which answers for every element inside it. An element
 * requests it with `subscribe: true`, re-renders on each republish — the value
 * moves when the host's requested tag does — and resolves the tag against its
 * own catalogs.
 *
 * Invariant: a player answers only once a host chose a locale, and stays
 * silent before that, so an unanswered request means "no locale chosen". The
 * element then falls back to the language its item declares, else `en-US`
 * left to right; that fallback is how items declaring Spanish keep Spanish
 * labels under hosts that set no locale. A player answering `en-US` by
 * default would override it, which is why the rule lives in one function,
 * `hostChoseInterfaceLocale` in `@pie-players/pie-players-shared/i18n`.
 *
 * Content language never travels here: a model's `language`, or `Env.locale`,
 * says what the item says, not what the chrome around it says it in.
 *
 * Fields are added, never removed or redefined, because pinned element
 * versions keep reading the shape they shipped with.
 */
export interface InterfaceLocaleContextValue {
	/**
	 * BCP-47 tag of the interface locale the host asked for, canonical. It is
	 * the request and never the players' own catalog match, so an element
	 * shipping a catalog the players do not still serves it.
	 */
	locale: string;
	/**
	 * Writing direction of that locale, for the `dir` an element stamps on the
	 * chrome it renders. Published beside the tag so one derivation serves the
	 * player and every element, rather than each bundle carrying its own.
	 */
	direction: "ltr" | "rtl";
}

/**
 * `Symbol.for`, so every element's bundled copy of this package requests the
 * same key the player provides.
 */
export const interfaceLocaleContext = createContext<InterfaceLocaleContextValue>(
	Symbol.for("pie.interfaceLocale"),
);
