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
 * Decide whether a package sitting below the group baseline is a bootstrapped newcomer
 * catching up rather than a member that drifted.
 *
 * `bootstrap-package` resolves the group version from the branch it runs on, and on this repo
 * `develop` carries whatever version the last back-merge left, not what was last released — so
 * a first publish lands well below the baseline (sign-language went out at 0.3.50 against a
 * published group at 0.3.64). The documented flow from there is ordinary: the next release
 * publishes it with the group at the group's version.
 *
 * The discriminant is the package's own release history, not its distance from the baseline —
 * distance alone cannot tell a newcomer from a member that stopped being released. A newcomer
 * has published exactly once, at that single bootstrap version. A drifted member has published
 * repeatedly, so it fails this and still stops the release.
 *
 * @param {{ semver: {major: number, minor: number, patch: number}, version: string }} entry
 * @param {{major: number, minor: number, patch: number}} localSemver
 * @param {string[] | undefined} history every version the registry holds for this package
 */
const isCatchingUpNewcomer = (entry, localSemver, history) => {
	if (!Array.isArray(history) || history.length !== 1) return false;
	if (history[0] !== entry.version) return false;
	if (entry.semver.major !== localSemver.major) return false;
	if (entry.semver.minor !== localSemver.minor) return false;
	// More than one patch behind. A package exactly one patch behind is the ordinary
	// mid-publish shape, which the partial-publish branch below already owns.
	return entry.semver.patch < localSemver.patch - 1;
};

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
 * `ok` and `completing-partial-publish` carry `catchingUp` when bootstrapped newcomers were
 * excluded from the comparison, so the caller can report which packages jump to the group
 * version.
 *
 * @param {{ localVersion: string, publishedVersionMap: Map<string, string>,
 *   publishedHistoryMap?: Map<string, string[]> }} input
 */
export function classifyPublishedSequence({
	localVersion,
	publishedVersionMap,
	publishedHistoryMap,
}) {
	const localSemver = parseSemver(localVersion);
	if (!localSemver) {
		return {
			verdict: "stop",
			message: `Local version "${localVersion}" is not a valid semver.`,
		};
	}

	const allEntries = [];
	for (const [name, version] of publishedVersionMap) {
		const semver = parseSemver(version);
		if (!semver) {
			return {
				verdict: "stop",
				message: `Published version "${version}" is not a valid semver.`,
			};
		}
		allEntries.push({ name, version, semver });
	}

	const catchingUp = allEntries.filter((entry) =>
		isCatchingUpNewcomer(entry, localSemver, publishedHistoryMap?.get(entry.name)),
	);
	const catchingUpNames = new Set(catchingUp.map((entry) => entry.name));
	const entries = allEntries.filter((entry) => !catchingUpNames.has(entry.name));

	const catchingUpNote =
		catchingUp.length > 0
			? {
					catchingUp: catchingUp.map(({ name, version }) => ({ name, version })),
					message:
						`Publishing ${localVersion} for ${catchingUp.length} package(s) whose only released version is ` +
						`below the group: ${catchingUp.map(({ name, version }) => `${name}@${version}`).sort().join(", ")}. ` +
						"A bootstrapped package joins the group at the next release rather than stepping through the " +
						"versions it missed, so these are excluded from the lockstep comparison.",
				}
			: null;

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
		if (delta === 1) {
			return catchingUpNote
				? { verdict: "ok", ...catchingUpNote }
				: { verdict: "ok" };
		}
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
			...(catchingUpNote ? { catchingUp: catchingUpNote.catchingUp } : {}),
			message:
				`Completing a partial publish of ${localVersion}. ${landed.length} package(s) already published it ` +
				`(${landed.join(", ")}) and ${pending} are still one patch behind, which is the state a lockstep ` +
				`publish leaves when it loses auth partway. Publishing ${localVersion} again reconciles the group.\n${details}` +
				(catchingUpNote ? `\n\n${catchingUpNote.message}` : ""),
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
