#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");

const NODE_IMPORT_TARGETS = [
	"@pie-players/pie-assessment-toolkit",
	"@pie-players/pie-players-shared",
	"@pie-players/pie-context",
	"@pie-players/pie-calculator",
	"@pie-players/pie-calculator-desmos",
	"@pie-players/pie-tts",
	"@pie-players/tts-client-server",
	"@pie-players/tts-server-core",
	"@pie-players/tts-server-google",
	"@pie-players/tts-server-polly",
];

const BROWSER_ONLY_TARGETS = [
	"@pie-players/pie-item-player",
	"@pie-players/pie-section-player",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const isNodeEntryTargetShapeSafe = (target) =>
	target.startsWith("./dist/") &&
	(/\.(mjs|cjs|js)$/.test(target) || target.endsWith("/index"));

const workspacePackageMap = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
	const map = new Map();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string" || !workspace.endsWith("/*")) continue;
		const parent = path.join(ROOT, workspace.slice(0, -2));
		if (!existsSync(parent)) continue;
		for (const dirent of readdirSync(parent, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const dir = path.join(parent, dirent.name);
			const manifestPath = path.join(dir, "package.json");
			if (!existsSync(manifestPath)) continue;
			const pkg = readJson(manifestPath);
			if (pkg?.name) {
				map.set(pkg.name, { dir, pkg });
			}
		}
	}

	return map;
};

const getRootImportTarget = (pkg) => {
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
	return /(customElements|window|document|HTMLElement|navigator|Class extends value undefined|superclass is not a constructor)/i.test(
		message,
	);
};

const run = async () => {
	const packageMap = workspacePackageMap();

	const failures = [];

	for (const specifier of NODE_IMPORT_TARGETS) {
		const entry = packageMap.get(specifier);
		if (!entry) {
			failures.push(`[node-consumer] missing workspace package: ${specifier}`);
			continue;
		}
		const importTarget = getRootImportTarget(entry.pkg);
		if (!importTarget) {
			failures.push(`[node-consumer] ${specifier} has no root import target`);
			continue;
		}
		if (!isNodeEntryTargetShapeSafe(importTarget)) {
			failures.push(
				`[node-consumer] ${specifier} has non-node-safe root target shape: ${importTarget}`,
			);
			continue;
		}
		const absTarget = path.join(entry.dir, importTarget);
		if (!existsSync(absTarget)) {
			failures.push(
				`[node-consumer] ${specifier} missing built import target: ${importTarget}`,
			);
			continue;
		}
		try {
			await import(pathToFileURL(absTarget).href);
		} catch (error) {
			failures.push(
				`[node-consumer] ${specifier} failed Node import (${importTarget}): ${error?.message || error}`,
			);
		}
	}

	for (const specifier of BROWSER_ONLY_TARGETS) {
		const entry = packageMap.get(specifier);
		if (!entry) {
			failures.push(`[node-consumer] missing workspace package: ${specifier}`);
			continue;
		}
		const importTarget = getRootImportTarget(entry.pkg);
		if (!importTarget) {
			failures.push(`[node-consumer] ${specifier} has no root import target`);
			continue;
		}
		const absTarget = path.join(entry.dir, importTarget);
		if (!existsSync(absTarget)) {
			failures.push(
				`[node-consumer] ${specifier} missing built import target: ${importTarget}`,
			);
			continue;
		}
		try {
			await import(pathToFileURL(absTarget).href);
			failures.push(
				`[node-consumer] ${specifier} unexpectedly imported in plain Node (${importTarget})`,
			);
		} catch (error) {
			if (!isLikelyBrowserGlobalError(error)) {
				failures.push(
					`[node-consumer] ${specifier} failed with unexpected Node error (${importTarget}): ${error?.message || error}`,
				);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-node-consumer-imports] Found ${failures.length} Node consumer import issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(
		`[check-node-consumer-imports] OK: validated ${NODE_IMPORT_TARGETS.length} Node-import targets and ${BROWSER_ONLY_TARGETS.length} browser-only boundaries`,
	);
};

await run();
