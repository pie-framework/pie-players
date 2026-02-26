import {
	getCachedParentRuntime,
	setCachedParentRuntime,
} from "./runtime-binding-cache.js";

export function findParentToolkitRuntime(
	host: HTMLElement,
	bypassCache = false,
): HTMLElement | null {
	if (!bypassCache) {
		const cached = getCachedParentRuntime(host);
		if (cached !== undefined) {
			return cached;
		}
	}

	let cursor: HTMLElement | null = host.parentElement;
	while (cursor) {
		if (cursor.tagName.toLowerCase() === "pie-assessment-toolkit") {
			setCachedParentRuntime(host, cursor);
			return cursor;
		}
		cursor = cursor.parentElement;
	}

	setCachedParentRuntime(host, null);
	return null;
}
