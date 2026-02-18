/**
 * Asset Handler Utilities
 *
 * Handles image and sound upload events for authoring mode.
 * Provides default DataURL-based implementation and event management.
 */

import {
	DeleteImageEvent,
	DeleteSoundEvent,
	type ImageHandler,
	InsertImageEvent,
	InsertSoundEvent,
	type SoundHandler,
} from "../types/index.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import type { AssetHandler } from "./types.js";

const logger = createPieLogger("asset-handler", () => isGlobalDebugEnabled());

/**
 * DataURL-based asset handler (default implementation)
 *
 * Converts uploaded files to base64 data URLs.
 * Suitable for demos and local development.
 */
export class DataURLAssetHandler implements AssetHandler {
	private cancelled = false;
	private fileReader: FileReader | null = null;

	constructor(private onComplete: (src: string) => void) {}

	cancel(): void {
		this.cancelled = true;
		if (this.fileReader) {
			this.fileReader.abort();
		}
		logger.debug("[DataURLAssetHandler] Upload cancelled");
	}

	done(err?: Error, src?: string): void {
		if (this.cancelled) {
			return;
		}

		if (err) {
			logger.error("[DataURLAssetHandler] Error during upload:", err);
			// Optionally notify user of error
			return;
		}

		if (src) {
			logger.debug(
				"[DataURLAssetHandler] Upload complete, src:",
				src.substring(0, 50) + "...",
			);
			this.onComplete(src);
		}
	}

	fileChosen(file: File): void {
		if (this.cancelled) {
			return;
		}

		logger.debug(
			"[DataURLAssetHandler] File chosen:",
			file.name,
			file.type,
			file.size,
		);

		this.fileReader = new FileReader();

		this.fileReader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			logger.debug("[DataURLAssetHandler] File converted to data URL");
			this.done(undefined, dataUrl);
		};

		this.fileReader.onerror = () => {
			logger.error("[DataURLAssetHandler] FileReader error");
			this.done(new Error("Failed to read file"));
		};

		this.fileReader.onprogress = (e) => {
			if (e.lengthComputable) {
				const percent = (e.loaded / e.total) * 100;
				this.progress(percent, e.loaded, e.total);
			}
		};

		this.fileReader.readAsDataURL(file);
	}

	progress(percent: number, bytes: number, total: number): void {
		logger.debug(
			`[DataURLAssetHandler] Progress: ${percent.toFixed(1)}% (${bytes}/${total} bytes)`,
		);
		// Could dispatch custom event here for progress UI
	}
}

/**
 * Asset Event Manager
 *
 * Manages asset-related event listeners for configure elements.
 * Handles InsertImageEvent, DeleteImageEvent, InsertSoundEvent, DeleteSoundEvent.
 */
export class AssetEventManager {
	private listeners: Array<{ type: string; handler: EventListener }> = [];

	constructor(
		private element: HTMLElement,
		private onInsertImage?: (handler: ImageHandler) => void,
		private onDeleteImage?: (src: string, done: (err?: Error) => void) => void,
		private onInsertSound?: (handler: SoundHandler) => void,
		private onDeleteSound?: (src: string, done: (err?: Error) => void) => void,
	) {}

