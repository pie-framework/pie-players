/**
 * PIE element override helpers.
 *
 * Used to:
 * - parse overrides from URL params
 * - apply overrides to a PIE config (server-side or client-side)
 * - build URLs/params for sharing override state
 */

import { cloneDeep } from "../object/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { parsePackageName } from "./utils.js";
import { toPackageVersionedTag } from "./versioned-tag.js";

export type ElementOverrides = Record<string, string>;
const logger = createPieLogger("pie-overrides", () => isGlobalDebugEnabled());

/**
 * Apply element overrides to a PIE config
 * @param config The original PIE config
 * @param elementOverrides Map of element packages to override versions
 * @returns Updated config with overridden elements
 */
export function applyElementOverrides(
	config: any,
	elementOverrides: ElementOverrides,
) {
	if (
		!config ||
		!elementOverrides ||
		Object.keys(elementOverrides).length === 0
	) {
		return config;
	}

	// pie-item contract compatibility: runtime version overrides have historically
	// returned a cloned config with tags renamed for the selected package version.
	const updatedConfig = cloneDeep(config);

	// Check if there are elements to override
	if (!updatedConfig.elements) {
		return updatedConfig;
	}

	const matchedPackages = new Set<string>();
	const tagMappings = new Map<string, string>();
	const elements: Record<string, unknown> = {};

	for (const [elementKey, elementPackageValue] of Object.entries(
		updatedConfig.elements,
	)) {
		const elementPackageStr = String(elementPackageValue);
		try {
			const parsed = parsePackageName(elementPackageStr);
			const overrideVersion = elementOverrides[parsed.name];
			if (overrideVersion === undefined) {
				elements[elementKey] = elementPackageValue;
				continue;
			}

			matchedPackages.add(parsed.name);
			const packageBase = parsed.path
				? `${parsed.name}/${parsed.path}`
				: parsed.name;
			const overriddenPackage = `${packageBase}@${String(overrideVersion).trim()}`;
			const overriddenTag = toPackageVersionedTag(
				elementKey,
				overriddenPackage,
			);
			elements[overriddenTag] = overriddenPackage;
			if (overriddenTag !== elementKey) {
				tagMappings.set(elementKey, overriddenTag);
			}
		} catch {
			logger.debug(
				`Couldn't parse element package value: ${elementPackageStr}`,
			);
			elements[elementKey] = elementPackageValue;
		}
	}

	updatedConfig.elements = elements;

	if (tagMappings.size > 0) {
		if (updatedConfig.markup) {
			const escapeRegExp = (value: string): string =>
				value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const sourceTags = [...tagMappings.keys()]
				.sort((left, right) => right.length - left.length)
				.map(escapeRegExp)
				.join("|");
			const exactTag = new RegExp(
				`(<\\/?)(${sourceTags})(?=[\\t\\n\\f\\r />])`,
				"g",
			);
			updatedConfig.markup = String(updatedConfig.markup).replace(
				exactTag,
				(_match: string, opening: string, tagName: string) =>
					`${opening}${tagMappings.get(tagName) ?? tagName}`,
			);
		}

		if (Array.isArray(updatedConfig.models)) {
			updatedConfig.models = updatedConfig.models.map((model: any) => {
				const overriddenTag = tagMappings.get(model?.element);
				return overriddenTag ? { ...model, element: overriddenTag } : model;
			});
		}
	}

	for (const packageName of Object.keys(elementOverrides)) {
		if (!matchedPackages.has(packageName)) {
			logger.debug(`No matching element found for package ${packageName}`);
		}
	}

	return updatedConfig;
}

/**
 * Apply element version overrides without renaming custom element tags.
 *
 * Unlike `applyElementOverrides`, this helper keeps `config.markup` and
 * `config.elements` keys intact and only updates each matching element package
 * value to the requested version. This is intended for unified `pie-item-player`
 * flows that preserve authored tags at the override boundary; `makeUniqueTags`
 * later derives the effective per-version runtime namespace on a cloned config.
 */
export function applyElementVersionOverridesPreserveTags(
	config: any,
	elementOverrides: ElementOverrides,
) {
	if (
		!config ||
		!elementOverrides ||
		Object.keys(elementOverrides).length === 0
	) {
		return config;
	}

	const updatedConfig = cloneDeep(config);
	if (!updatedConfig.elements || typeof updatedConfig.elements !== "object") {
		return updatedConfig;
	}

	for (const [elementKey, elementPackageValue] of Object.entries(
		updatedConfig.elements,
	)) {
		const elementPackageStr = String(elementPackageValue);
		try {
			const parsed = parsePackageName(elementPackageStr);
			const nextVersion = elementOverrides[parsed.name];
			if (!nextVersion) continue;
			const packageBase = parsed.path
				? `${parsed.name}/${parsed.path}`
				: parsed.name;
			updatedConfig.elements[elementKey] =
				`${packageBase}@${String(nextVersion).trim()}`;
		} catch {
			logger.debug(
				`Couldn't parse element package value: ${elementPackageStr}`,
			);
		}
	}

	return updatedConfig;
}

/**
 * Parse element overrides from URL search params.
 * @returns Map of element package names to versions
 */
export function parseElementOverridesFromUrl(
	searchParams: URLSearchParams,
): ElementOverrides {
	const overrides: ElementOverrides = {};

	// Look for parameters with the pattern pie-overrides[packageName]=version
	for (const [key, value] of searchParams.entries()) {
		if (key.startsWith("pie-overrides[") && key.endsWith("]")) {
			// Extract the package name from between the brackets
			const packageName = key.substring(14, key.length - 1);

			// Ensure the package name format is correct (including @)
			const normalizedPackageName = packageName.startsWith("@")
				? packageName
				: `@${packageName}`;
			overrides[normalizedPackageName] = value;
		}
	}

	return overrides;
}

/**
 * Parse element overrides from current window URL (client-only).
 */
export function parseElementOverridesFromCurrentUrl(): ElementOverrides {
	if (typeof window === "undefined") {
		return {};
	}

	const url = new URL(window.location.href);
	return parseElementOverridesFromUrl(url.searchParams);
}

/**
 * Generate a URL parameter string for an element override
 */
export function formatElementOverrideParam(
	packageName: string,
	version: string,
): string {
	// Normalize the package name for the parameter key (strip leading @)
	const normalizedPackageName = packageName.startsWith("@")
		? packageName.substring(1)
		: packageName;
	return `pie-overrides[${normalizedPackageName}]=${encodeURIComponent(version)}`;
}

/**
 * Creates a URL that preserves existing overrides and adds or updates a new one.
 */
export function addOrUpdateOverrideInUrl(
	url: URL,
	packageName: string,
	version: string,
): string {
	const params = new URLSearchParams(url.search);

	// Remove @ if present for consistency in URL
	const normalizedPackageName = packageName.startsWith("@")
		? packageName.substring(1)
		: packageName;

	// Set the new override
	params.set(`pie-overrides[${normalizedPackageName}]`, version);

	// Create the new URL
	const newUrl = new URL(url.pathname, url.origin);
	newUrl.search = params.toString();
	return newUrl.toString();
}

/**
 * Extract package information from a package string.
 * Intended for UI display.
 */
export function extractPackageInfo(packageStr: string) {
	try {
		const parsed = parsePackageName(String(packageStr));
		return {
			name: parsed.name,
			version: parsed.version || "unknown",
			displayName: parsed.name.split("/").pop() || parsed.name,
		};
	} catch {
		const s = String(packageStr);
		return {
			name: s,
			version: "unknown",
			displayName: s.split("/").pop() || s,
		};
	}
}
