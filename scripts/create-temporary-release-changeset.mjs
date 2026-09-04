#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, "packages");
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const CHANGESET_FILE = path.join(
	CHANGESET_DIR,
	"temporary-release-all-packages.md",
);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const fail = (message) => {
	console.error(`[create-temporary-release-changeset] ${message}`);
	process.exit(1);
};

const discoverPublishablePackages = () => {
	if (!existsSync(PACKAGE_ROOT)) return [];

	const packages = [];

	for (const entry of readdirSync(PACKAGE_ROOT, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const manifestPath = path.join(PACKAGE_ROOT, entry.name, "package.json");
		if (!existsSync(manifestPath)) continue;

		const manifest = readJson(manifestPath);
		if (manifest.private) continue;
		if (typeof manifest.name !== "string") continue;
		if (!manifest.name.startsWith("@pie-players/")) continue;
		if (typeof manifest.version !== "string") continue;

		packages.push({ name: manifest.name, version: manifest.version });
	}

	return packages.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * The last release only finishes publishing once npm reports the local version back. Until
 * then a stray merge to master must not manufacture a further bump on top of it — that is
 * exactly how local skipped 0.3.69 on npm straight to 0.3.70. Checked against whichever
 * discovered package npm has published before (a brand-new package 404s, and the group's
 * uniform-version invariant is check-fixed-versioning's job, not this script's).
 */
const releaseAlreadyPending = (packages) => {
	for (const pkg of packages) {
		let published;
		try {
			published = execSync(`npm view "${pkg.name}" version`, {
				cwd: ROOT,
				stdio: "pipe",
			})
				.toString("utf8")
				.trim();
		} catch (error) {
			const detail = error.stderr?.toString()?.trim() || error.message || "";
			if (/E404|404 Not Found/.test(detail)) continue;
			fail(`Failed to read published version for ${pkg.name} from npm: ${detail}`);
		}
		if (!published) continue;
		return published !== pkg.version
			? { pending: true, name: pkg.name, local: pkg.version, published }
			: { pending: false };
	}
	// Every discovered package is new to npm: nothing to compare against, and there is no
	// prior release that could be stuck.
	return { pending: false };
};

if (!existsSync(CHANGESET_DIR)) {
	fail("Missing .changeset directory.");
}

const packages = discoverPublishablePackages();
if (packages.length === 0) {
	fail("No publishable @pie-players packages discovered under packages/*.");
}

const pendingCheck = releaseAlreadyPending(packages);
if (pendingCheck.pending) {
	console.log(
		`[create-temporary-release-changeset] Skipping: local ${pendingCheck.name}@${pendingCheck.local} has not reached npm yet (published ${pendingCheck.published}). A previous release is still pending publish; not generating another bump on top of it.`,
	);
	process.exit(0);
}

const packageNames = packages.map((pkg) => pkg.name);
const frontmatterLines = packageNames.map(
	(packageName) => `"${packageName}": patch`,
);
const contents = [
	"---",
	...frontmatterLines,
	"---",
	"",
	"Temporary release changeset: patch all publishable packages to keep lockstep versions.",
	"",
].join("\n");

writeFileSync(CHANGESET_FILE, contents, "utf8");

console.log(
	`[create-temporary-release-changeset] Wrote ${path.relative(ROOT, CHANGESET_FILE)} for ${packageNames.length} packages.`,
);
