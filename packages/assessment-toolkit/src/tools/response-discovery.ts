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
	 * Set active response (internal use)
	 */
	setActiveResponse(responseId: string | null): void {
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
	 * Auto-detect responses from DOM (helper method)
	 * Scans for PIE response elements and registers them
	 */
	autoDiscoverResponses(rootElement: HTMLElement = document.body): void {
		// Look for common PIE response element patterns
		const responseSelectors = [
			"[data-pie-response]",
			"[data-response-id]",
			'input[type="text"]',
			"textarea",
			'[contenteditable="true"]',
			"pie-text-entry",
			"pie-extended-text-entry",
			"pie-math-inline",
			"pie-numeric-entry",
		];

		const elements = rootElement.querySelectorAll(responseSelectors.join(", "));

		for (const element of Array.from(elements)) {
			// Check if element implements PIEResponseComponent interface
			if (this._implementsPIEResponse(element)) {
				this.registerResponse(element as unknown as PIEResponseComponent);
			}
		}
	}

	/**
	 * Check if element implements PIEResponseComponent
	 */
	private _implementsPIEResponse(element: Element): boolean {
		const component = element as any;

		// Check for required methods
		return (
			typeof component.getCapabilities === "function" &&
			typeof component.insertContent === "function" &&
			typeof component.getContent === "function" &&
			component.responseId !== undefined &&
			component.responseType !== undefined
		);
	}

	/**
	 * Setup focus tracking for active response detection
	 * Call this during initialization to automatically track active response
	 */
	setupFocusTracking(): void {
		// Track focus changes
		document.addEventListener(
			"focusin",
			(event) => {
				const target = event.target as HTMLElement;

				// Check if focused element is a registered response
				for (const [responseId, response] of this.responses.entries()) {
					// Check if response element or child is focused
					const responseElement =
						(response as any).element || (response as any);
					if (
						responseElement === target ||
						(responseElement instanceof HTMLElement &&
							responseElement.contains(target))
					) {
						this.setActiveResponse(responseId);
						return;
					}
				}
			},
			true,
		); // Use capture phase

		// Track focus loss
		document.addEventListener(
			"focusout",
			(event) => {
				const relatedTarget = (event as FocusEvent)
					.relatedTarget as HTMLElement;

				// If focus is not going to another response, clear active
				if (!relatedTarget || !this._isResponseElement(relatedTarget)) {
					// Delay to allow focus to move to another response
					setTimeout(() => {
						if (
							document.activeElement &&
							!this._isResponseElement(document.activeElement)
						) {
							this.setActiveResponse(null);
						}
					}, 10);
				}
			},
			true,
		);
	}

	/**
	 * Check if element belongs to a response
	 */
	private _isResponseElement(element: Element): boolean {
		for (const response of this.responses.values()) {
			const responseElement = (response as any).element || (response as any);
			if (
				responseElement === element ||
				(responseElement instanceof HTMLElement &&
					responseElement.contains(element))
			) {
				return true;
			}
		}
		return false;
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
