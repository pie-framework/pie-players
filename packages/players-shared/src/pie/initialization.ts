/**
 * PIE Initialization Module
 *
 * Bundle loading and element initialization logic.
 * This is the core of the PIE player system.
 */

import { BUILDER_BUNDLE_URL } from "../config/profile.js";
import { DEFAULT_IIFE_BUNDLE_RETRY_CONFIG } from "../loader-config.js";
import { mergeObjectsIgnoringNullUndefined } from "../object/index.js";
import type { ConfigEntity } from "../types/index.js";
import { editorPostFix } from "../types/index.js";
import { initializePieElement } from "./initialize-element.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { initializeMathRendering } from "./math-rendering.js";
import { pieRegistry } from "./registry.js";
import { defineCustomElementSafely } from "./custom-element-define.js";
import { validateCustomElementTag } from "./tag-names.js";
import type {
	LoadPieElementsOptions,
	PieElement,
	PieRegistry,
} from "./types.js";
import {
	BundleType,
	isCustomElementConstructor,
	isPieAvailable,
	Status,
} from "./types.js";
import { updatePieElement } from "./updates.js";
import {
	getPackageWithoutVersion,
	getPieElementBundlesUrl,
} from "./utils.js";

// Create module-level logger (respects global debug flag - pass function for dynamic checking)
const logger = createPieLogger("pie-initialization", () =>
	isGlobalDebugEnabled(),
);

/**
 * Deadline for `loadPieModule`'s bundle `<script>` load when the caller
 * sets no `loadTimeoutMs`. Shared with the `ElementLoader` primitive's
 * `DEFAULT_LOAD_TIMEOUT_MS` so a bundle gets the same budget whichever
 * path a host loads it through.
 */
const DEFAULT_LOAD_TIMEOUT_MS = DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs;

// Default options for loading PIE elements
const defaultOptions: LoadPieElementsOptions = {
	buildServiceBase: BUILDER_BUNDLE_URL,
	bundleType: BundleType.player, // Default to player.js (no controllers, server-processed models)
	env: { mode: "gather", role: "student" },
};

const getEditorElementTagName = (elementTagName: string, pkg: string): string =>
	validateCustomElementTag(
		elementTagName + editorPostFix,
		`editor element tag for ${pkg}`,
	);

const updateRegisteredElement = (
	elementTagName: string,
	config: ConfigEntity,
	session: any[],
	options: LoadPieElementsOptions,
	omitEnv = false,
): void => {
	updatePieElement(elementTagName, {
		config,
		session,
		...(omitEnv ? {} : { env: options.env }),
		container: options.container,
		...(options.eventListeners?.[elementTagName] && {
			eventListeners: options.eventListeners[elementTagName],
		}),
	});
};

/**
 * Shared element registration logic
 * Extracted from initializePiesFromLoadedBundle and loadPieModule to eliminate ~200 lines of duplication
 *
 * Binds the elements already present in `options.container`. Elements that
 * arrive later are bound by the container owner's observer — see
 * `element-observer.ts`.
 *
 * `elementModule` may be `null`. In that case we cannot register *new*
 * tags (no element constructor source), but we can still update tags
 * that another loader (e.g. the section-player's IIFE adapter) has
 * already registered with `customElements`. This is the common case
 * when `pie-item-player` mounts inside `pie-section-player`: the
 * section player has already pre-warmed the bundle through the deep
 * `ElementLoader` primitive, so the `window.pie.default` bundle-global
 * path is not required for those tags.
 */
