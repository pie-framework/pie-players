import { describe, expect, it } from "bun:test";
import {
	AccessibilityCatalogResolver,
	type ToolContentDependencyContext,
} from "@pie-players/pie-assessment-toolkit";
import type { CatalogCard } from "@pie-players/pie-players-shared/types";
import {
	AUDIO_TRANSCRIPT_FEATURE_ID,
	audioTranscriptRegistration,
	resolveAudioTranscript,
} from "../src/registrations/audio-transcript.js";
import { PACKAGED_TOOL_REGISTRATIONS } from "../src/packaged-tool-registry.js";
import { UNIVERSAL_SUPPORTS_PRESET } from "../src/universal-supports.js";

const itemWithCards = (cards: CatalogCard[]) =>
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

const dependencyContext = (
	cards: CatalogCard[],
	granted: boolean,
): ToolContentDependencyContext => {
	const resolver = new AccessibilityCatalogResolver();
	const owner = { kind: "item" as const, itemId: "item-1" };
	resolver.registerOwner({ owner, entity: itemWithCards(cards) });
	return {
		featureId: granted ? AUDIO_TRANSCRIPT_FEATURE_ID : "",
		catalogs: resolver
			.forOwner({ ownerKind: "itemModel", itemId: "item-1" })
			.snapshot(),
		granted,
	};
};

describe("audio transcript content resolution", () => {
	it("finds nothing on an item with no catalogs", () => {
		expect(resolveAudioTranscript(dependencyContext([], true))).toBeNull();
	});

	it("finds nothing on an item whose catalogs carry no transcript card", () => {
		expect(
			resolveAudioTranscript(
				dependencyContext([{ catalog: "sign-language", payload: {} }], true),
			),
		).toBeNull();
	});

	it("reports an always card whether or not policy granted anything", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "the text", visibility: "always" },
		];
		expect(resolveAudioTranscript(dependencyContext(cards, false))).toEqual({
			catalogId: "model-1-transcript",
			text: "the text",
			language: undefined,
			always: true,
		});
		expect(resolveAudioTranscript(dependencyContext(cards, true))?.always).toBe(
			true,
		);
	});

	it("reports an onGrant card only when policy granted", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "the text", visibility: "onGrant" },
		];
		expect(resolveAudioTranscript(dependencyContext(cards, false))).toBeNull();
		expect(resolveAudioTranscript(dependencyContext(cards, true))).toEqual({
			catalogId: "model-1-transcript",
			text: "the text",
			language: undefined,
			always: false,
		});
	});

	it("treats a card with no visibility as the accommodation", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "the text" },
		];
		expect(resolveAudioTranscript(dependencyContext(cards, false))).toBeNull();
		expect(resolveAudioTranscript(dependencyContext(cards, true))?.always).toBe(
			false,
		);
	});

	it("ignores a transcript card carrying no text", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "   ", visibility: "always" },
		];
		expect(resolveAudioTranscript(dependencyContext(cards, true))).toBeNull();
	});

	it("prefers an always card over an accommodation card found earlier", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "gated", visibility: "onGrant" },
			{ catalog: "transcript", content: "authored", visibility: "always" },
		];
		expect(
			resolveAudioTranscript(dependencyContext(cards, false))?.always,
		).toBe(true);
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

	it("is consulted without a grant, which is what makes packaging it safe", () => {
		expect(audioTranscriptRegistration.resolvesWithoutGrant).toBe(true);
	});
});
