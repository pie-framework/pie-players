/**
 * The dist-only publish-surface rules, shared by the pre-commit check
 * (`check-publish-surface.mjs`) and the CI pack check (`check-pack-integrity.mjs`)
 * so a package cannot pass one and fail the other.
 */

import { collectTargets } from "./pack-inspection.mjs";

const FORBIDDEN_EXPORT_CONDITIONS = new Set(["development", "svelte"]);

const isMetadataFile = (filePath) =>
	/^(?:package\.json|README(?:\.[a-z]+)?|LICENSE(?:\.[a-z]+)?|CHANGELOG(?:\.[a-z]+)?)$/i.test(
		filePath,
	);

/**
 * Declarations emitted from a package's own build tooling. These are never part of
 * a published API and reach `dist` only when a dts plugin's `include` is unbounded
 * a recursive TypeScript glob, or absent, and sweeps the config file up with the
 * sources.
 */
const isBuildConfigDeclaration = (filePath) =>
	/(?:^|\/)(?:vite|vitest|playwright|rollup|svelte|tsup|tailwind|postcss)\.config(?:\.[a-z]+)?\.d\.ts$/.test(
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
		.flatMap((filePath) => {
			if (isBuildConfigDeclaration(filePath)) {
				return [
					`packed file is a build-config declaration: ${filePath} — narrow the dts plugin's include/exclude so it stops emitting one`,
				];
			}
			if (isRawSourceFile(filePath) || !isAllowedPackedFile(filePath, pkg)) {
				return [`packed file is outside dist/metadata/assets: ${filePath}`];
			}
			return [];
		})
		.sort();
