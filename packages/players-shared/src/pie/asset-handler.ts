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

type UploadHandlerLike = {
	cancel?: () => void;
	done?: (err?: Error, src?: string) => void;
	progress?: (percent: number, bytes: number, total: number) => void;
	fileChosen?: (file: File) => void;
	isPasted?: boolean;
	getChosenFile?: () => File;
};

function toError(value: unknown, fallback: string): Error {
	if (value instanceof Error) {
		return value;
	}
	return new Error(String(value ?? fallback));
}

function createOnceCompletion(
	handler: UploadHandlerLike,
	dataURLHandler: DataURLAssetHandler,
) {
	let settled = false;
	const originalDone = handler.done;
	const originalCancel = handler.cancel;

	const done = (err?: Error, src?: string) => {
		if (settled) {
			return;
		}
		settled = true;
		if (err) {
			try {
				originalCancel?.();
			} catch (cancelError) {
				logger.error("[asset-handler] cancel callback failed:", cancelError);
			}
			dataURLHandler.cancel();
		}
		try {
			originalDone?.(err, src);
		} catch (doneError) {
			logger.error("[asset-handler] done callback failed:", doneError);
		}
	};

	const cancel = () => {
		if (settled) {
			return;
		}
		settled = true;
		try {
			originalCancel?.();
		} catch (cancelError) {
			logger.error("[asset-handler] cancel callback failed:", cancelError);
		}
		dataURLHandler.cancel();
	};

	handler.done = done;
	handler.cancel = cancel;

	return {
		done,
		cancel,
		isSettled: () => settled,
	};
}

function pickFileWithDialogLifecycle(
	accept: string,
	onCancel: () => void,
): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;

		let resolved = false;
		let changeHandled = false;
		let dialogOpened = false;

		const cleanup = () => {
			input.onchange = null;
			window.removeEventListener("focus", onFocus);
			input.removeEventListener("cancel", onCancelEvent as EventListener);
		};

		const finalize = (file: File | null) => {
			if (resolved) {
				return;
			}
			resolved = true;
			cleanup();
			resolve(file);
		};

		const onFocus = () => {
			if (!dialogOpened || changeHandled) {
				return;
			}
			dialogOpened = false;
			window.setTimeout(() => {
				if (changeHandled || resolved) {
					return;
				}
				const file = input.files?.[0] ?? null;
				if (!file) {
					onCancel();
				}
				finalize(file);
			}, 300);
		};

		const onCancelEvent = () => {
			onCancel();
			finalize(null);
		};

		input.onchange = () => {
			changeHandled = true;
			dialogOpened = false;
			finalize(input.files?.[0] ?? null);
		};

		input.addEventListener("cancel", onCancelEvent as EventListener);
		window.addEventListener("focus", onFocus);
		dialogOpened = true;
		input.click();
	});
}

function getPastedFile(handler: UploadHandlerLike): File | null {
	if (!handler.isPasted || typeof handler.getChosenFile !== "function") {
		return null;
	}
	try {
		return handler.getChosenFile() ?? null;
	} catch (error) {
		logger.error("[asset-handler] Failed to read pasted file", error);
		return null;
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

		let completion: ReturnType<typeof createOnceCompletion> | null = null;
		const dataURLHandler = new DataURLAssetHandler((src) => {
			onComplete(src);
			completion?.done(undefined, src);
		});
		completion = createOnceCompletion(handler, dataURLHandler);
		const finishCancelled = () => {
			completion?.done(new Error("Image selection cancelled"));
		};

		const handleChosenFile = (file: File | null) => {
			if (!file) {
				finishCancelled();
				return;
			}
			try {
				handler.fileChosen(file);
			} catch (error) {
				logger.error(
					"[createDefaultImageInsertHandler] fileChosen failed",
					error,
				);
				completion?.done(toError(error, "Image fileChosen failed"));
				return;
			}
			try {
				dataURLHandler.fileChosen(file);
			} catch (error) {
				completion?.done(toError(error, "Image upload failed"));
			}
		};

		const pastedFile = getPastedFile(handler);
		if (pastedFile) {
			handleChosenFile(pastedFile);
			return;
		}
		if (handler.isPasted) {
			completion?.done(new Error("Pasted image is unavailable"));
			return;
		}

		void pickFileWithDialogLifecycle("image/*", finishCancelled)
			.then((file) => {
				if (completion?.isSettled()) {
					return;
				}
				handleChosenFile(file);
			})
			.catch((error) => {
				completion?.done(toError(error, "Image selection failed"));
			});
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

		let completion: ReturnType<typeof createOnceCompletion> | null = null;
		const dataURLHandler = new DataURLAssetHandler((src) => {
			onComplete(src);
			completion?.done(undefined, src);
		});
		const handlerLike = handler as unknown as UploadHandlerLike;
		completion = createOnceCompletion(handlerLike, dataURLHandler);
		const finishCancelled = () => {
			completion?.done(new Error("Sound selection cancelled"));
		};

		const handleChosenFile = (file: File | null) => {
			if (!file) {
				finishCancelled();
				return;
			}
			// Some handlers expose fileChosen as function, while others store file directly.
			const maybeFileChosen = (handlerLike as any).fileChosen;
			if (typeof maybeFileChosen === "function") {
				try {
					maybeFileChosen(file);
				} catch (error) {
					logger.error(
						"[createDefaultSoundInsertHandler] fileChosen failed",
						error,
					);
					completion?.done(toError(error, "Sound fileChosen failed"));
					return;
				}
			}
			try {
				dataURLHandler.fileChosen(file);
			} catch (error) {
				completion?.done(toError(error, "Sound upload failed"));
			}
		};

		const pastedFile = getPastedFile(handlerLike);
		if (pastedFile) {
			handleChosenFile(pastedFile);
			return;
		}
		if (handlerLike.isPasted) {
			completion?.done(new Error("Pasted sound is unavailable"));
			return;
		}

		void pickFileWithDialogLifecycle("audio/*", finishCancelled)
			.then((file) => {
				if (completion?.isSettled()) {
					return;
				}
				handleChosenFile(file);
			})
			.catch((error) => {
				completion?.done(toError(error, "Sound selection failed"));
			});
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
