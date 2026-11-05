import { describe, expect, test } from "bun:test";
import { flushSync } from "svelte";
import type { BackendConfig } from "../src/types";
import { mountOrchestrator } from "./support/orchestrator-root.svelte";

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/** A delivery player whose session can be switched to the item's correct responses. */
function setup(debounceMs = 0) {
	const writes: string[] = [];
	let correctResponses = false;
	const backend = {
		delivery: {
			enabled: true,
			itemId: "item-1",
			sessionId: "session-1",
			autosave: { debounceMs },
			client: {
				async load() {
					return { item: { markup: "", elements: {}, models: [] } };
				},
				async saveSession() {
					writes.push("save");
				},
				async score() {
					writes.push("score");
					return {};
				},
			},
		},
	} as unknown as BackendConfig;
	const { orchestrator, dispose } = mountOrchestrator({
		getBackend: () => backend,
		getItemConfig: () => null,
		getPassageConfig: () => null,
		getEnv: () => ({ mode: "gather", role: "student" }),
		getSessionContainer: () => ({ id: "session-1", data: [] }),
		holdsCorrectResponses: () => correctResponses,
		loadPlayerConfig: async () => true,
		dispatchPlayerEvent: () => {},
		applyRefreshedConfigs: async () => {},
	});
	flushSync();
	return {
		orchestrator,
		dispose,
		writes,
		setCorrectResponses: (next: boolean) => {
			correctResponses = next;
		},
	};
}

describe("a session holding the item's correct responses", () => {
	test("schedules no autosave and flushes none", async () => {
		const player = setup();
		player.setCorrectResponses(true);
		player.orchestrator.scheduleAutosave();
		player.orchestrator.flushPendingSave({ keepalive: true });
		await wait();
		expect(player.writes).toEqual([]);
		player.dispose();
	});

	test("drops an autosave scheduled before the correct responses arrived", async () => {
		const player = setup(10);
		player.orchestrator.scheduleAutosave();
		player.setCorrectResponses(true);
		await wait(30);
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.writes).toEqual([]);
		player.dispose();
	});

	test("rejects a host save or score", async () => {
		const player = setup();
		player.setCorrectResponses(true);
		await expect(player.orchestrator.saveSession()).rejects.toThrow(
			"correct responses",
		);
		await expect(player.orchestrator.score()).rejects.toThrow(
			"correct responses",
		);
		expect(player.writes).toEqual([]);
		player.dispose();
	});

	test("saves again once the session is the learner's", async () => {
		const player = setup();
		player.setCorrectResponses(true);
		player.orchestrator.scheduleAutosave();
		player.setCorrectResponses(false);
		player.orchestrator.scheduleAutosave();
		await wait();
		await player.orchestrator.saveSession();
		expect(player.writes).toEqual(["save", "save"]);
		player.dispose();
	});
});
