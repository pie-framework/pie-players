#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const allowedSveltePeerDependencies = new Map(
	Object.entries(policy.allowedSveltePeerDependencies || {}),
);
const expectedSveltePeerDependencyRange = policy.sveltePeerDependencyRange;

const getWorkspacePackageManifestPaths = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces)
		? rootPkg.workspaces
		: [];
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
		.sort((a, b) =>
			(a.manifest.name ?? "").localeCompare(b.manifest.name ?? ""),
		);
};

const violations = [];

const publishablePackages = getPublishablePackageManifests();
for (const { manifest } of publishablePackages) {
	const pkgName = manifest.name ?? "<unknown>";
	const sveltePeerRange = manifest?.peerDependencies?.svelte;
	if (!sveltePeerRange) continue;

	if (!allowedSveltePeerDependencies.has(pkgName)) {
		violations.push(
			`${pkgName}: peerDependencies.svelte is only allowed for documented raw Svelte source exports`,
		);
		continue;
	}

	if (
		expectedSveltePeerDependencyRange &&
		sveltePeerRange !== expectedSveltePeerDependencyRange
	) {
		violations.push(
			`${pkgName}: peerDependencies.svelte must be ${expectedSveltePeerDependencyRange}; found ${sveltePeerRange}`,
		);
	}

	if (manifest?.peerDependenciesMeta?.svelte?.optional !== true) {
		violations.push(
			`${pkgName}: peerDependenciesMeta.svelte.optional must be true so non-Svelte consumers do not get peer warnings`,
		);
	}
}

const publishablePackageNames = new Set(
	publishablePackages.map(({ manifest }) => manifest.name).filter(Boolean),
);
for (const pkgName of allowedSveltePeerDependencies.keys()) {
	if (!publishablePackageNames.has(pkgName)) {
		violations.push(
			`${pkgName}: scripts/publish-policy.json allows a Svelte peer dependency for a package that is not publishable in this workspace`,
		);
		continue;
	}
	const entry = publishablePackages.find(
		({ manifest }) => manifest.name === pkgName,
	);
	if (!entry?.manifest?.peerDependencies?.svelte) {
		violations.push(
			`${pkgName}: scripts/publish-policy.json allows a Svelte peer dependency, but the package no longer declares one`,
		);
	}
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
