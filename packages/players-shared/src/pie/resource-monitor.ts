/**
 * Resource Monitor for PIE Element Assets
 *
 * Tracks and monitors loading of resources (audio, video, images) embedded
 * in PIE element content without requiring changes to PIE elements.
 *
 * Features:
 * - Tracks resource load timing with PerformanceObserver
 * - Detects and retries failed resource loads
 * - With `trackPageActions`, reports loads, retries and failures to the
 *   instrumentation provider it is given
 * - Works with all resource types (audio, video, img, link)
 */

import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";

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
	 * The monitor constructs no provider of its own: without one it only
	 * retries. Players pass what `resolveInstrumentationProvider` resolves from
	 * their `loaderConfig`.
	 */
	instrumentationProvider?: InstrumentationProvider;

	/**
	 * Whether ResourceMonitor should initialize/destroy the instrumentation provider.
	 *
	 * Defaults to `false`: the provider belongs to whoever passed it in.
	 */
	manageProviderLifecycle?: boolean;

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

type ResolvedResourceMonitorConfig = Required<
	Omit<ResourceMonitorConfig, "instrumentationProvider">
>;

const DEFAULT_CONFIG: ResolvedResourceMonitorConfig = {
	trackPageActions: false,
	manageProviderLifecycle: false,
	maxRetries: 3,
	initialRetryDelay: 500,
	maxRetryDelay: 5000,
	debug: false,
};

const MAX_URL_LENGTH = 80;
/** Leaves room for the "..." prefix within MAX_URL_LENGTH. */
const URL_TRUNCATE_LENGTH = MAX_URL_LENGTH - "...".length;
const MEDIA_RETRY_RECONCILIATION_TIMEOUT_MS = 1200;
const MEDIA_RETRY_RECONCILIATION_POLL_MS = 75;

type ResourceElement =
	| HTMLImageElement
	| HTMLAudioElement
	| HTMLVideoElement
	| HTMLLinkElement
	| HTMLSourceElement;

type MediaTarget = {
	mediaEl: HTMLAudioElement | HTMLVideoElement;
	mediaTag: "audio" | "video";
};

/** The elements of each initiator type that carry a resource URL. */
const RESOURCE_SELECTOR_BY_INITIATOR = new Map([
	["img", "img[src]"],
	["audio", "audio[src]"],
	["video", "video[src]"],
	["link", "link[href]"],
	["source", "source[src]"],
]);

/** How a retry reloads each element type, as named in the retry log. */
const RETRY_STRATEGY_BY_TAG = new Map([
	["img", "Cache-busting URL"],
	["link", "Cache-busting URL"],
	["audio", "element.load()"],
	["video", "element.load()"],
]);

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

export interface MediaRetryReadyDetail extends ResourceMonitorEventDetail {
	mediaTag: "audio" | "video";
}

/*
 * Resource monitor event contract. Events are dispatched on the container
 * unless noted, and bubble and compose.
 *
 * - `pie-resource-load-success`: emitted when a resource request is successful.
 *   For retried media resources, this is emitted only after media becomes healthy.
 * - `pie-resource-load-failed`: emitted when an initial request fails, as seen
 *   in its resource timing.
 * - `pie-resource-retry-failed`: emitted when a retried request fails, or when a
 *   retried media fetch succeeds but media does not become healthy before the
 *   reconciliation timeout. After a timeout the monitor retries again, or fails
 *   permanently when no retry target remains.
 * - `pie-resource-retry-success`: emitted once per successful retry cycle.
 * - `pie-media-retry-ready`: emitted once per successful retry cycle to recovered
 *   media targets (`audio`/`video`), including `<source>`-driven retries resolved
 *   to their parent media element.
 * - `pie-resource-load-error`: emitted when retries are exhausted.
 */

interface ResourceErrorDiagnostics {
	eventType: string;
	tagName: string;
	resourceUrl: string;
	originalUrl: string;
	currentRetries: number;
	remainingRetries: number;
	willRetry: boolean;
	cacheBypassActive: boolean;
	currentSrc?: string;
	readyState?: number;
	networkState?: number;
	paused?: boolean;
	ended?: boolean;
	currentTime?: number;
	duration?: number | null;
	mediaErrorCode?: number;
	mediaErrorName?: string;
	mediaErrorMessage?: string;
}

/**
 * Tracks the resource loads of one container and retries failed ones with
 * exponential backoff and cache-busting URLs. The events it dispatches are
 * listed in the event contract above.
 */
