import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { Parser } from "@oclif/core";

const COMMANDS_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

function commandFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return commandFiles(path);
		return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
			? [path]
			: [];
	});
}

/** Splits an example the way a shell would, for the quoting the examples use. */
function words(example: string): string[] {
	return [...example.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(
		(match) => match[1] ?? match[2] ?? match[3],
	);
}

// The examples are what `--help` tells a maintainer to type, from the repository root.
describe("command examples", () => {
	for (const file of commandFiles(COMMANDS_DIR)) {
		const id = relative(COMMANDS_DIR, file)
			.replace(/\.ts$/, "")
			.split(sep)
			.join(":");

		test(`${id}: every example names the command, its flags and existing config files`, async () => {
			const { default: command } = await import(file);
			expect(command.examples.length).toBeGreaterThan(0);
			for (const example of command.examples as string[]) {
				const [prompt, bun, run, cli, name, ...argv] = words(example);
				expect([prompt, bun, run, cli, name]).toEqual([
					"$",
					"bun",
					"run",
					"cli",
					id,
				]);
				const { flags } = await Parser.parse(argv, {
					flags: command.flags,
					args: command.args,
					strict: true,
				});
				if (flags.elementsFile) {
					expect(existsSync(join(REPO_ROOT, flags.elementsFile))).toBe(true);
				}
			}
		});
	}
});
