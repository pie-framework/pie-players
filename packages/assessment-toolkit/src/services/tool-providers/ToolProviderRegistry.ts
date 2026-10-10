/**
 * Tool Provider Registry
 *
 * Centralized registry for managing tool providers.
 * Handles initialization, authentication, and lazy loading.
 *
 * Part of PIE Assessment Toolkit.
 */

import {
	createPieLogger,
	isGlobalDebugEnabled,
} from "@pie-players/pie-players-shared/pie";
import type { ToolProviderApi, ToolCategory } from "./ToolProviderApi.js";

// Lifecycle lines need `window.PIE_DEBUG = true`, read on each line.
const logger = createPieLogger("ToolProviderRegistry", isGlobalDebugEnabled);

/**
 * What `register` takes: the provider, its config, and how it starts.
 */
export interface ToolProviderRegistration<TConfig = any> {
	/**
	 * Provider instance to register
	 */
	provider: ToolProviderApi;

	/**
	 * Configuration for this provider
	 * (may include auth credentials, endpoints, etc.)
	 */
	config: TConfig;

	/**
	 * Lazy initialization - don't initialize until first use
	 *
	 * @default true
	 * @note Set to false for providers that must be ready immediately
	 */
	lazy?: boolean;

	/**
	 * Auth fetcher - function to retrieve auth credentials from backend
	 *
	 * Called during initialization if the provider requires auth.
	 * The returned data is merged with the config before initialization.
	 *
	 * @example
	 * ```typescript
	 * authFetcher: async () => {
	 *   const response = await fetch('/api/tools/desmos/auth');
	 *   return response.json(); // { apiKey: '...' }
	 * }
	 * ```
	 */
	authFetcher?: () => Promise<Partial<TConfig>>;

	/**
	 * Optional telemetry callback used for provider lifecycle/backend instrumentation.
	 */
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

/**
 * Tool Provider Registry
 *
 * Manages the lifecycle of tool providers:
 * - Registration
 * - Lazy initialization
 * - Auth credential fetching
 * - Provider lookup by tool id or category
 *
 * The toolkit coordinator registers each provider under its tool's id.
 *
 * @example
 * ```typescript
 * const registry = new ToolProviderRegistry();
 *
 * // Register a provider with auth fetcher
 * registry.register('calculator', {
 *   provider: new ExampleToolProvider(),
 *   config: {},
 *   lazy: true,
 *   authFetcher: async () => {
 *     const response = await fetch('/api/example/token');
 *     return response.json();
 *   },
 * });
 *
 * // Get provider (auto-initializes if lazy)
 * const provider = await registry.getProvider('calculator');
 * ```
 */
export class ToolProviderRegistry {
	private providers = new Map<string, ToolProviderApi>();
	private configs = new Map<string, ToolProviderRegistration>();
	private initialized = new Map<string, boolean>();
	private initializationPromises = new Map<string, Promise<void>>();

	private async emitTelemetry(
		config: ToolProviderRegistration,
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await config.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[ToolProviderRegistry] Telemetry callback failed:", error);
		}
	}

	/**
	 * Register a tool provider
	 *
	 * Adds a provider to the registry. If lazy is false, initializes immediately.
	 * A registration under an id already registered replaces it: the replaced
	 * provider is destroyed once a start in progress settles, and a caller
	 * waiting on that start gets the replacement.
	 *
	 * @param toolId Id of the tool the provider serves
	 * @param config Provider configuration
	 */
	register(toolId: string, config: ToolProviderRegistration): void {
		const replaced = this.providers.get(toolId);
		const replacedStart = this.initializationPromises.get(toolId);

		this.providers.set(toolId, config.provider);
		this.configs.set(toolId, config);
		this.initialized.set(toolId, false);
		this.initializationPromises.delete(toolId);

		if (replaced) {
			if (replacedStart) {
				void replacedStart
					.catch(() => {})
					.then(() => this.destroyProvider(toolId, replaced));
			} else {
				this.destroyProvider(toolId, replaced);
			}
		}

		logger.debug(
			`${replaced ? "Replaced" : "Registered"} provider "${toolId}" (${config.provider.providerName})`,
		);

		// Initialize immediately if not lazy
		if (config.lazy === false) {
			this.initialize(toolId).catch((error) => {
				console.error(
					`[ToolProviderRegistry] Failed to initialize provider "${toolId}":`,
					error,
				);
			});
		}
	}

