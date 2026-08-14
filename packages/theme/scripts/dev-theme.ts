import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const commands = [
	[process.execPath, "--watch", "./scripts/generate-theme-css.ts", "--write"],
	[process.execPath, "x", "tsc", "-p", "tsconfig.json", "--watch"],
] as const;

const processes = commands.map((cmd) =>
	Bun.spawn(cmd, {
		cwd: packageRoot,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
);

const exitCode = await Promise.race(processes.map((child) => child.exited));
for (const child of processes) child.kill();
process.exit(exitCode);
