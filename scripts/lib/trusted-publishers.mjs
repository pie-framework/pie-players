/**
 * Shared vocabulary for npm trusted publishers: which packages a release publishes, which
 * workflow owns each one, and the committed ledger of claims npm has confirmed.
 *
 * This exists so that configure-trusted-publishers.mjs (the interactive operator tool that
 * claims records) and check-trusted-publishers.mjs (the CI guard that refuses to release
 * with an unclaimed package) cannot disagree. They are only useful as a pair: the guard's
 * entire job is to assert that every package the configure tool would claim has in fact
 * been claimed. If each derived the package list and the workflow mapping separately, a new
 * entry in NON_WORKSPACE_PACKAGES — or a second publish workflow — would drift them apart,
 * and the guard would pass while the release still failed.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The workflow that publishes the fixed-versioned workspace packages. */
export const RELEASE_WORKFLOW = "release.yml";

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
export const NON_WORKSPACE_PACKAGES = {
	"@pie-players/pie-preloaded-player": "publish-preloaded-player.yml",
};

/** Committed ledger of claims npm has confirmed, relative to the repository root. */
export const LEDGER_RELATIVE_PATH = "scripts/trusted-publishers.json";

export function ledgerPath(root) {
	return path.join(root, LEDGER_RELATIVE_PATH);
}

/**
 * owner/repo, taken from repository.url so it cannot drift from what npm validates.
 *
 * Returns null rather than throwing so callers can report it in their own idiom.
 */
export function repositorySlug(rootManifest) {
	const url = rootManifest.repository?.url ?? "";
	const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
	return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Every package a release publishes, as sorted { name, workflow } pairs.
 *
 * Workspace members are discovered from the workspace globs so the list cannot go stale;
 * NON_WORKSPACE_PACKAGES covers the build-time-generated ones that have no manifest to
 * discover.
 */
export function publishablePackages(root, rootManifest, readdirSync) {
	const found = [];
	for (const entry of rootManifest.workspaces ?? []) {
		if (!entry.endsWith("/*")) continue;
		const base = path.join(root, entry.slice(0, -2));
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

/**
 * Read the ledger, or an empty one if it does not exist yet.
 *
 * The ledger records what npm confirmed, not what someone intended: entries are written
 * only after `npm trust github` exits 0 or `npm trust list` reads the record back. It is
 * deliberately not a live view of npm's state — reading that costs a 2FA round trip per
 * package, which is why the guard cannot simply ask npm and has to trust a committed file.
 * A hand-edited entry will therefore pass the guard and still fail the release; the ledger
 * is a tripwire for the package nobody remembered to claim, not an authorization record.
 */
export function readLedger(root) {
	const file = ledgerPath(root);
	if (!existsSync(file)) return { packages: {} };
	const doc = JSON.parse(readFileSync(file, "utf8"));
	return { ...doc, packages: doc.packages ?? {} };
}

/**
 * Merge `entries` into the ledger and write it back, preserving unrelated packages.
 *
 * Merging rather than replacing is required because both callers support `--only`: a run
 * that claims three packages must not erase the other thirty-four. `null` as a value
 * removes that package, which is how a verify that finds no record retracts a stale claim.
 */
export function updateLedger(root, entries) {
	const doc = readLedger(root);
	const packages = { ...doc.packages };
	for (const [name, entry] of Object.entries(entries)) {
		if (entry === null) delete packages[name];
		else packages[name] = entry;
	}
	const sorted = {};
	for (const name of Object.keys(packages).sort())
		sorted[name] = packages[name];
	const next = { ...doc, packages: sorted };
	writeFileSync(ledgerPath(root), `${JSON.stringify(next, null, "\t")}\n`);
	return next;
}
