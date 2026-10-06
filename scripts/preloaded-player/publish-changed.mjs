import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function repoRoot() {
	return process.cwd();
}

const ROOT = repoRoot();
const CONFIG_DIR = path.join(ROOT, "configs", "preloaded-player");

function parseArgs(argv) {
	const args = { base: undefined, head: undefined, all: false, dryRun: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--base") args.base = argv[++i];
		else if (a === "--head") args.head = argv[++i];
		else if (a === "--all") args.all = true;
		else if (a === "--dry-run") args.dryRun = true;
		else if (a === "--help" || a === "-h") {
			console.log(`Usage:
  bun scripts/preloaded-player/publish-changed.mjs --base <sha> --head <sha>
  bun scripts/preloaded-player/publish-changed.mjs --all
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
	return elements.map((e) => `${e.package}@${e.version}`);
}

function generateHash(elements) {
	return crypto
		.createHash("sha256")
		.update([...elements].sort().join("+"))
		.digest("hex")
		.slice(0, 7);
}

function gitDiffNameOnly(base, head) {
	const out = execSync(`git diff --name-only ${base} ${head}`, {
		cwd: ROOT,
		stdio: ["ignore", "pipe", "pipe"],
	})
		.toString("utf8")
		.trim();
	return out.length ? out.split("\n") : [];
}

/** A change under one of these can alter what every build bundles. */
const REBUILD_ALL_PREFIXES = [
	"packages/item-player/",
	"tools/cli/",
	"packages/players-shared/",
	"scripts/preloaded-player/",
];

/**
 * Paths under those prefixes that no build reads: tests, their Playwright
 * configs, and prose. Manifests stay triggers, because the item player's version
 * is every build's base version.
 */
const NOT_BUILD_INPUTS = [
	/(^|\/)tests?\//,
	/\.(test|spec)\.[cm]?[jt]sx?$/,
	/(^|\/)playwright(\.[\w-]+)?\.config\.[cm]?[jt]s$/,
	/\.md$/,
];

export function shouldRebuildAll(changedFiles) {
	return changedFiles.some(
		(file) =>
			REBUILD_ALL_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
			!NOT_BUILD_INPUTS.some((pattern) => pattern.test(file)),
	);
}

function determineTargets({ base, head, all }) {
	const allConfigs = listConfigFiles();
	if (!allConfigs.length) return { reason: "no-configs", configs: [] };
	if (all) return { reason: "all", configs: allConfigs };
	if (!base || !head)
		throw new Error("Provide --base and --head (or use --all).");
	if (/^0+$/.test(base)) return { reason: "base-is-zero", configs: allConfigs };
	const changed = gitDiffNameOnly(base, head);
	if (!changed.length) return { reason: "no-changes", configs: [] };
	if (shouldRebuildAll(changed))
		return { reason: "rebuild-all", configs: allConfigs };
	const changedConfigs = changed
		.filter(
			(f) => f.startsWith("configs/preloaded-player/") && f.endsWith(".json"),
		)
		.map((f) => path.join(ROOT, f))
		.filter((p) => existsSync(p))
		.sort();
	return { reason: "changed-configs", configs: changedConfigs };
}

function validateUniqueCombinations(configPaths) {
	const byHash = new Map();
	for (const filePath of configPaths) {
		const hash = generateHash(extractElements(filePath));
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

/**
 * The config that sets `"latest": true` publishes under `latest`, and every other
 * config under its own name. Exactly one, so `latest` keeps following a current
 * build.
 */
export function validateLatestConfig(configs) {
	const latest = configs
		.filter(({ parsed }) => parsed?.latest === true)
		.map(({ file }) => file);
	if (latest.length !== 1) {
		throw new Error(
			`Exactly one config must set "latest": true; found ${latest.length ? latest.join(", ") : "none"}`,
		);
	}
}

function publishConfig(elementsFile, { dryRun }) {
	const rel = path.relative(ROOT, elementsFile);
	const abs = path.resolve(elementsFile);
	const cmd = `bun run --cwd tools/cli build && bun run cli pie-packages:preloaded-player-build-package -f "${abs}" --publish`;
	if (dryRun) {
		console.log(`[DRY RUN] ${cmd} # from ${rel}`);
		return;
	}
	execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const targets = determineTargets(args);
	console.log(
		`preloaded publish: reason=${targets.reason}, configs=${targets.configs.length}`,
	);
	for (const c of targets.configs) console.log(`- ${path.relative(ROOT, c)}`);
	if (!targets.configs.length) return;
	validateUniqueCombinations(targets.configs);
	validateLatestConfig(
		listConfigFiles().map((file) => ({
			file: path.relative(ROOT, file),
			parsed: readJson(file),
		})),
	);
	for (const cfg of targets.configs) publishConfig(cfg, args);
}

if (import.meta.main) {
	main().catch((err) => {
		console.error(err?.message || err);
		process.exit(1);
	});
}
