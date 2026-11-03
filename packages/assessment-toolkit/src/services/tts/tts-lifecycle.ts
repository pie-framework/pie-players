/**
 * The text-to-speech lifecycle of a `ToolkitCoordinator`: initialization from
 * the tool config, readiness, reconfiguration, and the missing-provider report.
 *
 * This module is the one place in the toolkit's coordination layer allowed to
 * name the read-aloud capability, the same way `services/tts/**` already is:
 * the coordinator stays capability-agnostic — it hands this lifecycle the
 * services it needs through `TtsLifecycleHost` and answers only generic
 * questions (`ownsTool`, `isStarted`) about it — and
 * `check-capability-neutrality` holds the coordinator to that, with one
 * documented allowance for its public `textToSpeech`-typed config accessors.
 *
 * Behavior is moved, not redesigned: each method here was a private
 * `ToolkitCoordinator` member, and the host adapters bind the same calls the
 * members made.
 */

import type { ITTSProvider } from "@pie-players/pie-tts";
import type { AccessibilityCatalogResolver } from "../AccessibilityCatalogResolver.js";
import type {
	TextToSpeechToolProviderConfig,
	ToolProviderConfig,
	ToolProvidersConfig,
} from "../tools-config-normalizer.js";
import type { TTSService } from "../TTSService.js";
import type { ToolProviderApi } from "../tool-providers/ToolProviderApi.js";
import type { ToolRegistration } from "../ToolRegistry.js";
import {
	BrowserTTSProvider,
	browserFallbackConfig,
} from "./browser-provider.js";
import type { ToolkitTTSConfig } from "./provider-options.js";
import {
	buildRuntimeTTSConfig,
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
} from "../tts-runtime-config.js";

/** The tool id the read-aloud capability registers under. */
export const TTS_TOOL_ID = "textToSpeech";

/**
 * The coordinator services the TTS lifecycle runs against. The coordinator
 * binds these once, to its own members, so its privates stay private and the
 * seam between the generic coordinator and the capability stays explicit.
 */
export interface TtsLifecycleHost {
	/** Throws `ToolkitCoordinatorDisposedError` once the coordinator is disposed. */
	assertNotDisposed(): void;
	/** Whether disposal has started; in-flight work stops instead of finishing. */
	isDisposalStarted(): boolean;
	/** Whether the error is the coordinator's own disposed signal, to rethrow. */
	isDisposalError(error: unknown): boolean;
	emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void>;
	hooks: {
		onBeforeTTSInit?:
			| ((context: {
					phase: "tts-init";
					details: { backend: string };
			  }) => void | Promise<void>)
			| undefined;
		onTTSReady?: (() => void | Promise<void>) | undefined;
	};
	toolProviderRegistry: {
		has(toolId: string): boolean;
		unregister(toolId: string): Promise<void>;
	};
	initializeProvider(
		toolId: string,
		fallbackFollows: boolean,
	): Promise<ToolProviderApi>;
	ttsService: TTSService;
	catalogResolver: AccessibilityCatalogResolver;
	clearDegradedTool(toolId: string): void;
	reportStartFailure(
		error: unknown,
		context: { phase: "tts-init" },
		toolIds: Iterable<string>,
	): void;
	isToolGranted(toolId: string): boolean;
	/** Whether provider initialization waits for a policy grant. */
	lazyInit: boolean;
	/** Whether the tool registry may still be replaced by a bound toolkit's. */
	isToolRegistryPending(): boolean;
	/** The validated `tools.providers` config, defaults applied. */
	providersConfig(): ToolProvidersConfig | undefined;
	getProviderDescriptorTools(): ToolRegistration[];
	registerProviderFromTool(tool: ToolRegistration, replace?: boolean): Promise<void>;
	notifyReadyChange(): void;
}

