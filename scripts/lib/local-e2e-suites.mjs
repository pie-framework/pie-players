/**
 * The Playwright suites the local PR gate runs, and how `scripts/run-local-e2e.mjs`
 * splits each one into its build and its run.
 *
 * Each suite is the root script `test:e2e:<suite>`, which CI's matrix also runs, and
 * must have the shape `bun run build:e2e:<x> && bun run test:e2e:<suite>:prebuilt`.
 * The local gate runs every build first, one at a time, then every `:prebuilt` run
 * concurrently. Builds go first because concurrent turbo runs race on restoring the
 * same `dist`, and section-demos reloads the page when a workspace `dist` changes
 * under a running test.
 */

/** Longest first, so a concurrency cap below the suite count starts the long poles. */
export const LOCAL_GATE_E2E_SUITES = [
	"item-player:critical",
	"assessment-player",
	"section-player:critical",
	"print-player",
	"players-shared",
];

const BUILD_COMMAND = /^bun run (build:e2e:[\w:-]+)$/;

/**
 * Splits each suite's script into its build and its run.
 *
 * @param {Record<string, string> | undefined} scripts root package.json scripts
 * @param {string[]} suites
 * @returns {{ builds: string[], runs: { suite: string, script: string }[], failures: string[] }}
 *   `builds` holds each distinct build script once, in first-use order.
 */
export function planLocalE2e(scripts, suites = LOCAL_GATE_E2E_SUITES) {
	const builds = [];
	const runs = [];
	const failures = [];

	for (const suite of suites) {
		const scriptName = `test:e2e:${suite}`;
		const runScript = `${scriptName}:prebuilt`;
		const script = scripts?.[scriptName];
		if (typeof script !== "string") {
			failures.push(`package.json is missing script "${scriptName}".`);
			continue;
		}
		if (typeof scripts[runScript] !== "string") {
			failures.push(`package.json is missing script "${runScript}".`);
			continue;
		}

		const commands = script.split("&&").map((part) => part.trim());
		const build =
			commands.length === 2 ? BUILD_COMMAND.exec(commands[0]) : null;
		if (!build || commands[1] !== `bun run ${runScript}`) {
			failures.push(
				`${scriptName} must be "bun run build:e2e:<name> && bun run ${runScript}", so the local gate can build it once and run it concurrently.`,
			);
			continue;
		}

		if (!builds.includes(build[1])) {
			builds.push(build[1]);
		}
		runs.push({ suite, script: runScript });
	}

	return { builds, runs, failures };
}
