import { describe, expect, test } from "bun:test";
import {
	FORMATIVE_POLICY_DEFAULTS,
	isFormativeSectionEnabled,
	resolveFormativePolicies,
	resolveFormativePolicy,
} from "../src/formative/index.js";

describe("resolveFormativePolicy", () => {
	test("an absent policy resolves to disabled delivery", () => {
		expect(resolveFormativePolicy()).toEqual(FORMATIVE_POLICY_DEFAULTS);
		expect(resolveFormativePolicy(null, null).enabled).toBe(false);
	});

	test("the section supplies the default", () => {
		expect(
			resolveFormativePolicy({ enabled: true, maxTries: 3, feedback: "solution" }),
		).toEqual({
			enabled: true,
			maxTries: 3,
			feedback: "solution",
			revealOn: "on-try",
		});
	});

	test("an item ref overrides field by field", () => {
		const resolved = resolveFormativePolicy(
			{ enabled: true, maxTries: 3, feedback: "correctness" },
			{ maxTries: "unlimited" },
		);
		expect(resolved).toEqual({
			enabled: true,
			maxTries: "unlimited",
			feedback: "correctness",
			revealOn: "on-try",
		});
	});

	test("an item ref can opt one item out of an enabled section", () => {
		expect(
			resolveFormativePolicy({ enabled: true }, { enabled: false }).enabled,
		).toBe(false);
	});

	test("unrecognized values fall through to the layer beneath", () => {
		const resolved = resolveFormativePolicy(
			{ enabled: true, maxTries: 4, feedback: "correctness" },
			{
				maxTries: 0,
				feedback: "shout-it" as never,
				revealOn: "eventually" as never,
			},
		);
		expect(resolved.maxTries).toBe(4);
		expect(resolved.feedback).toBe("correctness");
		expect(resolved.revealOn).toBe("on-try");
	});

	test("a fractional try limit truncates rather than being rejected", () => {
		expect(resolveFormativePolicy({ maxTries: 2.7 }).maxTries).toBe(2);
	});

	test("on-final-try coerces to on-try under unlimited tries", () => {
		const resolved = resolveFormativePolicy({
			enabled: true,
			maxTries: "unlimited",
			revealOn: "on-final-try",
		});
		expect(resolved.revealOn).toBe("on-try");
	});

	test("on-final-try survives a finite try limit", () => {
		expect(
			resolveFormativePolicy({ maxTries: 3, revealOn: "on-final-try" }).revealOn,
		).toBe("on-final-try");
	});
});

describe("resolveFormativePolicies", () => {
	test("keys by the supplied identifier and skips blank ones", () => {
		const policies = resolveFormativePolicies({
			sectionPolicy: { enabled: true, maxTries: 2 },
			items: [
				{ identifier: "q1" },
				{ identifier: "q2", policy: { maxTries: 5 } },
				{ identifier: "" },
			],
		});
		expect(Object.keys(policies)).toEqual(["q1", "q2"]);
		expect(policies.q1?.maxTries).toBe(2);
		expect(policies.q2?.maxTries).toBe(5);
	});

	test("the section is enabled when any single item is", () => {
		expect(
			isFormativeSectionEnabled(
				resolveFormativePolicies({
					sectionPolicy: null,
					items: [{ identifier: "q1" }, { identifier: "q2", policy: { enabled: true } }],
				}),
			),
		).toBe(true);
		expect(
			isFormativeSectionEnabled(
				resolveFormativePolicies({
					sectionPolicy: null,
					items: [{ identifier: "q1" }],
				}),
			),
		).toBe(false);
	});
});
