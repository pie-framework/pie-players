#!/usr/bin/env bun

/**
 * Simple HTTP server that serves package dist files for demos
 * This mimics CDN behavior by serving files from workspace packages
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "bun";

const PORT = 4874;
const WORKSPACE_ROOT = process.cwd();

// Map of package name to package directory
const packageDirs = new Map<string, string>();

// Scan workspace packages
function scanWorkspaces() {
	const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
	const { globSync } = require("glob");

	for (const pattern of pkg.workspaces) {
		const dirs = globSync(pattern, { ignore: ["**/node_modules/**"] });
		for (const dir of dirs) {
			const pkgPath = join(dir, "package.json");
			if (existsSync(pkgPath)) {
				const pkgJson = JSON.parse(readFileSync(pkgPath, "utf-8"));
				packageDirs.set(pkgJson.name, dir);
			}
		}
	}

	console.log(`📦 Found ${packageDirs.size} packages`);
}

scanWorkspaces();

serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const path = url.pathname;

		// Handle CORS preflight requests
		if (req.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, OPTIONS",
					"Access-Control-Allow-Headers": "*",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Parse URL formats:
		// Format 1: /@scope/package-name/version/file/path.js (with version - version must start with digit)
		// Format 2: /@scope/package-name/file/path.js (without version - simpler CDN-style)
		// Format 3: /@scope/package-name (bare package import)
		const matchWithVersion = path.match(/^\/(@[^/]+\/[^/]+)\/(\d[^/]*)\/(.+)$/);
		const matchWithoutVersion = path.match(/^\/(@[^/]+\/[^/]+)\/(.+)$/);
		const matchBarePackage = path.match(/^\/(@[^/]+\/[^/]+)$/);

		let packageName: string;
		let filePath: string;

		if (matchWithVersion) {
			// Format 1: Has version (version starts with digit)
			[, packageName, , filePath] = matchWithVersion;
		} else if (matchWithoutVersion) {
			// Format 2: No version - treat first path segment after package as file path
			[, packageName, filePath] = matchWithoutVersion;

			// Check if this looks like a directory request (no file extension)
			const isDirectory =
				!filePath.endsWith(".js") &&
				!filePath.endsWith(".json") &&
				!filePath.endsWith(".css") &&
				!filePath.endsWith("/");

			if (isDirectory) {
				// Redirect to add trailing slash so relative imports work correctly
				return new Response(null, {
					status: 301,
					headers: {
						Location: `${path}/`,
						"Access-Control-Allow-Origin": "*",
					},
				});
			}

			// If filePath ends with /, append index.js
			if (filePath.endsWith("/")) {
				filePath = `${filePath}index.js`;
			}

			// If filePath doesn't start with 'dist/', prepend it
			if (!filePath.startsWith("dist/")) {
				filePath = `dist/${filePath}`;
			}
		} else if (matchBarePackage) {
			// Format 3: Bare package - redirect to dist/ so relative imports work
			[, packageName] = matchBarePackage;
			return new Response(null, {
				status: 301,
				headers: {
					Location: `${path}/dist/`,
					"Access-Control-Allow-Origin": "*",
				},
			});
		} else {
			return new Response("Invalid package URL", { status: 400 });
		}

		const packageDir = packageDirs.get(packageName);

		if (!packageDir) {
			return new Response(`Package not found: ${packageName}`, { status: 404 });
		}

		// Serve file from package directory
		const fullPath = join(WORKSPACE_ROOT, packageDir, filePath);

		if (!existsSync(fullPath)) {
			console.error(`File not found: ${fullPath}`);
			console.error(`  Package: ${packageName}`);
			console.error(`  File path: ${filePath}`);
			console.error(`  Package dir: ${packageDir}`);
			return new Response(`File not found: ${filePath}`, { status: 404 });
		}

		const file = Bun.file(fullPath);
		const contentType = getContentType(filePath);

		return new Response(file, {
			headers: {
				"Content-Type": contentType,
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, OPTIONS",
				"Access-Control-Allow-Headers": "*",
				"Cache-Control": "no-cache",
			},
		});
	},
});

function getContentType(filePath: string): string {
	if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
		return "application/javascript";
	if (filePath.endsWith(".json")) return "application/json";
	if (filePath.endsWith(".css")) return "text/css";
	if (filePath.endsWith(".html")) return "text/html";
	if (filePath.endsWith(".map")) return "application/json";
	return "application/octet-stream";
}

console.log(`🚀 Package server running at http://localhost:${PORT}`);
console.log(`   Serving files from workspace packages`);
console.log(
	`   Example: http://localhost:${PORT}/@pie-players/assessment-player/0.1.0/dist/pie-assessment-player.js`,
);
