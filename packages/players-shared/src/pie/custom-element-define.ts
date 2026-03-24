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

export const defineCustomElementSafely = (
	tagName: string,
	constructor: CustomElementConstructor,
	context = "custom element tag",
): SafeDefineResult => {
	const validTagName = validateCustomElementTag(tagName, context);
	if (customElements.get(validTagName)) {
		return { status: "already-defined", tagName: validTagName };
	}

	try {
		customElements.define(validTagName, constructor);
		return { status: "defined", tagName: validTagName };
	} catch (error) {
		if (!isDuplicateDefineError(error)) {
			throw error;
		}

		if (customElements.get(validTagName)) {
			return { status: "already-defined", tagName: validTagName };
		}

		throw error;
	}
};
