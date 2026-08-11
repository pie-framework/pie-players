#!/usr/bin/env node
/**
 * Refuse to publish while any publishable package has no recorded trusted-publisher claim.
 *
 * Versioning is fixed (see .changeset/config.json), so a release publishes every package
 * together and npm authenticates the run as a whole. A package with no trusted publisher
 * fails that run with ENEEDAUTH while its siblings succeed, which leaves the registry split
 * across two versions and git holding a version that was only partly published. That is not
 * hypothetical: the 0.3.61 release published @pie-players/pie-theme and failed the other 35
 * packages, because only pie-theme had been configured.
 *
 * Nothing in CI could have caught it. The credential preflight (check-npm-auth.mjs) is
 * gated to token mode by design — OIDC has no credential to check — and asking npm whether
 * a record exists costs a 2FA round trip per package, so it cannot run on a runner at all.
 * The gap this closes is therefore specifically the *newly added* package: claiming a record
 * is a manual step that is easy to forget, and the next release is where you find out.
 *
 * So the claim is recorded in a committed ledger (scripts/trusted-publishers.json), written
 * by configure-trusted-publishers.mjs when npm confirms a record, and this check asserts the
 * ledger covers every package a release would publish.
 *
 * What this does and does not prove:
 *
 * - It proves nobody added a publishable package without going through the claim step.
 * - It does not prove npm's current state. The ledger is a record of what npm confirmed at
 *   claim time, not a live read; a revoked record, or an entry someone hand-wrote, passes
 *   here and still fails the release. `--verify` on the configure script is the live check,
 *   and check-provenance.mjs is the after-the-fact one.
 *
 * Scoping: the check is fatal only for packages published by the workflow being verified,
 * which defaults to release.yml. Not every publishable package ships on the release path —
 * @pie-players/pie-preloaded-player is published by publish-preloaded-player.yml on its own
 * version scheme — and failing a release for an unclaimed package that release does not
 * publish blocks it on work that cannot affect it. Out-of-scope gaps are still reported, so
 * they stay visible to whoever owns that workflow; `--all` makes every package fatal.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
	publishablePackages,
	readLedger,
	repositorySlug,
	LEDGER_RELATIVE_PATH,
	RELEASE_WORKFLOW,
} from "./lib/trusted-publishers.mjs";

const ROOT = process.cwd();

/**
 * Compare the packages a release would publish against the recorded claims.
 *
 * `scope` is the workflow whose publish run is being guarded; problems with packages owned
 * by another workflow are returned as `advisories` rather than `failures`. Pass `null` to
 * treat every package as in scope.
 *
 * Pure, so the failure vocabulary can be tested without a workspace on disk.
 */
export function collectTrustedPublisherFailures({
	packages,
	ledger,
	slug,
	scope = null,
}) {
	const failures = [];
	const advisories = [];
	const unclaimed = [];
	for (const { name, workflow } of packages) {
		const inScope = scope === null || workflow === scope;
		const report = inScope ? failures : advisories;
		const entry = ledger.packages?.[name];
		if (!entry) {
			if (inScope) unclaimed.push(name);
			report.push(
				`${name}: no trusted publisher claim recorded in ${LEDGER_RELATIVE_PATH} — publishing will fail with ENEEDAUTH`,
			);
			continue;
		}
		// npm permits exactly one trusted publisher per package, so naming the wrong workflow
		// does not merely fail, it occupies the slot the right workflow needs.
		if (entry.workflow !== workflow) {
			report.push(
				`${name}: claim names workflow ${JSON.stringify(entry.workflow)}, but this package is published by ${JSON.stringify(workflow)}`,
			);
		}
		if (slug && entry.repository !== slug) {
			report.push(
				`${name}: claim names repository ${JSON.stringify(entry.repository)}, expected ${JSON.stringify(slug)}`,
			);
		}
	}
	return { failures, advisories, unclaimed };
}

/**
 * Split unclaimed packages by whether the registry knows their name, because the remedy differs
 * and only one of the two is possible.
 *
 * `npm trust github` attaches a record to an existing package and fails with `E404 Package not
 * found` otherwise, so a package that has never been published cannot be claimed at all — it has
 * to be published once by hand first. This check used to print the claim command for both cases,
 * which sent anyone adding a new package to a command that cannot succeed.
 *
 * `isPublished(name)` is supplied by the caller so the routing can be asserted without a registry.
 */
