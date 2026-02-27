import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Local pack script.
 *
 * Produces installable tarballs for packages in ./local-builds.
 * Designed for fast iteration from PIEOneer/pie-api-aws without publishing.
 */

const repoRoot = process.cwd();
const outDir = join(repoRoot, "local-builds");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const basePackagesToPack = [
	// CLI + core shared
	"tools/cli",
	"packages/players-shared",

	// Item players
	"packages/inline-player",
	"packages/fixed-player",
	"packages/esm-player",

	// Assessment stack
	"packages/assessment-toolkit",
	"packages/iife-player",
];

const toolPackagesToPack = readdirSync(join(repoRoot, "packages"))
	.filter((name) => name.startsWith("tool-"))
	.map((name) => `packages/${name}`)
	.filter((rel) => existsSync(join(repoRoot, rel, "package.json")))
	.sort();

const packagesToPack = [...basePackagesToPack, ...toolPackagesToPack];

for (const rel of packagesToPack) {
	const pkgDir = join(repoRoot, rel);
	try {
		// Prefer Bun's pack to avoid npm permission issues in locked-down environments.
		execSync(`bun pm pack --ignore-scripts --destination "${outDir}" --quiet`, {
			cwd: pkgDir,
			stdio: "inherit",
		});
	} catch (e) {
		console.error(`[pack-local] Failed to pack ${rel}`);
		throw e;
	}
}

const tgzs = readdirSync(outDir)
	.filter((f) => f.endsWith(".tgz"))
	.sort();

console.log("\nLocal packages written to:", outDir);
console.log("\nTarballs:");
for (const f of tgzs) console.log("  -", f);

console.log("\nInstall examples (from PIEOneer/pie-api-aws):");
console.log("  npm i " + tgzs.map((f) => `file:${join(outDir, f)}`).join(" "));
