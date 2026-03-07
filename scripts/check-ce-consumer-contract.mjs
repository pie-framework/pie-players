#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const getWorkspacePackageManifestPaths = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
	const manifests = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, workspace.slice(0, -2));
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const manifestPath = path.join(parent, entry.name, "package.json");
				if (existsSync(manifestPath)) {
					manifests.add(manifestPath);
				}
			}
			continue;
		}

		const manifestPath = path.join(ROOT, workspace, "package.json");
		if (existsSync(manifestPath)) {
			manifests.add(manifestPath);
		}
	}

	return [...manifests];
};

const getPublishablePackageManifests = () => {
	const manifests = getWorkspacePackageManifestPaths();
	return manifests
		.map((manifestPath) => ({ manifestPath, manifest: readJson(manifestPath) }))
		.filter(({ manifest }) => manifest?.private !== true)
		.sort((a, b) => (a.manifest.name ?? "").localeCompare(b.manifest.name ?? ""));
};

const violations = [];

const publishablePackages = getPublishablePackageManifests();
for (const { manifest } of publishablePackages) {
	if (!manifest?.peerDependencies?.svelte) continue;
	const pkgName = manifest.name ?? "<unknown>";
	violations.push(
		`${pkgName}: peerDependencies.svelte is forbidden for publishable packages`,
	);
}

if (violations.length > 0) {
	console.error(
		`[check-ce-consumer-contract] Found ${violations.length} violation(s)`,
	);
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log(
	`[check-ce-consumer-contract] OK: validated ${publishablePackages.length} publishable package(s)`,
);
