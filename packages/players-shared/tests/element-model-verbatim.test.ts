import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";

import { initializePiesFromLoadedBundle } from "../src/pie/initialization.js";
import { scorePieItem } from "../src/pie/scoring.js";
import { BundleType, Status } from "../src/pie/types.js";
import { updatePieElementWithRef } from "../src/pie/updates.js";
import type { ConfigEntity, PieController } from "../src/types/index.js";

/**
 * Elements copy model strings into the session and score them against the
 * authored key, so the model an element receives must carry the authored
 * strings byte for byte. Overwide images and tables are wrapped in the rendered
 * DOM instead (see wrap-overwide-mutations.test.ts).
 */

const ICA_TAG = "pie-image-cloze-association--version-1-0-0";
const ICA_PACKAGE = "@pie-element/image-cloze-association@1.0.0";
const TAG = "pie-multiple-choice--version-1-0-0";
const PACKAGE = "@pie-element/multiple-choice@1.0.0";
const INIT_TAG = "pie-verbatim-init-test";
const INIT_PACKAGE = "@pie-element/verbatim-init-test@1.0.0";

const RESPONSE_A = '<img alt="" src="https://example.test/a.png"/>';
const RESPONSE_B = '<img alt="" src="https://example.test/b.png"/>';

const ENV = { mode: "gather", role: "student", partialScoring: false } as const;

type Answer = { id: string; value: string; containerIndex: number };
type ModelledElement = HTMLElement & { model?: Record<string, any> };

const richModel = (id: string, element: string) => ({
	id,
	element,
	prompt:
		'Use this diagram: <img src="/prompt.png" alt="prompt diagram" width="1800" height="900"/>',
	choices: [
		{
			value: "a",
			label: 'Choice A <img src="/choice.png" alt="choice diagram" width="1600">',
		},
	],
	partA: {
		prompt: "<table><caption>Part A values</caption><tr><td>A</td></tr></table>",
	},
});

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

beforeEach(() => {
	document.body.innerHTML = "";
	(window as any).pie = undefined;
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {};
});

function register(
	tagName: string,
	pkg: string,
	bundleType: BundleType,
	controller?: Partial<PieController>,
) {
	(window as any).PIE_REGISTRY[tagName] = {
		package: pkg,
		status: Status.loaded,
		tagName,
		bundleType,
		...(controller ? { controller } : {}),
	};
}

/**
 * Stand-in for the image-cloze-association controller: model() hands the
 * authored responses to the renderer, outcome() looks each placed answer up in
 * the authored key with indexOf.
 */
const icaController: Partial<PieController> = {
	model: (async (question: any, _session: any, env: any) => ({
		mode: env.mode,
		possibleResponses: question.possible_responses,
	})) as any,
	outcome: (async (model: any, session: any) => {
		const key = model.validation.valid_response.value.map(
			(container: { images: string[] }) => [...container.images],
		);
		const answers: Answer[] = session.answers ?? [];
		const placed = answers.filter((answer) => {
			const index = key[answer.containerIndex]?.indexOf(answer.value) ?? -1;
			if (index >= 0) key[answer.containerIndex].splice(index, 1);
			return index >= 0;
		});
		const correct = placed.length === 2 && answers.length === 2;
		return { id: model.id, element: model.element, score: correct ? 1 : 0 };
	}) as any,
};

describe("element model assignment", () => {
	test("an image-cloze-association response copied into the session scores against the authored key", async () => {
		register(ICA_TAG, ICA_PACKAGE, BundleType.clientPlayer, icaController);
		const config: ConfigEntity = {
			markup: `<${ICA_TAG} id="q1"></${ICA_TAG}>`,
			elements: { [ICA_TAG]: ICA_PACKAGE },
			models: [
				{
					id: "q1",
					element: ICA_TAG,
					possible_responses: [RESPONSE_A, RESPONSE_B],
					validation: {
						valid_response: {
							value: [{ images: [RESPONSE_B] }, { images: [RESPONSE_A] }],
						},
					},
				},
			],
		};
		const container = document.createElement("div");
		container.innerHTML = config.markup;
		document.body.append(container);
		const element = container.querySelector(ICA_TAG) as ModelledElement & {
			session?: { answers?: Answer[] };
		};
		const session: any[] = [];

		await updatePieElementWithRef(element, {
			config,
			session,
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});

		// The renderer places a response by copying its model string, as the
		// element does on drop.
		const [first, second]: string[] = element.model?.possibleResponses ?? [];
		(element.session as { answers?: Answer[] }).answers = [
			{ id: "0", value: second, containerIndex: 0 },
			{ id: "1", value: first, containerIndex: 1 },
		];

		expect(session[0].answers.map((answer: Answer) => answer.value)).toEqual([
			RESPONSE_B,
			RESPONSE_A,
		]);
		const { results } = await scorePieItem(config, session, {
			container,
			outcomeArguments: "model-session-env",
			bundleType: BundleType.clientPlayer,
		});
		expect(results[0]?.score).toBe(1);
	});

	const paths: Array<{
		name: string;
		bundleType: BundleType;
		controller?: Partial<PieController>;
		invokeControllerForModel?: boolean;
		logsError?: boolean;
	}> = [
		{ name: "a server-processed model (player.js)", bundleType: BundleType.player },
		{
			name: "the fallback after a controller failure",
			bundleType: BundleType.clientPlayer,
			controller: {
				model: (async () => {
					throw new Error("controller failed");
				}) as any,
			},
			logsError: true,
		},
		{
			name: "a model assigned without a controller call",
			bundleType: BundleType.clientPlayer,
			controller: { model: (async () => ({})) as any },
			invokeControllerForModel: false,
		},
	];

	for (const path of paths) {
		test(`assigns ${path.name} verbatim`, async () => {
			register(TAG, PACKAGE, path.bundleType, path.controller);
			const authored = richModel("q1", TAG);
			const config: ConfigEntity = {
				markup: `<${TAG} id="q1"></${TAG}>`,
				elements: { [TAG]: PACKAGE },
				models: [structuredClone(authored)],
			};
			const element = document.createElement(TAG) as ModelledElement;
			element.id = "q1";
			const consoleError = path.logsError
				? spyOn(console, "error").mockImplementation(() => {})
				: undefined;

			try {
				await updatePieElementWithRef(element, {
					config,
					session: [],
					env: ENV,
					bundleType: path.bundleType,
					...(path.invokeControllerForModel === undefined
						? {}
						: { invokeControllerForModel: path.invokeControllerForModel }),
				});
			} finally {
				consoleError?.mockRestore();
			}

			expect(element.model).toEqual(authored);
		});
	}

	test("assigns the model verbatim when a newly registered player.js element initializes", async () => {
		const authored = richModel("q-init", INIT_TAG);
		const config: ConfigEntity = {
			markup: `<${INIT_TAG} id="q-init"></${INIT_TAG}>`,
			elements: { [INIT_TAG]: INIT_PACKAGE },
			models: [structuredClone(authored)],
		};
		const element = document.createElement(INIT_TAG);
		element.id = "q-init";
		document.body.append(element);
		(window as any).pie = {
			default: {
				"@pie-element/verbatim-init-test": {
					Element: class extends HTMLElement {},
				},
			},
		};

		initializePiesFromLoadedBundle(config, [], {
			env: ENV,
			bundleType: BundleType.player,
		});
		await customElements.whenDefined(INIT_TAG);
		await Promise.resolve();

		const initialized = document.querySelector(INIT_TAG) as ModelledElement;
		expect(initialized.model).toEqual(authored);
	});
});