	/**
	 * Initialize a provider
	 *
	 * Fetches auth if needed and initializes the provider.
	 * Safe to call multiple times - subsequent calls wait for first initialization.
	 *
	 * @param toolId Tool whose provider to initialize
	 * @returns Promise that resolves when initialization complete
	 * @throws Error if provider not registered or initialization fails
	 */
	async initialize(toolId: string): Promise<void> {
		// Already initialized
		if (this.initialized.get(toolId)) {
			return;
		}

		// Initialization in progress - wait for it
		const existingPromise = this.initializationPromises.get(toolId);
		if (existingPromise) {
			return existingPromise;
		}

		// Start new initialization
		const provider = this.providers.get(toolId);
		const initPromise = this._doInitialize(toolId);
		this.initializationPromises.set(toolId, initPromise);

		try {
			await initPromise;
		} catch (error) {
			if (!this.isReplaced(toolId, provider)) throw error;
		} finally {
			if (this.initializationPromises.get(toolId) === initPromise) {
				this.initializationPromises.delete(toolId);
			}
		}
		if (this.isReplaced(toolId, provider)) {
			return this.initialize(toolId);
		}
	}

	/** Whether a registration replaced `provider` under `toolId`. */
	private isReplaced(
		toolId: string,
		provider: ToolProviderApi | undefined,
	): boolean {
		const current = this.providers.get(toolId);
		return current !== undefined && current !== provider;
	}

	private destroyProvider(toolId: string, provider: ToolProviderApi): void {
		try {
			provider.destroy();
		} catch (error) {
			console.warn(
				`[ToolProviderRegistry] Failed to destroy provider "${toolId}":`,
				error,
			);
		}
	}

