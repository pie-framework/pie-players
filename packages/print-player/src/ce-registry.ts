/**
 * Custom Element Registry Management
 *
 * Provides safe custom element registration with state tracking to prevent
 * duplicate registrations and handle edge cases.
 *
 * Ported from pie-print-support/src/ce.ts
 */

import { attemptCustomElementDefine } from "@pie-players/pie-players-shared/pie";
import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";

interface DefinitionState {
	inProgress?: boolean;
	ready?: boolean;
	error?: Error;
}

const definitions = new Map<string, DefinitionState>();

/**
 * Safely define a custom element, preventing duplicate registrations
 *
 * @param name - Custom element tag name
 * @param def - Custom element constructor
 */
export const define = (name: string, def: CustomElementConstructor): void => {
	const validName = validateCustomElementTag(name, "print element tag");
	const existing = definitions.get(validName);

	if (existing) {
		if (existing.ready) {
			return;
		}
		if (existing.inProgress) {
			return;
		}
		if (existing.error) {
			throw existing.error;
		}
	}

	definitions.set(validName, { inProgress: true });

	// Different print element tags can resolve to the same already-loaded
	// custom-element class; `allowWrappedFallback` retries under a distinct
	// wrapper subclass instead of failing the whole markup pass.
	const attempt = attemptCustomElementDefine(validName, def, "print element tag", {
		allowWrappedFallback: true,
	});

	if (attempt.outcome === "wrapped-error") {
		console.error("[ce-registry] Wrapped class failed", attempt.error);
	}
	if (attempt.outcome === "error" || attempt.outcome === "wrapped-error") {
		definitions.set(validName, {
			inProgress: false,
			error: attempt.error as Error,
		});
		return;
	}

	customElements
		.whenDefined(validName)
		.then(() => {
			definitions.set(validName, { inProgress: false, ready: true });
		})
		.catch((e) => {
			definitions.set(validName, { inProgress: false, error: e });
		});
};

/**
 * Get the current status of a custom element definition
 *
 * @param name - Custom element tag name
 * @returns Status string indicating registration state
 */
export const status = (
	name: string,
): "error" | "inProgress" | "none" | "inRegistry" => {
	const validName = validateCustomElementTag(name, "print element tag");
	const existing = definitions.get(validName);

	if (existing) {
		if (existing.inProgress) {
			return "inProgress";
		}
		if (existing.ready) {
			return "inRegistry";
		}
		if (existing.error) {
			return "error";
		}
	}
	return "none";
};

/**
 * Wait for a custom element to be defined
 *
 * @param name - Custom element tag name
 * @returns Promise that resolves when element is defined
 */
export const whenDefined = (
	name: string,
): Promise<CustomElementConstructor> => {
	const validName = validateCustomElementTag(name, "print element tag");
	return customElements.whenDefined(validName);
};
