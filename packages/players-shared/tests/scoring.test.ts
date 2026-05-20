import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { scorePieItem } from "../src/pie/scoring.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity, PieController } from "../src/types/index.js";

const config: ConfigEntity = {
	markup:
		'<pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0><pie-mc--version-1-0-0 id="q2"></pie-mc--version-1-0-0>',
	elements: {
		"pie-mc--version-1-0-0": "@pie-element/multiple-choice@1.0.0",
	},
	models: [
		{ id: "q1", element: "pie-mc--version-1-0-0", prompt: "Question 1" },
		{ id: "q2", element: "pie-mc--version-1-0-0", prompt: "Question 2" },
	],
};

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
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
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {};
});

function registerController(controller: Partial<PieController>) {
	(window as any).PIE_REGISTRY["pie-mc--version-1-0-0"] = {
		package: "@pie-element/multiple-choice@1.0.0",
		status: Status.loaded,
		tagName: "pie-mc--version-1-0-0",
		controller,
		bundleType: BundleType.clientPlayer,
	};
}

describe("scorePieItem", () => {
	test("scopes element lookup to the supplied container and uses legacy outcome arguments", async () => {
		const calls: Array<{
			modelId: string;
			sessionValue: unknown;
			mode: unknown;
			partialScoring: unknown;
		}> = [];
		registerController({
			outcome: async (model: any, session: any, env: any) => {
				calls.push({
					modelId: model.id,
					sessionValue: session.value,
					mode: env.mode,
					partialScoring: env.partialScoring,
				});
				return { id: model.id, element: model.element, score: session.value === "B" ? 1 : 0 };
			},
		});

		const otherPlayer = document.createElement("section");
		otherPlayer.innerHTML = '<pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0>';
		document.body.append(otherPlayer);

		const currentPlayer = document.createElement("section");
		currentPlayer.innerHTML =
			'<pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0><pie-mc--version-1-0-0 id="q2"></pie-mc--version-1-0-0>';
		document.body.append(currentPlayer);

		const { results } = await scorePieItem(
			config,
			[
				{ id: "q1", element: "pie-mc--version-1-0-0", value: "B" },
				{ id: "q2", element: "pie-mc--version-1-0-0", value: "C" },
			],
			{
				container: currentPlayer,
				env: { mode: "gather", role: "student", partialScoring: true },
				outcomeArguments: "model-session-env",
				includeMissingResults: true,
			},
		);

		expect(calls).toEqual([
			{ modelId: "q1", sessionValue: "B", mode: "evaluate", partialScoring: true },
			{ modelId: "q2", sessionValue: "C", mode: "evaluate", partialScoring: true },
		]);
		expect(results).toEqual([
			{ id: "q1", element: "pie-mc--version-1-0-0", value: "B", score: 1 },
			{ id: "q2", element: "pie-mc--version-1-0-0", value: "C", score: 0 },
		]);
	});

	test("keeps existing filtered result shape unless missing slots are requested", async () => {
		registerController({});
		const currentPlayer = document.createElement("section");
		currentPlayer.innerHTML = '<pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0>';
		document.body.append(currentPlayer);

		const filtered = await scorePieItem(config, [], { container: currentPlayer });
		expect(filtered.results).toEqual([]);

		const aligned = await scorePieItem(config, [], {
			container: currentPlayer,
			includeMissingResults: true,
		});
		expect(aligned.results).toEqual([undefined, undefined]);
	});

	test("keeps the existing scorePieItem outcome(session, env) call shape by default", async () => {
		const calls: Array<{ sessionId: string; mode: unknown }> = [];
		registerController({
			outcome: async (session: any, env: any) => {
				calls.push({ sessionId: session.id, mode: env.mode });
				return { id: session.id, element: session.element, score: 1 };
			},
		});
		const currentPlayer = document.createElement("section");
		currentPlayer.innerHTML = '<pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0>';
		document.body.append(currentPlayer);

		const { results } = await scorePieItem(
			{
				...config,
				models: [{ id: "q1", element: "pie-mc--version-1-0-0" }],
			},
			[{ id: "q1", element: "pie-mc--version-1-0-0", value: "A" }],
			{ container: currentPlayer },
		);

		expect(calls).toEqual([{ sessionId: "q1", mode: "evaluate" }]);
		expect(results).toEqual([
			{ id: "q1", element: "pie-mc--version-1-0-0", value: "A", score: 1 },
		]);
	});

	test("preserves exact id matching for versioned PIE elements", async () => {
		registerController({
			outcome: async (model: any, session: any) => ({
				id: model.id,
				element: model.element,
				score: session.value === "exact" ? 1 : 0,
			}),
		});
		const currentPlayer = document.createElement("section");
		currentPlayer.innerHTML =
			'<pie-mc--version-1-0-0 id="q-1"></pie-mc--version-1-0-0><pie-mc--version-1-0-0 id="q1"></pie-mc--version-1-0-0>';
		document.body.append(currentPlayer);

		const { results } = await scorePieItem(
			{
				...config,
				models: [{ id: "q1", element: "pie-mc--version-1-0-0" }],
			},
			[{ id: "q1", element: "pie-mc--version-1-0-0", value: "exact" }],
			{
				container: currentPlayer,
				outcomeArguments: "model-session-env",
				includeMissingResults: true,
			},
		);

		expect(results).toEqual([
			{ id: "q1", element: "pie-mc--version-1-0-0", value: "exact", score: 1 },
		]);
	});
});
