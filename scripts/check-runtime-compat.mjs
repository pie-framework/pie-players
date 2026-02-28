#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const NODE_SAFE_PACKAGES = [
	"@pie-players/pie-calculator",
	"@pie-players/pie-calculator-desmos",
	"@pie-players/pie-tts",
	"@pie-players/tts-client-server",
	"@pie-players/tts-server-core",
	"@pie-players/tts-server-google",
	"@pie-players/tts-server-polly",
	"@pie-players/math-renderer-core",
	"@pie-players/math-renderer-katex",
	"@pie-players/math-renderer-mathjax",
];

const BROWSER_ONLY_PACKAGES = [
	"@pie-players/pie-item-player",
	"@pie-players/pie-author",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const workspacePackageMap = () => {
	const map = new Map();
	// Use explicit directories to avoid glob dependencies in this script.
	for (const rootDir of ["packages", "tools"]) {
		const abs = path.join(ROOT, rootDir);
		if (!existsSync(abs)) continue;
		for (const dirent of readdirSync(abs, {
			withFileTypes: true,
		})) {
			if (!dirent.isDirectory()) continue;
			const dir = path.join(abs, dirent.name);
			const manifestPath = path.join(dir, "package.json");
			if (!existsSync(manifestPath)) continue;
			const pkg = readJson(manifestPath);
			if (pkg?.name) map.set(pkg.name, { dir, pkg });
		}
	}
	return map;
};

const getImportTarget = (pkg) => {
	const exp = pkg.exports?.["."] ?? pkg.exports;
	if (typeof exp === "string") return exp;
	if (exp && typeof exp === "object") {
		if (typeof exp.import === "string") return exp.import;
		if (typeof exp.default === "string") return exp.default;
	}
	if (typeof pkg.main === "string") return pkg.main;
	return null;
};

const isLikelyBrowserGlobalError = (error) => {
	const message = String(error?.message || "");
	return /(customElements|window|document|HTMLElement|navigator|Class extends value undefined)/.test(
		message,
	);
};

const packageMap = workspacePackageMap();
const failures = [];

for (const name of NODE_SAFE_PACKAGES) {
	const entry = packageMap.get(name);
	if (!entry) {
		failures.push(`[node-safe] missing workspace package: ${name}`);
		continue;
	}
	const target = getImportTarget(entry.pkg);
	if (!target) {
		failures.push(`[node-safe] ${name} has no importable root entry`);
		continue;
	}
	const absTarget = path.join(entry.dir, target);
	if (!existsSync(absTarget)) {
		failures.push(`[node-safe] ${name} missing built entry: ${target}`);
		continue;
	}
	try {
		await import(pathToFileURL(absTarget).href);
	} catch (error) {
		failures.push(
			`[node-safe] ${name} failed Node import (${target}): ${error?.message || error}`,
		);
	}
}

for (const name of BROWSER_ONLY_PACKAGES) {
	const entry = packageMap.get(name);
	if (!entry) {
		failures.push(`[browser-only] missing workspace package: ${name}`);
		continue;
	}
	const target = getImportTarget(entry.pkg);
	if (!target) {
		failures.push(`[browser-only] ${name} has no importable root entry`);
		continue;
	}
	const absTarget = path.join(entry.dir, target);
	if (!existsSync(absTarget)) {
		failures.push(`[browser-only] ${name} missing built entry: ${target}`);
		continue;
	}
	try {
		await import(pathToFileURL(absTarget).href);
		failures.push(
			`[browser-only] ${name} unexpectedly imported in plain Node (${target})`,
		);
	} catch (error) {
		if (!isLikelyBrowserGlobalError(error)) {
			failures.push(
				`[browser-only] ${name} failed with unexpected error (${target}): ${error?.message || error}`,
			);
		}
	}
}

if (failures.length > 0) {
	console.error(
		`[check-runtime-compat] Found ${failures.length} runtime compatibility issue(s)`,
	);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-runtime-compat] OK: ${NODE_SAFE_PACKAGES.length} Node-safe imports and ${BROWSER_ONLY_PACKAGES.length} browser-boundary checks validated`,
);
