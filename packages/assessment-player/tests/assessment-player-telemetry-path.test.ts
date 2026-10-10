import { describe, expect, test } from "bun:test";
import { ASSESSMENT_INSTRUMENTATION_EVENT_MAP } from "@pie-players/pie-players-shared/pie";
import { ASSESSMENT_PLAYER_PUBLIC_EVENTS } from "../src/contracts/public-events";
import type { AssessmentPlayerHooks } from "../src/types";

describe("assessment telemetry path", () => {
	test("every public assessment event reaches the instrumentation provider", () => {
		const bridged = ASSESSMENT_INSTRUMENTATION_EVENT_MAP.map((mapping) => mapping.sourceEventName);
		expect(bridged.toSorted()).toEqual(Object.values(ASSESSMENT_PLAYER_PUBLIC_EVENTS).toSorted());
	});

	test("hooks declare no second telemetry sink", () => {
		const hooks: AssessmentPlayerHooks = {
			// @ts-expect-error assessment telemetry goes through `loaderConfig.instrumentationProvider`
			onTelemetry: () => {},
		};
		expect(Object.keys(hooks)).toEqual(["onTelemetry"]);
	});
});
