/**
 * TTSService
 *
 * Text-to-speech service with pluggable provider architecture.
 * Manages playback state, coordinates multiple TTS entry points,
 * and integrates with HighlightCoordinator for word highlighting.
 *
 * Features:
 * - Pluggable TTS providers (browser, AWS Polly, etc.)
 * - QTI 3.0 accessibility catalogs (pre-authored spoken content)
 * - Unified playback state management
 * - Prevents conflicts from simultaneous speech
 * - Word highlighting integration
 * - Playback controls: play, pause, resume, stop
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import type { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import type { IHighlightCoordinator } from "./interfaces.js";

// Re-export core TTS types for convenience
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

/**
 * Playback state
 */
export enum PlaybackState {
	IDLE = "idle",
	LOADING = "loading",
	PLAYING = "playing",
	PAUSED = "paused",
	ERROR = "error",
}

/**
 * TTSService
 *
 * Instantiable service for text-to-speech functionality.
 * Each instance manages its own playback state.
 */
export class TTSService {
	private currentProvider: ITTSProvider | null = null;
	private provider: ITTSProviderImplementation | null = null;
	private highlightCoordinator: IHighlightCoordinator | null = null;
	private catalogResolver: AccessibilityCatalogResolver | null = null;
	private state: PlaybackState = PlaybackState.IDLE;
	private currentText: string | null = null;
	private currentContentElement: Element | null = null;
	private normalizedToDOM: Map<number, { node: Text; offset: number }> =
		new Map();
	private listeners = new Map<string, Set<(state: PlaybackState) => void>>();
	private lastError: string | null = null;

	constructor() {}

	/**
	 * Initialize TTS service with a provider
	 *
	 * @param provider TTS provider instance
	 * @param config Provider configuration
	 */
	async initialize(
		provider: ITTSProvider,
		config: Partial<TTSConfig> = {},
	): Promise<void> {
		this.currentProvider = provider;

		// Initialize provider and get implementation
		this.provider = await provider.initialize(config as TTSConfig);
	}

	/**
	 * Update TTS settings dynamically without full reinitialization
	 *
	 * This allows changing rate, pitch, and voice on the fly.
	 * Note: Some providers may require reinitialization for voice changes.
	 *
	 * @param settings Partial settings to update (rate, pitch, voice)
	 */
	async updateSettings(settings: Partial<TTSConfig>): Promise<void> {
		if (!this.provider) {
			throw new Error("TTSService not initialized. Call initialize() first.");
		}

		// If the provider implementation has an updateSettings method, use it
		if (
			"updateSettings" in this.provider &&
			typeof (this.provider as any).updateSettings === "function"
		) {
			await (this.provider as any).updateSettings(settings);
		} else {
			// Fallback: Reinitialize with merged config
			// This requires storing the original config, which we don't have
			// So for now, just log a warning
			console.warn(
				"[TTSService] Provider does not support dynamic settings updates. Some settings may require reinitialization.",
			);
		}
	}

	/**
	 * Set highlight coordinator for word highlighting
	 */
	setHighlightCoordinator(coordinator: IHighlightCoordinator): void {
		this.highlightCoordinator = coordinator;
	}

	/**
	 * Set accessibility catalog resolver for spoken content
	 *
	 * When set, the speak() method will check for pre-authored spoken
	 * content in catalogs before falling back to generated TTS.
	 *
	 * @param resolver AccessibilityCatalogResolver instance
	 */
	setCatalogResolver(resolver: AccessibilityCatalogResolver): void {
		this.catalogResolver = resolver;
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): TTSProviderCapabilities | null {
		return this.currentProvider?.getCapabilities() || null;
	}

