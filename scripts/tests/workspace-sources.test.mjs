import { describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	conventionalSource,
	RENAMED_OUTPUTS,
	REPO_ROOT,
	workspacePackages,
	workspaceSources,
	workspaceSourcesVitePlugin,
} from "../../test-support/workspace-sources.ts";

const PRELOAD = "test-support/bun-workspace-sources.ts";

function fixtureRoot(packages) {
	const root = mkdtempSync(path.join(tmpdir(), "pie-workspace-sources-"));
	writeFileSync(
		path.join(root, "package.json"),
		JSON.stringify({ workspaces: ["packages/*"] }),
	);
	for (const [dir, { manifest, files = [] }] of Object.entries(packages)) {
		const packageDir = path.join(root, "packages", dir);
		mkdirSync(packageDir, { recursive: true });
		writeFileSync(
			path.join(packageDir, "package.json"),
			JSON.stringify(manifest),
		);
		for (const file of files) {
			mkdirSync(path.dirname(path.join(packageDir, file)), { recursive: true });
			writeFileSync(path.join(packageDir, file), "");
		}
	}
	return root;
}

/** Files under `dir` matching `pattern`, outside `node_modules` and `dist`. */
function findFiles(dir, pattern) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "dist") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...findFiles(full, pattern));
		else if (pattern.test(entry.name)) found.push(full);
	}
	return found;
}

function declaresSibling(manifest) {
	return Object.keys({
		...manifest.dependencies,
		...manifest.devDependencies,
		...manifest.peerDependencies,
	}).some((name) => name.startsWith("@pie-players/"));
}

describe("workspace source map", () => {
	const sources = workspaceSources();

	test("maps every workspace export to an existing source file outside dist", () => {
		expect(sources.get("@pie-players/pie-players-shared/loaders")).toBe(
			path.join(REPO_ROOT, "packages/players-shared/src/loaders/index.ts"),
		);
		expect(sources.get("@pie-players/pie-assessment-toolkit")).toBe(
			path.join(REPO_ROOT, "packages/assessment-toolkit/src/index.ts"),
		);
		for (const [specifier, source] of sources) {
			expect({ specifier, exists: existsSync(source) }).toEqual({
				specifier,
				exists: true,
			});
			expect(source.split(path.sep)).not.toContain("dist");
		}
	});

	test("finds a source under src/ before the package root, by output name", () => {
		const root = fixtureRoot({
			a: {
				manifest: {
					name: "@pie-players/a",
					exports: {
						".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
						"./panel": "./dist/Panel.js",
						"./registry.json": "./dist/registry.json",
						"./styles.css": "./dist/styles.css",
					},
				},
				files: [
					"src/index.ts",
					"index.ts",
					"Panel.svelte",
					"src/registry.json",
				],
			},
		});
		const dir = path.join(root, "packages/a");

		expect(workspaceSources(root)).toEqual(
			new Map([
				["@pie-players/a", path.join(dir, "src/index.ts")],
				["@pie-players/a/panel", path.join(dir, "Panel.svelte")],
				["@pie-players/a/registry.json", path.join(dir, "src/registry.json")],
			]),
		);
	});

	test("throws on an export whose source it cannot find", () => {
		const root = fixtureRoot({
			b: {
				manifest: {
					name: "@pie-players/b",
					exports: { "./bundle": "./dist/bundle.js" },
				},
			},
		});

		expect(() => workspaceSources(root)).toThrow(
			"no source found for @pie-players/b/bundle (./dist/bundle.js)",
		);
	});

	test("lists only renamed outputs the convention misses, each named by its Vite config", () => {
		const packages = new Map(
			workspacePackages().map((entry) => [entry.name, entry]),
		);
		for (const [name, outputs] of Object.entries(RENAMED_OUTPUTS)) {
			const entry = packages.get(name);
			expect({ name, found: Boolean(entry) }).toEqual({ name, found: true });
			const viteConfigs = readdirSync(entry.dir)
				.filter((file) => /^vite\.config.*\.ts$/.test(file))
				.map((file) => readFileSync(path.join(entry.dir, file), "utf8"))
				.join("\n");
			const targets = JSON.stringify(entry.manifest.exports);
			for (const [target, source] of Object.entries(outputs)) {
				expect({ target, exported: targets.includes(`"${target}"`) }).toEqual({
					target,
					exported: true,
				});
				expect({
					target,
					convention: conventionalSource(entry.dir, target),
				}).toEqual({
					target,
					convention: undefined,
				});
				expect({ source, named: viteConfigs.includes(source) }).toEqual({
					source,
					named: true,
				});
			}
		}
	});

	test("the Vite adapter resolves workspace exports and leaves the rest to Vite", () => {
		const plugin = workspaceSourcesVitePlugin();

		expect(plugin.resolveId("@pie-players/pie-players-shared/loaders")).toBe(
			sources.get("@pie-players/pie-players-shared/loaders"),
		);
		expect(plugin.resolveId("svelte")).toBeNull();
	});
});

