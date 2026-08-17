/**
 * Worked example: reaching SchoolCity's colour-scheme set from a host.
 *
 * SchoolCity offers 15 schemes (`sc-online-testing` -
 * `components/exam/settings/ContrastSettings.vue`), four of which are built in
 * here. The other eleven are host-registrable today, and this file is the
 * executable proof plus the measurement of what each one costs — the README
 * section "SchoolCity scheme parity" is written from it.
 *
 * They are deliberately not built-ins. A built-in scheme is a full 48-token
 * palette because a two-colour scheme is a promise the whole surface has to keep,
 * and which schemes a programme actually wants is an open product question
 * (PIE-472). A host palette is host-owned, so it can be partial, and the
 * validator tells the host exactly which relationships its overlay has to cover.
 *
 * The cost is not uniform, and that is the useful part: it scales with how far
 * the background sits from white, because every semantic colour in the light base
 * was chosen against white.
 */

import { afterEach, describe, expect, test } from "bun:test";

import {
	listPieColorSchemes,
	registerPieColorSchemes,
	resolvePieTheme,
} from "../src/color-schemes.js";

const activeReceipts: Array<{ unregister(): void }> = [];

function register(entries: Parameters<typeof registerPieColorSchemes>[0]) {
	const receipt = registerPieColorSchemes(entries);
	activeReceipts.push(receipt);
	return receipt;
}

afterEach(() => {
	for (const receipt of activeReceipts.splice(0)) receipt.unregister();
});

/** SchoolCity's own palette values, resolved from its design tokens. */
const SC = {
	black: "#000000",
	white: "#ffffff",
	blue: "#0028a1",
	red: "#bf0d00",
	green: "#008272",
	yellow: "#ffe072",
	darkGray: "#9297a6",
} as const;

/**
 * A white background needs nothing but the ink: every semantic colour in the
 * light base already holds against white.
 */
const BLUE_ON_WHITE = {
	"--pie-text": SC.blue,
	"--pie-background": SC.white,
};

/**
 * Green is the tightest of SchoolCity's inks at 4.73:1 against white, which
 * clears ordinary text but not the recessed surfaces the light base tints
 * (`--pie-background-dark`, `--pie-incorrect-secondary`). Flattening those two to
 * white is enough; the alternative is a darker green, which is SchoolCity's
 * brand colour and not ours to change.
 */
const GREEN_ON_WHITE = {
	"--pie-text": SC.green,
	"--pie-background": SC.white,
	"--pie-background-dark": SC.white,
	"--pie-incorrect-secondary": SC.white,
};

/**
 * Pure black inverts the page, so the semantic inks have to come with it. These
 * are the dark base theme's own values — authored against `#000000` already,
 * so they are borrowed rather than invented.
 */
const YELLOW_ON_BLACK = {
	"--pie-text": SC.yellow,
	"--pie-background": SC.black,
	"--pie-background-dark": "#1a1a1a",
	"--pie-incorrect-secondary": "#330000",
	"--pie-tertiary": "#00ffff",
	"--pie-correct": "#00ff00",
	"--pie-correct-tertiary": "#00cc00",
	"--pie-incorrect": "#ff3333",
	"--pie-missing": "#ff6666",
	"--pie-annotation-underline": "#9c89ec",
};

/**
 * A mid-tone background is the expensive case: neither the light inks nor the
 * dark ones hold against it, so icons, control boundaries and focus indicators
 * all have to be re-chosen. This is what a built-in would have to do eleven
 * times over.
 */
const WHITE_ON_BLUE = {
	"--pie-text": SC.white,
	"--pie-background": SC.blue,
	"--pie-background-dark": "#001b6d",
	"--pie-incorrect-secondary": "#3d0000",
	"--pie-tertiary": "#9fe8ff",
	"--pie-correct": "#7ef7a0",
	"--pie-correct-tertiary": "#7ef7a0",
	"--pie-correct-icon": "#7ef7a0",
	"--pie-incorrect": "#ffb3b3",
	"--pie-incorrect-icon": "#ffb3b3",
	"--pie-missing": "#ffc4a3",
	"--pie-missing-icon": "#c9c9ff",
	"--pie-annotation-underline": "#ffd7f5",
	"--pie-tool-annotation-toolbar-border": "#dfe4ff",
	"--pie-border": SC.white,
	"--pie-focus-checked-border": SC.yellow,
	"--pie-focus-unchecked-border": SC.white,
	"--pie-button-border": "#dfe4ff",
};

describe("SchoolCity's schemes that PIE already ships", () => {
	test("cover four of the fifteen, so a host registers eleven at most", () => {
		const ids = new Set(
			listPieColorSchemes().schemes.map((scheme) => scheme.id),
		);
		// Matched by colour pair against SchoolCity's list, not by label.
		for (const id of [
			"black-on-white",
			"white-on-black",
			"black-on-rose",
			"yellow-on-blue",
		]) {
			expect(ids.has(id)).toBe(true);
		}
	});
});

describe("registering the rest as host palettes", () => {
	test.each([
		["blue-on-white", BLUE_ON_WHITE, 2],
		["green-on-white", GREEN_ON_WHITE, 4],
		["yellow-on-black", YELLOW_ON_BLACK, 10],
		["white-on-blue", WHITE_ON_BLUE, 18],
	] as const)(
		"%s validates with no diagnostics at all, from %#",
		(id, variables, tokenCount) => {
			const receipt = register([{ id: `sc-${id}`, name: id, variables }]);

			// Not just no errors: contrast diagnostics are warnings, because the
			// palette is host-owned. A host that only checks severity learns nothing.
			expect(receipt.diagnostics).toEqual([]);
			expect(receipt.acceptedSchemeIds).toEqual([`sc-${id}`]);
			expect(Object.keys(variables)).toHaveLength(tokenCount);
		},
	);

	test("resolve as custom schemes and keep their own ink", () => {
		register([
			{
				id: "sc-yellow-on-black",
				name: "Yellow on Black",
				variables: YELLOW_ON_BLACK,
			},
		]);

		const resolved = resolvePieTheme({ requestedScheme: "sc-yellow-on-black" });

		expect(resolved.resolvedScheme?.id).toBe("sc-yellow-on-black");
		expect(resolved.variables["--pie-text"]).toBe(SC.yellow);
		expect(resolved.variables["--pie-background"]).toBe(SC.black);
		// A registered scheme is a full-surface promise like a built-in, so the
		// components that encode their own hues collapse into it.
		expect(resolved.variables["--pie-fixed-hue-collapse"]).toBe("100%");
	});
});

describe("what the validator is for", () => {
	test("reports the relationships a bare colour pair leaves behind", () => {
		// The same scheme as WHITE_ON_BLUE with only its two defining colours. A
		// host shipping this would render cyan links and a mid-blue focus ring on a
		// mid-blue page, and nothing at runtime would look wrong enough to notice.
		const receipt = register([
			{
				id: "sc-white-on-blue-underspecified",
				name: "White on Blue (underspecified)",
				variables: {
					"--pie-text": SC.white,
					"--pie-background": SC.blue,
				},
			},
		]);

		expect(receipt.acceptedSchemeIds).toEqual([
			"sc-white-on-blue-underspecified",
		]);
		// Accepted and unusable: registration does not block on contrast, so the
		// receipt is the only place a host finds out.
		expect(receipt.diagnostics.length).toBeGreaterThan(10);
		expect(
			receipt.diagnostics.every((entry) => entry.severity === "warning"),
		).toBe(true);
		expect(receipt.diagnostics.map((entry) => entry.token)).toContain(
			"--pie-tertiary",
		);
	});
});
