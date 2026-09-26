// Plain ESM, unbuilt: the release workflow runs `node scripts/check-npm-auth.mjs`
// before anything builds this package.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REGISTRY = "https://registry.npmjs.org/";

const parseDotEnvToken = (envPath, key) => {
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

const resolveToken = (envPath, baseEnv) => {
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

/** Typed and documented in `npm-auth-env.d.mts`. */
export const createNpmAuthEnvironment = (envPath, baseEnv = process.env) => {
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
