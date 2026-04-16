import { expect, test } from "@playwright/test";
import {
	SPLITPANE_LAYOUT_CONTRACT,
	TABBED_LAYOUT_CONTRACT,
	VERTICAL_LAYOUT_CONTRACT,
} from "../src/contracts/layout-parity-metadata.js";
import {
	SECTION_PLAYER_PUBLIC_EVENTS,
} from "../src/contracts/public-events.js";
import { assertPublicEventName } from "../src/policies/guards.js";

test.describe("section player contract parity", () => {
	test("splitpane, vertical, and tabbed expose the same semantic contract surface", async () => {
		expect(SPLITPANE_LAYOUT_CONTRACT.props).toEqual(VERTICAL_LAYOUT_CONTRACT.props);
		expect(SPLITPANE_LAYOUT_CONTRACT.props).toEqual(TABBED_LAYOUT_CONTRACT.props);
		expect(SPLITPANE_LAYOUT_CONTRACT.recommendedBasicProps).toEqual(
			VERTICAL_LAYOUT_CONTRACT.recommendedBasicProps,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.recommendedBasicProps).toEqual(
			TABBED_LAYOUT_CONTRACT.recommendedBasicProps,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.advancedEscapeHatchProps).toEqual(
			VERTICAL_LAYOUT_CONTRACT.advancedEscapeHatchProps,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.advancedEscapeHatchProps).toEqual(
			TABBED_LAYOUT_CONTRACT.advancedEscapeHatchProps,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.events).toEqual(
			VERTICAL_LAYOUT_CONTRACT.events,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.events).toEqual(TABBED_LAYOUT_CONTRACT.events);
		expect(SPLITPANE_LAYOUT_CONTRACT.commands).toEqual(
			VERTICAL_LAYOUT_CONTRACT.commands,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.commands).toEqual(
			TABBED_LAYOUT_CONTRACT.commands,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.capabilities).toEqual(
			VERTICAL_LAYOUT_CONTRACT.capabilities,
		);
		expect(SPLITPANE_LAYOUT_CONTRACT.capabilities).toEqual(
			TABBED_LAYOUT_CONTRACT.capabilities,
		);
	});

	test("basic and advanced prop groups are disjoint and cover full prop surface", async () => {
		const basic = SPLITPANE_LAYOUT_CONTRACT.recommendedBasicProps;
		const advanced = SPLITPANE_LAYOUT_CONTRACT.advancedEscapeHatchProps;
		const all = SPLITPANE_LAYOUT_CONTRACT.props;
		const overlap = basic.filter((prop) => advanced.includes(prop as never));
		expect(overlap).toEqual([]);
		expect(new Set([...basic, ...advanced])).toEqual(new Set(all));
	});

	test("all public event names are accepted by policy guards", async () => {
		for (const eventName of Object.values(SECTION_PLAYER_PUBLIC_EVENTS)) {
			expect(() => assertPublicEventName(eventName)).not.toThrow();
		}
		expect(() => assertPublicEventName("not-a-public-event")).toThrow();
	});

	test("runtime command surface keeps controller bridge and avoids duplicate gating commands", async () => {
		const commands = SPLITPANE_LAYOUT_CONTRACT.commands;
		expect(commands).toContain("getSectionController");
		expect(commands).toContain("waitForSectionController");
		expect(commands).not.toContain("canNavigateForward" as never);
		expect(commands).not.toContain("canNavigateBackward" as never);
		expect(commands).not.toContain("setNavigationPolicy" as never);
	});
});
