import { describe, expect, test } from "bun:test";
import {
	createFormativeItemState,
	hideFormativeItem,
	recordFormativeTry,
	resolveFormativeItemView,
	resolveFormativePolicy,
	retryFormativeItem,
	revealFormativeItem,
	type FormativeCorrectness,
	type FormativeTryOutcome,
} from "../src/formative/index.js";

const outcome = (correctness: FormativeCorrectness): FormativeTryOutcome => ({
	correctness,
	points: correctness === "correct" ? 1 : 0,
	max: 1,
	scoredElementCount: correctness === "unknown" ? 0 : 1,
	totalElementCount: 1,
});

const policyOf = (
	overrides: Parameters<typeof resolveFormativePolicy>[0],
) => resolveFormativePolicy({ enabled: true, ...overrides });

describe("recordFormativeTry", () => {
	test("a disabled policy records nothing", () => {
		const policy = resolveFormativePolicy({ enabled: false, maxTries: 3 });
		const next = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		expect(next.tryCount).toBe(0);
		expect(next.revealed).toBe(false);
	});

	test("the first try counts and reveals under the default policy", () => {
		const next = recordFormativeTry({
			itemIdentifier: "q1",
			policy: policyOf({}),
			outcome: outcome("incorrect"),
		});
		expect(next).toMatchObject({
			version: 1,
			itemIdentifier: "q1",
			tryCount: 1,
			revealed: true,
		});
		expect(next.lastOutcome?.correctness).toBe("incorrect");
		expect(next.firstCorrectTry).toBeUndefined();
	});

	test("a revealed item cannot spend another try until it is retried", () => {
		const policy = policyOf({ maxTries: 3 });
		const first = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		const blocked = recordFormativeTry({
			state: first,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		// Same object back: this is what makes a double submit cost nothing.
		expect(blocked).toBe(first);
	});

	test("tries exhaust and then stop counting", () => {
		const policy = policyOf({ maxTries: 2, feedback: "none" });
		let state = createFormativeItemState("q1");
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(state.tryCount).toBe(2);
		const beyond = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		expect(beyond).toBe(state);
	});

	test("feedback none never reveals, however many tries are spent", () => {
		const policy = policyOf({ maxTries: 2, feedback: "none" });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		expect(state.revealed).toBe(false);
		expect(state.tryCount).toBe(1);
	});

	test("on-final-try withholds the reveal until the last try", () => {
		const policy = policyOf({ maxTries: 3, revealOn: "on-final-try" });
		let state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(state.revealed).toBe(false);
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(state.revealed).toBe(false);
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(state).toMatchObject({ tryCount: 3, revealed: true });
	});

	test("firstCorrectTry is recorded once and a later wrong answer does not clear it", () => {
		const policy = policyOf({ maxTries: "unlimited" });
		let state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		state = retryFormativeItem({ state, policy }) ?? state;
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		expect(state.firstCorrectTry).toBe(2);
		state = retryFormativeItem({ state, policy }) ?? state;
		state = recordFormativeTry({
			state,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(state.firstCorrectTry).toBe(2);
		expect(state.lastOutcome?.correctness).toBe("incorrect");
	});
});

describe("retryFormativeItem", () => {
	test("clears the reveal without spending a try", () => {
		const policy = policyOf({ maxTries: 3 });
		const checked = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		const retried = retryFormativeItem({ state: checked, policy });
		expect(retried).toMatchObject({ tryCount: 1, revealed: false });
		expect(retried?.lastOutcome?.correctness).toBe("incorrect");
	});

	test("does nothing when nothing is revealed", () => {
		const policy = policyOf({ maxTries: 3 });
		const state = createFormativeItemState("q1");
		expect(retryFormativeItem({ state, policy })).toBe(state);
	});

	test("does nothing when tries are spent", () => {
		const policy = policyOf({ maxTries: 1 });
		const checked = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(retryFormativeItem({ state: checked, policy })).toBe(checked);
	});
});

describe("resolveFormativeItemView", () => {
	test("a disabled policy offers nothing and projects no env", () => {
		const view = resolveFormativeItemView({
			policy: resolveFormativePolicy({ enabled: false }),
		});
		expect(view).toMatchObject({
			enabled: false,
			canCheck: false,
			canRetry: false,
			revealed: false,
		});
		expect(view.envOverride).toBeUndefined();
	});

	test("an untried enabled item can be checked and nothing else", () => {
		const view = resolveFormativeItemView({ policy: policyOf({ maxTries: 2 }) });
		expect(view).toMatchObject({
			enabled: true,
			tryCount: 0,
			triesRemaining: 2,
			canCheck: true,
			canRetry: false,
		});
		expect(view.envOverride).toBeUndefined();
	});

	test("correctness feedback projects evaluate mode for a student", () => {
		const policy = policyOf({ maxTries: 2 });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("partial"),
		});
		const view = resolveFormativeItemView({ policy, state });
		expect(view).toMatchObject({
			canCheck: false,
			canRetry: true,
			revealed: true,
			triesRemaining: 1,
		});
		expect(view.envOverride).toEqual({ mode: "evaluate", role: "student" });
		expect(view.lastOutcome?.correctness).toBe("partial");
	});

	test("solution feedback projects the instructor role", () => {
		const policy = policyOf({ feedback: "solution" });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(resolveFormativeItemView({ policy, state }).envOverride).toEqual({
			mode: "evaluate",
			role: "instructor",
		});
	});

	test("feedback none records a try and still projects no env", () => {
		const policy = policyOf({ maxTries: 2, feedback: "none" });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("correct"),
		});
		const view = resolveFormativeItemView({ policy, state });
		expect(view.envOverride).toBeUndefined();
		// Nothing was revealed, so there is nothing to dismiss before checking again.
		expect(view).toMatchObject({ canCheck: true, canRetry: false, tryCount: 1 });
	});

	test("the override is withdrawn by a retry", () => {
		const policy = policyOf({ maxTries: 3 });
		const checked = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		const retried = retryFormativeItem({ state: checked, policy });
		expect(
			resolveFormativeItemView({ policy, state: retried }).envOverride,
		).toBeUndefined();
	});

	test("a spent single-try item offers neither action", () => {
		const policy = policyOf({ maxTries: 1 });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(resolveFormativeItemView({ policy, state })).toMatchObject({
			canCheck: false,
			canRetry: false,
			revealed: true,
			triesRemaining: 0,
		});
	});

	test("unlimited tries always leave an action available", () => {
		const policy = policyOf({ maxTries: "unlimited" });
		const state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(resolveFormativeItemView({ policy, state })).toMatchObject({
			triesRemaining: "unlimited",
			canRetry: true,
		});
	});
});

