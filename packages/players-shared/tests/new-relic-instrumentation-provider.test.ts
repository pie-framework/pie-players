import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { NewRelicInstrumentationProvider } from "../src/instrumentation/providers/NewRelicInstrumentationProvider";

type AgentGlobals = { newrelic?: unknown; NREUM?: unknown };

/** Records what reaches an agent API object. */
function createAgent(calls: string[], label = "") {
	return {
		addPageAction: (name: string) =>
			calls.push(`${label}addPageAction ${name}`),
		noticeError: (error: Error) =>
			calls.push(`${label}noticeError ${error.message}`),
	};
}

function agentGlobals(): AgentGlobals {
	return window as unknown as AgentGlobals;
}

describe("NewRelicInstrumentationProvider readiness", () => {
	beforeAll(() => {
		if (typeof (globalThis as { window?: unknown }).window === "undefined") {
			GlobalRegistrator.register();
		}
	});

	beforeEach(() => {
		delete agentGlobals().newrelic;
		delete agentGlobals().NREUM;
	});

	afterAll(() => {
		delete agentGlobals().newrelic;
		delete agentGlobals().NREUM;
		if (GlobalRegistrator.isRegistered) {
			GlobalRegistrator.unregister();
		}
	});

	test("sends to an agent that loads after initialize()", async () => {
		const provider = new NewRelicInstrumentationProvider();
		await provider.initialize();
		expect(provider.isReady()).toBe(false);

		const calls: string[] = [];
		agentGlobals().newrelic = createAgent(calls);

		expect(provider.isReady()).toBe(true);
		provider.trackEvent("pie-resource-load", { component: "resource-monitor" });
		provider.trackError(new Error("late agent"), {
			component: "pie-item-player",
		});
		expect(calls).toEqual([
			"addPageAction pie-resource-load",
			"noticeError late agent",
		]);
	});

	test("waits while NREUM is only the install snippet's configuration container", async () => {
		const container: Record<string, unknown> = { init: {}, loader_config: {} };
		agentGlobals().NREUM = container;
		const provider = new NewRelicInstrumentationProvider();
		await provider.initialize();
		expect(provider.isReady()).toBe(false);

		const calls: string[] = [];
		Object.assign(container, createAgent(calls));

		expect(provider.isReady()).toBe(true);
		provider.trackEvent("pie-resource-retry", {});
		expect(calls).toEqual(["addPageAction pie-resource-retry"]);
	});

	test("uses the API on NREUM when newrelic does not carry it", async () => {
		const calls: string[] = [];
		agentGlobals().newrelic = { noticeError: () => calls.push("stub") };
		agentGlobals().NREUM = createAgent(calls);
		const provider = new NewRelicInstrumentationProvider();
		await provider.initialize();

		provider.trackError(new Error("failed"), { component: "pie-item-player" });
		expect(calls).toEqual(["noticeError failed"]);
	});

	test("looks the agent up on every call", async () => {
		const calls: string[] = [];
		agentGlobals().newrelic = createAgent(calls, "first ");
		const provider = new NewRelicInstrumentationProvider();
		await provider.initialize();
		provider.trackEvent("one", {});

		agentGlobals().newrelic = createAgent(calls, "second ");
		provider.trackEvent("two", {});

		expect(calls).toEqual([
			"first addPageAction one",
			"second addPageAction two",
		]);
	});

	test("sends nothing before initialize() or after destroy()", async () => {
		const calls: string[] = [];
		agentGlobals().newrelic = createAgent(calls);
		const provider = new NewRelicInstrumentationProvider();

		expect(provider.isReady()).toBe(false);
		provider.trackEvent("before", {});

		await provider.initialize();
		provider.destroy();
		expect(provider.isReady()).toBe(false);
		provider.trackEvent("after", {});

		expect(calls).toEqual([]);
	});
});
