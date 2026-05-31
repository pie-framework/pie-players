import { describe, expect, test } from "bun:test";
import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerSessionState,
	type SectionControllerRuntimeState,
} from "../src/index.js";

type ControllerHarness = {
	handle: SectionControllerHandle;
	emit: (event: SectionControllerEvent) => void;
	calls: {
		applySession: number;
		hydrate: number;
		persist: number;
	};
};

function createQuizEngineLikeController(): ControllerHarness {
	const listeners = new Set<(event: SectionControllerEvent) => void>();
	let session: SectionControllerSessionState = {
		currentItemIndex: 0,
		visitedItemIdentifiers: ["item-1"],
		itemSessions: {},
	};
	const calls = {
		applySession: 0,
		hydrate: 0,
		persist: 0,
	};
	const runtimeState = (): SectionControllerRuntimeState => ({
		sectionId: "section-1",
		currentItemIndex: session.currentItemIndex ?? 0,
		currentItemId: "item-1",
		itemIdentifiers: ["item-1"],
		visitedItemIdentifiers: session.visitedItemIdentifiers ?? ["item-1"],
		itemSessions: session.itemSessions,
		loadingComplete: true,
		totalRegistered: 1,
		totalLoaded: 1,
		itemsComplete: false,
		completedCount: 0,
		totalItems: 1,
		loadedRenderables: [
			{
				itemId: "item-1",
				canonicalItemId: "item-1",
				contentKind: "item",
			},
		],
	});
	const handle: SectionControllerHandle = {
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getRuntimeState: runtimeState,
		getSession() {
			return session;
		},
		applySession(nextSession) {
			calls.applySession += 1;
			session = nextSession ?? { itemSessions: {} };
		},
		hydrate() {
			calls.hydrate += 1;
		},
		persist() {
			calls.persist += 1;
		},
	};

	return {
		handle,
		calls,
		emit(event) {
			for (const listener of Array.from(listeners)) {
				listener(event);
			}
		},
	};
}

describe("QuizEngine client contract", () => {
	test("preserves the coordinator, tool config, and controller APIs QuizEngine consumes", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "quizengine-assessment",
			lazyInit: true,
			tools: {
				placement: {
					item: ["calculator", "textToSpeech"],
					section: [],
					passage: [],
				},
				providers: {
					calculator: {
						enabled: true,
						provider: {
							runtime: {
								authFetcher: async () => ({ apiKey: "desmos-key" }),
							},
						},
					},
					textToSpeech: {
						enabled: true,
						backend: "server",
						serverProvider: "custom",
						transportMode: "custom",
						endpointMode: "rootPost",
						endpointValidationMode: "none",
						apiEndpoint: "/api/playersession/session-1/tts",
						lang_id: "en-US",
						speedRate: "medium",
						cache: true,
						includeAuthOnAssetFetch: false,
					},
				},
			},
		});
		const controller = createQuizEngineLikeController();
		const handle = await coordinator.getOrCreateSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
			createDefaultController: () => controller.handle,
		});

		expect(coordinator.getSectionController({
			sectionId: "section-1",
			attemptId: "attempt-1",
		})).toBe(handle);
		expect(
			coordinator
				.decideToolPolicy({
					level: "item",
					scope: { level: "item", scopeId: "item-1" },
				})
				.visibleTools.map((tool) => tool.toolId),
		).toEqual(["calculator", "textToSpeech"]);

		const itemEvents: SectionControllerEvent[] = [];
		const sectionEvents: SectionControllerEvent[] = [];
		const unsubscribeItems = coordinator.subscribeItemEvents({
			eventTypes: ["item-session-data-changed", "content-loaded"],
			listener: (event) => itemEvents.push(event),
		});
		const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete", "section-error"],
			listener: (event) => sectionEvents.push(event),
		});

		controller.emit({
			type: "item-session-data-changed",
			itemId: "item-1",
			canonicalItemId: "item-1",
			session: {
				id: "session-1",
				data: [
					{
						id: "answer",
						element: "multiple-choice--version-1-2-3",
						value: ["choice-a"],
						complete: true,
					},
				],
			},
			complete: true,
			currentItemIndex: 0,
			timestamp: Date.now(),
		});
		controller.emit({
			type: "section-error",
			source: "controller",
			error: new Error("boom"),
			currentItemIndex: 0,
			timestamp: Date.now(),
		});

		expect(itemEvents.some((event) => event.type === "content-loaded")).toBe(true);
		expect(itemEvents.some((event) => event.type === "item-session-data-changed")).toBe(true);
		expect(sectionEvents.some((event) => event.type === "section-loading-complete")).toBe(true);
		expect(sectionEvents.some((event) => event.type === "section-error")).toBe(true);

		await handle.applySession?.(
			{
				currentItemIndex: 0,
				visitedItemIdentifiers: ["item-1"],
				itemSessions: {
					"item-1": {
						itemIdentifier: "item-1",
						session: { id: "session-1", data: [] },
					},
				},
			},
			{ mode: "replace" },
		);
		await handle.persist?.();
		await handle.hydrate?.();

		expect(handle.getSession?.()?.itemSessions["item-1"]).toEqual(
			expect.objectContaining({ itemIdentifier: "item-1" }),
		);
		expect(controller.calls).toEqual({
			applySession: 1,
			hydrate: 2,
			persist: 1,
		});

		unsubscribeItems();
		unsubscribeSection();
	});
});
