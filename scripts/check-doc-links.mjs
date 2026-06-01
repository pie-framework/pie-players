#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
	".git",
	".svelte-kit",
	"dist",
	"node_modules",
	"coverage",
	"local-builds",
]);
const DOC_FILE_NAMES = new Set([
	"README.md",
	"readme.md",
	"ARCHITECTURE.md",
	"USAGE_EXAMPLE.md",
	"AGENTS.md",
	"GETTING-STARTED.md",
	"INTEGRATION-GUIDE.md",
]);

const toPosix = (value) => value.replaceAll(path.sep, "/");
const rel = (filePath) => toPosix(path.relative(ROOT, filePath));

const isMarkdownDoc = (filePath) => {
	const relative = rel(filePath);
	const base = path.basename(filePath);
	if (!filePath.endsWith(".md")) return false;
	if (base === "CHANGELOG.md") return false;
	if (relative.startsWith("docs/")) return true;
	if (/^packages\/[^/]+\/docs\//.test(relative)) return true;
	if (relative.startsWith("packages/")) return DOC_FILE_NAMES.has(base);
	if (relative.startsWith("apps/")) return DOC_FILE_NAMES.has(base);
	return DOC_FILE_NAMES.has(base);
};

const walk = (dir, files = []) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) {
				walk(path.join(dir, entry.name), files);
			}
			continue;
		}

		const fullPath = path.join(dir, entry.name);
		if (isMarkdownDoc(fullPath)) {
			files.push(fullPath);
		}
	}
	return files;
};

const hasExactPath = (targetPath) => {
	const absolute = path.resolve(targetPath);
	const relative = path.relative(path.parse(absolute).root, absolute);
	let current = path.parse(absolute).root;

	for (const segment of relative.split(path.sep).filter(Boolean)) {
		if (!existsSync(current)) return false;
		const entries = readdirSync(current);
		if (!entries.includes(segment)) return false;
		current = path.join(current, segment);
	}

	return existsSync(absolute);
};

const normalizeTarget = (rawTarget) => {
	let target = rawTarget.trim();
	if (target.startsWith("<") && target.endsWith(">")) {
		target = target.slice(1, -1).trim();
	}
	if (!target.startsWith("<")) {
		target = target.split(/\s+/)[0] ?? "";
	}
	try {
		target = decodeURI(target);
	} catch {
		// Keep the original target; the existence check will report it.
	}
	return target;
};

const isExternalOrAnchor = (target) =>
	target === "" ||
	target.startsWith("#") ||
	/^[a-z][a-z0-9+.-]*:/i.test(target);

const stripHash = (target) => target.split("#", 1)[0];

const extractTargets = (line) => {
	const targets = [];
	const inlineLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
	let match = inlineLinkPattern.exec(line);
	while (match) {
		targets.push(match[1]);
		match = inlineLinkPattern.exec(line);
	}

	const referenceMatch = /^\s*\[[^\]]+\]:\s+(\S+)/.exec(line);
	if (referenceMatch) {
		targets.push(referenceMatch[1]);
	}

	return targets;
};

const isDatedScanEvidence = (content) =>
	content.includes("> **Status:** Dated scan evidence");

const isInsideRoot = (targetPath) => {
	const relative = path.relative(ROOT, targetPath);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
};

const failures = [];

for (const filePath of walk(ROOT).sort()) {
	const content = readFileSync(filePath, "utf8");
	if (isDatedScanEvidence(content)) continue;

	const lines = content.split(/\r?\n/);
	let inFence = false;

	lines.forEach((line, index) => {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			return;
		}
		if (inFence) return;

		const lineWithoutInlineCode = line.replace(/`[^`]*`/g, "");
		for (const rawTarget of extractTargets(lineWithoutInlineCode)) {
			const target = normalizeTarget(rawTarget);
			if (isExternalOrAnchor(target)) continue;

			const targetWithoutHash = stripHash(target);
			if (targetWithoutHash === "") continue;

			const resolved = path.resolve(path.dirname(filePath), targetWithoutHash);
			if (!isInsideRoot(resolved)) {
				failures.push(
					`${rel(filePath)}:${index + 1} points outside the repo: ${target}`,
				);
				continue;
			}

			if (!hasExactPath(resolved)) {
				failures.push(
					`${rel(filePath)}:${index + 1} missing link target: ${target}`,
				);
				continue;
			}

			if (
				!statSync(resolved).isDirectory() &&
				targetWithoutHash.endsWith("/")
			) {
				failures.push(
					`${rel(filePath)}:${index + 1} links to a file with a trailing slash: ${target}`,
				);
			}
		}
	});
}

if (failures.length > 0) {
	console.error("Documentation link check failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("Documentation link check passed.");
