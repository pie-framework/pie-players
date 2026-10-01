/*
 * A browser refuses `new Worker(url)` when the script's origin is not the page's,
 * so a calculator loaded from a CDN cannot start its own worker. A `blob:` URL
 * belongs to the page's origin, and a module worker started from one may import
 * the real script across origins because module scripts are fetched with CORS,
 * which a CDN such as jsDelivr allows.
 *
 * Only a cross-origin `http(s)` script takes that route. Everything else —
 * same-origin, `file:`, `data:` — is handed to `Worker` as it was.
 */

type ModuleWorkerConstructor = new (url: URL, options: WorkerOptions) => Worker;

function isCrossOriginScript(url: URL): boolean {
	if (url.protocol !== "http:" && url.protocol !== "https:") return false;
	return typeof location !== "undefined" && url.origin !== location.origin;
}

function startFromBlob(url: URL, options: WorkerOptions): Worker {
	const blobUrl = URL.createObjectURL(
		new Blob([`import ${JSON.stringify(url.href)};`], {
			type: "text/javascript",
		}),
	);
	const worker = new globalThis.Worker(blobUrl, options);
	// The worker fetches the blob before it posts or fails, so the URL is spent by
	// the first of either. Revoking at construction races that fetch.
	const revoke = () => URL.revokeObjectURL(blobUrl);
	worker.addEventListener("message", revoke, { once: true });
	worker.addEventListener("error", revoke, { once: true });
	return worker;
}

/**
 * Builds a module worker with the page-origin handling above.
 *
 * `construct` receives the constructor as a parameter named `Worker`, and
 * the name has to stay: Vite finds a worker to bundle by the text
 * `new Worker(new URL("./file", import.meta.url)`, so renaming it ships the
 * worker's TypeScript source as an asset.
 */
export function startModuleWorker(
	construct: (Worker: ModuleWorkerConstructor) => Worker,
): Worker {
	const ModuleWorker = function (url: URL, options: WorkerOptions): Worker {
		return isCrossOriginScript(url)
			? startFromBlob(url, options)
			: new globalThis.Worker(url, options);
	} as unknown as ModuleWorkerConstructor;
	return construct(ModuleWorker);
}
