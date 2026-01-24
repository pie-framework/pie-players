import { spawn } from "node:child_process";
import type { BuildScope, LocalEsmCdnConfig } from "../core/config.js";
import { createContext } from "../core/config.js";
import { handleRequest } from "../core/handler.js";

/**
 * Options for standalone Bun server
 */
export interface StandaloneServerOptions {
	/** Port to listen on (default: 5179) */
	port?: number;

	/** Allow fallback to random port if specified port is in use */
	allowRandomPortFallback?: boolean;

	/** Run a self-test and exit after starting */
	selfTest?: boolean;

	/** Configuration for the local ESM CDN */
	config?: Partial<LocalEsmCdnConfig>;
}

/**
 * Run build process before starting the server
 */
async function maybeRunBuild(
	repoRoot: string,
	buildScope: BuildScope,
): Promise<void> {
	if (buildScope === "none") return;

	// eslint-disable-next-line no-console
	console.log(
		`[local-esm-cdn] Running build before starting server (scope=${buildScope})...`,
	);

	const args =
		buildScope === "all"
			? ["run", "build"]
			: [
					"x",
					"turbo",
					"run",
					"build",
					"--filter=./packages/elements-react/*",
					"--filter=./packages/lib-react/*",
					"--filter=!@pie-lib/test-utils",
				];

	await new Promise<void>((resolve, reject) => {
		const child = spawn("bun", args, {
			cwd: repoRoot,
			stdio: "inherit",
			env: process.env,
		});

		child.on("error", (err: Error) => reject(err));
		child.on("exit", (code: number | null) => {
			if (code === 0) resolve();
			else reject(new Error(`Build failed (exit code ${code ?? "null"})`));
		});
	});
}

/**
 * Create and start a standalone Bun server
 */
export async function createStandaloneServer(
	options: StandaloneServerOptions = {},
): Promise<ReturnType<typeof Bun.serve>> {
	const {
		port = 5179,
		allowRandomPortFallback = true,
		selfTest = false,
		config = {},
	} = options;

	// Create context with merged config
	const context = createContext({
		pieElementsNgRoot: "",
		piePlayersRoot: "",
		esmShBaseUrl: "https://esm.sh",
		...config,
	});

	// Run build if needed (build pie-elements-ng repo)
	if (context.config.preBuild && context.config.buildScope) {
		await maybeRunBuild(
			context.config.pieElementsNgRoot,
			context.config.buildScope,
		);
	}

	// Create fetch handler
	const fetchHandler: Parameters<typeof Bun.serve>[0]["fetch"] = async (
		req,
	) => {
		return handleRequest(req, context);
	};

	// Try to start server
	let server: ReturnType<typeof Bun.serve> | null = null;
	try {
		server = Bun.serve({ port, fetch: fetchHandler } as any);
	} catch (e: any) {
		const code = e?.code ?? e?.errno ?? e?.cause?.code;
		if (code === "EADDRINUSE" && port !== 0 && allowRandomPortFallback) {
			// eslint-disable-next-line no-console
			console.warn(
				`[local-esm-cdn] Port ${port} is in use. Retrying with a random free port...`,
			);
			server = Bun.serve({ port: 0, fetch: fetchHandler } as any);
		} else {
			throw e;
		}
	}

	// Log server info
	// eslint-disable-next-line no-console
	console.log(
		`[local-esm-cdn] Serving PIE modules from:\n  pie-elements-ng: ${context.config.pieElementsNgRoot}\n  pie-players: ${context.config.piePlayersRoot}`,
	);
	// eslint-disable-next-line no-console
	console.log(`[local-esm-cdn] Listening on: http://localhost:${server.port}`);
	// eslint-disable-next-line no-console
	console.log(
		`[local-esm-cdn] Rewriting external imports to: ${context.config.esmShBaseUrl}`,
	);

	// Run self-test if requested
	if (selfTest) {
		try {
			const res = await fetch(`http://localhost:${server.port}/health`);
			const body = await res.text();
			// eslint-disable-next-line no-console
			console.log(`[local-esm-cdn] SELF_TEST /health status=${res.status}`);
			// eslint-disable-next-line no-console
			console.log(body.slice(0, 500));
		} finally {
			server.stop(true);
		}
	}

	return server;
}
