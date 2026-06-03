#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	collectDeclaredTargets,
	collectTargets,
	getPublishablePackages,
	isPackedMatch,
	readJson,
	runPack,
	runPackDryRun,
	toPosix,
} from "./lib/pack-inspection.mjs";

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const MAX_DETAILS_PER_PACKAGE = 30;
const FORBIDDEN_EXPORT_CONDITIONS = new Set(["development", "svelte"]);
const HASH_ONLY_FILE_PATTERN = /^(?:module|chunk|index)?-?[a-f0-9]{8,}\.m?js$/i;
const HASH_SUFFIX_FILE_PATTERN = /-[a-f0-9]{8,}\.m?js$/i;
const USE_REAL_PACK = process.argv.includes("--real-pack");

const isMetadataFile = (filePath) =>
	/^(?:package\.json|README(?:\.[a-z]+)?|LICENSE(?:\.[a-z]+)?|CHANGELOG(?:\.[a-z]+)?)$/i.test(
		filePath,
	);

const isRawSourceFile = (filePath) =>
	filePath.startsWith("src/") ||
	/\.svelte(?:\.ts)?$/.test(filePath) ||
	(/\.tsx?$/.test(filePath) && !filePath.endsWith(".d.ts"));

const normalizeManifestPath = (value) =>
	typeof value === "string" ? value.replace(/^\.\//, "") : "";

const getDeclaredBinFiles = (pkg) => {
	if (typeof pkg.bin === "string") {
		return new Set([normalizeManifestPath(pkg.bin)]);
	}
	if (!pkg.bin || typeof pkg.bin !== "object") return new Set();
	return new Set(
		Object.values(pkg.bin).map(normalizeManifestPath).filter(Boolean),
	);
};

const isAllowedPackedFile = (filePath, pkg) => {
	if (filePath.startsWith("dist/")) return true;
	if (getDeclaredBinFiles(pkg).has(filePath)) return true;
	if (isMetadataFile(filePath)) return true;
	if (filePath === "oclif.manifest.json" && pkg.oclif) return true;
	if (
		/\.(?:css|json|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot)$/.test(
			filePath,
		)
	) {
		return true;
	}
	return false;
};

const collectExportKeyViolations = (
	pkg,
	forbiddenPublicExports,
	violations,
) => {
	const exportKeys = new Set();
	const walk = (value, keys = []) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) return;
		for (const [key, child] of Object.entries(value)) {
			if (keys.length === 0 && key.startsWith(".")) {
				exportKeys.add(key);
			}
			if (FORBIDDEN_EXPORT_CONDITIONS.has(key)) {
				violations.push(`export condition "${key}" is not allowed`);
			}
			walk(child, [...keys, key]);
		}
	};

	walk(pkg.exports);

	const forbiddenForPackage = forbiddenPublicExports.get(pkg.name) || [];
	for (const exportKey of forbiddenForPackage) {
		const matches = exportKey.endsWith("*")
			? [...exportKeys].some((key) => key.startsWith(exportKey.slice(0, -1)))
			: exportKeys.has(exportKey);
		if (matches) {
			violations.push(`forbidden public export is present: ${exportKey}`);
		}
	}
};

export const collectManifestSurfaceViolations = (
	pkg,
	forbiddenPublicExports = new Map(),
) => {
	const violations = [];

	if (Array.isArray(pkg.files)) {
		for (const entry of pkg.files) {
			const normalized = String(entry).replace(/^\.\//, "");
			if (normalized === "src" || normalized.startsWith("src/")) {
				violations.push(`files[] includes source path: ${entry}`);
			}
			if (/\.svelte(?:\.ts)?$/.test(normalized)) {
				violations.push(`files[] includes raw Svelte source: ${entry}`);
			}
			if (/\.tsx?$/.test(normalized) && !normalized.endsWith(".d.ts")) {
				violations.push(`files[] includes raw TypeScript source: ${entry}`);
			}
		}
	}

	if (pkg.svelte) {
		violations.push("package-level svelte field is not allowed");
	}
	for (const dependencyBucket of ["optionalDependencies", "peerDependencies"]) {
		if (pkg[dependencyBucket]?.svelte) {
			violations.push(`${dependencyBucket}.svelte is not allowed`);
		}
	}
	if (pkg.peerDependenciesMeta?.svelte) {
		violations.push("peerDependenciesMeta.svelte is not allowed");
	}

	collectExportKeyViolations(pkg, forbiddenPublicExports, violations);

	const targets = new Set();
	for (const field of ["main", "module", "types", "unpkg", "jsdelivr"]) {
		collectTargets(pkg[field], targets);
	}
	collectTargets(pkg.exports, targets);

	for (const target of [...targets].sort()) {
		if (target.startsWith("src/")) {
			violations.push(`export target points at src: ./${target}`);
			continue;
		}
		if (/\.svelte(?:\.ts)?$/.test(target)) {
			violations.push(`export target exposes raw Svelte source: ./${target}`);
			continue;
		}
		if (/\.tsx?$/.test(target) && !target.endsWith(".d.ts")) {
			violations.push(
				`export target exposes raw TypeScript source: ./${target}`,
			);
			continue;
		}
		if (!target.startsWith("dist/") && !isMetadataFile(target)) {
			violations.push(`export target is outside dist: ./${target}`);
		}
	}

	return violations;
};

export const collectPackedFileSurfaceViolations = (packedFiles, pkg) =>
	[...packedFiles]
		.filter(
			(filePath) =>
				isRawSourceFile(filePath) || !isAllowedPackedFile(filePath, pkg),
		)
		.map(
			(filePath) => `packed file is outside dist/metadata/assets: ${filePath}`,
		)
		.sort();

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

const readPolicy = () => {
	if (!existsSync(POLICY_PATH)) return {};
	return readJson(POLICY_PATH);
};

const run = () => {
	const policy = readPolicy();
	const forbiddenPublicExports = new Map(
		Object.entries(policy.forbiddenPublicExports || {}),
	);
	const failures = [];
	let checked = 0;

	for (const { dir, pkg } of getPublishablePackages({
		root: ROOT,
		workspaceRoots: policy.workspaceRoots ?? ["packages"],
	})) {
		checked += 1;
		const violations = collectManifestSurfaceViolations(
			pkg,
			forbiddenPublicExports,
		);

		let packCleanup = null;
		try {
			const packedFiles = USE_REAL_PACK
				? (() => {
						const result = runPack(dir);
						packCleanup = result.cleanup;
						return result.packedFiles;
					})()
				: runPackDryRun(dir);
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

		if (violations.length > 0) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: toPosix(path.relative(ROOT, dir)),
				violations,
			});
		}
	}

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
	run();
}