/** The read-aloud-specific merge in a generic tool-config update. */
export function deepMergeMathSpeech(
	toolId: string,
	current: Partial<ToolProviderConfig>,
	updates: Partial<ToolProviderConfig>,
): Record<string, unknown> | undefined {
	if (
		toolId !== TTS_TOOL_ID ||
		!isPlainRecord(current.mathSpeech) ||
		!isPlainRecord(updates.mathSpeech)
	) {
		return undefined;
	}
	return { ...current.mathSpeech, ...updates.mathSpeech };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" && value !== null && !Array.isArray(value)
	);
}

export class TtsLifecycle {
	private initialized = false;
	/** Text-to-speech failed to start and policy does not grant it. */
	private degraded = false;
	private initPromise?: Promise<void>;
	private reconfigurePromise?: Promise<void>;

	/**
	 * Whether {@link TtsLifecycle.initializeIfNeeded} has already reported a
	 * non-browser backend falling back to browser speech because no
	 * text-to-speech provider is registered. Once per coordinator: a
	 * text-to-speech config change re-runs initialization, and the missing
	 * provider is the same gap each time.
	 */
	private reportedMissingProvider = false;

	/**
	 * The backend of a fallback missing-provider report held back while the
	 * registry was unsettled, reported if the bound toolkit has no registry.
	 */
	private heldMissingProviderBackend: string | null = null;

	constructor(private readonly host: TtsLifecycleHost) {}

	get started(): boolean {
		return this.initialized;
	}

	get failedUngranted(): boolean {
		return this.degraded;
	}

	/** Whether `toolId` is the tool this lifecycle brings up. */
	ownsTool(toolId: string): boolean {
		return toolId === TTS_TOOL_ID;
	}

	/** Whether initialization or a reconfiguration is in flight. */
	isStarted(): boolean {
		return (
			this.initialized ||
			this.initPromise !== undefined ||
			this.reconfigurePromise !== undefined
		);
	}

	/** The in-flight initialization and reconfiguration, for disposal flushes. */
	flushInitPromises(pending: Set<Promise<unknown>>): void {
		if (this.initPromise) pending.add(this.initPromise);
		if (this.reconfigurePromise) pending.add(this.reconfigurePromise);
	}

	/**
	 * The runtime `mathSpeech` provider options for the current tool config, as
	 * the TTS service's math-speech source reads them.
	 */
	mathSpeechRuntimeOptions() {
		return buildRuntimeTTSConfig(
			resolveTTSRuntimeSettings(this.resolveToolConfig()),
		).providerOptions?.mathSpeech;
	}

	/**
	 * Initialize the TTS service from the `textToSpeech` tool config.
	 */
	async ensureReady(): Promise<void> {
		this.host.assertNotDisposed();
		await this.waitForPendingReconfigure();
		this.host.assertNotDisposed();
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;
		this.initPromise = this.initializeIfNeeded()
			.then(() => this.host.assertNotDisposed())
			.finally(() => {
				this.initPromise = undefined;
				this.host.notifyReadyChange();
			});
		return this.initPromise;
	}

	private waitForPendingReconfigure(): Promise<void> {
		let pending = this.reconfigurePromise;
		const wait = async () => {
			while (pending) {
				await pending;
				pending = this.reconfigurePromise;
			}
		};
		return wait();
	}

