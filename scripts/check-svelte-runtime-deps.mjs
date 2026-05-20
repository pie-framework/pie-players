#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const expectedRuntimeRange = policy.svelteRuntimeDependencyRange;
const allowedRuntimeDependencies = new Map(
	Object.entries(policy.allowedSvelteRuntimeDependencies || {}),
);

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
				if (existsSync(manifestPath)) manifests.add(manifestPath);
			}
			continue;
		}

		const manifestPath = path.join(ROOT, workspace, "package.json");
		if (existsSync(manifestPath)) manifests.add(manifestPath);
	}

	return [...manifests].sort();
};

const violations = [];
let checked = 0;
const publishablePackageNames = new Set();
const allowedRuntimeDependenciesSeen = new Set();

for (const manifestPath of getWorkspacePackageManifestPaths()) {
	const manifest = readJson(manifestPath);
	if (manifest?.private === true) continue;
	checked += 1;

	const packageName =
		manifest.name ?? path.relative(ROOT, path.dirname(manifestPath));
	publishablePackageNames.add(packageName);
	for (const dependencyBucket of ["dependencies", "optionalDependencies"]) {
		const svelteRange = manifest?.[dependencyBucket]?.svelte;
		if (!svelteRange) continue;

		const allowedReason = allowedRuntimeDependencies.get(packageName);
		if (!allowedReason) {
			violations.push(
				`${packageName}: ${dependencyBucket}.svelte is not allowed for publishable packages. Move Svelte to devDependencies, bundle it into browser entrypoints, or document a narrow exception in scripts/publish-policy.json.`,
			);
			continue;
		}

		allowedRuntimeDependenciesSeen.add(packageName);
		if (dependencyBucket !== "dependencies") {
			violations.push(
				`${packageName}: Svelte runtime exceptions must use dependencies.svelte, not ${dependencyBucket}.svelte.`,
			);
		}
		if (expectedRuntimeRange && svelteRange !== expectedRuntimeRange) {
			violations.push(
				`${packageName}: dependencies.svelte must stay aligned to ${expectedRuntimeRange}; found ${svelteRange}.`,
			);
		}
	}
}

for (const packageName of allowedRuntimeDependencies.keys()) {
	if (!publishablePackageNames.has(packageName)) {
		violations.push(
			`${packageName}: scripts/publish-policy.json allows a Svelte runtime dependency for a package that is not publishable in this workspace.`,
		);
		continue;
	}
	if (!allowedRuntimeDependenciesSeen.has(packageName)) {
		violations.push(
			`${packageName}: scripts/publish-policy.json allows a Svelte runtime dependency, but the package no longer declares dependencies.svelte. Remove the stale exception.`,
		);
	}
}

if (violations.length > 0) {
	console.error(
		`[check-svelte-runtime-deps] Found ${violations.length} Svelte runtime dependency violation(s)`,
	);
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log(
	`[check-svelte-runtime-deps] OK: validated ${checked} publishable package(s)`,
);
