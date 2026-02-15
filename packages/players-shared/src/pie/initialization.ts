/**
 * PIE Initialization Module
 *
 * Bundle loading and element initialization logic.
 * This is the core of the PIE player system.
 */

import { BUILDER_BUNDLE_URL } from "../config/profile";
import { mergeObjectsIgnoringNullUndefined } from "../object";
import type { ConfigEntity, Env, PieModel } from "../types";
import { editorPostFix } from "../types";
import { createPieLogger, isGlobalDebugEnabled } from "./logger";
import { initializeMathRendering } from "./math-rendering";
import { pieRegistry } from "./registry";
import { findPieController } from "./scoring";
import { validateCustomElementTag } from "./tag-names";
import type {
	EventListeners,
	LoadPieElementsOptions,
	PieElement,
	PieRegistry,
} from "./types";
import {
	BundleType,
	isCustomElementConstructor,
	isPieAvailable,
	Status,
} from "./types";
import { updatePieElement } from "./updates";
import {
	findOrAddSession,
	getPackageWithoutVersion,
	getPieElementBundlesUrl,
} from "./utils";

// Create module-level logger (respects global debug flag - pass function for dynamic checking)
const logger = createPieLogger("pie-initialization", () =>
	isGlobalDebugEnabled(),
);

// Default options for loading PIE elements
const defaultOptions: LoadPieElementsOptions = {
	buildServiceBase: BUILDER_BUNDLE_URL,
	bundleType: BundleType.player, // Default to player.js (no controllers, server-processed models)
	env: { mode: "gather", role: "student" },
};

// Add this to your window types
declare global {
	interface Window {
		_pieElementObserver?: MutationObserver;
		_pieCurrentContext?: {
			config: ConfigEntity;
			session: any[];
			env?: Env;
		};
	}
}

/**
 * Helper function to initialize a PIE element
 */
const initializePieElement = (
	element: PieElement,
	options: {
		config: ConfigEntity;
		session: any[];
		env?: Env;
		eventListeners?: EventListeners;
	},
): void => {
	const { config, session, env, eventListeners } = options;
	const tagName = element.tagName.toLowerCase();

	logger.debug(`[initializePieElement] Initializing ${tagName}#${element.id}`);

	// Find model for this element
	let model = config?.models?.find((m) => m.id === element.id) as PieModel;
	if (!model) {
		// Only warn if this element is from a client-player.js bundle (where models are expected)
		// player.js bundles use server-processed models, so missing models are expected there
		const registry = pieRegistry();
		const registryEntry = registry[tagName];

		if (registryEntry && registryEntry.bundleType === BundleType.clientPlayer) {
			logger.warn(
				`[initializePieElement] Model not found for PIE element ${tagName}#${element.id} (client-player.js bundle)`,
			);
		}
		return;
	}

	// Set session (with element property for updateSession callback)
	const elementSession = findOrAddSession(session, model.id, model.element);
	element.session = elementSession;
	logger.debug(
		`[initializePieElement] Session set for ${tagName}#${element.id}:`,
		elementSession,
	);

	// Set model - use controller if available (client-player.js), or use server-processed model (player.js)
	const controller = findPieController(tagName);

	if (!env) {
		logger.error(
			`[initializePieElement] ❌ FATAL: No env provided for ${tagName}`,
		);
		throw new Error(
			`No env provided for ${tagName}. PIE elements require an env object with mode and role.`,
		);
	}

	if (!controller) {
		// No controller available - using server-processed model (player.js bundle)
		logger.debug(
			`[initializePieElement] ℹ️ No controller for ${tagName}, using server-processed model`,
		);
		logger.debug(`[initializePieElement] Model already processed by server:`, {
			id: model.id,
			element: model.element,
			hasCorrectResponse: "correctResponse" in model,
			mode: env.mode,
			role: env.role,
		});

		// Set model directly - server already processed it
		element.model = model;
	} else {
		// Controller available - run client-side processing (client-player.js bundle)
		// Note: updatePieElementWithRef handles controller invocation
		logger.debug(
			`[initializePieElement] Controller found for ${tagName}, will invoke model() function`,
		);
	}

	// Add event listeners
	if (eventListeners) {
		Object.entries(eventListeners).forEach(([evt, fn]) => {
			element.addEventListener(evt as any, fn);
		});
	}
};

