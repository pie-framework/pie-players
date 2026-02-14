/**
 * RangeSerializer - Serialize and deserialize DOM Range objects
 *
 * Provides utilities for storing and restoring text ranges across sessions.
 * Used by both TTS (for timing data) and annotations (for persistence).
 *
 * Uses CSS selector paths and node indices for robust serialization that
 * survives content changes when possible.
 */

/**
 * Serialized form of a Range suitable for storage.
 */
export interface SerializedRange {
	/** CSS selector path to start container */
	startContainer: string;

	/** Character offset in start container */
	startOffset: number;

	/** CSS selector path to end container */
	endContainer: string;

	/** Character offset in end container */
	endOffset: number;

	/** Original text for validation */
	text: string;

	/** Optional metadata */
	metadata?: {
		/** When this range was created */
		timestamp?: number;

		/** User-provided label */
		label?: string;

		/** Custom data */
		custom?: Record<string, unknown>;
	};
}

/**
 * RangeSerializer - Serialize and deserialize Range objects.
 */
export class RangeSerializer {
	/**
	 * Serialize a Range to storable format.
	 *
	 * @param range - Range to serialize
	 * @param root - Root element (typically document.body or content container)
	 * @returns Serialized range data
	 *
	 * @example
	 * ```typescript
	 * const serializer = new RangeSerializer();
	 * const range = window.getSelection()!.getRangeAt(0);
	 * const serialized = serializer.serialize(range, document.body);
	 * localStorage.setItem('savedRange', JSON.stringify(serialized));
	 * ```
	 */
	serialize(range: Range, root: Element): SerializedRange {
		return {
			startContainer: this.getNodePath(range.startContainer, root),
			startOffset: range.startOffset,
			endContainer: this.getNodePath(range.endContainer, root),
			endOffset: range.endOffset,
			text: range.toString()
		};
	}

	/**
	 * Deserialize range from storage.
	 *
	 * @param data - Serialized range data
	 * @param root - Root element (same as used in serialize)
	 * @returns Range object, or null if content changed
	 *
	 * @example
	 * ```typescript
	 * const serializer = new RangeSerializer();
	 * const data = JSON.parse(localStorage.getItem('savedRange')!);
	 * const range = serializer.deserialize(data, document.body);
	 * if (range) {
	 *   // Range successfully restored
	 * } else {
	 *   // Content changed, range invalid
	 * }
	 * ```
	 */
	deserialize(data: SerializedRange, root: Element): Range | null {
		const startNode = this.findNodeByPath(data.startContainer, root);
		const endNode = this.findNodeByPath(data.endContainer, root);

		if (!startNode || !endNode) {
			return null;
		}

		try {
			const range = new Range();
			range.setStart(startNode, data.startOffset);
			range.setEnd(endNode, data.endOffset);

			// Validate text hasn't changed
			if (range.toString() === data.text) {
				return range;
			}

			// Text changed, range is invalid
			return null;
		} catch (error) {
			// Range construction failed (offsets invalid, etc.)
			console.warn('Failed to deserialize range:', error);
			return null;
		}
	}

	/**
	 * Get a unique path to a node from root.
	 *
	 * Uses a hybrid approach:
	 * - For element nodes: CSS selector path
	 * - For text nodes: parent selector + text node index
	 *
	 * @param node - Node to get path for
	 * @param root - Root element
	 * @returns Path string
	 */
	private getNodePath(node: Node, root: Element): string {
		if (node === root) {
			return '';
		}

		// Handle text nodes
		if (node.nodeType === Node.TEXT_NODE) {
			const parent = node.parentElement;
			if (!parent) {
				throw new Error('Text node has no parent');
			}

			// Get index of this text node among its siblings
			const textNodes = Array.from(parent.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
			const index = textNodes.indexOf(node as Text);

			const parentPath = this.getElementPath(parent, root);
			return `${parentPath}::text[${index}]`;
		}

		// Handle element nodes
		if (node.nodeType === Node.ELEMENT_NODE) {
			return this.getElementPath(node as Element, root);
		}

		throw new Error(`Unsupported node type: ${node.nodeType}`);
	}

	/**
	 * Get CSS selector path to an element.
	 *
	 * @param element - Element to get path for
	 * @param root - Root element
	 * @returns CSS selector path
	 */
	private getElementPath(element: Element, root: Element): string {
		if (element === root) {
			return '';
		}

		const path: string[] = [];
		let current: Element | null = element;

		while (current && current !== root) {
			// Use ID if available (more stable)
			if (current.id) {
				path.unshift(`#${current.id}`);
				break;
			}

			// Otherwise use tag + nth-of-type
			const parent: Element | null = current.parentElement;
			if (!parent) break;

			const siblings = Array.from(parent.children).filter((el: Element) => el.tagName === current!.tagName);
			const index = siblings.indexOf(current);
			const selector =
				siblings.length > 1
					? `${current.tagName.toLowerCase()}:nth-of-type(${index + 1})`
					: current.tagName.toLowerCase();

			path.unshift(selector);
			current = parent;
		}

		return path.join(' > ');
	}

	/**
	 * Find a node by its path from root.
	 *
	 * @param path - Path string from getNodePath
	 * @param root - Root element
	 * @returns Node, or null if not found
	 */
	private findNodeByPath(path: string, root: Element): Node | null {
		if (path === '') {
			return root;
		}

		// Handle text node paths
		if (path.includes('::text[')) {
			const [elementPath, textPart] = path.split('::text[');
			const textIndex = Number.parseInt(textPart.replace(']', ''), 10);

			// Find parent element
			const parent = elementPath ? root.querySelector(elementPath) : root;
			if (!parent) return null;

			// Find text node by index
			const textNodes = Array.from(parent.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);

			return textNodes[textIndex] || null;
		}

		// Handle element paths
		try {
			return root.querySelector(path);
		} catch (error) {
			console.warn('Invalid selector path:', path, error);
			return null;
		}
	}

	/**
	 * Batch serialize multiple ranges.
	 *
	 * @param ranges - Ranges to serialize
	 * @param root - Root element
	 * @returns Array of serialized ranges
	 */
	serializeMany(ranges: Range[], root: Element): SerializedRange[] {
		return ranges.map((range) => this.serialize(range, root));
	}

	/**
	 * Batch deserialize multiple ranges.
	 *
	 * @param data - Array of serialized ranges
	 * @param root - Root element
	 * @returns Array of ranges (nulls for invalid ranges)
	 */
	deserializeMany(data: SerializedRange[], root: Element): (Range | null)[] {
		return data.map((item) => this.deserialize(item, root));
	}
}
