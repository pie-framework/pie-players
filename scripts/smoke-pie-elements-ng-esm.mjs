import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
	buildEsmSmokeMatrix,
	createJsDelivrLocalMapper,
	findElementPackageDir,
} from "./lib/pie-elements-ng-esm-smoke.mjs";

const DEFAULT_CDN_PORT = 5179;
const DEFAULT_PAGE_PORT = 5401;

function parseArgs(argv) {
	const options = {
		pieElementsNgRoot: path.resolve(process.cwd(), "../pie-elements-ng"),
		only: new Set(),
		concurrency: 1,
		reportPath: path.resolve(
			process.cwd(),
			"tmp",
			"pie-elements-ng-esm-smoke-report.json",
		),
		cdnPort: DEFAULT_CDN_PORT,
		pagePort: DEFAULT_PAGE_PORT,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--pie-elements-ng-root") {
			options.pieElementsNgRoot = path.resolve(argv[++i]);
		} else if (arg === "--only") {
			for (const slug of String(argv[++i] ?? "").split(",")) {
				if (slug.trim()) options.only.add(slug.trim());
			}
		} else if (arg === "--concurrency") {
			const concurrency = Number.parseInt(argv[++i] ?? "", 10);
			if (!Number.isInteger(concurrency) || concurrency < 1) {
				throw new Error("--concurrency must be a positive integer");
			}
			options.concurrency = concurrency;
		} else if (arg === "--report") {
			options.reportPath = path.resolve(argv[++i]);
		} else if (arg === "--cdn-port") {
			options.cdnPort = Number.parseInt(
				argv[++i] ?? String(DEFAULT_CDN_PORT),
				10,
			);
		} else if (arg === "--page-port") {
			options.pagePort = Number.parseInt(
				argv[++i] ?? String(DEFAULT_PAGE_PORT),
				10,
			);
		} else if (arg === "--help") {
			options.help = true;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

function printHelp() {
	console.log(`Usage: bun scripts/smoke-pie-elements-ng-esm.mjs [options]

Options:
  --pie-elements-ng-root <path>  Path to pie-elements-ng (default: ../pie-elements-ng)
  --only <slug[,slug]>          Run a subset of element slugs
  --concurrency <n>             Number of browser pages to run at once (default: 1)
  --report <path>               JSON report output path
  --cdn-port <port>             local-esm-cdn port (default: ${DEFAULT_CDN_PORT})
  --page-port <port>            static host page port (default: ${DEFAULT_PAGE_PORT})
`);
}

function startProcess(name, command, args, { cwd, env = {} }) {
	const child = spawn(command, args, {
		cwd,
		env: { ...process.env, ...env },
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout.on("data", (chunk) =>
		process.stdout.write(`[${name}] ${chunk}`),
	);
	child.stderr.on("data", (chunk) =>
		process.stderr.write(`[${name}] ${chunk}`),
	);
	return child;
}

async function terminateChild(child) {
	if (child.killed || child.exitCode !== null || child.signalCode !== null)
		return;
	child.kill("SIGTERM");
	await Promise.race([
		new Promise((resolve) => child.once("close", resolve)),
		Bun.sleep(5_000),
	]);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill("SIGKILL");
	}
}

async function waitForHttp(url, label, timeoutMs = 120_000) {
	const deadline = Date.now() + timeoutMs;
	let lastError = null;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
			lastError = new Error(`${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await Bun.sleep(250);
	}
	throw new Error(
		`${label} did not become ready: ${lastError?.message ?? "unknown"}`,
	);
}

function packageJsonPath(pieElementsNgRoot, packageName) {
	const [scope, name] = packageName.split("/");
	if (scope === "@pie-element") {
		return findElementPackageDir(pieElementsNgRoot, name)
			? path.join(
					findElementPackageDir(pieElementsNgRoot, name),
					"package.json",
				)
			: null;
	}
	if (scope === "@pie-lib") {
		for (const workspace of ["lib-react", "lib-svelte"]) {
			const candidate = path.join(
				pieElementsNgRoot,
				"packages",
				workspace,
				name,
				"package.json",
			);
			if (existsSync(candidate)) return candidate;
		}
	}
	if (scope === "@pie-elements-ng") {
		const sharedName = name.replace(/^shared-/, "");
		const candidate = path.join(
			pieElementsNgRoot,
			"packages",
			"shared",
			sharedName,
			"package.json",
		);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function createStaticHostServer(playersRoot, pagePort) {
	return Bun.serve({
		hostname: "127.0.0.1",
		port: pagePort,
		async fetch(request) {
			const url = new URL(request.url);
			if (url.pathname === "/" || url.pathname === "/index.html") {
				return new Response(
					"<!doctype html><html><head><meta charset='utf-8'><title>PIE ESM smoke</title></head><body><main id='root'></main></body></html>",
					{ headers: { "content-type": "text/html" } },
				);
			}
			if (url.pathname.startsWith("/players/")) {
				const relative = path.normalize(url.pathname.slice("/players/".length));
				if (relative.startsWith("..")) {
					return new Response("Forbidden", { status: 403 });
				}
				const file = Bun.file(path.join(playersRoot, relative));
				if (await file.exists()) return new Response(file);
			}
			return new Response("Not found", { status: 404 });
		},
	});
}

async function installCdnRoutes(
	page,
	{ pieElementsNgRoot, localCdnBaseUrl, routed },
) {
	const mapper = createJsDelivrLocalMapper();
	await page.route("https://cdn.jsdelivr.net/**", async (route) => {
		const requestUrl = route.request().url();
		const parsed = mapper.parse(requestUrl);
		if (!parsed) return route.continue();

		if (parsed.subpath === "package.json") {
			const pkgJsonPath = packageJsonPath(
				pieElementsNgRoot,
				parsed.packageName,
			);
			if (!pkgJsonPath) {
				return route.fulfill({
					status: 404,
					body: `No local package.json for ${parsed.packageName}`,
				});
			}
			routed.push({
				url: requestUrl,
				local: pkgJsonPath,
				kind: "package-json",
			});
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: await readFile(pkgJsonPath, "utf8"),
			});
		}

		const localPath = mapper.toLocalCdnPath(requestUrl);
		if (!localPath) return route.continue();
		routed.push({ url: requestUrl, local: localPath, kind: "module" });
		const response = await route.fetch({
			url: `${localCdnBaseUrl}${localPath}${new URL(requestUrl).search}`,
		});
		return route.fulfill({ response });
	});
}

function isIgnorableConsoleError(text) {
	return (
		text.includes("favicon") ||
		text.includes("Failed to load resource") ||
		text.includes("Unable to load locale:")
	);
}

function isIgnorableRequestFailure(url, errorText) {
	return (
		url.endsWith("/runtime-support/+esm") && errorText === "net::ERR_ABORTED"
	);
}

async function smokeDelivery(page, entry) {
	await page.evaluate(async ({ slug, elementTag, model, session, markup }) => {
		document.body.innerHTML = '<main id="mount"></main>';
		const player = document.createElement("pie-item-player");
		player.strategy = "esm";
		player.loaderOptions = { runtimeSupportCheck: "on" };
		player.env = { mode: "gather", role: "student" };
		player.config = {
			id: `${slug}-smoke`,
			markup,
			elements: { [elementTag]: `@pie-element/${slug}@latest` },
			models: [model],
		};
		player.session = { id: `${slug}-attempt`, data: [session] };
		document.getElementById("mount").appendChild(player);
		await new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`${slug} load timeout`)),
				45_000,
			);
			player.addEventListener(
				"load-complete",
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
			player.addEventListener(
				"player-error",
				(event) => {
					clearTimeout(timer);
					reject(
						new Error(
							`${slug} player-error: ${event.detail?.message ?? "unknown"}`,
						),
					);
				},
				{ once: true },
			);
		});
	}, entry);

	return page.evaluate((elementTag) => {
		const versionedTag = `${elementTag}--version-latest`;
		const element = document.querySelector(versionedTag);
		const player = document.querySelector("pie-item-player");
		return {
			playerStrategy: player?.strategy ?? null,
			hasVersionedElement: Boolean(element),
			text:
				document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) ??
				"",
		};
	}, entry.elementTag);
}

const expectedControllerExports = [
	"createDefaultModel",
	"getScore",
	"model",
	"normalize",
	"outcome",
	"validate",
];

async function smokeDirectViews(browser, entry, context) {
	const results = [];
	const failures = [];
	const ignoredFailures = [];
	for (const { view } of entry.browserViews) {
		const page = await browser.newPage();
		const routed = [];
		const url = `https://cdn.jsdelivr.net/npm/${entry.packageName}@latest/dist/browser/${view}/index.js`;
		try {
			await installCdnRoutes(page, { ...context, routed });
			page.on("pageerror", (error) =>
				failures.push(`${view} pageerror: ${error.message}`),
			);
			page.on("console", (message) => {
				if (message.type() !== "error") return;
				const text = message.text();
				if (!isIgnorableConsoleError(text)) {
					failures.push(`${view} console error: ${text}`);
				}
			});
			page.on("requestfailed", (request) => {
				const failedUrl = request.url();
				if (failedUrl.includes("favicon")) return;
				const errorText = request.failure()?.errorText ?? "";
				if (isIgnorableRequestFailure(failedUrl, errorText)) {
					ignoredFailures.push(`request failed: ${failedUrl} ${errorText}`);
					return;
				}
				failures.push(`${view} request failed: ${failedUrl} ${errorText}`);
			});
			await page.goto(context.hostPageUrl, { waitUntil: "domcontentloaded" });
			const result = await page.evaluate(
				async ({ url, view, expectedControllerExports }) => {
					const timeout = new Promise((_, reject) => {
						setTimeout(
							() => reject(new Error(`${view} import timeout`)),
							30_000,
						);
					});
					const mod = await Promise.race([import(url), timeout]);
					const keys = Object.keys(mod).sort();
					const defaultType = typeof mod.default;
					const ok =
						view === "controller"
							? expectedControllerExports.some((name) => keys.includes(name))
							: defaultType === "function" || typeof mod.Element === "function";
					return { view, url, ok, keys, defaultType };
				},
				{ url, view, expectedControllerExports },
			);
			results.push({ ...result, routedRequestCount: routed.length });
		} catch (error) {
			failures.push(`${view}: ${error?.message ?? String(error)}`);
			results.push({
				view,
				url,
				ok: false,
				keys: [],
				defaultType: "unavailable",
				routedRequestCount: routed.length,
			});
		} finally {
			await page.close().catch(() => {});
		}
	}
	return { results, failures, ignoredFailures };
}

async function runOneEntry(browser, entry, context) {
	const page = await browser.newPage();
	const routed = [];
	const failures = [];
	const ignoredFailures = [];
	const startedAt = Date.now();
	try {
		await installCdnRoutes(page, { ...context, routed });
		page.on("pageerror", (error) =>
			failures.push(`pageerror: ${error.message}`),
		);
		page.on("console", (message) => {
			if (message.type() !== "error") return;
			const text = message.text();
			if (!isIgnorableConsoleError(text))
				failures.push(`console error: ${text}`);
		});
		page.on("requestfailed", (request) => {
			const url = request.url();
			if (url.includes("favicon")) return;
			const errorText = request.failure()?.errorText ?? "";
			if (isIgnorableRequestFailure(url, errorText)) {
				ignoredFailures.push(`request failed: ${url} ${errorText}`);
				return;
			}
			failures.push(`request failed: ${url} ${errorText}`);
		});

		await page.goto(context.hostPageUrl, { waitUntil: "domcontentloaded" });
		await page.addScriptTag({
			type: "module",
			content:
				"import '/players/packages/item-player/dist/pie-item-player.js'; window.__PIE_ITEM_PLAYER_READY__ = true;",
		});
		await page.waitForFunction(
			() => window.__PIE_ITEM_PLAYER_READY__ === true,
			null,
			{
				timeout: 30_000,
			},
		);

		const delivery = await smokeDelivery(page, entry);
		if (delivery.playerStrategy !== "esm") {
			failures.push(`expected esm strategy, got ${delivery.playerStrategy}`);
		}
		if (!delivery.hasVersionedElement) {
			failures.push(`versioned element missing for ${entry.elementTag}`);
		}
		if (!routed.some((route) => route.url.includes(`/${entry.packageName}@`))) {
			failures.push(`no routed CDN requests for ${entry.packageName}`);
		}
		if (
			entry.browserViews.some((view) => view.view === "controller") &&
			!routed.some((route) =>
				route.url.includes(
					`/${entry.packageName}@latest/dist/browser/controller/index.js`,
				),
			)
		) {
			failures.push(
				`controller browser entry was not requested for ${entry.slug}`,
			);
		}

		const directViewResult = await smokeDirectViews(browser, entry, {
			pieElementsNgRoot: context.pieElementsNgRoot,
			localCdnBaseUrl: context.localCdnBaseUrl,
			hostPageUrl: context.hostPageUrl,
		});
		const directViews = directViewResult.results;
		failures.push(...directViewResult.failures);
		ignoredFailures.push(...directViewResult.ignoredFailures);
		for (const viewResult of directViews) {
			if (!viewResult.ok) {
				failures.push(
					`direct import for ${entry.slug}/${viewResult.view} did not expose expected module shape`,
				);
			}
		}

		return {
			slug: entry.slug,
			packageName: entry.packageName,
			kind: entry.kind,
			fixtureId: entry.fixtureId,
			registrationOnly: entry.registrationOnly,
			browserViews: entry.browserViews.map((view) => view.view),
			delivery,
			directViews,
			routedRequestCount:
				routed.length +
				directViews.reduce(
					(total, viewResult) => total + viewResult.routedRequestCount,
					0,
				),
			failures,
			ignoredFailures,
			durationMs: Date.now() - startedAt,
		};
	} catch (error) {
		failures.push(error?.message ?? String(error));
		return {
			slug: entry.slug,
			packageName: entry.packageName,
			kind: entry.kind,
			fixtureId: entry.fixtureId,
			registrationOnly: entry.registrationOnly,
			browserViews: entry.browserViews.map((view) => view.view),
			delivery: null,
			directViews: [],
			routedRequestCount: routed.length,
			failures,
			ignoredFailures,
			durationMs: Date.now() - startedAt,
		};
	} finally {
		await page.close().catch(() => {});
	}
}

async function runWithConcurrency(items, concurrency, worker) {
	const results = new Array(items.length);
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (next < items.length) {
				const index = next;
				next += 1;
				results[index] = await worker(items[index], index);
			}
		},
	);
	await Promise.all(workers);
	return results;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const playersRoot = process.cwd();
	const matrix = (
		await buildEsmSmokeMatrix({
			pieElementsNgRoot: options.pieElementsNgRoot,
		})
	).filter((entry) => options.only.size === 0 || options.only.has(entry.slug));
	if (matrix.length === 0) {
		throw new Error("ESM smoke matrix is empty");
	}

	const localCdnBaseUrl = `http://127.0.0.1:${options.cdnPort}`;
	const hostPageUrl = `http://127.0.0.1:${options.pagePort}/`;
	const children = [];
	let server;
	let browser;
	let cleanedUp = false;
	const cleanup = async () => {
		if (cleanedUp) return;
		cleanedUp = true;
		if (browser) await browser.close().catch(() => {});
		if (server) server.stop(true);
		for (const child of children.reverse()) {
			await terminateChild(child).catch(() => {});
		}
	};
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, async () => {
			await cleanup();
			process.exit(signal === "SIGINT" ? 130 : 143);
		});
	}

	try {
		children.push(
			startProcess(
				"local-esm-cdn",
				"bun",
				["run", "--cwd", "apps/local-esm-cdn", "dev"],
				{
					cwd: playersRoot,
					env: {
						LOCAL_ESM_CDN_SKIP_BUILD: "1",
						LOCAL_ESM_CDN_ALLOW_RANDOM_PORT_FALLBACK: "false",
						LOCAL_ESM_CDN_PORT: String(options.cdnPort),
						PIE_ELEMENTS_NG_PATH: options.pieElementsNgRoot,
						PIE_PLAYERS_PATH: playersRoot,
					},
				},
			),
		);
		server = createStaticHostServer(playersRoot, options.pagePort);
		await waitForHttp(`${localCdnBaseUrl}/health`, "local ESM CDN");
		await waitForHttp(hostPageUrl, "static smoke page");

		browser = await chromium.launch({ headless: true });
		const results = await runWithConcurrency(
			matrix,
			options.concurrency,
			async (entry) => {
				console.log(`[esm-smoke] ${entry.slug}`);
				return runOneEntry(browser, entry, {
					pieElementsNgRoot: options.pieElementsNgRoot,
					localCdnBaseUrl,
					hostPageUrl,
				});
			},
		);

		const failed = results.filter((result) => result.failures.length > 0);
		const report = {
			ok: failed.length === 0,
			startedAt: new Date().toISOString(),
			pieElementsNgRoot: options.pieElementsNgRoot,
			total: results.length,
			failed: failed.length,
			registrationOnly: results
				.filter((result) => result.registrationOnly)
				.map((r) => r.slug),
			results,
		};
		await mkdir(path.dirname(options.reportPath), { recursive: true });
		await writeFile(
			options.reportPath,
			JSON.stringify(report, null, 2),
			"utf8",
		);

		console.log(
			`[esm-smoke] ${report.total - report.failed}/${report.total} passed; report ${options.reportPath}`,
		);
		if (failed.length > 0) {
			for (const result of failed) {
				console.error(
					`[esm-smoke] FAIL ${result.slug}: ${result.failures.join("; ")}`,
				);
			}
			process.exitCode = 1;
		}
	} finally {
		await cleanup();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
