/**
 * Headless host for capabilities that render into section-player surfaces.
 *
 * The interface deliberately exposes only current input, a two-boolean snapshot,
 * and teardown. Discovery, policy/catalog invalidation, content resolution, lazy
 * loading, DOM reconciliation, error isolation, and registry observation stay
 * inside this module. Svelte callers are geometry adapters over this seam.
 */

// The grant-AND-content rule lives in the registration-authoring surface rather
// than the host-facing one: it is what a package rendering capabilities into its
// own surfaces needs, and print resolves through the same module.
import { resolveContentCapabilities } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	isHostDeniedFeature,
	toFrameworkErrorModel,
	type CatalogOwnerContext,
	type CatalogOwnerSnapshot,
	type CatalogOwnerView,
	type ToolRegistration,
	type ToolRegistry,
	type ToolRegistryChangeEvent,
	type ToolSurfaceRenderContext,
	type ToolSurfaceRenderResult,
	type ToolSurfaceServices,
} from "@pie-players/pie-assessment-toolkit";

export type ToolSurfaceScope =
	| {
			kind: "content";
			ownerContext: CatalogOwnerContext;
	  }
	| {
			kind: "section";
			assessmentId: string;
			sectionId: string;
	  };

export interface ToolSurfaceHostInput {
	anchor: HTMLElement | null;
	surface: string;
	registry: ToolRegistry | null;
	services: ToolSurfaceServices;
	scope: ToolSurfaceScope;
}

export interface ToolSurfaceHostSnapshot {
	/** At least one capability is eligible, including one still loading. */
	mountable: boolean;
	/** At least one capability successfully mounted an element. */
	occupied: boolean;
}

export interface ToolSurfaceHost {
	update(input: ToolSurfaceHostInput): void;
	destroy(): void;
}

type LifecyclePhase = "resolve" | "load" | "render" | "sync" | "destroy";

interface EligibleCapability {
	registration: ToolRegistration;
	context: ToolSurfaceRenderContext;
	contextSignature: string | null;
}

interface MountedCapability {
	registration: ToolRegistration;
	element: HTMLElement;
	sync?: (context: ToolSurfaceRenderContext) => void;
	destroy?: () => void;
	context: ToolSurfaceRenderContext;
	contextSignature: string | null;
}

interface PendingLoad {
	registry: ToolRegistry;
	registration: ToolRegistration;
}

const SECTION_POLICY_LEVELS = ["section", "item", "passage"] as const;

function stableSerializableJson(value: unknown): string {
	const seen = new Set<object>();

	function normalize(current: unknown, path: string): unknown {
		if (
			current === null ||
			typeof current === "string" ||
			typeof current === "boolean"
		) {
			return current;
		}
		if (typeof current === "number") {
			return Number.isFinite(current) ? current : null;
		}
		if (typeof current === "undefined") {
			return undefined;
		}
		if (typeof current === "function" || typeof current === "symbol") {
			throw new TypeError(`${path} is not JSON-serializable`);
		}
		if (typeof current === "bigint") {
			throw new TypeError(`${path} is not JSON-serializable`);
		}
		if (typeof current !== "object") {
			throw new TypeError(`${path} is not JSON-serializable`);
		}

		if (seen.has(current)) {
			throw new TypeError(`${path} contains a cycle`);
		}
		seen.add(current);
		try {
			if (Array.isArray(current)) {
				return current.map(
					(entry, index) => normalize(entry, `${path}[${index}]`) ?? null,
				);
			}
			const prototype = Object.getPrototypeOf(current);
			if (prototype !== Object.prototype && prototype !== null) {
				throw new TypeError(
					`${path} must contain only plain objects and arrays`,
				);
			}
			const record = current as Record<string, unknown>;
			const normalized: Record<string, unknown> = {};
			for (const key of Object.keys(record).sort()) {
				const entry = normalize(record[key], `${path}.${key}`);
				if (entry !== undefined) normalized[key] = entry;
			}
			return normalized;
		} finally {
			seen.delete(current);
		}
	}

	const serialized = JSON.stringify(normalize(value, "content"));
	if (serialized === undefined) {
		throw new TypeError("content is not JSON-serializable");
	}
	return serialized;
}

