#!/usr/bin/env node
/**
 * Configure npm trusted publishers (OIDC) for every publishable package in this repo.
 *
 * The npm docs for trusted publishers present the npm website as the only way to set
 * this up. That is out of date: npm 12 ships `npm trust`, so it is scriptable.
 *
 *   npm trust github <pkg> --file <workflow> --repository <owner/repo> \
 *                          --allow-publish --allow-stage-publish
 *   npm trust list <pkg>
 *   npm trust revoke <pkg> --id=<trust-id>
 *
 * The package list is derived from the workspace rather than hardcoded. Versioning for
 * the workspace packages is "fixed" (see .changeset/config.json), so every release
 * publishes all of them together — a package missing a trusted publisher means a partial
 * release, and a stale hardcoded list is exactly how that would happen unnoticed.
 *
 * Usage (from the repo root):
 *   node scripts/configure-trusted-publishers.mjs             # dry run, changes nothing
 *   node scripts/configure-trusted-publishers.mjs --apply     # configure
 *   node scripts/configure-trusted-publishers.mjs --verify    # assert config, per package
 *   node scripts/configure-trusted-publishers.mjs --apply --only @pie-players/pie-theme
 *   node scripts/configure-trusted-publishers.mjs --apply --only pkg-a,pkg-b
 *
 * --verify parses `npm trust list --json` and asserts each package is bound to this
 * repository and its release workflow. It does not treat a successful read as a pass:
 * npm exits 0 and prints an empty list for a package with no trusted publisher at all,
 * so exit status alone reports an entirely unconfigured repo as healthy. That mistake
 * shipped once — a "37/37 verified" run was followed by a release in which 35 of 36
 * packages failed with ENEEDAUTH, because only the one hand-configured package had a
 * publisher.
 *
 * Requirements:
 * - npm >= 12, which itself requires Node ^22.22.2 || ^24.15.0 || >=26.0.0. npm only
 *   warns on older Node, but this writes security configuration to a production account,
 *   so an unsupported runtime is treated as an error.
 * - An authenticated npm session (`npm login`). This script never handles credentials.
 * - Both reading and writing trusted publisher config are 2FA-protected, and npm does
 *   not reuse the authentication between invocations, so expect an OTP prompt per
 *   package. Per npm's 2026-07-08 changelog, tokens that bypass 2FA lose the ability to
 *   change trusted publishing configuration from early August 2026, so this is
 *   necessarily interactive rather than token-driven.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();

/** The workflow that publishes the fixed-versioned workspace packages. */
const RELEASE_WORKFLOW = "release.yml";

/**
 * Packages that a release publishes but that are not workspace members, mapped to the
 * workflow that owns them.
 *
 * `@pie-players/pie-preloaded-player` is generated at build time by the CLI from the
 * manifests in configs/preloaded-player/ (see tools/cli/src/utils/pie-packages/
 * fixed-static.ts), so there is no package.json in the workspace to discover it from. It
 * also carries its own version scheme — `{loaderVersion}-{configHash}.{iteration}` —
 * independent of the fixed workspace version.
 *
 * npm permits exactly ONE trusted publisher per package, so the workflow named here must
 * be the only one that publishes it. publish-preloaded-player.yml is that workflow (see
 * docs/preloaded-player/readme.md); the release path deliberately no longer publishes it.
 */
const NON_WORKSPACE_PACKAGES = {
	"@pie-players/pie-preloaded-player": "publish-preloaded-player.yml",
};

/**
 * This is a local, one-time operator tool — never a CI step.
 *
 * Two reasons it cannot work in Actions:
 *
 * 1. Every `npm trust` operation, read or write, is 2FA-protected and prompts for an OTP
 *    (npm does not reuse the authentication between invocations). There is no one to
 *    answer that on a runner.
 * 2. Per npm's 2026-07-08 changelog, tokens that bypass 2FA lose the ability to change
 *    trusted publishing configuration from early August 2026, so a token cannot stand in
 *    for the human either.
 *
 * That is also why it does not need to run in CI: configuring a trusted publisher happens
 * once per package, after which the release workflow publishes via OIDC using the
 * short-lived id-token GitHub mints for it — no npm credentials and no `npm trust` calls
 * are involved in a release.
 *
 * Failing loudly here beats failing halfway through the package list at an invisible
 * prompt.
 */