	/**
	 * Build a character-by-character map from normalized text positions to DOM positions
	 * This handles the complexity of whitespace normalization
	 */
	private buildPositionMap(element: Element, spokenText: string): void {
		this.normalizedToDOM.clear();

		// Get the actual DOM text as it will be rendered
		const range = document.createRange();
		range.selectNodeContents(element);
		const domText = range.toString();

		// Normalize the DOM text the same way the spoken text is normalized
		// (trim + collapse whitespace)
		const normalizedDomText = domText.trim().replace(/\s+/g, " ");

		console.log("[TTSService] Text comparison:", {
			spokenLength: spokenText.length,
			normalizedDomLength: normalizedDomText.length,
			match: spokenText === normalizedDomText,
			spokenPreview: spokenText.substring(0, 150),
			normalizedPreview: normalizedDomText.substring(0, 150),
			differAtIndex:
				spokenText === normalizedDomText
					? null
					: (() => {
							for (
								let i = 0;
								i < Math.min(spokenText.length, normalizedDomText.length);
								i++
							) {
								if (spokenText[i] !== normalizedDomText[i]) {
									return {
										index: i,
										spokenChar: spokenText[i],
										normalizedChar: normalizedDomText[i],
										spokenContext: spokenText.substring(
											Math.max(0, i - 20),
											i + 20,
										),
										normalizedContext: normalizedDomText.substring(
											Math.max(0, i - 20),
											i + 20,
										),
									};
								}
							}
							return null;
						})(),
		});

		// Build map by walking through nodes and tracking normalized position
		let normalizedPos = 0;
		let inLeadingWhitespace = true;
		let lastCharWasWhitespace = false;

		const walk = (node: Node): void => {
			if (node.nodeType === Node.TEXT_NODE) {
				const textNode = node as Text;
				const text = textNode.textContent || "";

				for (let i = 0; i < text.length; i++) {
					const char = text[i];
					const isWhitespace = /\s/.test(char);

					if (inLeadingWhitespace) {
						// Skip leading whitespace entirely - don't map it
						if (!isWhitespace) {
							inLeadingWhitespace = false;
							this.normalizedToDOM.set(normalizedPos, {
								node: textNode,
								offset: i,
							});
							normalizedPos++;
							lastCharWasWhitespace = false;
						}
					} else {
						// Past leading whitespace
						if (isWhitespace) {
							// Only map the first whitespace in a sequence (collapse multiple)
							if (!lastCharWasWhitespace) {
								this.normalizedToDOM.set(normalizedPos, {
									node: textNode,
									offset: i,
								});
								normalizedPos++;
							}
							lastCharWasWhitespace = true;
						} else {
							// Regular character - always map it
							this.normalizedToDOM.set(normalizedPos, {
								node: textNode,
								offset: i,
							});
							normalizedPos++;
							lastCharWasWhitespace = false;
						}
					}
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as Element;
				if (element.tagName !== "SCRIPT" && element.tagName !== "STYLE") {
					for (const child of Array.from(node.childNodes)) {
						walk(child);
					}
				}
			}
		};

		walk(element);

		console.log("[TTSService] Position map built:", {
			entries: this.normalizedToDOM.size,
			spokenTextLength: spokenText.length,
			normalizedDomLength: normalizedDomText.length,
			mapLengthMatchesSpoken: this.normalizedToDOM.size === spokenText.length,
			firstFewMappings: Array.from(this.normalizedToDOM.entries())
				.slice(0, 10)
				.map(([pos, { node, offset }]) => ({
					pos,
					offset,
					char: node.textContent?.[offset],
					expected: spokenText[pos],
				})),
		});
	}

	/**
	 * Find text node and offsets for highlighting a word
	 *
	 * @param charIndex Character position in normalized/spoken text
	 * @param length Length of the word
	 * @returns Text node and local offsets, or null if not found
	 */
	private findHighlightRange(
		charIndex: number,
		length: number,
	): { node: Text; start: number; end: number } | null {
		const startPos = this.normalizedToDOM.get(charIndex);
		if (!startPos) {
			console.warn(
				`[TTSService] No mapping found for start position ${charIndex}`,
				{
					totalMappings: this.normalizedToDOM.size,
					nearbyMappings: Array.from(this.normalizedToDOM.entries())
						.filter(([pos]) => Math.abs(pos - charIndex) < 5)
						.map(([pos, { offset, node }]) => ({
							pos,
							offset,
							char: node.textContent?.[offset],
						})),
				},
			);
			return null;
		}

		// Find the end position (last character of the word)
		const endIndex = charIndex + length - 1;
		const endPos = this.normalizedToDOM.get(endIndex);
		if (!endPos) {
			console.warn(
				`[TTSService] No mapping found for end position ${endIndex}`,
				{
					startChar: charIndex,
					length,
					totalMappings: this.normalizedToDOM.size,
				},
			);
			return null;
		}

		// For simplicity, if the word spans multiple nodes, just highlight in the first node
		// (This is a rare edge case and would require creating multiple ranges)
		if (startPos.node !== endPos.node) {
			console.warn(
				`[TTSService] Word spans multiple nodes, highlighting in first node only`,
			);
			return {
				node: startPos.node,
				start: startPos.offset,
				end: (startPos.node.textContent || "").length,
			};
		}

		return {
			node: startPos.node,
			start: startPos.offset,
			end: endPos.offset + 1, // +1 because we want to include the character at endPos
		};
	}

	/**
	 * Speak text with optional catalog support
	 *
	 * @param text Text to speak (will be normalized: trimmed and whitespace collapsed)
	 * @param options Optional catalog ID, language, and content element for highlighting
	 */
	async speak(
		text: string,
		options?: {
			catalogId?: string;
			language?: string;
			contentElement?: Element;
		},
	): Promise<void> {
		if (!this.provider) {
			throw new Error("TTS service not initialized");
		}

		// Normalize the input text to ensure consistency
		// This handles cases where the caller didn't normalize
		const normalizedText = text.trim().replace(/\s+/g, " ");

		// Try to resolve from accessibility catalog if catalogId provided
		let contentToSpeak = normalizedText;
		if (options?.catalogId && this.catalogResolver) {
			const catalogContent = this.catalogResolver.getAlternative(
				options.catalogId,
				{
					type: "spoken",
					language: options.language || "en-US",
					useFallback: true,
				},
			);

			if (catalogContent) {
				// Use pre-authored spoken content from catalog
				contentToSpeak = catalogContent.content;
				console.debug(
					`[TTSService] Using catalog content for "${options.catalogId}" (${catalogContent.language})`,
				);
			} else {
				console.debug(
					`[TTSService] No catalog found for "${options.catalogId}", falling back to generated TTS`,
				);
			}
		}

		this.currentText = contentToSpeak;
		this.currentContentElement = options?.contentElement || null;
		this.lastError = null; // Clear previous error
		this.setState(PlaybackState.LOADING);

		// Build position map for highlighting if we have a content element
		if (this.currentContentElement && this.highlightCoordinator) {
			this.buildPositionMap(this.currentContentElement, contentToSpeak);

			// Apply sentence-level highlighting as base layer
			const range = document.createRange();
			range.selectNodeContents(this.currentContentElement);
			this.highlightCoordinator.highlightTTSSentence([range]);
			console.log("[TTSService] Applied sentence-level highlighting");
		}

		try {
			// Setup word boundary highlighting
			if (this.highlightCoordinator && this.currentContentElement) {
				this.provider.onWordBoundary = (
					word: string,
					charIndex: number,
					length?: number,
				) => {
					const wordLength = length || word.length;

					const highlightRange = this.findHighlightRange(charIndex, wordLength);
					if (highlightRange && this.highlightCoordinator) {
						const highlightText =
							highlightRange.node.textContent?.substring(
								highlightRange.start,
								highlightRange.end,
							) || "";
						console.log(
							`[TTSService] Highlighting "${highlightText}" (word: "${word}") at position ${charIndex}`,
						);
						this.highlightCoordinator.highlightTTSWord(
							highlightRange.node,
							highlightRange.start,
							highlightRange.end,
						);
					} else {
						console.warn(
							`[TTSService] Could not find highlight range for position ${charIndex}, length ${wordLength}`,
						);
					}
				};
			}

			this.setState(PlaybackState.PLAYING);
			await this.provider.speak(contentToSpeak);
			this.setState(PlaybackState.IDLE);

			// Clear highlights when done
			if (this.highlightCoordinator) {
				this.highlightCoordinator.clearTTS();
			}

			// Clear tracking
			this.currentContentElement = null;
			this.normalizedToDOM.clear();
		} catch (error) {
			console.error("TTS error:", error);
			this.lastError = error instanceof Error ? error.message : String(error);
			this.setState(PlaybackState.ERROR);

			// Clear highlights on error
			if (this.highlightCoordinator) {
				this.highlightCoordinator.clearTTS();
			}

			// Clear tracking
			this.currentContentElement = null;
			this.normalizedToDOM.clear();

			throw error;
		}
	}

	/**
	 * Speak a text range with accurate word highlighting
	 *
	 * This calculates the offset of the range within its parent element
	 * to ensure word highlighting aligns correctly with the selected text.
	 *
	 * @param range DOM Range to speak
	 */
	async speakRange(
		range: Range,
		options?: { contentRoot?: Element | null },
	): Promise<void> {
		if (!this.provider) {
			throw new Error("TTS service not initialized");
		}

		const text = range.toString().trim();
		if (!text) return;

		// Use explicit content root when provided; otherwise keep highlighting scoped
		// to the selected range's nearest element ancestor.
		const fromOptions = options?.contentRoot || null;
		let root: Element | null = fromOptions;
		if (!root) {
			const ancestor = range.commonAncestorContainer;
			root =
				ancestor.nodeType === Node.ELEMENT_NODE
					? (ancestor as Element)
					: ancestor.parentElement;
		}
		if (!root) return;

		// Calculate the offset of the range start within the root element
		const beforeRange = document.createRange();
		beforeRange.selectNodeContents(root);
		beforeRange.setEnd(range.startContainer, range.startOffset);
		const textBeforeRange = beforeRange.toString();
		const offset = textBeforeRange.trim().replace(/\s+/g, " ").length;

		console.log("[TTSService] speakRange offset calculation:", {
			selectedText: text,
			textBeforeRange: textBeforeRange.substring(0, 100),
			offset,
			rootTag: root.tagName,
		});

		// Store the offset for word boundary calculations
		const originalOnWordBoundary = this.provider.onWordBoundary;

		// Wrap the onWordBoundary handler to adjust character indices
		this.provider.onWordBoundary = (
			word: string,
			charIndex: number,
			length?: number,
		) => {
			// Adjust the character index by the offset
			const adjustedIndex = charIndex + offset;
			// Call the handler from speak() method which will handle the highlighting
			// Pass the adjusted index so highlighting aligns with the actual selection
			if (this.highlightCoordinator && this.currentContentElement) {
				const wordLength = length || word.length;
				const highlightRange = this.findHighlightRange(
					adjustedIndex,
					wordLength,
				);
				if (highlightRange) {
					this.highlightCoordinator.highlightTTSWord(
						highlightRange.node,
						highlightRange.start,
						highlightRange.end,
					);
				}
			}
		};

		try {
			// Speak the text with the root element as context
			await this.speak(text, { contentElement: root });
		} finally {
			// Restore original handler
			this.provider.onWordBoundary = originalOnWordBoundary;
		}
	}

	/**
	 * Pause playback
	 */
	pause(): void {
		if (!this.provider) return;

		if (this.state === PlaybackState.PLAYING) {
			this.provider.pause();
			this.setState(PlaybackState.PAUSED);
		}
	}

	/**
	 * Resume playback
	 */
	resume(): void {
		if (!this.provider) return;

		if (this.state === PlaybackState.PAUSED) {
			this.provider.resume();
			this.setState(PlaybackState.PLAYING);
		}
	}

	/**
	 * Stop playback
	 */
	stop(): void {
		if (!this.provider) return;

		this.provider.stop();
		this.setState(PlaybackState.IDLE);
		this.currentText = null;

		// Clear highlights
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearTTS();
		}

		// Clear tracking
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
	}

