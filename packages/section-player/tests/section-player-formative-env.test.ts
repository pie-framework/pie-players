import { describe, expect, mock, test } from "bun:test";
import type {
	FormativeSectionProjection,
	ResolvedFormativePolicy,
} from "@pie-players/pie-players-shared/formative";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { SectionCompositionModel } from "../src/controllers/types";

// Same reason as `section-player-view-state.test.ts`: the module graph reaches
// the item-player custom-element bundle, which needs a DOM to define itself.
mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

const { getFormativeItemView, getItemPlayerParams } = await import(
	"../src/components/shared/section-player-view-state"
);

const policy = (
	overrides: Partial<ResolvedFormativePolicy> = {},
): ResolvedFormativePolicy => ({
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
	formative: FormativeSectionProjection | null;
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
		formative: args.formative,
	};
}

const SECTION_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

function paramsFor(projection: FormativeSectionProjection | null) {
	const compositionModel = makeComposition({ formative: projection });
	const item = compositionModel.items[0];
	const formativeView = getFormativeItemView({
		compositionModel,
		canonicalItemId: "q1",
	});
	return {
		formativeView,
		params: getItemPlayerParams({
			item,
			compositionModel,
			resolvedPlayerEnv: SECTION_ENV,
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "preloaded",
			formativeView,
		}),
	};
}

const projectionWith = (
	state: FormativeSectionProjection["states"][string] | undefined,
	policyOverrides: Partial<ResolvedFormativePolicy> = {},
): FormativeSectionProjection => ({
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

describe("formative env projection", () => {
	test("a non-formative section leaves the section env untouched", () => {
		const { formativeView, params } = paramsFor(null);
		expect(formativeView).toBeNull();
		expect(params.env).toBe(SECTION_ENV);
	});

	test("an untried formative item still renders at the section env", () => {
		const { formativeView, params } = paramsFor(projectionWith(undefined));
		expect(formativeView).toMatchObject({ enabled: true, canCheck: true });
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
		const { formativeView, params } = paramsFor(projection);
		expect(formativeView).toBeNull();
		expect(params.env).toBe(SECTION_ENV);
	});

	test("a host resolveBackend callback keeps seeing the section env, not the override", () => {
		// Which delivery backend serves an item is not a function of whether its
		// feedback is on screen; handing the override to the resolver would let a
		// reveal flip a host's backend selection mid-session.
		const compositionModel = makeComposition({
			formative: projectionWith({
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
			formativeView: getFormativeItemView({
				compositionModel,
				canonicalItemId: "q1",
			}),
		});
		expect(seenEnv).toEqual(SECTION_ENV);
	});
});
