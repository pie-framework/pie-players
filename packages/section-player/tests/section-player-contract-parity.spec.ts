import { expect, test } from "@playwright/test";
import {
	SPLITPANE_LAYOUT_CONTRACT,
	VERTICAL_LAYOUT_CONTRACT,
} from "../src/contracts/layout-parity-metadata.js";
import {
	SECTION_PLAYER_PUBLIC_EVENTS,
} from "../src/contracts/public-events.js";
import { assertPublicEventName } from "../src/policies/guards.js";

test.describe("section player contract parity", () => {
	test("splitpane and vertical expose the same semantic contract surface", async () => {
		expect(SPLITPANE_LAYOUT_CONTRACT.props).toEqual(VERTICAL_LAYOUT_CONTRACT.props);
		expect(SPLITPANE_LAYOUT_CONTRACT.events).toEqual(
			VERTICAL_LAYOUT_CONTRACT.events,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.commands).toEqual(
			VERTICAL_LAYOUT_CONTRACT.commands,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.capabilities).toEqual(
			VERTICAL_LAYOUT_CONTRACT.capabilities,
		);
	});

	test("all public event names are accepted by policy guards", async () => {
		for (const eventName of Object.values(SECTION_PLAYER_PUBLIC_EVENTS)) {
			expect(() => assertPublicEventName(eventName)).not.toThrow();
		}
		expect(() => assertPublicEventName("not-a-public-event")).toThrow();
	});
});
