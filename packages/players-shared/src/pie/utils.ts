/**
 * PIE Utils Module
 *
 * URL building, package name parsing, and session utilities.
 */

import type { ConfigEntity } from "../types";
import type { LoadPieElementsOptions } from "./types";

/**
 * Build URL for fetching PIE element bundles from build service
 */
export const getPieElementBundlesUrl = (
	config: ConfigEntity,
	opts: LoadPieElementsOptions,
): string => {
	const elements = config.elements;
	return `${opts.buildServiceBase}/${encodeURI(Object.values(elements).join("+"))}/${opts.bundleType}`;
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
