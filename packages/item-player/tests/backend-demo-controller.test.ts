import { describe, expect, test } from "bun:test";
import {
	executeControllerModel,
	executeControllerOutcome,
	mergeSessionUpdates,
} from "../../../apps/backend-demos/src/routes/api/player/controllers";

const controllerJs = `
module.exports.model = async (model, session, env, updateSession) => {
	if (session.needsUpdate) {
		await updateSession(model.id, model.element, { serverTouched: true });
	}
	return {
		prompt: model.prompt,
		choices: model.choices.map((choice) => {
			const next = { value: choice.value, label: choice.label };
			if (env.role !== "student") {
				next.correct = choice.correct;
			}
			return next;
		})
	};
};

module.exports.outcome = async (model, session) => ({
	score: session.value === model.correctValue ? 1 : 0,
	max: 1,
	empty: !session.value
});
`;

const model = {
	id: "q1",
	element: "multiple-choice",
	prompt: "Pick one",
	promptEnabled: true,
	correctValue: "b",
	choices: [
		{ value: "a", label: "A", correct: false },
		{ value: "b", label: "B", correct: true },
	],
};

describe("backend demo controller executor", () => {
	test("executes controller model and captures session updates", async () => {
		const result = await executeControllerModel({
			controllerJs,
			model,
			session: { id: "q1", element: "multiple-choice", needsUpdate: true },
			env: { mode: "gather", role: "student" },
		});

		expect(result.model.id).toBe("q1");
		expect(result.model.element).toBe("multiple-choice");
		expect(result.model.promptEnabled).toBe(true);
		expect(JSON.stringify(result.model)).not.toContain("correct");
		expect(result.sessionUpdates).toEqual([
			{ id: "q1", element: "multiple-choice", serverTouched: true },
		]);
	});

	test("executes controller outcome on the backend", async () => {
		const result = await executeControllerOutcome({
			controllerJs,
			model,
			session: { id: "q1", element: "multiple-choice", value: "b" },
			env: { mode: "evaluate", role: "student" },
		});

		expect(result).toMatchObject({
			id: "q1",
			element: "multiple-choice",
			score: 1,
			max: 1,
			empty: false,
		});
	});

	test("merges controller session updates into session data", () => {
		const merged = mergeSessionUpdates(
			[{ id: "q1", element: "multiple-choice", value: "a" }],
			[{ id: "q1", element: "multiple-choice", serverTouched: true }],
		);

		expect(merged).toEqual([
			{
				id: "q1",
				element: "multiple-choice",
				value: "a",
				serverTouched: true,
			},
		]);
	});
});
