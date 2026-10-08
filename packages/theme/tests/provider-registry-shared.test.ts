/**
 * Every copy of this package on a page shares one provider registry.
 *
 * A host and its remotes each bundle a copy, while `<pie-theme>` is defined by
 * whichever copy loads first. A provider registered through a later copy has to
 * reach that element. The query string loads a second, independent instance of
 * the module, the way a second bundle would.
 */

import { afterEach, describe, expect, test } from "bun:test";

import {
	getPieThemeProvider,
	observePieThemeProviders,
	registerPieThemeProvider,
	unregisterPieThemeProvider,
} from "../src/providers";

const loadSecondCopy = () =>
	// @ts-expect-error The query makes bun load a second instance of the module.
	import("../src/providers.ts?second-copy") as Promise<
		typeof import("../src/providers")
	>;

const sharedAdapter = {
	id: "provider-registry-shared-probe",
	canRead: () => true,
	read: () => ({ "--pie-background": "rgb(1, 2, 3)" }),
};

describe("provider registry shared between package copies", () => {
	afterEach(() => {
		unregisterPieThemeProvider(sharedAdapter.id);
	});

	test("a provider registered through a later copy is visible to the first", async () => {
		const secondCopy = await loadSecondCopy();
		expect(secondCopy.registerPieThemeProvider).not.toBe(
			registerPieThemeProvider,
		);

		secondCopy.registerPieThemeProvider(sharedAdapter);

		expect(getPieThemeProvider(sharedAdapter.id)).toBe(sharedAdapter);
	});

	test("an element observing through the first copy hears a later copy's registration", async () => {
		const secondCopy = await loadSecondCopy();
		let notifications = 0;
		const stopObserving = observePieThemeProviders(() => {
			notifications += 1;
		});

		secondCopy.registerPieThemeProvider(sharedAdapter);
		stopObserving();

		expect(notifications).toBe(1);
	});

	test("a later copy keeps the first copy's DaisyUI adapter", async () => {
		const firstDaisyAdapter = getPieThemeProvider("daisyui");
		const secondCopy = await loadSecondCopy();

		expect(secondCopy.getPieThemeProvider("daisyui")).toBe(firstDaisyAdapter);
	});
});
