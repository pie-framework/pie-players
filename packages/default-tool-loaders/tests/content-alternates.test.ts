/**
 * `CONTENT_ALTERNATE_REGISTRATIONS` against the packaged composition.
 *
 * The list exists to be importable without the composition table, which means it
 * is a second enumeration of the same capabilities — the drift the composition
 * module's docstring warns about. These two assertions are what make it safe: an
 * alternate added to the packaged set and not here would silently never reach
 * print, and one listed here but no longer packaged would be resolved by a
 * deployment that does not ship it.
 */

import { describe, expect, it } from "bun:test";
import { CONTENT_ALTERNATE_REGISTRATIONS } from "../src/content-alternates.js";
import { PACKAGED_TOOL_REGISTRATIONS } from "../src/packaged-tool-registry.js";

/** What print can resolve: an authored alternate rendered as its own region. */
const isContentAlternate = (registration: {
	activation?: string;
	requiresAuthoredContent?: unknown;
	renderSurface?: unknown;
}) =>
	registration.activation === "region" &&
	Boolean(registration.requiresAuthoredContent) &&
	typeof registration.renderSurface === "function";

const idsOf = (registrations: readonly { toolId: string }[]) =>
	registrations.map((registration) => registration.toolId).sort();

describe("CONTENT_ALTERNATE_REGISTRATIONS", () => {
	it("holds every packaged capability that renders an authored alternate", () => {
		expect(idsOf(CONTENT_ALTERNATE_REGISTRATIONS)).toEqual(
			idsOf(PACKAGED_TOOL_REGISTRATIONS.filter(isContentAlternate)),
		);
	});

	it("holds the packaged registration objects themselves, not copies", () => {
		for (const registration of CONTENT_ALTERNATE_REGISTRATIONS) {
			expect(PACKAGED_TOOL_REGISTRATIONS).toContain(registration);
		}
	});
});
