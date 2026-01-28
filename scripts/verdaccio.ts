#!/usr/bin/env bun

/**
 * Verdaccio registry management script
 *
 * Usage:
 *   bun scripts/verdaccio.ts start   - Start Verdaccio
 *   bun scripts/verdaccio.ts stop    - Stop Verdaccio
 *   bun scripts/verdaccio.ts check   - Check if Verdaccio is running
 *   bun scripts/verdaccio.ts status  - Show detailed status
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { $, sleep } from "bun";

const VERDACCIO_URL = "http://localhost:4873";
const PING_ENDPOINT = `${VERDACCIO_URL}/-/ping`;
const MAX_WAIT_SECONDS = 30;

async function isDockerRunning(): Promise<boolean> {
	try {
		await $`docker info`.quiet();
		return true;
	} catch {
		return false;
	}
}

async function isVerdaccioResponding(): Promise<boolean> {
	try {
		const response = await fetch(PING_ENDPOINT, {
			method: "GET",
			signal: AbortSignal.timeout(5000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function isContainerRunning(): Promise<boolean> {
	try {
		const result =
			await $`docker ps --filter name=pie-players-verdaccio --format {{.Names}}`.quiet();
		return result.text().trim() === "pie-players-verdaccio";
	} catch {
		return false;
	}
}

async function waitForVerdaccio(): Promise<boolean> {
	console.log("⏳ Waiting for Verdaccio to be ready...");

	for (let i = 0; i < MAX_WAIT_SECONDS; i++) {
		if (await isVerdaccioResponding()) {
			console.log("✅ Verdaccio is ready!");
			return true;
		}
		await sleep(1000);
		process.stdout.write(".");
	}

	console.log("\n❌ Verdaccio did not become ready in time");
	return false;
}

async function isLoggedIn(): Promise<boolean> {
	try {
		const result = await $`npm whoami --registry ${VERDACCIO_URL}`.quiet();
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

async function login() {
	console.log("🔐 Setting up npm authentication for local registry...\n");

	if (await isLoggedIn()) {
		console.log("✅ Already authenticated with Verdaccio");
		return;
	}

	try {
		// Create a temporary .npmrc entry for the local registry
		// Using npm-cli-adduser to automate the process
		const username = "local-dev";
		const password = "local-dev";
		const email = "dev@localhost";

		console.log("📝 Adding user to registry...");

		// Use curl to add user directly to Verdaccio
		const authResponse = await fetch(
			`${VERDACCIO_URL}/-/user/org.couchdb.user:${username}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: username,
					password: password,
				}),
			},
		);

		if (!authResponse.ok) {
			const text = await authResponse.text();
			throw new Error(`Failed to add user: ${text}`);
		}

		const authData = await authResponse.json();
		const token = authData.token;

		// Set npm auth token for this registry
		await $`npm config set //localhost:4873/:_authToken ${token}`;

		console.log("✅ Authentication configured");
		console.log(`👤 User: ${username}`);
	} catch (error) {
		console.error("❌ Failed to configure authentication");
		console.error(error);
		console.error(
			"\n📝 You may need to run: npm adduser --registry http://localhost:4873",
		);
		process.exit(1);
	}
}

async function start() {
	console.log("🚀 Starting Verdaccio registry...\n");

	// Check Docker
	if (!(await isDockerRunning())) {
		console.error("❌ Docker is not running!");
		console.error("\n📝 Please start Docker Desktop and try again.");
		console.error("   On macOS: Open Docker Desktop from Applications");
		console.error("   On Linux: sudo systemctl start docker");
		console.error("   On Windows: Start Docker Desktop\n");
		process.exit(1);
	}

	// Check if already running
	if (await isContainerRunning()) {
		if (await isVerdaccioResponding()) {
			console.log("✅ Verdaccio is already running at", VERDACCIO_URL);
			console.log("📦 View packages: open", VERDACCIO_URL);
			return;
		} else {
			console.log("⚠️  Container exists but not responding. Restarting...");
			await $`docker compose restart verdaccio`;
		}
	} else {
		// Start fresh
		await $`docker compose up -d verdaccio`;
	}

	// Wait for it to be ready
	if (await waitForVerdaccio()) {
		console.log("\n✅ Verdaccio is running at", VERDACCIO_URL);
		console.log("📦 View packages:", VERDACCIO_URL);

		// Automatically set up authentication
		await login();

		console.log("\n📝 Next steps:");
		console.log("   Publish packages: bun run registry:publish");
		console.log("   Run demos: bun run dev:demo assessment-player");
	} else {
		console.error("\n❌ Verdaccio started but is not responding");
		console.error("📝 Check logs: bun run registry:logs");
		process.exit(1);
	}
}

async function stop() {
	console.log("🛑 Stopping Verdaccio registry...\n");

	if (!(await isContainerRunning())) {
		console.log("ℹ️  Verdaccio is not running");
		return;
	}

	await $`docker compose down`;
	console.log("✅ Verdaccio stopped");
}

async function check() {
	const dockerRunning = await isDockerRunning();
	const containerRunning = await isContainerRunning();
	const responding = await isVerdaccioResponding();

	if (!dockerRunning) {
		console.error("❌ Docker is not running");
		console.error("📝 Start Docker Desktop and try again\n");
		process.exit(1);
	}

	if (!containerRunning) {
		console.error("❌ Verdaccio container is not running");
		console.error("📝 Start it with: bun run registry:start\n");
		process.exit(1);
	}

	if (!responding) {
		console.error("❌ Verdaccio container is running but not responding");
		console.error("📝 Check logs: bun run registry:logs");
		console.error(
			"📝 Restart: bun run registry:stop && bun run registry:start\n",
		);
		process.exit(1);
	}

	console.log("✅ Verdaccio is running and responding");
	console.log("📦 URL:", VERDACCIO_URL);
}

async function status() {
	console.log("🔍 Verdaccio Status\n");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

	const dockerRunning = await isDockerRunning();
	console.log(`Docker:     ${dockerRunning ? "✅ Running" : "❌ Not running"}`);

	const containerRunning = await isContainerRunning();
	console.log(
		`Container:  ${containerRunning ? "✅ Running" : "❌ Not running"}`,
	);

	const responding = await isVerdaccioResponding();
	console.log(`Responding: ${responding ? "✅ Yes" : "❌ No"}`);

	console.log(`\nURL:        ${VERDACCIO_URL}`);

	if (containerRunning) {
		try {
			const logsResult =
				await $`docker compose logs --tail=5 verdaccio`.quiet();
			console.log("\nRecent logs:");
			console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			console.log(logsResult.text());
		} catch {
			console.log("\n⚠️  Could not fetch logs");
		}
	}

	console.log("\n📝 Commands:");
	console.log("   Start:   bun run registry:start");
	console.log("   Stop:    bun run registry:stop");
	console.log("   Logs:    bun run registry:logs");
	console.log("   Publish: bun run registry:publish");
}

async function getWorkspaces(): Promise<string[]> {
	const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
	const workspaces = pkg.workspaces;
	const glob = await import("glob");

	const dirs: string[] = [];
	for (const pattern of workspaces) {
		const matches = glob.globSync(pattern, { ignore: ["**/node_modules/**"] });
		dirs.push(...matches);
	}
	return dirs;
}

async function publish() {
	console.log("📦 Building and publishing packages to local registry...\n");

	// Check Verdaccio is running
	await check();

	// Ensure we're logged in
	if (!(await isLoggedIn())) {
		await login();
	}

	console.log("\n🔨 Building packages...");
	await $`bun run build`;

	console.log("\n📤 Publishing packages...");

	const workspaces = await getWorkspaces();
	let published = 0;
	let skipped = 0;
	let errors = 0;

	for (const workspace of workspaces) {
		const pkgPath = join(workspace, "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

		// Skip private packages
		if (pkg.private) {
			skipped++;
			continue;
		}

		try {
			// Try to publish
			await $`npm publish --registry ${VERDACCIO_URL}`.cwd(workspace);
			console.log(`  ✅ ${pkg.name}@${pkg.version}`);
			published++;
		} catch (error: any) {
			// Check if already published
			const errorOutput =
				error.stderr?.toString() ||
				error.stdout?.toString() ||
				error.message ||
				"";
			if (
				errorOutput.includes("previously published") ||
				errorOutput.includes("already exists") ||
				errorOutput.includes("cannot publish")
			) {
				console.log(`  ⏭️  ${pkg.name} (already published)`);
				skipped++;
			} else {
				// Show first line of error for debugging
				const firstLine = errorOutput.split("\n")[0];
				console.error(`  ❌ ${pkg.name}: ${firstLine}`);
				errors++;
			}
		}
	}

	console.log(`\n✅ Publishing complete!`);
	console.log(`   Published: ${published}`);
	console.log(`   Skipped: ${skipped}`);
	if (errors > 0) {
		console.log(`   Errors: ${errors}`);
	}
	console.log(`\n📦 View packages: ${VERDACCIO_URL}`);
}

// Main
const command = process.argv[2];

switch (command) {
	case "start":
		await start();
		break;
	case "stop":
		await stop();
		break;
	case "check":
		await check();
		break;
	case "status":
		await status();
		break;
	case "login":
		await check();
		await login();
		break;
	case "publish":
		await publish();
		break;
	default:
		console.error(
			"Usage: bun scripts/verdaccio.ts <start|stop|check|status|login|publish>",
		);
		process.exit(1);
}