const registerPieElementsFromBundle = (
	elementModule: any | null,
	config: ConfigEntity,
	session: any[],
	registry: PieRegistry,
	options: LoadPieElementsOptions,
): Promise<void>[] => {
	const promises: Promise<void>[] = [];

	if (elementModule) {
		logger.debug(
			"[registerPieElementsFromBundle] Available packages in bundle:",
			Object.keys(elementModule),
		);
	} else {
		logger.debug(
			"[registerPieElementsFromBundle] No bundle module supplied; will only update tags already registered with customElements.",
		);
	}
	logger.debug(
		"[registerPieElementsFromBundle] config.elements:",
		config.elements,
	);

	Object.entries(config.elements).forEach(([elName, pkg]) => {
		const elementTagName = validateCustomElementTag(
			elName,
			`element tag in config.elements for ${String(pkg)}`,
		);
		logger.debug(
			`[registerPieElementsFromBundle] Processing element: ${elementTagName} -> ${pkg}`,
		);

		// Fast path — the tag is already registered with customElements
		// (typically by the host's pre-warm pipeline). We can update its
		// session/model bindings without needing the bundle module at all.
		// This branch is also the one that runs when `elementModule` is
		// `null` because `window.pie` was missing.
		if (customElements.get(elementTagName)) {
			updateRegisteredElement(elementTagName, config, session, options);

			if (options.bundleType === BundleType.editor) {
				const editorElName = getEditorElementTagName(
					elementTagName,
					String(pkg),
				);
				updateRegisteredElement(editorElName, config, session, options, true);
			}
			return;
		}

		// From here on we are in the "register a new tag" branch, which
		// requires a bundle module to read the element constructor from.
		if (!elementModule) {
			// A missing bundle module + an unregistered tag is *not*
			// always an error: in the section-player composition the
			// host's own `ElementLoader` may register this tag
			// out-of-band moments later, in which case `updatePieElement`
			// will pick it up on the next reactive pass via the
			// MutationObserver / `whenDefined` paths. Log at warn so the
			// transient miss is still visible during diagnostics without
			// printing a red stack trace for a routine timing condition.
			logger.warn(
				`[registerPieElementsFromBundle] Skipping "${elementTagName}" — no bundle module available and the tag is not yet registered. Will bind on next update if the host's loader registers it.`,
			);
			return;
		}

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

		{
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
				defineCustomElementSafely(
					elementTagName,
					elementData.Element,
					`element tag in config.elements for ${String(pkg)}`,
				);

				// Initialize existing elements
				const searchRoot = options.container || document;
				const elements = searchRoot.querySelectorAll(elementTagName);
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

				// Handle editor elements if needed
				if (options.bundleType === BundleType.editor) {
					if (isCustomElementConstructor(elementData.Configure)) {
						const editorElName = getEditorElementTagName(
							elementTagName,
							String(pkg),
						);
						defineCustomElementSafely(
							editorElName,
							elementData.Configure,
							`editor element tag for ${String(pkg)}`,
						);
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
		}
	});

	return promises;
};

/**
 * Initialize PIE elements from a bundle that may already be loaded.
 *
 * `window.pie` is the IIFE bundle-loading global populated by
 * `loadPieModule` / `loadBundleFromString`. When the host loaded the
 * bundle through the deep `ElementLoader` primitive instead — as
 * `pie-section-player` does — the global is irrelevant: the loader
 * registers tags directly with `customElements`, so this function only
 * needs to bind models/sessions to whatever is already registered.
 *
 * Behavior:
 * - `window.pie` available → register any new tags from the bundle and
 *   update bindings for already-registered tags.
 * - `window.pie` missing → fall back to the update-only path. Tags that
 *   are already registered get their model/session updated; tags that
 *   are not yet registered are logged at `warn` and left alone — the
 *   host's loader is expected to register them imminently, after which
 *   the existing `MutationObserver` / `updatePieElements` flow binds
 *   them on the next reactive pass.
 *
 * The original blanket `window.pie not found; was the bundle inlined
 * correctly?` error has been removed: in the section-player + item-player
 * composition it produced a confusing red stack trace for a routine
 * timing condition that the host already handles. Genuine failures
 * (bundle not loaded by *anyone*) still surface — every unregistered tag
 * gets its own warning, and `updatePieElements` later reports any tag
 * that never resolves.
 *
 * Binds the elements present in `opts.container` now. Elements that arrive
 * later are the container owner's concern: a player with a lifecycle calls
 * `observePieElements` and releases it on teardown.
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
		registerPieElementsFromBundle(
			elementModule,
			config,
			session,
			registry,
			options,
		);
		return;
	}

	logger.debug(
		"[initializePiesFromLoadedBundle] window.pie not present; using update-only path. Already-registered tags will be bound now; missing tags are expected to be registered by the host's loader and will bind on the next update pass.",
	);
	registerPieElementsFromBundle(null, config, session, registry, options);
};

/**
 * Load a PIE bundle from a URL and initialize elements.
 *
 * Rejects — rather than hanging or throwing on the window — for every way
 * the load can fail: the `error` event (404, blocked request, CSP refusal),
 * the `loadTimeoutMs` deadline (a stalled request that never fires either
 * event), a bundle whose script ran without populating `window.pie`, and a
 * throw out of registration. Every rejection names the bundle URL and drops
 * the injected `<script>`.
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
	const loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
	const script = document.createElement("script");
	script.src = url;
	script.defer = true;

	let timer: ReturnType<typeof setTimeout> | undefined;
	// Removing a `<script>` does not abort a request already in flight, so a
	// late `load` can still fire after the deadline rejected. Each handler
	// checks this so registration never runs for a load the caller has
	// already been told failed.
	let settled = false;

	try {
		await new Promise<void>((resolve, reject) => {
			const succeed = () => {
				settled = true;
				resolve();
			};
			const fail = (error: Error) => {
				settled = true;
				reject(error);
			};

			script.addEventListener("load", () => {
				if (settled) return;
				logger.debug("[loadPieModule] Script loaded from:", url);

				if (!isPieAvailable(window)) {
					// Deliberately a rejection, not a resolve. The script executed
					// and registered nothing, so the URL did not serve a PIE IIFE
					// bundle; resolving would report a successful load to a caller
					// that then waits on elements which never arrive.
					// `initializePiesFromLoadedBundle` tolerates the same missing
					// global because there the host's own loader owns registration.
					// Here this function owns it, so there is no other party to
					// wait for. Matches the IIFE `ElementLoader` adapter, which
					// fails with `cause: "window.pie.default missing after bundle
					// load"`.
					fail(
						new Error(
							`PIE bundle loaded but window.pie is absent; is ${url} a proper PIE IIFE module?`,
						),
					);
					return;
				}

				logger.debug("[loadPieModule] window.pie available");
				const elementModule = window.pie.default;

				try {
					// Use shared registration logic (returns array of promises)
					const registrationPromises = registerPieElementsFromBundle(
						elementModule,
						config,
						session,
						registry,
						options,
					);

					// Wait for all element definitions to complete
					Promise.all(registrationPromises).then(succeed, fail);
				} catch (error) {
					// `registerPieElementsFromBundle` throws synchronously for a
					// package missing from the bundle and for a client-player
					// bundle with no controller. Inside a DOM event handler that
					// throw reaches the window instead of the caller.
					fail(error instanceof Error ? error : new Error(String(error)));
				}
			});

			script.addEventListener("error", () => {
				if (settled) return;
				fail(new Error(`failed to load PIE bundle script: ${url}`));
			});

			if (loadTimeoutMs > 0) {
				timer = setTimeout(() => {
					if (settled) return;
					fail(
						new Error(
							`PIE bundle script load timed out after ${loadTimeoutMs}ms: ${url}`,
						),
					);
				}, loadTimeoutMs);
			}

			document.head.appendChild(script);
		});
	} catch (error) {
		// Drop the injected node so a retry starts from a clean head.
		script.remove();
		throw error;
	} finally {
		if (timer) clearTimeout(timer);
	}

	return { session };
};

/**
 * Load a PIE bundle from a JavaScript string into window.pie (IIFE bundles only)
 * This only registers elements and controllers - does NOT initialize them.
 * For initialization, use initializePiesFromLoadedBundle after loading.
 */
export const loadBundleFromString = async (bundleJs: string): Promise<void> => {
	await initializeMathRendering();
	await withBlobBundleUrl(
		bundleJs,
		{ stripSourceMapComment: true },
		async (bundleUrl) => {
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
		},
	);
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
	await withBlobBundleUrl(bundleJs, {}, async (bundleUrl) => {
		// Use existing loadPieModule with the blob URL
		await loadPieModule(config, session, { ...opts, bundleUrl });
	});
};

const withBlobBundleUrl = async <T>(
	bundleJs: string,
	options: { stripSourceMapComment?: boolean },
	run: (bundleUrl: string) => Promise<T>,
): Promise<T> => {
	const source = options.stripSourceMapComment
		? bundleJs.replace(/\/\/# sourceMappingURL=.*$/m, "")
		: bundleJs;
	const blob = new Blob([source], { type: "application/javascript" });
	const bundleUrl = URL.createObjectURL(blob);
	try {
		return await run(bundleUrl);
	} finally {
		URL.revokeObjectURL(bundleUrl);
	}
};
