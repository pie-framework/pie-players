import type { ItemSummary } from "./summarize-item.js";

const SOURCES = new Set(["summary", "prompt", "label"]);
const MEDIA_KINDS = new Set(["audio", "video"]);

/**
 * True when `value` holds to `ItemSummary` schema 1, field by field. A precomputed summary that
 * fails is recomputed from the item config. Unknown fields are ignored.
 */
export function isItemSummary(value: unknown): value is ItemSummary {
	if (!isRecord(value) || value.schema !== 1) return false;
	if (!optional(value.stem, isString)) return false;
	return Array.isArray(value.entries) && value.entries.every(isEntry);
}

function isEntry(value: unknown): boolean {
	return (
		isRecord(value) &&
		isString(value.id) &&
		isString(value.pkg) &&
		typeof value.source === "string" &&
		SOURCES.has(value.source) &&
		isString(value.label) &&
		isElementSummary(value.summary)
	);
}

function isElementSummary(value: unknown): boolean {
	return (
		isBlock(value) &&
		optional(value.parts, (parts) => Array.isArray(parts) && parts.every(isPart)) &&
		optional(value.figure, isFigure) &&
		optional(value.media, (media) => Array.isArray(media) && media.every(isMedia)) &&
		optional(value.manualScoring, (flag) => typeof flag === "boolean")
	);
}

function isPart(value: unknown): boolean {
	return isBlock(value) && optional(value.id, isString);
}

/** The fields a summary and its parts share. */
function isBlock(value: unknown): value is Record<string, unknown> {
	return (
		isRecord(value) &&
		optional(value.prompt, isString) &&
		optional(value.answer, isString) &&
		optional(value.options, (options) => Array.isArray(options) && options.every(isOption))
	);
}

function isOption(value: unknown): boolean {
	return (
		isRecord(value) &&
		isString(value.id) &&
		isString(value.label) &&
		optional(value.correct, (flag) => typeof flag === "boolean") &&
		optional(value.group, isString)
	);
}

function isFigure(value: unknown): boolean {
	return isRecord(value) && isString(value.src) && optional(value.alt, isString);
}

function isMedia(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.kind === "string" &&
		MEDIA_KINDS.has(value.kind) &&
		optional(value.src, isString) &&
		optional(value.title, isString)
	);
}

function optional(value: unknown, check: (value: unknown) => boolean): boolean {
	return value === undefined || check(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
