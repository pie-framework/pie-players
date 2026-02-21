#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKSPACE_ROOTS = ["packages", "tools", "apps"];
const PUBLISHABLE_ROOTS = ["packages", "tools"];
const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const localPackages = new Map();
const workspacePackageJsonPaths = [];

for (const root of WORKSPACE_ROOTS) {
	const absRoot = path.join(ROOT, root);
	if (!existsSync(absRoot)) continue;

	for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const pkgJsonPath = path.join(absRoot, entry.name, "package.json");
		if (!existsSync(pkgJsonPath)) continue;
		const pkg = readJson(pkgJsonPath);
		if (pkg?.name && pkg?.version) {
			localPackages.set(pkg.name, pkg.version);
			workspacePackageJsonPaths.push(pkgJsonPath);
		}
	}
}

const resolveWorkspaceRange = (workspaceSpecifier, packageName) => {
	const localVersion = localPackages.get(packageName);
	if (!localVersion) return workspaceSpecifier;

	const suffix = workspaceSpecifier.slice("workspace:".length);
	if (suffix === "*" || suffix === "") return localVersion;
	if (suffix === "^") return `^${localVersion}`;
	if (suffix === "~") return `~${localVersion}`;
	return suffix;
};

const backups = new Map();

const rewriteWorkspaceRanges = () => {
	for (const pkgJsonPath of workspacePackageJsonPaths) {
		const original = readFileSync(pkgJsonPath, "utf8");
		const pkg = JSON.parse(original);
		let changed = false;

		for (const section of DEP_SECTIONS) {
			const deps = pkg[section];
			if (!deps) continue;
			for (const [name, range] of Object.entries(deps)) {
				if (typeof range === "string" && range.startsWith("workspace:")) {
					const resolved = resolveWorkspaceRange(range, name);
					if (resolved !== range) {
						deps[name] = resolved;
						changed = true;
					}
				}
			}
		}

		if (changed) {
			backups.set(pkgJsonPath, original);
			writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf8");
		}
	}
};

const restoreWorkspaceRanges = () => {
	for (const [pkgJsonPath, contents] of backups.entries()) {
		writeFileSync(pkgJsonPath, contents, "utf8");
	}
};

const listPublishablePackages = () => {
	const out = [];
	for (const root of PUBLISHABLE_ROOTS) {
		const absRoot = path.join(ROOT, root);
		if (!existsSync(absRoot)) continue;
		for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const dir = path.join(absRoot, entry.name);
			const pkgJsonPath = path.join(dir, "package.json");
			if (!existsSync(pkgJsonPath)) continue;
			const pkg = readJson(pkgJsonPath);
			if (pkg.private) continue;
			out.push({
				name: pkg.name || `${root}/${entry.name}`,
				dir,
			});
		}
	}
	return out;
};

const getPackedManifest = (pkgDir) => {
	const raw = execSync("npm pack --json", {
		cwd: pkgDir,
		stdio: ["ignore", "pipe", "pipe"],
	}).toString();
	const payload = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
	const tarballName = payload?.[0]?.filename;
	if (!tarballName) {
		throw new Error(`npm pack did not produce a tarball in ${pkgDir}`);
	}
	const tarballPath = path.join(pkgDir, tarballName);
	const manifestText = execSync(`tar -xOf "${tarballPath}" package/package.json`, {
		cwd: pkgDir,
		stdio: ["ignore", "pipe", "pipe"],
	}).toString();
	unlinkSync(tarballPath);
	return JSON.parse(manifestText);
};

const findWorkspaceRanges = (pkg) => {
	const hits = [];
	for (const section of DEP_SECTIONS) {
		const deps = pkg[section] ?? {};
		for (const [name, range] of Object.entries(deps)) {
			if (typeof range === "string" && range.startsWith("workspace:")) {
				hits.push(`${section}.${name}=${range}`);
			}
		}
	}
	return hits;
};

const failures = [];

try {
	rewriteWorkspaceRanges();
	for (const pkg of listPublishablePackages()) {
		const packedManifest = getPackedManifest(pkg.dir);
		const workspaceRanges = findWorkspaceRanges(packedManifest);
		if (workspaceRanges.length > 0) {
			failures.push({
				name: pkg.name,
				ranges: workspaceRanges,
			});
		}
	}
} finally {
	restoreWorkspaceRanges();
}

if (failures.length > 0) {
	console.error(
		`[check-packed-workspace-ranges] Found ${failures.length} package(s) leaking workspace:* ranges`,
	);
	for (const failure of failures) {
		console.error(`\n- ${failure.name}`);
		for (const range of failure.ranges) {
			console.error(`  - ${range}`);
		}
	}
	process.exit(1);
}

console.log(
	"[check-packed-workspace-ranges] OK: packed publishable packages contain no workspace:* ranges",
);
