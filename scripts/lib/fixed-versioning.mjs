/**
 * Decide whether the local lockstep version may be published, given what npm already has.
 *
 * Extracted from check-fixed-versioning.mjs so the sequencing rules can be tested without
 * a workspace on disk or a registry to talk to.
 */

export const parseSemver = (value) => {
	if (typeof value !== "string") return null;
	const normalized = value.trim().replace(/^v/, "");
	const match = normalized.match(
		/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/,
	);
	if (!match) return null;
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease: match[4] ? match[4].split(".") : [],
		raw: normalized,
	};
};

const NUMERIC_IDENTIFIER = /^\d+$/;

/** Semver precedence: negative when `a` sorts before `b`, build metadata ignored. */
export const compareSemver = (a, b) => {
	for (const key of ["major", "minor", "patch"]) {
		if (a[key] !== b[key]) return a[key] - b[key];
	}
	// A version without a prerelease outranks every prerelease of it.
	if (a.prerelease.length === 0 || b.prerelease.length === 0) {
		return b.prerelease.length - a.prerelease.length;
	}
	const length = Math.max(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < length; i++) {
		const left = a.prerelease[i];
		const right = b.prerelease[i];
		if (left === undefined) return -1;
		if (right === undefined) return 1;
		if (left === right) continue;
		const leftNumeric = NUMERIC_IDENTIFIER.test(left);
		const rightNumeric = NUMERIC_IDENTIFIER.test(right);
		if (leftNumeric && rightNumeric) return Number(left) - Number(right);
		if (leftNumeric) return -1;
		if (rightNumeric) return 1;
		return left < right ? -1 : 1;
	}
	return 0;
};

/**
 * The version a package's release sequence continues from: the highest version any
 * dist-tag points to. `latest` alone is not enough, because a prerelease line publishes
 * under its own tag and leaves `latest` on the last stable release.
 *
 * @param {Record<string, string>} distTags what `npm view <pkg> dist-tags --json` returns
 */
export const highestTaggedVersion = (distTags) => {
	let highest = null;
	for (const version of Object.values(distTags ?? {})) {
		const semver = parseSemver(version);
		if (!semver) continue;
		if (!highest || compareSemver(semver, highest) > 0) highest = semver;
	}
	return highest?.raw ?? null;
};

const isPrerelease = (semver) => semver.prerelease.length > 0;

const sameBase = (a, b) =>
	a.major === b.major && a.minor === b.minor && a.patch === b.patch;

/** The trailing numeric identifier changesets increments, as in `beta.3`. */
const prereleaseCounter = (semver) => {
	const last = semver.prerelease.at(-1);
	return last !== undefined && NUMERIC_IDENTIFIER.test(last) ? Number(last) : null;
};

/** One patch, minor or major step above `from`. */
const isSingleStep = (from, to) =>
	(to.major === from.major &&
		to.minor === from.minor &&
		to.patch === from.patch + 1) ||
	(to.major === from.major && to.minor === from.minor + 1 && to.patch === 0) ||
	(to.major === from.major + 1 && to.minor === 0 && to.patch === 0);

/**
 * Whether `local` is the release directly after `published`:
 *
 * - a stable release after a stable one is one patch ahead;
 * - a stable release after a prerelease closes that prerelease line, so it is the line's base;
 * - a prerelease line opens at counter 0, one patch, minor or major step above the stable
 *   release it starts from;
 * - each later prerelease of the line raises the counter by one.
 */
const isNextRelease = (published, local) => {
	if (!isPrerelease(local)) {
		if (isPrerelease(published)) return sameBase(published, local);
		return (
			published.major === local.major &&
			published.minor === local.minor &&
			published.patch === local.patch - 1
		);
	}
	const counter = prereleaseCounter(local);
	if (counter === null) return false;
	if (counter === 0) {
		return !isPrerelease(published) && isSingleStep(published, local);
	}
	return (
		isPrerelease(published) &&
		sameBase(published, local) &&
		prereleaseCounter(published) === counter - 1
	);
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
	// More than one release behind. A package exactly one release behind is the ordinary
	// mid-publish shape, which the partial-publish branch below already owns.
	return (
		compareSemver(entry.semver, localSemver) < 0 &&
		!isNextRelease(entry.semver, localSemver)
	);
};

/**
 * Classify the local version against the version each fixed-group package continues from
 * (`highestTaggedVersion`).
 *
 * Returns one of:
 * - `{ verdict: "ok" }` — the normal case: npm is uniform and local is the next release
 *   (`isNextRelease`).
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
		if (isNextRelease(publishedSemver, localSemver)) {
			return catchingUpNote
				? { verdict: "ok", ...catchingUpNote }
				: { verdict: "ok" };
		}
		if (isPrerelease(localSemver)) {
			return {
				verdict: "stop",
				message:
					`Local prerelease ${localVersion} does not follow published ${publishedVersion}. A prerelease ` +
					"line opens at counter 0, one patch, minor or major step above the published stable version, " +
					"and each later prerelease raises the counter by one. Did you run changeset version?",
			};
		}
		if (isPrerelease(publishedSemver)) {
			return {
				verdict: "stop",
				message: `Local version ${localVersion} does not close the published prerelease line ${publishedVersion}: the stable release after a prerelease line is that line's base version.`,
			};
		}
		if (
			localSemver.major !== publishedSemver.major ||
			localSemver.minor !== publishedSemver.minor
		) {
			return {
				verdict: "stop",
				message: `Local version ${localVersion} must keep major/minor aligned with published ${publishedVersion} for patch lockstep releases. A new major or minor line opens as a prerelease line.`,
			};
		}

		const delta = localSemver.patch - publishedSemver.patch;
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
	// that made it sit at the version being released and the rest stay one release behind. That
	// is not drift, it is an unfinished write, and publishing the same version again is precisely
	// the repair — Changesets skips the packages that already landed.
	//
	// Refusing here would make a partial release unrecoverable except by abandoning the version
	// entirely, which is how the 0.3.61 release ended up with @pie-players/pie-theme published
	// and 35 siblings a patch behind.
	const landedEntries = entries.filter(
		({ semver }) => compareSemver(semver, localSemver) === 0,
	);
	const pendingEntries = entries.filter(
		({ semver }) => compareSemver(semver, localSemver) !== 0,
	);
	const pendingVersions = new Set(pendingEntries.map(({ version }) => version));
	const pendingAreOneBehind =
		pendingVersions.size === 1 &&
		isNextRelease(pendingEntries[0].semver, localSemver);

	const details = formatDetails(entries);

	if (landedEntries.length > 0 && pendingAreOneBehind) {
		const landed = landedEntries.map(({ name }) => name).sort();
		const pending = pendingEntries.length;
		return {
			verdict: "completing-partial-publish",
			...(catchingUpNote ? { catchingUp: catchingUpNote.catchingUp } : {}),
			message:
				`Completing a partial publish of ${localVersion}. ${landed.length} package(s) already published it ` +
				`(${landed.join(", ")}) and ${pending} are still one release behind, which is the state a lockstep ` +
				`publish leaves when it loses auth partway. Publishing ${localVersion} again reconciles the group.\n${details}` +
				(catchingUpNote ? `\n\n${catchingUpNote.message}` : ""),
		};
	}

	return {
		verdict: "stop",
		message:
			`Expected one lockstep published npm version across fixed packages, found ${distinct.size}:\n${details}\n\n` +
			`The only publishable split is an unfinished publish of the local version ${localVersion}: some packages ` +
			`at ${localVersion} and the rest exactly one release behind. This is not that, so republishing will not ` +
			"reconcile it — align the group manually before releasing.",
	};
}
