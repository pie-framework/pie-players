/**
 * The `webServer.wait` that marks a Playwright suite's own vite dev server
 * ready: vite's `Local:` line for `baseURL`'s host and port, which it prints
 * once it holds the port. Run vite with `--strictPort`, so it exits instead
 * when another server holds the port.
 *
 * Use it in place of `webServer.url`. Playwright counts the server ready once
 * anything answers that URL, so a dev server another checkout started on the
 * same port passes the check and the suite runs against that checkout's build.
 *
 * @param {string} baseURL
 * @returns {{ stdout: RegExp }}
 */
export function viteListeningOn(baseURL) {
	const { protocol, hostname, port } = new URL(baseURL);
	const origin = `${protocol}//${hostname}:${port || "80"}/`;
	return {
		stdout: new RegExp(
			`Local:\\s+${origin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`,
		),
	};
}
