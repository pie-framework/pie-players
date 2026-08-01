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
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
	publishablePackages,
	readLedger,
	repositorySlug,
	LEDGER_RELATIVE_PATH,
} from "./lib/trusted-publishers.mjs";

const ROOT = process.cwd();

/**
 * Compare the packages a release would publish against the recorded claims.
 *
 * Pure, so the failure vocabulary can be tested without a workspace on disk.
 */
export function collectTrustedPublisherFailures({ packages, ledger, slug }) {
	const failures = [];
	const unclaimed = [];
	for (const { name, workflow } of packages) {
		const entry = ledger.packages?.[name];
		if (!entry) {
			unclaimed.push(name);
			failures.push(
				`${name}: no trusted publisher claim recorded in ${LEDGER_RELATIVE_PATH} — publishing will fail with ENEEDAUTH`,
			);
			continue;
		}
		// npm permits exactly one trusted publisher per package, so naming the wrong workflow
		// does not merely fail, it occupies the slot the right workflow needs.
		if (entry.workflow !== workflow) {
			failures.push(
				`${name}: claim names workflow ${JSON.stringify(entry.workflow)}, but this package is published by ${JSON.stringify(workflow)}`,
			);
		}
		if (slug && entry.repository !== slug) {
			failures.push(
				`${name}: claim names repository ${JSON.stringify(entry.repository)}, expected ${JSON.stringify(slug)}`,
			);
		}
	}
	return { failures, unclaimed };
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

	const { failures, unclaimed } = collectTrustedPublisherFailures({
		packages,
		ledger,
		slug,
	});
	const stale = collectStaleClaims({ packages, ledger });

	for (const name of stale) {
		console.log(
			`[check-trusted-publishers] note: ${name} has a recorded claim but is no longer published by this repo`,
		);
	}

	if (failures.length > 0) {
		console.error(
			`[check-trusted-publishers] Found ${failures.length} trusted-publisher problem(s) across ${packages.length} publishable package(s)`,
		);
		for (const failure of failures) console.error(`  - ${failure}`);
		if (unclaimed.length > 0) {
			console.error(
				`\n  Claim the missing record(s) from a local terminal (one OTP each), which records them in ${LEDGER_RELATIVE_PATH}:\n` +
					`    npm login\n` +
					`    bun run trusted-publishers -- --apply --only ${unclaimed.join(",")}\n` +
					"\n  Then commit the updated ledger. See docs/setup/publishing.md.",
			);
		}
		process.exit(1);
	}

	console.log(
		`[check-trusted-publishers] OK: ${packages.length} publishable package(s) have a recorded trusted-publisher claim`,
	);
}
