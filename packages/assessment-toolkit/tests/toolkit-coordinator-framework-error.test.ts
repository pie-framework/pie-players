import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { FrameworkErrorBus } from "../src/services/framework-error-bus.js";
import type { FrameworkErrorModel } from "../src/services/framework-error.js";
import { __resetDeprecationWarnings } from "../src/services/deprecation-warnings.js";

describe("ToolkitCoordinator framework-error contract", () => {
	beforeEach(() => {
		__resetDeprecationWarnings();
	});

	afterEach(() => {
		__resetDeprecationWarnings();
	});

	test("subscribeFrameworkErrors receives errors raised by the coordinator", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-canonical-bus",
			lazyInit: true,
		});

		const received: FrameworkErrorModel[] = [];
		const detach = coordinator.subscribeFrameworkErrors((model) => {
			received.push(model);
		});

		(coordinator as any).handleError(new Error("provider boom"), {
			phase: "provider-init",
			providerId: "tts",
		});
		detach();

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({
			kind: "provider-init",
			source: "pie-toolkit-coordinator/tts",
			message: "provider boom",
			severity: "error",
		});
	});

	test("onFrameworkError hook receives canonical model", () => {
		const calls: FrameworkErrorModel[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-canonical-hook",
			lazyInit: true,
			hooks: {
				onFrameworkError: (model) => {
					calls.push(model);
				},
			},
		});

		(coordinator as any).handleError(new Error("state load failed"), {
			phase: "state-load",
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].kind).toBe("tool-state-load");
		expect(calls[0].source).toBe("pie-toolkit-coordinator:state-load");
		expect(calls[0].message).toBe("state load failed");
	});

	test("deprecated onProviderError hook receives mapped legacy payload", () => {
		const calls: Array<{
			providerId: string;
			error: Error;
			phase: string;
		}> = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-deprecated-provider",
			lazyInit: true,
			hooks: {
				onProviderError: (providerId, error, context) => {
					calls.push({ providerId, error, phase: context.phase });
				},
			},
		});

		(coordinator as any).handleError(new Error("provider register fail"), {
			phase: "provider-register",
			providerId: "calculator",
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].providerId).toBe("calculator");
		expect(calls[0].phase).toBe("provider-register");
		expect(calls[0].error.message).toBe("provider register fail");
	});

	test("deprecated onTTSError hook only fires on tts-init kind", () => {
		const ttsCalls: Array<{ message: string }> = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-deprecated-tts",
			lazyInit: true,
			hooks: {
				onTTSError: (error) => {
					ttsCalls.push({ message: error.message });
				},
			},
		});

		(coordinator as any).handleError(new Error("not tts"), {
			phase: "provider-init",
			providerId: "calculator",
		});
		expect(ttsCalls).toHaveLength(0);

		(coordinator as any).handleError(new Error("tts boom"), {
			phase: "tts-init",
		});
		expect(ttsCalls).toHaveLength(1);
		expect(ttsCalls[0].message).toBe("tts boom");
	});

	test("onError fires for every framework-error kind", () => {
		const received: Array<{
			message: string;
			phase: string;
		}> = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-deprecated-onerror",
			lazyInit: true,
			hooks: {
				onError: (error, context) => {
					received.push({ message: error.message, phase: context.phase });
				},
			},
		});

		(coordinator as any).handleError(new Error("a"), { phase: "state-load" });
		(coordinator as any).handleError(new Error("b"), {
			phase: "provider-init",
			providerId: "calculator",
		});

		expect(received).toEqual([
			{ message: "a", phase: "state-load" },
			{ message: "b", phase: "provider-init" },
		]);
	});

	test("setHooks installs an onFrameworkError hook that receives subsequent errors", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-set-hooks",
			lazyInit: true,
		});

		const calls: FrameworkErrorModel[] = [];
		coordinator.setHooks({
			onFrameworkError: (model) => {
				calls.push(model);
			},
		});

		(coordinator as any).handleError(new Error("after sethooks"), {
			phase: "tts-init",
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].kind).toBe("tts-init");
	});

	test("a host-shared FrameworkErrorBus sees coordinator-emitted errors", () => {
		const sharedBus = new FrameworkErrorBus();
		const received: FrameworkErrorModel[] = [];
		sharedBus.subscribeFrameworkErrors((model) => received.push(model));

		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-shared-bus",
			lazyInit: true,
			frameworkErrorBus: sharedBus,
		});

		(coordinator as any).handleError(new Error("shared bus error"), {
			phase: "tts-init",
		});

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({
			kind: "tts-init",
			message: "shared bus error",
		});
	});

	test("a host-shared FrameworkErrorBus delivers host-published errors to coordinator hooks", () => {
		const sharedBus = new FrameworkErrorBus();
		const calls: FrameworkErrorModel[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-shared-bus-prepublished",
			lazyInit: true,
			frameworkErrorBus: sharedBus,
			hooks: {
				onFrameworkError: (model) => {
					calls.push(model);
				},
			},
		});

		// Host (e.g. the toolkit CE) publishes a runtime-init failure that
		// originated before any coordinator phase. Coordinator hooks should
		// still observe it because they share the bus.
		coordinator.reportFrameworkError({
			kind: "runtime-init",
			severity: "error",
			source: "test-host",
			message: "host pre-coordinator error",
			details: ["context detail"],
			recoverable: false,
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].kind).toBe("runtime-init");
		expect(calls[0].message).toBe("host pre-coordinator error");
	});

	test("a thrown onFrameworkError hook does not block other listeners", () => {
		const received: FrameworkErrorModel[] = [];
		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-throwing-hook",
			lazyInit: true,
			hooks: {
				onFrameworkError: () => {
					throw new Error("hook explosion");
				},
			},
		});
		coordinator.subscribeFrameworkErrors((model) => received.push(model));

		const originalWarn = console.warn;
		console.warn = () => {};
		try {
			(coordinator as any).handleError(new Error("kaboom"), {
				phase: "tts-init",
			});
		} finally {
			console.warn = originalWarn;
		}

		expect(received).toHaveLength(1);
		expect(received[0].kind).toBe("tts-init");
	});

	test("a single error emits to canonical hook, deprecated hook, and bus subscriber exactly once each", () => {
		const canonical: FrameworkErrorModel[] = [];
		const onError: Array<{ message: string }> = [];
		const onProvider: Array<{ providerId: string }> = [];

		const coordinator = new ToolkitCoordinator({
			assessmentId: "framework-error-single-fire",
			lazyInit: true,
			hooks: {
				onFrameworkError: (model) => canonical.push(model),
				onError: (error) => onError.push({ message: error.message }),
				onProviderError: (providerId) =>
					onProvider.push({ providerId }),
			},
		});

		const busHits: FrameworkErrorModel[] = [];
		coordinator.subscribeFrameworkErrors((model) => busHits.push(model));

		(coordinator as any).handleError(new Error("once"), {
			phase: "provider-init",
			providerId: "calculator",
		});

		expect(canonical).toHaveLength(1);
		expect(onError).toHaveLength(1);
		expect(onProvider).toHaveLength(1);
		expect(busHits).toHaveLength(1);
		expect(canonical[0]).toBe(busHits[0]);
	});
});
