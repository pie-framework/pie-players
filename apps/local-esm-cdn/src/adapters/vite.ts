import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import type { LocalEsmCdnConfig } from "../core/config.js";
import { createLocalEsmCdn } from "../embedded.js";

const LOCAL_CDN_REQUEST = /^\/@pie-(?:element|lib|elements-ng)\//;
// Requests Vite's module transform does not answer: the package.json an ESM
// loader reads for a package's exports, and the fonts a build's stylesheet
// addresses by URL.
const FILE_REQUEST =
	/^\/@pie-(?:element|lib|elements-ng)\/[^?#]+(?:\/package\.json|\.woff2)(?:[?#]|$)/;
// Vite resolves a module's `new URL("./asset", import.meta.url)` against the
// module's id as a path on disk, which this URL space is not. Marked ignored,
// the URL resolves in the browser against the module's URL, as from a CDN.
const RELATIVE_ASSET_URL = /\bnew\s+URL\s*\(\s*(?=["'`]\.\.?\/)/g;

/**
 * Create a Vite plugin that serves local PIE packages as ESM modules
 *
 * @param config - Configuration for the local ESM CDN
 * @returns A Vite plugin
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { createVitePlugin } from './apps/local-esm-cdn/src/adapters/vite';
 * import path from 'path';
 *
 * export default defineConfig({
 *   plugins: [
 *     createVitePlugin({
 *       pieElementsNgRoot: path.resolve(__dirname, '../../../pie-elements-ng'),
 *       piePlayersRoot: path.resolve(__dirname, '../..'),
 *       esmShBaseUrl: 'https://esm.sh',
 *     })
 *   ],
 * });
 * ```
 */
export function createVitePlugin(config: Partial<LocalEsmCdnConfig>): Plugin {
	const cdn = createLocalEsmCdn(config);
	let server: ViteDevServer | undefined;

	return {
		name: "vite-plugin-local-esm-cdn",
		enforce: "pre", // Run before other plugins

		resolveId(id) {
			// Only this server's URL space, which the ESM loader and the served
			// modules' rewritten imports address. A bare specifier in the app's own
			// graph, such as players-shared's `@pie-lib/math-rendering-module`,
			// resolves from node_modules as it does without the plugin.
			if (LOCAL_CDN_REQUEST.test(id)) return { id, external: false };
			return null;
		},

		async load(id) {
			if (!LOCAL_CDN_REQUEST.test(id)) return null;

			try {
				console.log(`[vite-plugin-local-esm-cdn] Loading: ${id}`);

				// Convert to Web Request
				const url = `http://localhost${id}`;
				const request = new Request(url, {
					method: "GET",
				});

				// Get response from CDN
				const response = await cdn.handler(request);
				console.log(
					`[vite-plugin-local-esm-cdn] Response: ${response.status} ${response.statusText}`,
				);

				if (!response.ok) {
					throw new Error(
						`Failed to load ${id}: ${response.status} ${response.statusText}`,
					);
				}

				const code = (await response.text()).replace(
					RELATIVE_ASSET_URL,
					"$&/* @vite-ignore */ ",
				);
				return { code, map: null };
			} catch (error) {
				console.error("[vite-plugin-local-esm-cdn] Error:", error);
				throw error;
			}
		},

		configureServer(serverInstance) {
			server = serverInstance;

			serverInstance.middlewares.use((req, res, next) => {
				if (!req.url || !FILE_REQUEST.test(req.url)) return next();
				cdn
					.handler(new Request(`http://localhost${req.url}`))
					.then(async (response) => {
						res.statusCode = response.status;
						response.headers.forEach((value, key) => {
							res.setHeader(key, value);
						});
						res.end(Buffer.from(await response.arrayBuffer()));
					})
					.catch(next);
			});

			// Only set up file watching in dev mode
			if (!config.pieElementsNgRoot && !config.piePlayersRoot) {
				console.warn(
					"[vite-plugin-local-esm-cdn] No repo roots configured, skipping file watching",
				);
				return;
			}

			const watchPaths: string[] = [];

			// Watch pie-elements-ng dist directories
			if (config.pieElementsNgRoot) {
				watchPaths.push(
					path.join(
						config.pieElementsNgRoot,
						"packages/elements-react/*/dist/**",
					),
					path.join(
						config.pieElementsNgRoot,
						"packages/elements-svelte/*/dist/**",
					),
					path.join(config.pieElementsNgRoot, "packages/lib-react/*/dist/**"),
					path.join(config.pieElementsNgRoot, "packages/shared/*/dist/**"),
				);
			}

			// Watch pie-players dist directories
			if (config.piePlayersRoot) {
				watchPaths.push(path.join(config.piePlayersRoot, "packages/*/dist/**"));
			}

			console.log(
				"[vite-plugin-local-esm-cdn] Setting up file watchers for:",
				watchPaths,
			);

			// Add paths to Vite's watcher
			watchPaths.forEach((pattern) => {
				if (server) {
					server.watcher.add(pattern);
				}
			});

			// Listen for file changes
			server.watcher.on("change", (filePath: string) => {
				// Only process dist files
				if (filePath.includes("/dist/")) {
					console.log(`[vite-plugin-local-esm-cdn] File changed: ${filePath}`);
					invalidateModulesForDistFile(filePath);
				}
			});

			server.watcher.on("add", (filePath: string) => {
				if (filePath.includes("/dist/")) {
					console.log(`[vite-plugin-local-esm-cdn] File added: ${filePath}`);
					invalidateModulesForDistFile(filePath);
				}
			});

			server.watcher.on("unlink", (filePath: string) => {
				if (filePath.includes("/dist/")) {
					console.log(`[vite-plugin-local-esm-cdn] File deleted: ${filePath}`);
					invalidateModulesForDistFile(filePath);
				}
			});
		},
	};

	/**
	 * Invalidate Vite modules when a dist file changes
	 */
	function invalidateModulesForDistFile(filePath: string) {
		if (!server) return;

		// Extract package name from dist path
		const packageName = getPackageNameFromDistPath(filePath);
		if (!packageName) {
			console.warn(
				`[vite-plugin-local-esm-cdn] Could not determine package name for: ${filePath}`,
			);
			return;
		}

		console.log(
			`[vite-plugin-local-esm-cdn] Invalidating modules for package: ${packageName}`,
		);

		// Find all modules that match this package
		const moduleId = `/${packageName}`;
		const modules = server.moduleGraph.getModulesByFile(moduleId);

		if (modules && modules.size > 0) {
			modules.forEach((mod) => {
				console.log(
					`[vite-plugin-local-esm-cdn] Invalidating module: ${mod.id || mod.url}`,
				);
				if (server) {
					server.moduleGraph.invalidateModule(mod);
				}
			});

			// Trigger HMR update
			if (server) {
				server.ws.send({
					type: "full-reload",
					path: "*",
				});
			}
		} else {
			// Try to find by URL pattern
			const urlPattern = `/@pie-${packageName.split("/")[1]}`;
			const allModules = Array.from(server.moduleGraph.urlToModuleMap.keys());
			const matchingModules = allModules.filter((url) =>
				url.startsWith(urlPattern),
			);

			if (matchingModules.length > 0) {
				console.log(
					`[vite-plugin-local-esm-cdn] Found ${matchingModules.length} modules to invalidate`,
				);
				matchingModules.forEach((url) => {
					if (server) {
						const mod = server.moduleGraph.urlToModuleMap.get(url);
						if (mod) {
							console.log(
								`[vite-plugin-local-esm-cdn] Invalidating module: ${url}`,
							);
							server.moduleGraph.invalidateModule(mod);
						}
					}
				});

				// Trigger HMR update
				if (server) {
					server.ws.send({
						type: "full-reload",
						path: "*",
					});
				}
			}
		}
	}

	/**
	 * Extract package name from dist file path
	 * Handles both pie-elements-ng and pie-players packages
	 */
	function getPackageNameFromDistPath(filePath: string): string | null {
		const normalized = path.normalize(filePath);

		// Match patterns for pie-elements-ng packages
		const elementsNgPatterns = [
			{
				regex: /packages\/elements-react\/([^/]+)\/dist/,
				scope: "@pie-element",
			},
			{
				regex: /packages\/elements-svelte\/([^/]+)\/dist/,
				scope: "@pie-element",
			},
			{ regex: /packages\/lib-react\/([^/]+)\/dist/, scope: "@pie-lib" },
			{ regex: /packages\/shared\/([^/]+)\/dist/, scope: "@pie-elements-ng" },
		];

		for (const { regex, scope } of elementsNgPatterns) {
			const match = normalized.match(regex);
			if (match) {
				return `${scope}/${match[1]}`;
			}
		}

		// Match patterns for pie-players packages
		// pie-players/packages/<package-name>/dist -> @pie-players/pie-<package-name>
		const playersPattern = /pie-players\/packages\/([^/]+)\/dist/;
		const playersMatch = normalized.match(playersPattern);
		if (playersMatch) {
			const pkgName = playersMatch[1];
			return `@pie-players/pie-${pkgName}`;
		}

		return null;
	}
}
