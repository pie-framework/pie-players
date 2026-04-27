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
 *     'pie-item-player'
 *   );
 * </script>
 * ```
 */

import { onDestroy, untrack } from "svelte";
import type { LoaderConfig } from "../loader-config.js";
import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
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
	let activeHostElement = $state<HTMLElement | null>(null);
	let monitorConfigKey = $state<string>("");
	let activeProvider = $state<LoaderConfig["instrumentationProvider"] | undefined>(
		undefined,
	);

	// Initialize resource monitor when conditions are met.
	//
	// The body of this effect both reads and writes the local `$state`
	// latches (`monitor`, `isInitialized`, `activeHostElement`,
	// `monitorConfigKey`, `activeProvider`) — those latches exist so the
	// public `instance`/`isActive` getters stay reactive for downstream
	// consumers, but the same-effect read+write would otherwise trip
	// `effect_update_depth_exceeded` on every host/config/provider change
	// (observed in the assessment-player smoke flow during instrumentation
	// provider rebinding). Per `.cursor/rules/svelte-subscription-safety.mdc`,
	// we explicitly track only the input getters and run the body inside
	// `untrack(...)` so the self-mutations don't re-trigger the effect.
	$effect(() => {
		void getHostElement();
		void getLoaderConfig();
		void getDebugEnabled();
		untrack(() => {
			const hostElement = getHostElement();
			const loaderConfig = getLoaderConfig();
			const debugEnabled = getDebugEnabled();
			const resolvedTrackPageActions = loaderConfig?.trackPageActions ?? false;
			const resolvedMaxRetries =
				loaderConfig?.maxResourceRetries ??
				DEFAULT_LOADER_CONFIG.maxResourceRetries;
			const resolvedRetryDelay =
				loaderConfig?.resourceRetryDelay ??
				DEFAULT_LOADER_CONFIG.resourceRetryDelay;
			const resolvedInstrumentationProvider = isInstrumentationProvider(
				loaderConfig?.instrumentationProvider,
			)
				? loaderConfig?.instrumentationProvider
				: undefined;
			if (
				debugEnabled &&
				loaderConfig?.instrumentationProvider &&
				!resolvedInstrumentationProvider
			) {
				logger.warn(
					`Ignoring invalid instrumentation provider for ${componentName}; expected InstrumentationProvider contract`,
				);
			}
			const nextConfigKey = JSON.stringify({
				trackPageActions: resolvedTrackPageActions,
				maxRetries: resolvedMaxRetries,
				retryDelay: resolvedRetryDelay,
				debugEnabled,
			});
			const providerChanged = activeProvider !== resolvedInstrumentationProvider;
			const hostChanged = activeHostElement !== hostElement;
			const configChanged = monitorConfigKey !== nextConfigKey;
			const shouldReinitialize =
				hostElement && isInitialized && (hostChanged || configChanged || providerChanged);

			if (!hostElement && monitor) {
				logger.debug(
					`Host element removed, stopping resource monitor for ${componentName}`,
				);
				monitor.stop();
				monitor = null;
				isInitialized = false;
				activeHostElement = null;
				activeProvider = undefined;
				monitorConfigKey = "";
				return;
			}

			if (shouldReinitialize && monitor) {
				logger.debug(`Reinitializing resource monitor for ${componentName}`, {
					hostChanged,
					configChanged,
					providerChanged,
				});
				monitor.stop();
				monitor = null;
				isInitialized = false;
			}

			if (hostElement && !isInitialized) {
				logger.debug(`Initializing resource monitor for ${componentName}`, {
					trackPageActions: resolvedTrackPageActions,
					maxRetries: resolvedMaxRetries,
					retryDelay: resolvedRetryDelay,
					hasCustomProvider: !!resolvedInstrumentationProvider,
					hasContainer: !!hostElement,
				});

				monitor = new ResourceMonitor({
					trackPageActions: resolvedTrackPageActions,
					instrumentationProvider: resolvedInstrumentationProvider,
					maxRetries: resolvedMaxRetries,
					initialRetryDelay: resolvedRetryDelay,
					maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,
					debug: debugEnabled,
				});

				monitor.start(hostElement);
				isInitialized = true;
				activeHostElement = hostElement;
				activeProvider = resolvedInstrumentationProvider;
				monitorConfigKey = nextConfigKey;
				logger.info(
					`✅ Resource monitoring enabled for ${componentName}` +
						(resolvedTrackPageActions
							? resolvedInstrumentationProvider
								? " (with custom instrumentation provider)"
								: " (with New Relic tracking)"
							: " (retry only)"),
				);
			}
		});
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
			activeHostElement = null;
			activeProvider = undefined;
			monitorConfigKey = "";
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