/**
 * Shared element registration logic
 * Extracted from initializePiesFromLoadedBundle and loadPieModule to eliminate ~200 lines of duplication
 * Also fixes MutationObserver memory leak by storing latest config/session in window context
 */
const registerPieElementsFromBundle = (
	elementModule: any,
	config: ConfigEntity,
	session: any[],
	registry: PieRegistry,
	options: LoadPieElementsOptions,
): Promise<void>[] => {
	const promises: Promise<void>[] = [];

	logger.debug(
		"[registerPieElementsFromBundle] Available packages in bundle:",
		Object.keys(elementModule),
	);
	logger.debug(
		"[registerPieElementsFromBundle] config.elements:",
		config.elements,
	);

	// Store latest config/session in window so MutationObserver can access current values
	if (typeof window !== "undefined") {
		window._pieCurrentContext = { config, session, env: options.env };
	}

	Object.entries(config.elements).forEach(([elName, pkg]) => {
		const elementTagName = validateCustomElementTag(
			elName,
			`element tag in config.elements for ${String(pkg)}`,
		);
		logger.debug(
			`[registerPieElementsFromBundle] Processing element: ${elementTagName} -> ${pkg}`,
		);
		const pkgStripped = getPackageWithoutVersion(pkg as string);
		logger.debug(
			`[registerPieElementsFromBundle] Package without version: "${pkgStripped}"`,
		);

		const elementData = elementModule[pkgStripped];
		logger.debug(
			`[registerPieElementsFromBundle] elementData result:`,
			elementData ? "FOUND" : "UNDEFINED",
		);

		if (!elementData) {
			logger.error(
				`[registerPieElementsFromBundle] ❌ Package "${pkgStripped}" not found in bundle!`,
			);
			logger.error(
				`[registerPieElementsFromBundle] Lookup key: "${pkgStripped}"`,
			);
			logger.error(
				`[registerPieElementsFromBundle] Available packages:`,
				Object.keys(elementModule),
			);
			throw new Error(
				`pie ${pkgStripped} not found in ${Object.keys(elementModule)}`,
			);
		}

		logger.debug(
			`[registerPieElementsFromBundle] elementData for ${pkgStripped}:`,
			{
				hasController: !!elementData.controller,
				hasElement: !!elementData.Element,
				hasConfig: !!elementData.config,
				controllerKeys: elementData.controller
					? Object.keys(elementData.controller)
					: [],
				bundleType: options.bundleType,
			},
		);

		// Validate controller presence based on bundle type
		if (!elementData.controller) {
			if (options.bundleType === BundleType.clientPlayer) {
				logger.error(
					`[registerPieElementsFromBundle] ❌ CRITICAL: No controller found for ${pkgStripped}!`,
				);
				logger.error(
					`[registerPieElementsFromBundle] Bundle type: ${options.bundleType} (controllers required)`,
				);
				throw new Error(
					`No controller found for ${pkgStripped}. client-player.js bundles MUST include controllers!`,
				);
			} else {
				logger.debug(
					`[registerPieElementsFromBundle] ℹ️ No controller found for ${pkgStripped} - using server-processed models (player.js bundle)`,
				);
			}
		}

		if (!customElements.get(elementTagName)) {
			// Register the element in our registry
			logger.debug(
				`[registerPieElementsFromBundle] Registering ${elName} in registry${
					elementData.controller
						? " with controller"
						: " (no controller - server-processed models)"
				}`,
			);
			registry[elementTagName] = {
				package: pkg as string,
				status: Status.loading,
				tagName: elementTagName,
				controller: elementData.controller || null,
				config: elementData.config,
				bundleType: options.bundleType,
			};

			if (isCustomElementConstructor(elementData.Element)) {
				customElements.define(elementTagName, elementData.Element);

				// Initialize existing elements
				const elements = document.querySelectorAll(elementTagName);
				logger.debug(
					`[registerPieElementsFromBundle] Found ${elements.length} elements for tag '${elementTagName}'`,
				);

				elements.forEach((el) => {
					initializePieElement(el as PieElement, {
						config,
						session,
						env: options.env,
						eventListeners: options.eventListeners?.[elementTagName],
					});
				});

				// Update registry status
				registry[elementTagName] = {
					...registry[elementTagName],
					status: Status.loaded,
				};

				promises.push(
					customElements.whenDefined(elementTagName).then(() => {
						logger.debug(
							"[registerPieElementsFromBundle] defined custom PIE element: %s",
							elementTagName,
						);
					}),
				);

				// Setup MutationObserver that uses current context (only once)
				if (!window._pieElementObserver) {
					window._pieElementObserver = new MutationObserver((mutations) => {
						// Use current context from window instead of stale closure
						const context = window._pieCurrentContext;
						if (!context) {
							logger.warn("[MutationObserver] No current context available");
							return;
						}

						mutations.forEach((mutation) => {
							if (mutation.type === "childList") {
								mutation.addedNodes.forEach((node) => {
									if (node.nodeType === Node.ELEMENT_NODE) {
										const tagName = (node as Element).tagName.toLowerCase();
										if (registry[tagName]) {
											initializePieElement(node as PieElement, {
												config: context.config,
												session: context.session,
												env: context.env,
												eventListeners: options.eventListeners?.[tagName],
											});
										}

										// Check children of added nodes
										(node as Element)
											.querySelectorAll("*")
											.forEach((childNode) => {
												const childTagName = childNode.tagName.toLowerCase();
												if (registry[childTagName]) {
													initializePieElement(childNode as PieElement, {
														config: context.config,
														session: context.session,
														env: context.env,
														eventListeners:
															options.eventListeners?.[childTagName],
													});
												}
											});
									}
								});
							}
						});
					});

					window._pieElementObserver.observe(document.body, {
						childList: true,
						subtree: true,
					});
				}

				// Handle editor elements if needed
				if (options.bundleType === BundleType.editor) {
					if (isCustomElementConstructor(elementData.Configure)) {
						const editorElName = validateCustomElementTag(
							elementTagName + editorPostFix,
							`editor element tag for ${String(pkg)}`,
						);
						customElements.define(editorElName, elementData.Configure);
						promises.push(
							customElements.whenDefined(editorElName).then(() => {
								logger.debug(
									`[registerPieElementsFromBundle] defined custom PIE editor element: ${editorElName}`,
								);
							}),
						);
					} else {
						logger.error(
							`[registerPieElementsFromBundle] pie.Configure for ${pkgStripped} is not a valid custom element constructor.`,
							elementData.configure,
						);
					}
				}
			} else {
				logger.error(
					`[registerPieElementsFromBundle] pie.Element for ${pkgStripped} is not a valid custom element constructor.`,
				);
			}
		} else {
			// Element already defined, just update it
			updatePieElement(elementTagName, {
				config,
				session,
				env: options.env,
				container: options.container,
				...(options.eventListeners?.[elementTagName] && {
					eventListeners: options.eventListeners[elementTagName],
				}),
			});

			if (options.bundleType === BundleType.editor) {
				const editorElName = validateCustomElementTag(
					elementTagName + editorPostFix,
					`editor element tag for ${String(pkg)}`,
				);
				updatePieElement(editorElName, {
					config,
					session,
					container: options.container,
					...(options.eventListeners?.[editorElName] && {
						eventListeners: options.eventListeners[editorElName],
					}),
				});
			}
		}
	});

	return promises;
};