	/**
	 * Check if currently playing
	 */
	isPlaying(): boolean {
		return this.state === PlaybackState.PLAYING;
	}

	/**
	 * Check if paused
	 */
	isPaused(): boolean {
		return this.state === PlaybackState.PAUSED;
	}

	/**
	 * Get current state
	 */
	getState(): PlaybackState {
		return this.state;
	}

	/**
	 * Get current text being spoken
	 */
	getCurrentText(): string | null {
		return this.currentText;
	}

	/**
	 * Get the last error message
	 * Returns null if no error has occurred
	 */
	getLastError(): string | null {
		return this.lastError;
	}

	/**
	 * Subscribe to state changes
	 *
	 * @param id Unique listener ID
	 * @param callback Function to call on state change
	 */
	onStateChange(id: string, callback: (state: PlaybackState) => void): void {
		if (!this.listeners.has(id)) {
			this.listeners.set(id, new Set());
		}
		this.listeners.get(id)!.add(callback);
	}

	/**
	 * Unsubscribe from state changes
	 */
	offStateChange(id: string, callback: (state: PlaybackState) => void): void {
		const callbacks = this.listeners.get(id);
		if (callbacks) {
			callbacks.delete(callback);
			if (callbacks.size === 0) {
				this.listeners.delete(id);
			}
		}
	}

	/**
	 * Set state and notify listeners
	 */
	private setState(newState: PlaybackState): void {
		if (this.state === newState) return;

		this.state = newState;

		// Notify all listeners
		for (const callbacks of this.listeners.values()) {
			for (const callback of callbacks) {
				callback(newState);
			}
		}
	}
}
