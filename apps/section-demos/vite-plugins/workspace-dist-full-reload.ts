import path from "node:path";
import type { Plugin } from "vite";

const BUILT_JAVASCRIPT = /\.(?:c|m)?js$/;
const DEFAULT_RELOAD_DELAY_MS = 100;

export function isWorkspacePackageDistJavaScript(
	file: string,
	packagesRoot: string,
): boolean {
	const relative = path.relative(
		path.resolve(packagesRoot),
		path.resolve(file),
	);
	if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
	const segments = relative.split(path.sep);
	return (
		segments.length >= 3 &&
		segments[1] === "dist" &&
		BUILT_JAVASCRIPT.test(segments.at(-1) || "")
	);
}

/**
 * Demo imports intentionally resolve to publish-like package dist bundles.
 * Re-evaluating one of those bundles through HMR attempts to define its custom
 * elements a second time, which the browser registry rejects. A full reload is
 * the only safe update because it creates a fresh CustomElementRegistry. Use
 * Vite 8's hotUpdate hook so emptyOutDir delete/create events are suppressed in
 * addition to ordinary file updates.
 */
export function workspaceDistFullReload(
	packagesRoot: string,
	reloadDelayMs = DEFAULT_RELOAD_DELAY_MS,
): Plugin {
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;
	let sendPendingReload: (() => void) | undefined;

	const scheduleFullReload = (send: () => void) => {
		sendPendingReload = send;
		if (reloadTimer) clearTimeout(reloadTimer);
		reloadTimer = setTimeout(
			() => {
				reloadTimer = undefined;
				sendPendingReload?.();
				sendPendingReload = undefined;
			},
			Math.max(0, reloadDelayMs),
		);
	};

	return {
		name: "pie-workspace-dist-full-reload",
		enforce: "pre",
		hotUpdate({ file, modules, timestamp }) {
			if (this.environment.name !== "client") return;
			if (!isWorkspacePackageDistJavaScript(file, packagesRoot)) return;

			const invalidatedModules = new Set<(typeof modules)[number]>();
			for (const module of modules) {
				this.environment.moduleGraph.invalidateModule(
					module,
					invalidatedModules,
					timestamp,
					true,
				);
			}
			scheduleFullReload(() => {
				this.environment.hot.send({ type: "full-reload", path: "*" });
			});
			return [];
		},
		closeBundle() {
			if (reloadTimer) clearTimeout(reloadTimer);
			reloadTimer = undefined;
			sendPendingReload = undefined;
		},
	};
}
