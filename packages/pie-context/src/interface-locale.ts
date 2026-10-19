import { createContext } from "./types.js";

/**
 * The interface locale a player renders its own chrome in, for the PIE
 * elements inside it to render theirs in the same one.
 *
 * A host sets it once on its player (the `locale` attribute, or a provider
 * it supplies), which answers for every element inside it. An element
 * requests it with `subscribe: true`, re-renders on each republish — the value
 * moves on a locale change, and again once a lazily loaded catalog is
 * resident — and resolves the tag against its own catalogs. An unanswered
 * request means `en-US`, left to right.
 *
 * Content language never travels here: a model's `language`, or `Env.locale`,
 * says what the item says, not what the chrome around it says it in.
 *
 * Fields are added, never removed or redefined, because pinned element
 * versions keep reading the shape they shipped with.
 */
export interface InterfaceLocaleContextValue {
	/** BCP-47 tag of the interface locale, as the player resolved it. */
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
