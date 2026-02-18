/**
 * Resource Monitor for PIE Element Assets
 *
 * Tracks and monitors loading of resources (audio, video, images) embedded
 * in PIE element content without requiring changes to PIE elements.
 *
 * Features:
 * - Tracks resource load timing with PerformanceObserver
 * - Detects and retries failed resource loads
 * - Sends instrumentation to New Relic
 * - Works with all resource types (audio, video, img, link)
 */

import { NewRelicInstrumentationProvider } from "../instrumentation/providers/NewRelicInstrumentationProvider.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import type { ComponentContext } from "./component-context.js";
import { getCurrentComponentContext } from "./component-context.js";
import { createPieLogger } from "./logger.js";

export type ResourceMonitorConfig = {
	/**
	 * Enable tracking page actions/events
	 *
	 * When true, resource monitoring events will be sent to the instrumentation provider.
	 */
	trackPageActions?: boolean;

	/**
	 * Instrumentation provider for tracking events and errors
	 *
	 * Optional. If not provided, defaults to NewRelicInstrumentationProvider.
	 * The provider handles instrumentation gracefully - if New Relic is not available,
	 * it will simply not track events (no errors thrown).
	 *
	 * To use a different provider (DataDog, Dynatrace, etc.), pass it here:
	 *
	 * @example
	 * ```typescript
	 * const provider = new DataDogInstrumentationProvider();
	 * await provider.initialize({ providerSettings: { ... } });
	 *
	 * const monitor = new ResourceMonitor({
	 *   trackPageActions: true,
	 *   instrumentationProvider: provider
	 * });
	 * ```
	 */
	instrumentationProvider?: InstrumentationProvider;

	/**
	 * Maximum number of retry attempts for failed resources
	 * Default: 3
	 */
	maxRetries?: number;

	/**
	 * Initial delay in ms before first retry
	 * Default: 500
	 */
	initialRetryDelay?: number;

	/**
	 * Maximum delay in ms between retries
	 * Default: 5000
	 */
	maxRetryDelay?: number;

	/**
	 * Enable debug logging
	 */
	debug?: boolean;
};

const DEFAULT_CONFIG = {
	trackPageActions: false as const,
	instrumentationProvider: undefined as InstrumentationProvider | undefined,
	maxRetries: 3 as number,
	initialRetryDelay: 500 as number,
	maxRetryDelay: 5000 as number,
	debug: false as const,
};

// Constants
const MAX_URL_LENGTH = 80;
const URL_TRUNCATE_LENGTH = 77;

type ResourceElement =
	| HTMLImageElement
	| HTMLAudioElement
	| HTMLVideoElement
	| HTMLLinkElement
	| HTMLSourceElement;

/**
 * Event detail for resource monitoring events
 */
export interface ResourceMonitorEventDetail {
	url: string;
	resourceType: string;
	duration?: number;
	size?: number;
	retryCount: number;
	maxRetries: number;
	error?: string;
}

/**
 * Tracks resource loads and provides retry capability
 */
export class ResourceMonitor {
	private config: Required<
		Omit<ResourceMonitorConfig, "instrumentationProvider">
	> & {
		instrumentationProvider: InstrumentationProvider | undefined;
	};
	private logger: ReturnType<typeof createPieLogger>;
	private observer: PerformanceObserver | null = null;
	private mutationObserver: MutationObserver | null = null;
	private errorHandler: ((event: Event) => void) | null = null;
	private retryAttempts = new Map<string, number>();
	private container: HTMLElement | null = null;
	private isBrowser: boolean;
	private containerResources = new Set<string>(); // Track resources within our container
	private provider: InstrumentationProvider;

	constructor(config: ResourceMonitorConfig = {}) {
		this.config = {
			trackPageActions:
				config.trackPageActions ?? DEFAULT_CONFIG.trackPageActions,
			instrumentationProvider:
				config.instrumentationProvider ??
				DEFAULT_CONFIG.instrumentationProvider,
			maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
			initialRetryDelay:
				config.initialRetryDelay ?? DEFAULT_CONFIG.initialRetryDelay,
			maxRetryDelay: config.maxRetryDelay ?? DEFAULT_CONFIG.maxRetryDelay,
			debug: config.debug ?? DEFAULT_CONFIG.debug,
		};

		// Always use a provider - default to NewRelic if not specified
		this.provider =
			this.config.instrumentationProvider ??
			new NewRelicInstrumentationProvider();

		// Initialize the provider (async, but don't block constructor)
		this.provider.initialize().catch((err) => {
			if (this.config.debug) {
				console.warn(
					"[ResourceMonitor] Failed to initialize instrumentation provider:",
					err,
				);
			}
		});

		this.logger = createPieLogger("resource-monitor", () =>
			this.isDebugEnabled(),
		);
		this.isBrowser =
			typeof window !== "undefined" && typeof document !== "undefined";
	}

