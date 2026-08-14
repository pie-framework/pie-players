/**
 * The audio-transcript capability rendering into a card surface.
 *
 * Lives here rather than beside the registration because it needs a DOM: the
 * capability builds its region with `document.createElement`, and this package
 * already carries the happy-dom registrator. The card-reading half, which is
 * DOM-free, is tested next to the registration.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	AccessibilityCatalogResolver,
	type ToolContentDependencyContext,
} from "@pie-players/pie-assessment-toolkit";
import type { CatalogCard } from "@pie-players/pie-players-shared/types";
import {
	AUDIO_TRANSCRIPT_FEATURE_ID,
	AUDIO_TRANSCRIPT_REGION_CLASS,
	AUDIO_TRANSCRIPT_REGION_LABEL,
	audioTranscriptRegistration,
} from "@pie-players/pie-default-tool-loaders";
import { CONTENT_LEAD_SURFACE } from "../src/components/shared/card-media-region.js";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

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
	resolver.registerOwner({
		owner: { kind: "item", itemId: "item-1" },
		entity: itemWithCards(cards),
	});
	return {
		featureId: granted ? AUDIO_TRANSCRIPT_FEATURE_ID : "",
		catalogs: resolver
			.forOwner({ ownerKind: "itemModel", itemId: "item-1" })
			.snapshot(),
		granted,
	};
};

const renderContext = (content: unknown, granted: boolean) =>
	({
		toolId: AUDIO_TRANSCRIPT_FEATURE_ID,
		featureId: granted ? AUDIO_TRANSCRIPT_FEATURE_ID : "",
		surface: CONTENT_LEAD_SURFACE,
		content,
		services: {
			toolkitCoordinator: null,
			ttsService: null,
			catalogResolver: null,
		},
	}) as never;

/** The whole capability end to end, as the card runs it. */
const renderFor = (
	cards: CatalogCard[],
	granted: boolean,
): HTMLElement | null => {
	const content = audioTranscriptRegistration.requiresAuthoredContent?.resolve(
		dependencyContext(cards, granted),
	);
	if (content === null || content === undefined) return null;
	const rendered = audioTranscriptRegistration.renderSurface?.(
		renderContext(content, granted),
	);
	if (!rendered) return null;
	if (rendered.ariaLabel) {
		rendered.element.setAttribute("aria-label", rendered.ariaLabel);
	}
	return rendered.element;
};

describe("audio transcript rendering", () => {
	it("renders a labelled region holding the text for an always card, with no grant", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "the text", visibility: "always" },
		];
		const region = renderFor(cards, false);
		expect(region).not.toBeNull();
		expect(region?.getAttribute("role")).toBe("region");
		expect(region?.getAttribute("aria-label")).toBe(
			AUDIO_TRANSCRIPT_REGION_LABEL,
		);
		expect(region?.classList.contains(AUDIO_TRANSCRIPT_REGION_CLASS)).toBe(
			true,
		);
		expect(region?.textContent).toContain("the text");
		expect(region?.dataset.transcriptVisibility).toBe("always");
	});

	it("renders for an onGrant card only once granted", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "the text", visibility: "onGrant" },
		];
		expect(renderFor(cards, false)).toBeNull();
		const region = renderFor(cards, true);
		expect(region?.textContent).toContain("the text");
		expect(region?.dataset.transcriptVisibility).toBe("onGrant");
	});

	it("carries the card language onto the region", () => {
		const cards: CatalogCard[] = [
			{
				catalog: "transcript",
				content: "el texto",
				language: "es-ES",
				visibility: "always",
			},
		];
		expect(renderFor(cards, false)?.getAttribute("lang")).toBe("es-ES");
	});

	it("renders nothing for an item with no transcript, granted or not", () => {
		expect(renderFor([], true)).toBeNull();
		expect(renderFor([], false)).toBeNull();
	});

	it("declines when the host renders before resolving content", () => {
		expect(
			audioTranscriptRegistration.renderSurface?.(renderContext(null, true)),
		).toBeNull();
	});

	it("reapplies the current card on sync rather than the one it mounted with", () => {
		const cards: CatalogCard[] = [
			{ catalog: "transcript", content: "first", visibility: "always" },
		];
		const content =
			audioTranscriptRegistration.requiresAuthoredContent?.resolve(
				dependencyContext(cards, false),
			);
		const rendered = audioTranscriptRegistration.renderSurface?.(
			renderContext(content, false),
		);
		rendered?.sync?.(
			renderContext(
				{ catalogId: "other", text: "second", always: false },
				true,
			) as never,
		);
		expect(rendered?.element.textContent).toContain("second");
		expect(rendered?.element.dataset.transcriptVisibility).toBe("onGrant");
	});
});
