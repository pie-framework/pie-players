import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { ContextProvider, createContext } = await import(
	"@pie-players/pie-context"
);
await import("../calculator-element.js");

const runtimeContext = createContext<unknown>(
	Symbol.for("pie.assessmentToolkit.runtimeContext"),
);

interface FakeCalculator {
	provider: { attribution: null };
	destroyed: boolean;
	destroy(): void;
	resize(): void;
	focus(): void;
}

function fakeToolProvider(label: string) {
	let ready = true;
	const calculators: FakeCalculator[] = [];
	return {
		calculators,
		isReady: () => ready,
		destroy: () => {
			ready = false;
		},
		createInstance: async () => ({
			createCalculator: async (_type: string, mount: HTMLElement) => {
				const surface = document.createElement("div");
				surface.dataset.provider = label;
				mount.append(surface);
				const calculator: FakeCalculator = {
					provider: { attribution: null },
					destroyed: false,
					destroy() {
						calculator.destroyed = true;
					},
					resize() {},
					focus() {},
				};
				calculators.push(calculator);
				return calculator;
			},
		}),
	};
}

async function settle(rounds = 8): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function mountCalculator(firstProvider: ReturnType<typeof fakeToolProvider>) {
	let current = firstProvider;
	const listeners = new Set<() => void>();
	const toolkitCoordinator = {
		ensureProviderReady: async () => current,
		onPolicyChange: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	const host = document.createElement("div");
	document.body.append(host);
	new ContextProvider(host, {
		context: runtimeContext,
		initialValue: { toolkitCoordinator },
	}).connect();
	const element = document.createElement("pie-tool-calculator");
	element.setAttribute("tool-id", "calculator:item:item-1");
	element.setAttribute("visible", "true");
	host.append(element);
	return {
		element,
		surface: () =>
			element.querySelector<HTMLElement>("[data-provider]")?.dataset.provider,
		/** What `updateToolConfig` does: register the new provider, destroy the old. */
		replaceProvider(next: ReturnType<typeof fakeToolProvider>) {
			current.destroy();
			current = next;
			for (const listener of listeners) listener();
		},
		policyChange() {
			for (const listener of listeners) listener();
		},
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("an open calculator remounts on the provider that replaced its own", async () => {
	const first = fakeToolProvider("first");
	const second = fakeToolProvider("second");
	const mounted = mountCalculator(first);
	await settle();
	expect(mounted.surface()).toBe("first");

	mounted.replaceProvider(second);
	await settle();

	expect(first.calculators[0]?.destroyed).toBe(true);
	expect(second.calculators).toHaveLength(1);
	expect(mounted.surface()).toBe("second");
});

test("a policy change that keeps the provider leaves the calculator mounted", async () => {
	const only = fakeToolProvider("only");
	const mounted = mountCalculator(only);
	await settle();

	mounted.policyChange();
	await settle();

	expect(only.calculators).toHaveLength(1);
	expect(only.calculators[0]?.destroyed).toBe(false);
	expect(mounted.surface()).toBe("only");
});