	/**
	 * Check if debug logging is enabled (dynamically checks window.PIE_DEBUG)
	 */
	private isDebugEnabled(): boolean {
		return (
			this.config.debug ||
			(typeof window !== "undefined" && (window as any).PIE_DEBUG === true)
		);
	}

	/**
	 * Truncate URL for display in logs
	 */
	private truncateUrl(url: string): string {
		return url.length > MAX_URL_LENGTH
			? "..." + url.slice(-URL_TRUNCATE_LENGTH)
			: url;
	}

	/**
	 * Strip retry parameters from URL to get the original URL
	 */
	private getOriginalUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			urlObj.searchParams.delete("retry");
			urlObj.searchParams.delete("t");
			return urlObj.toString();
		} catch {
			// If URL parsing fails, return as-is
			return url;
		}
	}

	/**
	 * Track event with instrumentation provider if enabled
	 */
	private trackInstrumentationEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		if (!this.config.trackPageActions || !this.provider.isReady()) {
			return;
		}

		this.provider.trackEvent(eventName, {
			...attributes,
			component: "resource-monitor",
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Track error with instrumentation provider if enabled
	 */
	private trackInstrumentationError(
		error: Error,
		attributes: Record<string, any>,
	): void {
		if (!this.config.trackPageActions || !this.provider.isReady()) {
			return;
		}

		this.provider.trackError(error, {
			...attributes,
			component: "resource-monitor",
			errorType: attributes.errorType || "ResourceError",
		});
	}

	/**
	 * Start monitoring resources in the given container
	 */
	public start(container: HTMLElement): void {
		if (!this.isBrowser) {
			this.logger.debug(
				"Not in browser environment, skipping resource monitoring",
			);
			return;
		}

		this.container = container;

		this.setupMutationObserver();
		this.scanContainerResources(); // Initial scan of existing resources
		this.setupPerformanceObserver();
		this.setupErrorHandler();

		this.logger.info("✅ Resource monitoring started");
	}

	/**
	 * Stop monitoring and clean up
	 */
	public stop(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}

		if (this.errorHandler && this.container) {
			this.container.removeEventListener("error", this.errorHandler, true);
			this.errorHandler = null;
		}

		this.retryAttempts.clear();
		this.containerResources.clear();
		this.container = null;

		this.logger.info("Resource monitoring stopped");
	}

	/**
	 * Set up MutationObserver to track DOM changes within container
	 * This allows us to know which resources belong to our container
	 */
	private setupMutationObserver(): void {
		if (
			!this.isBrowser ||
			typeof MutationObserver === "undefined" ||
			!this.container
		) {
			this.logger.debug("MutationObserver not available or no container");
			return;
		}

		try {
			this.mutationObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					// Check added nodes
					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement) {
							this.scanElementForResources(node);
						}
					});

					// Check attribute changes (src, href changes)
					if (
						mutation.type === "attributes" &&
						mutation.target instanceof HTMLElement
					) {
						const target = mutation.target;
						if (this.isResourceElement(target)) {
							const src = this.getResourceSrc(target);
							if (src) {
								this.containerResources.add(src);
								if (this.isDebugEnabled()) {
									this.logger.debug(
										`📌 Tracked resource attribute change: ${src}`,
									);
								}
							}
						}
					}
				}
			});

			// Observe the container for changes
			this.mutationObserver.observe(this.container, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["src", "href"],
			});

			this.logger.debug("MutationObserver set up successfully");
		} catch (error) {
			this.logger.warn("Failed to set up MutationObserver:", error);
		}
	}

	/**
	 * Scan an element and its descendants for resources
	 */
	private scanElementForResources(element: HTMLElement): void {
		// Check the element itself
		if (this.isResourceElement(element)) {
			const src = this.getResourceSrc(element);
			if (src) {
				this.containerResources.add(src);
				if (this.isDebugEnabled()) {
					this.logger.debug(`📌 Tracked new resource in container: ${src}`);
				}
			}
		}

		// Check descendants
		const resourceSelectors = [
			"img",
			"audio",
			"video",
			'link[rel="stylesheet"]',
			"source",
		];
		resourceSelectors.forEach((selector) => {
			element.querySelectorAll(selector).forEach((el) => {
				if (this.isResourceElement(el)) {
					const src = this.getResourceSrc(el as ResourceElement);
					if (src) {
						this.containerResources.add(src);
					}
				}
			});
		});
	}

	/**
	 * Initial scan of container for existing resources
	 */
	private scanContainerResources(): void {
		if (!this.container) {
			return;
		}

		this.scanElementForResources(this.container);

		if (this.isDebugEnabled()) {
			this.logger.debug(
				`📊 Initial container scan found ${this.containerResources.size} resources`,
			);
			if (this.containerResources.size > 0) {
				this.containerResources.forEach((url) => {
					this.logger.debug(`   - ${this.truncateUrl(url)}`);
				});
			}
		}
	}

	/**
	 * Set up PerformanceObserver to track resource loading timing
	 */
	private setupPerformanceObserver(): void {
		if (!this.isBrowser || typeof PerformanceObserver === "undefined") {
			this.logger.debug("PerformanceObserver not available");
			return;
		}

		try {
			this.observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === "resource") {
						this.handleResourceTiming(entry as PerformanceResourceTiming);
					}
				}
			});

			// Use 'type' (singular) instead of 'entryTypes' (plural) to support buffered option
			// The buffered flag only works with the newer 'type' parameter
			this.observer.observe({
				type: "resource",
				buffered: true, // Capture resources loaded before observer started
			});

			this.logger.debug("PerformanceObserver set up successfully");
		} catch (error) {
			this.logger.warn("Failed to set up PerformanceObserver:", error);
		}
	}

	/**
	 * Handle resource timing entry
	 */
	private handleResourceTiming(entry: PerformanceResourceTiming): void {
		// Only track media and image resources that are relevant to PIE content
		const isRelevant = this.isRelevantResource(entry);

		if (!isRelevant) {
			if (
				this.isDebugEnabled() &&
				(entry.initiatorType === "img" ||
					entry.initiatorType === "audio" ||
					entry.initiatorType === "video")
			) {
				this.logger.debug(
					`⏭️  Skipping non-container resource: ${this.truncateUrl(entry.name)}`,
				);
			}
			return;
		}

		const duration = entry.duration;
		const size = entry.transferSize;
		const url = entry.name;

		// Detect actual failures: responseEnd === 0 means the request didn't complete
		// Note: transferSize === 0 is NOT a failure indicator (can be cache, CORS, or small resources)
		// We primarily rely on the error event handler for detecting failures
		const failed = entry.responseEnd === 0 && entry.duration > 0;

		// Check if this was a retry that succeeded
		const wasRetried = this.retryAttempts.has(url);
		const retryCount = this.retryAttempts.get(url) || 0;

		// Enhanced debug logging with detailed timing breakdown
		if (this.isDebugEnabled()) {
			const shortUrl = this.truncateUrl(url);
			const sizeKB = (size / 1024).toFixed(2);
			const status = failed ? "❌ FAILED" : "✅ SUCCESS";

			// Detailed timing breakdown
			const timingDetails = {
				total: `${duration.toFixed(2)}ms`,
				dns:
					entry.domainLookupEnd > 0
						? `${(entry.domainLookupEnd - entry.domainLookupStart).toFixed(2)}ms`
						: "n/a",
				tcp:
					entry.connectEnd > 0
						? `${(entry.connectEnd - entry.connectStart).toFixed(2)}ms`
						: "n/a",
				request:
					entry.responseStart > 0
						? `${(entry.responseStart - entry.requestStart).toFixed(2)}ms`
						: "n/a",
				response:
					entry.responseEnd > 0
						? `${(entry.responseEnd - entry.responseStart).toFixed(2)}ms`
						: "n/a",
				size: size > 0 ? `${sizeKB} KB` : "0 KB",
				type: entry.initiatorType,
				protocol: entry.nextHopProtocol || "unknown",
			};

			// Add retry context if this was retried
			const retryContext =
				wasRetried && !failed
					? `\n   🔄 Retry Success: Succeeded after ${retryCount} ${retryCount === 1 ? "retry" : "retries"}`
					: "";

			this.logger.info(
				`📊 PIE Resource Load ${status}\n` +
					`   URL: ${shortUrl}\n` +
					`   Type: ${timingDetails.type} | Protocol: ${timingDetails.protocol}\n` +
					`   ⏱️  Total Time: ${timingDetails.total}\n` +
					`   └─ DNS Lookup: ${timingDetails.dns}\n` +
					`   └─ TCP Connect: ${timingDetails.tcp}\n` +
					`   └─ Request Time: ${timingDetails.request}\n` +
					`   └─ Response Time: ${timingDetails.response}\n` +
					`   📦 Transfer Size: ${timingDetails.size}${retryContext}`,
			);
		} else {
			// Simple logging when debug is off but tracking is on
			this.logger.debug(`Resource loaded: ${entry.name}`, {
				duration: `${duration.toFixed(2)}ms`,
				size: `${size} bytes`,
				type: entry.initiatorType,
				failed,
				wasRetried,
				retryCount,
			});
		}

		// Handle successful loads
		if (!failed) {
			this.handleSuccessfulLoad(
				url,
				entry,
				duration,
				size,
				retryCount,
				wasRetried,
			);
		}

		// Track with instrumentation provider
		this.trackInstrumentationEvent("pie-resource-load", {
			url: entry.name,
			duration: Math.round(duration),
			size,
			type: entry.initiatorType,
			failed,
			wasRetried,
			retryCount,
		});

		// Track failed loads
		if (failed) {
			this.handleFailedLoad(url, entry, duration, retryCount, wasRetried);
		}
	}

	/**
	 * Handle successful resource load
	 */
	private handleSuccessfulLoad(
		url: string,
		entry: PerformanceResourceTiming,
		duration: number,
		size: number,
		retryCount: number,
		wasRetried: boolean,
	): void {
		// Dispatch general success event (for any successful load)
		this.dispatchEvent("pie-resource-load-success", {
			url,
			resourceType: entry.initiatorType,
			duration,
			size,
			retryCount,
			maxRetries: this.config.maxRetries,
		});

		// Log successful retry specifically
		if (wasRetried) {
			const shortUrl = this.truncateUrl(url);
			this.logger.info(
				`✅ PIE Resource Retry Succeeded!\n` +
					`   URL: ${shortUrl}\n` +
					`   Retry Attempt: ${retryCount}\n` +
					`   Load Time: ${duration.toFixed(2)}ms\n` +
					`   Result: Resource now available to user`,
			);

			// Dispatch retry success event (in addition to general success)
			this.dispatchEvent("pie-resource-retry-success", {
				url,
				resourceType: entry.initiatorType,
				duration,
				size,
				retryCount,
				maxRetries: this.config.maxRetries,
			});

			// Clear retry tracking since it succeeded
			this.retryAttempts.delete(url);
		}
	}

	/**
	 * Handle failed resource load
	 */
	private handleFailedLoad(
		url: string,
		entry: PerformanceResourceTiming,
		duration: number,
		retryCount: number,
		wasRetried: boolean,
	): void {
		const shortUrl = this.truncateUrl(url);

		if (wasRetried) {
			// This is a retry that also failed - use warn since we'll retry again
			this.logger.warn(
				`⚠️  PIE Resource Retry Failed\n` +
					`   URL: ${shortUrl}\n` +
					`   Retry Attempt: ${retryCount}\n` +
					`   Remaining Attempts: ${this.config.maxRetries - retryCount}\n` +
					`   Status: Will ${retryCount >= this.config.maxRetries ? "give up" : "retry again"}`,
			);

			// Dispatch retry failure event
			this.dispatchEvent("pie-resource-retry-failed", {
				url,
				resourceType: entry.initiatorType,
				duration,
				retryCount,
				maxRetries: this.config.maxRetries,
				error: "Resource load failed after retry",
			});
		} else {
			// Initial failure - use warn since we'll retry
			this.logger.warn(
				`⚠️  PIE Resource Initial Load Failed\n` +
					`   URL: ${shortUrl}\n` +
					`   Status: Will attempt ${this.config.maxRetries} ${this.config.maxRetries === 1 ? "retry" : "retries"}`,
			);

			// Dispatch initial failure event
			this.dispatchEvent("pie-resource-load-failed", {
				url,
				resourceType: entry.initiatorType,
				duration,
				retryCount: 0,
				maxRetries: this.config.maxRetries,
				error: "Initial resource load failed",
			});
		}

		// Track error with instrumentation provider
		this.trackInstrumentationError(
			new Error(`Resource load failed: ${entry.name}`),
			{
				resourceUrl: entry.name,
				resourceType: entry.initiatorType,
				duration: Math.round(duration),
				wasRetried,
				retryCount,
			},
		);
	}

	/**
	 * Check if resource is relevant to our container
	 * Uses container-scoped tracking via MutationObserver
	 * Also retroactively checks if resource belongs to container if not yet tracked
	 */
	private isRelevantResource(entry: PerformanceResourceTiming): boolean {
		const url = entry.name;

		// Only track resources that we know are in our container
		let isInContainer = this.containerResources.has(url);

		if (!isInContainer) {
			// Also check if it's a relative URL that might match
			// (PerformanceResourceTiming gives absolute URLs)
			for (const containerUrl of this.containerResources) {
				if (url.endsWith(containerUrl) || containerUrl.endsWith(url)) {
					return true;
				}
			}

			// Retroactively check if this resource belongs to our container
			// This handles the case where resources load before MutationObserver scans
			// PerformanceObserver can capture resources that loaded before it started (buffered: true)
			// but if they loaded before MutationObserver scanned, they won't be in containerResources
			if (this.container) {
				// Simple check: if resource is a media/image type and we have a container,
				// check if any element in container has this src/href
				// This is a fallback for resources that loaded very quickly before scan completed
				const isInContainer = this.isResourceInContainer(
					url,
					entry.initiatorType,
				);
				if (isInContainer) {
					this.containerResources.add(url);
					if (this.isDebugEnabled()) {
						this.logger.debug(
							`📌 Retroactively tracked resource: ${this.truncateUrl(url)}`,
						);
					}
					return true;
				}
			}
		}

		return isInContainer;
	}

	/**
	 * Check if a resource URL actually belongs to our container by checking DOM elements
	 * This is a fallback for resources that loaded before MutationObserver scanned
	 */
	private isResourceInContainer(url: string, initiatorType: string): boolean {
		if (!this.container) {
			return false;
		}

		try {
			// Check if any element in the container has this URL as src/href
			const urlObj = new URL(url);
			const urlPath = urlObj.pathname + urlObj.search;

			// For images, audio, video - check src attributes
			if (
				initiatorType === "img" ||
				initiatorType === "audio" ||
				initiatorType === "video"
			) {
				const elements = this.container.querySelectorAll(
					`${initiatorType}[src]`,
				);
				for (const el of elements) {
					const resourceEl = el as
						| HTMLImageElement
						| HTMLAudioElement
						| HTMLVideoElement;
					if (
						resourceEl.src &&
						(resourceEl.src === url || resourceEl.src.endsWith(urlPath))
					) {
						return true;
					}
				}
			}

			// For link elements (stylesheets) - check href
			if (initiatorType === "link") {
				const links = this.container.querySelectorAll("link[href]");
				for (const link of links) {
					const linkEl = link as HTMLLinkElement;
					if (
						linkEl.href &&
						(linkEl.href === url || linkEl.href.endsWith(urlPath))
					) {
						return true;
					}
				}
			}

			// For source elements (inside audio/video) - check src
			if (initiatorType === "source") {
				const sources = this.container.querySelectorAll("source[src]");
				for (const source of sources) {
					const sourceEl = source as HTMLSourceElement;
					if (
						sourceEl.src &&
						(sourceEl.src === url || sourceEl.src.endsWith(urlPath))
					) {
						return true;
					}
				}
			}
		} catch (error) {
			// If URL parsing fails or querySelector fails, fall back to false
			if (this.isDebugEnabled()) {
				this.logger.debug(
					`Error checking if resource is in container: ${error}`,
				);
			}
		}

		return false;
	}

	/**
	 * Set up error event handler for resource loading failures
	 */
	private setupErrorHandler(): void {
		if (!this.container) {
			return;
		}

		// Use capturing phase to catch errors before they bubble
		this.errorHandler = (event: Event) => {
			const target = event.target as ResourceElement;

			// Only handle resource elements
			if (!this.isResourceElement(target)) {
				return;
			}

			const tagName = target.tagName.toLowerCase();
			const src = this.getResourceSrc(target);

			if (!src) {
				return;
			}

			// Get the original URL without retry parameters
			const originalSrc = this.getOriginalUrl(src);

			// Check if we have retries remaining
			const currentRetries = this.retryAttempts.get(originalSrc) || 0;
			const remainingRetries = this.config.maxRetries - currentRetries;
			const willRetry = remainingRetries > 0;

			// Enhanced debug logging for errors
			// Use warn if we'll retry, error if we've exhausted retries
			if (this.isDebugEnabled()) {
				const shortUrl = this.truncateUrl(src);
				const logMethod = willRetry
					? this.logger.warn.bind(this.logger)
					: this.logger.error.bind(this.logger);
				const icon = willRetry ? "⚠️" : "❌";

				logMethod(
					`${icon} PIE Resource Load Error\n` +
						`   Element: <${tagName}>\n` +
						`   URL: ${shortUrl}\n` +
						`   Current Attempts: ${currentRetries}\n` +
						`   Remaining Retries: ${remainingRetries}/${this.config.maxRetries}\n` +
						`   Action: ${willRetry ? "Will retry with exponential backoff" : "Max retries reached, giving up"}`,
				);
			} else {
				const logMethod = willRetry
					? this.logger.warn.bind(this.logger)
					: this.logger.error.bind(this.logger);
				const icon = willRetry ? "⚠️" : "❌";
				logMethod(`${icon} Resource error: ${tagName} failed to load ${src}`);
			}

			// Track error with instrumentation provider
			this.trackInstrumentationError(
				new Error(`Resource load error: ${originalSrc}`),
				{
					resourceType: tagName,
					resourceUrl: originalSrc,
				},
			);

			// Attempt retry with original URL
			this.retryResourceLoad(target, originalSrc);
		};

		this.container.addEventListener("error", this.errorHandler, true);
		this.logger.debug("Error handler attached to container");
	}

	/**
	 * Check if element is a resource element
	 */
	private isResourceElement(
		element: EventTarget | null,
	): element is ResourceElement {
		if (!element || !(element instanceof HTMLElement)) {
			return false;
		}

		const tag = element.tagName.toLowerCase();
		return ["img", "audio", "video", "link", "source"].includes(tag);
	}

	/**
	 * Get resource src/href from element
	 */
	private getResourceSrc(element: ResourceElement): string | null {
		if (element instanceof HTMLLinkElement) {
			return element.href;
		}

		// For audio, video, img, and source elements (all have src)
		if ("src" in element && element.src) {
			return element.src;
		}

		return null;
	}

	/**
	 * Handle permanent resource failure after all retries exhausted
	 */
	private handlePermanentFailure(
		url: string,
		resourceType: string,
		retryCount: number,
	): void {
		if (this.isDebugEnabled()) {
			const shortUrl = this.truncateUrl(url);
			this.logger.error(
				`❌ PIE Resource Permanently Failed\n` +
					`   URL: ${shortUrl}\n` +
					`   Total Attempts: ${retryCount + 1} (initial + ${retryCount} retries)\n` +
					`   Status: Giving up after ${this.config.maxRetries} retries\n` +
					`   ⚠️  This resource will not be available to the user`,
			);
		} else {
			this.logger.error(
				`❌ Failed to load resource after ${this.config.maxRetries} retries: ${url}`,
			);
		}

		// Dispatch permanent failure event
		this.dispatchEvent("pie-resource-load-error", {
			url,
			resourceType,
			retryCount,
			maxRetries: this.config.maxRetries,
			error: `Resource permanently failed after ${this.config.maxRetries} retries`,
		});

		// Track final failure with instrumentation provider
		this.trackInstrumentationError(
			new Error(
				`Resource permanently failed after ${this.config.maxRetries} retries: ${url}`,
			),
			{
				resourceUrl: url,
				retryCount,
				resourceType,
			},
		);
	}

	/**
	 * Log retry schedule information
	 */
	private logRetrySchedule(
		url: string,
		retryCount: number,
		delay: number,
		elementTag: string,
	): void {
		if (this.isDebugEnabled()) {
			const shortUrl = this.truncateUrl(url);
			const nextDelay = Math.min(
				this.config.initialRetryDelay * Math.pow(2, retryCount + 1),
				this.config.maxRetryDelay,
			);

			const strategy =
				elementTag === "img"
					? "Cache-busting URL"
					: elementTag === "audio" || elementTag === "video"
						? "element.load()"
						: elementTag === "link"
							? "Cache-busting URL"
							: "URL update";

			this.logger.info(
				`🔄 PIE Resource Retry Scheduled\n` +
					`   URL: ${shortUrl}\n` +
					`   Attempt: ${retryCount + 1}/${this.config.maxRetries}\n` +
					`   ⏰ Wait Time: ${delay}ms (exponential backoff)\n` +
					`   Next Retry Delay: ${nextDelay}ms (if this fails)\n` +
					`   Strategy: ${strategy}`,
			);
		} else {
			this.logger.info(
				`🔄 Retrying resource load (attempt ${retryCount + 1}/${this.config.maxRetries}) after ${delay}ms: ${url}`,
			);
		}
	}

	/**
	 * Retry loading a failed resource with exponential backoff
	 */
	private async retryResourceLoad(
		element: ResourceElement,
		originalSrc: string,
	): Promise<void> {
		const retryCount = this.retryAttempts.get(originalSrc) || 0;

		if (retryCount >= this.config.maxRetries) {
			this.handlePermanentFailure(
				originalSrc,
				element.tagName.toLowerCase(),
				retryCount,
			);
			return;
		}

		// Calculate backoff delay (exponential)
		const delay = Math.min(
			this.config.initialRetryDelay * Math.pow(2, retryCount),
			this.config.maxRetryDelay,
		);

		// Log retry schedule
		this.logRetrySchedule(
			originalSrc,
			retryCount,
			delay,
			element.tagName.toLowerCase(),
		);

		// Track retry attempt with instrumentation provider
		this.trackInstrumentationEvent("pie-resource-retry", {
			url: originalSrc,
			attempt: retryCount + 1,
			delay,
		});

		// Wait before retrying
		await new Promise((resolve) => setTimeout(resolve, delay));

		if (this.isDebugEnabled()) {
			this.logger.debug(
				`⏱️  Retry wait completed (${delay}ms), attempting reload now...`,
			);
		}

		// Increment retry count
		this.retryAttempts.set(originalSrc, retryCount + 1);

		// Attempt reload based on element type
		try {
			if (
				element instanceof HTMLAudioElement ||
				element instanceof HTMLVideoElement
			) {
				// For media elements, use load() method
				element.load();
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Triggered load() on <${element.tagName.toLowerCase()}>`,
					);
				}
			} else if (element instanceof HTMLImageElement) {
				// For images, force reload by appending cache-busting parameter
				const url = new URL(originalSrc);
				url.searchParams.set("retry", (retryCount + 1).toString());
				url.searchParams.set("t", Date.now().toString());
				element.src = url.toString();
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Updated <img> src with cache-busting params: retry=${retryCount + 1}, t=${Date.now()}`,
					);
				}
			} else if (element instanceof HTMLLinkElement) {
				// For stylesheets, update href with cache-busting params (avoid clone/replace for Shady DOM compatibility)
				const url = new URL(originalSrc);
				url.searchParams.set("retry", (retryCount + 1).toString());
				url.searchParams.set("t", Date.now().toString());
				element.href = url.toString();
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Updated <link> href with cache-busting params: retry=${retryCount + 1}, t=${Date.now()}`,
					);
				}
			}
		} catch (error) {
			if (this.isDebugEnabled()) {
				this.logger.error(
					`❌ Error during retry attempt for ${originalSrc}:`,
					error,
				);
			} else {
				this.logger.error(`Error during retry for ${originalSrc}:`, error);
			}
		}
	}

	/**
	 * Dispatch a custom event from the container
	 */
	private dispatchEvent(
		eventName: string,
		detail: ResourceMonitorEventDetail,
	): void {
		if (!this.container) {
			// Silent return - if container is null, events can't be dispatched
			// This should only happen if ResourceMonitor wasn't properly initialized
			return;
		}

		const event = new CustomEvent(eventName, {
			detail,
			bubbles: true,
			composed: true, // Allow crossing shadow DOM boundaries
		});

		this.container.dispatchEvent(event);
	}

	/**
	 * Get current retry statistics
	 */
	public getStats(): {
		activeRetries: number;
		failedResources: Array<{ url: string; attempts: number }>;
	} {
		const failedResources: Array<{ url: string; attempts: number }> = [];

		this.retryAttempts.forEach((attempts, url) => {
			failedResources.push({ url, attempts });
		});

		return {
			activeRetries: this.retryAttempts.size,
			failedResources: failedResources.sort((a, b) => b.attempts - a.attempts),
		};
	}
}

/**
 * Create and start a resource monitor for a container
 */
export function createResourceMonitor(
	container: HTMLElement,
	config: ResourceMonitorConfig = {},
): ResourceMonitor {
	const monitor = new ResourceMonitor(config);
	monitor.start(container);
	return monitor;
}

// =============================================================================
// Global resource request tracking (consolidated from the old font-request-tracker)
// =============================================================================

// Track failed resource requests (by URL)
const failedRequests = new Map<string, ComponentContext[]>();

function isResourceFile(url: string): boolean {
	const resourceExtensions = [
		// Fonts
		".woff",
		".woff2",
		".ttf",
		".otf",
		".eot",
		// Images
		".gif",
		".jpg",
		".jpeg",
		".png",
		".svg",
		".webp",
		".ico",
		// Audio/Video
		".mp3",
		".mp4",
		".wav",
		".ogg",
		".webm",
		// Other assets
		".pdf",
		".css",
		".js",
	];

	return resourceExtensions.some((ext) => url.toLowerCase().includes(ext));
}

function getResourceType(url: string): string {
	if (url.match(/\.(woff|woff2|ttf|otf|eot)/i)) return "Font";
	if (url.match(/\.(gif|jpg|jpeg|png|svg|webp|ico)/i)) return "Image";
	if (url.match(/\.(mp3|mp4|wav|ogg|webm)/i)) return "Media";
	if (url.match(/\.(css)/i)) return "Stylesheet";
	if (url.match(/\.(js)/i)) return "Script";
	return "Resource";
}

function logFailedRequest(
	url: string,
	status: number,
	context: ComponentContext | null,
) {
	// Only log 404s and other failures (status 0 for network errors)
	if (status !== 404 && status !== 0) {
		return;
	}

	const key = url;
	if (!failedRequests.has(key)) {
		failedRequests.set(key, []);
	}

	const contexts = failedRequests.get(key)!;
	contexts.push({
		...(context || { componentName: "Unknown", timestamp: Date.now() }),
		timestamp: Date.now(),
	});

	const resourceType = getResourceType(url);
	const filename = url.split("/").pop() || url;
	const itemId = context?.itemId || "Unknown";
	const componentName = context?.componentName || "Unknown component";
	const elementType = context?.elementType || "";

	console.warn(
		`Failed ${resourceType} request`,
		`\n  Resource: ${filename}`,
		`\n  URL: ${url}`,
		`\n  Item ID: ${itemId}`,
		`\n  Mini-Player: ${componentName}`,
		elementType ? `\n  Element Type: ${elementType}` : "",
		`\n  Status: ${status}`,
		context
			? ""
			: "\n  Note: Component not tracked - may be from item markup or PIE element",
	);
}

/**
 * Initialize global resource request tracking (404s for fonts/images/etc.)
 * Call this once when the app loads (client-side only).
 */
export function initializeResourceRequestTracking(): void {
	if (typeof window === "undefined") return;

	// Track fetch requests
	const originalFetch = window.fetch;
	window.fetch = async function (...args: Parameters<typeof fetch>) {
		// Extract URL from first argument (can be string, URL, or Request)
		let url = "";
		if (typeof args[0] === "string") {
			url = args[0];
		} else if (args[0] instanceof URL) {
			url = args[0].toString();
		} else if (args[0] instanceof Request) {
			url = args[0].url;
		}

		if (isResourceFile(url) || url.startsWith("/")) {
			const context = getCurrentComponentContext();
			try {
				const response = await (originalFetch as any)(...args);
				if (response.status === 404) {
					logFailedRequest(url, response.status, context);
				}
				return response;
			} catch (error) {
				logFailedRequest(url, 0, context);
				throw error;
			}
		}

		return (originalFetch as any)(...args);
	} as any;

	// Track XMLHttpRequest
	const originalXHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (
		method: string,
		url: string | URL,
		async?: boolean,
		username?: string | null,
		password?: string | null,
	) {
		const urlString = typeof url === "string" ? url : url.toString();

		if (isResourceFile(urlString) || urlString.startsWith("/")) {
			const context = getCurrentComponentContext();
			this.addEventListener("load", function () {
				if (this.status === 404) {
					logFailedRequest(urlString, this.status, context);
				}
			});
			this.addEventListener("error", function () {
				logFailedRequest(urlString, 0, context);
			});
		}

		return originalXHROpen.call(
			this,
			method,
			url,
			async ?? true,
			username ?? null,
			password ?? null,
		);
	};

	// Intercept img tag error events (most reliable way to catch failed image loads)
	const errorHandler = (event: Event) => {
		const target = event.target;
		if (target instanceof HTMLImageElement && target.src) {
			const url = target.src;
			if (
				isResourceFile(url) ||
				url.startsWith("/") ||
				url.startsWith(window.location.origin + "/")
			) {
				const context = getCurrentComponentContext();
				const relativeUrl = url.startsWith(window.location.origin)
					? url.replace(window.location.origin, "")
					: url;
				logFailedRequest(relativeUrl, 404, context);
			}
		}
	};

	document.addEventListener("error", errorHandler, true);

	// Track resource requests via PerformanceObserver (fonts, CSS resources, etc.)
	const observer = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (entry.entryType !== "resource") continue;
			const resourceEntry = entry;
			const url = resourceEntry.name;

			if (
				isResourceFile(url) ||
				url.startsWith("/") ||
				url.startsWith(window.location.origin + "/")
			) {
				const perf = resourceEntry;
				const failed = (perf as any).responseEnd === 0 && perf.duration > 0;
				const mightBe404 =
					(perf as any).transferSize === 0 &&
					(perf as any).responseEnd > 0 &&
					(perf as any).responseStart === 0;
				if (failed || mightBe404) {
					const context = getCurrentComponentContext();
					const relativeUrl = url.startsWith(window.location.origin)
						? url.replace(window.location.origin, "")
						: url;
					logFailedRequest(relativeUrl, 404, context);
				}
			}
		}
	});

	try {
		observer.observe({ type: "resource", buffered: true });
	} catch (e) {
		console.warn(
			"Failed to set up PerformanceObserver for resource tracking:",
			e,
		);
	}
}

export function getTrackedResourceRequests(): Map<string, ComponentContext[]> {
	return new Map(failedRequests);
}

export function clearTrackedResourceRequests(): void {
	failedRequests.clear();
}
