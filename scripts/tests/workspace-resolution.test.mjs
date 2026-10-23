import { afterEach, describe, expect, it } from "bun:test";
import { checkWorkspaceResolution } from "../lib/workspace-resolution.mjs";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const fixtures = [];
afterEach(() => {
	for (const dir of fixtures.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

function fixture(field = "dependencies", range = "workspace:*") {
	const root = realpathSync(
		mkdtempSync(join(tmpdir(), "pie-workspace-resolution-")),
	);
	fixtures.push(root);
	const consumer = join(root, "packages", "consumer");
	const workspace = join(root, "packages", "library");
	mkdirSync(consumer, { recursive: true });
	mkdirSync(workspace, { recursive: true });
	const manifestPath = join(consumer, "package.json");
	writeFileSync(
		manifestPath,
		JSON.stringify({
			name: "@test/consumer",
			[field]: { "@test/library": range },
		}),
	);
	// A type-only export with no build output must still resolve to the right workspace.
	writeFileSync(
		join(workspace, "package.json"),
		JSON.stringify({
			name: "@test/library",
			exports: { ".": { types: "./dist/index.d.ts" } },
		}),
	);
	const packages = new Map([["@test/library", workspace]]);
	const local = join(consumer, "node_modules", "@test", "library");
	const hoisted = join(root, "node_modules", "@test", "library");
	const link = (target, location = local) => {
		mkdirSync(dirname(location), { recursive: true });
		symlinkSync(target, location, "dir");
	};
	return {
		root,
		consumer,
		workspace,
		manifestPath,
		packages,
		local,
		hoisted,
		link,
	};
}

describe("workspace dependency identity", () => {
	it.each([
		"dependencies",
		"devDependencies",
		"peerDependencies",
		"optionalDependencies",
	])(
		"accepts a direct workspace link in %s before the package is built",
		(field) => {
			const f = fixture(field);
			f.link(f.workspace);
			expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([]);
		},
	);

	it("accepts a hoisted workspace link", () => {
		const f = fixture();
		f.link(f.workspace, f.hoisted);
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([]);
	});

	it("rejects a forwarding directory that shadows a valid hoisted link", () => {
		const f = fixture();
		f.link(f.workspace, f.hoisted);
		mkdirSync(f.local, { recursive: true });
		writeFileSync(
			join(f.local, "package.json"),
			JSON.stringify({ name: "@test/library", exports: "./index.js" }),
		);
		writeFileSync(
			join(f.local, "index.js"),
			"export * from '../../../../library/dist/index.js';",
		);
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([
			expect.objectContaining({
				dependency: "@test/library",
				expectedPath: f.workspace,
				resolvedPath: f.local,
			}),
		]);
	});

	it("rejects a same-name link into a different checkout", () => {
		const f = fixture();
		const other = join(f.root, "other-checkout", "library");
		mkdirSync(other, { recursive: true });
		writeFileSync(
			join(other, "package.json"),
			JSON.stringify({ name: "@test/library" }),
		);
		f.link(other);
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([
			expect.objectContaining({
				expectedPath: f.workspace,
				resolvedPath: other,
			}),
		]);
	});

	it("reports a missing install with the expected workspace", () => {
		const f = fixture();
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([
			expect.objectContaining({
				expectedPath: f.workspace,
				resolvedPath: undefined,
				reason: "Workspace dependency is not installed",
			}),
		]);
	});

	it("identifies a dangling local link instead of overlooking it", () => {
		const f = fixture();
		f.link(join(f.root, "removed"));
		f.link(f.workspace, f.hoisted);
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([
			expect.objectContaining({
				resolvedPath: f.local,
				reason: "Workspace entry is broken or has no valid package manifest",
			}),
		]);
	});

	it("rejects an undeclared workspace name", () => {
		const f = fixture();
		expect(checkWorkspaceResolution(f.manifestPath, new Map())).toEqual([
			expect.objectContaining({
				dependency: "@test/library",
				reason: "No workspace declares this package",
			}),
		]);
	});

	it("does not require non-workspace version ranges to use a local package", () => {
		const f = fixture("dependencies", "^1.0.0");
		expect(checkWorkspaceResolution(f.manifestPath, f.packages)).toEqual([]);
	});
});
