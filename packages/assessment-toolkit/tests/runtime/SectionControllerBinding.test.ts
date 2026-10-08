import { describe, expect, test } from "bun:test";

import { SectionControllerBinding } from "../../src/runtime/SectionControllerBinding.js";

describe("SectionControllerBinding — before a controller resolves", () => {
	test("reports media audio silent, so read-aloud is not held back", () => {
		// A section that never had a media port has no audio to pause.
		expect(
			new SectionControllerBinding().requestMediaPauseForCompetingAudio(),
		).toBe(true);
	});
});