	/**
	 * Attach event listeners
	 */
	attach(): void {
		logger.debug("[AssetEventManager] Attaching event listeners");

		// Insert Image Event
		if (this.onInsertImage) {
			const insertImageHandler = (e: Event) => {
				const event = e as InsertImageEvent;
				logger.debug("[AssetEventManager] InsertImageEvent received");
				this.onInsertImage!(event.detail);
			};
			this.element.addEventListener(InsertImageEvent.TYPE, insertImageHandler);
			this.listeners.push({
				type: InsertImageEvent.TYPE,
				handler: insertImageHandler,
			});
		}

		// Delete Image Event
		if (this.onDeleteImage) {
			const deleteImageHandler = (e: Event) => {
				const event = e as DeleteImageEvent;
				logger.debug(
					"[AssetEventManager] DeleteImageEvent received, src:",
					event.detail.src,
				);
				this.onDeleteImage!(event.detail.src, event.detail.done);
			};
			this.element.addEventListener(DeleteImageEvent.TYPE, deleteImageHandler);
			this.listeners.push({
				type: DeleteImageEvent.TYPE,
				handler: deleteImageHandler,
			});
		}

		// Insert Sound Event
		if (this.onInsertSound) {
			const insertSoundHandler = (e: Event) => {
				const event = e as InsertSoundEvent;
				logger.debug("[AssetEventManager] InsertSoundEvent received");
				this.onInsertSound!(event.detail);
			};
			this.element.addEventListener(InsertSoundEvent.TYPE, insertSoundHandler);
			this.listeners.push({
				type: InsertSoundEvent.TYPE,
				handler: insertSoundHandler,
			});
		}

		// Delete Sound Event
		if (this.onDeleteSound) {
			const deleteSoundHandler = (e: Event) => {
				const event = e as DeleteSoundEvent;
				logger.debug(
					"[AssetEventManager] DeleteSoundEvent received, src:",
					event.detail.src,
				);
				this.onDeleteSound!(event.detail.src, event.detail.done);
			};
			this.element.addEventListener(DeleteSoundEvent.TYPE, deleteSoundHandler);
			this.listeners.push({
				type: DeleteSoundEvent.TYPE,
				handler: deleteSoundHandler,
			});
		}

		logger.debug(
			"[AssetEventManager] Attached",
			this.listeners.length,
			"event listeners",
		);
	}

	/**
	 * Detach event listeners (cleanup)
	 */
	detach(): void {
		logger.debug("[AssetEventManager] Detaching event listeners");

		this.listeners.forEach(({ type, handler }) => {
			this.element.removeEventListener(type, handler);
		});

		this.listeners = [];
		logger.debug("[AssetEventManager] All event listeners detached");
	}
}

/**
 * Create default image insert handler using DataURL conversion
 */
export function createDefaultImageInsertHandler(
	onComplete: (src: string) => void,
): (handler: ImageHandler) => void {
	return (handler: ImageHandler) => {
		logger.debug("[createDefaultImageInsertHandler] Creating DataURL handler");

		const dataURLHandler = new DataURLAssetHandler(onComplete);

		// Connect the handler methods
		handler.cancel = () => dataURLHandler.cancel();
		handler.done = (err?: Error, src?: string) => dataURLHandler.done(err, src);

		// Trigger file chooser if not a paste event
		if (!handler.isPasted) {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "image/*";

			input.onchange = (e) => {
				const file = (e.target as HTMLInputElement).files?.[0];
				if (file) {
					handler.fileChosen(file);
					dataURLHandler.fileChosen(file);
				} else {
					handler.cancel();
				}
			};

			input.click();
		}
	};
}

/**
 * Create default sound insert handler using DataURL conversion
 */
export function createDefaultSoundInsertHandler(
	onComplete: (src: string) => void,
): (handler: SoundHandler) => void {
	return (handler: SoundHandler) => {
		logger.debug("[createDefaultSoundInsertHandler] Creating DataURL handler");

		const dataURLHandler = new DataURLAssetHandler(onComplete);

		// Connect the handler methods
		handler.cancel = () => dataURLHandler.cancel();
		handler.done = (err?: Error, src?: string) => dataURLHandler.done(err, src);

		// Trigger file chooser
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*";

		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				dataURLHandler.fileChosen(file);
			} else {
				handler.cancel();
			}
		};

		input.click();
	};
}

/**
 * Create default image delete handler (no-op for DataURL)
 */
export function createDefaultImageDeleteHandler(): (
	src: string,
	done: (err?: Error) => void,
) => void {
	return (src: string, done: (err?: Error) => void) => {
		logger.debug(
			"[createDefaultImageDeleteHandler] Delete requested for:",
			src.substring(0, 50),
		);
		// For DataURL, no server-side deletion needed
		done(); // Success
	};
}

/**
 * Create default sound delete handler (no-op for DataURL)
 */
export function createDefaultSoundDeleteHandler(): (
	src: string,
	done: (err?: Error) => void,
) => void {
	return (src: string, done: (err?: Error) => void) => {
		logger.debug(
			"[createDefaultSoundDeleteHandler] Delete requested for:",
			src.substring(0, 50),
		);
		// For DataURL, no server-side deletion needed
		done(); // Success
	};
}
