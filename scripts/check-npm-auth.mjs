import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REGISTRY = "https://registry.npmjs.org/";
const SCOPE = "pie-players";
const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const INTERACTIVE_TTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const AUTO_LOGIN_ENABLED =
	INTERACTIVE_TTY &&
	process.env.CI !== "true" &&
	process.env.PIE_SKIP_AUTO_NPM_LOGIN !== "1";

const run = (cmd, args) =>
	execFileSync(cmd, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

const discoverPublishablePackages = () => {
	if (!existsSync(PACKAGES_DIR)) return [];
	const names = [];
	for (const dirent of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
		if (!dirent.isDirectory()) continue;
		const manifestPath = path.join(PACKAGES_DIR, dirent.name, "package.json");
		if (!existsSync(manifestPath)) continue;
		try {
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (manifest?.private) continue;
			if (typeof manifest?.name !== "string") continue;
			if (!manifest.name.startsWith("@pie-players/")) continue;
			names.push(manifest.name);
		} catch {
			// ignore invalid manifests
		}
	}
	return names.sort();
};

const fail = (message, details) => {
	console.error(`\n[publish-auth] ${message}`);
	if (details) {
		console.error(details);
	}
	console.error("\n[publish-auth] Fix:");
	console.error("- Run `npm login --registry=https://registry.npmjs.org/`");
	console.error(
		"- Run `npm config set registry https://registry.npmjs.org/` if needed",
	);
	console.error(
		"- Verify access with `npm org ls pie-players --registry=https://registry.npmjs.org/`",
	);
	console.error(
		"- Verify publish rights with `npm access list packages <user> --registry=https://registry.npmjs.org/`",
	);
	console.error("- Retry publish after `npm whoami` succeeds");
	process.exit(1);
};

const getWhoami = () => run("npm", ["whoami", "--registry", REGISTRY]);
const getErrorDetails = (error) =>
	error?.stderr?.toString?.() || error?.message || String(error);
const isAuthError = (details) =>
	/E401|Unable to authenticate|authentication token .* invalid|need auth|not logged in/i.test(
		details,
	);

const tryInteractiveLogin = () => {
	if (!AUTO_LOGIN_ENABLED) return false;
	console.log(
		`[publish-auth] npm auth missing; starting interactive login for ${REGISTRY}`,
	);
	const result = spawnSync("npm", ["login", "--registry", REGISTRY], {
		stdio: "inherit",
		env: process.env,
	});
	return result.status === 0;
};

const runWithAuthRecovery = (runner, failureMessage) => {
	try {
		return runner();
	} catch (error) {
		const details = getErrorDetails(error);
		if (AUTO_LOGIN_ENABLED && isAuthError(details)) {
			const loginWorked = tryInteractiveLogin();
			if (loginWorked) {
				try {
					return runner();
				} catch (retryError) {
					const retryDetails = getErrorDetails(retryError);
					fail(`${failureMessage} (after interactive login).`, retryDetails);
				}
			}
		}
		fail(failureMessage, details);
	}
};

const username = runWithAuthRecovery(
	() => getWhoami(),
	"npm authentication failed (token missing, expired, or revoked).",
);

try {
	run("npm", ["org", "ls", SCOPE, "--registry", REGISTRY]);
} catch (error) {
	const details = getErrorDetails(error);
	fail(
		`npm auth user "${username}" cannot verify access to @${SCOPE}.`,
		details,
	);
}

const publishablePackages = discoverPublishablePackages();
if (publishablePackages.length === 0) {
	fail("No publishable @pie-players packages found in packages/*.");
}

let packageAccessMap = {};
const rawAccessMap = runWithAuthRecovery(
	() =>
		run("npm", [
			"access",
			"list",
			"packages",
			username,
			"--json",
			"--registry",
			REGISTRY,
		]),
	`npm auth user "${username}" cannot list package access permissions.`,
);
packageAccessMap = JSON.parse(rawAccessMap || "{}");

const noWriteAccess = publishablePackages.filter((pkg) => {
	const level = packageAccessMap[pkg];
	return level !== "read-write";
});
if (noWriteAccess.length > 0) {
	fail(
		`npm auth user "${username}" lacks write access to ${noWriteAccess.length} package(s).`,
		noWriteAccess.map((name) => `- ${name}`).join("\n"),
	);
}

console.log(
	`[publish-auth] npm auth OK as "${username}" with @${SCOPE} org access and write permissions for ${publishablePackages.length} package(s)`,
);
