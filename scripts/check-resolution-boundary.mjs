#!/usr/bin/env node

/**
 * `check-resolution-boundary`: nothing stale may resolve into this checkout from a
 * directory above it.
 *
 * Bun, Node and TypeScript look a bare specifier up in every ancestor
 * `node_modules`, and `bun run` puts every ancestor's `node_modules/.bin` on PATH.
 * A worktree under `.claude/worktrees/` sits inside the main checkout, so whatever
 * the worktree does not install comes from the main checkout's root install, and a
 * test, build or typecheck there can pass on an import CI's fresh checkout rejects.
 *
 * Two cases fail. A checkout with no install of its own runs on the one above it.
 * And an ancestor `node_modules` entry its own manifest does not declare is
 * garbage: bun's isolated linker keeps a root link after the dependency leaves the
 * manifest, which left 23 such entries in the main checkout by 2026-09-25. An
 * ancestor dependency that is declared there but not installed here is reported
 * and allowed, because two branches can declare different root dependencies, and
 * failing on it would block every worktree while the main checkout is on a branch
 * that adds one.
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import path from "node:path";

const LABEL = "[check-resolution-boundary]";

const DEPENDENCY_FIELDS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
];

function readdirOrEmpty(dir) {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

/** Package names a lookup in `nodeModules` finds. A dangling link finds nothing. */
export function visiblePackages(nodeModules) {
	const names = new Set();
	for (const entry of readdirOrEmpty(nodeModules)) {
		if (entry.startsWith(".")) continue;
		const full = path.join(nodeModules, entry);
		if (entry.startsWith("@")) {
			if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) continue;
			for (const child of readdirOrEmpty(full)) {
				if (existsSync(path.join(full, child))) names.add(`${entry}/${child}`);
			}
		} else if (existsSync(full)) {
			names.add(entry);
		}
	}
	return names;
}

/** Every name `manifestPath` declares as a dependency; none when it is absent. */
export function declaredDependencies(manifestPath) {
	if (!existsSync(manifestPath)) return new Set();
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	return new Set(
		DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})),
	);
}

/** Every directory above `root`, nearest first. */
export function ancestorsOf(root) {
	const dirs = [];
	for (let dir = root; path.dirname(dir) !== dir; ) {
		dir = path.dirname(dir);
		dirs.push(dir);
	}
	return dirs;
}

/**
 * @param {{
 *   root: string,
 *   own: Set<string>,
 *   ancestors: { nodeModules: string, manifestPath: string, visible: Set<string>, declared: Set<string> }[],
 * }} input `ancestors` nearest first, as resolution visits them.
 * @returns {{ failures: string[], notes: string[] }}
 */
export function collectBoundaryFindings({ root, own, ancestors }) {
	const failures = [];
	const notes = [];
	// A name found nearer to the checkout shadows the same name further up.
	const shadowed = new Set(own);
	for (const { nodeModules, manifestPath, visible, declared } of ancestors) {
		const reachable = [...visible].filter((name) => !shadowed.has(name)).sort();
		for (const name of visible) shadowed.add(name);
		if (reachable.length === 0) continue;

		if (own.size === 0) {
			failures.push(
				`${root} has no install of its own, so every package and binary comes from ${nodeModules}. Run \`bun install\` in ${root}.`,
			);
			break;
		}

		const stale = reachable.filter((name) => !declared.has(name));
		const declaredAbove = reachable.filter((name) => declared.has(name));
		if (stale.length > 0) {
			failures.push(
				`${nodeModules} holds entries ${manifestPath} does not declare: ${stale.join(", ")}. Remove them there.`,
			);
		}
		if (declaredAbove.length > 0) {
			notes.push(
				`${nodeModules} installs dependencies this checkout does not: ${declaredAbove.join(", ")}.`,
			);
		}
	}
	return { failures, notes };
}

function main() {
	const root = realpathSync(process.cwd());
	const ancestors = [];
	for (const dir of ancestorsOf(root)) {
		const nodeModules = path.join(dir, "node_modules");
		const visible = visiblePackages(nodeModules);
		if (visible.size === 0) continue;
		const manifestPath = path.join(dir, "package.json");
		ancestors.push({
			nodeModules,
			manifestPath,
			visible,
			declared: declaredDependencies(manifestPath),
		});
	}

	const { failures, notes } = collectBoundaryFindings({
		root,
		own: visiblePackages(path.join(root, "node_modules")),
		ancestors,
	});

	for (const note of notes) {
		console.log(`${LABEL} Note: ${note}`);
	}

	if (failures.length > 0) {
		console.error(
			`${LABEL} Packages resolve into this checkout from above it:`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		console.error(
			`${LABEL} A test, build or typecheck here that imports one of them can pass where CI's fresh checkout fails. See "Git Worktrees" in AGENTS.md.`,
		);
		process.exit(1);
	}

	console.log(`${LABEL} OK: nothing stale resolves from above this checkout`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
