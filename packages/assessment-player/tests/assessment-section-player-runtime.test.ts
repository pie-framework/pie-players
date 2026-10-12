import { describe, expect, test } from "bun:test";
import { resolveAssessmentSectionPlayerRuntime } from "../src/components/assessment-section-player-runtime";

describe("assessment section-player runtime", () => {
	test("clones the host backend without adding an assignment id", () => {
		const sectionPlayerRuntime = {
			player: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
						options: {
							overrides: {
								"student-grade": "5",
							},
						},
					},
				},
			},
		};

		const runtime = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime,
			playerType: "preloaded",
			env: { mode: "gather", role: "student" },
			coordinator: { kind: "coordinator" },
		});
		const delivery = (runtime.player as any).backend.delivery;

		expect(delivery).toEqual(sectionPlayerRuntime.player.backend.delivery);
		expect("assignmentId" in delivery).toBe(false);
		expect(delivery.options).not.toBe(
			sectionPlayerRuntime.player.backend.delivery.options,
		);
		expect(runtime.playerType).toBe("preloaded");
		expect(runtime.env).toEqual({ mode: "gather", role: "student" });
		expect(runtime.coordinator).toEqual({ kind: "coordinator" });
	});

	test("keeps the host's delivery assignmentId", () => {
		const runtime = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime: {
				player: {
					backend: {
						delivery: {
							enabled: true,
							baseUrl: "/qe",
							assignmentId: "explicit-assignment",
						},
					},
				},
			},
			playerType: "iife",
		});

		expect((runtime.player as any).backend.delivery.assignmentId).toBe(
			"explicit-assignment",
		);
	});

	test("preserves sectionPlayerRuntime top-level precedence", () => {
		const runtime = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime: {
				playerType: "esm",
				env: { mode: "view" },
				coordinator: { kind: "section-runtime-coordinator" },
			},
			playerType: "iife",
			env: { mode: "gather" },
			coordinator: { kind: "assessment-coordinator" },
		});

		expect(runtime.playerType).toBe("esm");
		expect(runtime.env).toEqual({ mode: "view" });
		expect(runtime.coordinator).toEqual({
			kind: "section-runtime-coordinator",
		});
	});

	test("carries the assessment id in runtime, under the host's own", () => {
		expect(
			resolveAssessmentSectionPlayerRuntime({
				playerType: "iife",
				assessmentId: "assessment-1",
			}).assessmentId,
		).toBe("assessment-1");
		expect(
			resolveAssessmentSectionPlayerRuntime({
				sectionPlayerRuntime: { assessmentId: "host-assessment" },
				playerType: "iife",
				assessmentId: "assessment-1",
			}).assessmentId,
		).toBe("host-assessment");
	});
});
