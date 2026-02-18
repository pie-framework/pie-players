/**
 * Svelte 5 Composable for Resource Monitoring
 *
 * Provides reusable resource monitoring logic for PIE players.
 * Uses Svelte 5 runes for reactivity and lifecycle management.
 *
 * Usage in a Svelte 5 component:
 * ```svelte
 * <script lang="ts">
 *   import { useResourceMonitor } from './use-resource-monitor.svelte';
 *
 *   let hostElement = $state<HTMLElement | null>(null);
 *   const debugEnabled = $derived(debug || isGlobalDebugEnabled());
 *
 *   // Initialize resource monitoring
 *   const resourceMonitor = useResourceMonitor(
 *     () => hostElement,
 *     () => loaderConfig,
 *     () => debugEnabled,
 *     'pie-fixed-player'
 *   );
 * </script>
 * ```
 */

import { onDestroy } from "svelte";
import type { LoaderConfig } from "../loader-config.js";
import { DEFAULT_LOADER_CONFIG } from "../loader-config.js";
import { createPieLogger } from "./logger.js";
import { ResourceMonitor } from "./resource-monitor.js";

// Default maximum retry delay (matches ResourceMonitor default)
const DEFAULT_MAX_RETRY_DELAY = 5000;

/**
 * Svelte 5 composable for resource monitoring
 *
 * @param getHostElement - Function that returns the current host element (reactive)
 * @param getLoaderConfig - Function that returns the current loader config (reactive)
 * @param getDebugEnabled - Function that returns the current debug state (reactive)
 * @param componentName - Name of the component for logging
 * @returns Object with monitor instance and stats getter
 */
export function useResourceMonitor(
	getHostElement: () => HTMLElement | null,
	getLoaderConfig: () => LoaderConfig,
	getDebugEnabled: () => boolean,
	componentName: string = "pie-player",
) {
	const logger = createPieLogger("use-resource-monitor", getDebugEnabled);

	let monitor = $state<ResourceMonitor | null>(null);
	let isInitialized = $state(false);

	// Initialize resource monitor when conditions are met
	$effect(() => {
		const hostElement = getHostElement();
		const loaderConfig = getLoaderConfig();
		const debugEnabled = getDebugEnabled();

		// Clean up existing monitor if host element becomes null
		if (!hostElement && monitor) {
			logger.debug(
				`Host element removed, stopping resource monitor for ${componentName}`,
			);
			monitor.stop();
			monitor = null;
			isInitialized = false;
			return;
		}

		// Initialize if we have a host element (retry logic works independently of trackPageActions)
		if (hostElement && !isInitialized) {
			logger.debug(`Initializing resource monitor for ${componentName}`, {
				trackPageActions: loaderConfig?.trackPageActions ?? false,
				maxRetries:
					loaderConfig?.maxResourceRetries ??
					DEFAULT_LOADER_CONFIG.maxResourceRetries,
				retryDelay:
					loaderConfig?.resourceRetryDelay ??
					DEFAULT_LOADER_CONFIG.resourceRetryDelay,
				hasContainer: !!hostElement,
			});

			// Create and start resource monitor with config from loaderConfig
			monitor = new ResourceMonitor({
				trackPageActions: loaderConfig?.trackPageActions ?? false,
				maxRetries:
					loaderConfig?.maxResourceRetries ??
					DEFAULT_LOADER_CONFIG.maxResourceRetries,
				initialRetryDelay:
					loaderConfig?.resourceRetryDelay ??
					DEFAULT_LOADER_CONFIG.resourceRetryDelay,
				maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,
				debug: debugEnabled,
			});

			monitor.start(hostElement);
			isInitialized = true;
			logger.info(
				`✅ Resource monitoring enabled for ${componentName}` +
					(loaderConfig?.trackPageActions
						? " (with New Relic tracking)"
						: " (retry only)"),
			);
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (monitor) {
			const stats = monitor.getStats();
			logger.debug(
				`Resource monitor stats at cleanup for ${componentName}:`,
				stats,
			);
			monitor.stop();
			monitor = null;
			isInitialized = false;
		}
	});

	// Return reactive getters
	return {
		/**
		 * Get the current monitor instance (may be null)
		 */
		get instance() {
			return monitor;
		},

		/**
		 * Get current statistics from the monitor
		 */
		getStats() {
			return monitor?.getStats() ?? { activeRetries: 0, failedResources: [] };
		},

		/**
		 * Check if monitoring is active
		 */
		get isActive() {
			return isInitialized && monitor !== null;
		},
	};
}
