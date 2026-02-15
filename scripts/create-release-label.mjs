import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { globSync } from "glob";

const rootDir = process.cwd();
const rootPackage = JSON.parse(
	readFileSync(path.join(rootDir, "package.json"), "utf8"),
);

const args = process.argv.slice(2);
let providedLabel = null;
let providedPrefix = path.basename(rootDir);
let shouldPush = false;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--label") {
		providedLabel = args[++i] ?? null;
	} else if (arg === "--prefix") {
		providedPrefix = args[++i] ?? providedPrefix;
	} else if (arg === "--push") {
		shouldPush = true;
	} else if (arg === "--dry-run") {
		dryRun = true;
	}
}

const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
const label = providedLabel ?? `${providedPrefix}-${datePart}`;

const workspacePatterns = Array.isArray(rootPackage.workspaces)
	? rootPackage.workspaces
	: [];

const packageJsonPaths = new Set();
for (const pattern of workspacePatterns) {
	const matches = globSync(path.join(pattern, "package.json"), {
		cwd: rootDir,
		absolute: true,
		ignore: ["**/node_modules/**"],
	});
	for (const match of matches) packageJsonPaths.add(match);
}

const packages = [...packageJsonPaths]
	.map((pkgPath) => {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
		return {
			name: pkg.name,
			version: pkg.version,
			private: pkg.private === true,
		};
	})
	.filter((pkg) => pkg.name && pkg.version && !pkg.private)
	.sort((a, b) => a.name.localeCompare(b.name));

if (packages.length === 0) {
	throw new Error("No public workspace packages found");
}

try {
	execSync(`git rev-parse -q --verify refs/tags/${label}`, {
		stdio: "ignore",
	});
	throw new Error(`Tag "${label}" already exists`);
} catch (error) {
	// Expected when tag doesn't exist yet
	if (String(error.message || "").includes("already exists")) throw error;
}

const tagBody = [
	`Release label: ${label}`,
	`Repository: ${rootPackage.name ?? path.basename(rootDir)}`,
	`Generated: ${new Date().toISOString()}`,
	"",
	`Public packages (${packages.length}):`,
	...packages.map((pkg) => `- ${pkg.name}@${pkg.version}`),
].join("\n");

if (dryRun) {
	console.log(`[release:label] Dry run - would create tag "${label}"`);
	console.log(tagBody);
	process.exit(0);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), "release-label-"));
const messageFile = path.join(tmpDir, "tag-message.txt");
writeFileSync(messageFile, tagBody, "utf8");

try {
	execSync(`git tag -a "${label}" -F "${messageFile}"`, {
		stdio: "inherit",
		cwd: rootDir,
	});

	console.log(
		`[release:label] Created tag "${label}" for ${packages.length} packages`,
	);

	if (shouldPush) {
		execSync(`git push origin "${label}"`, {
			stdio: "inherit",
			cwd: rootDir,
		});
		console.log(`[release:label] Pushed tag "${label}" to origin`);
	}
} finally {
	rmSync(tmpDir, { recursive: true, force: true });
}