	private async initializeIfNeeded(): Promise<void> {
		if (this.initialized) return;
		const resolvedToolConfig = this.resolveToolConfig();
		const runtimeSettings = resolveTTSRuntimeSettings(resolvedToolConfig);
		const resolvedBackend = resolveTTSBackend(runtimeSettings);
		const runtimeTTSConfig = buildRuntimeTTSConfig(runtimeSettings);
		await this.host.hooks.onBeforeTTSInit?.({
			phase: "tts-init",
			details: {
				backend: resolvedBackend,
			},
		});
		this.host.assertNotDisposed();
		await this.host.emitTelemetry("pie-toolkit-tts-init-start", {
			backend: resolvedBackend,
		});
		await this.host.emitTelemetry("pie-tool-init-start", {
			toolId: TTS_TOOL_ID,
			operation: "tts-init",
			backend: resolvedBackend,
		});

		if (this.host.toolProviderRegistry.has(TTS_TOOL_ID)) {
			try {
				// Browser speech follows a server provider that fails to start.
				const ttsProvider = await this.host.initializeProvider(
					TTS_TOOL_ID,
					true,
				);
				const providerInstance = await ttsProvider.createInstance();
				await this.initializeService(providerInstance, runtimeTTSConfig);
				await this.host.emitTelemetry("pie-toolkit-tts-init-success", {
					provider: "registry",
				});
				await this.host.emitTelemetry("pie-tool-init-success", {
					toolId: TTS_TOOL_ID,
					operation: "tts-init",
					backend: resolvedBackend,
					provider: "registry",
				});
				return;
			} catch (error) {
				if (this.host.isDisposalError(error)) throw error;
				const normalized =
					error instanceof Error ? error : new Error(String(error));
				await this.host.emitTelemetry("pie-tool-init-fallback", {
					toolId: TTS_TOOL_ID,
					operation: "tts-init",
					backend: resolvedBackend,
					fromProvider: "registry",
					toProvider: "browser",
					reason: normalized.message,
				});
				console.warn(
					"[ToolkitCoordinator] Failed to initialize TTS via registry, falling back to browser provider:",
					normalized,
				);
			}
		} else if (resolvedBackend !== "browser") {
			this.reportMissingProvider(resolvedBackend);
		}

		// Browser speech, configured or standing in for a backend that has no
		// provider or failed to start.
		const provider = new BrowserTTSProvider();
		try {
			await this.initializeService(
				provider,
				resolvedBackend === "browser"
					? runtimeTTSConfig
					: browserFallbackConfig(runtimeTTSConfig),
			);
			await this.host.emitTelemetry("pie-toolkit-tts-init-success", {
				provider: "browser-fallback",
			});
			await this.host.emitTelemetry("pie-tool-init-success", {
				toolId: TTS_TOOL_ID,
				operation: "tts-init",
				backend: resolvedBackend,
				provider: "browser-fallback",
			});
		} catch (error) {
			if (this.host.isDisposalError(error)) throw error;
			const normalized =
				error instanceof Error ? error : new Error(String(error));
			this.host.reportStartFailure(
				normalized,
				{ phase: "tts-init" },
				[TTS_TOOL_ID],
			);
			await this.host.emitTelemetry("pie-toolkit-tts-init-error", {
				message: normalized.message,
			});
			await this.host.emitTelemetry("pie-tool-init-error", {
				toolId: TTS_TOOL_ID,
				operation: "tts-init",
				backend: resolvedBackend,
				errorType: "TTSInitError",
				message: normalized.message,
			});
			throw normalized;
		}
	}

	private resolveToolConfig(): TextToSpeechToolProviderConfig {
		const fromProviders = this.host.providersConfig()?.[
			TTS_TOOL_ID
		] as TextToSpeechToolProviderConfig | undefined;
		return fromProviders || {};
	}

	private async initializeService(
		provider: ITTSProvider,
		config: Partial<ToolkitTTSConfig>,
	): Promise<void> {
		const nextProviderOptions = {
			...config.providerOptions,
			__pieTelemetry: async (
				eventName: string,
				payload?: Record<string, unknown>,
			) => {
				await this.host.emitTelemetry(eventName, {
					toolId: TTS_TOOL_ID,
					...(payload || {}),
				});
			},
		};
		const nextConfig: Partial<ToolkitTTSConfig> = {
			...config,
			providerOptions: nextProviderOptions,
		};
		await this.host.ttsService.initialize(provider, nextConfig);
		this.host.assertNotDisposed();
		this.host.ttsService.setCatalogResolver(this.host.catalogResolver);
		this.initialized = true;
		this.degraded = false;
		this.host.clearDegradedTool(TTS_TOOL_ID);
		await this.host.hooks.onTTSReady?.();
		this.host.assertNotDisposed();
	}

