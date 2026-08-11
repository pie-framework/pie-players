#!/usr/bin/env node
/**
 * First publish of a new package: create its name on the npm registry, then claim its trusted
 * publisher.
 *
 * This is the one rung of the release ladder that neither CI nor the other scripts can supply,
 * because npm's trusted publishing is circular for a package that does not exist yet:
 *
 *   - A release authenticates by OIDC, which requires a trusted-publisher record per package.
 *   - `npm trust github` attaches a record to a package on the registry. For a name npm has
 *     never seen it fails with `E404 Package not found` — there is nothing to attach to.
 *
 * So the first publish has to be a credentialed, interactive one, and everything after it is
 * the normal fixed-version release. Before this script the repo documented the reverse order
 * (claim the record, then release), which cannot be carried out; the guard that reports a
 * missing claim pointed at the same impossible command. `@pie-players/pie-tool-sign-language`
 * sat unpublished on develop as a result.
 *
 * Usage, from the repository root:
 *   bun run bootstrap-package -- --only @pie-players/<pkg> --dry-run   # stops before publish
 *   bun run bootstrap-package -- --only @pie-players/<pkg>
 *
 * What it does, in order, stopping at the first problem:
 *
 *   1. Preflight, entirely before anything irreversible: the package is a publishable workspace
 *      member, it is in the changesets fixed group, its version matches the group, npm has never
 *      seen the name, every resolved dependency is installable, and you are logged in.
 *   2. Build the package and its workspace dependencies.
 *   3. Resolve the manifest's `workspace:` ranges, the same way a release does.
 *   4. Show the exact tarball (`npm pack --dry-run`). `--dry-run` stops here.
 *   5. `npm publish`, interactively, so npm can prompt for the OTP.
 *   6. Restore the manifest, whatever happened.
 *   7. Claim the trusted publisher by delegating to configure-trusted-publishers.mjs, which
 *      owns the `npm trust` call and the committed ledger.
 *
 * Requirements: an authenticated npm session (`npm login`) with publish rights on the scope.
 * This script never handles credentials. Tokens are deliberately not used — per npm's
 * 2026-07-08 changelog, tokens that bypass 2FA lost direct-publish rights in early August 2026,
 * so the ambient interactive session is the only path that reliably works.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveManifestWorkspaceRanges } from "./lib/workspace-ranges.mjs";
import {
	publishablePackages,
	repositorySlug,
} from "./lib/trusted-publishers.mjs";

/** Sentinel for a name the registry has never seen. Mirrors check-fixed-versioning.mjs. */
export const UNPUBLISHED = Symbol("unpublished");

/**
 * Everything that disqualifies a package from being bootstrapped, as operator-facing strings.
 *
 * Pure, so the refusal vocabulary can be asserted without a workspace, a registry or an npm
 * session — the same reason check-trusted-publishers.mjs splits its decision out.
 *
 * The published-version check is the load-bearing one. Bootstrapping is defined by the registry
 * not knowing the name; once it does, a second manual publish would put a hand-built tarball
 * under a version the fixed-version release also owns, and the two would disagree about what
 * that version contains.
 */
export function collectBootstrapBlockers({
	target,
	publishableNames,
	fixedSet,
	groupVersions,
	publishedVersion,
}) {
	const blockers = [];

	if (!publishableNames.includes(target)) {
		blockers.push(
			`${target} is not a publishable workspace package. Bootstrapping applies to a package with a manifest under the workspace globs and no \`private: true\`.`,
		);
		// Every check below reads state this package does not have.
		return blockers;
	}

	if (fixedSet.size > 0 && !fixedSet.has(target)) {
		blockers.push(
			`${target} is missing from the changesets \`fixed\` group in .changeset/config.json. Add it before bootstrapping: check:fixed-versioning requires the fixed group and the publishable set to match, so a release would fail on it anyway.`,
		);
	}

	// `groupVersions` covers the packages under fixed versioning and nothing else. Computing this
	// over every workspace manifest reports a false conflict: apps/* and tools/* carry their own
	// versions by design, so the demo app at 0.1.0 would read as a broken group.
	//
	// Only meaningful under fixed versioning at all. A repo that versions its packages
	// independently (pie-elements-ng) has no group version, and differing versions are the
	// correct state there rather than a fault.
	if (fixedSet.size > 0) {
		const distinct = new Set(groupVersions.values());
		if (distinct.size > 1) {
			blockers.push(
				`the fixed-group versions are not uniform (${[...distinct].sort().join(", ")}), so there is no group version to publish at. Fixed versioning requires one; reconcile the manifests first.`,
			);
		}
	}

	if (publishedVersion !== UNPUBLISHED) {
		blockers.push(
			`${target} is already on the registry at ${publishedVersion}. Bootstrapping is only for a name npm has never seen — publish subsequent versions through the release workflow. If the trusted-publisher claim is what is missing, run: bun run trusted-publishers -- --apply --only ${target}`,
		);
	}

	return blockers;
}

