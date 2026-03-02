import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join, resolve } from "node:path";

function expandHome(p: string): string {
	if (p === "~") return os.homedir();
	if (p.startsWith("~/")) return join(os.homedir(), p.slice(2));
	return p;
}

async function findLatestLocalStaticPackageDir(
	monorepoDir: string,
): Promise<string | null> {
	const localBuildsDir = join(monorepoDir, "local-builds");
	if (!existsSync(localBuildsDir)) return null;

	const entries = await readdir(localBuildsDir, { withFileTypes: true });
	const dirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => join(localBuildsDir, e.name));

	// Prefer versioned outputs, fall back to local/.
	const candidates = dirs
		.filter(
			(d) =>
				d.includes("pie-preloaded-player-") ||
				d.endsWith(join("local-builds", "local")),
		)
		.map((d) => resolve(d));

	// Naive fallback: first existing with package.json.
	for (const d of candidates) {
		if (existsSync(join(d, "package.json"))) return d;
	}
	return null;
}

export type GeneratePreloadedStaticTestProjectOptions = {
	monorepoDir: string;
	outputDir: string;
	name: string;
	packagePath?: string;
	publishedVersion?: string; // e.g. "1.0.0" | "latest"
	start?: boolean;
	port?: number;
};

export async function generatePreloadedStaticTestProject(
	opts: GeneratePreloadedStaticTestProjectOptions,
): Promise<string> {
	const outputDir = expandHome(opts.outputDir);
	const projectDir = resolve(outputDir, opts.name);
	await mkdir(projectDir, { recursive: true });

	const port = opts.port ?? 4173;

	let importUrlOrPath: string;
	if (opts.publishedVersion) {
		const v =
			opts.publishedVersion === "latest" ? "latest" : opts.publishedVersion;
		importUrlOrPath = `https://cdn.jsdelivr.net/npm/@pie-players/pie-preloaded-player@${v}/dist/index.js`;
	} else {
		const pkgDir = opts.packagePath
			? resolve(expandHome(opts.packagePath))
			: await findLatestLocalStaticPackageDir(opts.monorepoDir);

		if (!pkgDir) {
			throw new Error(
				"No local static package found. Build one first via: bun run cli pie-packages:preloaded-player-build-package -f <file>",
			);
		}

		// Use a relative path from the test project so any static server can serve it.
		// This assumes the user serves from a directory that includes both this project and the packageDir; we provide a copy-based option below.
		// For reliability, we copy the package dist into the test project.
		const distSrc = join(pkgDir, "dist");
		if (!existsSync(distSrc)) {
			throw new Error(`Expected dist/ in static package dir: ${pkgDir}`);
		}

		const distDest = join(projectDir, "static-package");
		await mkdir(distDest, { recursive: true });
		execSync(`cp -R "${distSrc}/" "${distDest}/"`, { stdio: "inherit" });
		importUrlOrPath = "./static-package/index.js";
	}

	const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PIE Item Player Preloaded Static Test</title>
  </head>
  <body>
    <script type="module">
      import "${importUrlOrPath}";
    </script>

    <h1>PIE Item Player Preloaded Static Test</h1>
    <p>If the import succeeded, <code>&lt;pie-item-player&gt;</code> should be defined.</p>
    <pie-item-player strategy="preloaded"></pie-item-player>
  </body>
</html>
`;

	const readme = `# PIE preloaded static test project

This project loads a built \`@pie-players/pie-preloaded-player\` bundle and renders a \`<pie-item-player strategy="preloaded">\` element.

## Run

From this directory:

\`\`\`bash
python3 -m http.server ${port}
\`\`\`

Then open \`http://localhost:${port}\`.
`;

	await writeFile(join(projectDir, "index.html"), html);
	await writeFile(join(projectDir, "README.md"), readme);

	if (opts.start) {
		// Foreground dev server (simple and dependency-free).
		execSync(`python3 -m http.server ${port}`, {
			cwd: projectDir,
			stdio: "inherit",
		});
	}

	return projectDir;
}