/**
 * Initialize PIE elements from a bundle already loaded into window.pie
 */
export const initializePiesFromLoadedBundle = (
	config: ConfigEntity,
	session: any[],
	opts: LoadPieElementsOptions = {},
): void => {
	const registry = pieRegistry();
	const options = mergeObjectsIgnoringNullUndefined(defaultOptions, opts);

	if (isPieAvailable(window)) {
		logger.debug("[initializePiesFromLoadedBundle] window.pie available");
		const elementModule = window.pie.default;

		// Use shared registration logic
		registerPieElementsFromBundle(
			elementModule,
			config,
			session,
			registry,
			options,
		);
	} else {
		logger.error(
			"[initializePiesFromLoadedBundle] window.pie not found; was the bundle inlined correctly?",
		);
	}
};

/**
 * Load a PIE bundle from a URL and initialize elements
 */
export const loadPieModule = async (
	config: ConfigEntity,
	session: any[],
	opts: LoadPieElementsOptions = {},
): Promise<{
	session: any[];
}> => {
	if (!session) {
		throw new Error("session is required");
	}

	// Initialize math-rendering module (required by PIE elements)
	await initializeMathRendering();

	const registry = pieRegistry();
	const options = mergeObjectsIgnoringNullUndefined(defaultOptions, opts);
	const url = opts.bundleUrl || getPieElementBundlesUrl(config, options);
	const script = document.createElement("script");
	script.src = url;
	script.defer = true;
	script.onerror = () => {
		throw new Error(`failed to load script: ${url}`);
	};

	const loadPromise = new Promise<void>((loadResolve) => {
		script.addEventListener("load", () => {
			logger.debug("[loadPieModule] Script loaded from:", url);
			if (isPieAvailable(window)) {
				logger.debug("[loadPieModule] window.pie available");
				const elementModule = window.pie.default;

				// Use shared registration logic (returns array of promises)
				const registrationPromises = registerPieElementsFromBundle(
					elementModule,
					config,
					session,
					registry,
					options,
				);

				// Wait for all element definitions to complete
				Promise.all(registrationPromises).then(() => loadResolve());
			} else {
				logger.error(
					"[loadPieModule] pie var not found; is %s a proper PIE IIFE module?",
					url,
				);
				loadResolve();
			}
		});
	});

	document.head.appendChild(script);
	await loadPromise;
	return { session };
};