/**
 * The subset of workspace versions that fixed versioning governs.
 *
 * Dependency resolution needs every workspace member's version, including `apps/*` and `tools/*`;
 * the uniformity check must see only the fixed group. Conflating the two reports the demo app's
 * own version as a broken group and refuses every bootstrap.
 */
export function narrowToFixedGroup(versions, publishableNames, fixedSet) {
	const publishable = new Set(publishableNames);
	return new Map(
		[...versions].filter(
			([name]) => publishable.has(name) && fixedSet.has(name),
		),
	);
}

/**
 * Resolved dependencies whose versions are not on the registry.
 *
 * A first publish resolves `workspace:*` against the version the workspace holds, which is the
 * group version — and on a long-lived branch that version can be behind what was ever released.
 * Publishing a manifest that pins an unpublished sibling produces a package that resolves for
 * nobody, and the failure surfaces at a consumer's install rather than here.
 *
 * `isPublished(name, range)` answers whether that dependency resolves on the registry; the caller
 * supplies it so this stays pure.
 */
export function collectUninstallableDependencies(resolvedDeps, isPublished) {
	return resolvedDeps
		.filter(({ name, to }) => !isPublished(name, to))
		.map(({ section, name, to }) => ({ section, name, range: to }));
}

const ROOT = process.cwd();

// Importable for the tests that assert the pure helpers above; the operator flow runs only when
// this file is the entrypoint.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main();
}

function fail(msg, extra) {
	console.error(`\n[bootstrap-package] ${msg}`);
	if (extra) console.error(extra);
	process.exit(1);
}