export class ResourceMonitor {
	private config: ResolvedResourceMonitorConfig;
	private logger: ReturnType<typeof createPieLogger>;
	private observer: PerformanceObserver | null = null;
	private mutationObserver: MutationObserver | null = null;
	private errorHandler: ((event: Event) => void) | null = null;
	/** Retries scheduled so far, keyed by the URL without retry parameters. */
	private retryAttempts = new Map<string, number>();
	/** Elements that failed to load each URL; a retry reloads the first one. */
	private retryTargets = new Map<string, Set<ResourceElement>>();
	private container: HTMLElement | null = null;
	private readonly isBrowser =
		typeof window !== "undefined" && typeof document !== "undefined";
	/** URLs referenced inside the container; timing entries for others are ignored. */
	private containerResources = new Set<string>();
	private provider: InstrumentationProvider | undefined;
	private started = false;
	/**
	 * Bumped on every start and stop, so timers and listeners captured in an
	 * earlier lifecycle see themselves as stale.
	 */
	private lifecycleVersion = 0;
	private pendingRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private retryInFlight = new Set<string>();
	private pendingMediaChecks = new Map<
		string,
		{
			cleanup: () => void;
		}
	>();

	constructor(config: ResourceMonitorConfig = {}) {
		this.config = {
			trackPageActions:
				config.trackPageActions ?? DEFAULT_CONFIG.trackPageActions,
			manageProviderLifecycle:
				config.manageProviderLifecycle ??
				DEFAULT_CONFIG.manageProviderLifecycle,
			maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
			initialRetryDelay:
				config.initialRetryDelay ?? DEFAULT_CONFIG.initialRetryDelay,
			maxRetryDelay: config.maxRetryDelay ?? DEFAULT_CONFIG.maxRetryDelay,
			debug: config.debug ?? DEFAULT_CONFIG.debug,
		};
		this.logger = createPieLogger("resource-monitor", () =>
			this.isDebugEnabled(),
		);
		this.provider = isInstrumentationProvider(config.instrumentationProvider)
			? config.instrumentationProvider
			: undefined;
		if (config.instrumentationProvider && !this.provider) {
			if (this.isDebugEnabled()) {
				this.logger.warn(
					"Ignoring invalid instrumentation provider; expected InstrumentationProvider shape",
				);
			}
		}

		// Initialize the provider (async, but don't block constructor)
		if (this.provider && this.config.manageProviderLifecycle) {
			this.provider.initialize().catch((err) => {
				if (this.isDebugEnabled()) {
					this.logger.warn(
						"Failed to initialize instrumentation provider:",
						err,
					);
				}
			});
		} else if (this.provider && this.isDebugEnabled()) {
			this.logger.debug(
				"Skipping provider lifecycle management for injected provider",
			);
		}
	}

