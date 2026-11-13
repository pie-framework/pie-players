/**
 * The toolkit and players-shared shapes `<pie-print>`'s public declarations name,
 * restated structurally.
 *
 * The print player bundles both packages and imports neither at run time, so a
 * declaration that named them would force every host to install them for types
 * alone. Each type here accepts the real one — `tests/shared-shapes-contract.test.ts`
 * fails the typecheck when it stops doing so — and the player passes the value
 * through to the real code untouched.
 *
 * Where a field's authored shape is validated at run time and print only hands
 * it on (`payload`, a registration's members), the type here is the loosest one
 * that still rejects a value of the wrong kind.
 */

/** A sanitizer for authored item markup, as `@pie-players/pie-players-shared/security` takes it. */
export type PrintMarkupSanitizer = (markup: string) => string;

/** Host policy for the packages `config.elements` may execute. */
export interface PrintElementPackagePolicy {
	/** Exact package names, or exact `name@version` specs, that may execute. */
	allowedPackages: readonly string[];
	/** Require exact semver without build metadata. Defaults to true. */
	requireExactVersions?: boolean;
}

/** URL strategy of an ESM CDN. */
export interface PrintEsmCdnProvider {
	name: string;
	packageJsonUrl(packageVersion: string): string;
	/** URL of `dist/browser/<view>/index.js`; `view` may be a nested path. */
	browserViewUrl(packageVersion: string, view: string): string;
	browserControllerUrl(packageVersion: string): string;
	sharedDependencyUrl(
		dependencyName: string,
		version: string,
		subpath?: string,
	): string;
	/** URL of the package's `./runtime-support` module. */
	runtimeSupportUrl?(packageVersion: string): string;
}

/** A built-in provider name (`"jsdelivr"`, `"esm.sh"`), a custom name, or a provider. */
export type PrintEsmCdnProviderOption = string | PrintEsmCdnProvider;

/** One alternate representation of a content node. */
export interface PrintCatalogCard {
	/** Support the card carries: `spoken`, `sign-language`, `braille`, ... */
	catalog: string;
	language?: string;
	visibility?: string;
	/** The string form of the card's content, for catalog types a string can express. */
	content?: string;
	/** The structured form, interpreted by the capability the card's `catalog` names. */
	payload?: object;
}

/** The accessibility catalog of one content node: its alternates, keyed by `data-catalog-idref`. */
export interface PrintAccessibilityCatalog {
	identifier: string;
	cards: PrintCatalogCard[];
}

/** Parameters by tool id, handed to a tool wherever policy shows it. */
export type PrintToolParameters = {
	[toolId: string]: Record<string, unknown> | undefined;
};

/** A learner's personal needs profile, in tool ids. */
export interface PrintPersonalNeedsProfile {
	/** Tools the learner may turn on. */
	supports: string[];
	/** Tools withheld from the learner; a prohibition outranks a support. */
	prohibitedSupports?: string[];
	activateAtInit?: string[];
	toolParameters?: PrintToolParameters;
}

/** Program policy that refines the profile. */
export interface PrintAssessmentSettings {
	districtPolicy?: {
		blockedTools?: string[];
		requiredTools?: string[];
	};
	testAdministration?: {
		toolOverrides?: Record<string, boolean>;
	};
	toolParameters?: PrintToolParameters;
}

/** An item's required and restricted tools. */
export interface PrintItemSettings {
	requiredTools?: string[];
	restrictedTools?: string[];
	toolParameters?: PrintToolParameters;
}

/**
 * A capability registration, as `@pie-players/pie-assessment-toolkit` defines
 * `ToolRegistration`. The toolkit validates its shape when print registers it,
 * so only the id is stated here.
 */
export interface PrintToolRegistration {
	readonly toolId: string;
	// `any`, not `unknown`: only `any` lets the toolkit's interface satisfy an index signature.
	readonly [member: string]: any;
}