function main() {
	/**
	 * Publishing is interactive by necessity — npm prompts for the OTP — and it is the single
	 * irreversible step in the release system. A runner has nobody to answer the prompt and no
	 * reason to be creating package names, so refuse rather than hang at an invisible prompt.
	 */
	if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
		fail(
			"this script is interactive and must not run in CI.\n" +
				"  A first publish needs an npm session and an OTP. Run it from a local terminal;\n" +
				"  releases thereafter publish via OIDC with no npm credentials.",
		);
	}

	const dryRun = process.argv.includes("--dry-run");

	const onlyIndex = process.argv.indexOf("--only");
	const onlyArg = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;
	if (onlyIndex !== -1 && (!onlyArg || onlyArg.startsWith("--"))) {
		fail("--only requires a package name, e.g. --only @pie-players/pie-tool-x");
	}
	const target = onlyArg;
	if (!target) {
		fail(
			"name the package to bootstrap: --only @pie-players/<pkg>\n" +
				"  One package per run: each first publish is irreversible and needs its own OTP.",
		);
	}
	if (target.includes(",")) {
		fail(
			"bootstrap one package per run. Each first publish is irreversible, and batching them\n" +
				"  would leave a partial set of new names on the registry if one failed.",
		);
	}

	const rootManifestPath = path.join(ROOT, "package.json");
	if (!existsSync(rootManifestPath)) {
		fail("run from the repository root (package.json not found).");
	}
	const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

	const slug = repositorySlug(rootManifest);
	if (!slug) {
		fail(
			`could not parse owner/repo from repository.url: ${JSON.stringify(rootManifest.repository?.url ?? "")}`,
		);
	}

	const workspaceManifests = discoverWorkspaceManifests(rootManifest);
	const versions = new Map(
		workspaceManifests.map(({ manifest }) => [manifest.name, manifest.version]),
	);
	const publishableNames = publishablePackages(
		ROOT,
		rootManifest,
		readdirSync,
	).map((p) => p.name);

	const fixedSet = readFixedGroup();

	const groupVersions = narrowToFixedGroup(
		versions,
		publishableNames,
		fixedSet,
	);

	console.log(`repo: ${slug}   package: ${target}`);
	console.log(`mode: ${dryRun ? "dry-run (stops before publish)" : "publish"}`);

	const entry = workspaceManifests.find(
		({ manifest }) => manifest.name === target,
	);
	const publishedVersion = entry ? fetchPublishedVersion(target) : UNPUBLISHED;

	const blockers = collectBootstrapBlockers({
		target,
		publishableNames,
		fixedSet,
		groupVersions,
		publishedVersion,
	});
	if (blockers.length > 0) {
		fail(
			`cannot bootstrap ${target}:`,
			blockers.map((b) => `  - ${b}`).join("\n"),
		);
	}

	const user = npmWhoami();
	const version = entry.manifest.version;
	console.log(`npm user: ${user}   version to publish: ${version}\n`);

	// Build before touching the manifest: a build failure should leave the checkout untouched.
	console.log(`building ${target} and its workspace dependencies ...`);
	const build = spawnSync("bunx", ["turbo", "build", `--filter=${target}...`], {
		cwd: ROOT,
		stdio: "inherit",
	});
	if (build.status !== 0) {
		fail(`build failed for ${target}; nothing was published.`);
	}

	const original = readFileSync(entry.path, "utf8");

	try {
		const manifest = JSON.parse(original);
		const { resolved, unresolved } = resolveManifestWorkspaceRanges(
			manifest,
			versions,
		);
		if (unresolved.length > 0) {
			fail(
				`${target} has \`workspace:\` ranges that do not name a workspace package:`,
				unresolved
					.map((u) => `  - ${u.section}.${u.name}: ${u.range}`)
					.join("\n"),
			);
		}

		const uninstallable = collectUninstallableDependencies(
			resolved,
			isVersionPublished,
		);
		if (uninstallable.length > 0) {
			fail(
				`${target} would pin dependency versions that are not on the registry, producing a package nobody can install:`,
				`${uninstallable
					.map((d) => `  - ${d.section}.${d.name}@${d.range}`)
					.join("\n")}\n` +
					"  The group version on this branch is behind what has been released. Merge and\n" +
					"  release the branch first, or bootstrap from a branch whose group version is published.",
			);
		}

		if (resolved.length > 0) {
			console.log("\nresolved workspace ranges for publish:");
			for (const r of resolved) {
				console.log(`  ${r.section}.${r.name}: ${r.from} -> ${r.to}`);
			}
			writeFileSync(entry.path, `${JSON.stringify(manifest, null, "\t")}\n`);
		}

		console.log(`\ntarball contents (npm pack --dry-run):`);
		const pack = spawnSync("npm", ["pack", "--dry-run"], {
			cwd: path.dirname(entry.path),
			encoding: "utf8",
			stdio: ["inherit", "pipe", "inherit"],
		});
		if (pack.status !== 0) {
			fail("npm pack --dry-run failed; nothing was published.");
		}

		if (dryRun) {
			console.log(
				`\n  dry run: ${target}@${version} was not published and the manifest is restored.\n` +
					`  To publish for real: bun run bootstrap-package -- --only ${target}`,
			);
			return;
		}

		console.log(
			`\npublishing ${target}@${version} to the public registry. This is irreversible:\n` +
				"  npm permits unpublishing only within 72 hours, and the name/version pair can\n" +
				"  never be reused. npm will prompt for your OTP.\n",
		);
		const res = spawnSync("npm", ["publish", "--access", "public"], {
			cwd: path.dirname(entry.path),
			stdio: "inherit",
		});
		if (res.status !== 0) {
			fail(
				`npm publish failed for ${target}@${version}; the manifest has been restored.`,
			);
		}
		console.log(`\n  published ${target}@${version}`);
	} finally {
		writeFileSync(entry.path, original);
		console.log("  restored workspace ranges in the manifest");
	}

	/**
	 * Claim the record by delegating rather than reimplementing: configure-trusted-publishers.mjs
	 * owns the npm 12 bootstrap, the 2FA-aware stdio handling and the ledger write, and the guard
	 * asserts against the ledger that script writes. A second implementation here would be a
	 * second thing to keep in step with npm's `trust` surface.
	 */
	console.log(
		`\nclaiming the trusted publisher for ${target} (expect another OTP prompt) ...`,
	);
	const claim = spawnSync(
		process.execPath,
		[
			path.join(ROOT, "scripts", "configure-trusted-publishers.mjs"),
			"--apply",
			"--only",
			target,
		],
		{ cwd: ROOT, stdio: "inherit" },
	);

	if (claim.status !== 0) {
		fail(
			`${target}@${version} is published, but claiming its trusted publisher failed.`,
			"  The name now exists, so the claim will succeed on a retry — this does not need\n" +
				"  another publish:\n" +
				`    bun run trusted-publishers -- --apply  --only ${target}\n` +
				`    bun run trusted-publishers -- --verify --only ${target}`,
		);
	}

	console.log(
		`\n  ${target} is bootstrapped: the name exists and its trusted publisher is claimed.\n\n` +
			"  next:\n" +
			"    1. commit scripts/trusted-publishers.json — check:trusted-publishers reads the\n" +
			"       committed ledger, so an uncommitted claim still fails the release.\n" +
			"    2. bun run check:trusted-publishers   # should pass now\n" +
			"    3. add a changeset and merge to master; the release publishes this package with\n" +
			"       the rest of the group, via OIDC, at the next group version.\n",
	);
}

