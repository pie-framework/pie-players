#!/usr/bin/env bun
/**
 * Rebuilds the vendored NDS icon button from an NDS source checkout.
 *
 *   bun run sync:nds-icon-button -- --source <path to the NDS checkout> [--ref vX.Y.Z]
 *
 * NDS publishes to a private registry the public `@pie-players/*` chain cannot
 * depend on, so `players-shared` carries a pre-built copy
 * (`packages/players-shared/src/components/vendor/nds/`). This script is the only
 * way that copy changes: it builds one tagged release with this repository's own
 * Vite and `lit`, applies PIE's patches, and records the release in the vendor
 * README. The source checkout is read through `git archive`, so its working tree
 * is never touched, and nothing from it is installed or run: no package install,
 * no config file, no PostCSS config, no plugin. Only the component's TypeScript is
 * compiled.
 *
 * Every patch asserts how many times its target occurs, so an upstream change
 * that moves one fails the sync instead of shipping an unpatched bundle.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(
	repoRoot,
	"packages/players-shared/src/components/vendor/nds",
);
const bundlePath = join(vendorDir, "nds-icon-button.js");
const readmePath = join(vendorDir, "README.md");

const UPSTREAM_TAG = "nds-icon-button";
const PIE_TAG = "pie-nds-icon-button";
const ENTRY = "web-components/src/components/icon-button/nds-icon-button.ts";

/**
 * Applies PIE's patches to a freshly built bundle and returns the result.
 *
 * - The registered tag becomes `pie-nds-icon-button`, so a host page that also
 *   loads NDS (and registers upstream's `nds-icon-button`, often at another
 *   version) never collides with this copy.
 * - The element selector in `render()`'s inline `<style>` follows the tag.
 *
 * Upstream's `defineElement` already skips a tag that is defined, so the define
 * guard earlier copies needed is no longer a patch.
 */
export function applyPiePatches(source) {
	let out = source;
	out = replaceExactly(
		out,
		new RegExp(`(\\w+\\()(["'\`])${UPSTREAM_TAG}\\2(\\))`, "g"),
		`$1$2${PIE_TAG}$2$3`,
		1,
		"the tag passed to the element's define decorator",
	);
	out = replaceExactly(
		out,
		new RegExp(`(^|[\\s>}])${UPSTREAM_TAG}(\\s*\\{)`, "gm"),
		`$1${PIE_TAG}$2`,
		1,
		"the element selector in render()'s inline <style>",
	);
	return out;
}

function replaceExactly(source, pattern, replacement, expected, what) {
	const count = source.match(pattern)?.length ?? 0;
	if (count !== expected) {
		throw new Error(
			`[sync-nds] expected ${expected} occurrence(s) of ${what}, found ${count}; upstream changed shape, so update the patch in scripts/sync-nds-icon-button.mjs`,
		);
	}
	return source.replace(pattern, replacement);
}

/** Rewrites the provenance rows of the vendor README for `release` at `commit`. */
export function updateProvenance(readme, { release, commit, lit }) {
	let out = readme;
	out = replaceExactly(
		out,
		/^\| Release \| .* \|$/m,
		`| Release | \`${release}\` |`,
		1,
		"the README's Release row",
	);
	out = replaceExactly(
		out,
		/^\| Source commit \| .* \|$/m,
		`| Source commit | \`${commit}\` |`,
		1,
		"the README's Source commit row",
	);
	out = replaceExactly(
		out,
		/^\| Inlined Lit \| .* \|$/m,
		`| Inlined Lit | \`${lit}\` |`,
		1,
		"the README's Inlined Lit row",
	);
	return out;
}

function parseArgs(argv) {
	const args = { source: process.env.NDS_SOURCE, ref: undefined };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--source") args.source = argv[++i];
		else if (arg === "--ref") args.ref = argv[++i];
		else if (arg === "--") continue;
		else throw new Error(`[sync-nds] unknown argument: ${arg}`);
	}
	if (!args.source) {
		throw new Error(
			"[sync-nds] pass --source <path to the NDS component library checkout> (or set NDS_SOURCE)",
		);
	}
	return args;
}

function git(source, ...args) {
	return execFileSync("git", ["-C", source, ...args], {
		encoding: "utf8",
	}).trim();
}

/** The newest plain release tag (vX.Y.Z, no prerelease) in the checkout. */
function latestReleaseTag(source) {
	const tags = git(source, "tag", "-l", "v*")
		.split("\n")
		.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
	if (tags.length === 0) {
		throw new Error("[sync-nds] the checkout has no vX.Y.Z release tags; fetch them or pass --ref");
	}
	const key = (tag) => tag.slice(1).split(".").map(Number);
	return tags.sort((a, b) => {
		const [x, y] = [key(a), key(b)];
		return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
	})[tags.length - 1];
}

async function main() {
	const { source: rawSource, ref: requestedRef } = parseArgs(process.argv.slice(2));
	const source = resolve(rawSource);
	const ref = requestedRef ?? latestReleaseTag(source);
	const commit = git(source, "rev-parse", "--short", `${ref}^{commit}`);

	const workDir = mkdtempSync(join(tmpdir(), "pie-nds-sync-"));
	try {
		execFileSync(
			"sh",
			[
				"-c",
				'git -C "$1" archive "$2" web-components | tar -x -C "$3"',
				"sh",
				source,
				ref,
				workDir,
			],
			{ stdio: "inherit" },
		);

		// lit is a devDependency of players-shared, the package that ships the
		// bundle, so its version is this repository's choice and in its lockfile.
		const requireFromShared = createRequire(
			join(repoRoot, "packages/players-shared/package.json"),
		);
		const litDir = dirname(requireFromShared.resolve("lit/package.json"));
		const litVersion = JSON.parse(
			readFileSync(join(litDir, "package.json"), "utf8"),
		).version;

		const { build } = await import("vite");
		const outDir = join(workDir, "out");
		await build({
			configFile: false,
			root: join(workDir, "web-components"),
			logLevel: "warn",
			publicDir: false,
			// An empty PostCSS config stops Vite looking for one in the checkout.
			css: { postcss: {} },
			resolve: {
				alias: [{ find: /^lit(\/.*)?$/, replacement: `${litDir}$1` }],
			},
			build: {
				outDir,
				emptyOutDir: true,
				minify: false,
				lib: {
					entry: join(workDir, ENTRY),
					formats: ["es"],
					fileName: () => "nds-icon-button.js",
				},
				rolldownOptions: { output: { codeSplitting: false } },
			},
		});

		const built = readFileSync(join(outDir, "nds-icon-button.js"), "utf8");
		const header = `/*\n * Vendored NDS icon button, ${ref} (${commit}), built and patched by\n * scripts/sync-nds-icon-button.mjs. Do not edit by hand: rerun the script.\n * See README.md beside this file.\n */\n`;
		writeFileSync(bundlePath, header + applyPiePatches(built));
		writeFileSync(
			readmePath,
			updateProvenance(readFileSync(readmePath, "utf8"), {
				release: ref,
				commit,
				lit: litVersion,
			}),
		);
		console.log(
			`[sync-nds] vendored ${ref} (${commit}) with lit ${litVersion} into ${bundlePath}`,
		);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
