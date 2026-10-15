/**
 * The AfA PNP 3.0 adapter: an AfA record, as JSON keyed by the spec's
 * kebab-case terms, becomes the toolkit's personal-needs profile.
 *
 * Each feature the record names is a support id, the term camelCased, except
 * where a packaged tool carries the capability under an id of its own
 * (`TOOL_REGISTRY.md`, Support ids). `spoken` resolves by its `reading-type`:
 * `computer-read-aloud` is `textToSpeech`, and `screen-reader`, AfA's default,
 * is `screenReader` (ADR 0004). `extensions` and the resource-matching
 * preferences name no support and are skipped.
 *
 * A feature at the record's root or in `activate-as-option-set` is granted, one
 * in `activate-at-initialization-set` is granted and on at start, and one in
 * `prohibit-set` is prohibited, which withdraws it from both. The settings of
 * a feature a packaged tool reads become that tool's `toolParameters`.
 */

import type {
	PersonalNeedsProfile,
	ToolParameters,
} from "@pie-players/pie-players-shared/types";

/** `spoken`'s settings, in AfA's units. */
export interface AfaSpoken {
	"reading-type"?: "screen-reader" | "computer-read-aloud";
	/** Words per minute; AfA's default is 180. */
	"speech-rate"?: number;
	/** 0–1; AfA's default is 0.5. */
	pitch?: number;
	/** 0–1; AfA's default is 0.5. */
	volume?: number;
	[setting: string]: unknown;
}

/** A set's features: empty elements keyed by feature, or the feature names. */
export type AfaFeatureSet = Readonly<Record<string, unknown>> | readonly string[];

/** An AfA PNP 3.0 record in JSON. A feature is present unless absent, `null` or `false`. */
export interface AfaPnpRecord {
	spoken?: AfaSpoken;
	"calculator-on-screen"?: { "calculator-type"?: string; [setting: string]: unknown };
	"sign-language"?: { language?: string; [setting: string]: unknown };
	/** `all-content` is the starting zoom, a multiplier above 1. */
	magnification?: { "all-content"?: number; [setting: string]: unknown };
	"activate-at-initialization-set"?: AfaFeatureSet;
	"activate-as-option-set"?: AfaFeatureSet;
	"prohibit-set"?: AfaFeatureSet;
	[feature: string]: unknown;
}

const RENAMED_FEATURES: Readonly<Record<string, string>> = {
	"calculator-on-screen": "calculator",
	"answer-masking": "answerEliminator",
	"dictionary-on-screen": "dictionary",
};

/**
 * Keys that name no support: the sets, `extensions`, and the preferences that
 * select among adapted resources by metadata PIE content does not carry. The
 * interface language is the host's `locale`.
 */
const NON_SUPPORT_KEYS = new Set([
	"activate-at-initialization-set",
	"activate-as-option-set",
	"prohibit-set",
	"extensions",
	"access-mode-required",
	"adaptation-type-required",
	"at-interoperable",
	"educational-complexity-of-adaptation",
	"hazard-avoidance",
	"input-requirements",
	"language-of-adaptation",
	"language-of-interface",
	"adaptation-detail-required",
	"adaptation-media-required",
	"educational-level-of-adaptation",
]);

/** AfA's `standard` calculator has no PIE type, so it keeps the tool's default. */
const CALCULATOR_TYPES = new Set(["basic", "scientific", "graphing"]);

/** AfA's default `speech-rate`, which PIE's normal speed 1 stands for. */
const AFA_NORMAL_SPEECH_RATE = 180;

const isPresent = (value: unknown): boolean =>
	value !== undefined && value !== null && value !== false;

const finiteNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const camelCase = (term: string): string =>
	term.replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase());

function featureNames(set: AfaFeatureSet | undefined): string[] {
	if (!set) return [];
	const names = Array.isArray(set)
		? set.filter((name) => typeof name === "string")
		: Object.entries(set)
				.filter(([, value]) => isPresent(value))
				.map(([name]) => name);
	return names.filter((name) => !NON_SUPPORT_KEYS.has(name));
}

function spokenParameters(
	spoken: AfaSpoken,
): NonNullable<ToolParameters["textToSpeech"]> {
	const speechRate = finiteNumber(spoken["speech-rate"]);
	const pitch = finiteNumber(spoken.pitch);
	const volume = finiteNumber(spoken.volume);
	return {
		...(speechRate !== undefined && speechRate > 0
			? { rate: speechRate / AFA_NORMAL_SPEECH_RATE }
			: {}),
		...(pitch !== undefined ? { pitch: pitch * 2 } : {}),
		...(volume !== undefined ? { volume } : {}),
	};
}

/** A fresh profile carrying `record`'s grants, prohibitions and settings, ids sorted. */
export function createPersonalNeedsProfileFromAfa(
	record: AfaPnpRecord,
): PersonalNeedsProfile {
	const spoken: AfaSpoken =
		typeof record.spoken === "object" && record.spoken !== null
			? record.spoken
			: {};
	const readAloud = spoken["reading-type"] === "computer-read-aloud";
	const supportId = (feature: string): string =>
		feature === "spoken"
			? readAloud
				? "textToSpeech"
				: "screenReader"
			: (RENAMED_FEATURES[feature] ?? camelCase(feature));

	// PIE cannot withhold a screen reader, so a prohibited `spoken` withholds
	// the spoken presentation PIE makes, read-aloud.
	const prohibited = new Set(
		featureNames(record["prohibit-set"]).map((feature) =>
			feature === "spoken" ? "textToSpeech" : supportId(feature),
		),
	);
	const admitted = (ids: string[]) =>
		[...new Set(ids)].filter((id) => !prohibited.has(id)).sort();

	const activateAtInit = admitted(
		featureNames(record["activate-at-initialization-set"]).map(supportId),
	);
	const supports = admitted([
		...featureNames(record).map(supportId),
		...featureNames(record["activate-as-option-set"]).map(supportId),
		...activateAtInit,
	]);

	const toolParameters: ToolParameters = {};
	if (readAloud) {
		const speech = spokenParameters(spoken);
		if (Object.keys(speech).length > 0) {
			toolParameters.textToSpeech = speech;
		}
	}
	const calculatorType = record["calculator-on-screen"]?.["calculator-type"];
	if (calculatorType && CALCULATOR_TYPES.has(calculatorType)) {
		toolParameters.calculator = {
			type: calculatorType as "basic" | "scientific" | "graphing",
		};
	}
	const signLang = record["sign-language"]?.language;
	if (typeof signLang === "string" && signLang.length > 0) {
		toolParameters.signLanguage = { signLang };
	}
	const zoom = finiteNumber(record.magnification?.["all-content"]);
	if (zoom !== undefined && zoom > 1) {
		toolParameters.magnification = { zoom };
	}

	return {
		supports,
		prohibitedSupports: [...prohibited].sort(),
		...(activateAtInit.length > 0 ? { activateAtInit } : {}),
		...(Object.keys(toolParameters).length > 0 ? { toolParameters } : {}),
	};
}