export function partitionUnclaimedByRegistry({ unclaimed, isPublished }) {
	const needsBootstrap = [];
	const needsClaim = [];
	for (const name of unclaimed) {
		(isPublished(name) ? needsClaim : needsBootstrap).push(name);
	}
	return { needsBootstrap, needsClaim };
}

/**
 * Does the registry know this package name?
 *
 * Only reached on the failure path, for the handful of unclaimed packages, so the cost is a
 * couple of unauthenticated reads on a run that is already failing. A read that fails for any
 * reason other than a 404 answers "yes", which routes to the claim command: that is the
 * conservative direction, since suggesting a bootstrap publish for a package that already exists
 * is the more expensive mistake.
 */
function registryKnows(name) {
	const res = spawnSync("npm", ["view", name, "version", "--json"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (res.status === 0) return true;
	const detail = `${res.stdout ?? ""}${res.stderr ?? ""}`;
	return !/E404|404 Not Found/.test(detail);
}

/** Ledger entries for packages this repo no longer publishes. Reported, never fatal. */
export function collectStaleClaims({ packages, ledger }) {
	const names = new Set(packages.map((p) => p.name));
	return Object.keys(ledger.packages ?? {}).filter((n) => !names.has(n));
}

const isEntrypoint =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
	const rootManifestPath = path.join(ROOT, "package.json");
	if (!existsSync(rootManifestPath)) {
		console.error(
			"[check-trusted-publishers] run from the repository root (package.json not found).",
		);
		process.exit(1);
	}
	const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));
	const slug = repositorySlug(rootManifest);
	const packages = publishablePackages(ROOT, rootManifest, readdirSync);
	const ledger = readLedger(ROOT);

	// Default to the release path rather than every package: this runs from release.yml and
	// from verify:publish, and a package another workflow owns must not fail either.
	const scope = process.argv.includes("--all") ? null : RELEASE_WORKFLOW;
	const scoped = packages.filter(
		(p) => scope === null || p.workflow === scope,
	).length;

	const { failures, advisories, unclaimed } = collectTrustedPublisherFailures({
		packages,
		ledger,
		slug,
		scope,
	});
	const stale = collectStaleClaims({ packages, ledger });

	for (const name of stale) {
		console.log(
			`[check-trusted-publishers] note: ${name} has a recorded claim but is no longer published by this repo`,
		);
	}

	// Reported, not fatal: another workflow publishes these, so they cannot break this run,
	// but they will break that one. Surfacing them here is the only place anyone looks.
	for (const advisory of advisories) {
		console.log(
			`[check-trusted-publishers] note (other workflow): ${advisory}`,
		);
	}

	if (failures.length > 0) {
		console.error(
			`[check-trusted-publishers] Found ${failures.length} trusted-publisher problem(s) across ${scoped} package(s) published by ${scope ?? "any workflow"}`,
		);
		for (const failure of failures) console.error(`  - ${failure}`);
		if (unclaimed.length > 0) {
			const { needsBootstrap, needsClaim } = partitionUnclaimedByRegistry({
				unclaimed,
				isPublished: registryKnows,
			});

			if (needsClaim.length > 0) {
				console.error(
					`\n  Claim the missing record(s) from a local terminal (one OTP each), which records them in ${LEDGER_RELATIVE_PATH}:\n` +
						`    npm login\n` +
						`    bun run trusted-publishers -- --apply --only ${needsClaim.join(",")}\n` +
						"\n  Then commit the updated ledger. See docs/setup/publishing.md.",
				);
			}

			// A name npm has never seen cannot be claimed: `npm trust` has nothing to attach to.
			// One interactive publish creates it, after which the claim is possible and every
			// later version ships through this workflow.
			for (const name of needsBootstrap) {
				console.error(
					`\n  ${name} has never been published, so it cannot be claimed yet — a trusted\n` +
						"  publisher attaches to an existing package. Bootstrap it once from a local\n" +
						"  terminal (publishes, then claims, then writes the ledger):\n" +
						`    npm login\n` +
						`    bun run bootstrap-package -- --only ${name} --dry-run\n` +
						`    bun run bootstrap-package -- --only ${name}\n` +
						"\n  Then commit the updated ledger. See docs/setup/publishing.md.",
				);
			}
		}
		process.exit(1);
	}

	console.log(
		`[check-trusted-publishers] OK: ${scoped} package(s) published by ${scope ?? "any workflow"} have a recorded trusted-publisher claim`,
	);
}
