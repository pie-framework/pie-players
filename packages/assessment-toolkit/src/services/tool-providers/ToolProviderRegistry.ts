/**
 * Tool Provider Registry
 *
 * Centralized registry for managing tool providers.
 * Handles initialization, authentication, and lazy loading.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { ToolProviderApi, ToolCategory } from "./ToolProviderApi.js";

/**
 * Configuration for registering a tool provider
 */
export interface ToolProviderConfig<TConfig = any> {
	/**
	 * Provider instance to register
	 */
	provider: ToolProviderApi<TConfig>;

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
	 *   const response = await fetch('/api/desmos/token');
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
 * - Provider lookup by ID or category
 *
 * @example
 * ```typescript
 * const registry = new ToolProviderRegistry();
 *
 * // Register a provider with auth fetcher
 * registry.register('desmos-calculator', {
 *   provider: new DesmosToolProvider(),
 *   config: {},
 *   lazy: true,
 *   authFetcher: async () => {
 *     const response = await fetch('/api/desmos/token');
 *     return response.json();
 *   },
 * });
 *
 * // Get provider (auto-initializes if lazy)
 * const desmosProvider = await registry.getProvider('desmos-calculator');
 * ```
 */
export class ToolProviderRegistry {
	private providers = new Map<string, ToolProviderApi>();
	private configs = new Map<string, ToolProviderConfig>();
	private initialized = new Map<string, boolean>();
	private initializationPromises = new Map<string, Promise<void>>();

