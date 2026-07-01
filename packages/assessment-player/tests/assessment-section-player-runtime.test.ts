import { describe, expect, test } from "bun:test";
import { resolveAssessmentSectionPlayerRuntime } from "../src/components/assessment-section-player-runtime";

describe("assessment section-player runtime", () => {
	test("defaults delivery assignmentId from attempt id without mutating host runtime", () => {
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

		const first = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime,
			playerType: "preloaded",
			attemptId: "attempt-1",
			env: { mode: "gather", role: "student" },
			coordinator: { kind: "coordinator" },
		});
		const second = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime,
			playerType: "preloaded",
			attemptId: "attempt-2",
			env: { mode: "gather", role: "student" },
		});

		expect((first.player as any).backend.delivery.assignmentId).toBe(
			"attempt-1",
		);
		expect((second.player as any).backend.delivery.assignmentId).toBe(
			"attempt-2",
		);
		expect((first.player as any).backend.delivery.options.overrides).toEqual({
			"student-grade": "5",
		});
		expect((first.player as any).backend.delivery.options).not.toBe(
			(sectionPlayerRuntime.player.backend.delivery as any).options,
		);
		expect(sectionPlayerRuntime).toEqual({
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
		});
		expect(first.playerType).toBe("preloaded");
		expect(first.env).toEqual({ mode: "gather", role: "student" });
		expect(first.coordinator).toEqual({ kind: "coordinator" });
	});

	test("preserves explicit delivery assignmentId over attempt id", () => {
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
			attemptId: "attempt-1",
		});

		expect((runtime.player as any).backend.delivery.assignmentId).toBe(
			"explicit-assignment",
		);
	});

	test("preserves explicitly empty delivery assignmentId", () => {
		const runtime = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime: {
				player: {
					backend: {
						delivery: {
							enabled: true,
							baseUrl: "/qe",
							assignmentId: "",
						},
					},
				},
			},
			playerType: "iife",
			attemptId: "attempt-1",
		});

		expect((runtime.player as any).backend.delivery.assignmentId).toBe("");
	});

	test("defaults explicitly undefined delivery assignmentId", () => {
		const runtime = resolveAssessmentSectionPlayerRuntime({
			sectionPlayerRuntime: {
				player: {
					backend: {
						delivery: {
							enabled: true,
							baseUrl: "/qe",
							assignmentId: undefined,
						},
					},
				},
			},
			playerType: "iife",
			attemptId: "attempt-1",
		});

		expect((runtime.player as any).backend.delivery.assignmentId).toBe(
			"attempt-1",
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
});
