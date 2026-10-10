/**
 * RangeSerializer - Serialize and deserialize DOM Range objects
 *
 * Provides utilities for storing and restoring text ranges across sessions.
 * Used by both TTS (for timing data) and annotations (for persistence).
 *
 * Uses CSS selector paths and node indices for robust serialization that
 * survives content changes when possible. A path into an open shadow root names
 * its host, then ` >>> `, then the path inside the root, so ranges in content
 * that renders into shadow roots round-trip; paths without one read as before.
 */

import { isShadowRootNode } from "./tts/flat-tree.js";

/** Separates a shadow host's path from the path inside its shadow root. */
const SHADOW_STEP = " >>> ";

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
			text: range.toString(),
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
			console.warn("Failed to deserialize range:", error);
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
			return "";
		}

		// Handle text nodes
		if (node.nodeType === Node.TEXT_NODE) {
			const parent = node.parentNode;
			if (!parent) {
				throw new Error("Text node has no parent");
			}

			// Get index of this text node among its siblings
			const textNodes = Array.from(parent.childNodes).filter(
				(n) => n.nodeType === Node.TEXT_NODE,
			);
			const index = textNodes.indexOf(node as Text);

			const parentPath = isShadowRootNode(parent)
				? this.getShadowRootPath(parent, root)
				: this.getElementPath(parent as Element, root);
			return `${parentPath}::text[${index}]`;
		}

		// Handle element nodes
		if (node.nodeType === Node.ELEMENT_NODE) {
			return this.getElementPath(node as Element, root);
		}

		if (isShadowRootNode(node)) {
			return this.getShadowRootPath(node, root);
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
			return "";
		}

		const rootTree = root.getRootNode?.();
		// One path per tree, outermost first.
		const trees: string[] = [];
		let path: string[] = [];
		let current: Element | null = element;

		// Ends `current`'s tree at the shadow root holding it, continuing at the host.
		const leaveShadowRoot = (shadowRoot: ShadowRoot) => {
			trees.unshift(path.join(" > "));
			path = [];
			current = shadowRoot.host;
		};

		while (current && current !== root) {
			// Use ID if available (more stable). An id is unique within its tree, so
			// the path still names the shadow host above it.
			if (current.id) {
				path.unshift(`#${current.id}`);
				const tree = current.getRootNode?.();
				if (isShadowRootNode(tree) && tree !== rootTree) {
					leaveShadowRoot(tree);
					continue;
				}
				break;
			}

			// Otherwise use tag + nth-of-type
			const parent: Element | null = current.parentElement;
			const parentNode = current.parentNode;
			const siblingsParent: ParentNode | null =
				parent ?? (isShadowRootNode(parentNode) ? parentNode : null);
			if (!siblingsParent) break;
			const tagName = current.tagName;
			const siblings = Array.from(siblingsParent.children).filter(
				(el: Element) => el.tagName === tagName,
			);
			const index = siblings.indexOf(current);
			const selector =
				siblings.length > 1
					? `${tagName.toLowerCase()}:nth-of-type(${index + 1})`
					: tagName.toLowerCase();

			path.unshift(selector);
			if (parent) {
				current = parent;
			} else {
				leaveShadowRoot(siblingsParent as ShadowRoot);
			}
		}

		trees.unshift(path.join(" > "));
		return trees.join(SHADOW_STEP);
	}

	/** The path to `shadowRoot` itself: its host's path and an empty step into it. */
	private getShadowRootPath(shadowRoot: ShadowRoot, root: Element): string {
		return `${this.getElementPath(shadowRoot.host, root)}${SHADOW_STEP}`;
	}

	/**
	 * The element, or shadow root, an element path names: each step after a
	 * {@link SHADOW_STEP} continues in the shadow root of what the step before named.
	 */
	private resolveElementPath(
		path: string,
		root: Element,
	): Element | ShadowRoot | null {
		let scope: Element | ShadowRoot = root;
		const steps = path.split(SHADOW_STEP);
		for (let index = 0; index < steps.length; index++) {
			if (index > 0) {
				const shadowRoot: ShadowRoot | null = isShadowRootNode(scope)
					? null
					: scope.shadowRoot;
				if (!shadowRoot) return null;
				scope = shadowRoot;
			}
			const selector = steps[index].trim();
			if (!selector) continue;
			const found: Element | null = scope.querySelector(selector);
			if (!found) return null;
			scope = found;
		}
		return scope;
	}

	/**
	 * Find a node by its path from root.
	 *
	 * @param path - Path string from getNodePath
	 * @param root - Root element
	 * @returns Node, or null if not found
	 */
	private findNodeByPath(path: string, root: Element): Node | null {
		if (path === "") {
			return root;
		}

		// Handle text node paths
		if (path.includes("::text[")) {
			const marker = path.lastIndexOf("::text[");
			const elementPath = path.slice(0, marker);
			const textPart = path.slice(marker + "::text[".length);
			const textIndex = Number.parseInt(textPart.replace("]", ""), 10);

			// Find parent element
			let parent: Element | ShadowRoot | null;
			try {
				parent = this.resolveElementPath(elementPath, root);
			} catch (error) {
				console.warn("Invalid selector path:", path, error);
				return null;
			}
			if (!parent) return null;

			// Find text node by index
			const textNodes = Array.from(parent.childNodes).filter(
				(n) => n.nodeType === Node.TEXT_NODE,
			);

			return textNodes[textIndex] || null;
		}

		// Handle element paths
		try {
			return this.resolveElementPath(path, root);
		} catch (error) {
			console.warn("Invalid selector path:", path, error);
			return null;
		}
	}
}
