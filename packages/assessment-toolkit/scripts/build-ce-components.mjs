#!/usr/bin/env bun

import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const srcComponents = path.join(packageRoot, "src", "components");
const distComponents = path.join(packageRoot, "dist", "components");

// Every runtime dependency stays external, so a dependency reaches a consumer's
// graph exactly once.
//
// Inlining a dependency here creates a copy the consumer's bundler cannot
// deduplicate: its module id is this package's chunk file, not the dependency's
// path in `node_modules`, so a consumer that also reaches that dependency
// through our tsc module output ends up bundling it twice. That is not
// hypothetical — `speech-rule-engine` was landing in the section player twice
// (~1.3 MB) for exactly this reason, once via `services/tts/math-speech.js` and
// once inside the pre-bundled CE chunk.
//
// This imposes nothing new on consumers: these artifacts already emit bare
// `@pie-players/*` specifiers, so they have always required a bundler or an
// import map rather than being loadable directly from a bare browser.
const packageManifest = JSON.parse(
	readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);
const externalPackages = [
	...Object.keys(packageManifest.dependencies ?? {}),
	...Object.keys(packageManifest.peerDependencies ?? {}),
];
// Both forms: the bare name plus a subpath glob, since these components import
// deep entrypoints such as `@pie-players/pie-players-shared/pie`.
const externals = externalPackages.flatMap((name) => [name, `${name}/*`]);

mkdirSync(distComponents, { recursive: true });
rmSync(path.join(distComponents, ".generated"), {
	recursive: true,
	force: true,
});
// Shared chunks carry content hashes, so a rebuild that changes a chunk emits a
// new filename rather than overwriting the old one. The package `build` script
// wipes `dist` wholesale, but `dev` (watch) does not, and orphaned chunks would
// otherwise accumulate into the published `files: ["dist"]` payload.
rmSync(path.join(distComponents, "chunks"), { recursive: true, force: true });

// Mirror non-TS asset directories (e.g. vendored 3rd-party CE bundles) from
// src/components into dist/components so relative imports emitted by
// Svelte resolve at bundle time. tsc only emits TypeScript; static JS
// vendor bundles need to be copied explicitly.
//
// At copy time we also rewrite raw `customElements.define(...)` calls
// inside vendored files into idempotent guards. The vendor bundles get
// inlined into multiple toolkit CE artifacts (ItemToolBar / SectionToolBar
// / PieAssessmentToolkit) and a host page can load more than one of them,
// so the second register would otherwise throw NotSupportedError. This
// matches the same guarantee the SAFE_DEFINE_HELPER below provides for
// Svelte-compiled CEs, applied via source rewrite because we don't own
// the upstream code.
const guardVendorDefineCalls = (source) =>
	source.replace(
		/customElements\.define\((\w+),\s*(\w+)\)/g,
		"customElements.get($1) || customElements.define($1, $2)",
	);
const vendorSrc = path.join(srcComponents, "vendor");
const vendorDist = path.join(distComponents, "vendor");
if (existsSync(vendorSrc)) {
	rmSync(vendorDist, { recursive: true, force: true });
	cpSync(vendorSrc, vendorDist, { recursive: true });
	const walkAndPatch = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const absPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walkAndPatch(absPath);
				continue;
			}
			if (!entry.name.endsWith(".js")) continue;
			const original = readFileSync(absPath, "utf8");
			const patched = guardVendorDefineCalls(original);
			if (patched !== original) {
				writeFileSync(absPath, patched, "utf8");
			}
		}
	};
	walkAndPatch(vendorDist);
}

// All three CEs go through one bundler invocation so they share chunks instead
// of each inlining its own copy of the Svelte runtime, the services layer, and
// the policy engine. Bundling them separately triplicated that code.
//
// `generated` deliberately sits directly in `dist/components`, not a
// subdirectory: the Svelte compiler emits relative specifiers such as
// `../services/ToolkitCoordinator.js`, which only resolve against the tsc
// output when the bundler entry sits at the same depth as the artifact it
// stands in for. The temp basename is the CE's base name so that
// `--entry-naming=[name].custom-element.js` reproduces the exact filenames the
// package `exports` map and the `components/*-element` entrypoints import.
// `registrationEntry` is the tsc-emitted `components/*-element.js` shim whose
// only job is `import "./<Name>.custom-element.js"`. One CE imports another
// through that shim (`SectionToolBar.svelte` pulls in `item-toolbar-element.js`
// so mounting a section toolbar guarantees `pie-item-toolbar` is registered).
// Those shims point at build *outputs*, so they cannot be followed while those
// outputs are still being produced — see REGISTRATION_ENTRY_REWRITES below.
const entries = [
	{ name: "ItemToolBar", registrationEntry: "item-toolbar-element" },
	{
		name: "PieAssessmentToolkit",
		registrationEntry: "pie-assessment-toolkit-element",
	},
	{ name: "SectionToolBar", registrationEntry: "section-toolbar-element" },
].map((entry) => ({
	...entry,
	source: path.join(srcComponents, `${entry.name}.svelte`),
	generated: path.join(distComponents, `${entry.name}.js`),
}));

// Redirect cross-CE registration imports onto the sibling entry in this same
// build. The old script sidestepped this by bundling one entry at a time, in an
// order where the referenced `*.custom-element.js` happened to already exist on
// disk — an unstated ordering dependency that also made `SectionToolBar` inline
// a complete second copy of the already-bundled `ItemToolBar`. Pointing at the
// entry instead lets the bundler share one copy through `chunks/` while keeping
// the registration side effect intact: importing `section-toolbar-element` still
// registers `pie-item-toolbar`.
const REGISTRATION_ENTRY_REWRITES = new Map(
	entries.map((entry) => [
		`./${entry.registrationEntry}.js`,
		`./${entry.name}.js`,
	]),
);

