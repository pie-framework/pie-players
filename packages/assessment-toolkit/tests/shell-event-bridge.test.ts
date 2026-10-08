import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	PIE_INTERNAL_CONTENT_LOADED_EVENT,
	PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
	PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
	PIE_ITEM_SESSION_CHANGED_EVENT,
} from "../src/runtime/registration-events.js";
import {
	createShellEventBridge,
	type ShellEventBridgeMode,
} from "../src/runtime/shell-event-bridge.js";

beforeAll(() => {
	GlobalRegistrator.register();
});

afterAll(async () => {
	await GlobalRegistrator.unregister();
});

const setup = (options: {
	mode: ShellEventBridgeMode;
	kind?: "item" | "passage";
}) => {
	let mode = options.mode;
	const outer = document.createElement("div");
	const host = document.createElement("div");
	const player = document.createElement("div");
	host.appendChild(player);
	outer.appendChild(host);
	document.body.appendChild(outer);

	const sent: Array<{ type: string; detail: Record<string, unknown> }> = [];
	const reachedOuter: string[] = [];
	for (const type of [
		"session-changed",
		"load-complete",
		"player-error",
		PIE_ITEM_SESSION_CHANGED_EVENT,
	]) {
		outer.addEventListener(type, () => reachedOuter.push(type));
	}
	const bridge = createShellEventBridge({
		host,
		kind: options.kind ?? "item",
		identity: () => ({ itemId: "item-1", contentKind: "assessment-item" }),
		mode: () => mode,
		send: (type, detail) =>
			sent.push({ type, detail: detail as Record<string, unknown> }),
	});
	const fire = (type: string, detail: unknown) =>
		player.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	return {
		sent,
		reachedOuter,
		fire,
		bridge,
		setMode: (next: ShellEventBridgeMode) => {
			mode = next;
		},
		dispose: () => {
			bridge.disconnect();
			outer.remove();
		},
	};
};

const response = (value: string) => ({
	session: { id: "s1", data: [{ id: "q1", value }] },
});

describe("shell event bridge", () => {
	test("in a section the player's events stop at the shell and travel as internal events", () => {
		const shell = setup({ mode: "section" });
		shell.fire("load-complete", { ok: true });
		shell.fire("session-changed", response("a"));
		shell.fire("player-error", { message: "boom" });

		expect(shell.reachedOuter).toEqual([PIE_ITEM_SESSION_CHANGED_EVENT]);
		expect(shell.sent.map((entry) => entry.type)).toEqual([
			PIE_INTERNAL_CONTENT_LOADED_EVENT,
			PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
			PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
		]);
		expect(shell.sent[0]?.detail).toMatchObject({
			itemId: "item-1",
			canonicalItemId: "item-1",
			contentKind: "assessment-item",
		});
		shell.dispose();
	});

	test("a repeated session is forwarded once", () => {
		const shell = setup({ mode: "section" });
		shell.fire("session-changed", response("a"));
		shell.fire("session-changed", response("a"));
		shell.fire("session-changed", response("b"));

		expect(
			shell.sent.filter(
				(entry) => entry.type === PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
			),
		).toHaveLength(2);
		shell.dispose();
	});

	test("without a section the player's events pass and only loads and errors are sent", () => {
		const shell = setup({ mode: "plain" });
		shell.fire("load-complete", { ok: true });
		shell.fire("session-changed", response("a"));
		shell.fire("player-error", { message: "boom" });

		expect(shell.reachedOuter).toEqual([
			"load-complete",
			"session-changed",
			"player-error",
		]);
		expect(shell.sent.map((entry) => entry.type)).toEqual([
			PIE_INTERNAL_CONTENT_LOADED_EVENT,
			PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
		]);
		shell.dispose();
	});

	test("the mode is read as each event arrives", () => {
		const shell = setup({ mode: "plain" });
		shell.fire("session-changed", response("a"));
		shell.setMode("section");
		shell.fire("session-changed", response("b"));

		expect(shell.reachedOuter).toEqual([
			"session-changed",
			PIE_ITEM_SESSION_CHANGED_EVENT,
		]);
		shell.dispose();
	});

	test("a passage's session stops at the shell and is not forwarded", () => {
		const shell = setup({ mode: "section", kind: "passage" });
		shell.fire("session-changed", response("a"));

		expect(shell.reachedOuter).toEqual([]);
		expect(shell.sent).toEqual([]);
		shell.dispose();
	});

	test("after disconnect the shell no longer translates", () => {
		const shell = setup({ mode: "section" });
		shell.bridge.disconnect();
		shell.fire("load-complete", { ok: true });

		expect(shell.sent).toEqual([]);
		expect(shell.reachedOuter).toEqual(["load-complete"]);
	});
});
