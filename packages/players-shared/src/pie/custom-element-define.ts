import { validateCustomElementTag } from "./tag-names.js";

export type SafeDefineStatus = "already-defined" | "defined";

export type SafeDefineResult = {
	status: SafeDefineStatus;
	tagName: string;
};

const isDuplicateDefineError = (error: unknown): boolean => {
	if (typeof DOMException !== "undefined" && error instanceof DOMException) {
		return (
			error.name === "NotSupportedError" ||
			error.code === DOMException.NOT_SUPPORTED_ERR
		);
	}

	const maybeName =
		typeof error === "object" && error !== null && "name" in error
			? String((error as { name?: unknown }).name)
			: "";
	return maybeName === "NotSupportedError";
};

export type SafeDefineOutcome =
	| "defined"
	| "already-defined"
	| "defined-wrapped"
	| "error"
	| "wrapped-error";

export interface SafeDefineAttempt {
	outcome: SafeDefineOutcome;
	tagName: string;
	error?: unknown;
}

export interface AttemptCustomElementDefineOptions {
	/**
	 * The browser rejects registering a constructor that's already
	 * registered under a different tag name with the same
	 * `NotSupportedError` used for a duplicate *tag* registration. When set,
	 * a collision that isn't actually a same-tag duplicate (`customElements.get`
	 * still doesn't return the tag after the failed define) is retried once
	 * with a distinct wrapper subclass so this tag name still ends up defined.
	 */
	allowWrappedFallback?: boolean;
}

/**
 * Attempt to define a custom element, classifying the outcome instead of
 * throwing, so callers with different error-surfacing conventions (throw vs.
 * record-and-continue) can build their own public behavior on one shared
 * duplicate-define/collision core.
 */
export const attemptCustomElementDefine = (
	tagName: string,
	elementConstructor: CustomElementConstructor,
	context = "custom element tag",
	options: AttemptCustomElementDefineOptions = {},
): SafeDefineAttempt => {
	const validTagName = validateCustomElementTag(tagName, context);
	if (customElements.get(validTagName)) {
		return { outcome: "already-defined", tagName: validTagName };
	}

	try {
		customElements.define(validTagName, elementConstructor);
		return { outcome: "defined", tagName: validTagName };
	} catch (error) {
		if (!isDuplicateDefineError(error)) {
			return { outcome: "error", tagName: validTagName, error };
		}

		if (customElements.get(validTagName)) {
			return { outcome: "already-defined", tagName: validTagName };
		}

		if (!options.allowWrappedFallback) {
			return { outcome: "error", tagName: validTagName, error };
		}

		try {
			customElements.define(
				validTagName,
				class extends elementConstructor {},
			);
			return { outcome: "defined-wrapped", tagName: validTagName };
		} catch (wrappedError) {
			return {
				outcome: "wrapped-error",
				tagName: validTagName,
				error: wrappedError,
			};
		}
	}
};

export const defineCustomElementSafely = (
	tagName: string,
	elementConstructor: CustomElementConstructor,
	context = "custom element tag",
): SafeDefineResult => {
	const attempt = attemptCustomElementDefine(tagName, elementConstructor, context);
	if (attempt.outcome === "error" || attempt.outcome === "wrapped-error") {
		throw attempt.error;
	}
	return {
		status: attempt.outcome === "already-defined" ? "already-defined" : "defined",
		tagName: attempt.tagName,
	};
};
