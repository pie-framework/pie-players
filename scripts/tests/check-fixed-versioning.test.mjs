import { describe, expect, test } from "bun:test";

import {
	classifyPublishedSequence,
	compareSemver,
	highestTaggedVersion,
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

	test("splits a prerelease into its identifiers", () => {
		expect(parseSemver("1.0.0-beta.2")).toMatchObject({
			major: 1,
			minor: 0,
			patch: 0,
			prerelease: ["beta", "2"],
		});
		expect(parseSemver("0.3.75").prerelease).toEqual([]);
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
		expect(result.message).toContain("1 are still one release behind");
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

describe("classifyPublishedSequence — bootstrapped newcomer catching up", () => {
	/** The shape 0.3.65 hit: sign-language bootstrapped from develop at 0.3.50. */
	const newcomerRegistry = publishedMap({
		a: "0.3.64",
		b: "0.3.64",
		newcomer: "0.3.50",
	});

	test("a package whose only release is below the group publishes with the group", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: newcomerRegistry,
			publishedHistoryMap: new Map([["newcomer", ["0.3.50"]]]),
		});
		expect(result.verdict).toBe("ok");
		expect(result.catchingUp).toEqual([
			{ name: "newcomer", version: "0.3.50" },
		]);
		expect(result.message).toContain("newcomer@0.3.50");
	});

	test("a package with a release history below the group is drift, not a newcomer", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: newcomerRegistry,
			publishedHistoryMap: new Map([["newcomer", ["0.3.48", "0.3.50"]]]),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("align the group manually");
	});

	test("without a history the newcomer allowance cannot apply", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: newcomerRegistry,
		});
		expect(result.verdict).toBe("stop");
	});

	test("the rest of the group must still be exactly one patch behind", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.66",
			publishedVersionMap: newcomerRegistry,
			publishedHistoryMap: new Map([["newcomer", ["0.3.50"]]]),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("skips patch versions");
	});

	test("a newcomer does not mask a genuine split in the rest of the group", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: publishedMap({
				a: "0.3.64",
				b: "0.3.60",
				newcomer: "0.3.50",
			}),
			publishedHistoryMap: new Map([["newcomer", ["0.3.50"]]]),
		});
		expect(result.verdict).toBe("stop");
	});

	test("a newcomer only one patch behind stays on the partial-publish path", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: publishedMap({
				a: "0.3.65",
				b: "0.3.64",
				newcomer: "0.3.64",
			}),
			publishedHistoryMap: new Map([["newcomer", ["0.3.64"]]]),
		});
		expect(result.verdict).toBe("completing-partial-publish");
		expect(result.catchingUp).toBeUndefined();
	});

	test("a newcomer on another release line is not excused", () => {
		const result = classifyPublishedSequence({
			localVersion: "0.3.65",
			publishedVersionMap: publishedMap({
				a: "0.3.64",
				b: "0.3.64",
				newcomer: "0.2.10",
			}),
			publishedHistoryMap: new Map([["newcomer", ["0.2.10"]]]),
		});
		expect(result.verdict).toBe("stop");
	});
});

describe("classifyPublishedSequence — reclaimed name", () => {
	/** The magnifier's shape: 0.1.x releases from a removed package under the same name. */
	const group = { a: "1.0.0-beta.3", b: "1.0.0-beta.3" };
	const olderMajor = ["0.1.1", "0.1.8"];

	test("one bootstrap release on the group's major publishes with the group", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.4",
			publishedVersionMap: publishedMap({ ...group, reclaimed: "1.0.0-beta.2" }),
			publishedHistoryMap: new Map([
				["reclaimed", [...olderMajor, "1.0.0-beta.2"]],
			]),
		});
		expect(result.verdict).toBe("ok");
		expect(result.catchingUp).toEqual([
			{ name: "reclaimed", version: "1.0.0-beta.2" },
		]);
	});

	test("before its bootstrap the release stops and names the reclaim", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.4",
			publishedVersionMap: publishedMap({ ...group, reclaimed: "0.1.8" }),
			publishedHistoryMap: new Map([["reclaimed", olderMajor]]),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain(
			"bun run bootstrap-package -- --only reclaimed",
		);
	});

	test("repeated releases on the group's major are drift, whatever came before", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.4",
			publishedVersionMap: publishedMap({ ...group, reclaimed: "1.0.0-beta.2" }),
			publishedHistoryMap: new Map([
				["reclaimed", [...olderMajor, "1.0.0-beta.1", "1.0.0-beta.2"]],
			]),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).not.toContain("bootstrap-package");
	});

	test("a group opening a new major is not told to reclaim a lagging member", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.0",
			publishedVersionMap: publishedMap({
				a: "0.3.75",
				b: "0.3.75",
				lagging: "0.3.70",
			}),
			publishedHistoryMap: new Map([["lagging", ["0.3.69", "0.3.70"]]]),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).not.toContain("bootstrap-package");
	});
});

