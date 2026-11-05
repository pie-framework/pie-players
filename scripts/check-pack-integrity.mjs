#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	collectDeclaredTargets,
	getPublishablePackages,
	isPackedMatch,
	mapConcurrent,
	readJson,
	readPublishPolicy,
	runPack,
	runPackDryRun,
	toPosix,
} from "./lib/pack-inspection.mjs";
import {
	collectManifestSurfaceViolations,
	collectPackedFileSurfaceViolations,
} from "./lib/publish-surface.mjs";

const ROOT = process.cwd();
const MAX_DETAILS_PER_PACKAGE = 30;
const HASH_ONLY_FILE_PATTERN = /^(?:module|chunk|index)?-?[a-f0-9]{8,}\.m?js$/i;
const HASH_SUFFIX_FILE_PATTERN = /-[a-f0-9]{8,}\.m?js$/i;
const USE_REAL_PACK = process.argv.includes("--real-pack");

const getHashOnlyDeclaredTargets = (declaredTargets) =>
	[...declaredTargets]
		.filter((target) => {
			if (!target.endsWith(".js") && !target.endsWith(".mjs")) return false;
			const fileName = target.split("/").pop() || "";
			return HASH_ONLY_FILE_PATTERN.test(fileName);
		})
		.sort();

const getHashSuffixDeclaredTargets = (declaredTargets) =>
	[...declaredTargets]
		.filter((target) => {
			if (!target.endsWith(".js") && !target.endsWith(".mjs")) return false;
			const fileName = target.split("/").pop() || "";
			return HASH_SUFFIX_FILE_PATTERN.test(fileName);
		})
		.sort();

export const collectExportTargetViolations = (declaredTargets, packedFiles) => {
	const violations = [];
	for (const target of [...declaredTargets].sort()) {
		if (!isPackedMatch(target, packedFiles)) {
			violations.push(`missing: ${target}`);
		}
	}
	for (const target of getHashOnlyDeclaredTargets(declaredTargets)) {
		violations.push(`unstable export target (hash-only filename): ${target}`);
	}
	for (const target of getHashSuffixDeclaredTargets(declaredTargets)) {
		violations.push(
			`unstable export target (hashed suffix filename): ${target}`,
		);
	}
	return violations;
};

export const assertPublishablePackagesChecked = (checked) => {
	if (checked > 0) return;
	throw new Error(
		"no publishable packages discovered; check scripts/publish-policy.json workspaceRoots",
	);
};

const isVirtualSource = (sourcePath) =>
	/^(?:dep:|browser-external:|virtual:|data:)|\0/.test(sourcePath);

const isExternalSource = (sourcePath) =>
	path.posix.isAbsolute(sourcePath) || /^[a-z][a-z0-9+.-]*:/i.test(sourcePath);

const hasSourceContent = (sourcesContent, index) =>
	Array.isArray(sourcesContent) && sourcesContent[index] != null;

const resolvePackedSource = (mapFile, sourceMap, sourcePath) => {
	if (isVirtualSource(sourcePath)) return null;
	if (isExternalSource(sourcePath))
		return { packedPath: null, reason: "external" };

	const sourceRoot =
		typeof sourceMap.sourceRoot === "string" ? sourceMap.sourceRoot : "";
	if (sourceRoot && isExternalSource(sourceRoot)) {
		return { packedPath: null, reason: "external sourceRoot" };
	}

	const packedPath = path.posix.normalize(
		path.posix.join(path.posix.dirname(mapFile), sourceRoot, sourcePath),
	);
	if (packedPath === ".." || packedPath.startsWith("../")) {
		return { packedPath, reason: "outside package" };
	}
	return { packedPath, reason: "missing" };
};

const getPackedSourcemapFiles = (packedFiles) =>
	[...packedFiles]
		.filter((file) => file.endsWith(".js.map") || file.endsWith(".d.ts.map"))
		.sort();

const collectSourcemapSourceViolations = (dir, packedFiles) => {
	const violations = [];
	for (const mapFile of getPackedSourcemapFiles(packedFiles)) {
		const mapPath = path.join(dir, ...mapFile.split("/"));
		if (!existsSync(mapPath)) {
			violations.push(`${mapFile} is listed by npm pack but missing on disk`);
			continue;
		}

		const sourceMap = readJson(mapPath);
		const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
		for (let index = 0; index < sources.length; index += 1) {
			const sourcePath = sources[index];
			if (!sourcePath || hasSourceContent(sourceMap.sourcesContent, index)) {
				continue;
			}

			const resolved = resolvePackedSource(mapFile, sourceMap, sourcePath);
			if (!resolved) continue;
			if (!resolved.packedPath || !packedFiles.has(resolved.packedPath)) {
				const target = resolved.packedPath
					? `${sourcePath} (${resolved.reason}: ${resolved.packedPath})`
					: `${sourcePath} (${resolved.reason})`;
				violations.push(`${mapFile} -> ${target}`);
			}
		}
	}
	return violations;
};

const checkPackage = async ({ dir, pkg }, forbiddenPublicExports) => {
	const violations = collectManifestSurfaceViolations(
		pkg,
		forbiddenPublicExports,
	);

	let packCleanup = null;
	try {
		let packedFiles;
		if (USE_REAL_PACK) {
			const result = await runPack(dir);
			packCleanup = result.cleanup;
			packedFiles = result.packedFiles;
		} else {
			packedFiles = await runPackDryRun(dir);
		}
		violations.push(...collectPackedFileSurfaceViolations(packedFiles, pkg));
		violations.push(
			...collectExportTargetViolations(
				collectDeclaredTargets(pkg),
				packedFiles,
			),
		);
		violations.push(...collectSourcemapSourceViolations(dir, packedFiles));
	} catch (error) {
		violations.push(
			error.stderr?.toString()?.trim() ||
				error.message ||
				"failed to inspect npm pack contents",
		);
	} finally {
		packCleanup?.();
	}

	return violations.length > 0
		? {
				name: pkg.name || path.basename(dir),
				dir: toPosix(path.relative(ROOT, dir)),
				violations,
			}
		: null;
};

const run = async () => {
	const policy = readPublishPolicy(ROOT);
	const forbiddenPublicExports = new Map(
		Object.entries(policy.forbiddenPublicExports || {}),
	);
	const packages = getPublishablePackages({
		root: ROOT,
		workspaceRoots: policy.workspaceRoots ?? ["packages"],
	});
	const checked = packages.length;
	const failures = (
		await mapConcurrent(packages, (entry) =>
			checkPackage(entry, forbiddenPublicExports),
		)
	).filter(Boolean);

	try {
		assertPublishablePackagesChecked(checked);
	} catch (error) {
		failures.push({
			name: "publishable package discovery",
			dir: ".",
			violations: [error.message],
		});
	}

	if (failures.length > 0) {
		console.error(
			`[check-pack-integrity] Found ${failures.length} package(s) with pack integrity issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			for (const violation of failure.violations.slice(
				0,
				MAX_DETAILS_PER_PACKAGE,
			)) {
				console.error(`  - ${violation}`);
			}
			const omitted = failure.violations.length - MAX_DETAILS_PER_PACKAGE;
			if (omitted > 0) console.error(`  - ... ${omitted} more`);
		}
		process.exit(1);
	}

	console.log(
		`[check-pack-integrity] OK: validated ${checked} publishable package(s)`,
	);
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	await run();
}
