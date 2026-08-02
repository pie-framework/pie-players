/**
 * Decide whether the local lockstep version may be published, given what npm already has.
 *
 * Extracted from check-fixed-versioning.mjs so the sequencing rules can be tested without
 * a workspace on disk or a registry to talk to.
 */

export const parseSemver = (value) => {
	if (typeof value !== "string") return null;
	const normalized = value.trim().replace(/^v/, "");
	const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);
	if (!match) return null;
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		raw: normalized,
	};
};

const formatDetails = (entries) =>
	entries
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ name, version }) => `- ${name}: ${version}`)
		.join("\n");

/**
 * Classify the local version against the versions npm reports for the fixed group.
 *
 * Returns one of:
 * - `{ verdict: "ok" }` — the normal case: npm is uniform and local is exactly one patch ahead.
 * - `{ verdict: "completing-partial-publish", message }` — npm is split because a lockstep
 *   publish partly failed, and publishing the local version is what repairs it. Advisory: the
 *   caller should report the message and continue.
 * - `{ verdict: "stop", message }` — anything else.
 *
 * @param {{ localVersion: string, publishedVersionMap: Map<string, string> }} input
 */
export function classifyPublishedSequence({
	localVersion,
	publishedVersionMap,
}) {
	const localSemver = parseSemver(localVersion);
	if (!localSemver) {
		return {
			verdict: "stop",
			message: `Local version "${localVersion}" is not a valid semver.`,
		};
	}

	const entries = [];
	for (const [name, version] of publishedVersionMap) {
		const semver = parseSemver(version);
		if (!semver) {
			return {
				verdict: "stop",
				message: `Published version "${version}" is not a valid semver.`,
			};
		}
		entries.push({ name, version, semver });
	}

	if (entries.length === 0) {
		return {
			verdict: "stop",
			message:
				"No published versions were collected, so the release sequence cannot be checked.",
		};
	}

	const distinct = new Set(entries.map((entry) => entry.version));

	if (distinct.size === 1) {
		const { version: publishedVersion, semver: publishedSemver } = entries[0];
		if (
			localSemver.major !== publishedSemver.major ||
			localSemver.minor !== publishedSemver.minor
		) {
			return {
				verdict: "stop",
				message: `Local version ${localVersion} must keep major/minor aligned with published ${publishedVersion} for patch lockstep releases.`,
			};
		}

		const delta = localSemver.patch - publishedSemver.patch;
		if (delta === 1) return { verdict: "ok" };
		if (delta <= 0) {
			return {
				verdict: "stop",
				message: `Local version ${localVersion} must be exactly one patch ahead of published ${publishedVersion}. Did you run changeset version?`,
			};
		}
		return {
			verdict: "stop",
			message: `Local version ${localVersion} skips patch versions from published ${publishedVersion}. Reset version/changelog files and rerun release once.`,
		};
	}

	// A fixed group is normally uniform on npm, and a split usually means the group drifted in
	// a way republishing will not reconcile — worth stopping for.
	//
	// One split is different: the one a partly failed lockstep publish leaves behind. npm
	// authenticates a publish run as a whole, so when a run loses auth partway the packages
	// that made it sit at the version being released and the rest stay a patch behind. That is
	// not drift, it is an unfinished write, and publishing the same version again is precisely
	// the repair — Changesets skips the packages that already landed.
	//
	// Refusing here would make a partial release unrecoverable except by abandoning the version
	// entirely, which is how the 0.3.61 release ended up with @pie-players/pie-theme published
	// and 35 siblings a patch behind.
	const sameReleaseLine = entries.every(
		({ semver }) =>
			semver.major === localSemver.major && semver.minor === localSemver.minor,
	);
	const onlyCurrentOrPrevious = entries.every(
		({ semver }) =>
			semver.patch === localSemver.patch ||
			semver.patch === localSemver.patch - 1,
	);
	const someAlreadyAtLocal = entries.some(
		({ semver }) => semver.patch === localSemver.patch,
	);

	const details = formatDetails(entries);

	if (sameReleaseLine && onlyCurrentOrPrevious && someAlreadyAtLocal) {
		const landed = entries
			.filter(({ semver }) => semver.patch === localSemver.patch)
			.map(({ name }) => name)
			.sort();
		const pending = entries.length - landed.length;
		return {
			verdict: "completing-partial-publish",
			message:
				`Completing a partial publish of ${localVersion}. ${landed.length} package(s) already published it ` +
				`(${landed.join(", ")}) and ${pending} are still one patch behind, which is the state a lockstep ` +
				`publish leaves when it loses auth partway. Publishing ${localVersion} again reconciles the group.\n${details}`,
		};
	}

	return {
		verdict: "stop",
		message:
			`Expected one lockstep published npm version across fixed packages, found ${distinct.size}:\n${details}\n\n` +
			`The only publishable split is an unfinished publish of the local version ${localVersion}: some packages ` +
			`at ${localVersion} and the rest exactly one patch behind. This is not that, so republishing will not ` +
			"reconcile it — align the group manually before releasing.",
	};
}
