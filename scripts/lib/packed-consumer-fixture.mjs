/** Shared tarball fixture for the Node and browser custom-element consumer checks. */
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { mapConcurrent, runPack } from "./pack-inspection.mjs";

const execFileAsync = promisify(execFile);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export const workspacePackageMap = (root = process.cwd()) => {
	const rootPkg = readJson(path.join(root, "package.json"));
	const workspaces = Array.isArray(rootPkg.workspaces)
		? rootPkg.workspaces
		: [];
	const map = new Map();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string" || !workspace.endsWith("/*")) continue;
		const parent = path.join(root, workspace.slice(0, -2));
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

export const collectFixturePackageNames = (packageMap, initialSpecifiers) => {
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

const createPatchedFixtureTarball = async (
	fixtureDir,
	sourceTarball,
	packageMap,
) => {
	const unpackDir = mkdtempSync(path.join(fixtureDir, "pack-unpack-"));
	const tarballsDir = path.join(fixtureDir, "tarballs");
	mkdirSync(tarballsDir, { recursive: true });

	try {
		await execFileAsync("tar", ["-xzf", sourceTarball, "-C", unpackDir]);
		const manifestPath = path.join(unpackDir, "package", "package.json");
		const manifest = readJson(manifestPath);
		rewriteWorkspaceRangesForFixture(manifest, packageMap);
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		const patchedTarballPath = path.join(
			tarballsDir,
			path.basename(sourceTarball),
		);
		await execFileAsync("tar", [
			"-czf",
			patchedTarballPath,
			"-C",
			unpackDir,
			"package",
		]);
		return patchedTarballPath;
	} finally {
		rmSync(unpackDir, { recursive: true, force: true });
	}
};

export const createFixtureProject = () => {
	const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "pie-packed-consumer-"));
	writeFileSync(
		path.join(fixtureDir, "package.json"),
		JSON.stringify(
			{
				name: "pie-packed-consumer-fixture",
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

export const installTarballs = (fixtureDir, tarballs) => {
	execFileSync(
		"npm",
		["install", "--no-package-lock", "--legacy-peer-deps", ...tarballs],
		{
			cwd: fixtureDir,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
};


/** Pack only published workspace runtime dependencies, then make workspace ranges installable. */
export async function packFixturePackages(fixtureDir, packageMap, packageNames) {
	const sourceTarballsDir = path.join(fixtureDir, "source-tarballs");
	mkdirSync(sourceTarballsDir);
	return new Map(await mapConcurrent(packageNames, async (packageName) => {
		const entry = packageMap.get(packageName);
		if (!entry) throw new Error(`Missing workspace package: ${packageName}`);
		const { tarballPath } = await runPack(entry.dir, { destination: sourceTarballsDir });
		return [packageName, await createPatchedFixtureTarball(fixtureDir, tarballPath, packageMap)];
	}));
}