describe("compareSemver", () => {
	const sorted = (versions) =>
		versions
			.map(parseSemver)
			.sort(compareSemver)
			.map(({ raw }) => raw);

	test("orders prereleases below their stable release and above the previous one", () => {
		expect(
			sorted(["1.0.0", "1.0.0-beta.10", "0.3.75", "1.0.0-beta.2", "1.0.1"]),
		).toEqual(["0.3.75", "1.0.0-beta.2", "1.0.0-beta.10", "1.0.0", "1.0.1"]);
	});

	test("orders prerelease ids lexically and numeric identifiers below alphanumeric ones", () => {
		expect(sorted(["1.0.0-rc.0", "1.0.0-beta.3", "1.0.0-1"])).toEqual([
			"1.0.0-1",
			"1.0.0-beta.3",
			"1.0.0-rc.0",
		]);
	});
});

describe("highestTaggedVersion", () => {
	test("a prerelease tag above latest is where the sequence continues", () => {
		expect(
			highestTaggedVersion({ latest: "0.3.75", beta: "1.0.0-beta.1" }),
		).toBe("1.0.0-beta.1");
	});

	test("a stale prerelease tag below latest is ignored", () => {
		expect(
			highestTaggedVersion({ latest: "1.0.0", beta: "1.0.0-beta.3" }),
		).toBe("1.0.0");
	});

	test("no tags means nothing to continue from", () => {
		expect(highestTaggedVersion({})).toBeNull();
	});
});

describe("classifyPublishedSequence — prerelease line", () => {
	test("a major prerelease line opens at counter 0 above the stable release", () => {
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0-beta.0",
				publishedVersionMap: uniform("0.3.75"),
			}),
		).toEqual({ verdict: "ok" });
	});

	test("a minor or patch prerelease line opens the same way", () => {
		for (const localVersion of ["1.1.0-beta.0", "1.0.1-beta.0"]) {
			expect(
				classifyPublishedSequence({
					localVersion,
					publishedVersionMap: uniform("1.0.0"),
				}).verdict,
			).toBe("ok");
		}
	});

	test("a line that skips a release step is refused", () => {
		const result = classifyPublishedSequence({
			localVersion: "2.0.0-beta.0",
			publishedVersionMap: uniform("0.3.75"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("does not follow published 0.3.75");
	});

	test("a line that opens above counter 0 is refused", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.1",
			publishedVersionMap: uniform("0.3.75"),
		});
		expect(result.verdict).toBe("stop");
	});

	test("each later prerelease raises the counter by one", () => {
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0-beta.2",
				publishedVersionMap: uniform("1.0.0-beta.1"),
			}).verdict,
		).toBe("ok");
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0-beta.3",
				publishedVersionMap: uniform("1.0.0-beta.1"),
			}).verdict,
		).toBe("stop");
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0-beta.1",
				publishedVersionMap: uniform("1.0.0-beta.1"),
			}).verdict,
		).toBe("stop");
	});

	test("changing the prerelease id keeps the counter running, as changesets does", () => {
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0-rc.4",
				publishedVersionMap: uniform("1.0.0-beta.3"),
			}).verdict,
		).toBe("ok");
	});

	test("the stable release closes the line at its base version", () => {
		expect(
			classifyPublishedSequence({
				localVersion: "1.0.0",
				publishedVersionMap: uniform("1.0.0-beta.3"),
			}).verdict,
		).toBe("ok");
		const result = classifyPublishedSequence({
			localVersion: "1.0.1",
			publishedVersionMap: uniform("1.0.0-beta.3"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("does not close the published prerelease line");
	});

	test("a stable major bump without a prerelease line stays refused", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0",
			publishedVersionMap: uniform("0.3.75"),
		});
		expect(result.verdict).toBe("stop");
		expect(result.message).toContain("opens as a prerelease line");
	});

	test("a partly failed prerelease publish is completed", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.2",
			publishedVersionMap: publishedMap({
				a: "1.0.0-beta.2",
				b: "1.0.0-beta.1",
				c: "1.0.0-beta.1",
			}),
		});
		expect(result.verdict).toBe("completing-partial-publish");
	});

	test("a partly failed first prerelease is completed against the stable release", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.0",
			publishedVersionMap: publishedMap({ a: "1.0.0-beta.0", b: "0.3.75" }),
		});
		expect(result.verdict).toBe("completing-partial-publish");
	});

	test("packages left on different prereleases are drift even when each could precede", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0",
			publishedVersionMap: publishedMap({
				a: "1.0.0",
				b: "1.0.0-beta.3",
				c: "1.0.0-beta.2",
			}),
		});
		expect(result.verdict).toBe("stop");
	});

	test("a newcomer bootstrapped on an earlier prerelease publishes with the group", () => {
		const result = classifyPublishedSequence({
			localVersion: "1.0.0-beta.3",
			publishedVersionMap: publishedMap({
				a: "1.0.0-beta.2",
				newcomer: "1.0.0-beta.0",
			}),
			publishedHistoryMap: new Map([["newcomer", ["1.0.0-beta.0"]]]),
		});
		expect(result.verdict).toBe("ok");
		expect(result.catchingUp).toEqual([
			{ name: "newcomer", version: "1.0.0-beta.0" },
		]);
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
