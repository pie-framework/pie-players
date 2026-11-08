/**
 * Every copy of this package on a page shares one custom color-scheme registry.
 *
 * A host and its remotes each bundle a copy, while `<pie-theme>` is defined by
 * whichever copy loads first. A scheme registered through a later copy has to
 * reach that element. The query string loads a second, independent instance of
 * the module, the way a second bundle would.
 */

import { describe, expect, test } from "bun:test";

import {
	listPieColorSchemes,
	observePieColorSchemes,
	registerPieColorSchemes,
} from "../src/color-schemes";

const loadSecondCopy = () =>
	// @ts-expect-error The query makes bun load a second instance of the module.
	import("../src/color-schemes.ts?second-copy") as Promise<
		typeof import("../src/color-schemes")
	>;

const probe = {
	id: "scheme-registry-shared-probe",
	name: "Shared registry probe",
	variables: { "--pie-background": "rgb(250, 250, 250)", "--pie-text": "rgb(10, 10, 10)" },
};

const ids = (snapshot: ReturnType<typeof listPieColorSchemes>) =>
	snapshot.schemes.map((scheme) => scheme.id);

describe("color-scheme registry shared between package copies", () => {
	test("a scheme registered through a later copy is listed by the first", async () => {
		const secondCopy = await loadSecondCopy();
		expect(secondCopy.registerPieColorSchemes).not.toBe(registerPieColorSchemes);
		const before = listPieColorSchemes();

		const receipt = secondCopy.registerPieColorSchemes([probe]);

		expect(receipt.acceptedSchemeIds).toEqual([probe.id]);
		expect(ids(listPieColorSchemes())).toContain(probe.id);
		expect(listPieColorSchemes().generation).toBeGreaterThan(before.generation);

		receipt.unregister();
		expect(ids(listPieColorSchemes())).not.toContain(probe.id);
	});

	test("an observer in the first copy hears a later copy's registration", async () => {
		const secondCopy = await loadSecondCopy();
		const generations: number[] = [];
		const stopObserving = observePieColorSchemes((snapshot) => {
			generations.push(snapshot.generation);
		});
		generations.length = 0;

		const receipt = secondCopy.registerPieColorSchemes([probe]);
		receipt.unregister();
		stopObserving();

		expect(generations).toHaveLength(2);
		expect(generations[1]).toBeGreaterThan(generations[0] ?? 0);
	});

	test("one copy's registration key cannot unregister another copy's replacement", async () => {
		const secondCopy = await loadSecondCopy();
		const first = registerPieColorSchemes([probe]);
		const replacement = secondCopy.registerPieColorSchemes([probe]);

		first.unregister();
		expect(ids(listPieColorSchemes())).toContain(probe.id);

		replacement.unregister();
		expect(ids(listPieColorSchemes())).not.toContain(probe.id);
	});
});
