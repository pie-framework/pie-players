import { afterEach, describe, expect, test } from "bun:test";
import { createCortexLocalization } from "../src/localization.js";
import {
	acquireMathfieldSettings,
	mathfieldDecimalSeparator,
} from "../src/mathlive-runtime.js";

/*
 * The lease over `MathfieldElement.locale` and `.decimalSeparator`.
 *
 * Both are static properties of the element class, so they are process-wide state
 * shared with every other mathfield on the page. What is asserted here is that
 * setting them is reversible: who owns the lease, what was captured, and that the
 * page's own setting comes back when the calculators are gone.
 */

const LEASE_KEY = Symbol.for("pie-players.calculator-cortex.mathlive-keyboard");
const localization = (locale: string) => createCortexLocalization(locale);

interface MathfieldSettings {
	locale: string;
	decimalSeparator: "." | ",";
}

/** Stands in for the page's own configuration of the mathfield class. */
const pageSettings = (): MathfieldSettings => ({
	locale: "en-GB",
	decimalSeparator: ".",
});

afterEach(() => {
	Reflect.deleteProperty(globalThis as Record<symbol, unknown>, LEASE_KEY);
});

describe("the decimal separator a locale writes", () => {
	test("follows the locale, and falls back to a period when it cannot", () => {
		expect(mathfieldDecimalSeparator("en-US")).toBe(".");
		expect(mathfieldDecimalSeparator("nl-NL")).toBe(",");
		expect(mathfieldDecimalSeparator("not a locale")).toBe(".");
	});
});

describe("acquiring and releasing", () => {
	test("applies the calculator's locale and puts the page's back", () => {
		const settings = pageSettings();
		const release = acquireMathfieldSettings(
			Symbol("owner"),
			localization("nl-NL"),
			settings,
		);
		expect(settings).toEqual({ locale: "nl-NL", decimalSeparator: "," });

		release();
		expect(settings).toEqual({ locale: "en-GB", decimalSeparator: "." });
		expect((globalThis as Record<symbol, unknown>)[LEASE_KEY]).toBeUndefined();
	});

	test("captures the page's setting once, not the previous calculator's", () => {
		/*
		 * Two calculators, or one re-acquiring on focus: the capture must survive as
		 * the *page's* values. Capturing again on the second acquire would restore
		 * the first calculator's locale and leave the page permanently changed.
		 */
		const settings = pageSettings();
		const releaseFirst = acquireMathfieldSettings(
			Symbol("first"),
			localization("nl-NL"),
			settings,
		);
		const releaseSecond = acquireMathfieldSettings(
			Symbol("second"),
			localization("en-US"),
			settings,
		);
		expect(settings.locale).toBe("en-US");

		// The first no longer owns the lease, so its release is inert — otherwise
		// closing it would reset the class underneath a calculator still open.
		releaseFirst();
		expect(settings.locale).toBe("en-US");

		releaseSecond();
		expect(settings).toEqual({ locale: "en-GB", decimalSeparator: "." });
	});

	test("re-acquiring by the same owner keeps the captured page setting", () => {
		const settings = pageSettings();
		const owner = Symbol("owner");
		acquireMathfieldSettings(owner, localization("nl-NL"), settings);
		const release = acquireMathfieldSettings(
			owner,
			localization("nl-NL"),
			settings,
		);
		release();
		expect(settings).toEqual({ locale: "en-GB", decimalSeparator: "." });
	});

	test("a release after the lease is gone does nothing", () => {
		const settings = pageSettings();
		const release = acquireMathfieldSettings(
			Symbol("owner"),
			localization("nl-NL"),
			settings,
		);
		release();
		settings.locale = "de-DE";
		release();
		expect(settings.locale).toBe("de-DE");
	});
});
