/**
 * PIE Utils Module
 *
 * URL building, package name parsing, and session utilities.
 */

import type { ConfigEntity } from "../types/index.js";
import type { LoadPieElementsOptions } from "./types.js";

/**
 * Characters an element package spec may carry into a bundle path unescaped.
 *
 * `@` and `/` are in the set because the build service route is
 * `<host>/<spec>+<spec>.../<bundleType>`, and a scoped spec
 * (`@pie-element/multiple-choice@9.9.1`) spans path segments inside it —
 * escaping either yields a path the service does not match. The rest is the
 * RFC 3986 unreserved set, which covers every npm package name and every
 * semver version. The `u` flag makes a surrogate pair match as one code
 * point, so an astral character encodes as a whole character.
 */
const BUNDLE_PATH_LITERAL_CHARS = /[^A-Za-z0-9\-._~@/]/gu;

/** Path segments the URL parser resolves away before a request is sent. */
const DOT_SEGMENTS = new Set([".", ".."]);

/**
 * Percent-encode one element package spec for a build-service bundle path.
 *
 * `config.elements` is authored content, so a spec must not be able to
 * restructure the URL. Escaping everything outside
 * {@link BUNDLE_PATH_LITERAL_CHARS} is what stops it: `#` no longer truncates
 * the path at a fragment, `?` no longer turns the remainder into a query
 * string (which in `buildBundleUrl` also swallowed the real `?elements=`
 * parameter), `\` is no longer normalized to `/` by the URL parser, `%` can
 * no longer smuggle an escape the build service decodes back into a
 * separator, and an in-spec `+` becomes `%2B` instead of a phantom package
 * boundary.
 *
 * Both blanket encoders are wrong here, so do not "simplify" to either.
 * `encodeURI` — what this replaced — leaves `/`, `?`, `#` and `%` alone.
 * `encodeURIComponent` escapes `/` and `@`, which this route needs literal;
 * it is correct for the `elements=` query value, which is why both encoders
 * appear in `buildBundleUrl`.
 */
export const encodeElementPackageSpec = (spec: string): string => {
	const escaped = spec.replace(BUNDLE_PATH_LITERAL_CHARS, (char) =>
		encodeURIComponent(char),
	);
	const segments = escaped.split("/");
	// A literal `/` next to a `.` or `..` segment is the one remaining way
	// authored content rewrites the path: the URL parser resolves dot segments
	// before the request is sent, so `@pie-element/../../x` would leave the
	// bundles route. Percent-encoding the dots does not help — the parser
	// recognizes `%2e` as a dot segment as well. Escaping every `/` in such a
	// spec collapses it into one inert segment that 404s inside the route. No
	// npm package name or subpath is `.` or `..`, so nothing legitimate takes
	// this branch.
	return segments.some((segment) => DOT_SEGMENTS.has(segment))
		? segments.join("%2F")
		: escaped;
};

/**
 * Encode each element package spec and join them with the literal `+` the
 * legacy IIFE bundle route uses as its package separator. Encoding the joined
 * string instead would escape the separator. That same separator is why
 * `element-package-policy` rejects semver build metadata.
 */
export const encodeElementPackageSpecs = (specs: Iterable<string>): string =>
	Array.from(specs, encodeElementPackageSpec).join("+");

/**
 * Build URL for fetching PIE element bundles from build service
 */
export const getPieElementBundlesUrl = (
	config: ConfigEntity,
	opts: LoadPieElementsOptions,
): string => {
	const elements = config.elements;
	return `${opts.buildServiceBase}/${encodeElementPackageSpecs(Object.values(elements))}/${opts.bundleType}`;
};

/**
 * Parse a package name string into its components
 *
 * NOTE: Duplicated because we can't have any server-side code in the client
 *
 * Examples:
 * - "@pie-element/multiple-choice@9.9.1" → { name: "@pie-element/multiple-choice", path: "", version: "9.9.1" }
 * - "lodash/get@4.4.2" → { name: "lodash", path: "get", version: "4.4.2" }
 */
export const parsePackageName = (
	input: string,
): { name: string; path: string; version: string } => {
	if (!input) {
		throw new Error("Parameter is required: input");
	}
	const matched =
		input.charAt(0) === "@"
			? input.match(/^(@[^/]+\/[^/@]+)(?:\/([^@]+))?(?:@([\s\S]+))?/) // scoped package name regex
			: input.match(/^([^/@]+)(?:\/([^@]+))?(?:@([\s\S]+))?/); // normal package name
	if (!matched) {
		throw new Error(`[parse-package-name] "${input}" is not a valid string`);
	}
	return {
		name: matched[1],
		path: matched[2] || "",
		version: matched[3] || "",
	};
};

/**
 * Strip versions from a package string
 *
 * Example: "@pie-element/multiple-choice@9.9.1+@pie-element/hotspot@9.1.0"
 *       → "@pie-element/multiple-choice+@pie-element/hotspot"
 */
export const getPackageWithoutVersion = (packages: string): string =>
	packages
		.split("+")
		.map((p) => parsePackageName(p).name)
		.join("+");

/**
 * Find or add a session entry for a given element
 *
 * TODO: kinda gnarly, copied from player project
 *
 * @param data - Session data array
 * @param id - Model/element ID
 * @param element - Element tag name (optional)
 * @returns The session entry
 */
export const findOrAddSession = (
	data: any[],
	id: string,
	element?: string,
): any => {
	if (!data) {
		throw new Error("session data is required");
	}
	const s = data.find((d) => d.id === id);
	if (s) {
		// Update element property if provided and not already set
		if (element && !s.element) {
			s.element = element;
		}
		return s;
	}
	const ss = element ? { id, element } : { id };
	data.push(ss);
	return ss;
};
