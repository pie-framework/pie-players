import { describe, expect, test } from "bun:test";
import { flushSync } from "svelte";
import type { BackendConfig } from "../src/types";
import { mountOrchestrator } from "./support/orchestrator-root.svelte";

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

type Context = { session: { data: unknown[] } };

/**
 * A player whose save, model and score calls log when they start and land.
 * The first save takes `firstSaveMs`; `failScore` makes score reject.
 */
function setup(options: {
	firstSaveMs?: number;
	failScore?: boolean;
	withModel?: boolean;
}) {
	const log: string[] = [];
	let saves = 0;
	let answer = "A";
	const record = (operation: string, context: Context) =>
		`${operation}:${JSON.stringify(context.session.data)}`;
	const client: Record<string, unknown> = {
		async load() {
			return { item: { markup: "", elements: {}, models: [] } };
		},
		async saveSession(context: Context) {
			saves += 1;
			log.push(`start ${record("save", context)}`);
			if (saves === 1 && options.firstSaveMs) await wait(options.firstSaveMs);
			log.push(`land ${record("save", context)}`);
		},
		async score(context: Context) {
			log.push(`start ${record("score", context)}`);
			if (options.failScore) throw new Error("offline");
			return { score: 1 };
		},
	};
	if (options.withModel) {
		client.model = async (context: Context) => {
			log.push(`start ${record("model", context)}`);
			return { models: [] };
		};
	}
	const backend = {
		delivery: {
			enabled: true,
			itemId: "item-1",
			sessionId: "session-1",
			autosave: { enabled: false },
			client,
		},
	} as unknown as BackendConfig;
	const { orchestrator, dispose } = mountOrchestrator({
		getBackend: () => backend,
		getItemConfig: () =>
			({ markup: "", elements: {}, models: [] }) as never,
		getPassageConfig: () => null,
		getEnv: () => ({ mode: "gather", role: "student" }),
		getSessionContainer: () => ({ id: "session-1", data: [answer] }),
		loadPlayerConfig: async () => true,
		dispatchPlayerEvent: () => {},
		applyRefreshedConfigs: async () => {},
	});
	return {
		orchestrator,
		dispose,
		log,
		setAnswer: (next: string) => {
			answer = next;
		},
	};
}

describe("session writes", () => {
	test("a score issued while a save is in flight starts after the save lands", async () => {
		const player = setup({ firstSaveMs: 30 });
		flushSync();
		const save = player.orchestrator.saveSession();
		player.setAnswer("B");
		await player.orchestrator.score();
		await save;
		expect(player.log).toEqual([
			'start save:["A"]',
			'land save:["A"]',
			'start score:["B"]',
		]);
		player.dispose();
	});

	test("a model refresh queued behind a save starts after the save lands", async () => {
		const player = setup({ firstSaveMs: 30, withModel: true });
		// The refresh is queued in a microtask after mount; the save is queued first.
		const save = player.orchestrator.saveSession();
		flushSync();
		await save;
		await wait();
		expect(player.log.slice(0, 3)).toEqual([
			'start save:["A"]',
			'land save:["A"]',
			'start model:["A"]',
		]);
		player.dispose();
	});

	test("a host save carries the session as it stood at the call", async () => {
		const player = setup({ firstSaveMs: 30 });
		flushSync();
		const first = player.orchestrator.saveSession();
		player.setAnswer("B");
		const second = player.orchestrator.saveSession();
		player.setAnswer("C");
		await Promise.all([first, second]);
		expect(player.log.filter((entry) => entry.startsWith("land"))).toEqual([
			'land save:["A"]',
			'land save:["B"]',
		]);
		player.dispose();
	});

	test("the session of a failed score is resent once at the next flush", async () => {
		const player = setup({ failScore: true });
		flushSync();
		await expect(player.orchestrator.score()).rejects.toThrow("offline");
		player.orchestrator.flushPendingSave();
		await wait();
		player.orchestrator.flushPendingSave();
		await wait();
		expect(player.log).toEqual([
			'start score:["A"]',
			'start save:["A"]',
			'land save:["A"]',
		]);
		player.dispose();
	});
});
