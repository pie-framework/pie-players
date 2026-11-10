#!/usr/bin/env node

/**
 * Lints every publishable package: the import graph from its manifest
 * (`scripts/lib/package-import-graph.mjs`), then `publint --strict`.
 *
 * `scripts/publish-policy.json` holds the exceptions, each keyed by package
 * name. An entry in the first three that excuses nothing fails as a
 * `stale-allowance`, so fixing the cause means deleting the entry.
 *
 * - `allowedUndeclaredRuntimeImports.npm` names a specifier the npm build may
 *   import without declaring it.
 * - `allowedTypeOnlyDependencies` names a dependency that only the package's
 *   published declarations use, because they expose its types.
 * - `allowedUnreachableDependencies` names a dependency that no shipped file
 *   imports, such as one the build inlines.
 * - `allowedUndeclaredRuntimeImports.browser` names a bare specifier the browser
 *   build may keep. `check-bundle-safety.mjs` reads it too.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
	collectDeclaredTargets,
	getWorkspaceDirs,
	readPublishPolicy,
} from "./lib/pack-inspection.mjs";
import { analyzePackage } from "./lib/package-import-graph.mjs";

const ROOT = process.cwd();
const policy = readPublishPolicy(ROOT);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const allowedFor = (packageName) => ({
	undeclaredNpm: policy.allowedUndeclaredRuntimeImports?.npm?.[packageName],
	undeclaredBrowser:
		policy.allowedUndeclaredRuntimeImports?.browser?.[packageName],
	typeOnly: policy.allowedTypeOnlyDependencies?.[packageName],
	unreachable: policy.allowedUnreachableDependencies?.[packageName],
});

const hasMissingTargets = (dir, pkg) =>
	[...collectDeclaredTargets(pkg, ["main", "module", "types"])]
		.filter((target) => !target.includes("*"))
		.some((target) => !existsSync(path.join(dir, target)));

const run = () => {
	const packages = getWorkspaceDirs()
		.map((dir) => ({ dir, pkg: readJson(path.join(dir, "package.json")) }))
		.filter(({ pkg }) => !pkg.private);

	// A fresh CI checkout has no dist; build once from the root so package-level
	// builds do not fail on missing workspace outputs.
	if (packages.some(({ dir, pkg }) => hasMissingTargets(dir, pkg))) {
		execSync("bun run build", { cwd: ROOT, stdio: "pipe" });
	}

	const failures = [];
	for (const { dir, pkg } of packages) {
		try {
			if (hasMissingTargets(dir, pkg) && pkg.scripts?.build) {
				execSync("rm -rf dist tsconfig.tsbuildinfo && bun run build", {
					cwd: dir,
					stdio: "pipe",
				});
			}
			const findings = analyzePackage({
				dir,
				pkg,
				root: ROOT,
				allowed: allowedFor(pkg.name),
			});
			if (findings.length > 0) {
				throw new Error(
					findings
						.map((finding) => `- [${finding.code}] ${finding.message}`)
						.join("\n"),
				);
			}
			execSync("bunx publint . --strict", { cwd: dir, stdio: "pipe" });
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [
					error.stdout?.toString(),
					error.stderr?.toString(),
					error.message,
				]
					.filter(Boolean)
					.join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-publint] Found ${failures.length} package(s) with publint or import-graph issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(
		`[check-publint] OK: validated ${packages.length} publishable package(s)`,
	);
};

if (import.meta.main) run();
