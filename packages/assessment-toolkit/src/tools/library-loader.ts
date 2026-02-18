/**
 * Library Loader Service
 * Dynamically loads external JavaScript libraries with retry logic and fallback URLs
 *
 * Based on architectural enhancements from renaissance-tool-analyses.md
 * Supports both static and dynamic library loading
 */

import type { LibraryConfig, LibraryLoader, LoaderStats } from "./types.js";

/**
 * Implementation of LibraryLoader service
 */
export class LibraryLoaderImpl implements LibraryLoader {
	private loadedLibraries = new Set<string>();
	private pendingLoads = new Map<string, Promise<void>>();
	private failedLibraries = new Map<string, Error>();
	private stats: LoaderStats = {
		loaded: [],
		failed: [],
		pending: [],
		cacheHits: 0,
		cacheMisses: 0,
		totalLoadTime: 0,
	};

	/**
	 * Load a JavaScript library
	 */
	async loadScript(library: LibraryConfig): Promise<void> {
		// SSR guard: Library loading should NEVER run on the server
		if (typeof window === "undefined" || typeof document === "undefined") {
			throw new Error("Library loader can only be used in the browser");
		}

		const startTime = performance.now();

		// Check if already loaded
		if (this.isLoaded(library.id)) {
			this.stats.cacheHits++;
			return;
		}

		// Check if already pending
		const pending = this.pendingLoads.get(library.id);
		if (pending) {
			return pending;
		}

		this.stats.cacheMisses++;

		// Start loading
		const loadPromise = this._loadScriptWithRetry(library);
		this.pendingLoads.set(library.id, loadPromise);
		this.stats.pending.push(library.id);

		try {
			await loadPromise;
			this.loadedLibraries.add(library.id);
			this.stats.loaded.push(library.id);

			const loadTime = performance.now() - startTime;
			this.stats.totalLoadTime += loadTime;

			console.log(
				`[LibraryLoader] Successfully loaded ${library.id} in ${loadTime.toFixed(2)}ms`,
			);
		} catch (error) {
			this.failedLibraries.set(library.id, error as Error);
			this.stats.failed.push(library.id);
			console.error(`[LibraryLoader] Failed to load ${library.id}:`, error);
			throw error;
		} finally {
			this.pendingLoads.delete(library.id);
			const pendingIndex = this.stats.pending.indexOf(library.id);
			if (pendingIndex !== -1) {
				this.stats.pending.splice(pendingIndex, 1);
			}
		}
	}

	/**
	 * Load a stylesheet
	 */
	async loadStylesheet(url: string): Promise<void> {
		// SSR guard: Stylesheet loading should NEVER run on the server
		if (typeof window === "undefined" || typeof document === "undefined") {
			throw new Error("Stylesheet loader can only be used in the browser");
		}

		return new Promise((resolve, reject) => {
			// Check if already loaded
			const existing = document.querySelector(`link[href="${url}"]`);
			if (existing) {
				resolve();
				return;
			}

			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = url;

			link.onload = () => resolve();
			link.onerror = () =>
				reject(new Error(`Failed to load stylesheet: ${url}`));

			document.head.appendChild(link);
		});
	}

	/**
	 * Check if a library is already loaded
	 */
	isLoaded(libraryId: string): boolean {
		return this.loadedLibraries.has(libraryId);
	}

	/**
	 * Preload multiple libraries in parallel
	 */
	async preload(libraries: LibraryConfig[]): Promise<void> {
		const promises = libraries.map((lib) => this.loadScript(lib));
		await Promise.all(promises);
	}

	/**
	 * Unload a library (remove script tag)
	 */
	unload(libraryId: string): void {
		const script = document.querySelector(
			`script[data-library-id="${libraryId}"]`,
		);
		if (script) {
			script.remove();
			this.loadedLibraries.delete(libraryId);

			// Remove from stats
			const loadedIndex = this.stats.loaded.indexOf(libraryId);
			if (loadedIndex !== -1) {
				this.stats.loaded.splice(loadedIndex, 1);
			}
		}
	}

	/**
	 * Get loader statistics
	 */
	getStats(): LoaderStats {
		return { ...this.stats };
	}

	/**
	 * Load script with retry logic
	 */
	private async _loadScriptWithRetry(library: LibraryConfig): Promise<void> {
		const urls = [library.url, ...(library.fallbackUrls || [])];
		const maxAttempts = library.retry?.maxAttempts || 3;
		const delay = library.retry?.delay || 1000;
		const backoffMultiplier = library.retry?.backoffMultiplier || 2;

		let lastError: Error | null = null;

		for (const url of urls) {
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				try {
					await this._loadScriptFromUrl(url, library);

					// Verify library loaded if globalVar specified
					if (library.globalVar) {
						if (!(library.globalVar in window)) {
							throw new Error(
								`Library ${library.id} loaded but global ${library.globalVar} not found`,
							);
						}
					}

					return; // Success
				} catch (error) {
					lastError = error as Error;
					console.warn(
						`[LibraryLoader] Attempt ${attempt}/${maxAttempts} failed for ${url}:`,
						error,
					);

					// Wait before retry (exponential backoff)
					if (attempt < maxAttempts) {
						const waitTime = delay * Math.pow(backoffMultiplier, attempt - 1);
						await this._sleep(waitTime);
					}
				}
			}
		}