/** Workspace manifests as { path, manifest }, for the globs the root manifest declares. */
function discoverWorkspaceManifests(rootManifest) {
	const found = [];
	for (const entry of rootManifest.workspaces ?? []) {
		if (!entry.endsWith("/*")) continue;
		const base = path.join(ROOT, entry.slice(0, -2));
		if (!existsSync(base)) continue;
		for (const dir of readdirSync(base, { withFileTypes: true })) {
			if (!dir.isDirectory()) continue;
			const manifestPath = path.join(base, dir.name, "package.json");
			if (!existsSync(manifestPath)) continue;
			try {
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
				if (manifest?.name && manifest?.version) {
					found.push({ path: manifestPath, manifest });
				}
			} catch {
				// Not a package directory.
			}
		}
	}
	return found;
}

/** The changesets fixed group as a set, empty when the repo versions independently. */
function readFixedGroup() {
	const configPath = path.join(ROOT, ".changeset", "config.json");
	if (!existsSync(configPath)) return new Set();
	const config = JSON.parse(readFileSync(configPath, "utf8"));
	const groups = Array.isArray(config.fixed) ? config.fixed : [];
	return new Set(groups.flatMap((g) => (Array.isArray(g) ? g : [])));
}

/**
 * The version the registry reports, or UNPUBLISHED for a name it has never seen.
 *
 * Only a 404 reads as unpublished. A network or auth failure stops the run: "cannot tell" must
 * not be treated as "this is a new package", because that is the reading that leads to a second
 * hand-built publish over a version the release already owns.
 */
function fetchPublishedVersion(pkgName) {
	try {
		const out = execFileSync("npm", ["view", pkgName, "version", "--json"], {
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		const parsed = JSON.parse(out);
		if (typeof parsed === "string") return parsed;
		if (Array.isArray(parsed) && parsed.length > 0) {
			return String(parsed[parsed.length - 1]);
		}
		return UNPUBLISHED;
	} catch (error) {
		const detail = error.stderr?.toString()?.trim() || error.message || "";
		if (/E404|404 Not Found/.test(detail)) return UNPUBLISHED;
		fail(
			`failed to read the published version of ${pkgName} from npm.`,
			detail,
		);
	}
}

/**
 * Does `name@range` resolve to something on the registry?
 *
 * A failed read is reported as not-installable rather than swallowed: the consequence of a wrong
 * "yes" is a published manifest pinning a version that does not exist, which cannot be fixed by
 * republishing the same version.
 */
function isVersionPublished(name, range) {
	const res = spawnSync(
		"npm",
		["view", `${name}@${range}`, "version", "--json"],
		{
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	if (res.status !== 0) return false;
	const raw = (res.stdout ?? "").trim();
	// An unsatisfiable range exits 0 with empty output rather than erroring.
	return raw.length > 0 && raw !== "[]";
}

function npmWhoami() {
	const res = spawnSync("npm", ["whoami"], {
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
	});
	if (res.status !== 0) {
		fail(
			"not authenticated to npm. Run `npm login` first (this script does not handle credentials).",
			`${res.stdout ?? ""}${res.stderr ?? ""}`.trim(),
		);
	}
	return (res.stdout ?? "").trim();
}
