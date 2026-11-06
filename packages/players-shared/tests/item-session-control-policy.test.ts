import { describe, expect, test } from "bun:test";
import {
	ITEM_SESSION_CONTROL_DEFAULTS,
	isItemSessionControlEnabled,
	resolveItemSessionControls,
	resolveItemSessionControl,
} from "../src/item-session-control/index.js";

describe("resolveItemSessionControl", () => {
	test("an absent policy resolves to disabled delivery", () => {
		expect(resolveItemSessionControl()).toEqual(ITEM_SESSION_CONTROL_DEFAULTS);
		expect(resolveItemSessionControl(null, null).enabled).toBe(false);
	});

	test("the section supplies the default", () => {
		expect(
			resolveItemSessionControl({ enabled: true, maxTries: 3, feedback: "solution" }),
		).toEqual({
			enabled: true,
			maxTries: 3,
			feedback: "solution",
			revealOn: "on-try",
		});
	});

	test("an item ref overrides field by field", () => {
		const resolved = resolveItemSessionControl(
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
			resolveItemSessionControl({ enabled: true }, { enabled: false }).enabled,
		).toBe(false);
	});

	test("unrecognized values fall through to the layer beneath", () => {
		const resolved = resolveItemSessionControl(
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
		expect(resolveItemSessionControl({ maxTries: 2.7 }).maxTries).toBe(2);
	});

	test("on-final-try coerces to on-try under unlimited tries", () => {
		const resolved = resolveItemSessionControl({
			enabled: true,
			maxTries: "unlimited",
			revealOn: "on-final-try",
		});
		expect(resolved.revealOn).toBe("on-try");
	});

	test("on-final-try survives a finite try limit", () => {
		expect(
			resolveItemSessionControl({ maxTries: 3, revealOn: "on-final-try" }).revealOn,
		).toBe("on-final-try");
	});
});

describe("resolveItemSessionControls", () => {
	test("keys by the supplied identifier and skips blank ones", () => {
		const policies = resolveItemSessionControls({
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
			isItemSessionControlEnabled(
				resolveItemSessionControls({
					sectionPolicy: null,
					items: [{ identifier: "q1" }, { identifier: "q2", policy: { enabled: true } }],
				}),
			),
		).toBe(true);
		expect(
			isItemSessionControlEnabled(
				resolveItemSessionControls({
					sectionPolicy: null,
					items: [{ identifier: "q1" }],
				}),
			),
		).toBe(false);
	});
});