describe("host-forced reveal", () => {
	test("reveals an item with no try yet, spending no try", () => {
		const policy = policyOf({ maxTries: 3 });
		const state = revealFormativeItem({
			itemIdentifier: "q1",
			policy,
			feedback: "solution",
		});
		expect(state).toMatchObject({
			tryCount: 0,
			revealed: true,
			revealOverride: "solution",
		});
		expect(
			resolveFormativeItemView({ policy, state }).envOverride,
		).toEqual({ mode: "evaluate", role: "instructor" });
	});

	test("ignores a spent try budget, which a learner retry respects", () => {
		const policy = policyOf({ maxTries: 1 });
		const spent = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		// The learner is out of tries, so the reveal is stuck for them...
		expect(retryFormativeItem({ state: spent, policy })).toBe(spent);
		// ...but a host can still put it back.
		const hidden = hideFormativeItem({ state: spent, policy });
		expect(hidden).toMatchObject({ tryCount: 1, revealed: false });
		expect(
			resolveFormativeItemView({ policy, state: hidden }).envOverride,
		).toBeUndefined();
	});

	test("raises the reveal level over the item's own policy", () => {
		const policy = policyOf({ maxTries: 2, feedback: "correctness" });
		const checked = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(
			resolveFormativeItemView({ policy, state: checked }).envOverride,
		).toEqual({ mode: "evaluate", role: "student" });

		const forced = revealFormativeItem({
			state: checked,
			itemIdentifier: "q1",
			policy,
			feedback: "solution",
		});
		expect(
			resolveFormativeItemView({ policy, state: forced }).envOverride,
		).toEqual({ mode: "evaluate", role: "instructor" });
		// No Try was spent by showing the answer.
		expect(forced.tryCount).toBe(1);
	});

	test("reveals even where the policy withholds feedback entirely", () => {
		const policy = policyOf({ maxTries: 2, feedback: "none" });
		const forced = revealFormativeItem({
			itemIdentifier: "q1",
			policy,
			feedback: "correctness",
		});
		expect(
			resolveFormativeItemView({ policy, state: forced }).envOverride,
		).toEqual({ mode: "evaluate", role: "student" });
	});

	test("a learner retry clears the host override rather than keeping it", () => {
		const policy = policyOf({ maxTries: 3, feedback: "correctness" });
		let state = recordFormativeTry({
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		state = revealFormativeItem({
			state,
			itemIdentifier: "q1",
			policy,
			feedback: "solution",
		});
		const retried = retryFormativeItem({ state, policy });
		expect(retried?.revealOverride).toBeUndefined();
		// The next earned reveal is back at the policy's level, not the teacher's.
		const rechecked = recordFormativeTry({
			state: retried,
			itemIdentifier: "q1",
			policy,
			outcome: outcome("incorrect"),
		});
		expect(
			resolveFormativeItemView({ policy, state: rechecked }).envOverride,
		).toEqual({ mode: "evaluate", role: "student" });
	});

	test("re-revealing at the same level is idempotent", () => {
		const policy = policyOf({ maxTries: 2 });
		const first = revealFormativeItem({
			itemIdentifier: "q1",
			policy,
			feedback: "correctness",
		});
		expect(
			revealFormativeItem({
				state: first,
				itemIdentifier: "q1",
				policy,
				feedback: "correctness",
			}),
		).toBe(first);
	});

	test("a disabled policy refuses both host operations", () => {
		const policy = resolveFormativePolicy({ enabled: false });
		expect(
			revealFormativeItem({ itemIdentifier: "q1", policy, feedback: "solution" })
				.revealed,
		).toBe(false);
		const state = createFormativeItemState("q1");
		expect(hideFormativeItem({ state, policy })).toBe(state);
	});
});
