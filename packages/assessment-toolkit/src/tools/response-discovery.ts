/**
 * Response Discovery Service
 * Finds and manages PIE response components for tool-to-response integration
 *
 * Enables tools (e.g., calculator) to insert content into response fields
 * Based on capability-based interface pattern (inspired by VS Code extension API)
 */

import type {
	ContentFormat,
	PIEResponseComponent,
	ResponseDiscoveryService,
} from "./types.js";

export class ResponseDiscoveryServiceImpl implements ResponseDiscoveryService {
	private responses = new Map<string, PIEResponseComponent>();
	private activeResponseId: string | null = null;
	private activeResponseListeners: Array<
		(response: PIEResponseComponent | null) => void
	> = [];

	/**
	 * Get currently active (focused) response component
	 */
	getActiveResponse(): PIEResponseComponent | null {
		if (!this.activeResponseId) {
			return null;
		}
		return this.responses.get(this.activeResponseId) || null;
	}

	/**
	 * Get response by ID
	 */
	getResponse(responseId: string): PIEResponseComponent | null {
		return this.responses.get(responseId) || null;
	}

	/**
	 * Get all registered responses
	 */
	getAllResponses(): PIEResponseComponent[] {
		return Array.from(this.responses.values());
	}

	/**
	 * Get responses that accept a specific content format
	 */
	getResponsesAccepting(format: ContentFormat): PIEResponseComponent[] {
		return this.getAllResponses().filter((response) => {
			const capabilities = response.getCapabilities();
			return capabilities.supportedFormats.includes(format);
		});
	}

	/**
	 * Register a response component
	 */
	registerResponse(response: PIEResponseComponent): void {
		this.responses.set(response.responseId, response);
		console.log(
			`[ResponseDiscovery] Registered response: ${response.responseId}`,
		);

		// If this is the first response and no active response, set it as active
		if (!this.activeResponseId && this.responses.size === 1) {
			this.setActiveResponse(response.responseId);
		}
	}

	/**
	 * Unregister a response component
	 */
	unregisterResponse(responseId: string): void {
		this.responses.delete(responseId);
		console.log(`[ResponseDiscovery] Unregistered response: ${responseId}`);

		// If active response was removed, clear it
		if (this.activeResponseId === responseId) {
			this.setActiveResponse(null);
		}
	}

	/**
	 * Explicitly signal that a registered response is active.
	 */
	signalActive(responseId: string): void {
		if (!this.responses.has(responseId)) {
			console.warn(
				`[ResponseDiscovery] Cannot mark active: unknown response ${responseId}`,
			);
			return;
		}
		this.setActiveResponse(responseId);
	}

	/**
	 * Explicitly signal that a response is no longer active.
	 */
	signalInactive(responseId: string): void {
		if (this.activeResponseId !== responseId) return;
		this.setActiveResponse(null);
	}

	/**
	 * Set active response (internal use)
	 */
	private setActiveResponse(responseId: string | null): void {
		if (this.activeResponseId === responseId) return;

		this.activeResponseId = responseId;
		const response = responseId ? this.getResponse(responseId) : null;

		// Notify listeners
		for (const listener of this.activeResponseListeners) {
			listener(response);
		}
	}

	/**
	 * Listen for active response changes
	 */
	onActiveResponseChanged(
		listener: (response: PIEResponseComponent | null) => void,
	): void {
		this.activeResponseListeners.push(listener);
	}

	/**
	 * @deprecated Use explicit component registration and signalActive/signalInactive.
	 */
	autoDiscoverResponses(_rootElement: HTMLElement = document.body): void {
		console.warn(
			"[ResponseDiscovery] autoDiscoverResponses is deprecated. Register responses explicitly.",
		);
	}

	/**
	 * @deprecated Use explicit signalActive/signalInactive from response components.
	 */
	setupFocusTracking(): void {
		console.warn(
			"[ResponseDiscovery] setupFocusTracking is deprecated. Responses should call signalActive/signalInactive.",
		);
	}

	/**
	 * Clear all responses (for cleanup)
	 */
	clear(): void {
		this.responses.clear();
		this.activeResponseId = null;
		this.activeResponseListeners = [];
	}
}

/**
 * Singleton instance
 */
export const responseDiscovery = new ResponseDiscoveryServiceImpl();
