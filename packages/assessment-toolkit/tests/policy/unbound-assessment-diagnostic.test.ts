/**
 * The coordinator's report for a host that never bound an assessment.
 *
 * A feature policy is consulted once per capability per card, so the report is
 * once per coordinator: enough to make the gap findable, not enough to bury
 * itself. Granting is untouched by it.
 */

import { describe, expect, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";

const FEATURE = "signLanguage";

const captureWarnings = <T>(run: () => T): { value: T; warnings: string[] } => {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map(String).join(" "));
	};
	try {
		return { value: run(), warnings };
	} finally {
		console.warn = original;
	}
};

const unbound = (warnings: string[]) =>
	warnings.filter((warning) => warning.includes("no assessment bound"));

function makeCoordinator() {
	return new ToolkitCoordinator({
		assessmentId: "unbound-assessment-diagnostic",
		lazyInit: true,
		tools: { placement: { section: [] } },
	});
}

describe("serving a feature decision with nothing bound", () => {
	test("reports it once, however many capabilities ask", () => {
		const coordinator = makeCoordinator();
		const { warnings } = captureWarnings(() => {
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.decideFeaturePolicy("transcript");
		});
		expect(unbound(warnings)).toHaveLength(1);
	});

	test("names the call that fixes it", () => {
		const coordinator = makeCoordinator();
		const { warnings } = captureWarnings(() =>
			coordinator.decideFeaturePolicy(FEATURE),
		);
		expect(unbound(warnings)[0]).toContain("updateAssessment");
		expect(unbound(warnings)[0]).toContain(FEATURE);
	});

	test("still declines, and says why on the decision", () => {
		const coordinator = makeCoordinator();
		const { value } = captureWarnings(() =>
			coordinator.decideFeaturePolicy(FEATURE),
		);
		expect(value.granted).toBe(false);
		expect(value.assessmentBound).toBe(false);
	});
});

describe("a bound assessment is silent", () => {
	test("no report when one is bound up front", () => {
		const coordinator = makeCoordinator();
		coordinator.updateAssessment({ id: "a1" } as AssessmentEntity);
		const { value, warnings } = captureWarnings(() =>
			coordinator.decideFeaturePolicy(FEATURE),
		);
		expect(unbound(warnings)).toHaveLength(0);
		expect(value.assessmentBound).toBe(true);
	});

	test("binding after the report does not produce a second one", () => {
		// The report is the deployment's cue to call `updateAssessment`; repeating it
		// once the host has would be noise about a gap that no longer exists.
		const coordinator = makeCoordinator();
		const first = captureWarnings(() =>
			coordinator.decideFeaturePolicy(FEATURE),
		);
		expect(unbound(first.warnings)).toHaveLength(1);
		coordinator.updateAssessment({ id: "a1" } as AssessmentEntity);
		const second = captureWarnings(() => {
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.updateAssessment(null);
			coordinator.decideFeaturePolicy(FEATURE);
		});
		expect(unbound(second.warnings)).toHaveLength(0);
	});
});

describe("a coordinator the toolkit built for itself", () => {
	// The toolkit binds only the assessment its host passed, and a section player
	// passes none, so an unbound assessment is a gap only when the host enforces
	// profile policy.
	const makeToolkitOwned = (pnpEnforcement?: "on" | "off") =>
		new ToolkitCoordinator({
			assessmentId: "unbound-assessment-diagnostic",
			lazyInit: true,
			assessmentOptional: true,
			tools: {
				placement: { section: [] },
				...(pnpEnforcement ? { pnpEnforcement } : {}),
			},
		});

	test("is silent while enforcement is unset or off", () => {
		for (const coordinator of [makeToolkitOwned(), makeToolkitOwned("off")]) {
			const { value, warnings } = captureWarnings(() => {
				coordinator.decideFeaturePolicy(FEATURE);
				return coordinator.decideFeaturePolicy("transcript");
			});
			expect(unbound(warnings)).toHaveLength(0);
			expect(value.granted).toBe(false);
			expect(value.assessmentBound).toBe(false);
		}
	});

	test("reports once when the host enforces profile policy", () => {
		const coordinator = makeToolkitOwned("on");
		const { warnings } = captureWarnings(() => {
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.decideFeaturePolicy("transcript");
		});
		expect(unbound(warnings)).toHaveLength(1);
	});

	test("reports once enforcement is switched on after a silent decision", () => {
		const coordinator = makeToolkitOwned();
		const { warnings } = captureWarnings(() => {
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.setPnpEnforcement("on");
			coordinator.decideFeaturePolicy(FEATURE);
			coordinator.decideFeaturePolicy(FEATURE);
		});
		expect(unbound(warnings)).toHaveLength(1);
	});
});
