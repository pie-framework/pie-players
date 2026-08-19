import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (typeof window !== "undefined") {
	throw new Error(
		"[npm-auth-env] @pie-players/pie-players-shared/server/npm-auth-env is server-only and cannot be imported in browser code",
	);
}

const REGISTRY = "https://registry.npmjs.org/";

const parseDotEnvToken = (envPath: string, key: string): string => {
	try {
		const content = readFileSync(envPath, "utf8");
		const pattern = new RegExp(
			`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)\\s*$`,
			"m",
		);
		const match = content.match(pattern);
		if (!match?.[1]) return "";
		const rawValue = match[1].trim();
		const isWrappedInQuotes =
			(rawValue.startsWith('"') && rawValue.endsWith('"')) ||
			(rawValue.startsWith("'") && rawValue.endsWith("'"));
		return (isWrappedInQuotes ? rawValue.slice(1, -1) : rawValue).trim();
	} catch {
		return "";
	}
};

const resolveToken = (
	envPath: string | undefined,
	baseEnv: NodeJS.ProcessEnv,
): string => {
	const envToken = String(
		baseEnv.NPM_TOKEN || baseEnv.NODE_AUTH_TOKEN || "",
	).trim();
	if (envToken) return envToken;
	if (!envPath) return "";

	return (
		parseDotEnvToken(envPath, "NPM_TOKEN") ||
		parseDotEnvToken(envPath, "NODE_AUTH_TOKEN")
	);
};

/**
 * Write a temp `.npmrc` carrying a scoped `_authToken` and return an env
 * object pointing `NPM_CONFIG_USERCONFIG` at it, so a publish subprocess
 * authenticates without a separate `npm login`. The token comes from
 * `NPM_TOKEN`/`NODE_AUTH_TOKEN` in `baseEnv` first, falling back to parsing
 * an `.env`-style file at `envPath` for either key.
 *
 * Call `cleanup()` once the subprocess using `env` has exited.
 */
export const createNpmAuthEnvironment = (
	envPath?: string,
	baseEnv: NodeJS.ProcessEnv = process.env,
): { env: NodeJS.ProcessEnv; cleanup: () => void } => {
	const token = resolveToken(envPath, baseEnv);
	if (!token) {
		return {
			env: baseEnv,
			cleanup: () => {},
		};
	}

	const tempDir = mkdtempSync(join(tmpdir(), "pie-npm-auth-"));
	const npmrcPath = join(tempDir, ".npmrc");
	writeFileSync(
		npmrcPath,
		`registry=${REGISTRY}\n//registry.npmjs.org/:_authToken=${token}\n`,
		"utf8",
	);

	return {
		env: {
			...baseEnv,
			NPM_CONFIG_USERCONFIG: npmrcPath,
			NODE_AUTH_TOKEN: String(baseEnv.NODE_AUTH_TOKEN || "").trim() || token,
			NPM_TOKEN: String(baseEnv.NPM_TOKEN || "").trim() || token,
		},
		cleanup: () => {
			rmSync(tempDir, { recursive: true, force: true });
		},
	};
};