if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
	console.error(
		"\n[trusted-publishers] this script is interactive and must not run in CI.\n" +
			"  Every `npm trust` operation requires a one-time password, and from early August 2026\n" +
			"  tokens that bypass 2FA can no longer change trusted publishing configuration.\n" +
			"  Configure trusted publishers once from a local terminal; releases then publish via\n" +
			"  OIDC without any npm credentials.",
	);
	process.exit(1);
}

function fail(msg, extra) {
	console.error(`\n[trusted-publishers] ${msg}`);
	if (extra) console.error(extra);
	process.exit(1);
}

const mode = process.argv.includes("--apply")
	? "apply"
	: process.argv.includes("--verify")
		? "verify"
		: "dry-run";

/**
 * --only <pkg>[,<pkg>...] limits the run to the named packages.
 *
 * This exists because `--dry-run` is not the rehearsal it appears to be: `npm trust
 * github --dry-run` exits 0 even for a package that does not exist, so a clean dry run
 * across every package proves the command lines are well-formed and nothing more. It
 * does not prove the packages exist, that you hold permission on them, or that npm will
 * accept the configuration.
 *
 * Configuration, unlike publishing, can be done incrementally — so the real rehearsal is
 * to apply to one package and read it back:
 *
 *   node scripts/configure-trusted-publishers.mjs --apply  --only @pie-players/pie-theme
 *   node scripts/configure-trusted-publishers.mjs --verify --only @pie-players/pie-theme
 *
 * A list is accepted because every `npm trust` call needs its own 2FA round trip, so a
 * partially-configured repo has to be finishable without paying for the packages that are
 * already done.
 */
const onlyIndex = process.argv.indexOf("--only");
const onlyArg = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;
if (onlyIndex !== -1 && (!onlyArg || onlyArg.startsWith("--"))) {
	fail("--only requires a package name, e.g. --only @pie-players/pie-theme");
}
const only = onlyArg
	? onlyArg
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
	: null;

const rootManifestPath = path.join(ROOT, "package.json");
if (!existsSync(rootManifestPath))
	fail("run from the repository root (package.json not found).");
const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

/** owner/repo, taken from repository.url so it cannot drift from what npm validates. */
function repositorySlug() {
	const url = rootManifest.repository?.url ?? "";
	const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
	if (!m)
		fail(
			`could not parse owner/repo from repository.url: ${JSON.stringify(url)}`,
		);
	return `${m[1]}/${m[2]}`;
}

/**
 * Every package a release publishes, as { name, workflow } pairs.
 *
 * Workspace members are discovered from the workspace globs so the list cannot go stale;
 * NON_WORKSPACE_PACKAGES covers the build-time-generated ones that have no manifest to
 * discover.
 */
function publishablePackages() {
	const found = [];
	for (const entry of rootManifest.workspaces ?? []) {
		if (!entry.endsWith("/*")) continue;
		const base = path.join(ROOT, entry.slice(0, -2));
		if (!existsSync(base)) continue;
		for (const dir of readdirSync(base, { withFileTypes: true })) {
			if (!dir.isDirectory()) continue;
			const manifestPath = path.join(base, dir.name, "package.json");
			if (!existsSync(manifestPath)) continue;
			const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (pkg.private || !pkg.name) continue;
			found.push({ name: pkg.name, workflow: RELEASE_WORKFLOW });
		}
	}
	for (const [name, workflow] of Object.entries(NON_WORKSPACE_PACKAGES)) {
		found.push({ name, workflow });
	}
	return found.sort((a, b) => a.name.localeCompare(b.name));
}