const rewriteRegistrationImports = (source) => {
	let rewritten = source;
	for (const [from, to] of REGISTRATION_ENTRY_REWRITES) {
		rewritten = rewritten.split(`"${from}"`).join(`"${to}"`);
		rewritten = rewritten.split(`'${from}'`).join(`'${to}'`);
	}
	return rewritten;
};

const SAFE_DEFINE_HELPER = `
const __pieDefineSafely = (tagName, ctor) => {
	if (customElements.get(tagName)) return;
	try {
		customElements.define(tagName, ctor);
	} catch (error) {
		const duplicate =
			(error instanceof DOMException && error.name === "NotSupportedError") ||
			(error && typeof error === "object" && error.name === "NotSupportedError");
		if (!duplicate || !customElements.get(tagName)) {
			throw error;
		}
	}
};
`;

for (const entry of entries) {
	const source = readFileSync(entry.source, "utf8");
	const compiled = compile(source, {
		filename: entry.source,
		generate: "client",
		customElement: true,
		css: "injected",
		dev: false,
	});

	// Svelte CE output can include setter parameters with default values, which
	// are not valid in plain JS class setters and break svelte-check consumers.
	let sanitizedCode = compiled.js.code.replace(
		/set\s+([A-Za-z_$][\w$]*)\(\s*\$\$value\s*=\s*[^)]+\)/g,
		(_, setterName) => `set ${setterName}($$value)`,
	);
	sanitizedCode = sanitizedCode.replace(
		/customElements\.define\s*\(/g,
		"__pieDefineSafely(",
	);
	sanitizedCode = rewriteRegistrationImports(sanitizedCode);
	sanitizedCode = `${SAFE_DEFINE_HELPER}\n${sanitizedCode}`;

	writeFileSync(entry.generated, `// @ts-nocheck\n${sanitizedCode}`, "utf8");
}

// Svelte gates its dev-only runtime on `DEV` from esm-env, including the
// `Array.prototype` warning patches it installs on the host page. Resolving
// esm-env to its production build turns those branches off without removing
// them: Bun folds neither a constant imported from another module nor one
// declared inside an import cycle, which Svelte's internals form. Dropping the
// `DEV` import leaves a free identifier that the `DEV` define below replaces
// with a literal while parsing, so minification removes the dev code, matching
// what the Vite-built packages ship. Any other esm-env import shape fails the
// build rather than passing through unrewritten.
const ESM_ENV_BINDINGS = new Set(["BROWSER", "DEV", "NODE"]);
const ESM_ENV_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']esm-env["'];?/g;

const dropSvelteDevImport = {
	name: "drop-svelte-dev-import",
	setup(build) {
		build.onLoad(
			{ filter: /[\\/]svelte[\\/]src[\\/].*\.js$/ },
			async ({ path: modulePath }) => {
				const source = await Bun.file(modulePath).text();
				const contents = source.replace(ESM_ENV_IMPORT, (_, specifiers) => {
					const kept = specifiers
						.split(",")
						.map((specifier) => specifier.trim())
						.filter(Boolean)
						.filter((specifier) => {
							if (!ESM_ENV_BINDINGS.has(specifier)) {
								throw new Error(
									`[build-ce-components] unexpected esm-env import "${specifier}" in ${modulePath}`,
								);
							}
							return specifier !== "DEV";
						});
					return kept.length > 0
						? `import { ${kept.join(", ")} } from "esm-env";`
						: "";
				});
				return { contents, loader: "js" };
			},
		);
	},
};

// One invocation for every entry. `splitting` is what lets the bundler hoist
// shared code into `chunks/`, and it is also what makes dynamic imports stay
// dynamic: with the previous single-file `--outfile` build there was nowhere to
// put a chunk, so the `import("speech-rule-engine")` in
// `src/services/tts/math-speech.ts` was flattened into the eager bundle —
// roughly half of the toolkit artifact, loaded by every host whether or not it
// ever spoke a formula. Splitting restores the lazy boundary the source asks
// for. `minify` matches what every Vite-built package in this repo already
// does; this script predates that convention and never adopted it.
//
// The `NODE_ENV` define and the `production` condition are Bun's production
// resolution for every module the plugin does not rewrite. The define alone
// drops the `development` export condition without adding `production`, which
// leaves esm-env on its runtime `process.env` probe.
const result = await Bun.build({
	entrypoints: entries.map((entry) => entry.generated),
	target: "browser",
	format: "esm",
	splitting: true,
	minify: true,
	define: {
		DEV: "false",
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	conditions: ["production"],
	plugins: [dropSvelteDevImport],
	external: externals,
	outdir: distComponents,
	naming: {
		entry: "[name].custom-element.js",
		chunk: "chunks/[name]-[hash].js",
	},
});
if (!result.success) {
	for (const log of result.logs) console.error(log);
	throw new Error(
		"[build-ce-components] bundling the toolkit custom elements failed",
	);
}

for (const entry of entries) {
	rmSync(entry.generated, { force: true });
}

// Remove stale copied Svelte sources from older build strategy.
for (const staleFile of [
	"ItemToolBar.svelte",
	"PieAssessmentToolkit.svelte",
	"SectionToolBar.svelte",
]) {
	const stalePath = path.join(distComponents, staleFile);
	if (existsSync(stalePath)) {
		rmSync(stalePath);
	}
}

console.log(
	"[build-ce-components] built toolkit custom elements to dist/components",
);
