#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { markdownAnchors, markdownDocs } from "./lib/markdown-docs.mjs";

const ROOT = process.cwd();
const toPosix = (value) => value.replaceAll(path.sep, "/");
const rel = (filePath) => toPosix(path.relative(ROOT, filePath));

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

const isExternal = (target) =>
	target === "" || /^[a-z][a-z0-9+.-]*:/i.test(target);

const splitHash = (target) => {
	const index = target.indexOf("#");
	return index === -1
		? [target, null]
		: [target.slice(0, index), target.slice(index + 1)];
};

const anchorCache = new Map();
const anchorsOf = (filePath) => {
	if (!anchorCache.has(filePath)) {
		anchorCache.set(filePath, markdownAnchors(readFileSync(filePath, "utf8")));
	}
	return anchorCache.get(filePath);
};

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

for (const filePath of markdownDocs(ROOT)) {
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
			if (isExternal(target)) continue;

			const [targetWithoutHash, fragment] = splitHash(target);
			if (targetWithoutHash === "") {
				if (fragment && !anchorsOf(filePath).has(fragment)) {
					failures.push(
						`${rel(filePath)}:${index + 1} missing anchor: ${target}`,
					);
				}
				continue;
			}

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
				continue;
			}

			// Only Markdown headings are checkable; a fragment on a source file is
			// a line range (`#L10-L20`) GitHub resolves on its own.
			if (fragment && resolved.endsWith(".md") && !anchorsOf(resolved).has(fragment)) {
				failures.push(
					`${rel(filePath)}:${index + 1} missing anchor: ${target}`,
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
