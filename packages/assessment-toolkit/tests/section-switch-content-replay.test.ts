/**
 * A section switch hands each section's controller only that section's
 * renderables.
 *
 * The binding's registry outlives the switch: shells of the section being left
 * stay registered until they unmount. Replaying that registry unfiltered into
 * the next section's controller reported the previous section's items as
 * loaded there, so subscribers of section B received section A's
 * `content-loaded` events and a `section-loading-complete` before any of B's
 * elements had loaded. An outgoing shell's unregister, session and errors
 * belong to its own section's cached controller, and a revisit of that section
 * completes loading only once its new shells load.
 *
 * The controller here keeps the per-renderable tracking `SectionController`
 * keeps: one key per content kind and canonical id, idempotent register and
 * load, completion once every registered renderable has loaded, and
 * `loadedRenderables` in its runtime state for the coordinator's replay.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import {
	ToolkitCoordinator,
	type SectionControllerEvent,
	type SectionControllerHandle,
	type SectionControllerRuntimeState,
} from "../src/index.js";
import type { RuntimeRegistrationDetail } from "../src/runtime/registration-events.js";
import { SectionControllerBinding } from "../src/runtime/SectionControllerBinding.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

type ContentKind = "item" | "passage" | "rubric" | "unknown";

function toContentKind(raw?: string): ContentKind {
	const value = String(raw || "").toLowerCase();
	if (value === "item" || value.includes("assessment-item")) return "item";
	if (value === "passage") return "passage";
	if (value.includes("rubric")) return "rubric";
	return "unknown";
}

interface Tracked {
	itemId: string;
	canonicalItemId: string;
	contentKind: ContentKind;
}

interface SectionLikeController extends SectionControllerHandle {
	readonly tracked: Map<string, Tracked>;
	/** Every item id a `handleContent*` call named, in call order. */
	readonly heardIds: string[];
	readonly unregisteredIds: string[];
	/** Item ids of the sessions, player errors and section errors it received. */
	readonly sessionIds: string[];
	readonly playerErrorIds: string[];
	readonly sectionErrorIds: Array<string | undefined>;
	getRuntimeState(): SectionControllerRuntimeState;
	/** The binding's controller signature; the stub leaves it unimplemented. */
	updateItemSession?: (
		itemId: string,
		sessionDetail: unknown,
	) => { eventDetail?: unknown } | null;
}

