import { describe, expect, it } from "bun:test";
import {
	AUDIO_TRANSCRIPT_CONTENT_CLASS,
	AUDIO_TRANSCRIPT_FEATURE_ID,
	audioTranscriptRegistration,
	resolveAudioTranscript,
} from "../src/registrations/audio-transcript.js";
import { PACKAGED_TOOL_REGISTRATIONS } from "../src/packaged-tool-registry.js";
import { UNIVERSAL_SUPPORTS_PRESET } from "../src/universal-supports.js";

const itemWithCards = (cards: unknown[]) =>
	({
		id: "item-1",
		config: {
			models: [
				{
					id: "model-1",
					element: "mc-populated-blank",
					accessibilityCatalogs: [{ identifier: "model-1-transcript", cards }],
				},
			],
		},
	}) as never;

const dependencyContext = (item: unknown, granted: boolean) =>
	({
		featureId: granted ? AUDIO_TRANSCRIPT_FEATURE_ID : "",
		catalogResolver: null,
		ownerContext: { kind: "item", itemId: "item-1" },
		item,
		granted,
	}) as never;

const markerContext = (content: unknown, granted: boolean) =>
	({
		toolId: AUDIO_TRANSCRIPT_FEATURE_ID,
		featureId: granted ? AUDIO_TRANSCRIPT_FEATURE_ID : "",
		surface: "content-marker",
		content,
		granted,
	}) as never;

/** The whole capability end to end, as the host runs it. */
const classesFor = (item: unknown, granted: boolean): string[] | null => {
	const content = audioTranscriptRegistration.requiresAuthoredContent?.resolve(
		dependencyContext(item, granted),
	);
	if (content === null || content === undefined) return null;
	return (
		audioTranscriptRegistration.markContent?.resolve(
			markerContext(content, granted),
		) ?? null
	);
};

describe("audio transcript content resolution", () => {
	it("finds nothing on an item with no catalogs", () => {
		expect(
			resolveAudioTranscript(dependencyContext({ id: "item-1" }, true)),
		).toBeNull();
	});

	it("finds nothing on an item whose catalogs carry no transcript card", () => {
		const item = itemWithCards([{ catalog: "sign-language", payload: {} }]);
		expect(resolveAudioTranscript(dependencyContext(item, true))).toBeNull();
	});

	it("reports an always card whether or not policy granted anything", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "the text", visibility: "always" },
		]);
		expect(resolveAudioTranscript(dependencyContext(item, false))).toEqual({
			catalogId: "model-1-transcript",
			always: true,
		});
		expect(resolveAudioTranscript(dependencyContext(item, true))?.always).toBe(
			true,
		);
	});

	it("reports an onGrant card only when policy granted", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "the text", visibility: "onGrant" },
		]);
		expect(resolveAudioTranscript(dependencyContext(item, false))).toBeNull();
		expect(resolveAudioTranscript(dependencyContext(item, true))).toEqual({
			catalogId: "model-1-transcript",
			always: false,
		});
	});

	it("treats a card with no visibility as the accommodation", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "the text" },
		]);
		expect(resolveAudioTranscript(dependencyContext(item, false))).toBeNull();
		expect(resolveAudioTranscript(dependencyContext(item, true))?.always).toBe(
			false,
		);
	});

	it("prefers an always card over an accommodation card found earlier", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "gated", visibility: "onGrant" },
			{ catalog: "transcript", content: "authored", visibility: "always" },
		]);
		expect(resolveAudioTranscript(dependencyContext(item, false))?.always).toBe(
			true,
		);
	});
});

describe("audio transcript marker", () => {
	it("marks the container for an always card with no grant", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "the text", visibility: "always" },
		]);
		expect(classesFor(item, false)).toEqual([AUDIO_TRANSCRIPT_CONTENT_CLASS]);
	});

	it("marks the container for an onGrant card once granted", () => {
		const item = itemWithCards([
			{ catalog: "transcript", content: "the text", visibility: "onGrant" },
		]);
		expect(classesFor(item, false)).toBeNull();
		expect(classesFor(item, true)).toEqual([AUDIO_TRANSCRIPT_CONTENT_CLASS]);
	});

	it("marks nothing for an item with no transcript, granted or not", () => {
		const item = itemWithCards([]);
		expect(classesFor(item, true)).toBeNull();
		expect(classesFor(item, false)).toBeNull();
	});
});

describe("audio transcript packaging", () => {
	it("ships in the packaged capability set", () => {
		expect(PACKAGED_TOOL_REGISTRATIONS).toContain(audioTranscriptRegistration);
	});

	it("is gated by its own support id and declares a content dependency", () => {
		expect(audioTranscriptRegistration.pnpSupportIds).toEqual([
			AUDIO_TRANSCRIPT_FEATURE_ID,
		]);
		expect(audioTranscriptRegistration.requiresAuthoredContent).toBeTruthy();
	});

	it("stays out of the universal preset, being content-dependent", () => {
		expect(UNIVERSAL_SUPPORTS_PRESET).not.toContain(
			AUDIO_TRANSCRIPT_FEATURE_ID,
		);
	});

	it("has no toolbar presence to place", () => {
		expect(audioTranscriptRegistration.activation).toBe("region");
		expect(audioTranscriptRegistration.renderToolbar).toBeUndefined();
	});
});
