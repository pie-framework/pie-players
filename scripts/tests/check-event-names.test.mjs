import { describe, expect, test } from "bun:test";

import {
	checkEventNames,
	isPieEventName,
	LEGACY_EVENT_NAMES,
	manifestEvents,
	readPackageManifests,
} from "../check-event-names.mjs";

const manifest = (...events) => ({
	modules: [
		{
			declarations: [
				{ tagName: "pie-x", events: events.map((name) => ({ name })) },
				{ name: "NotAnElement" },
			],
		},
	],
});

describe("check-event-names", () => {
	test("reads the events of every declaration, with the element that fires them", () => {
		expect(manifestEvents(manifest("pie-a", "b"))).toEqual([
			{ element: "pie-x", name: "pie-a" },
			{ element: "pie-x", name: "b" },
		]);
		expect(manifestEvents({})).toEqual([]);
	});

	test("accepts the pie- namespace", () => {
		expect(isPieEventName("pie-stage-change")).toBe(true);
		expect(isPieEventName("close")).toBe(false);
		expect(isPieEventName("pie")).toBe(false);
	});

	test("fails a new event outside the namespace, and names where it is declared", () => {
		const { violations } = checkEventNames(
			[{ directory: "item-player", manifest: manifest("pie-ok", "brand-new") }],
			{},
		);
		expect(violations).toEqual([
			{ directory: "item-player", element: "pie-x", name: "brand-new" },
		]);
	});

	test("an allowlisted name passes in its own package only", () => {
		const allowed = { "item-player": ["close"] };
		expect(
			checkEventNames(
				[{ directory: "item-player", manifest: manifest("close") }],
				allowed,
			).violations,
		).toEqual([]);
		expect(
			checkEventNames(
				[{ directory: "tool-new", manifest: manifest("close") }],
				allowed,
			).violations,
		).toEqual([{ directory: "tool-new", element: "pie-x", name: "close" }]);
	});

	test("an allowlist entry no manifest declares is stale", () => {
		const { stale } = checkEventNames(
			[{ directory: "item-player", manifest: manifest("pie-a") }],
			{ "item-player": ["close"], "gone-package": ["x"] },
		);
		expect(stale).toEqual([
			{ directory: "item-player", name: "close" },
			{ directory: "gone-package", name: "x" },
		]);
	});

	test("every event the repository's manifests declare is namespaced or listed, and the list is current", () => {
		const packages = readPackageManifests();
		const { events, violations, stale } = checkEventNames(packages);
		expect(violations).toEqual([]);
		expect(stale).toEqual([]);
		// Positive control: empty manifests would also report no violations.
		expect(packages.length).toBeGreaterThan(20);
		expect(events).toBeGreaterThan(Object.values(LEGACY_EVENT_NAMES).flat().length);
	});
});
