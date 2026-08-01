import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";

import {
	collectStaleClaims,
	collectTrustedPublisherFailures,
} from "../check-trusted-publishers.mjs";
import {
	LEDGER_RELATIVE_PATH,
	readLedger,
	updateLedger,
} from "../lib/trusted-publishers.mjs";

const SLUG = "pie-framework/pie-players";

const packages = [
	{ name: "@pie-players/pie-theme", workflow: "release.yml" },
	{
		name: "@pie-players/pie-preloaded-player",
		workflow: "publish-preloaded-player.yml",
	},
];

const ledgerFor = (entries) => ({ packages: entries });

/** A throwaway repo root with the ledger's parent directory in place. */
const makeLedgerRoot = () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "trusted-publishers-"));
	mkdirSync(path.join(root, path.dirname(LEDGER_RELATIVE_PATH)), {
		recursive: true,
	});
	return root;
};

describe("check-trusted-publishers", () => {
	test("passes when every publishable package has a matching claim", () => {
		const { failures, unclaimed } = collectTrustedPublisherFailures({
			packages,
			slug: SLUG,
			ledger: ledgerFor({
				"@pie-players/pie-theme": {
					repository: SLUG,
					workflow: "release.yml",
				},
				"@pie-players/pie-preloaded-player": {
					repository: SLUG,
					workflow: "publish-preloaded-player.yml",
				},
			}),
		});

		expect(failures).toEqual([]);
		expect(unclaimed).toEqual([]);
	});

	// The regression this check exists for: a package added to the workspace that nobody
	// claimed a trusted publisher for. Under fixed versioning it does not fail alone — it
	// takes the release down to a partial publish.
	test("fails a package with no recorded claim, and names it for remediation", () => {
		const { failures, unclaimed } = collectTrustedPublisherFailures({
			packages,
			slug: SLUG,
			ledger: ledgerFor({
				"@pie-players/pie-theme": {
					repository: SLUG,
					workflow: "release.yml",
				},
			}),
		});

		expect(unclaimed).toEqual(["@pie-players/pie-preloaded-player"]);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("@pie-players/pie-preloaded-player");
		expect(failures[0]).toContain("ENEEDAUTH");
	});

	// npm permits one trusted publisher per package, so a claim naming release.yml for the
	// preloaded player does not just fail — it occupies the slot publish-preloaded-player.yml
	// needs.
	test("fails a claim bound to the wrong workflow", () => {
		const { failures } = collectTrustedPublisherFailures({
			packages,
			slug: SLUG,
			ledger: ledgerFor({
				"@pie-players/pie-theme": {
					repository: SLUG,
					workflow: "release.yml",
				},
				"@pie-players/pie-preloaded-player": {
					repository: SLUG,
					workflow: "release.yml",
				},
			}),
		});

		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("publish-preloaded-player.yml");
	});

	test("fails a claim bound to another repository", () => {
		const { failures } = collectTrustedPublisherFailures({
			packages: [packages[0]],
			slug: SLUG,
			ledger: ledgerFor({
				"@pie-players/pie-theme": {
					repository: "pie-framework/pie-elements",
					workflow: "release.yml",
				},
			}),
		});

		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("pie-framework/pie-elements");
	});

	// Each entry costs an interactive 2FA round trip, so a write that dropped the claims
	// already recorded would be expensive to recover from: it would mean re-paying the OTPs.
	test("recording a claim preserves the claims already in the ledger", () => {
		const root = makeLedgerRoot();

		updateLedger(root, {
			"@pie-players/b": { repository: SLUG, workflow: "release.yml" },
		});
		updateLedger(root, {
			"@pie-players/a": { repository: SLUG, workflow: "release.yml" },
		});

		const ledger = readLedger(root);
		// Sorted, so a claim landing later does not reshuffle the file and produce a noisy diff.
		expect(Object.keys(ledger.packages)).toEqual([
			"@pie-players/a",
			"@pie-players/b",
		]);

		updateLedger(root, { "@pie-players/b": null });
		expect(Object.keys(readLedger(root).packages)).toEqual(["@pie-players/a"]);
	});

	test("an unknown top-level key in the ledger survives a write", () => {
		const root = makeLedgerRoot();
		writeFileSync(
			path.join(root, LEDGER_RELATIVE_PATH),
			JSON.stringify({ $comment: ["keep me"], packages: {} }),
		);

		updateLedger(root, {
			"@pie-players/a": { repository: SLUG, workflow: "release.yml" },
		});

		const written = JSON.parse(
			readFileSync(path.join(root, LEDGER_RELATIVE_PATH), "utf8"),
		);
		expect(written.$comment).toEqual(["keep me"]);
		expect(Object.keys(written.packages)).toEqual(["@pie-players/a"]);
	});

	test("reports a claim for a package this repo no longer publishes without failing", () => {
		const ledger = ledgerFor({
			"@pie-players/pie-theme": { repository: SLUG, workflow: "release.yml" },
			"@pie-players/pie-retired": { repository: SLUG, workflow: "release.yml" },
		});

		expect(collectStaleClaims({ packages: [packages[0]], ledger })).toEqual([
			"@pie-players/pie-retired",
		]);
		expect(
			collectTrustedPublisherFailures({
				packages: [packages[0]],
				slug: SLUG,
				ledger,
			}).failures,
		).toEqual([]);
	});
});
