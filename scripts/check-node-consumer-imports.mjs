#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

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
const ALL_TARGETS = [...NODE_IMPORT_TARGETS, ...BROWSER_ONLY_TARGETS];

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
	const message =
		typeof error === "string"
			? error
			: String(error?.message || error || "");
	return /(customElements|window|document|HTMLElement|navigator|Class extends value undefined|superclass is not a constructor)/i.test(
		message,
	);
};

const parsePackJson = (rawOutput) => {
	const start = rawOutput.indexOf("[");
	const end = rawOutput.lastIndexOf("]");
	if (start < 0 || end < 0 || end < start) {
		throw new Error("npm pack output did not include JSON payload");
	}
	return JSON.parse(rawOutput.slice(start, end + 1));
};

const getInternalWorkspaceDeps = (pkg) => {
	const names = new Set();
	const depBuckets = [
		pkg.dependencies,
		pkg.peerDependencies,
		pkg.optionalDependencies,
	];
	for (const deps of depBuckets) {
		if (!deps || typeof deps !== "object") continue;
		for (const depName of Object.keys(deps)) {
			if (depName.startsWith("@pie-players/")) {
				names.add(depName);
			}
		}
	}
	return [...names];
};

const collectFixturePackageNames = (packageMap, initialSpecifiers) => {
	const included = new Set();
	const queue = [...initialSpecifiers];
	while (queue.length > 0) {
		const specifier = queue.shift();
		if (included.has(specifier)) continue;
		const entry = packageMap.get(specifier);
		if (!entry || entry.pkg?.private) continue;
		included.add(specifier);
		for (const depName of getInternalWorkspaceDeps(entry.pkg)) {
			if (!included.has(depName)) {
				queue.push(depName);
			}
		}
	}
	return [...included].sort();
};

const packWorkspacePackage = (dir) => {
	const rawOutput = execFileSync("npm", ["pack", "--json"], {
		cwd: dir,
		stdio: ["ignore", "pipe", "pipe"],
	}).toString();
	const packData = parsePackJson(rawOutput);
	const tarballName = packData?.[0]?.filename;
	if (!tarballName) {
		throw new Error("npm pack did not return tarball filename");
	}
	const tarballPath = path.join(dir, tarballName);
	if (!existsSync(tarballPath)) {
		throw new Error(`npm pack tarball not found: ${tarballPath}`);
	}
	return tarballPath;
};

const rewriteWorkspaceRangesForFixture = (manifest, packageMap) => {
	const depBuckets = [
		"dependencies",
		"peerDependencies",
		"optionalDependencies",
	];
	for (const bucket of depBuckets) {
		const deps = manifest[bucket];
		if (!deps || typeof deps !== "object") continue;
		for (const [depName, depRange] of Object.entries(deps)) {
			if (
				typeof depRange === "string" &&
				depRange.startsWith("workspace:") &&
				depName.startsWith("@pie-players/")
			) {
				const depEntry = packageMap.get(depName);
				if (depEntry?.pkg?.version) {
					deps[depName] = depEntry.pkg.version;
				}
			}
		}
	}
};

