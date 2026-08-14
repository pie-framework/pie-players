/**
 * Types for `token-registry.json`, which this package publishes as
 * `@pie-players/pie-theme/token-registry.json`.
 *
 * The registry is the answer to "what is this token for, and who owns it" for
 * every `--pie-*` name in the repo. `check:theme-tokens` and the registry
 * contract test read it to hold source and registry in agreement; it is exported
 * so a host can render the same answer to a person, rather than maintaining its
 * own list of tokens that drifts the moment one is added here.
 *
 * The JSON is the single source of truth and is emitted to `dist` unchanged.
 * These types describe it; they do not restate it, so there is nothing to keep
 * in sync beyond the unions below, which the contract test pins.
 */

/**
 * How widely a token may be set.
 *
 * `canonical-semantic` is the themeable contract: a host sets these. Everything
 * else narrows — `component-public` is a per-component hook falling back through
 * a canonical token, `package-private` is internal, and `unsupported` and
 * `legacy` name tokens that exist but must not be adopted.
 */
export type PieThemeTokenScope =
	| "canonical-semantic"
	| "component-public"
	| "package-private"
	| "unsupported"
	| "legacy";

/** Whether the token is live. Non-`active` entries document a decision. */
export type PieThemeTokenStatus =
	| "active"
	| "deprecated"
	| "intentional-gap"
	| "planned";

/**
 * Whether a color scheme must, may, or must not set a token.
 *
 * Built-in schemes are complete for `required` tokens. Registered custom
 * schemes may set `required` and `optional` tokens, while `excluded` tokens stay
 * under their existing owner or fallback chain.
 */
export type PieThemeSchemeParticipation = "required" | "optional" | "excluded";

export interface PieThemeTokenRegistryEntry {
	/** The custom property, including the leading `--`. */
	name: string;
	/** Package that owns the token's meaning and may change it. */
	owner: string;
	scope: PieThemeTokenScope;
	/**
	 * What the token is for — `surface`, `button`, `feedback`, `focus` and so on.
	 * Deliberately a plain string rather than a union: a new component category
	 * arrives with the component, and pinning the set here would make adding one a
	 * change to this file.
	 */
	category: string;
	status: PieThemeTokenStatus;
	/** The token's role in built-in and registered custom color schemes. */
	schemeParticipation: PieThemeSchemeParticipation;
	/** Repo-relative paths that define the token. */
	definedIn: string[];
	/** Repo-relative paths that document it. */
	documentedIn?: string[];
	/** Why the token exists and what it must fall back through. */
	fallbackPolicy?: string;
}

export type PieThemeTokenRegistry = PieThemeTokenRegistryEntry[];
