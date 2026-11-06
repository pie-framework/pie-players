import { describe, expect, test } from "bun:test";
import type {
	TrySectionProjection,
	ResolvedItemSessionControlPolicy,
} from "@pie-players/pie-players-shared/item-session-control";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../src/controllers/types";

// Same reason as `section-player-view-state.test.ts`: the module graph reaches
// the item-player custom-element bundle, which needs a DOM to define itself.
await import("./support/item-player-load.js");

const { getItemTryView, getItemPlayerParams, getPassagePlayerParams } =
	await import("../src/components/shared/section-player-view-state");

const policy = (
	overrides: Partial<ResolvedItemSessionControlPolicy> = {},
): ResolvedItemSessionControlPolicy => ({
	enabled: true,
	maxTries: 3,
	feedback: "correctness",
	revealOn: "on-try",
	...overrides,
});

function makeItem(id: string): ItemEntity {
	return { id, config: { elements: {}, models: [], markup: "" } } as never;
}

function makeComposition(args: {
	tries: TrySectionProjection | null;
}): SectionCompositionModel {
	const item = makeItem("q1-item");
	return {
		section: { identifier: "s1" } as never,
		assessmentItemRefs: [],
		passages: [],
		items: [item],
		rubricBlocks: [],
		instructions: [],
		renderables: [],
		currentItemIndex: 0,
		currentItem: item,
		isPageMode: false,
		itemSessionsByItemId: {},
		testAttemptSession: null,
		itemViewModels: [
			{
				item,
				itemId: "q1-item",
				canonicalItemId: "q1",
				index: 0,
				isCurrent: true,
				session: { id: "s", data: [] },
			},
		],
		tries: args.tries,
	};
}

const SECTION_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

function paramsFor(projection: TrySectionProjection | null) {
	const compositionModel = makeComposition({ tries: projection });
	const item = compositionModel.items[0];
	const tryView = getItemTryView({
		compositionModel,
		canonicalItemId: "q1",
	});
	return {
		tryView,
		params: getItemPlayerParams({
			item,
			compositionModel,
			resolvedPlayerEnv: SECTION_ENV,
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "preloaded",
			tryView,
		}),
	};
}

const projectionWith = (
	state: TrySectionProjection["states"][string] | undefined,
	policyOverrides: Partial<ResolvedItemSessionControlPolicy> = {},
): TrySectionProjection => ({
	version: 1,
	enabled: true,
	policies: { q1: policy(policyOverrides) },
	states: state ? { q1: state } : {},
	mastery: {
		version: 1,
		totalItems: 1,
		scorableItems: 1,
		masteredItems: 0,
		triedItems: 0,
		complete: false,
	},
});

describe("feedback env projection", () => {
	test("a section without item session control leaves the section env untouched", () => {
		const { tryView, params } = paramsFor(null);
		expect(tryView).toBeNull();
		expect(params.env).toBe(SECTION_ENV);
	});

	test("an untried item with item session control still renders at the section env", () => {
		const { tryView, params } = paramsFor(projectionWith(undefined));
		expect(tryView).toMatchObject({ enabled: true, canCheck: true });
		expect(params.env).toEqual(SECTION_ENV);
	});

	test("a revealed item renders in evaluate mode without losing the section role fields", () => {
		const { params } = paramsFor(
			projectionWith({
				version: 1,
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: true,
			}),
		);
		expect(params.env).toEqual({ mode: "evaluate", role: "student" });
	});

	test("solution feedback projects the instructor role", () => {
		const { params } = paramsFor(
			projectionWith(
				{ version: 1, itemIdentifier: "q1", tryCount: 1, revealed: true },
				{ feedback: "solution" },
			),
		);
		expect(params.env).toEqual({ mode: "evaluate", role: "instructor" });
	});

	test("a retried item is editable again at the section env", () => {
		const { params } = paramsFor(
			projectionWith({
				version: 1,
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: false,
			}),
		);
		expect(params.env).toEqual(SECTION_ENV);
	});

	test("the section env object is never mutated", () => {
		paramsFor(
			projectionWith({
				version: 1,
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: true,
			}),
		);
		expect(SECTION_ENV).toEqual({ mode: "gather", role: "student" });
	});

	test("an item whose own policy is disabled gets no view and no override", () => {
		const projection = projectionWith(
			{ version: 1, itemIdentifier: "q1", tryCount: 1, revealed: true },
			{ enabled: false },
		);
		const { tryView, params } = paramsFor(projection);
		expect(tryView).toBeNull();
		expect(params.env).toBe(SECTION_ENV);
	});

	test("a host resolveBackend callback keeps seeing the section env, not the override", () => {
		// Which delivery backend serves an item is not a function of whether its
		// feedback is on screen; handing the override to the resolver would let a
		// reveal flip a host's backend selection mid-session.
		const compositionModel = makeComposition({
			tries: projectionWith({
				version: 1,
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: true,
			}),
		});
		let seenEnv: unknown = null;
		getItemPlayerParams({
			item: compositionModel.items[0],
			compositionModel,
			resolvedPlayerEnv: SECTION_ENV,
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: { delivery: { baseUrl: "https://example.test" } },
				resolveBackend: (context: { env?: unknown }) => {
					seenEnv = context.env;
					return undefined;
				},
			},
			playerStrategy: "preloaded",
			tryView: getItemTryView({
				compositionModel,
				canonicalItemId: "q1",
			}),
		});
		expect(seenEnv).toEqual(SECTION_ENV);
	});
});

describe("content language narrowing", () => {
	const SECTION_ENV_EN = { mode: "gather", role: "student", locale: "en-US" };

	function itemParams(
		item: ItemEntity,
		projection: TrySectionProjection | null = null,
	) {
		const compositionModel = makeComposition({ tries: projection });
		return getItemPlayerParams({
			item,
			compositionModel,
			resolvedPlayerEnv: SECTION_ENV_EN,
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "preloaded",
			tryView: getItemTryView({
				compositionModel,
				canonicalItemId: "q1",
			}),
		});
	}

	test("two items in one section each render under their own language", () => {
		const spanish = { ...makeItem("q1-item"), language: "es" } as ItemEntity;
		const english = makeItem("q2-item");
		expect(itemParams(spanish).env).toEqual({
			...SECTION_ENV_EN,
			locale: "es",
		});
		expect(itemParams(english).env).toBe(SECTION_ENV_EN);
	});

	test("a feedback reveal keeps the item's language", () => {
		const spanish = { ...makeItem("q1-item"), language: "es" } as ItemEntity;
		const params = itemParams(
			spanish,
			projectionWith({
				version: 1,
				itemIdentifier: "q1",
				tryCount: 1,
				revealed: true,
			}),
		);
		expect(params.env).toEqual({
			mode: "evaluate",
			role: "student",
			locale: "es",
		});
	});

	test("a passage renders under its own language", () => {
		const params = getPassagePlayerParams({
			passage: { id: "p1", language: "es", config: {} },
			resolvedPlayerEnv: SECTION_ENV_EN,
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "preloaded",
		});
		expect(params.env).toEqual({ ...SECTION_ENV_EN, locale: "es" });
	});
});