const createPatchedFixtureTarball = (fixtureDir, sourceTarball, packageMap) => {
	const unpackDir = mkdtempSync(path.join(fixtureDir, "pack-unpack-"));
	const tarballsDir = path.join(fixtureDir, "tarballs");
	mkdirSync(tarballsDir, { recursive: true });

	try {
		execFileSync("tar", ["-xzf", sourceTarball, "-C", unpackDir], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		const manifestPath = path.join(unpackDir, "package", "package.json");
		const manifest = readJson(manifestPath);
		rewriteWorkspaceRangesForFixture(manifest, packageMap);
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		const patchedTarballPath = path.join(tarballsDir, path.basename(sourceTarball));
		execFileSync("tar", ["-czf", patchedTarballPath, "-C", unpackDir, "package"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		return patchedTarballPath;
	} finally {
		rmSync(unpackDir, { recursive: true, force: true });
	}
};

const createFixtureProject = () => {
	const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "pie-node-consumer-"));
	writeFileSync(
		path.join(fixtureDir, "package.json"),
		JSON.stringify(
			{
				name: "pie-node-consumer-fixture",
				private: true,
				type: "module",
				version: "0.0.0",
			},
			null,
			2,
		),
	);
	return fixtureDir;
};

const installTarballs = (fixtureDir, tarballs) => {
	execFileSync(
		"npm",
		["install", "--no-package-lock", "--legacy-peer-deps", ...tarballs],
		{
			cwd: fixtureDir,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
};

const importSpecifierFromFixture = (fixtureDir, specifier) => {
	const script = `
const target = ${JSON.stringify(specifier)};
try {
	await import(target);
} catch (error) {
	console.error(String(error?.message ?? error));
	process.exit(2);
}
`;
	try {
		execFileSync(process.execPath, ["--input-type=module", "-e", script], {
			cwd: fixtureDir,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return { ok: true, message: "" };
	} catch (error) {
		const message = [
			error?.stderr?.toString(),
			error?.stdout?.toString(),
			error?.message,
		]
			.filter(Boolean)
			.join("\n")
			.trim();
		return { ok: false, message };
	}
};

const run = async () => {
	const packageMap = workspacePackageMap();
	const failures = [];
	for (const specifier of ALL_TARGETS) {
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
	}

	if (failures.length > 0) {
		console.error(
			`[check-node-consumer-imports] Found ${failures.length} workspace preflight issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	const fixturePackageNames = collectFixturePackageNames(packageMap, ALL_TARGETS);
	const sourceTarballs = [];
	const fixtureTarballs = [];
	let fixtureDir = "";

	try {
		fixtureDir = createFixtureProject();

		for (const packageName of fixturePackageNames) {
			const entry = packageMap.get(packageName);
			if (!entry) {
				failures.push(`[node-consumer] missing workspace package: ${packageName}`);
				continue;
			}
			const sourceTarballPath = packWorkspacePackage(entry.dir);
			sourceTarballs.push(sourceTarballPath);
			const patchedTarballPath = createPatchedFixtureTarball(
				fixtureDir,
				sourceTarballPath,
				packageMap,
			);
			fixtureTarballs.push(patchedTarballPath);
		}

		installTarballs(fixtureDir, fixtureTarballs);

		for (const specifier of NODE_IMPORT_TARGETS) {
			const result = importSpecifierFromFixture(fixtureDir, specifier);
			if (!result.ok) {
				failures.push(
					`[node-consumer] ${specifier} failed Node import from node_modules: ${result.message}`,
				);
			}
		}

		for (const specifier of BROWSER_ONLY_TARGETS) {
			const result = importSpecifierFromFixture(fixtureDir, specifier);
			if (result.ok) {
				failures.push(
					`[node-consumer] ${specifier} unexpectedly imported in plain Node from node_modules`,
				);
				continue;
			}
			if (!isLikelyBrowserGlobalError(result.message)) {
				failures.push(
					`[node-consumer] ${specifier} failed with unexpected Node error from node_modules: ${result.message}`,
				);
			}
		}
	} catch (error) {
		failures.push(
			`[node-consumer] fixture setup failed: ${error?.stderr?.toString?.()?.trim?.() || error?.message || error}`,
		);
	} finally {
		if (fixtureDir) {
			rmSync(fixtureDir, { recursive: true, force: true });
		}
		for (const tarballPath of sourceTarballs) {
			rmSync(tarballPath, { force: true });
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
		`[check-node-consumer-imports] OK: validated ${NODE_IMPORT_TARGETS.length} Node-import targets and ${BROWSER_ONLY_TARGETS.length} browser-only boundaries from installed node_modules packages`,
	);
};

await run();
