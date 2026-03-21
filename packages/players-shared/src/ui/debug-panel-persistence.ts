import { safeLocalStorageGet, safeLocalStorageSet } from "./safe-storage.js";

const DEBUG_PANEL_STORAGE_PREFIX = "pie:debug-panels:v1";

type DebugPanelStorageKeyArgs = {
	scope: string;
	panelId: string;
	aspect?: string;
};

export function createDebugPanelStorageKey(
	args: DebugPanelStorageKeyArgs,
): string {
	const scope = String(args.scope || "default").trim() || "default";
	const panelId = String(args.panelId || "panel").trim() || "panel";
	const aspect = String(args.aspect || "state").trim() || "state";
	return `${DEBUG_PANEL_STORAGE_PREFIX}:${scope}:${panelId}:${aspect}`;
}

export function readDebugPanelState<T>(key: string): T | null {
	const raw = safeLocalStorageGet(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function writeDebugPanelState<T>(key: string, value: T): void {
	try {
		safeLocalStorageSet(key, JSON.stringify(value));
	} catch {
		// ignore serialization/storage failures
	}
}

export function clearDebugPanelState(key: string): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
}

export type DebugPanelLayoutStateV1 = {
	x: number;
	y: number;
	width: number;
	height: number;
	minimized: boolean;
};
