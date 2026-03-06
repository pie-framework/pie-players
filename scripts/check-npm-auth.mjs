import { execFileSync } from "node:child_process";

const REGISTRY = "https://registry.npmjs.org/";
const SCOPE = "pie-players";

const run = (cmd, args) =>
	execFileSync(cmd, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

const fail = (message, details) => {
	console.error(`\n[publish-auth] ${message}`);
	if (details) {
		console.error(details);
	}
	console.error("\n[publish-auth] Fix:");
	console.error("- Run `npm login --registry=https://registry.npmjs.org/`");
console.error("- Run `npm config set registry https://registry.npmjs.org/` if needed");
console.error("- Verify access with `npm org ls pie-players --registry=https://registry.npmjs.org/`");
	console.error("- Retry publish after `npm whoami` succeeds");
	process.exit(1);
};

let username = "";
try {
	username = run("npm", ["whoami", "--registry", REGISTRY]);
} catch (error) {
	const details = error?.stderr?.toString?.() || error?.message || String(error);
	fail(
		"npm authentication failed (token missing, expired, or revoked).",
		details,
	);
}

try {
	run("npm", ["org", "ls", SCOPE, "--registry", REGISTRY]);
} catch (error) {
	const details = error?.stderr?.toString?.() || error?.message || String(error);
	fail(
		`npm auth user "${username}" cannot verify access to @${SCOPE}.`,
		details,
	);
}

console.log(`[publish-auth] npm auth OK as "${username}" with @${SCOPE} org access`);
