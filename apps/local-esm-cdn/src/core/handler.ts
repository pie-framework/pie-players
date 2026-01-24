import { readFile } from "node:fs/promises";
import { rewriteImports } from "../rewrite-imports.js";
import type { LocalEsmCdnContext } from "./config.js";
import { getHealth } from "./health.js";
import { parsePackageRequest, resolveEntryFile } from "./resolver.js";
import { js, json, text, withCors } from "./utils.js";

/**
 * Generate help text for the server
 */
function generateHelpText(config: {
	pieElementsNgRoot: string;
	piePlayersRoot: string;
	esmShBaseUrl: string;
}): string {
	return `PIE local ESM CDN (dev-only)

This server serves local built PIE packages from disk and rewrites *external* imports to ${config.esmShBaseUrl}.

Endpoints:
  GET  /health
  GET  /@pie-element/<name>@<version>[/<subpath>]
  GET  /@pie-lib/<name>@<version>[/<subpath>]
  GET  /@pie-players/<name>@<version>[/<subpath>]

Env:
  PIE_ELEMENTS_NG_PATH=${config.pieElementsNgRoot}
  PIE_PLAYERS_PATH=${config.piePlayersRoot}
  LOCAL_ESM_CDN_ESM_SH_BASE_URL=${config.esmShBaseUrl}
`;
}

/**
 * Handle an HTTP request
 * @param request - The incoming request
 * @param context - The local ESM CDN context
 * @returns The HTTP response
 */
export async function handleRequest(
	request: Request,
	context: LocalEsmCdnContext,
): Promise<Response> {
	const url = new URL(request.url);

	// CORS preflight
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: withCors() });
	}

	// Help endpoint
	if (url.pathname === "/" || url.pathname === "/__help") {
		const helpText = generateHelpText({
			pieElementsNgRoot: context.config.pieElementsNgRoot,
			piePlayersRoot: context.config.piePlayersRoot,
			esmShBaseUrl: context.config.esmShBaseUrl,
		});
		return text(helpText);
	}

	// Health check endpoint
	if (url.pathname === "/health") {
		const health = await getHealth(context.config.pieElementsNgRoot);
		return json(health, { status: health.ok ? 200 : 503 });
	}

	// Parse package request
	const parsed = parsePackageRequest(url.pathname);
	if (!parsed) {
		const helpText = generateHelpText({
			pieElementsNgRoot: context.config.pieElementsNgRoot,
			piePlayersRoot: context.config.piePlayersRoot,
			esmShBaseUrl: context.config.esmShBaseUrl,
		});
		return text(`Not found.\n\n${helpText}`, { status: 404 });
	}

	// Check health before serving packages (only check pie-elements-ng for now)
	const health = await getHealth(context.config.pieElementsNgRoot);
	if (!health.ok) {
		return json(
			{
				error: "Local ESM CDN is not ready: missing built artifacts.",
				hint: "Run `bun run build` in pie-elements-ng and pie-players (or build the relevant packages) and try again.",
				health,
			},
			{ status: 503 },
		);
	}

	// Resolve the entry file on disk
	const entryFile = await resolveEntryFile(
		context.config.pieElementsNgRoot,
		context.config.piePlayersRoot,
		parsed.pkg,
		parsed.subpath,
	);
	if (!entryFile) {
		return json(
			{
				error: "Entrypoint not found on disk.",
				requested: parsed,
				tried: {
					pkg: parsed.pkg,
					subpath: parsed.subpath,
				},
				hint: "Ensure pie-elements-ng and pie-players are built and the package exists.",
			},
			{ status: 404 },
		);
	}

	// Read and rewrite the file
	const code = await readFile(entryFile, "utf8");
	const rewritten = await rewriteImports(code, {
		esmShBaseUrl: context.config.esmShBaseUrl,
		pkg: parsed.pkg,
		subpath: parsed.subpath,
	});

	// Log if rewriting changed the code
	if (rewritten === code) {
		console.log(
			`[local-esm-cdn] No rewrites for ${parsed.pkg}${parsed.subpath ? "/" + parsed.subpath : ""}`,
		);
	} else {
		const changes = rewritten.length - code.length;
		console.log(
			`[local-esm-cdn] Rewrote ${parsed.pkg}${parsed.subpath ? "/" + parsed.subpath : ""} (${changes > 0 ? "+" : ""}${changes} chars)`,
		);
	}

	return js(rewritten, {
		headers: {
			"x-local-esm-cdn-file": entryFile,
		},
	});
}
