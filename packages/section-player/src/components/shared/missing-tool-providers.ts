/**
 * Placed tools whose provider a host-supplied coordinator has not registered.
 *
 * A coordinator constructed with a `toolRegistry` registers tool providers only
 * from it, while this player's toolbars render from the section player's
 * registry. One that lacks a placed tool's registration sits behind a button
 * nothing serves — a calculator that never opens — and the only other trace is
 * the provider registry's error on each click. A coordinator constructed without
 * a registry adopts the section player's and is not affected.
 */

import type {
	ToolkitCoordinatorApi,
	ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { resolveToolProviderId } from "@pie-players/pie-assessment-toolkit/tools/registration";

/**
 * Tool ids already reported, per coordinator. Module-scoped so a host that
 * remounts the player around one coordinator hears about each tool once.
 */
const reportedToolIds = new WeakMap<object, Set<string>>();

/**
 * Warn once per placed tool whose registration carries a provider the coordinator
 * has not registered. Reads the coordinator's current placement and providers, so
 * call it only once the coordinator reports ready.
 */
export function reportMissingToolProviders(
	coordinator: ToolkitCoordinatorApi,
	toolRegistry: ToolRegistry,
): void {
	let placed: Set<string>;
	try {
		const placement = coordinator.getPolicyInputs().tools.placement;
		placed = new Set(
			Object.values(placement).flatMap((toolIds) =>
				Array.isArray(toolIds) ? toolIds : [],
			),
		);
	} catch {
		return;
	}
	let reported = reportedToolIds.get(coordinator);
	for (const toolId of placed) {
		if (reported?.has(toolId)) continue;
		const registration = toolRegistry.get(toolId);
		if (!registration?.provider) continue;
		let providerId: string | null;
		try {
			const config = coordinator.getToolConfig(toolId) ?? undefined;
			if (config?.enabled === false) continue;
			providerId = resolveToolProviderId(registration, config);
		} catch {
			// An id or provider config the coordinator rejects is its validator's to
			// report.
			continue;
		}
		if (!providerId || coordinator.toolProviderRegistry.has(providerId)) continue;
		if (!reported) {
			reported = new Set();
			reportedToolIds.set(coordinator, reported);
		}
		reported.add(toolId);
		console.warn(
			`[pie-section-player] Placed tool "${toolId}" uses provider "${providerId}", which the host-supplied coordinator (runtime.coordinator) has not registered. That coordinator registers tool providers only from the \`toolRegistry\` it was constructed with: include this tool's registration there — for the packaged capability set, \`createPackagedToolRegistry()\` from "@pie-players/pie-default-tool-loaders" — or construct it without one to use the section player's. Reported once per tool and coordinator.`,
		);
	}
}

/**
 * Check `coordinator` once it reports ready, and again whenever readiness or its
 * policy inputs change, since placement can. Its providers have registered by
 * then, and a text-to-speech reconfiguration, which unregisters and re-registers
 * that provider, holds readiness until it is back. `waitUntilReady()` is not
 * awaited: it would start text-to-speech a lazy coordinator defers, and retry
 * one that failed. Returns the teardown.
 */
export function watchMissingToolProviders(
	coordinator: ToolkitCoordinatorApi,
	toolRegistry: ToolRegistry,
): () => void {
	let stopped = false;
	const check = () => {
		if (stopped) return;
		let ready = false;
		try {
			ready = coordinator.isReady();
		} catch {
			return;
		}
		if (ready) reportMissingToolProviders(coordinator, toolRegistry);
	};
	const stopFollowingReadiness = coordinator.onReadyChange?.(check);
	const stopFollowingPolicy = coordinator.onPolicyChange((event) => {
		if (event.reason === "disposed") {
			stopped = true;
			return;
		}
		// The change is dispatched mid-update; checking after it lets a
		// reconfiguration it starts take readiness down first.
		queueMicrotask(check);
	});
	check();
	return () => {
		stopped = true;
		stopFollowingReadiness?.();
		stopFollowingPolicy();
	};
}
