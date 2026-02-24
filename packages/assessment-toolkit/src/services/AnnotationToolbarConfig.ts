/**
 * Annotation Toolbar Configuration
 *
 * Configures backend API endpoints for annotation toolbar features.
 * These can be pointed to different backends in different environments:
 * - Development: Local stub routes in section-demos
 * - Production: pie-api-aws endpoints with authentication
 *
 * Part of PIE Assessment Toolkit.
 */

/**
 * Configuration for annotation toolbar backend services
 */
export interface AnnotationToolbarConfig {
	/**
	 * Translation API endpoint
	 * @example '/api/translation' (local dev)
	 * @example 'https://api.pie.org/api/translation' (production)
	 */
	translationEndpoint?: string;

	/**
	 * Auth token (if required)
	 * Typically fetched via authFetcher in ToolProviderRegistry
	 */
	authToken?: string;

	/**
	 * Organization ID for multi-tenant applications
	 */
	organizationId?: string;

	/**
	 * Default language code for requests
	 * @default 'en-us'
	 */
	defaultLanguage?: string;

	/**
	 * Custom headers to send with API requests
	 */
	headers?: Record<string, string>;
}

/**
 * Translation request parameters
 */
export interface TranslationRequest {
	text: string;
	sourceLanguage?: string;
	targetLanguage: string;
}

/**
 * Translation response
 */
export interface TranslationResponse {
	text: string;
	translatedText: string;
	sourceLanguage: string;
	targetLanguage: string;
}

/**
 * Annotation Toolbar API Client
 *
 * Handles API calls to backend services for annotation toolbar features.
 * Automatically adds authentication and custom headers based on configuration.
 */
export class AnnotationToolbarAPIClient {
	constructor(private config: AnnotationToolbarConfig) {}

	/**
	 * Translate text
	 */
	async translate(
		text: string,
		targetLanguage: string,
		sourceLanguage?: string,
	): Promise<TranslationResponse> {
		if (!this.config.translationEndpoint) {
			throw new Error(
				"Translation endpoint not configured. Set translationEndpoint in AnnotationToolbarConfig.",
			);
		}

		const body: TranslationRequest = {
			text,
			targetLanguage,
			sourceLanguage: sourceLanguage || "auto",
		};

		const response = await this.fetch(this.config.translationEndpoint, body);
		return response.json();
	}

	/**
	 * Internal fetch helper with auth and custom headers
	 */
	private async fetch(endpoint: string, body: unknown): Promise<Response> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(this.config.headers || {}),
		};

		// Add auth token if configured
		if (this.config.authToken) {
			headers["Authorization"] = `Bearer ${this.config.authToken}`;
		}

		// Add organization ID if configured
		if (this.config.organizationId) {
			headers["X-Organization-ID"] = this.config.organizationId;
		}

		const response = await window.fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed (${response.status}): ${errorText}`);
		}

		return response;
	}

	/**
	 * Update configuration (useful for refreshing auth tokens)
	 */
	updateConfig(config: Partial<AnnotationToolbarConfig>): void {
		this.config = { ...this.config, ...config };
	}
}