function nodeSupportsNpm12(version) {
	const [maj, min] = version.replace(/^v/, "").split(".").map(Number);
	return (maj === 22 && min >= 22) || (maj === 24 && min >= 15) || maj >= 26;
}

if (!nodeSupportsNpm12(process.version)) {
	fail(
		`this script needs a Node that npm 12 supports (^22.22.2 || ^24.15.0 || >=26.0.0); running ${process.version}.`,
		"Install one (e.g. `nvm install 24.15.0`) and re-run with it.",
	);
}

/**
 * Resolve an npm >= 12 without touching the globally installed npm.
 *
 * `npm trust` needs npm 12, but npm 12 also changes install-time defaults (dependency
 * lifecycle scripts, git deps and remote tarballs are all off by default). Forcing a
 * global upgrade just to run a one-off configuration task would push that change onto
 * everything else on the machine, so npm 12 is bootstrapped into a temp prefix and
 * invoked directly instead.
 */
function resolveNpm12() {
	const local = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
	if (Number(local.split(".")[0]) >= 12)
		return { argv: ["npm"], version: local };

	const prefix = path.join(os.tmpdir(), "pie-players-npm12");
	const cli = path.join(prefix, "node_modules", "npm", "bin", "npm-cli.js");
	if (!existsSync(cli)) {
		console.log(
			`bootstrapping npm@^12 into ${prefix} (global npm ${local} left untouched) ...`,
		);
		mkdirSync(prefix, { recursive: true });
		const res = spawnSync(
			"npm",
			["install", "npm@^12", "--silent", "--no-audit", "--no-fund"],
			{
				cwd: prefix,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		if (res.status !== 0 || !existsSync(cli)) {
			fail(
				"failed to bootstrap npm@^12.",
				`${res.stdout ?? ""}${res.stderr ?? ""}`,
			);
		}
	}
	const version = execFileSync(process.execPath, [cli, "--version"], {
		encoding: "utf8",
	}).trim();
	return { argv: [process.execPath, cli], version };
}

const { argv: NPM, version: npmVersion } = resolveNpm12();
if (Number(npmVersion.split(".")[0]) < 12) {
	fail(
		`resolved npm ${npmVersion}, which does not provide \`npm trust\`; npm >= 12 is required.`,
	);
}

/**
 * Run the resolved npm 12.
 *
 * Three stdio shapes, because 2FA constrains what may be captured:
 *
 * - `interactive: true` inherits all three streams. Required for writes: npm asks for
 *   confirmation and an OTP and waits for input.
 * - `captureStdout: true` inherits stdin and stderr but pipes stdout. npm 12 splits these
 *   cleanly — the `--json` payload goes to stdout, while the 2FA prompt ("Press ENTER to
 *   open in the browser...") and the auth URL go to stderr. So the prompt still reaches
 *   the terminal and ENTER still works, and the payload is still parseable. Verified
 *   against npm 12.0.2.
 * - default pipes both, for non-interactive reads like `whoami`.
 */
function npm(args, { interactive = false, captureStdout = false } = {}) {
	const stdio = interactive
		? "inherit"
		: captureStdout
			? ["inherit", "pipe", "inherit"]
			: ["inherit", "pipe", "pipe"];
	return spawnSync(NPM[0], [...NPM.slice(1), ...args], {
		encoding: "utf8",
		stdio,
	});
}

/**
 * The trusted-publisher record `npm trust list --json` reports for a package, or null.
 *
 * npm exits 0 and prints an empty list for a package with no trusted publisher, so the
 * exit status says only "the read worked" — it is not evidence that publishing will
 * authenticate. An earlier version of this script equated the two and reported a
 * fully-unconfigured repo as verified; the resulting release published exactly the one
 * package that had been configured by hand and failed the other 35 with ENEEDAUTH.
 */
function readTrustRecord(pkg) {
	const res = npm(["trust", "list", pkg, "--json"], { captureStdout: true });
	const raw = (res.stdout ?? "").trim();
	if (res.status !== 0) {
		let detail = raw;
		try {
			detail = JSON.parse(raw)?.error?.summary ?? raw;
		} catch {}
		return { error: detail || `npm exited ${res.status}` };
	}
	let doc;
	try {
		doc = raw ? JSON.parse(raw) : null;
	} catch {
		return { error: `could not parse npm output: ${raw.slice(0, 200)}` };
	}
	// npm has shipped both a bare array and an object wrapper here; accept either, and
	// tolerate a single object, rather than depending on one undocumented shape.
	const list = Array.isArray(doc)
		? doc
		: Array.isArray(doc?.publishers)
			? doc.publishers
			: doc && typeof doc === "object" && doc.type
				? [doc]
				: [];
	return { records: list.filter((r) => r?.type === "github") };
}

/**
 * Is `record` bound to this repo's release workflow?
 *
 * Deliberately checks repository and workflow file only. `permissions` is reported
 * verbatim instead of being asserted: npm's permission vocabulary here is undocumented
 * and observably inconsistent (records this account already holds from other repos read
 * back as `["createPackage"]`, which is not a string `--allow-publish` obviously produces),
 * so asserting on it would risk failing a record that publishes fine. A publish is the
 * only authoritative test of publish rights; this function's job is to catch the two
 * failure modes a publish cannot recover from — no record at all, and a record pointing at
 * a different repository or workflow.
 */
function recordMatches(record, workflow) {
	return record.repository === slug && record.file === workflow;
}

function describeRecord(record) {
	const perms = Array.isArray(record.permissions)
		? record.permissions.join(",")
		: "?";
	return `${record.repository} :: ${record.file} [${perms}]`;
}

const whoami = npm(["whoami"]);
if (whoami.status !== 0) {
	fail(
		"not authenticated to npm. Run `npm login` first (this script does not handle credentials).",
		`${whoami.stdout ?? ""}${whoami.stderr ?? ""}`.trim(),
	);
}
const user = (whoami.stdout ?? "").trim();

const slug = repositorySlug();
const allPackages = publishablePackages();
if (allPackages.length === 0) fail("no publishable packages found.");

let packages = allPackages;
if (only) {
	const unknown = only.filter((n) => !allPackages.some((p) => p.name === n));
	if (unknown.length > 0) {
		fail(
			`--only named ${unknown.length === 1 ? "a package" : "packages"} this repo does not publish: ${unknown.join(", ")}`,
			`Known packages:\n${allPackages.map((p) => `  ${p.name}`).join("\n")}`,
		);
	}
	packages = allPackages.filter((p) => only.includes(p.name));
}

const workflows = [...new Set(packages.map((p) => p.workflow))].sort();

console.log(`node: ${process.version}   npm: ${npmVersion}   user: ${user}`);
console.log(`repo: ${slug}   workflows: ${workflows.join(", ")}`);
console.log(
	`mode: ${mode}   packages: ${packages.length}${only ? ` (--only ${only})` : ""}`,
);

if (mode === "dry-run") {
	console.log(
		"\n  note: `npm trust github --dry-run` exits 0 even for a nonexistent package, so a\n" +
			"  clean dry run confirms the arguments are well-formed, not that the configuration\n" +
			"  would be accepted. Rehearse with: --apply --only <pkg>, then --verify --only <pkg>.",
	);
}
if (mode === "apply") {
	console.log(
		`\n  note: trusted publishing means anyone who can write to ${slug} and trigger\n` +
			`  ${workflows.join(" / ")} can publish these packages. Consider gating the release job\n` +
			"  behind a protected GitHub Environment (npm trust github --environment <name>) if\n" +
			"  that is broader than you want. The environment forms part of each trusted-publisher\n" +
			"  record, so adopting it later means reconfiguring every package.",
	);
}
console.log("");

let ok = 0;
const problems = [];
/** Packages --verify found to have no publisher at all, i.e. the ones --apply can fix. */
const unconfigured = [];

for (const { name: pkg, workflow } of packages) {
	// Every `npm trust` call is 2FA-protected and npm does not carry the authentication
	// across invocations — an apply and a list seven minutes apart each demanded their own
	// OTP — so expect one auth round trip per package in both apply and verify.
	if (mode === "verify") {
		console.log(`\n  --- ${pkg}  (expecting ${slug} :: ${workflow})`);
		const { records, error } = readTrustRecord(pkg);
		if (error) {
			console.log(`  ${pkg.padEnd(52)} READ FAILED`);
			problems.push([pkg, error]);
			continue;
		}
		const match = records.find((r) => recordMatches(r, workflow));
		if (match) {
			console.log(`  ${pkg.padEnd(52)} CONFIGURED  ${describeRecord(match)}`);
			ok++;
		} else if (records.length > 0) {
			// npm permits only ONE trusted publisher per package, so a record bound to some
			// other repo/workflow is not merely wrong, it occupies the slot this repo needs.
			console.log(`  ${pkg.padEnd(52)} WRONG TARGET`);
			problems.push([
				pkg,
				`trusted publisher points elsewhere: ${records.map(describeRecord).join("; ")} — ` +
					"npm allows one publisher per package, so the existing record must be revoked " +
					`(\`${NPM.join(" ")} trust revoke ${pkg} <id>\`) before this repo can claim it`,
			]);
		} else {
			console.log(`  ${pkg.padEnd(52)} NOT CONFIGURED`);
			problems.push([
				pkg,
				"no trusted publisher — publishing from CI will fail with ENEEDAUTH; run --apply",
			]);
			unconfigured.push(pkg);
		}
		continue;
	}

	const args = [
		"trust",
		"github",
		pkg,
		"--file",
		workflow,
		"--repository",
		slug,
		"--allow-publish",
		"--allow-stage-publish",
		"--yes",
		...(mode === "dry-run" ? ["--dry-run"] : []),
	];

	if (mode === "apply") {
		console.log(`\n  --- ${pkg}  (${workflow})`);
		const res = npm(args, { interactive: true });
		if (res.status === 0) {
			console.log(`  ${pkg.padEnd(52)} configured`);
			ok++;
		} else {
			console.log(`  ${pkg.padEnd(52)} FAILED (exit ${res.status})`);
			problems.push([
				pkg,
				"see npm output above — note npm permits only ONE trusted publisher per package, " +
					`so this is expected if it was already configured; confirm with: ${NPM.join(" ")} trust list ${pkg}`,
			]);
		}
		continue;
	}

	const res = npm(args);
	const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
	if (res.status === 0) {
		console.log(`  ${pkg.padEnd(52)} dry-run ok  (${workflow})`);
		ok++;
	} else {
		console.log(`  ${pkg.padEnd(52)} FAILED`);
		problems.push([pkg, out.trim().split("\n").slice(0, 3).join(" | ")]);
	}
}

console.log(`\n  ok: ${ok}/${packages.length}   problems: ${problems.length}`);
for (const [pkg, why] of problems) console.log(`    ${pkg}: ${why}`);

if (unconfigured.length > 0) {
	console.log(
		`\n  to configure the ${unconfigured.length} package(s) with no publisher:\n` +
			`    bun run trusted-publishers -- --apply --only ${unconfigured.join(",")}`,
	);
}

if (mode === "apply" && problems.length === 0) {
	console.log(
		"\n  next: re-run with --verify, then delete the NPM_TOKEN repo secret so the",
	);
	console.log(
		"  release workflow's `auto` auth mode resolves to oidc instead of token.",
	);
}

process.exit(problems.length === 0 ? 0 : 1);