describe("bun preload", () => {
	test("a sibling runs from source and a test's mock of it wins, built or not", () => {
		const root = fixtureRoot({
			built: {
				manifest: { name: "@pie-players/built", exports: "./dist/index.js" },
			},
			unbuilt: {
				manifest: { name: "@pie-players/unbuilt", exports: "./dist/index.js" },
			},
		});
		const write = (file, contents) => {
			mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			writeFileSync(path.join(root, file), contents);
		};
		for (const name of ["built", "unbuilt"]) {
			write(`packages/${name}/src/index.ts`, 'export const ran = "source";\n');
			mkdirSync(path.join(root, "node_modules/@pie-players"), {
				recursive: true,
			});
			symlinkSync(
				path.join(root, "packages", name),
				path.join(root, "node_modules/@pie-players", name),
			);
		}
		write("packages/built/dist/index.js", 'export const ran = "stale dist";\n');
		write(
			"preload.ts",
			`import { plugin } from "bun";
import { workspaceSourcesPlugin } from ${JSON.stringify(path.join(REPO_ROOT, PRELOAD))};
plugin(workspaceSourcesPlugin(${JSON.stringify(root)}));
`,
		);
		write("bunfig.toml", '[test]\npreload = ["./preload.ts"]\n');
		const probe = (mocked) => `import { expect, mock, test } from "bun:test";
${mocked ? 'for (const name of ["built", "unbuilt"]) mock.module(`@pie-players/${name}`, () => ({ ran: "mock" }));' : ""}
test.each(["built", "unbuilt"])("%s", async (name) => {
	const { ran } = await import(\`@pie-players/\${name}\`);
	expect(ran).toBe(${JSON.stringify(mocked ? "mock" : "source")});
});
`;
		write("source.test.ts", probe(false));
		write("mocked.test.ts", probe(true));

		// One run per file: a module mock outlives the file that set it.
		for (const file of ["./source.test.ts", "./mocked.test.ts"]) {
			const run = Bun.spawnSync([process.execPath, "test", file], {
				cwd: root,
				stdout: "pipe",
				stderr: "pipe",
			});
			const output = `${run.stdout}${run.stderr}`;
			expect({ file, exitCode: run.exitCode, output }).toEqual({
				file,
				exitCode: 0,
				output: expect.stringContaining(" 2 pass"),
			});
		}
	});
});

describe("test runner wiring", () => {
	const packages = workspacePackages();

	test("every package running bun test preloads the source map", () => {
		const root = Bun.TOML.parse(
			readFileSync(path.join(REPO_ROOT, "bunfig.toml"), "utf8"),
		);
		expect(root.test.preload).toContain(`./${PRELOAD}`);

		const checked = [];
		for (const { name, dir, manifest } of packages) {
			if (!manifest.scripts?.test?.includes("bun test")) continue;
			checked.push(name);
			const bunfigPath = path.join(dir, "bunfig.toml");
			const bunfig = existsSync(bunfigPath)
				? Bun.TOML.parse(readFileSync(bunfigPath, "utf8"))
				: {};
			const preload = path.relative(dir, path.join(REPO_ROOT, PRELOAD));
			expect({ name, preload: bunfig.test?.preload ?? [] }).toEqual({
				name,
				preload: expect.arrayContaining([preload]),
			});
			if (findFiles(dir, /\.spec\.ts$/).length > 0) {
				expect({ name, ignored: bunfig.test?.pathIgnorePatterns }).toEqual({
					name,
					ignored: ["**/*.spec.ts"],
				});
			}
		}
		expect(checked).toContain("@pie-players/pie-assessment-toolkit");
		expect(checked).toContain("@pie-players/pie-section-player");
	});

	test("every Vitest package with tests and a workspace sibling uses the Vite adapter", () => {
		const checked = [];
		for (const { name, dir, manifest } of packages) {
			if (!manifest.scripts?.test?.includes("vitest")) continue;
			if (!declaresSibling(manifest)) continue;
			if (findFiles(dir, /\.test\.ts$/).length === 0) continue;
			checked.push(name);
			const configPath = path.join(dir, "vitest.config.ts");
			const config = existsSync(configPath)
				? readFileSync(configPath, "utf8")
				: "";
			expect({
				name,
				adapter: config.includes("workspaceSourcesVitePlugin()"),
			}).toEqual({
				name,
				adapter: true,
			});
		}
		expect(checked).toEqual(
			expect.arrayContaining([
				"@pie-players/tts-client-server",
				"@pie-players/tts-server-sc",
			]),
		);
	});
});