		throw new Error(
			`Failed to load library ${library.id} after trying all URLs: ${lastError?.message}`,
		);
	}

	/**
	 * Load script from a specific URL
	 */
	private _loadScriptFromUrl(
		url: string,
		library: LibraryConfig,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = url;
			script.dataset.libraryId = library.id;

			if (library.async) script.async = true;
			if (library.defer) script.defer = true;
			if (library.integrity) script.integrity = library.integrity;
			if (library.crossorigin) script.crossOrigin = library.crossorigin;

			let timeoutId: number | undefined;

			const cleanup = () => {
				if (timeoutId) clearTimeout(timeoutId);
				script.onload = null;
				script.onerror = null;
			};

			script.onload = () => {
				cleanup();
				resolve();
			};

			script.onerror = (error) => {
				cleanup();
				script.remove();
				reject(new Error(`Script load error for ${url}: ${error}`));
			};

			// Timeout handling
			if (library.timeout) {
				timeoutId = window.setTimeout(() => {
					cleanup();
					script.remove();
					reject(
						new Error(
							`Script load timeout for ${url} after ${library.timeout}ms`,
						),
					);
				}, library.timeout);
			}

			document.head.appendChild(script);
		});
	}

	/**
	 * Sleep utility for retry delays
	 */
	private _sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Singleton instance
 */
export const libraryLoader = new LibraryLoaderImpl();

/**
 * Desmos library version (matches the version in calculator.js)
 * Update this when upgrading to a new version
 */
const DESMOS_VERSION = "v1.10.1";

/**
 * Common library configurations
 * Based on industry best practices and platform analyses
 */
export const COMMON_LIBRARIES: Record<string, LibraryConfig> = {
	desmos: {
		id: "desmos",
		url: `/lib/desmos/${DESMOS_VERSION}/calculator.js`, // Self-hosted (prioritized) - versioned for better cache control
		fallbackUrls: [
			"https://www.desmos.com/api/v1.10/calculator.js",
			"https://cdn.jsdelivr.net/npm/desmos@1.10/dist/calculator.js",
		],
		globalVar: "Desmos",
		timeout: 10000,
		retry: { maxAttempts: 3, delay: 1000, backoffMultiplier: 2 },
	},

	mathjax: {
		id: "mathjax",
		url: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
		fallbackUrls: [
			"https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js",
			"/static/lib/mathjax/tex-mml-chtml.js",
		],
		globalVar: "MathJax",
		async: true,
		retry: { maxAttempts: 2, delay: 1500 },
	},

	katex: {
		id: "katex",
		url: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
		fallbackUrls: [
			"https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js",
			"/static/lib/katex/katex.min.js",
		],
		globalVar: "katex",
		timeout: 5000,
	},

	mathjs: {
		id: "mathjs",
		url: "https://cdn.jsdelivr.net/npm/mathjs@12.4.0/lib/browser/math.min.js",
		fallbackUrls: [
			"https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.0/math.min.js",
			"https://unpkg.com/mathjs@12.4.0/lib/browser/math.min.js",
			"/static/lib/mathjs/math.min.js",
		],
		globalVar: "math",
		timeout: 8000,
		retry: { maxAttempts: 3, delay: 1000, backoffMultiplier: 2 },
	},

	// TI Calculator emulators (placeholder URLs - replace with actual)
	ti84: {
		id: "ti-84-emulator",
		url: "https://example.com/ti-84-emulator.js", // Replace with actual URL
		fallbackUrls: ["/static/lib/ti-84-emulator.js"],
		globalVar: "TI84",
		timeout: 15000,
		retry: { maxAttempts: 3, delay: 2000, backoffMultiplier: 2 },
	},

	ti108: {
		id: "ti-108-emulator",
		url: "https://example.com/ti-108-emulator.js", // Replace with actual URL
		fallbackUrls: ["/static/lib/ti-108-emulator.js"],
		globalVar: "TI108",
		timeout: 15000,
	},

	ti34mv: {
		id: "ti-34mv-emulator",
		url: "https://example.com/ti-34mv-emulator.js", // Replace with actual URL
		fallbackUrls: ["/static/lib/ti-34mv-emulator.js"],
		globalVar: "TI34MV",
		timeout: 15000,
	},
};
