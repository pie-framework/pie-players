import { describe, expect, test } from "bun:test";
import { flushSync } from "svelte";
import type { BackendConfig } from "../src/types";
import { mountOrchestrator } from "./support/orchestrator-root.svelte";

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A player whose autosave client fails the calls listed in `failCalls`
 * (1-based). `answer` is the session the next save reads.
 */
function setup(failCalls: number[], slowCalls: number[] = []) {
	const saves: string[] = [];
	const errors: string[] = [];
	let call = 0;
	let answer = "A";
	const backend = {
		delivery: {
			enabled: true,
			itemId: "item-1",
			sessionId: "session-1",
			autosave: { debounceMs: 0 },
			client: {
				async load() {
					return { item: { markup: "", elements: {}, models: [] } };
				},
				async saveSession(context: { session: { data: unknown[] } }) {
					call += 1;
					const thisCall = call;
					if (slowCalls.includes(thisCall)) await wait(20);
					if (failCalls.includes(thisCall)) throw new Error("offline");
					saves.push(JSON.stringify(context.session.data));
				},
			},
		},
	} as unknown as BackendConfig;
	const { orchestrator, dispose } = mountOrchestrator({
		getBackend: () => backend,
		getItemConfig: () => null,
		getPassageConfig: () => null,
		getEnv: () => ({ mode: "gather", role: "student" }),
		getSessionContainer: () => ({ id: "session-1", data: [answer] }),
		loadPlayerConfig: async () => true,
		dispatchPlayerEvent: (event) => {
			if (event.type === "backend-error") errors.push(event.type);
		},
		applyRefreshedConfigs: async () => {},
	});
	flushSync();
	return {
		orchestrator,
		dispose,
		saves,
		errors,
		calls: () => call,
		setAnswer: (next: string) => {
			answer = next;
		},
	};
}

describe("a failed autosave", () => {
	test("is sent once more at the next flush when nothing changed after it", async () => {
		const player = setup([1]);
		player.orchestrator.scheduleAutosave();
		await wait();
		expect(player.errors).toEqual(["backend-error"]);
		expect(player.saves).toEqual([]);

		player.orchestrator.flushPendingSave({ keepalive: true });
		await wait();
		expect(player.saves).toEqual(['["A"]']);
		player.dispose();
	});

	test("is retried only once", async () => {
		const player = setup([1, 2]);
		player.orchestrator.scheduleAutosave();
		await wait();
		player.orchestrator.flushPendingSave();
		await wait();
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.calls()).toBe(2);
		expect(player.errors).toEqual(["backend-error", "backend-error"]);
		player.dispose();
	});

	test("is not resent once a later save for the same session succeeded", async () => {
		const player = setup([1]);
		player.orchestrator.scheduleAutosave();
		await wait();
		player.setAnswer("B");
		player.orchestrator.scheduleAutosave();
		await wait();
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.saves).toEqual(['["B"]']);
		player.dispose();
	});

	test("is dropped when it fails after a newer save was queued", async () => {
		// Resending it would land the older session after the newer one.
		const player = setup([1], [1]);
		player.orchestrator.scheduleAutosave();
		await wait(2);
		player.setAnswer("B");
		player.orchestrator.scheduleAutosave();
		await wait(40);
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.saves).toEqual(['["B"]']);
		player.dispose();
	});

	test("resends the session it failed with, not a later one", async () => {
		// A repoint flush can run after the player already holds the next
		// item's session; the retry belongs to the item whose save failed.
		const player = setup([1]);
		player.orchestrator.scheduleAutosave();
		await wait();
		player.setAnswer("next item");
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.saves).toEqual(['["A"]']);
		player.dispose();
	});
});