	private reportMissingProvider(backend: string): void {
		// The toolkit this coordinator binds to may still supply the provider.
		if (this.host.isToolRegistryPending()) {
			this.heldMissingProviderBackend = backend;
			return;
		}
		if (this.reportedMissingProvider) return;
		this.reportedMissingProvider = true;
		console.warn(
			`[ToolkitCoordinator] Text-to-speech is configured for the "${backend}" backend but falls back to browser speech: no "${TTS_TOOL_ID}" tool provider is registered. A coordinator registers tool providers only from its \`toolRegistry\`, or from its toolkit's when constructed without one, so supply one that carries the text-to-speech registration — for the packaged capability set, \`createPackagedToolRegistry()\` from "@pie-players/pie-default-tool-loaders". Reported once per coordinator.`,
		);
	}

	/**
	 * Report a missing-provider report held back while the registry was
	 * unsettled, now that the registry has settled without one.
	 */
	reportHeldMissingProvider(): void {
		const heldBackend = this.heldMissingProviderBackend;
		this.heldMissingProviderBackend = null;
		if (heldBackend) this.reportMissingProvider(heldBackend);
	}

	/**
	 * Drop a held missing-provider report without reporting it: a real registry
	 * settled, so the stale gap never applied.
	 */
	discardHeldMissingProvider(): void {
		this.heldMissingProviderBackend = null;
	}

	/**
	 * Readiness waits for text-to-speech when it is enabled and either starts
	 * eagerly or is granted: a granted read-aloud fails before the learner starts.
	 */
	requiredForReadiness(): boolean {
		if (this.resolveToolConfig()?.enabled === false) return false;
		return !this.host.lazyInit || this.host.isToolGranted(TTS_TOOL_ID);
	}

	/**
	 * Starts text-to-speech for readiness. A failure policy does not grant leaves
	 * the tool degraded, reporting itself unavailable, and readiness settles; a
	 * granted tool's failure rejects.
	 */
	async startForReadiness(): Promise<void> {
		try {
			await this.ensureReady();
		} catch (error) {
			if (this.host.isDisposalError(error)) throw error;
			if (this.host.isToolGranted(TTS_TOOL_ID)) throw error;
			this.degraded = true;
			this.host.notifyReadyChange();
		}
	}

	/**
	 * Re-register the text-to-speech provider for the current config and registry,
	 * then re-initialize unless initialization is lazy. An initialization already
	 * running finishes first: it would otherwise mark its provider ready after the
	 * reset.
	 */
	scheduleReconfigure(): void {
		const inFlight = this.initPromise;
		const reconfigurePromise = inFlight
			? inFlight.catch(() => {}).then(() => this.reconfigure())
			: this.reconfigure();
		this.reconfigurePromise = reconfigurePromise;
		void reconfigurePromise.finally(() => {
			if (this.reconfigurePromise === reconfigurePromise) {
				this.reconfigurePromise = undefined;
			}
		});
		void reconfigurePromise
			.then(async () => {
				if (this.host.isDisposalStarted()) return;
				if (this.requiredForReadiness()) await this.startForReadiness();
			})
			// Reported where it failed; a granted failure has nowhere else to go.
			.catch(() => {});
	}

	private async reconfigure(): Promise<void> {
		this.initialized = false;
		this.degraded = false;
		this.host.clearDegradedTool(TTS_TOOL_ID);
		this.initPromise = undefined;
		this.host.notifyReadyChange();
		try {
			// The next speak waits on readiness, which starts the new provider.
			this.host.ttsService.releaseProvider();
		} catch {
			// noop: release best effort
		}

		if (this.host.toolProviderRegistry.has(TTS_TOOL_ID)) {
			await this.host.toolProviderRegistry.unregister(TTS_TOOL_ID);
		}
		if (this.host.isDisposalStarted()) return;
		const ttsRegistration = this.host
			.getProviderDescriptorTools()
			.find((tool) => this.ownsTool(tool.toolId));
		if (!ttsRegistration) return;
		await this.host.registerProviderFromTool(ttsRegistration);
	}
}