	private async emitTelemetry(
		config: ToolProviderConfig,
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
	 *
	 * @param providerId Unique provider identifier
	 * @param config Provider configuration
	 * @throws Error if provider with same ID already registered
	 */
	register(providerId: string, config: ToolProviderConfig): void {
		if (this.providers.has(providerId)) {
			console.warn(
				`[ToolProviderRegistry] Provider "${providerId}" already registered, skipping`,
			);
			return;
		}

		this.providers.set(providerId, config.provider);
		this.configs.set(providerId, config);
		this.initialized.set(providerId, false);

		console.log(
			`[ToolProviderRegistry] Registered provider "${providerId}" (${config.provider.providerName})`,
		);

		// Initialize immediately if not lazy
		if (config.lazy === false) {
			this.initialize(providerId).catch((error) => {
				console.error(
					`[ToolProviderRegistry] Failed to initialize provider "${providerId}":`,
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
	 * @param providerId Provider to initialize
	 * @returns Promise that resolves when initialization complete
	 * @throws Error if provider not registered or initialization fails
	 */
	async initialize(providerId: string): Promise<void> {
		// Already initialized
		if (this.initialized.get(providerId)) {
			return;
		}

		// Initialization in progress - wait for it
		const existingPromise = this.initializationPromises.get(providerId);
		if (existingPromise) {
			return existingPromise;
		}

		// Start new initialization
		const initPromise = this._doInitialize(providerId);
		this.initializationPromises.set(providerId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initializationPromises.delete(providerId);
		}
	}

	/**
	 * Internal initialization logic
	 */
	private async _doInitialize(providerId: string): Promise<void> {
		const provider = this.providers.get(providerId);
		const config = this.configs.get(providerId);

		if (!provider || !config) {
			throw new Error(
				`[ToolProviderRegistry] Provider "${providerId}" not registered`,
			);
		}

		// Start with base config
		let providerConfig = { ...config.config };
		const deriveBackend = (value: unknown): string => {
			if (!value || typeof value !== "object") return "unknown";
			const typed = value as Record<string, unknown>;
			const direct =
				typeof typed.backend === "string"
					? typed.backend
					: typeof typed.provider === "string"
						? typed.provider
						: typeof typed.serverProvider === "string"
							? typed.serverProvider
							: typeof typed.providerId === "string"
								? typed.providerId
								: "";
			return direct || "unknown";
		};
		const providerInitStartedAt = Date.now();
		await this.emitTelemetry(config, "pie-tool-init-start", {
			toolId: providerId,
			providerId,
			backend: deriveBackend(providerConfig),
			operation: "provider-initialize",
		});

		// Fetch auth if needed
		if (provider.requiresAuth && config.authFetcher) {
			const authFetchStartedAt = Date.now();
			await this.emitTelemetry(config, "pie-tool-backend-call-start", {
				toolId: providerId,
				providerId,
				backend: deriveBackend(providerConfig),
				operation: "auth-fetch",
			});
			console.log(
				`[ToolProviderRegistry] Fetching auth for "${providerId}"...`,
			);
			try {
				const authData = await config.authFetcher();
				providerConfig = { ...providerConfig, ...authData };
				await this.emitTelemetry(config, "pie-tool-backend-call-success", {
					toolId: providerId,
					providerId,
					backend: deriveBackend(providerConfig),
					operation: "auth-fetch",
					duration: Date.now() - authFetchStartedAt,
				});
			} catch (error) {
				await this.emitTelemetry(config, "pie-tool-backend-call-error", {
					toolId: providerId,
					providerId,
					backend: deriveBackend(providerConfig),
					operation: "auth-fetch",
					duration: Date.now() - authFetchStartedAt,
					errorType: "ProviderAuthFetchError",
					message: error instanceof Error ? error.message : String(error),
				});
				console.error(
					`[ToolProviderRegistry] Auth fetch failed for "${providerId}":`,
					error,
				);
				throw new Error(
					`Failed to fetch auth credentials for provider "${providerId}"`,
				);
			}
		}

		// Initialize provider
		try {
			await provider.initialize(providerConfig);
			this.initialized.set(providerId, true);
			await this.emitTelemetry(config, "pie-tool-init-success", {
				toolId: providerId,
				providerId,
				backend: deriveBackend(providerConfig),
				operation: "provider-initialize",
				duration: Date.now() - providerInitStartedAt,
			});
			console.log(
				`[ToolProviderRegistry] Provider "${providerId}" initialized`,
			);
		} catch (error) {
			await this.emitTelemetry(config, "pie-tool-init-error", {
				toolId: providerId,
				providerId,
				backend: deriveBackend(providerConfig),
				operation: "provider-initialize",
				duration: Date.now() - providerInitStartedAt,
				errorType: "ProviderInitializationError",
				message: error instanceof Error ? error.message : String(error),
			});
			console.error(
				`[ToolProviderRegistry] Initialization failed for "${providerId}":`,
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
	 * @param providerId Provider identifier
	 * @param autoInitialize Auto-initialize if not ready (default: true)
	 * @returns Provider instance
	 * @throws Error if provider not registered
	 */
	async getProvider<T extends ToolProviderApi = ToolProviderApi>(
		providerId: string,
		autoInitialize = true,
	): Promise<T> {
		console.log("[ToolProviderRegistry] getProvider called", {
			providerId,
			autoInitialize,
			isRegistered: this.providers.has(providerId),
			isInitialized: this.initialized.get(providerId),
			allProviderIds: Array.from(this.providers.keys()),
		});

		const provider = this.providers.get(providerId);
		if (!provider) {
			console.error("[ToolProviderRegistry] Provider not found:", {
				requestedId: providerId,
				availableProviders: Array.from(this.providers.keys()),
			});
			throw new Error(
				`[ToolProviderRegistry] Provider "${providerId}" not registered`,
			);
		}

		// Auto-initialize if needed
		if (autoInitialize && !this.initialized.get(providerId)) {
			console.log(
				"[ToolProviderRegistry] Auto-initializing provider:",
				providerId,
			);
			await this.initialize(providerId);
		}

		console.log("[ToolProviderRegistry] Returning provider:", {
			providerId,
			providerName: provider.providerName,
			isReady: provider.isReady(),
		});

		return provider as T;
	}

	/**
	 * Get all providers in a category
	 *
	 * @param category Tool category to filter by
	 * @returns Array of provider IDs in the category
	 */
	getProvidersByCategory(category: ToolCategory): string[] {
		return Array.from(this.providers.entries())
			.filter(([_, provider]) => provider.category === category)
			.map(([id]) => id);
	}

	/**
	 * Get all registered provider IDs
	 *
	 * @returns Array of all provider IDs
	 */
	getProviderIds(): string[] {
		return Array.from(this.providers.keys());
	}

	/**
	 * Check if provider is registered
	 *
	 * @param providerId Provider identifier
	 * @returns true if provider is registered
	 */
	has(providerId: string): boolean {
		return this.providers.has(providerId);
	}

	/**
	 * Check if provider is initialized
	 *
	 * @param providerId Provider identifier
	 * @returns true if provider is initialized
	 */
	isInitialized(providerId: string): boolean {
		return this.initialized.get(providerId) === true;
	}

	/**
	 * Check if provider is currently initializing
	 *
	 * @param providerId Provider identifier
	 * @returns true if initialization in progress
	 */
	isInitializing(providerId: string): boolean {
		return this.initializationPromises.has(providerId);
	}

	/**
	 * Unregister and destroy a provider
	 *
	 * Removes the provider from the registry and calls its destroy method.
	 *
	 * @param providerId Provider to unregister
	 */
	async unregister(providerId: string): Promise<void> {
		const provider = this.providers.get(providerId);
		if (provider) {
			// Wait for any pending initialization
			const initPromise = this.initializationPromises.get(providerId);
			if (initPromise) {
				try {
					await initPromise;
				} catch {
					// Ignore initialization errors during unregister
				}
			}

			// Destroy provider
			provider.destroy();

			// Remove from registry
			this.providers.delete(providerId);
			this.configs.delete(providerId);
			this.initialized.delete(providerId);
			this.initializationPromises.delete(providerId);

			console.log(
				`[ToolProviderRegistry] Unregistered provider "${providerId}"`,
			);
		}
	}

	/**
	 * Clean up all providers
	 *
	 * Unregisters and destroys all providers in the registry.
	 */
	async destroy(): Promise<void> {
		const providerIds = Array.from(this.providers.keys());
		await Promise.all(providerIds.map((id) => this.unregister(id)));
		console.log("[ToolProviderRegistry] Registry destroyed");
	}
}
