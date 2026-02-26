const parentRuntimeCache = new WeakMap<HTMLElement, HTMLElement | null>();

export function getCachedParentRuntime(host: HTMLElement): HTMLElement | null | undefined {
	return parentRuntimeCache.get(host);
}

export function setCachedParentRuntime(host: HTMLElement, parent: HTMLElement | null): void {
	parentRuntimeCache.set(host, parent);
}

export function clearCachedParentRuntime(host: HTMLElement): void {
	parentRuntimeCache.delete(host);
}
