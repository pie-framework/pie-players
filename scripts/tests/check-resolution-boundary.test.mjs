import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	ancestorsOf,
	collectBoundaryFindings,
	visiblePackages,
} from "../check-resolution-boundary.mjs";

const ROOT = "/repo/.claude/worktrees/topic";
const MAIN_NODE_MODULES = "/repo/node_modules";
const MAIN_MANIFEST = "/repo/package.json";

function mainCheckout({ visible, declared }) {
	return {
		nodeModules: MAIN_NODE_MODULES,
		manifestPath: MAIN_MANIFEST,
		visible: new Set(visible),
		declared: new Set(declared),
	};
}

describe("collectBoundaryFindings", () => {
	test("passes when the checkout installs everything the main checkout has", () => {
		const result = collectBoundaryFindings({
			root: ROOT,
			own: new Set(["svelte", "vite"]),
			ancestors: [
				mainCheckout({
					visible: ["svelte", "vite"],
					declared: ["svelte", "vite"],
				}),
			],
		});

		expect(result).toEqual({ failures: [], notes: [] });
	});

	test("fails on a stale main-checkout entry the checkout does not shadow", () => {
		const result = collectBoundaryFindings({
			root: ROOT,
			own: new Set(["svelte", "daisyui"]),
			ancestors: [
				mainCheckout({
					visible: ["svelte", "daisyui", "@tiptap/core"],
					declared: ["svelte"],
				}),
			],
		});

		expect(result.failures).toEqual([
			`${MAIN_NODE_MODULES} holds entries ${MAIN_MANIFEST} does not declare: @tiptap/core. Remove them there.`,
		]);
		expect(result.notes).toEqual([]);
	});

	test("reports a dependency only the main checkout's branch declares, without failing", () => {
		const result = collectBoundaryFindings({
			root: ROOT,
			own: new Set(["svelte"]),
			ancestors: [
				mainCheckout({
					visible: ["svelte", "glob"],
					declared: ["svelte", "glob"],
				}),
			],
		});

		expect(result.failures).toEqual([]);
		expect(result.notes).toEqual([
			`${MAIN_NODE_MODULES} installs dependencies this checkout does not: glob.`,
		]);
	});

	test("fails once, naming bun install, when the checkout has no install of its own", () => {
		const result = collectBoundaryFindings({
			root: ROOT,
			own: new Set(),
			ancestors: [
				mainCheckout({ visible: ["svelte", "stale"], declared: ["svelte"] }),
				{
					nodeModules: "/node_modules",
					manifestPath: "/package.json",
					visible: new Set(["other"]),
					declared: new Set(),
				},
			],
		});

		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toContain("has no install of its own");
		expect(result.failures[0]).toContain("bun install");
	});

	test("passes a checkout with nothing above it, installed or not", () => {
		expect(
			collectBoundaryFindings({ root: ROOT, own: new Set(), ancestors: [] }),
		).toEqual({ failures: [], notes: [] });
	});

	test("ignores a stale entry further up that a nearer node_modules shadows", () => {
		const result = collectBoundaryFindings({
			root: ROOT,
			own: new Set(["svelte"]),
			ancestors: [
				mainCheckout({ visible: ["lowlight"], declared: ["lowlight"] }),
				{
					nodeModules: "/node_modules",
					manifestPath: "/package.json",
					visible: new Set(["lowlight"]),
					declared: new Set(),
				},
			],
		});

		expect(result.failures).toEqual([]);
	});
});

describe("ancestorsOf", () => {
	test("lists every directory above the root, nearest first", () => {
		expect(ancestorsOf("/repo/.claude/worktrees/topic")).toEqual([
			"/repo/.claude/worktrees",
			"/repo/.claude",
			"/repo",
			"/",
		]);
	});
});

describe("visiblePackages", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "check-resolution-boundary-"));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	test("lists scoped and unscoped packages, skipping dangling links and dot entries", () => {
		const nodeModules = path.join(dir, "node_modules");
		mkdirSync(path.join(nodeModules, "plain"), { recursive: true });
		mkdirSync(path.join(nodeModules, "@scope", "kept"), { recursive: true });
		mkdirSync(path.join(nodeModules, ".bin"), { recursive: true });
		mkdirSync(path.join(nodeModules, ".bun"), { recursive: true });
		symlinkSync(
			path.join(dir, "packages", "removed"),
			path.join(nodeModules, "@scope", "dangling"),
		);

		expect([...visiblePackages(nodeModules)].sort()).toEqual([
			"@scope/kept",
			"plain",
		]);
	});

	test("finds nothing in a node_modules that does not exist", () => {
		expect(visiblePackages(path.join(dir, "missing")).size).toBe(0);
	});
});
