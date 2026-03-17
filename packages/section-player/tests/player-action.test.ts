import { describe, expect, test } from "bun:test";
import { createPlayerAction } from "../src/components/shared/player-action";

function createFakeElement() {
	const attrs = new Map<string, string>();
	const node: Record<string, unknown> = {
		setAttribute(name: string, value: string) {
			attrs.set(name, value);
		},
		removeAttribute(name: string) {
			attrs.delete(name);
		},
		getAttribute(name: string) {
			return attrs.get(name) ?? null;
		},
	};
	return { node: node as HTMLElement & Record<string, unknown>, attrs };
}

describe("createPlayerAction", () => {
	test("removes stale attributes and props on update", () => {
		const { node } = createFakeElement();
		const action = createPlayerAction({
			stateKey: "__testPlayerAction",
			includeSessionRefInState: false,
		});
		const instance = action(node, {
			config: { id: "cfg-1" },
			env: { mode: "gather" },
			attributes: { strategy: "iife", "data-test": "v1" },
			props: {
				loaderConfig: { trackPageActions: true },
				customHook: "initial",
			},
		});

		instance.update({
			config: { id: "cfg-2" },
			env: { mode: "view" },
			attributes: { strategy: "esm" },
			props: {
				loaderConfig: { trackPageActions: false },
			},
		});

		expect((node as any).getAttribute("strategy")).toBe("esm");
		expect((node as any).getAttribute("data-test")).toBe(null);
		expect((node as any).loaderConfig).toEqual({ trackPageActions: false });
		expect((node as any).customHook).toBeUndefined();
	});
});