function createSectionLikeController(
	sectionId: string,
	renderableIds: string[],
): SectionLikeController {
	const listeners = new Set<(event: SectionControllerEvent) => void>();
	const tracked = new Map<string, Tracked>();
	const loaded = new Set<string>();
	const heardIds: string[] = [];
	const unregisteredIds: string[] = [];
	const sessionIds: string[] = [];
	const playerErrorIds: string[] = [];
	const sectionErrorIds: Array<string | undefined> = [];
	let loadingComplete = false;
	const emit = (event: SectionControllerEvent) => {
		for (const listener of Array.from(listeners)) listener(event);
	};
	const keyOf = (args: { itemId: string; canonicalItemId?: string; contentKind?: string }) =>
		`${toContentKind(args.contentKind)}:${args.canonicalItemId || args.itemId}`;
	const evaluate = () => {
		let next = tracked.size > 0;
		for (const key of tracked.keys()) {
			if (!loaded.has(key)) next = false;
		}
		if (next === loadingComplete) return;
		loadingComplete = next;
		if (!next) return;
		emit({
			type: "section-loading-complete",
			totalRegistered: tracked.size,
			totalLoaded: loaded.size,
			currentItemIndex: 0,
			timestamp: Date.now(),
		});
	};
	return {
		tracked,
		heardIds,
		unregisteredIds,
		sessionIds,
		playerErrorIds,
		sectionErrorIds,
		updateItemSession(itemId: string) {
			sessionIds.push(itemId);
			return null;
		},
		handleItemPlayerError(args: { itemId: string }) {
			playerErrorIds.push(args.itemId);
		},
		reportSectionError(args: { itemId?: string }) {
			sectionErrorIds.push(args.itemId);
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getCompositionModel() {
			return {
				section: { identifier: sectionId },
				renderables: renderableIds.map((id) => ({
					flavor: id.startsWith("passage") ? "passage" : "item",
					entity: { id },
				})),
			};
		},
		getRuntimeState() {
			return {
				sectionId,
				currentItemIndex: 0,
				currentItemId: "",
				itemIdentifiers: [],
				visitedItemIdentifiers: [],
				itemSessions: {},
				loadingComplete,
				totalRegistered: tracked.size,
				totalLoaded: loaded.size,
				itemsComplete: false,
				completedCount: 0,
				totalItems: 0,
				loadedRenderables: Array.from(tracked)
					.filter(([key]) => loaded.has(key))
					.map(([, entry]) => entry),
			};
		},
		getSession() {
			return { itemSessions: {} };
		},
		dispose() {
			listeners.clear();
		},
		handleContentRegistered(args: {
			itemId: string;
			canonicalItemId?: string;
			contentKind?: string;
		}) {
			heardIds.push(args.itemId);
			const key = keyOf(args);
			if (tracked.has(key)) return;
			tracked.set(key, {
				itemId: args.itemId,
				canonicalItemId: args.canonicalItemId || args.itemId,
				contentKind: toContentKind(args.contentKind),
			});
			evaluate();
		},
		handleContentUnregistered(args: {
			itemId: string;
			canonicalItemId?: string;
			contentKind?: string;
		}) {
			heardIds.push(args.itemId);
			unregisteredIds.push(args.itemId);
			const key = keyOf(args);
			tracked.delete(key);
			loaded.delete(key);
			evaluate();
		},
		handleContentLoaded(args: {
			itemId: string;
			canonicalItemId?: string;
			contentKind?: string;
		}) {
			heardIds.push(args.itemId);
			const key = keyOf(args);
			if (loaded.has(key) || !tracked.has(key)) return;
			loaded.add(key);
			emit({
				type: "content-loaded",
				contentKind: toContentKind(args.contentKind),
				itemId: args.itemId,
				canonicalItemId: args.canonicalItemId || args.itemId,
				currentItemIndex: 0,
				timestamp: Date.now(),
			});
			evaluate();
		},
	} as SectionLikeController;
}

function shell(
	itemId: string,
	contentKind = "assessment-item",
): RuntimeRegistrationDetail {
	const passage = contentKind === "rubric-block-stimulus";
	// Mounted, so the registry's document-order replay has an order to follow.
	const element = document.body.appendChild(
		document.createElement(passage ? "pie-passage-shell" : "pie-item-scope"),
	);
	return {
		kind: passage ? "passage" : "item",
		itemId,
		canonicalItemId: itemId,
		contentKind,
		item: null,
		element,
	};
}

const ASSESSMENT_ID = "section-switch-content-replay";
const ATTEMPT_ID = "attempt-1";

describe("section switch content replay", () => {
	let binding: SectionControllerBinding;
	let coordinator: ToolkitCoordinator;
	let controllers: Map<string, SectionLikeController>;
	let received: SectionControllerEvent[];

	const SECTIONS: Record<string, string[]> = {
		"section-A": ["passage-1", "q1", "q2"],
		"section-B": ["q3", "q4"],
	};

	function initialize(sectionId: string): Promise<void> {
		return binding.initialize({
			coordinator,
			section: { identifier: sectionId },
			sectionId,
			assessmentId: ASSESSMENT_ID,
			attemptId: ATTEMPT_ID,
			view: "candidate",
			createDefaultController: () => {
				const controller = createSectionLikeController(
					sectionId,
					SECTIONS[sectionId] ?? [],
				);
				controllers.set(sectionId, controller);
				return controller;
			},
		});
	}

	function mount(detail: RuntimeRegistrationDetail): void {
		binding.register(detail);
		binding.handleContentRegistered(detail);
	}

	function load(detail: RuntimeRegistrationDetail): void {
		binding.handleContentLoaded({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId,
			contentKind: detail.contentKind,
			timestamp: Date.now(),
		});
	}

	function unmount(detail: RuntimeRegistrationDetail): void {
		binding.unregister(detail.element);
		binding.handleContentUnregistered(detail);
		detail.element.remove();
	}

	/** Subscribes the way a host does on `toolkit-ready`. */
	function subscribe(into: SectionControllerEvent[]): () => void {
		const stopItems = coordinator.subscribeItemEvents({
			eventTypes: ["content-loaded"],
			listener: (event) => into.push(event),
		});
		const stopLifecycle = coordinator.subscribeSectionLifecycleEvents({
			eventTypes: ["section-loading-complete"],
			listener: (event) => into.push(event),
		});
		return () => {
			stopItems();
			stopLifecycle();
		};
	}

	const contentLoadedIds = (events: SectionControllerEvent[]) =>
		events
			.filter((event) => event.type === "content-loaded")
			.map((event) => (event as { itemId: string }).itemId);
	const completions = (events: SectionControllerEvent[]) =>
		events.filter((event) => event.type === "section-loading-complete");

	async function loadSectionA() {
		await initialize("section-A");
		const shellsA = [
			shell("passage-1", "rubric-block-stimulus"),
			shell("q1"),
			shell("q2"),
		];
		for (const detail of shellsA) mount(detail);
		for (const detail of shellsA) load(detail);
		return shellsA;
	}

	beforeEach(() => {
		document.body.replaceChildren();
		binding = new SectionControllerBinding();
		coordinator = new ToolkitCoordinator({
			assessmentId: ASSESSMENT_ID,
			lazyInit: true,
		});
		controllers = new Map();
		received = [];
	});

	test("subscribers of B see none of A's loads while B's elements are pending", async () => {
		await loadSectionA();
		subscribe(received);
		expect(contentLoadedIds(received)).toEqual(["passage-1", "q1", "q2"]);
		expect(completions(received)).toHaveLength(1);

		// A's shells are still mounted when the switch starts, and stay registered.
		received.length = 0;
		await initialize("section-B");
		const shellsB = [shell("q3"), shell("q4")];
		for (const detail of shellsB) mount(detail);

		expect(contentLoadedIds(received)).toEqual([]);
		expect(completions(received)).toHaveLength(0);
		const stateB = controllers.get("section-B")?.getRuntimeState();
		expect(stateB?.loadingComplete).toBe(false);
		expect(stateB?.totalRegistered).toBe(2);
		expect(stateB?.totalLoaded).toBe(0);
		expect(stateB?.loadedRenderables).toEqual([]);

		const lateBeforeLoad: SectionControllerEvent[] = [];
		subscribe(lateBeforeLoad);
		expect(lateBeforeLoad).toEqual([]);

		for (const detail of shellsB) load(detail);
		expect(contentLoadedIds(received)).toEqual(["q3", "q4"]);
		expect(completions(received)).toHaveLength(1);

		// A rebind replays B's snapshot: B's renderables and nothing else.
		const rebound: SectionControllerEvent[] = [];
		subscribe(rebound);
		expect(contentLoadedIds(rebound)).toEqual(["q3", "q4"]);
		expect(completions(rebound)).toHaveLength(1);
	});

	test("B's shells registering before B's controller resolves reach B, and only B", async () => {
		const shellsA = await loadSectionA();
		subscribe(received);
		received.length = 0;

		const shellsB = [shell("q3"), shell("q4")];
		for (const detail of shellsB) mount(detail);
		const switching = initialize("section-B");
		for (const detail of shellsB) load(detail);
		await switching;

		const heardByA = new Set(controllers.get("section-A")?.heardIds);
		expect(Array.from(heardByA)).toEqual(
			shellsA.map((detail) => detail.itemId),
		);
		expect(contentLoadedIds(received)).toEqual(["q3", "q4"]);
		expect(completions(received)).toHaveLength(1);
		expect(
			controllers.get("section-B")?.getRuntimeState().loadedRenderables,
		).toEqual([
			{ itemId: "q3", canonicalItemId: "q3", contentKind: "item" },
			{ itemId: "q4", canonicalItemId: "q4", contentKind: "item" },
		]);
	});

	test("A's shells unregistering after the switch reach A's controller, not B's", async () => {
		const shellsA = await loadSectionA();
		await initialize("section-B");
		const shellsB = [shell("q3"), shell("q4")];
		for (const detail of shellsB) mount(detail);
		for (const detail of shellsA) unmount(detail);

		expect(controllers.get("section-A")?.unregisteredIds).toEqual([
			"passage-1",
			"q1",
			"q2",
		]);
		expect(controllers.get("section-A")?.getRuntimeState().loadingComplete).toBe(
			false,
		);
		const controllerB = controllers.get("section-B");
		expect(controllerB?.unregisteredIds).toEqual([]);
		expect(
			Array.from(controllerB?.tracked.values() ?? []).map(
				(entry) => entry.itemId,
			),
		).toEqual(["q3", "q4"]);
	});

	test("a renderable in both sections stays loaded for B when A's shell for it leaves", async () => {
		SECTIONS["section-B"] = ["passage-1", "q3"];
		try {
			const shellsA = await loadSectionA();
			subscribe(received);
			received.length = 0;

			// The passage shell persists across the switch: its load is B's too.
			await initialize("section-B");
			expect(contentLoadedIds(received)).toEqual(["passage-1"]);

			// B mounts its own shell for the passage, then A's leaves.
			const passageB = shell("passage-1", "rubric-block-stimulus");
			const q3 = shell("q3");
			mount(passageB);
			mount(q3);
			load(passageB);
			unmount(shellsA[0] as RuntimeRegistrationDetail);
			load(q3);

			const controllerB = controllers.get("section-B");
			expect(controllerB?.unregisteredIds).toEqual([]);
			expect(contentLoadedIds(received)).toEqual(["passage-1", "q3"]);
			expect(controllerB?.getRuntimeState().loadedRenderables).toEqual([
				{
					itemId: "passage-1",
					canonicalItemId: "passage-1",
					contentKind: "rubric",
				},
				{ itemId: "q3", canonicalItemId: "q3", contentKind: "item" },
			]);
		} finally {
			SECTIONS["section-B"] = ["q3", "q4"];
		}
	});
	async function revisitSectionA(args: { unregisterHeard: boolean }) {
		const shellsA = await loadSectionA();
		await initialize("section-B");
		const shellsB = [shell("q3"), shell("q4")];
		for (const detail of shellsB) mount(detail);
		for (const detail of shellsA) {
			if (args.unregisterHeard) {
				unmount(detail);
			} else {
				// Gone from the registry without the binding hearing the unregister.
				binding.unregister(detail.element);
				detail.element.remove();
			}
		}
		for (const detail of shellsB) load(detail);
		subscribe(received);
		received.length = 0;

		await initialize("section-A");
		expect(completions(received)).toHaveLength(0);
		const shellsA2 = [
			shell("passage-1", "rubric-block-stimulus"),
			shell("q1"),
			shell("q2"),
		];
		for (const detail of shellsA2) mount(detail);
		for (const detail of shellsB) unmount(detail);
		expect(completions(received)).toHaveLength(0);
		for (const detail of shellsA2) load(detail);
		expect(contentLoadedIds(received)).toEqual(["passage-1", "q1", "q2"]);
		expect(completions(received)).toHaveLength(1);

		const late: SectionControllerEvent[] = [];
		subscribe(late);
		expect(contentLoadedIds(late)).toEqual(["passage-1", "q1", "q2"]);
		expect(completions(late)).toHaveLength(1);
		expect(controllers.get("section-B")?.unregisteredIds).toEqual(["q3", "q4"]);
	}

	test("a revisited section completes loading only once its new shells load", async () => {
		await revisitSectionA({ unregisterHeard: true });
	});

	test("a revisit forgets the loads of shells whose unregister never arrived", async () => {
		await revisitSectionA({ unregisterHeard: false });
	});

	test("an outgoing shell's session and errors reach its own section's controller", async () => {
		await loadSectionA();
		await initialize("section-B");
		const shellsB = [shell("q3"), shell("q4")];
		for (const detail of shellsB) mount(detail);

		binding.updateItemSession("q1", { session: { id: "q1", data: [] } });
		binding.handleItemPlayerError({
			itemId: "q1",
			canonicalItemId: "q1",
			contentKind: "assessment-item",
			error: new Error("late"),
		});
		binding.reportSectionError({
			source: "item-player",
			error: new Error("late"),
			itemId: "q2",
		});
		binding.updateItemSession("q3", { session: { id: "q3", data: [] } });
		binding.reportSectionError({ source: "toolkit", error: new Error("b") });

		const controllerA = controllers.get("section-A");
		const controllerB = controllers.get("section-B");
		expect(controllerA?.sessionIds).toEqual(["q1"]);
		expect(controllerA?.playerErrorIds).toEqual(["q1"]);
		expect(controllerA?.sectionErrorIds).toEqual(["q2"]);
		expect(controllerB?.sessionIds).toEqual(["q3"]);
		expect(controllerB?.playerErrorIds).toEqual([]);
		expect(controllerB?.sectionErrorIds).toEqual([undefined]);
	});

	test("an event for a renderable no bound section renders is dropped", async () => {
		await loadSectionA();
		await initialize("section-B");
		binding.updateItemSession("stray", { session: { id: "stray", data: [] } });
		binding.handleItemPlayerError({
			itemId: "stray",
			error: new Error("stray"),
		});
		for (const sectionId of ["section-A", "section-B"]) {
			const controller = controllers.get(sectionId);
			expect(controller?.sessionIds).toEqual([]);
			expect(controller?.playerErrorIds).toEqual([]);
			expect(controller?.sectionErrorIds).toEqual([]);
		}
	});
});
