import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../types.js";

export class CompositeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "composite";
	readonly providerName = "Composite Provider";

	private initialized = false;
	private readonly providers: InstrumentationProvider[];

	constructor(providers: InstrumentationProvider[]) {
		this.providers = providers.filter(Boolean);
	}

	async initialize(config?: InstrumentationConfig): Promise<void> {
		const results = await Promise.allSettled(
			this.providers.map((provider) => provider.initialize(config)),
		);
		this.initialized = true;
		if (config?.debug) {
			for (const [index, result] of results.entries()) {
				if (result.status === "rejected") {
					const provider = this.providers[index];
					console.warn(
						`[CompositeProvider] Failed to initialize ${provider?.providerName || "unknown"} (${provider?.providerId || "unknown"})`,
						result.reason,
					);
				}
			}
		}
	}

	isReady(): boolean {
		if (!this.initialized) return false;
		return this.providers.some((provider) => {
			try {
				return provider.isReady();
			} catch {
				return false;
			}
		});
	}

	destroy(): void {
		this.initialized = false;
		for (const provider of this.providers) {
			try {
				provider.destroy();
			} catch {
				// Best effort: a broken child provider should not block others.
			}
		}
	}

	trackError(error: Error, attributes: ErrorAttributes): void {
		this.forEachProvider((provider) => provider.trackError(error, attributes));
	}

	trackEvent(eventName: string, attributes: EventAttributes): void {
		this.forEachProvider((provider) =>
			provider.trackEvent(eventName, attributes),
		);
	}

	trackMetric(
		metricName: string,
		value: number,
		attributes?: MetricAttributes,
	): void {
		this.forEachProvider((provider) => {
			if (provider.trackMetric) {
				provider.trackMetric(metricName, value, attributes);
				return;
			}
			provider.trackEvent(`metric:${metricName}`, {
				...(attributes as Record<string, unknown>),
				metricName,
				metricValue: value,
			});
		});
	}

	setUserContext(userId: string, attributes?: Record<string, any>): void {
		this.forEachProvider((provider) => provider.setUserContext?.(userId, attributes));
	}

	setGlobalAttributes(attributes: Record<string, any>): void {
		this.forEachProvider((provider) =>
			provider.setGlobalAttributes?.(attributes),
		);
	}

	private forEachProvider(
		callback: (provider: InstrumentationProvider) => void,
	): void {
		if (!this.initialized) return;
		for (const provider of this.providers) {
			try {
				callback(provider);
			} catch {
				// Best effort fan-out.
			}
		}
	}
}
