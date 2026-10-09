/**
 * `<pie-item-scope>` removed from the page still reaches its runtime: the
 * element's pending session commits on teardown, and the commit and the
 * unregister arrive at the toolkit although the scope has left the document.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const settle = async () => {
	for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

test("unmounting the scope delivers the pending session commit and the unregister", async () => {
	const { ContextProvider } = await import("@pie-players/pie-context");
	const { assessmentToolkitHostRuntimeContext } = await import(
		"../src/context/assessment-toolkit-context.js"
	);
	const {
		PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
	} = await import("../src/runtime/registration-events.js");
	await import("../src/components/ItemScope.svelte");

	class PendingDelivery extends HTMLElement {
		session: unknown = { id: "s1", data: [] };
		model: unknown = {};
		pending = false;
		commitPendingSession() {
			if (!this.pending) return false;
			this.pending = false;
			this.dispatchEvent(
				new CustomEvent("session-changed", {
					bubbles: true,
					composed: true,
					detail: { session: this.session, complete: true },
				}),
			);
			return true;
		}
	}
	customElements.define("pending-delivery-el", PendingDelivery);

	const toolkit = document.body.appendChild(document.createElement("div"));
	const provider = new ContextProvider(toolkit, {
		context: assessmentToolkitHostRuntimeContext,
		initialValue: {
			runtimeId: "runtime-1",
			coordinator: {} as never,
			sectionBound: true,
			eventTarget: toolkit,
		},
	});
	provider.connect();
	const heard: string[] = [];
	toolkit.addEventListener(PIE_REGISTER_EVENT, (event) =>
		heard.push(`register:${(event as CustomEvent).detail.itemId}`),
	);
	toolkit.addEventListener(PIE_UNREGISTER_EVENT, (event) =>
		heard.push(`unregister:${(event as CustomEvent).detail.itemId}`),
	);
	toolkit.addEventListener(PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT, (event) =>
		heard.push(`session:${JSON.stringify((event as CustomEvent).detail)}`),
	);

	const scope = document.createElement("pie-item-scope") as HTMLElement & {
		itemId: string;
	};
	scope.itemId = "q1";
	const element = document.createElement(
		"pending-delivery-el",
	) as PendingDelivery;
	scope.appendChild(element);
	toolkit.appendChild(scope);
	await settle();
	expect(heard).toEqual(["register:q1"]);

	element.session = { id: "s1", data: [{ id: "e", value: ["B"] }] };
	element.pending = true;
	toolkit.removeChild(scope);
	await settle();

	expect(element.pending).toBe(false);
	expect(heard[0]).toBe("register:q1");
	expect(heard.at(-1)).toBe("unregister:q1");
	const sessions = heard.filter((entry) => entry.startsWith("session:"));
	expect(sessions).toHaveLength(1);
	expect(sessions[0]).toContain('"B"');
	expect(sessions[0]).toContain('"runtimeId":"runtime-1"');
	provider.disconnect();
});