	/**
	 * Check if debug logging is enabled (dynamically checks window.PIE_DEBUG)
	 */
	private isDebugEnabled(): boolean {
		return this.config.debug || isGlobalDebugEnabled();
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

	private withRetryParams(url: string, attempt: number): string {
		const retryValue = String(attempt);
		const timestamp = Date.now().toString();
		try {
			const parsed = new URL(url);
			parsed.searchParams.set("retry", retryValue);
			parsed.searchParams.set("t", timestamp);
			return parsed.toString();
		} catch {
			// Fallback for relative or malformed URLs.
			const separator = url.includes("?") ? "&" : "?";
			return `${url}${separator}retry=${encodeURIComponent(retryValue)}&t=${encodeURIComponent(timestamp)}`;
		}
	}

	private getMediaErrorName(code: number | undefined): string | undefined {
		switch (code) {
			case 1:
				return "MEDIA_ERR_ABORTED";
			case 2:
				return "MEDIA_ERR_NETWORK";
			case 3:
				return "MEDIA_ERR_DECODE";
			case 4:
				return "MEDIA_ERR_SRC_NOT_SUPPORTED";
			default:
				return undefined;
		}
	}

	private buildResourceErrorDiagnostics(
		target: ResourceElement,
		args: {
			eventType: string;
			resourceUrl: string;
			originalUrl: string;
			currentRetries: number;
			remainingRetries: number;
			willRetry: boolean;
		},
	): ResourceErrorDiagnostics {
		const diagnostics: ResourceErrorDiagnostics = {
			eventType: args.eventType,
			tagName: target.tagName.toLowerCase(),
			resourceUrl: args.resourceUrl,
			originalUrl: args.originalUrl,
			currentRetries: args.currentRetries,
			remainingRetries: args.remainingRetries,
			willRetry: args.willRetry,
			cacheBypassActive:
				args.resourceUrl.includes("retry=") || args.resourceUrl.includes("t="),
		};

		if (
			target instanceof HTMLAudioElement ||
			target instanceof HTMLVideoElement
		) {
			const mediaError = target.error;
			const mediaErrorCode = mediaError?.code;
			diagnostics.currentSrc = target.currentSrc || target.src;
			diagnostics.readyState = target.readyState;
			diagnostics.networkState = target.networkState;
			diagnostics.paused = target.paused;
			diagnostics.ended = target.ended;
			diagnostics.currentTime = target.currentTime;
			diagnostics.duration = Number.isFinite(target.duration)
				? target.duration
				: null;
			diagnostics.mediaErrorCode = mediaErrorCode;
			diagnostics.mediaErrorName = this.getMediaErrorName(mediaErrorCode);
			diagnostics.mediaErrorMessage =
				typeof mediaError?.message === "string"
					? mediaError.message
					: undefined;
		}

		return diagnostics;
	}

	/**
	 * Track event with instrumentation provider if enabled
	 */
	private trackInstrumentationEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		if (!this.config.trackPageActions || !this.provider?.isReady()) {
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
		if (!this.config.trackPageActions || !this.provider?.isReady()) {
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
		if (this.started) {
			if (this.container === container) {
				return;
			}
			this.stop();
		}

		if (!this.isBrowser) {
			this.logger.debug(
				"Not in browser environment, skipping resource monitoring",
			);
			return;
		}

		this.container = container;
		this.lifecycleVersion += 1;

		this.setupMutationObserver();
		this.scanContainerResources(); // Initial scan of existing resources
		this.setupPerformanceObserver();
		this.setupErrorHandler();
		this.started = true;

		this.logger.info("✅ Resource monitoring started");
	}

	public stop(): void {
		if (!this.started) return;
		this.lifecycleVersion += 1;

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
		this.retryTargets.clear();
		this.retryInFlight.clear();
		for (const timer of this.pendingRetryTimers.values()) {
			clearTimeout(timer);
		}
		this.pendingRetryTimers.clear();
		for (const pending of this.pendingMediaChecks.values()) {
			pending.cleanup();
		}
		this.pendingMediaChecks.clear();
		this.containerResources.clear();
		this.container = null;
		this.started = false;

		if (this.provider && this.config.manageProviderLifecycle) {
			try {
				this.provider.destroy();
			} catch (error) {
				if (this.isDebugEnabled()) {
					this.logger.warn(
						"Failed to destroy instrumentation provider:",
						error,
					);
				}
			}
		}

		this.logger.info("Resource monitoring stopped");
	}

	/**
	 * Tracks resources added to the container, or retargeted inside it, so
	 * timing entries can be attributed to this container.
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
					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement) {
							this.scanElementForResources(node);
						}
					});

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
		if (this.isResourceElement(element)) {
			const src = this.getResourceSrc(element);
			if (src) {
				this.containerResources.add(src);
				if (this.isDebugEnabled()) {
					this.logger.debug(`📌 Tracked new resource in container: ${src}`);
				}
			}
		}

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
					const src = this.getResourceSrc(el);
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

			// `buffered` replays resources that loaded before the observer
			// started, and is honored only with the single `type` form.
			this.observer.observe({
				type: "resource",
				buffered: true,
			});

			this.logger.debug("PerformanceObserver set up successfully");
		} catch (error) {
			this.logger.warn("Failed to set up PerformanceObserver:", error);
		}
	}

	private handleResourceTiming(entry: PerformanceResourceTiming): void {
		if (!this.isRelevantResource(entry)) {
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
		const originalUrl = this.getOriginalUrl(entry.name);

		// A zero responseEnd means the request never completed. A zero
		// transferSize does not: cached, cross-origin and tiny responses all
		// report it. The error listener remains the main failure signal.
		const failed = entry.responseEnd === 0 && entry.duration > 0;

		const wasRetried = this.retryAttempts.has(originalUrl);
		const retryCount = this.retryAttempts.get(originalUrl) || 0;

		this.logResourceTiming(entry, failed, wasRetried, retryCount);

		if (!failed) {
			this.handleSuccessfulLoad(
				originalUrl,
				entry,
				duration,
				size,
				retryCount,
				wasRetried,
			);
		}

		this.trackInstrumentationEvent("pie-resource-load", {
			url: entry.name,
			duration: Math.round(duration),
			size,
			type: entry.initiatorType,
			failed,
			wasRetried,
			retryCount,
		});

		if (failed) {
			this.handleFailedLoad(
				originalUrl,
				entry,
				duration,
				retryCount,
				wasRetried,
			);
		}
	}

	private logResourceTiming(
		entry: PerformanceResourceTiming,
		failed: boolean,
		wasRetried: boolean,
		retryCount: number,
	): void {
		const duration = entry.duration;
		const size = entry.transferSize;
		if (!this.isDebugEnabled()) {
			this.logger.debug(`Resource loaded: ${entry.name}`, {
				duration: `${duration.toFixed(2)}ms`,
				size: `${size} bytes`,
				type: entry.initiatorType,
				failed,
				wasRetried,
				retryCount,
			});
			return;
		}

		const shortUrl = this.truncateUrl(entry.name);
		const sizeKB = (size / 1024).toFixed(2);
		const status = failed ? "❌ FAILED" : "✅ SUCCESS";
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
	}

	private isLifecycleActive(version: number): boolean {
		return this.started && this.lifecycleVersion === version;
	}

	private clearRetryTracking(url: string): void {
		this.retryAttempts.delete(url);
		this.retryTargets.delete(url);
		this.retryInFlight.delete(url);
	}

	private clearPendingMediaCheck(url: string): void {
		const pending = this.pendingMediaChecks.get(url);
		if (!pending) return;
		pending.cleanup();
		this.pendingMediaChecks.delete(url);
	}

	private getRetryTargets(url: string): Set<ResourceElement> {
		let trackedTargets = this.retryTargets.get(url);
		if (!trackedTargets) {
			trackedTargets = new Set<ResourceElement>();
			this.retryTargets.set(url, trackedTargets);
		}
		return trackedTargets;
	}

	private getPrimaryRetryTarget(url: string): ResourceElement | null {
		const targets = this.retryTargets.get(url);
		if (!targets || targets.size === 0) return null;
		for (const target of targets) {
			return target;
		}
		return null;
	}

	private handleSuccessfulLoad(
		url: string,
		entry: PerformanceResourceTiming,
		duration: number,
		size: number,
		retryCount: number,
		wasRetried: boolean,
	): void {
		const detail: ResourceMonitorEventDetail = {
			url,
			resourceType: entry.initiatorType,
			duration,
			size,
			retryCount,
			maxRetries: this.config.maxRetries,
		};
		const isMediaInitiator =
			entry.initiatorType === "audio" ||
			entry.initiatorType === "video" ||
			entry.initiatorType === "source";

		if (wasRetried && isMediaInitiator) {
			this.reconcileMediaRetrySuccess(url, detail);
			return;
		}

		this.dispatchEvent("pie-resource-load-success", detail);
		if (wasRetried) {
			this.finalizeRetrySuccess(url, detail);
		}
	}

	private resolveMediaTarget(target: ResourceElement): MediaTarget | null {
		if (target instanceof HTMLAudioElement) {
			return { mediaEl: target, mediaTag: "audio" };
		}
		if (target instanceof HTMLVideoElement) {
			return { mediaEl: target, mediaTag: "video" };
		}
		if (target instanceof HTMLSourceElement) {
			const parent = target.parentElement;
			if (parent instanceof HTMLAudioElement) {
				return { mediaEl: parent, mediaTag: "audio" };
			}
			if (parent instanceof HTMLVideoElement) {
				return { mediaEl: parent, mediaTag: "video" };
			}
		}
		return null;
	}

	private resolveMediaTargetsForUrl(url: string): MediaTarget[] {
		const targets = this.retryTargets.get(url);
		if (!targets || targets.size === 0) return [];
		const resolved = new Set<HTMLAudioElement | HTMLVideoElement>();
		const out: MediaTarget[] = [];
		for (const target of targets) {
			const mediaTarget = this.resolveMediaTarget(target);
			if (!mediaTarget) continue;
			const { mediaEl, mediaTag } = mediaTarget;
			if (resolved.has(mediaEl)) continue;
			const candidateUrl = mediaEl.currentSrc || mediaEl.src;
			if (candidateUrl && this.getOriginalUrl(candidateUrl) !== url) continue;
			resolved.add(mediaEl);
			out.push({ mediaEl, mediaTag });
		}
		return out;
	}

	private normalizeRetrySuccessResourceType(
		url: string,
		resourceType: string,
	): string {
		if (resourceType !== "source") return resourceType;
		const mediaTargets = this.resolveMediaTargetsForUrl(url);
		if (mediaTargets.length === 0) return resourceType;
		return mediaTargets[0].mediaTag;
	}

	private isMediaRetryRecovered(url: string): boolean {
		const mediaTargets = this.resolveMediaTargetsForUrl(url);
		if (mediaTargets.length === 0) return false;
		for (const { mediaEl } of mediaTargets) {
			const hasError = !!mediaEl.error;
			const hasNoSource =
				mediaEl.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
			const isReady = mediaEl.readyState >= HTMLMediaElement.HAVE_METADATA;
			if (!hasError && !hasNoSource && isReady) {
				return true;
			}
		}
		return false;
	}

	private finalizeRetrySuccess(
		url: string,
		detail: ResourceMonitorEventDetail,
	): void {
		if (!this.retryAttempts.has(url)) return;
		const successDetail: ResourceMonitorEventDetail = {
			...detail,
			resourceType: this.normalizeRetrySuccessResourceType(
				url,
				detail.resourceType,
			),
		};
		const shortUrl = this.truncateUrl(url);
		this.logger.info(
			`✅ PIE Resource Retry Succeeded!\n` +
				`   URL: ${shortUrl}\n` +
				`   Retry Attempt: ${successDetail.retryCount}\n` +
				`   Load Time: ${(successDetail.duration || 0).toFixed(2)}ms\n` +
				`   Result: Resource now available to user`,
		);
		this.dispatchEvent("pie-resource-retry-success", successDetail);
		this.dispatchMediaRetryReady(url, successDetail);
		this.clearPendingMediaCheck(url);
		this.clearRetryTracking(url);
	}

	/**
	 * A retried media fetch that succeeds does not mean the element recovered:
	 * it can still hold an error or no source. Success waits until a media
	 * target reports metadata, checked on `loadedmetadata`/`canplay` and by
	 * polling, and the reconciliation timeout bounds the wait.
	 */
	private reconcileMediaRetrySuccess(
		url: string,
		detail: ResourceMonitorEventDetail,
	): void {
		this.clearPendingMediaCheck(url);
		if (this.isMediaRetryRecovered(url)) {
			this.completeMediaRetry(url, detail);
			return;
		}
		if (this.isDebugEnabled()) {
			this.logger.debug(
				`⏳ Waiting for media readiness before retry success: ${this.truncateUrl(url)}`,
			);
		}
		const version = this.lifecycleVersion;
		const isStale = () =>
			!this.isLifecycleActive(version) || !this.retryAttempts.has(url);
		const mediaTargets = this.resolveMediaTargetsForUrl(url);
		const eventHandlers: Array<{
			mediaEl: MediaTarget["mediaEl"];
			handler: EventListener;
		}> = [];
		const pollTimer = setInterval(() => {
			if (isStale()) {
				this.clearPendingMediaCheck(url);
				return;
			}
			if (this.isMediaRetryRecovered(url)) {
				this.completeMediaRetry(url, detail);
			}
		}, MEDIA_RETRY_RECONCILIATION_POLL_MS);
		const timeoutTimer = setTimeout(() => {
			this.clearPendingMediaCheck(url);
			if (isStale()) return;
			this.handleMediaRetryReconciliationTimeout(url, detail);
		}, MEDIA_RETRY_RECONCILIATION_TIMEOUT_MS);
		for (const { mediaEl } of mediaTargets) {
			const handler: EventListener = () => {
				if (isStale() || !this.isMediaRetryRecovered(url)) return;
				this.completeMediaRetry(url, detail);
			};
			mediaEl.addEventListener("loadedmetadata", handler);
			mediaEl.addEventListener("canplay", handler);
			eventHandlers.push({ mediaEl, handler });
		}
		this.pendingMediaChecks.set(url, {
			cleanup: () => {
				clearInterval(pollTimer);
				clearTimeout(timeoutTimer);
				for (const { mediaEl, handler } of eventHandlers) {
					mediaEl.removeEventListener("loadedmetadata", handler);
					mediaEl.removeEventListener("canplay", handler);
				}
			},
		});
	}

	private completeMediaRetry(
		url: string,
		detail: ResourceMonitorEventDetail,
	): void {
		this.dispatchEvent("pie-resource-load-success", detail);
		this.finalizeRetrySuccess(url, detail);
	}

	private handleMediaRetryReconciliationTimeout(
		url: string,
		detail: ResourceMonitorEventDetail,
	): void {
		const shortUrl = this.truncateUrl(url);
		this.logger.warn(
			`⚠️  PIE Resource Retry Ready Timeout\n` +
				`   URL: ${shortUrl}\n` +
				`   Retry Attempt: ${detail.retryCount}\n` +
				`   Status: Media did not become healthy after fetch success`,
		);
		this.dispatchEvent("pie-resource-retry-failed", {
			...detail,
			error: "Media fetch succeeded but did not become ready before timeout",
		});
		this.trackInstrumentationError(
			new Error(
				`Resource retry reconciliation timed out before media was healthy: ${url}`,
			),
			{
				resourceUrl: url,
				resourceType: detail.resourceType,
				retryCount: detail.retryCount,
				errorType: "MediaRetryReadyTimeout",
			},
		);
		const retryTarget = this.getPrimaryRetryTarget(url);
		if (retryTarget) {
			this.retryResourceLoad(retryTarget, url);
			return;
		}
		this.handlePermanentFailure(url, detail.resourceType, detail.retryCount);
	}

	private dispatchMediaRetryReady(
		url: string,
		detail: ResourceMonitorEventDetail,
	): void {
		const mediaTargets = this.resolveMediaTargetsForUrl(url);
		if (mediaTargets.length === 0) return;
		for (const { mediaEl, mediaTag } of mediaTargets) {
			const event = new CustomEvent<MediaRetryReadyDetail>(
				"pie-media-retry-ready",
				{
					detail: {
						...detail,
						mediaTag,
					},
					bubbles: true,
					composed: true,
				},
			);
			mediaEl.dispatchEvent(event);
		}
	}

	private handleFailedLoad(
		url: string,
		entry: PerformanceResourceTiming,
		duration: number,
		retryCount: number,
		wasRetried: boolean,
	): void {
		const shortUrl = this.truncateUrl(url);

		if (wasRetried) {
			this.logger.warn(
				`⚠️  PIE Resource Retry Failed\n` +
					`   URL: ${shortUrl}\n` +
					`   Retry Attempt: ${retryCount}\n` +
					`   Remaining Attempts: ${this.config.maxRetries - retryCount}\n` +
					`   Status: Will ${retryCount >= this.config.maxRetries ? "give up" : "retry again"}`,
			);
			this.dispatchEvent("pie-resource-retry-failed", {
				url,
				resourceType: entry.initiatorType,
				duration,
				retryCount,
				maxRetries: this.config.maxRetries,
				error: "Resource load failed after retry",
			});
		} else {
			this.logger.warn(
				`⚠️  PIE Resource Initial Load Failed\n` +
					`   URL: ${shortUrl}\n` +
					`   Status: Will attempt ${this.config.maxRetries} ${this.config.maxRetries === 1 ? "retry" : "retries"}`,
			);
			this.dispatchEvent("pie-resource-load-failed", {
				url,
				resourceType: entry.initiatorType,
				duration,
				retryCount: 0,
				maxRetries: this.config.maxRetries,
				error: "Initial resource load failed",
			});
		}

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
	 * Whether a timing entry belongs to this container. Timing entries carry
	 * absolute URLs, so a suffix match against a tracked URL also counts. The
	 * buffered observer also reports resources that loaded before the scan
	 * tracked them; those are looked up in the container's DOM.
	 */
	private isRelevantResource(entry: PerformanceResourceTiming): boolean {
		const url = entry.name;
		if (this.containerResources.has(url)) return true;

		for (const containerUrl of this.containerResources) {
			if (url.endsWith(containerUrl) || containerUrl.endsWith(url)) {
				return true;
			}
		}

		if (!this.isResourceInContainer(url, entry.initiatorType)) return false;
		this.containerResources.add(url);
		if (this.isDebugEnabled()) {
			this.logger.debug(
				`📌 Retroactively tracked resource: ${this.truncateUrl(url)}`,
			);
		}
		return true;
	}

	private isResourceInContainer(url: string, initiatorType: string): boolean {
		if (!this.container) {
			return false;
		}

		try {
			const urlObj = new URL(url);
			const urlPath = urlObj.pathname + urlObj.search;
			const selector = RESOURCE_SELECTOR_BY_INITIATOR.get(initiatorType);
			if (!selector) return false;
			for (const el of this.container.querySelectorAll<ResourceElement>(
				selector,
			)) {
				const src = this.getResourceSrc(el);
				if (src && (src === url || src.endsWith(urlPath))) {
					return true;
				}
			}
		} catch (error) {
			if (this.isDebugEnabled()) {
				this.logger.debug(
					`Error checking if resource is in container: ${error}`,
				);
			}
		}

		return false;
	}

	private setupErrorHandler(): void {
		if (!this.container) {
			return;
		}

		this.errorHandler = (event: Event) => {
			const target = event.target;
			if (!this.isResourceElement(target)) {
				return;
			}

			const tagName = target.tagName.toLowerCase();
			const src = this.getResourceSrc(target);

			if (!src) {
				return;
			}

			const originalSrc = this.getOriginalUrl(src);
			const currentRetries = this.retryAttempts.get(originalSrc) || 0;
			const remainingRetries = this.config.maxRetries - currentRetries;
			const willRetry = remainingRetries > 0;
			const diagnostics = this.buildResourceErrorDiagnostics(target, {
				eventType: event.type,
				resourceUrl: src,
				originalUrl: originalSrc,
				currentRetries,
				remainingRetries,
				willRetry,
			});

			const logMethod = willRetry
				? this.logger.warn.bind(this.logger)
				: this.logger.error.bind(this.logger);
			const icon = willRetry ? "⚠️" : "❌";
			if (this.isDebugEnabled()) {
				const shortUrl = this.truncateUrl(src);
				logMethod(
					`${icon} PIE Resource Load Error\n` +
						`   Element: <${tagName}>\n` +
						`   URL: ${shortUrl}\n` +
						`   Current Attempts: ${currentRetries}\n` +
						`   Remaining Retries: ${remainingRetries}/${this.config.maxRetries}\n` +
						`   Action: ${willRetry ? "Will retry with exponential backoff" : "Max retries reached, giving up"}`,
					diagnostics,
				);
			} else {
				logMethod(`${icon} Resource error: ${tagName} failed to load ${src}`);
			}

			this.trackInstrumentationEvent("pie-resource-load-error", diagnostics);
			this.trackInstrumentationError(
				new Error(`Resource load error: ${originalSrc}`),
				{
					resourceType: tagName,
					...diagnostics,
				},
			);

			this.retryResourceLoad(target, originalSrc);
		};

		// Resource `error` events do not bubble, so only a capturing listener on
		// the container sees them.
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
		this.clearPendingMediaCheck(url);
		this.clearRetryTracking(url);
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

		this.dispatchEvent("pie-resource-load-error", {
			url,
			resourceType,
			retryCount,
			maxRetries: this.config.maxRetries,
			error: `Resource permanently failed after ${this.config.maxRetries} retries`,
		});
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

	/** Exponential backoff, capped at `maxRetryDelay`. */
	private retryDelay(retryCount: number): number {
		return Math.min(
			this.config.initialRetryDelay * 2 ** retryCount,
			this.config.maxRetryDelay,
		);
	}

	private logRetrySchedule(
		url: string,
		retryCount: number,
		delay: number,
		elementTag: string,
	): void {
		if (this.isDebugEnabled()) {
			const shortUrl = this.truncateUrl(url);
			const nextDelay = this.retryDelay(retryCount + 1);
			const strategy = RETRY_STRATEGY_BY_TAG.get(elementTag) ?? "URL update";

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
	 * Reloads one element under a cache-busting URL. Media elements also need
	 * `load()`, since changing a `<source>` alone does not restart the fetch.
	 */
	private performRetryLoadAttempt(
		element: ResourceElement,
		originalSrc: string,
		attemptNumber: number,
	): void {
		try {
			if (
				element instanceof HTMLAudioElement ||
				element instanceof HTMLVideoElement
			) {
				const retryUrl = this.withRetryParams(originalSrc, attemptNumber);
				if (element.src) {
					element.src = retryUrl;
				} else {
					const source = Array.from(element.querySelectorAll("source")).find(
						(candidate) =>
							typeof candidate.src === "string" &&
							this.getOriginalUrl(candidate.src) === originalSrc,
					);
					if (source) {
						source.src = retryUrl;
					}
				}
				element.load();
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Triggered load() on <${element.tagName.toLowerCase()}> with cache-busting params`,
					);
				}
			} else if (element instanceof HTMLSourceElement) {
				const retryUrl = this.withRetryParams(originalSrc, attemptNumber);
				element.src = retryUrl;
				const parent = element.parentElement;
				if (
					parent instanceof HTMLAudioElement ||
					parent instanceof HTMLVideoElement
				) {
					parent.load();
				}
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Updated <source> src with cache-busting params and reloaded parent media: retry=${attemptNumber}`,
					);
				}
			} else if (element instanceof HTMLImageElement) {
				element.src = this.withRetryParams(originalSrc, attemptNumber);
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Updated <img> src with cache-busting params: retry=${attemptNumber}, t=${Date.now()}`,
					);
				}
			} else if (element instanceof HTMLLinkElement) {
				element.href = this.withRetryParams(originalSrc, attemptNumber);
				if (this.isDebugEnabled()) {
					this.logger.debug(
						`✓ Updated <link> href with cache-busting params: retry=${attemptNumber}, t=${Date.now()}`,
					);
				}
			}
		} catch (error) {
			const diagnostics = this.buildResourceErrorDiagnostics(element, {
				eventType: "retry",
				resourceUrl: this.getResourceSrc(element) || originalSrc,
				originalUrl: originalSrc,
				currentRetries: attemptNumber,
				remainingRetries: Math.max(0, this.config.maxRetries - attemptNumber),
				willRetry: attemptNumber < this.config.maxRetries,
			});
			if (this.isDebugEnabled()) {
				this.logger.error(
					`❌ Error during retry attempt for ${originalSrc}:`,
					error,
					diagnostics,
				);
			} else {
				this.logger.error(`Error during retry for ${originalSrc}:`, error);
			}
			this.trackInstrumentationError(
				new Error(`Retry attempt error for resource: ${originalSrc}`),
				diagnostics,
			);
		}
	}

	/**
	 * Schedules the next retry of a failed resource with exponential backoff,
	 * or fails it permanently once `maxRetries` is spent. Every failing element
	 * joins the URL's retry targets; concurrent errors for one URL share the
	 * retry already in flight.
	 */
	private retryResourceLoad(
		element: ResourceElement,
		originalSrc: string,
	): void {
		this.getRetryTargets(originalSrc).add(element);
		if (!this.started) return;
		if (this.retryInFlight.has(originalSrc)) {
			if (this.isDebugEnabled()) {
				this.logger.debug(
					`Retry already scheduled for ${this.truncateUrl(originalSrc)}; skipping duplicate error-triggered schedule`,
				);
			}
			return;
		}
		const currentRetries = this.retryAttempts.get(originalSrc) || 0;
		if (currentRetries >= this.config.maxRetries) {
			this.handlePermanentFailure(
				originalSrc,
				element.tagName.toLowerCase(),
				currentRetries,
			);
			return;
		}
		const delay = this.retryDelay(currentRetries);
		const attemptNumber = currentRetries + 1;
		this.retryInFlight.add(originalSrc);
		this.retryAttempts.set(originalSrc, attemptNumber);
		this.logRetrySchedule(
			originalSrc,
			currentRetries,
			delay,
			element.tagName.toLowerCase(),
		);
		this.trackInstrumentationEvent("pie-resource-retry", {
			url: originalSrc,
			attempt: attemptNumber,
			delay,
		});
		const version = this.lifecycleVersion;
		const timer = setTimeout(() => {
			this.pendingRetryTimers.delete(originalSrc);
			this.retryInFlight.delete(originalSrc);
			if (!this.isLifecycleActive(version)) {
				return;
			}
			const retryTarget = this.getPrimaryRetryTarget(originalSrc);
			if (!retryTarget) return;
			if (this.isDebugEnabled()) {
				this.logger.debug(
					`⏱️  Retry wait completed (${delay}ms), attempting reload now...`,
				);
			}
			this.performRetryLoadAttempt(retryTarget, originalSrc, attemptNumber);
		}, delay);
		this.pendingRetryTimers.set(originalSrc, timer);
	}

	private dispatchEvent(
		eventName: string,
		detail: ResourceMonitorEventDetail,
	): void {
		if (!this.container) {
			return;
		}

		const event = new CustomEvent(eventName, {
			detail,
			bubbles: true,
			composed: true,
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