function scopeEquals(left: ToolSurfaceScope, right: ToolSurfaceScope): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === "section" && right.kind === "section") {
		return (
			left.assessmentId === right.assessmentId &&
			left.sectionId === right.sectionId
		);
	}
	if (left.kind === "content" && right.kind === "content") {
		const leftOwner = left.ownerContext;
		const rightOwner = right.ownerContext;
		return (
			leftOwner.ownerKind === rightOwner.ownerKind &&
			leftOwner.assessmentId === rightOwner.assessmentId &&
			leftOwner.sectionId === rightOwner.sectionId &&
			leftOwner.canonicalItemId === rightOwner.canonicalItemId &&
			leftOwner.itemId === rightOwner.itemId &&
			leftOwner.passageId === rightOwner.passageId &&
			leftOwner.modelId === rightOwner.modelId
		);
	}
	return false;
}

function inputEquals(
	left: ToolSurfaceHostInput,
	right: ToolSurfaceHostInput,
): boolean {
	return (
		left.anchor === right.anchor &&
		left.surface === right.surface &&
		left.registry === right.registry &&
		left.services.toolkitCoordinator === right.services.toolkitCoordinator &&
		left.services.ttsService === right.services.ttsService &&
		left.services.catalogResolver === right.services.catalogResolver &&
		scopeEquals(left.scope, right.scope)
	);
}

function subscriptionInputsEqual(
	left: ToolSurfaceHostInput,
	right: ToolSurfaceHostInput,
): boolean {
	return (
		left.registry === right.registry &&
		left.services.toolkitCoordinator === right.services.toolkitCoordinator &&
		left.services.catalogResolver === right.services.catalogResolver &&
		scopeEquals(left.scope, right.scope)
	);
}

function contextSignature(context: ToolSurfaceRenderContext): string | null {
	try {
		return stableSerializableJson({
			toolId: context.toolId,
			featureId: context.featureId,
			surface: context.surface,
			parameters: context.parameters ?? null,
			content: context.content ?? null,
		});
	} catch {
		// Parameters are host/provider data and are not required to be serializable.
		// Fall back to syncing them on each invalidation instead of rejecting the tool.
		return null;
	}
}

function sameContext(
	mountedEntry: MountedCapability,
	nextEntry: EligibleCapability,
): boolean {
	if (
		mountedEntry.contextSignature === null ||
		nextEntry.contextSignature === null ||
		mountedEntry.contextSignature !== nextEntry.contextSignature
	) {
		return false;
	}
	return (
		mountedEntry.context.services.toolkitCoordinator ===
			nextEntry.context.services.toolkitCoordinator &&
		mountedEntry.context.services.ttsService ===
			nextEntry.context.services.ttsService &&
		mountedEntry.context.services.catalogResolver ===
			nextEntry.context.services.catalogResolver
	);
}

