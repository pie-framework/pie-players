/**
 * PIE element override helpers.
 *
 * Used to:
 * - parse overrides from URL params
 * - apply overrides to a PIE config (server-side or client-side)
 * - build URLs/params for sharing override state
 */

import { cloneDeep } from "../object/index.js";
import { parsePackageName } from "./utils.js";

export type ElementOverrides = Record<string, string>;

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

	// Create a deep copy of the config to avoid mutating the original
	const updatedConfig = cloneDeep(config);

	// Check if there are elements to override
	if (!updatedConfig.elements) {
		return updatedConfig;
	}

	// Process each override
	for (const [packageName, version] of Object.entries(elementOverrides)) {
		let matched = false;

		// Find the element key that uses this package
		for (const [elementKey, elementPackageValue] of Object.entries(
			updatedConfig.elements,
		)) {
			const elementPackageStr = String(elementPackageValue);

			let basePackageName = "";
			try {
				basePackageName = parsePackageName(elementPackageStr).name;
			} catch {
				console.warn(
					`[pie/overrides] Couldn't parse element package value: ${elementPackageStr}`,
				);
				continue;
			}

			if (basePackageName === packageName) {
				matched = true;

				// Create a new element key with the specified version
				const versionNumber = String(version).replace(/[^0-9.-]/g, "");
				const parts = String(elementKey).split("--version-");
				const baseElementName = parts[0];
				const newElementKey = `${baseElementName}--version-${versionNumber.replace(/\./g, "-")}`;

				// Update the elements map
				updatedConfig.elements[newElementKey] = `${packageName}@${version}`;

				// If the key changed, update markup to reference the new key
				if (newElementKey !== elementKey) {
					if (updatedConfig.markup) {
						updatedConfig.markup = String(updatedConfig.markup).replace(
							new RegExp(elementKey, "g"),
							newElementKey,
						);
					}

					// Remove the old element if we created a new one with a different key
					delete updatedConfig.elements[elementKey];
				}
			}
		}

		if (!matched) {
			console.debug(
				`[pie/overrides] No matching element found for package ${packageName}`,
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
