import { describe, expect, test } from "bun:test";

import { collectGateFailures } from "../check-local-pr-gate.mjs";

const basePackageJson = {
	scripts: {
		"verify:pre-commit":
			"bun run check:changeset-patch-only && bun run check:local-pr-gate && bun run check:deps && bun run check:package-metadata && bun run check:svelte-runtime-deps && bun run check:custom-elements && bun run check:ce-define-safety && bun run check:speech-composition-purity && bun run check:source-exports && bun run check:consumer-boundaries && bun run check:scripts && bun run lint:biome && bun run check",
		"verify:ci-lint-typecheck":
			"bun run check:local-pr-gate && bun run check:deps && bun run check:package-metadata && bun run check:svelte-runtime-deps && bun run check:custom-elements && bun run check:ce-define-safety && bun run check:speech-composition-purity && bun run check:scripts && bun run build && bun run check:player-tool-boundaries && bun run check:publint && bun run check:types-publish && bun run check:pack-integrity && bun run check:node-consumer-imports && bun run check:consumer-boundaries && bun run lint:all",
		"verify:local-pr":
			"bun run check:changeset-patch-only && bun run verify:ci-lint-typecheck && bun run test:e2e:section-player:critical && bun run test:e2e:item-player:critical && bun run test:e2e:assessment-player",
		"verify:pre-push": "bun run check:changeset-patch-only && bun run check:local-pr-gate",
	},
};

describe("check-local-pr-gate policy", () => {
	test("allows pre-push to use a fast local gate while CI keeps the full gate", () => {
		const failures = collectGateFailures({
			packageJson: basePackageJson,
			lefthook:
				"pre-commit:\n  commands:\n    cheap-gate:\n      run: bun run verify:pre-commit\npre-push:\n  commands:\n    fast-gate:\n      run: bun run verify:pre-push\n",
			ciWorkflow:
				"steps:\n  - name: Verify CI Lint & Typecheck Gate\n    run: bun run verify:ci-lint-typecheck\nmatrix:\n  command:\n    - test:e2e:section-player:critical\n    - test:e2e:item-player:critical\n    - test:e2e:assessment-player\n",
		});

		expect(failures).toEqual([]);
	});

	test("rejects a local full gate that omits critical e2e coverage", () => {
		const packageJson = {
			scripts: {
				...basePackageJson.scripts,
				"verify:local-pr":
					"bun run check:changeset-patch-only && bun run verify:ci-lint-typecheck",
			},
		};

		const failures = collectGateFailures({
			packageJson,
			lefthook:
				"pre-commit:\n  commands:\n    cheap-gate:\n      run: bun run verify:pre-commit\npre-push:\n  commands:\n    fast-gate:\n      run: bun run verify:pre-push\n",
			ciWorkflow:
				"run: bun run verify:ci-lint-typecheck\n- test:e2e:section-player:critical\n- test:e2e:item-player:critical\n- test:e2e:assessment-player\n",
		});

		expect(failures).toContain(
			'verify:local-pr is missing "bun run test:e2e:section-player:critical".',
		);
		expect(failures).toContain(
			'verify:local-pr is missing "bun run test:e2e:item-player:critical".',
		);
		expect(failures).toContain(
			'verify:local-pr is missing "bun run test:e2e:assessment-player".',
		);
	});

	test("rejects a pre-commit hook that does not run the canonical early gate", () => {
		const failures = collectGateFailures({
			packageJson: basePackageJson,
			lefthook: "pre-push:\n  commands:\n    fast-gate:\n      run: bun run verify:pre-push\n",
			ciWorkflow:
				"run: bun run verify:ci-lint-typecheck\n- test:e2e:section-player:critical\n- test:e2e:item-player:critical\n- test:e2e:assessment-player\n",
		});

		expect(failures).toContain(
			"lefthook pre-commit must run bun run verify:pre-commit.",
		);
	});

	test("rejects a pre-commit gate that omits high-leverage source checks", () => {
		const packageJson = {
			scripts: {
				...basePackageJson.scripts,
				"verify:pre-commit":
					"bun run check:changeset-patch-only && bun run check:local-pr-gate",
			},
		};

		const failures = collectGateFailures({
			packageJson,
			lefthook:
				"pre-commit:\n  commands:\n    cheap-gate:\n      run: bun run verify:pre-commit\npre-push:\n  commands:\n    fast-gate:\n      run: bun run verify:pre-push\n",
			ciWorkflow:
				"run: bun run verify:ci-lint-typecheck\n- test:e2e:section-player:critical\n- test:e2e:item-player:critical\n- test:e2e:assessment-player\n",
		});

		expect(failures).toContain(
			'verify:pre-commit is missing "bun run check:deps".',
		);
		expect(failures).toContain(
			'verify:pre-commit is missing "bun run check:svelte-runtime-deps".',
		);
		expect(failures).toContain(
			'verify:pre-commit is missing "bun run check:source-exports".',
		);
		expect(failures).toContain(
			'verify:pre-commit is missing "bun run check:consumer-boundaries".',
		);
		expect(failures).toContain(
			'verify:pre-commit is missing "bun run check".',
		);
	});
});
