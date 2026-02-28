import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function repoRoot() {
	// Assume invoked from repo root (CI and local). Keep it simple.
	return process.cwd();
}

const ROOT = repoRoot();
const CONFIG_DIR = path.join(ROOT, "configs", "fixed-player-static");

function parseArgs(argv) {
	const args = {
		base: undefined,
		head: undefined,
		all: false,
		dryRun: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--base") args.base = argv[++i];
		else if (a === "--head") args.head = argv[++i];
		else if (a === "--all") args.all = true;
		else if (a === "--dry-run") args.dryRun = true;
		else if (a === "--help" || a === "-h") {
			// eslint-disable-next-line no-console
			console.log(`Usage:
  node scripts/fixed-player-static/publish-changed.mjs --base <sha> --head <sha>
  node scripts/fixed-player-static/publish-changed.mjs --all

Options:
  --base <sha>   Base commit SHA for diff (push "before")
  --head <sha>   Head commit SHA for diff (push "after")
  --all          Publish all configs (ignores git diff)
  --dry-run      Print what would be published, do not publish
`);
			process.exit(0);
		}
	}
	return args;
}

function listConfigFiles() {
	if (!existsSync(CONFIG_DIR)) return [];
	return readdirSync(CONFIG_DIR, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".json"))
		.map((e) => path.join(CONFIG_DIR, e.name))
		.sort();
}

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

function extractElements(filePath) {
	const parsed = readJson(filePath);
	const elements = Array.isArray(parsed)
		? parsed
		: Array.isArray(parsed?.elements)
			? parsed.elements
			: null;
	if (!elements) {
		throw new Error(
			`Invalid config: ${path.relative(ROOT, filePath)} (expected an array or { "elements": [...] })`,
		);
	}
	const normalized = elements.map((e) => {
		if (!e || typeof e !== "object") {
			throw new Error(
				`Invalid element entry in ${path.relative(ROOT, filePath)} (expected { package, version })`,
			);
		}
		const pkg = e.package;
		const version = e.version;
		if (typeof pkg !== "string" || pkg.length === 0) {
			throw new Error(
				`Invalid element.package in ${path.relative(ROOT, filePath)} (expected non-empty string)`,
			);
		}
		if (typeof version !== "string" || version.length === 0) {
			throw new Error(
				`Invalid element.version in ${path.relative(ROOT, filePath)} (expected non-empty string)`,
			);
		}
		return `${pkg}@${version}`;
	});
	return normalized;
}

function generateHash(elements) {
	const sorted = [...elements].sort();
	const elementString = sorted.join("+");
	return crypto
		.createHash("sha256")
		.update(elementString)
		.digest("hex")
		.slice(0, 7);
}

function gitDiffNameOnly(base, head) {
	try {
		const out = execSync(`git diff --name-only ${base} ${head}`, {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "pipe"],
		})
			.toString("utf8")
			.trim();
		return out.length ? out.split("\n") : [];
	} catch (e) {
		throw new Error(
			`Failed to compute git diff from ${base}..${head}. Are these SHAs available locally?`,
		);
	}
}

function shouldRebuildAll(changedFiles) {
	// If item-player/CLI/build plumbing changes, we republish all configs so the same
	// element combinations get a new ".iteration" (bugfix rebuild).
	const triggers = [
		"packages/item-player/",
		"tools/cli/",
		"packages/players-shared/",
		"scripts/fixed-player-static/",
	];
	return changedFiles.some((f) => triggers.some((t) => f.startsWith(t)));
}

function determineTargets({ base, head, all }) {
	const allConfigs = listConfigFiles();
	if (!allConfigs.length) return { reason: "no-configs", configs: [] };

	if (all) return { reason: "all", configs: allConfigs };

	if (!base || !head) {
		throw new Error("Provide --base and --head (or use --all).");
	}

	// GitHub uses all-zeros SHA in some cases; treat that as “publish all”.
	if (/^0+$/.test(base)) return { reason: "base-is-zero", configs: allConfigs };

	const changed = gitDiffNameOnly(base, head);
	if (!changed.length) return { reason: "no-changes", configs: [] };

	if (shouldRebuildAll(changed))
		return { reason: "rebuild-all", configs: allConfigs };

	const changedConfigs = changed
		.filter(
			(f) =>
				f.startsWith("configs/fixed-player-static/") && f.endsWith(".json"),
		)
		.map((f) => path.join(ROOT, f))
		.filter((p) => existsSync(p))
		.sort();

	return { reason: "changed-configs", configs: changedConfigs };
}

function validateUniqueCombinations(configPaths) {
	const byHash = new Map();
	for (const filePath of configPaths) {
		const elements = extractElements(filePath);
		const hash = generateHash(elements);
		const rel = path.relative(ROOT, filePath);
		const existing = byHash.get(hash) || [];
		existing.push(rel);
		byHash.set(hash, existing);
	}

	const duplicates = [...byHash.entries()].filter(
		([, files]) => files.length > 1,
	);
	if (duplicates.length) {
		const lines = duplicates
			.map(([hash, files]) => `- ${hash}: ${files.join(", ")}`)
			.join("\n");
		throw new Error(
			`Duplicate element combinations detected (same hash). Keep configs unique:\n${lines}`,
		);
	}
}

function publishConfig(elementsFile, { dryRun }) {
	const rel = path.relative(ROOT, elementsFile);
	const cmd = `bun run cli pie-packages:fixed-player-build-package -f "${rel}" --publish`;
	if (dryRun) {
		// eslint-disable-next-line no-console
		console.log(`[DRY RUN] ${cmd}`);
		return;
	}
	execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const targets = determineTargets(args);

	// eslint-disable-next-line no-console
	console.log(
		`preloaded-static publish: reason=${targets.reason}, configs=${targets.configs.length}`,
	);
	for (const c of targets.configs) {
		// eslint-disable-next-line no-console
		console.log(`- ${path.relative(ROOT, c)}`);
	}

	if (!targets.configs.length) return;

	validateUniqueCombinations(targets.configs);

	for (const cfg of targets.configs) {
		publishConfig(cfg, args);
	}
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err?.message || err);
	process.exit(1);
});
