/**
 * Custom element tag helpers for PIE runtime loaders/players.
 */

const RESERVED_TAG_NAMES = new Set([
	"annotation-xml",
	"color-profile",
	"font-face",
	"font-face-src",
	"font-face-uri",
	"font-face-format",
	"font-face-name",
	"missing-glyph",
]);

const TAG_FORMAT = /^[a-z][a-z0-9._-]*-[a-z0-9._-]*$/;

export type PieViewMode = "delivery" | "author" | "print";

export const VIEW_TAG_SUFFIX: Record<PieViewMode, string> = {
	delivery: "",
	author: "-config",
	print: "-print",
};

/**
 * Validate a custom element tag name according to platform constraints.
 */
export const validateCustomElementTag = (
	name: string,
	context = "custom element tag",
): string => {
	if (!name || typeof name !== "string") {
		throw new Error(`Invalid ${context}: expected a non-empty string`);
	}

	const normalized = name.trim();
	if (!normalized) {
		throw new Error(`Invalid ${context}: tag is empty`);
	}

	if (normalized !== normalized.toLowerCase()) {
		throw new Error(
			`Invalid ${context} "${normalized}": custom element names must be lowercase`,
		);
	}

	if (!normalized.includes("-")) {
		throw new Error(
			`Invalid ${context} "${normalized}": custom element names must include a hyphen`,
		);
	}

	if (RESERVED_TAG_NAMES.has(normalized)) {
		throw new Error(
			`Invalid ${context} "${normalized}": this name is reserved by the HTML spec`,
		);
	}

	if (!TAG_FORMAT.test(normalized)) {
		throw new Error(
			`Invalid ${context} "${normalized}": allowed characters are lowercase letters, numbers, ".", "_" and "-"`,
		);
	}

	return normalized;
};

/**
 * Create a deterministic tag for a view-specific element class.
 */
export const toViewTag = (
	baseTag: string,
	view: PieViewMode | string,
	customSuffix?: string,
): string => {
	const suffix =
		customSuffix ??
		(VIEW_TAG_SUFFIX[view as PieViewMode] !== undefined
			? VIEW_TAG_SUFFIX[view as PieViewMode]
			: "");
	return `${baseTag}${suffix}`;
};

/**
 * Build a safe print tag by appending a deterministic, positive hash suffix.
 */
export const toPrintHashedTag = (
	baseTag: string,
	hashSource: string,
	hashFn: (value: string) => number,
): string => {
	const hash = Math.abs(hashFn(hashSource));
	return `${baseTag}-print-${hash}`;
};
