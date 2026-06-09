import { wrapOverwideImages } from "./wrap-overwide-images.js";
import { wrapOverwideTables } from "./wrap-overwide-tables.js";

const RICH_CONTENT_TAG_REGEX = /<(?:img|table)\b/i;
const SKIPPED_KEYS = new Set(["accessibilityCatalogs"]);

function maybeWrapRichContent(value: string): string {
	if (!RICH_CONTENT_TAG_REGEX.test(value)) return value;
	return wrapOverwideTables(wrapOverwideImages(value));
}

function wrapValue(value: unknown, parentKey?: string): unknown {
	if (parentKey && SKIPPED_KEYS.has(parentKey)) return value;
	if (typeof value === "string") return maybeWrapRichContent(value);
	if (!value || typeof value !== "object") return value;

	if (Array.isArray(value)) {
		let changed = false;
		const next = value.map((entry) => {
			const wrapped = wrapValue(entry);
			if (wrapped !== entry) changed = true;
			return wrapped;
		});
		return changed ? next : value;
	}

	const record = value as Record<string, unknown>;
	let changed = false;
	const next: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(record)) {
		const wrapped = wrapValue(entry, key);
		if (wrapped !== entry) changed = true;
		next[key] = wrapped;
	}
	return changed ? next : value;
}

export function wrapModelRichContent<T>(model: T): T {
	return wrapValue(model) as T;
}
