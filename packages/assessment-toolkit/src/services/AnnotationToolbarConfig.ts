/**
 * Annotation Toolbar Configuration
 *
 * Configures backend API endpoints for dictionary, picture dictionary, and translation features.
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
	 * Dictionary API endpoint
	 * @example '/api/dictionary' (local dev)
	 * @example 'https://api.pie.org/api/dictionary' (production)
	 */
	dictionaryEndpoint?: string;

	/**
	 * Picture Dictionary API endpoint
	 * @example '/api/picture-dictionary' (local dev)
	 * @example 'https://api.pie.org/api/picture-dictionary' (production)
	 */
	pictureDictionaryEndpoint?: string;

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
	 * Default language code for dictionary/translation requests
	 * @default 'en-us'
	 */
	defaultLanguage?: string;

	/**
	 * Custom headers to send with API requests
	 */
	headers?: Record<string, string>;
}

/**
 * Dictionary lookup request parameters
 */
export interface DictionaryLookupRequest {
	keyword: string;
	language?: string;
}

/**
 * Dictionary lookup response
 */
export interface DictionaryLookupResponse {
	keyword: string;
	language: string;
	definitions: Array<{
		partOfSpeech: string;
		definition: string;
		example?: string;
	}>;
}

/**
 * Picture dictionary lookup request parameters
 */
export interface PictureDictionaryLookupRequest {
	keyword: string;
	language?: string;
	max?: number;
}

/**
 * Picture dictionary lookup response
 */
export interface PictureDictionaryLookupResponse {
	images: Array<{
		image: string;
	}>;
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
 * Handles API calls to backend services for dictionary, picture dictionary, and translation.
 * Automatically adds authentication and custom headers based on configuration.
 */
export class AnnotationToolbarAPIClient {
	constructor(private config: AnnotationToolbarConfig) {}

	/**
	 * Look up a word in the dictionary
	 */
	async lookupDictionary(
		keyword: string,
		language?: string,
	): Promise<DictionaryLookupResponse> {
		if (!this.config.dictionaryEndpoint) {
			throw new Error(
				"Dictionary endpoint not configured. Set dictionaryEndpoint in AnnotationToolbarConfig.",
			);
		}

		const body: DictionaryLookupRequest = {
			keyword,
			language: language || this.config.defaultLanguage || "en-us",
		};

		const response = await this.fetch(this.config.dictionaryEndpoint, body);
		return response.json();
	}

	/**
	 * Look up images in the picture dictionary
	 */
	async lookupPictureDictionary(
		keyword: string,
		language?: string,
		max?: number,
	): Promise<PictureDictionaryLookupResponse> {
		if (!this.config.pictureDictionaryEndpoint) {
			throw new Error(
				"Picture dictionary endpoint not configured. Set pictureDictionaryEndpoint in AnnotationToolbarConfig.",
			);
		}

		const body: PictureDictionaryLookupRequest = {
			keyword,
			language: language || this.config.defaultLanguage || "en-us",
			max,
		};

		const response = await this.fetch(
			this.config.pictureDictionaryEndpoint,
			body,
		);
		return response.json();
	}

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
