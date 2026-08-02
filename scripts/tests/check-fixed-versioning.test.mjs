import { describe, expect, test } from "bun:test";

import {
	classifyPublishedSequence,
	parseSemver,
} from "../lib/fixed-versioning.mjs";

/** Build the map check-fixed-versioning collects from `npm view <pkg> version`. */
const publishedMap = (entries) => new Map(Object.entries(entries));

/** The fixed group is 36 packages; these stand in for it without the noise. */
const uniform = (version, names = ["a", "b", "c"]) =>
	publishedMap(Object.fromEntries(names.map((name) => [name, version])));

describe("parseSemver", () => {
	test("accepts a plain version and a leading v", () => {
		expect(parseSemver("0.3.61")).toMatchObject({
			major: 0,
			minor: 3,
			patch: 61,
		});
		expect(parseSemver("v1.2.3")).toMatchObject({
			major: 1,
			minor: 2,
			patch: 3,
		});
	});

	test("rejects what is not a version", () => {
		expect(parseSemver("latest")).toBeNull();
		expect(parseSemver("0.3")).toBeNull();
		expect(parseSemver(undefined)).toBeNull();
	});
});

describe("classifyPublishedSequence — uniform registry", () => {
	test("one patch ahead is the normal release", () => {
		expect(
			classifyPublishedSequence({
				localVersion: "0.3.61",
				publishedVersionMap: uniform("0.3.60"),
			}),
		).toEqual({ verdict: "ok" });
	});

	test("local equal to published means the version bump never ran", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.60",
			publishedVersionMap: uniform("0.3.60"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("exactly one patch ahead");
	});

	test("skipping a patch is refused", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.62",
			publishedVersionMap: uniform("0.3.60"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("skips patch versions");
	});

	test("a local version behind the registry is refused", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.59",
			publishedVersionMap: uniform("0.3.60"),
		});
		expect(result.verdict).toBe("stop");
	});

	test("a minor bump is not a patch lockstep release", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.4.0",
			publishedVersionMap: uniform("0.3.60"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("major/minor aligned");
	});
});

describe("classifyPublishedSequence — partial publish", () => {
	// The 0.3.61 release: npm authenticates a publish run as a whole, so when only
	// pie-theme had a trusted publisher the rest failed with ENEEDAUTH and stayed a
	// patch behind. Publishing 0.3.61 again is the repair, so this must not be fatal.
	test("the state a partly failed lockstep publish leaves is publishable", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: publishedMap({
				"@pie-players/pie-theme": "0.3.61",
				"@pie-players/pie-item-player": "0.3.60",
				"@pie-players/pie-section-player": "0.3.60",
			}),
		});
		expect(result.verdict).toBe("completing-partial-publish");
		expect(result.message).toContain("Completing a partial publish of 0.3.61");
		expect(result.message).toContain("@pie-players/pie-theme");
	});

	test("it reports how many landed and how many are pending", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.4.9",
			publishedVersionMap: publishedMap({
				a: "1.4.9",
				b: "1.4.9",
				c: "1.4.8",
			}),
		});
		expect(result.verdict).toBe("completing-partial-publish");
		expect(result.message).toContain("2 package(s) already published it");
		expect(result.message).toContain("1 are still one patch behind");
	});

	// The narrowing has to stay narrow: only an unfinished publish of the *local*
	// version is recoverable by republishing. Everything else is real drift.
	test("a laggard more than one patch behind is still fatal", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: publishedMap({
				a: "0.3.61",
				b: "0.3.60",
				c: "0.3.59",
			}),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("The only publishable split");
	});

	test("a split with nothing at the local version is fatal", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: publishedMap({ a: "0.3.60", b: "0.3.59" }),
		});
		expect(result.verdict).toBe("stop");
	});

	test("a split across minor lines is fatal", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.4.1",
			publishedVersionMap: publishedMap({ a: "0.4.1", b: "0.3.60" }),
		});
		expect(result.verdict).toBe("stop");
	});

	test("a package published ahead of the local version is fatal", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: publishedMap({ a: "0.3.62", b: "0.3.60" }),
		});
		expect(result.verdict).toBe("stop");
	});
});

describe("classifyPublishedSequence — malformed input", () => {
	test("an unparseable local version stops", () => {
		const result = classifyPublishedSequence({
			localVersion: "not-a-version",
			publishedVersionMap: uniform("0.3.60"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("not a valid semver");
	});

	test("an unparseable published version stops", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: publishedMap({ a: "0.3.60", b: "garbage" }),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("not a valid semver");
	});

	test("an empty registry read stops rather than passing vacuously", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.61",
			publishedVersionMap: new Map(),
		});
		expect(result.verdict).toBe("stop");
	});
});