/**
 * Load a PIE bundle from a JavaScript string into window.pie (IIFE bundles only)
 * This only registers elements and controllers - does NOT initialize them.
 * For initialization, use initializePiesFromLoadedBundle after loading.
 */
export const loadBundleFromString = async (bundleJs: string): Promise<void> => {
	// Strip sourceMappingURL comment to prevent 404 errors for .map files
	const cleanedJs = bundleJs.replace(/\/\/# sourceMappingURL=.*$/m, "");

	// Create a blob URL for the bundle JavaScript
	const blob = new Blob([cleanedJs], { type: "application/javascript" });
	const bundleUrl = URL.createObjectURL(blob);

	try {
		// Create a script tag to execute the bundle
		const script = document.createElement("script");
		script.src = bundleUrl;
		script.type = "text/javascript"; // IIFE bundles are standard JS

		// Wait for script to load
		await new Promise<void>((resolve, reject) => {
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("Failed to load bundle"));
			document.head.appendChild(script);
		});

		logger.debug("[loadBundleFromString] Bundle loaded into window.pie");
	} finally {
		// Clean up the blob URL
		URL.revokeObjectURL(bundleUrl);
	}
};

/**
 * Load a PIE bundle from a JavaScript string and initialize elements
 * Convenience wrapper around loadBundleFromString + loadPieModule
 */
export const loadPieModuleFromString = async (
	bundleJs: string,
	config: ConfigEntity,
	session: any[],
	opts: LoadPieElementsOptions = {},
): Promise<void> => {
	// Create a blob URL for the bundle JavaScript
	const blob = new Blob([bundleJs], { type: "application/javascript" });
	const bundleUrl = URL.createObjectURL(blob);

	try {
		// Use existing loadPieModule with the blob URL
		await loadPieModule(config, session, { ...opts, bundleUrl });
	} finally {
		// Always clean up the blob URL
		URL.revokeObjectURL(bundleUrl);
	}
};