/** Create one lifecycle owner for one host surface anchor. */
export function createToolSurfaceHost(
	onSnapshot: (snapshot: ToolSurfaceHostSnapshot) => void,
): ToolSurfaceHost {
	let input: ToolSurfaceHostInput | null = null;
	let destroyed = false;
	let snapshot: ToolSurfaceHostSnapshot = { mountable: false, occupied: false };
	let unsubscribeRegistry: (() => void) | null = null;
	let unsubscribePolicy: (() => void) | null = null;
	let unsubscribeCatalogs: (() => void) | null = null;
	let catalogOwnerView: CatalogOwnerView | null = null;
	const mounted = new Map<string, MountedCapability>();
	const loadedRegistrations = new Map<string, ToolRegistration>();
	const pendingLoads = new Map<string, PendingLoad>();
	const reportedWarnings = new Set<string>();

	function publish(next: ToolSurfaceHostSnapshot): void {
		if (
			next.mountable === snapshot.mountable &&
			next.occupied === snapshot.occupied
		) {
			return;
		}
		snapshot = next;
		onSnapshot({ ...next });
	}

	function report(
		toolId: string,
		phase: LifecyclePhase,
		message: string,
		cause?: unknown,
	): void {
		const current = input;
		const key = `${current?.surface ?? "unknown"}\u0000${toolId}\u0000${phase}\u0000${message}`;
		if (reportedWarnings.has(key)) return;
		reportedWarnings.add(key);
		const model = toFrameworkErrorModel({
			kind: "tool-surface",
			severity: "warning",
			source: "pie-section-player/tool-surface-host",
			message,
			details: [
				`surface=${current?.surface ?? "unknown"}`,
				`toolId=${toolId}`,
				`phase=${phase}`,
			],
			recoverable: true,
			cause,
		});

		const coordinator = current?.services.toolkitCoordinator;
		if (typeof coordinator?.reportFrameworkError === "function") {
			try {
				coordinator.reportFrameworkError(model);
				return;
			} catch (error) {
				console.warn(
					"[pie-section-player] tool surface warning reporter failed:",
					error,
				);
			}
		}

		if (current?.anchor && typeof CustomEvent === "function") {
			current.anchor.dispatchEvent(
				new CustomEvent("framework-error", {
					detail: model,
					bubbles: true,
					composed: true,
				}),
			);
			return;
		}
		console.warn(`[pie-section-player] ${message}`, cause);
	}

	function unmount(toolId: string): void {
		const entry = mounted.get(toolId);
		if (!entry) return;
		mounted.delete(toolId);
		try {
			entry.destroy?.();
		} catch (error) {
			report(
				toolId,
				"destroy",
				`Tool "${toolId}" failed while leaving the "${input?.surface ?? "unknown"}" surface.`,
				error,
			);
		} finally {
			try {
				entry.element.remove();
			} catch (error) {
				// A custom element can override `remove`; use its parent as a fallback so
				// one broken teardown hook cannot strand the node or abort reconciliation.
				try {
					entry.element.parentNode?.removeChild(entry.element);
				} catch {
					// The warning below remains observable even if the DOM itself rejects
					// both removal paths.
				}
				report(
					toolId,
					"destroy",
					`Tool "${toolId}" failed DOM removal from the "${input?.surface ?? "unknown"}" surface.`,
					error,
				);
			}
		}
	}

	function unmountAll(): void {
		for (const toolId of [...mounted.keys()]) unmount(toolId);
	}

	function contentEligibility(
		current: ToolSurfaceHostInput,
		registration: ToolRegistration,
		catalogs: CatalogOwnerSnapshot | null,
	): EligibleCapability | null {
		if (current.scope.kind !== "content") return null;
		const coordinator = current.services.toolkitCoordinator;
		const [resolved] = resolveContentCapabilities({
			registrations: [registration],
			catalogs,
			// One decision per feature id, in the rule's three states. The scan across
			// a capability's support ids, the gate-only probe of its tool id, and
			// denial's precedence over both a grant and `resolvesWithoutGrant` live in
			// the rule, so this host and print cannot answer differently. All this
			// adapter owns is reading a `FeaturePolicyDecision`: `granted` is not
			// enough on its own, because a host gate and an unconfigured feature are
			// both `granted: false` and only one of them may be reopened by content.
			policyFor: (featureId) => {
				const decision = coordinator?.decideFeaturePolicy?.(featureId);
				if (isHostDeniedFeature(decision)) return { outcome: "denied" };
				if (decision?.granted === true) {
					return {
						outcome: "granted",
						featureId,
						parameters: decision.parameters,
					};
				}
				return { outcome: "silent" };
			},
			onError: (failed, phase, error) => {
				report(
					failed.toolId,
					"resolve",
					phase === "policy"
						? `Tool "${failed.toolId}" failed policy resolution for the "${current.surface}" surface.`
						: `Tool "${failed.toolId}" failed authored-content resolution for the "${current.surface}" surface.`,
					error,
				);
			},
		});
		if (!resolved) return null;

		// Serializability is this host's requirement rather than the rule's: it
		// re-resolves on every policy and catalog signal and compares the answer
		// structurally, so content it cannot compare would report a change on every
		// invalidation. Print resolves once and does not care.
		if (resolved.content !== null) {
			try {
				stableSerializableJson(resolved.content);
			} catch (error) {
				report(
					registration.toolId,
					"resolve",
					`Tool "${registration.toolId}" failed authored-content resolution for the "${current.surface}" surface.`,
					error,
				);
				return null;
			}
		}

		const context: ToolSurfaceRenderContext = {
			toolId: registration.toolId,
			featureId: resolved.featureId,
			surface: current.surface,
			parameters: resolved.parameters,
			content: resolved.content,
			services: current.services,
		};
		return {
			registration,
			context,
			contextSignature: contextSignature(context),
		};
	}

	function sectionEligibility(
		current: ToolSurfaceHostInput,
		registration: ToolRegistration,
	): EligibleCapability | null {
		if (current.scope.kind !== "section") return null;
		if (registration.requiresAuthoredContent) {
			report(
				registration.toolId,
				"resolve",
				`Tool "${registration.toolId}" declares authored content that the section-scoped "${current.surface}" surface cannot resolve.`,
			);
			return null;
		}

		const coordinator = current.services.toolkitCoordinator;
		if (!coordinator) return null;
		const supportIds = registration.pnpSupportIds?.length
			? registration.pnpSupportIds
			: [registration.toolId];
		let featureId = "";
		let parameters: unknown;

		try {
			if (registration.activation === "region") {
				for (const supportId of supportIds) {
					const decision = coordinator.decideFeaturePolicy?.(supportId);
					if (decision?.granted !== true) continue;
					featureId = supportId;
					parameters = decision.parameters;
					break;
				}
				if (!featureId) return null;
			} else {
				const scopeId = current.scope.sectionId || "*";
				for (const level of SECTION_POLICY_LEVELS) {
					const decision = coordinator.decideToolPolicy({
						level,
						scope: {
							level,
							scopeId,
							assessmentId: current.scope.assessmentId,
							sectionId: current.scope.sectionId || undefined,
						},
					});
					const entry = decision.visibleTools.find(
						(candidate) => candidate.toolId === registration.toolId,
					);
					if (!entry) continue;
					featureId = supportIds[0] ?? registration.toolId;
					parameters = entry.settings;
					break;
				}
				if (!featureId) return null;
			}
		} catch (error) {
			report(
				registration.toolId,
				"resolve",
				`Tool "${registration.toolId}" failed policy resolution for the "${current.surface}" surface.`,
				error,
			);
			return null;
		}

		const context: ToolSurfaceRenderContext = {
			toolId: registration.toolId,
			featureId,
			surface: current.surface,
			parameters,
			services: current.services,
		};
		return {
			registration,
			context,
			contextSignature: contextSignature(context),
		};
	}

	function resolveEligible(
		current: ToolSurfaceHostInput,
	): EligibleCapability[] {
		const registry = current.registry;
		if (!registry || !current.surface) return [];
		let registrations: ToolRegistration[];
		try {
			registrations = registry.getToolsBySurface(current.surface);
		} catch (error) {
			report(
				"registry",
				"resolve",
				`The tool registry failed discovery for the "${current.surface}" surface.`,
				error,
			);
			return [];
		}
		let catalogs: CatalogOwnerSnapshot | null = null;
		if (
			current.scope.kind === "content" &&
			catalogOwnerView &&
			registrations.some((registration) => registration.requiresAuthoredContent)
		) {
			try {
				catalogs = catalogOwnerView.snapshot();
			} catch (error) {
				report(
					"catalog-owner",
					"resolve",
					`Catalog owner resolution failed for the "${current.surface}" surface; catalog-dependent capabilities were omitted.`,
					error,
				);
			}
		}
		return registrations.flatMap((registration) => {
			const eligible =
				current.scope.kind === "content"
					? contentEligibility(current, registration, catalogs)
					: sectionEligibility(current, registration);
			return eligible ? [eligible] : [];
		});
	}

	function ensureLoaded(
		current: ToolSurfaceHostInput,
		entry: EligibleCapability,
	): boolean {
		const registry = current.registry;
		if (!registry) return false;
		const toolId = entry.registration.toolId;
		if (loadedRegistrations.get(toolId) === entry.registration) return true;

		const existing = pendingLoads.get(toolId);
		if (
			existing?.registry === registry &&
			existing.registration === entry.registration
		) {
			return false;
		}

		const promise = registry.ensureToolModuleLoaded(toolId);
		const pending: PendingLoad = { registry, registration: entry.registration };
		pendingLoads.set(toolId, pending);
		void promise
			.then(() => {
				if (pendingLoads.get(toolId) === pending) pendingLoads.delete(toolId);
				if (destroyed || input?.registry !== registry) return;
				if (registry.get(toolId) !== entry.registration) return;
				loadedRegistrations.set(toolId, entry.registration);
				reconcile();
			})
			.catch((error: unknown) => {
				if (pendingLoads.get(toolId) === pending) pendingLoads.delete(toolId);
				if (destroyed || input?.registry !== registry) return;
				if (registry.get(toolId) !== entry.registration) return;
				report(
					toolId,
					"load",
					`Tool "${toolId}" failed to load for the "${current.surface}" surface.`,
					error,
				);
			});
		return false;
	}

	function mount(
		current: ToolSurfaceHostInput,
		entry: EligibleCapability,
	): void {
		const registry = current.registry;
		const anchor = current.anchor;
		if (!registry || !anchor) return;
		const toolId = entry.registration.toolId;
		let rendered: ToolSurfaceRenderResult | null = null;
		try {
			rendered = registry.renderForSurface(toolId, entry.context);
			if (!rendered?.element) return;
			if (rendered.ariaLabel) {
				rendered.element.setAttribute("aria-label", rendered.ariaLabel);
			}
			anchor.appendChild(rendered.element);
			mounted.set(toolId, {
				registration: entry.registration,
				element: rendered.element,
				sync: rendered.sync,
				destroy: rendered.destroy,
				context: entry.context,
				contextSignature: entry.contextSignature,
			});
		} catch (error) {
			if (rendered?.element.parentNode === anchor) {
				try {
					anchor.removeChild(rendered.element);
				} catch {
					// Reporting the render failure is still preferable to escaping and
					// blocking the player when the capability returned an invalid node.
				}
			}
			report(
				toolId,
				"render",
				`Tool "${toolId}" failed to render into the "${current.surface}" surface.`,
				error,
			);
			return;
		}
	}

	function reconcile(): void {
		if (destroyed || !input) return;
		const current = input;
		const eligible = resolveEligible(current);
		const wanted = new Map(
			eligible.map((entry) => [entry.registration.toolId, entry]),
		);

		for (const [toolId, mountedEntry] of [...mounted]) {
			const next = wanted.get(toolId);
			if (
				!current.anchor ||
				!next ||
				next.registration !== mountedEntry.registration
			) {
				unmount(toolId);
			}
		}

		if (current.anchor && current.registry) {
			for (const entry of eligible) {
				const toolId = entry.registration.toolId;
				const existing = mounted.get(toolId);
				if (existing) {
					if (sameContext(existing, entry)) continue;
					try {
						existing.sync?.(entry.context);
						existing.context = entry.context;
						existing.contextSignature = entry.contextSignature;
					} catch (error) {
						report(
							toolId,
							"sync",
							`Tool "${toolId}" failed to synchronize in the "${current.surface}" surface.`,
							error,
						);
					}
					continue;
				}
				if (ensureLoaded(current, entry)) mount(current, entry);
			}

			// Re-appending existing nodes is identity-preserving and keeps registry
			// order even when lazy modules resolve in a different order.
			for (const entry of eligible) {
				const mountedEntry = mounted.get(entry.registration.toolId);
				if (!mountedEntry) continue;
				try {
					current.anchor.appendChild(mountedEntry.element);
				} catch (error) {
					report(
						entry.registration.toolId,
						"sync",
						`Tool "${entry.registration.toolId}" failed DOM reconciliation in the "${current.surface}" surface.`,
						error,
					);
				}
			}
		}

		publish({
			mountable: eligible.length > 0,
			occupied: Boolean(current.anchor && mounted.size > 0),
		});
	}

	function invalidate(): void {
		if (destroyed) return;
		reportedWarnings.clear();
		reconcile();
	}

	function handleRegistryChange(event: ToolRegistryChangeEvent): void {
		if (event.kind === "module-loaders") {
			for (const toolId of event.toolIds) loadedRegistrations.delete(toolId);
		}
		if (event.kind === "component-overrides") {
			unmountAll();
		}
		invalidate();
	}

	function detachSubscriptions(): void {
		for (const unsubscribe of [
			unsubscribeRegistry,
			unsubscribePolicy,
			unsubscribeCatalogs,
		]) {
			try {
				unsubscribe?.();
			} catch {
				// The dependency may already have been disposed.
			}
		}
		unsubscribeRegistry = null;
		unsubscribePolicy = null;
		unsubscribeCatalogs = null;
		catalogOwnerView = null;
	}

	function bindSubscriptions(current: ToolSurfaceHostInput): void {
		detachSubscriptions();
		unsubscribeRegistry =
			typeof current.registry?.onRegistryChange === "function"
				? current.registry.onRegistryChange(handleRegistryChange)
				: null;
		const coordinator = current.services.toolkitCoordinator;
		if (coordinator) {
			unsubscribePolicy =
				typeof coordinator.onPolicyChange === "function"
					? coordinator.onPolicyChange(invalidate)
					: null;
		}
		if (current.scope.kind === "content" && current.services.catalogResolver) {
			catalogOwnerView = current.services.catalogResolver.forOwner(
				current.scope.ownerContext,
			);
			unsubscribeCatalogs = catalogOwnerView.onChange(invalidate);
		}
	}

	return {
		update(nextInput): void {
			if (destroyed) return;
			const previous = input;
			let changed = true;
			try {
				changed = previous ? !inputEquals(previous, nextInput) : true;
			} catch {
				// Owner contexts are expected to be plain serializable records. Treat an
				// invalid one as changed so it cannot freeze the lifecycle.
				changed = true;
			}
			const subscriptionsChanged = previous
				? !subscriptionInputsEqual(previous, nextInput)
				: true;
			input = nextInput;
			if (subscriptionsChanged) bindSubscriptions(nextInput);
			if (!changed) return;
			reportedWarnings.clear();
			reconcile();
		},

		destroy(): void {
			if (destroyed) return;
			detachSubscriptions();
			unmountAll();
			destroyed = true;
			input = null;
			pendingLoads.clear();
			loadedRegistrations.clear();
		},
	};
}
