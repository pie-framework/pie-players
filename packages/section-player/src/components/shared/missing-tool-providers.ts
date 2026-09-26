/**
 * Placed tools whose provider a host-supplied coordinator has not registered.
 *
 * A coordinator registers tool providers only from its own `toolRegistry`, while
 * this player's toolbars render from the section player's registry. A host
 * coordinator built without that registry sits behind buttons nothing serves — a
 * calculator that never opens — and the only other trace is the provider
 * registry's error on each click.
 */

import type {
	ToolkitCoordinatorApi,
	ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { resolveToolProviderId } from "@pie-players/pie-assessment-toolkit/tools/internal";

/**
 * Tool ids already reported, per coordinator. Module-scoped so a host that
 * remounts the player around one coordinator hears about each tool once.
 */
const reportedToolIds = new WeakMap<object, Set<string>>();

/** A check polls readiness every 100 ms and gives up after 30 s. */
const READINESS_POLL_INTERVAL_MS = 100;
const READINESS_POLL_LIMIT = 300;

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
			`[pie-section-player] Placed tool "${toolId}" uses provider "${providerId}", which the host-supplied coordinator (runtime.coordinator) has not registered. A coordinator registers tool providers only from its own \`toolRegistry\`, never from the section player's: construct it with the registry the section player renders from — for the packaged capability set, \`createPackagedToolRegistry()\` from "@pie-players/pie-default-tool-loaders". Reported once per tool and coordinator.`,
		);
	}
}

/**
 * Check `coordinator` now and whenever its policy inputs change, since placement
 * can. A check runs once the coordinator reports ready: its providers have
 * registered by then, and a text-to-speech reconfiguration, which unregisters and
 * re-registers that provider, holds readiness until it is back. Readiness is
 * polled because `waitUntilReady()` would start initialization a lazy
 * coordinator defers, and retry one that failed. Returns the teardown.
 */
export function watchMissingToolProviders(
	coordinator: ToolkitCoordinatorApi,
	toolRegistry: ToolRegistry,
): () => void {
	let stopped = false;
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	const stopPolling = () => {
		clearInterval(pollTimer);
		pollTimer = undefined;
	};
	const reportIfReady = (): boolean => {
		let ready = false;
		try {
			ready = coordinator.isReady();
		} catch {
			stopPolling();
			return true;
		}
		if (!ready) return false;
		stopPolling();
		reportMissingToolProviders(coordinator, toolRegistry);
		return true;
	};
	const check = () => {
		if (stopped || reportIfReady() || pollTimer !== undefined) return;
		let polls = 0;
		pollTimer = setInterval(() => {
			polls += 1;
			if (!reportIfReady() && polls >= READINESS_POLL_LIMIT) stopPolling();
		}, READINESS_POLL_INTERVAL_MS);
	};
	const unsubscribe = coordinator.onPolicyChange((event) => {
		if (event.reason === "disposed") {
			stopPolling();
			return;
		}
		// The change is dispatched mid-update; checking after it lets a
		// reconfiguration it starts take readiness down first.
		queueMicrotask(check);
	});
	check();
	return () => {
		stopped = true;
		stopPolling();
		unsubscribe();
	};
}
