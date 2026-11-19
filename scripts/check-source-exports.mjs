#!/usr/bin/env node

/**
 * The dist-only publish surface of every publishable package, read from its
 * manifest and its `npm pack --dry-run` file list, before each commit.
 * `check:pack-integrity` applies the same rules in CI.
 */

import path from "node:path";

import {
	assertPublishablePackagesChecked,
	getPublishablePackages,
	mapConcurrent,
	readPublishPolicy,
	runPackDryRun,
	toPosix,
} from "./lib/pack-inspection.mjs";
import {
	collectManifestSurfaceViolations,
	collectPackedFileSurfaceViolations,
} from "./lib/publish-surface.mjs";

const ROOT = process.cwd();
const MAX_DETAILS_PER_PACKAGE = 20;

const policy = readPublishPolicy(ROOT);
const forbiddenPublicExports = new Map(
	Object.entries(policy.forbiddenPublicExports || {}),
);
const packages = getPublishablePackages({
	root: ROOT,
	workspaceRoots: policy.workspaceRoots ?? ["packages"],
});
try {
	assertPublishablePackagesChecked(packages.length);
} catch (error) {
	console.error(`[check-source-exports] ${error.message}`);
	process.exit(1);
}

const checkPackage = async ({ dir, pkg }) => {
	const violations = collectManifestSurfaceViolations(
		pkg,
		forbiddenPublicExports,
	);
	try {
		violations.push(
			...collectPackedFileSurfaceViolations(await runPackDryRun(dir), pkg),
		);
	} catch (error) {
		violations.push(
			error.stderr?.toString()?.trim() ||
				error.message ||
				"failed to inspect npm pack contents",
		);
	}
	return violations.length > 0
		? {
				name: pkg.name || path.basename(dir),
				dir: toPosix(path.relative(ROOT, dir)),
				violations,
			}
		: null;
};

const failures = (await mapConcurrent(packages, checkPackage)).filter(Boolean);

if (failures.length > 0) {
	console.error(
		`[check-source-exports] Found ${failures.length} package(s) with non-dist publish surface`,
	);
	for (const failure of failures) {
		console.error(`\n- ${failure.name} (${failure.dir})`);
		for (const violation of failure.violations.slice(
			0,
			MAX_DETAILS_PER_PACKAGE,
		)) {
			console.error(`  - ${violation}`);
		}
		const omitted = failure.violations.length - MAX_DETAILS_PER_PACKAGE;
		if (omitted > 0) console.error(`  - ... ${omitted} more`);
	}
	process.exit(1);
}

console.log(
	`[check-source-exports] OK: validated ${packages.length} publishable package(s)`,
);
