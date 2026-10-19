#!/usr/bin/env node

/**
 * `check-lock-consistency`: workspaces that declare a package with the same
 * specifier resolve it to the same version in `bun.lock`.
 *
 * A dist-tag specifier such as `next` resolves when the lock is written, so a
 * non-frozen `bun install` or a dependency bot regenerating the lock can move
 * some workspaces to the newest publish and leave others on an older build. The
 * demo apps register the version demo-ui resolves but load the modules their
 * own workspace resolves, and the preloaded strategy rejects the mismatch: a
 * test-dependency bump (#819) failed every preloaded item-player e2e that way.
 * Workspaces that declare different specifiers may resolve differently, so an
 * exact pin in a published package and `next` in a demo stay independent.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const LABEL = "[check-lock-consistency]";

// Peer dependencies resolve from the consumer, so they have no entry of their own.
const DEPENDENCY_FIELDS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
];

const LOCAL_SPECIFIER = /^(workspace|file|link):/;

/** `bun.lock` is JSON with trailing commas; drop those outside strings. */
export function parseLock(text) {
	return JSON.parse(
		text.replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (match, string, close) =>
			string === undefined ? close : string,
		),
	);
}

/**
 * The version `workspace` resolves `dependency` to: its own nested entry when
 * the lock has one, else the hoisted entry.
 */
function resolvedVersion(packages, workspace, dependency) {
	const entry = packages[`${workspace}/${dependency}`] ?? packages[dependency];
	if (!entry) return undefined;
	const id = entry[0];
	return id.slice(id.lastIndexOf("@") + 1);
}

/** @returns {string[]} One failure per package and specifier with more than one version. */
export function collectLockFindings(lock) {
	const packages = lock.packages ?? {};
	/** @type {Map<string, Map<string, string[]>>} `name@specifier` → version → workspaces */
	const groups = new Map();
	for (const [workspacePath, workspace] of Object.entries(
		lock.workspaces ?? {},
	)) {
		const workspaceName = workspace.name ?? workspacePath;
		for (const field of DEPENDENCY_FIELDS) {
			for (const [dependency, specifier] of Object.entries(
				workspace[field] ?? {},
			)) {
				if (LOCAL_SPECIFIER.test(specifier)) continue;
				const version = resolvedVersion(packages, workspaceName, dependency);
				if (version === undefined) continue;
				const key = `${dependency}@${specifier}`;
				const versions = groups.get(key) ?? new Map();
				groups.set(key, versions);
				versions.set(version, [
					...(versions.get(version) ?? []),
					workspaceName,
				]);
			}
		}
	}

	const failures = [];
	for (const [key, versions] of [...groups].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		if (versions.size < 2) continue;
		const resolutions = [...versions]
			.map(([version, workspaces]) => `${version} in ${workspaces.join(", ")}`)
			.join("; ");
		failures.push(`${key} resolves to ${resolutions}.`);
	}
	return failures;
}

function main() {
	const lockPath = path.join(process.cwd(), "bun.lock");
	const failures = collectLockFindings(
		parseLock(readFileSync(lockPath, "utf8")),
	);

	if (failures.length > 0) {
		console.error(
			`${LABEL} Workspaces declaring the same specifier resolve different versions:`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		console.error(
			`${LABEL} A regenerated lock re-resolved a dist tag for some workspaces only. Restore bun.lock from the base branch and redo just the intended change, so the lock moves nothing else.`,
		);
		process.exit(1);
	}

	console.log(
		`${LABEL} OK: every shared specifier resolves to one version in bun.lock`,
	);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
