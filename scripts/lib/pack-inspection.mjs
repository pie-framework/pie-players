import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

export const toPosix = (value) =>
	value.replaceAll(path.sep, "/").replaceAll("\\", "/");

export const readJson = (filePath) =>
	JSON.parse(readFileSync(filePath, "utf8"));

export const readPublishPolicy = (root = process.cwd()) => {
	const policyPath = path.join(root, "scripts", "publish-policy.json");
	return existsSync(policyPath) ? readJson(policyPath) : {};
};

const requireStringArray = (policy, pathSegments) => {
	let value = policy;
	for (const segment of pathSegments) {
		value = value?.[segment];
	}
	if (
		!Array.isArray(value) ||
		!value.every((entry) => typeof entry === "string")
	) {
		throw new Error(
			`scripts/publish-policy.json must define ${pathSegments.join(
				".",
			)} as an array of package names`,
		);
	}
	return value;
};

export const getNodeConsumerImportTargets = (policy) => ({
	nodeSafe: requireStringArray(policy, [
		"nodeConsumerImportTargets",
		"nodeSafe",
	]),
	browserOnly: requireStringArray(policy, [
		"nodeConsumerImportTargets",
		"browserOnly",
	]),
});

export const normalizeDeclaredPath = (value) => {
	if (typeof value !== "string") return null;
	if (!value.startsWith("./")) return null;
	const normalized = value.slice(2);
	return normalized.length > 0 ? normalized : null;
};

export const collectTargets = (value, out) => {
	const normalized = normalizeDeclaredPath(value);
	if (normalized) {
		out.add(normalized);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectTargets(entry, out);
		return;
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

export const collectDeclaredTargets = (
	pkg,
	fields = ["main", "module", "types", "unpkg", "jsdelivr", "svelte"],
) => {
	const targets = new Set();
	for (const field of fields) {
		collectTargets(pkg?.[field], targets);
	}
	collectTargets(pkg?.exports, targets);
	return targets;
};

export const isPackedMatch = (declaredPath, packedFiles) => {
	if (packedFiles.has(declaredPath)) return true;
	if (!declaredPath.includes("*")) return false;
	const escaped = declaredPath
		.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");
	const pattern = new RegExp(`^${escaped}$`);
	return [...packedFiles].some((file) => pattern.test(file));
};

/**
 * The pack results in `npm pack --dry-run --json` output, always as an array.
 *
 * npm changed the payload's top-level shape in 12: through 11 it is an array of pack results,
 * from 12 it is an object keyed by package name. Both are normalised to an array here so callers
 * keep indexing `[0]`.
 *
 * Locating the payload by scanning for the first `[` — which is what this did before npm 12 —
 * lands inside the nested `files` array on a 12 payload and slices a fragment that does not
 * parse. That failed every publish-surface check on any machine with npm 12 installed, reported
 * as "JSON Parse error" for all 37 packages, which reads like 37 broken packages rather than one
 * broken parser. The opening brace or bracket is whichever comes first.
 */
export const parsePackJson = (rawOutput) => {
	const candidates = [rawOutput.indexOf("{"), rawOutput.indexOf("[")].filter(
		(index) => index >= 0,
	);
	if (candidates.length === 0) {
		throw new Error("npm pack output did not include JSON payload");
	}

	const start = Math.min(...candidates);
	const end = rawOutput.lastIndexOf(rawOutput[start] === "[" ? "]" : "}");
	if (end < start) {
		throw new Error("npm pack output did not include JSON payload");
	}

	const payload = JSON.parse(rawOutput.slice(start, end + 1));
	if (Array.isArray(payload)) return payload;
	if (payload && typeof payload === "object") return Object.values(payload);
	throw new Error(
		`npm pack JSON payload was neither an array nor an object: ${typeof payload}`,
	);
};

export const getWorkspaceDirs = ({
	root = process.cwd(),
	workspaceRoots = ["packages", "tools"],
} = {}) => {
	const rootPkg = readJson(path.join(root, "package.json"));
	const workspaces = Array.isArray(rootPkg.workspaces)
		? rootPkg.workspaces
		: [];
	const allowedRoots = new Set(workspaceRoots);
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		const workspaceRoot = workspace.endsWith("/*")
			? workspace.slice(0, -2)
			: workspace;
		if (!allowedRoots.has(workspaceRoot)) continue;
		if (workspace.endsWith("/*")) {
			const parent = path.join(root, workspaceRoot);
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) dirs.add(path.join(parent, entry.name));
			}
			continue;
		}
		dirs.add(path.join(root, workspace));
	}

	return [...dirs]
		.filter((dir) => existsSync(path.join(dir, "package.json")))
		.sort((a, b) => a.localeCompare(b));
};

export const getPublishablePackages = ({
	root = process.cwd(),
	workspaceRoots = ["packages"],
} = {}) =>
	getWorkspaceDirs({ root, workspaceRoots })
		.map((dir) => {
			const manifestPath = path.join(dir, "package.json");
			return {
				dir,
				manifestPath,
				pkg: readJson(manifestPath),
			};
		})
		.filter(({ pkg }) => pkg?.private !== true)
		.sort((a, b) => (a.pkg.name ?? a.dir).localeCompare(b.pkg.name ?? b.dir));

export const packedFilesFromPackData = (packData) =>
	new Set((packData?.[0]?.files ?? []).map((entry) => toPosix(entry.path)));

export const runPackDryRun = (dir) => {
	const rawOutput = execSync("npm pack --dry-run --json", {
		cwd: dir,
		stdio: ["ignore", "pipe", "pipe"],
	}).toString();
	const packData = parsePackJson(rawOutput);
	return packedFilesFromPackData(packData);
};

export const runPack = (dir) => {
	const rawOutput = execSync("npm pack --json", {
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
	return {
		packedFiles: packedFilesFromPackData(packData),
		tarballPath,
		cleanup: () => rmSync(tarballPath, { force: true }),
	};
};
