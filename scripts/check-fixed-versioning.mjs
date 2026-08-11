#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
	classifyPublishedSequence,
	parseSemver,
} from "./lib/fixed-versioning.mjs";

const ROOT = process.cwd();
const CHANGESET_CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const WORKSPACE_ROOTS = ["packages"];
const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const discoverPublishablePackages = () => {
	const packages = [];

	for (const workspaceRoot of WORKSPACE_ROOTS) {
		const absRoot = path.join(ROOT, workspaceRoot);
		if (!existsSync(absRoot)) continue;

		for (const dirent of readdirSync(absRoot, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const packageDir = path.join(absRoot, dirent.name);
			const manifestPath = path.join(packageDir, "package.json");
			if (!existsSync(manifestPath)) continue;

			const manifest = readJson(manifestPath);
			if (manifest.private) continue;
			if (typeof manifest.name !== "string") continue;
			if (!manifest.name.startsWith("@pie-players/")) continue;
			if (typeof manifest.version !== "string") continue;

			packages.push({
				name: manifest.name,
				version: manifest.version,
				manifestPath,
				manifest,
			});
		}
	}

	return packages.sort((a, b) => a.name.localeCompare(b.name));
};

const fail = (message) => {
	console.error(`[check-fixed-versioning] ${message}`);
	process.exit(1);
};

/** Sentinel for a package that exists here but has never been published. */
const UNPUBLISHED = Symbol("unpublished");

const fetchPublishedVersion = (pkgName) => {
	try {
		const out = execSync(`npm view "${pkgName}" version --json`, {
			cwd: ROOT,
			stdio: "pipe",
		})
			.toString("utf8")
			.trim();
		const parsed = JSON.parse(out);
		if (typeof parsed === "string") return parsed;
		if (Array.isArray(parsed) && parsed.length > 0) {
			return String(parsed[parsed.length - 1]);
		}
		return null;
	} catch (error) {
		const detail = error.stderr?.toString()?.trim() || error.message || "";
		// A package added in this change has nothing on npm yet, which is not a
		// versioning problem — it is what adding a publishable package looks like
		// before its first release. Only a 404 is treated this way; a network or
		// auth failure still stops the gate, because "cannot tell" must not read as
		// "fine".
		if (/E404|404 Not Found/.test(detail)) return UNPUBLISHED;
		fail(
			`Failed to read published version for ${pkgName} from npm: ${detail}`,
		);
	}
};

/**
 * Every version the registry holds for a package, oldest first.
 *
 * Only needed for packages sitting off the group's version, where the release-history length is
 * what separates a bootstrapped newcomer from a member that drifted. Fetching it for all 37
 * packages would double the registry round trips this gate already makes for no added signal.
 */
const fetchPublishedVersions = (pkgName) => {
	try {
		const out = execSync(`npm view "${pkgName}" versions --json`, {
			cwd: ROOT,
			stdio: "pipe",
		})
			.toString("utf8")
			.trim();
		const parsed = JSON.parse(out);
		// npm collapses a single-version package to a bare string.
		if (typeof parsed === "string") return [parsed];
		if (Array.isArray(parsed)) return parsed.map(String);
		return null;
	} catch (error) {
		const detail = error.stderr?.toString()?.trim() || error.message || "";
		fail(`Failed to read published versions for ${pkgName} from npm: ${detail}`);
	}
};

const publishablePackages = discoverPublishablePackages();
if (publishablePackages.length === 0) {
	fail("No publishable @pie-players packages found in packages/*.");
}

if (!existsSync(CHANGESET_CONFIG_PATH)) {
	fail("Missing .changeset/config.json");
}

const changesetConfig = readJson(CHANGESET_CONFIG_PATH);
const fixedGroups = Array.isArray(changesetConfig.fixed)
	? changesetConfig.fixed
	: [];
const fixedSet = new Set(
	fixedGroups.flatMap((group) => (Array.isArray(group) ? group : [])),
);
const publishableSet = new Set(publishablePackages.map((pkg) => pkg.name));

const missingFromFixed = [...publishableSet].filter(
	(name) => !fixedSet.has(name),
);
const extraInFixed = [...fixedSet].filter((name) => !publishableSet.has(name));

if (missingFromFixed.length > 0 || extraInFixed.length > 0) {
	const missingText =
		missingFromFixed.length > 0
			? `Missing from fixed group:\n${missingFromFixed.map((p) => `- ${p}`).join("\n")}`
			: "";
	const extraText =
		extraInFixed.length > 0
			? `Unexpected in fixed group:\n${extraInFixed.map((p) => `- ${p}`).join("\n")}`
			: "";
	fail(
		`Changesets fixed group does not match publishable package set.\n${missingText}\n${extraText}`.trim(),
	);
}

const versions = new Set(publishablePackages.map((pkg) => pkg.version));
if (versions.size !== 1) {
	const byVersion = new Map();
	for (const pkg of publishablePackages) {
		const list = byVersion.get(pkg.version) || [];
		list.push(pkg.name);
		byVersion.set(pkg.version, list);
	}

	const details = [...byVersion.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([version, names]) => `- ${version}: ${names.join(", ")}`)
		.join("\n");

	fail(
		`Expected one lockstep version across publishable packages, found ${versions.size}:\n${details}`,
	);
}

if (process.env.SKIP_NPM_VERSION_SEQUENCE_CHECK !== "1") {
	const localVersion = publishablePackages[0].version;
	const localSemver = parseSemver(localVersion);
	if (!localSemver) {
		fail(`Local version "${localVersion}" is not a valid semver.`);
	}

	const publishedVersionMap = new Map();
	const unpublished = [];
	for (const pkg of publishablePackages) {
		const published = fetchPublishedVersion(pkg.name);
		if (published === UNPUBLISHED) {
			unpublished.push(pkg.name);
			continue;
		}
		if (!published) {
			fail(`Package ${pkg.name} has no published version on npm.`);
		}
		publishedVersionMap.set(pkg.name, published);
	}
	if (unpublished.length > 0) {
		// Excluded from the sequence comparison rather than compared against
		// nothing: a first release publishes these at the lockstep version, and the
		// fixed-group membership check above is what guarantees they go with it.
		console.log(
			`[check-fixed-versioning] not yet on npm, first release will publish at the lockstep version: ${unpublished.join(", ")}`,
		);
	}
	if (publishedVersionMap.size === 0) {
		fail("No publishable package has a published version to compare against.");
	}

	// The version the bulk of the group is on. Anything off it needs its release history read
	// before the sequence can be judged.
	const versionTally = new Map();
	for (const version of publishedVersionMap.values()) {
		versionTally.set(version, (versionTally.get(version) || 0) + 1);
	}
	const groupVersion = [...versionTally.entries()].sort(
		([, a], [, b]) => b - a,
	)[0][0];

	const publishedHistoryMap = new Map();
	for (const [name, version] of publishedVersionMap) {
		if (version === groupVersion) continue;
		publishedHistoryMap.set(name, fetchPublishedVersions(name));
	}

	const sequence = classifyPublishedSequence({
		localVersion,
		publishedVersionMap,
		publishedHistoryMap,
	});
	if (sequence.verdict === "stop") {
		fail(sequence.message);
	}
	if (sequence.message) {
		console.log(`[check-fixed-versioning] ${sequence.message}`);
	}
}

const violations = [];
for (const pkg of publishablePackages) {
	for (const section of DEP_SECTIONS) {
		const deps = pkg.manifest[section];
		if (!deps || typeof deps !== "object") continue;

		for (const [depName, depRange] of Object.entries(deps)) {
			if (!depName.startsWith("@pie-players/")) continue;
			if (!publishableSet.has(depName)) continue;
			if (depName === pkg.name) continue;
			if (typeof depRange !== "string") continue;
			if (!depRange.startsWith("workspace:")) {
				violations.push(
					`${pkg.name} (${path.relative(ROOT, pkg.manifestPath)}): ${section}.${depName} must use workspace:* style, found "${depRange}"`,
				);
			}
		}
	}
}

if (violations.length > 0) {
	fail(
		`Found ${violations.length} internal dependency invariant violation(s):\n${violations.join("\n")}`,
	);
}

console.log(
	`[check-fixed-versioning] OK: ${publishablePackages.length} publishable packages in one fixed group at version ${publishablePackages[0].version}`,
);
