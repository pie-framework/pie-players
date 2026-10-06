import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getWorkspaceDirs, parsePackJson } from "./lib/pack-inspection.mjs";

const ROOT = process.cwd();
const HASH_ONLY_FILE_PATTERN = /^(?:module|chunk|index)?-?[a-f0-9]{8,}\.m?js$/i;
const HASH_SUFFIX_FILE_PATTERN = /-[a-f0-9]{8,}\.m?js$/i;

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const normalizeDeclaredPath = (value) => {
	if (typeof value !== "string") return null;
	if (!value.startsWith("./")) return null;
	const normalized = value.slice(2);
	return normalized.length > 0 ? normalized : null;
};

const isPackedMatch = (declaredPath, packedFiles) => {
	if (packedFiles.has(declaredPath)) return true;
	if (declaredPath.includes("*")) {
		const escaped = declaredPath
			.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, ".*");
		const pattern = new RegExp(`^${escaped}$`);
		return [...packedFiles].some((file) => pattern.test(file));
	}
	return false;
};

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

const collectExportTargets = (value, out) => {
	if (!value) return;
	if (typeof value === "string") {
		const normalized = normalizeDeclaredPath(value);
		if (normalized) out.add(normalized);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry) => collectExportTargets(entry, out));
		return;
	}
	if (typeof value === "object") {
		Object.values(value).forEach((entry) => collectExportTargets(entry, out));
	}
};

const run = () => {
	const packageDirs = getWorkspaceDirs({
		workspaceRoots: ["packages", "apps", "tools"],
	});
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;

		checked += 1;
		const declaredTargets = new Set();

		["main", "module", "types", "unpkg", "jsdelivr", "svelte"].forEach(
			(field) => {
				const normalized = normalizeDeclaredPath(pkg[field]);
				if (normalized) declaredTargets.add(normalized);
			},
		);

		collectExportTargets(pkg.exports, declaredTargets);

		let packedFiles;
		try {
			const rawOutput = execSync("npm pack --dry-run --json", {
				cwd: dir,
				stdio: ["ignore", "pipe", "pipe"],
			}).toString();
			const packData = parsePackJson(rawOutput);
			const fileEntries = packData?.[0]?.files ?? [];
			packedFiles = new Set(fileEntries.map((entry) => entry.path));
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir,
				missing: ["<failed to run npm pack --dry-run --json>"],
			});
			continue;
		}

		const missing = [...declaredTargets]
			.filter((target) => !isPackedMatch(target, packedFiles))
			.sort();
		const unstable = getHashOnlyDeclaredTargets(declaredTargets);
		const hashedSuffix = getHashSuffixDeclaredTargets(declaredTargets);

		if (missing.length > 0 || unstable.length > 0 || hashedSuffix.length > 0) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir,
				missing,
				unstable,
				hashedSuffix,
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-pack-exports] Found ${failures.length} package(s) with publish mismatches`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			for (const missingEntry of failure.missing) {
				console.error(`  - missing: ${missingEntry}`);
			}
			for (const unstableEntry of failure.unstable ?? []) {
				console.error(
					`  - unstable export target (hash-only filename): ${unstableEntry}`,
				);
			}
			for (const hashedSuffixEntry of failure.hashedSuffix ?? []) {
				console.error(
					`  - unstable export target (hashed suffix filename): ${hashedSuffixEntry}`,
				);
			}
		}
		process.exit(1);
	}

	console.log(
		`[check-pack-exports] OK: validated ${checked} publishable package(s)`,
	);
};

run();
