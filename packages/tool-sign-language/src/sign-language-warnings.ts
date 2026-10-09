const warnedKeys = new Set<string>();

/** Warn once per key for the life of the page. */
export function warnSignLanguageOnce(key: string, message: string): void {
	if (warnedKeys.has(key)) return;
	warnedKeys.add(key);
	console.warn(`[pie-tool-sign-language] ${message}`);
}
