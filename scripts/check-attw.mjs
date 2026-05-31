#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
	closeSync,
	existsSync,
	mkdtempSync,
	openSync,
	readFileSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const ATTW_PARSE_RETRIES = 1;
const ATTW_MAX_BUFFER = 16 * 1024 * 1024;
const DIAGNOSTIC_TAIL_LENGTH = 4000;
const ATTW_ARGS = [
	"attw",
	"--pack",
	"--ignore-rules",
	"cjs-resolves-to-esm",
	"--format",
	"json",
	"--",
	".",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const WORKSPACE_ROOTS = Array.isArray(policy.workspaceRoots)
	? policy.workspaceRoots
	: ["packages"];

const getWorkspaceDirs = () => {
	const dirs = new Set();

	for (const rootDir of WORKSPACE_ROOTS) {
		const absRoot = path.join(ROOT, rootDir);
		if (!existsSync(absRoot)) continue;
		for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				dirs.add(path.join(absRoot, entry.name));
			}
		}
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const textTail = (value, length = DIAGNOSTIC_TAIL_LENGTH) => {
	const text = typeof value === "string" ? value : String(value || "");
	if (text.length <= length) return text;
	return `... ${text.length - length} earlier character(s) omitted ...\n${text.slice(-length)}`;
};

const runAttw = (dir) => {
	const tmpRoot = mkdtempSync(path.join(tmpdir(), "pie-attw-"));
	const stdoutPath = path.join(tmpRoot, "stdout.json");
	const stdoutFd = openSync(stdoutPath, "w");
	let result;

	try {
		result = spawnSync("bunx", ATTW_ARGS, {
			cwd: dir,
			stdio: ["ignore", stdoutFd, "pipe"],
			encoding: "utf8",
			maxBuffer: ATTW_MAX_BUFFER,
		});
	} finally {
		closeSync(stdoutFd);
	}

	const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : "";
	rmSync(tmpRoot, { recursive: true, force: true });
	const stderr = result.stderr?.toString?.() ?? "";

	if (result.error) {
		throw new Error(
			[
				"ATTW failed to run.",
				`status=${result.status ?? "unknown"} signal=${result.signal ?? "none"}`,
				stderr ? `stderr tail:\n${textTail(stderr)}` : null,
				result.error.message,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}

	if (result.status === 0) {
		return {
			stdout,
			stderr,
			status: 0,
			signal: null,
		};
	}

	if (!stdout.trim()) {
		throw new Error(
			[
				"ATTW produced no JSON output.",
				`status=${result.status ?? "unknown"} signal=${result.signal ?? "none"}`,
				stderr ? `stderr tail:\n${textTail(stderr)}` : null,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}

	return {
		stdout,
		stderr,
		status: result.status ?? null,
		signal: result.signal ?? null,
	};
};

const parseAttwReport = ({ pkg, dir, result, attempt }) => {
	try {
		return JSON.parse(result.stdout);
	} catch (error) {
		const relativeDir = path.relative(ROOT, dir);
		throw new Error(
			[
				`ATTW output parse failure for ${pkg.name || path.basename(dir)} (${relativeDir})`,
				`attempt=${attempt + 1}`,
				`parseError=${error.message}`,
				`status=${result.status ?? "unknown"} signal=${result.signal ?? "none"}`,
				`stdoutLength=${result.stdout.length}`,
				result.stderr ? `stderr tail:\n${textTail(result.stderr)}` : null,
				`stdout tail:\n${textTail(result.stdout)}`,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}
};

const flattenProblems = (problemsByKind) => {
	const all = [];
	for (const [kind, problems] of Object.entries(problemsByKind || {})) {
		if (!Array.isArray(problems)) continue;
		for (const problem of problems) {
			all.push({ kind, ...problem });
		}
	}
	return all;
};

const shouldSuppressProblem = (problem) => {
	const entrypoint =
		typeof problem.entrypoint === "string" ? problem.entrypoint : "";
	const resolutionKind =
		typeof problem.resolutionKind === "string" ? problem.resolutionKind : "";
	const moduleSpecifier =
		typeof problem.moduleSpecifier === "string" ? problem.moduleSpecifier : "";

	// CJS resolver warning is already intentionally ignored in existing policy.
	if (problem.kind === "CJSResolvesToESM") return true;

	if (problem.kind === "NoResolution") {
		// Node10 is out of support for this repo (engines >=18 in publish policy checks).
		if (resolutionKind === "node10") return true;
		// ATTW cannot reliably model CSS-only entrypoints.
		if (entrypoint.endsWith(".css")) return true;
	}

	return false;
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;
	const suppressedCounts = new Map();

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		if (typeof pkg.name !== "string" || !pkg.name.startsWith("@pie-players/")) {
			continue;
		}
		checked += 1;
		try {
			let report;
			for (let attempt = 0; attempt <= ATTW_PARSE_RETRIES; attempt += 1) {
				const result = runAttw(dir);
				try {
					report = parseAttwReport({ pkg, dir, result, attempt });
					break;
				} catch (error) {
					if (attempt >= ATTW_PARSE_RETRIES) {
						throw error;
					}
					console.warn(
						`[check-attw] ${pkg.name} returned unparsable JSON; retrying once. ${error.message.split("\n")[2] || ""}`,
					);
				}
			}
			const problems = flattenProblems(report.problems);
			const actionable = problems.filter(
				(problem) => !shouldSuppressProblem(problem),
			);

			for (const problem of problems) {
				if (!shouldSuppressProblem(problem)) continue;
				const key = `${problem.kind}:${problem.entrypoint || problem.moduleSpecifier || "n/a"}:${problem.resolutionKind || problem.resolutionOption || "n/a"}`;
				suppressedCounts.set(key, (suppressedCounts.get(key) || 0) + 1);
			}

			if (actionable.length > 0) {
				failures.push({
					name: pkg.name || path.basename(dir),
					dir: path.relative(ROOT, dir),
					error: actionable
						.map(
							(problem) =>
								`${problem.kind} entrypoint=${problem.entrypoint || "n/a"} resolution=${problem.resolutionKind || problem.resolutionOption || "n/a"} module=${problem.moduleSpecifier || "n/a"}`,
						)
						.join("\n"),
				});
			}
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [error.message].filter(Boolean).join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-attw] Found ${failures.length} package(s) with declaration issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(`[check-attw] OK: validated ${checked} publishable package(s)`);
	if (suppressedCounts.size > 0) {
		console.log(
			`[check-attw] Suppressed ${[...suppressedCounts.values()].reduce((a, b) => a + b, 0)} known non-actionable ATTW diagnostic(s)`,
		);
	}
};

run();