	/**
	 * Internal initialization logic
	 */
	private async _doInitialize(toolId: string): Promise<void> {
		const provider = this.providers.get(toolId);
		const config = this.configs.get(toolId);

		if (!provider || !config) {
			throw new Error(
				`[ToolProviderRegistry] Provider "${toolId}" not registered`,
			);
		}

		// Start with base config
		let providerConfig = { ...config.config };
		const deriveBackend = (value: unknown): string => {
			const backend =
				value && typeof value === "object"
					? (value as { backend?: unknown }).backend
					: undefined;
			return typeof backend === "string" && backend ? backend : "unknown";
		};
		const providerInitStartedAt = Date.now();
		await this.emitTelemetry(config, "pie-tool-init-start", {
			toolId,
			backend: deriveBackend(providerConfig),
			operation: "provider-initialize",
		});

		// Fetch auth if needed
		if (provider.requiresAuth && config.authFetcher) {
			const authFetchStartedAt = Date.now();
			await this.emitTelemetry(config, "pie-tool-backend-call-start", {
				toolId,
				backend: deriveBackend(providerConfig),
				operation: "auth-fetch",
			});
			logger.debug(
				`Fetching auth for "${toolId}"...`,
			);
			try {
				const authData = await config.authFetcher();
				providerConfig = { ...providerConfig, ...authData };
				await this.emitTelemetry(config, "pie-tool-backend-call-success", {
					toolId,
					backend: deriveBackend(providerConfig),
					operation: "auth-fetch",
					duration: Date.now() - authFetchStartedAt,
				});
			} catch (error) {
				await this.emitTelemetry(config, "pie-tool-backend-call-error", {
					toolId,
					backend: deriveBackend(providerConfig),
					operation: "auth-fetch",
					duration: Date.now() - authFetchStartedAt,
					errorType: "ProviderAuthFetchError",
					message: error instanceof Error ? error.message : String(error),
				});
				console.error(
					`[ToolProviderRegistry] Auth fetch failed for "${toolId}":`,
					error,
				);
				throw new Error(
					`Failed to fetch auth credentials for provider "${toolId}"`,
				);
			}
		}

		// Initialize provider
		try {
			await provider.initialize(providerConfig);
			if (this.providers.get(toolId) === provider) {
				this.initialized.set(toolId, true);
			}
			await this.emitTelemetry(config, "pie-tool-init-success", {
				toolId,
				backend: deriveBackend(providerConfig),
				operation: "provider-initialize",
				duration: Date.now() - providerInitStartedAt,
			});
			logger.debug(
				`Provider "${toolId}" initialized`,
			);
		} catch (error) {
			await this.emitTelemetry(config, "pie-tool-init-error", {
				toolId,
				backend: deriveBackend(providerConfig),
				operation: "provider-initialize",
				duration: Date.now() - providerInitStartedAt,
				errorType: "ProviderInitializationError",
				message: error instanceof Error ? error.message : String(error),
			});
			console.error(
				`[ToolProviderRegistry] Initialization failed for "${toolId}":`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Get a provider instance
	 *
	 * Retrieves a registered provider. If autoInitialize is true and provider
	 * is not initialized, initializes it first.
	 *
	 * @param toolId Id of the tool the provider serves
	 * @param autoInitialize Auto-initialize if not ready (default: true)
	 * @returns Provider instance
	 * @throws Error if provider not registered
	 */
	async getProvider<T extends ToolProviderApi = ToolProviderApi>(
		toolId: string,
		autoInitialize = true,
	): Promise<T> {
		const provider = this.providers.get(toolId);
		if (!provider) {
			console.error("[ToolProviderRegistry] Provider not found:", {
				requestedId: toolId,
				availableProviders: Array.from(this.providers.keys()),
			});
			throw new Error(
				`[ToolProviderRegistry] Provider "${toolId}" not registered`,
			);
		}

		// Auto-initialize if needed
		if (autoInitialize && !this.initialized.get(toolId)) {
			logger.debug(
				"Auto-initializing provider:",
				toolId,
			);
			await this.initialize(toolId);
		}

		return provider as T;
	}

	/**
	 * The ids of the tools whose provider is in `category`.
	 *
	 * @param category Tool category to filter by
	 */
	getProvidersByCategory(category: ToolCategory): string[] {
		return Array.from(this.providers.entries())
			.filter(([_, provider]) => provider.category === category)
			.map(([id]) => id);
	}

	/**
	 * The ids of the tools with a registered provider.
	 */
	getProviderIds(): string[] {
		return Array.from(this.providers.keys());
	}

	/**
	 * Check if provider is registered
	 *
	 * @param toolId Id of the tool the provider serves
	 * @returns true if provider is registered
	 */
	has(toolId: string): boolean {
		return this.providers.has(toolId);
	}

	/**
	 * Check if provider is initialized
	 *
	 * @param toolId Id of the tool the provider serves
	 * @returns true if provider is initialized
	 */
	isInitialized(toolId: string): boolean {
		return this.initialized.get(toolId) === true;
	}

	/**
	 * Check if provider is currently initializing
	 *
	 * @param toolId Id of the tool the provider serves
	 * @returns true if initialization in progress
	 */
	isInitializing(toolId: string): boolean {
		return this.initializationPromises.has(toolId);
	}

	/**
	 * Unregister and destroy a provider
	 *
	 * Removes the provider from the registry and calls its destroy method.
	 *
	 * @param toolId Tool whose provider to unregister
	 */
	async unregister(toolId: string): Promise<void> {
		const provider = this.providers.get(toolId);
		if (provider) {
			// Wait for any pending initialization
			const initPromise = this.initializationPromises.get(toolId);
			if (initPromise) {
				try {
					await initPromise;
				} catch {
					// Ignore initialization errors during unregister
				}
				// A provider registered meanwhile owns the slot, and register()
				// already destroys this one once its start settles.
				if (this.providers.get(toolId) !== provider) return;
			}

			this.destroyProvider(toolId, provider);

			// Remove from registry
			this.providers.delete(toolId);
			this.configs.delete(toolId);
			this.initialized.delete(toolId);
			this.initializationPromises.delete(toolId);

			logger.debug(
				`Unregistered provider "${toolId}"`,
			);
		}
	}

	/**
	 * Clean up all providers
	 *
	 * Unregisters and destroys all providers in the registry.
	 */
	async destroy(): Promise<void> {
		const toolIds = Array.from(this.providers.keys());
		await Promise.all(toolIds.map((id) => this.unregister(id)));
		logger.debug("Registry destroyed");
	}
}
