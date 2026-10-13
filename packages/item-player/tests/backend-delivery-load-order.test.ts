import { describe, expect, test } from "bun:test";
import { flushSync } from "svelte";
import type { BackendConfig } from "../src/types";
import { mountOrchestrator } from "./support/orchestrator-root.svelte";

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

const item = { markup: "", elements: {}, models: [] };

/** A player whose delivery loads land only when the test resolves them, in any order. */
function setup() {
	const pendingLoads: Array<(sessionId: string) => void> = [];
	const loadedSessions: unknown[] = [];
	const backend = {
		delivery: {
			enabled: true,
			itemId: "item-1",
			sessionId: "session-1",
			autosave: { enabled: false },
			client: {
				load: () =>
					new Promise((resolve) => {
						pendingLoads.push((label) =>
							resolve({ item, session: { id: label, data: [] } }),
						);
					}),
			},
		},
	} as unknown as BackendConfig;
	const { orchestrator, dispose } = mountOrchestrator({
		getBackend: () => backend,
		getItemConfig: () => item as never,
		getPassageConfig: () => null,
		getEnv: () => ({ mode: "gather", role: "student" }),
		getSessionContainer: () => ({ id: "session-1", data: [] }),
		loadPlayerConfig: async () => true,
		dispatchPlayerEvent: (event) => {
			if (event.type === "backend-load-complete") {
				loadedSessions.push((event as CustomEvent).detail.session);
			}
		},
		applyRefreshedConfigs: async () => {},
	});
	return { orchestrator, dispose, pendingLoads, loadedSessions };
}

describe("delivery loads", () => {
	test("an older load landing after a newer one is dropped", async () => {
		const player = setup();
		flushSync();
		await wait();
		player.pendingLoads[0]?.("initial");
		await wait();

		const older = player.orchestrator.load("delivery");
		const newer = player.orchestrator.load("delivery");
		player.pendingLoads[2]?.("newer");
		await newer;
		player.pendingLoads[1]?.("older");
		await older;

		expect(player.orchestrator.sessionOverride).toEqual({ id: "newer", data: [] });
		expect(player.loadedSessions).toEqual([
			{ id: "initial", data: [] },
			{ id: "newer", data: [] },
		]);
		player.dispose();
	});
});
