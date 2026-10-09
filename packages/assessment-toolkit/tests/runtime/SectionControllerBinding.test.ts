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

describe("SectionControllerBinding — a section that fails to start", () => {
	test("stops serving the previous section's controller", async () => {
		const persisted: string[] = [];
		const controllerFor = (sectionId: string) => ({
			persist: async () => {
				persisted.push(sectionId);
			},
		});
		const failure = new Error("create failed");
		const coordinator = {
			getSectionController: () => undefined,
			getOrCreateSectionController: async (args: { sectionId: string }) => {
				if (args.sectionId === "two") throw failure;
				return controllerFor(args.sectionId);
			},
		};
		const binding = new SectionControllerBinding();
		const init = (sectionId: string) =>
			binding.initialize({
				coordinator: coordinator as never,
				section: {},
				sectionId,
				assessmentId: "assessment",
				view: "candidate",
				createDefaultController: () => controllerFor(sectionId) as never,
			});

		await init("one");
		await binding.persist();
		await expect(init("two")).rejects.toBe(failure);
		await binding.persist();

		expect(persisted).toEqual(["one"]);
	});
});
