import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { FrameworkErrorBus } from "../src/services/framework-error-bus";
import type { FrameworkErrorModel } from "../src/services/framework-error";
import {
	__resetDeprecationWarnings,
	warnDeprecatedOnce,
} from "../src/services/deprecation-warnings";

function model(
	overrides: Partial<FrameworkErrorModel> = {},
): FrameworkErrorModel {
	return {
		kind: "tool-config",
		severity: "error",
		source: "test",
		message: "boom",
		details: [],
		recoverable: false,
		...overrides,
	};
}

describe("FrameworkErrorBus", () => {
	test("delivers a published model to all subscribers in registration order", () => {
		const bus = new FrameworkErrorBus();
		const calls: number[] = [];
		bus.subscribeFrameworkErrors(() => calls.push(1));
		bus.subscribeFrameworkErrors(() => calls.push(2));
		bus.subscribeFrameworkErrors(() => calls.push(3));

		bus.reportFrameworkError(model());

		expect(calls).toEqual([1, 2, 3]);
	});

	test("disposer removes the listener and is idempotent", () => {
		const bus = new FrameworkErrorBus();
		let calls = 0;
		const detach = bus.subscribeFrameworkErrors(() => {
			calls += 1;
		});

		bus.reportFrameworkError(model());
		expect(calls).toBe(1);

		detach();
		detach();

		bus.reportFrameworkError(model());
		expect(calls).toBe(1);
		expect(bus.getListenerCount()).toBe(0);
	});

	test("a throwing listener does not block fan-out to remaining listeners", () => {
		const bus = new FrameworkErrorBus();
		const consoleWarn = console.warn;
		const warnSpy = mock(() => {});
		console.warn = warnSpy as unknown as typeof console.warn;
		try {
			let later = 0;
			bus.subscribeFrameworkErrors(() => {
				throw new Error("boom-listener");
			});
			bus.subscribeFrameworkErrors(() => {
				later += 1;
			});

			bus.reportFrameworkError(model());

			expect(later).toBe(1);
			expect(warnSpy).toHaveBeenCalled();
		} finally {
			console.warn = consoleWarn;
		}
	});

	test("subscribe during delivery does not invoke the new listener for the in-flight model", () => {
		const bus = new FrameworkErrorBus();
		let lateCalls = 0;
		bus.subscribeFrameworkErrors(() => {
			bus.subscribeFrameworkErrors(() => {
				lateCalls += 1;
			});
		});
		bus.reportFrameworkError(model());
		expect(lateCalls).toBe(0);

		bus.reportFrameworkError(model());
		expect(lateCalls).toBe(1);
	});

	test("unsubscribe during delivery still invokes already-snapshotted listeners", () => {
		const bus = new FrameworkErrorBus();
		let bCalls = 0;
		const aDetach = bus.subscribeFrameworkErrors(() => {
			aDetach();
		});
		bus.subscribeFrameworkErrors(() => {
			bCalls += 1;
		});

		bus.reportFrameworkError(model());

		expect(bCalls).toBe(1);
		expect(bus.getListenerCount()).toBe(1);
	});

	test("dispose detaches every listener", () => {
		const bus = new FrameworkErrorBus();
		let calls = 0;
		bus.subscribeFrameworkErrors(() => {
			calls += 1;
		});
		bus.subscribeFrameworkErrors(() => {
			calls += 1;
		});
		expect(bus.getListenerCount()).toBe(2);

		bus.dispose();

		expect(bus.getListenerCount()).toBe(0);
		bus.reportFrameworkError(model());
		expect(calls).toBe(0);
	});

	test("does not replay past errors to late subscribers", () => {
		const bus = new FrameworkErrorBus();
		bus.reportFrameworkError(model({ message: "early" }));
		let received: FrameworkErrorModel | null = null;
		bus.subscribeFrameworkErrors((m) => {
			received = m;
		});
		expect(received).toBeNull();
	});
});

describe("warnDeprecatedOnce", () => {
	let warnSpy: ReturnType<typeof mock>;
	let originalWarn: typeof console.warn;
	let originalNodeEnv: string | undefined;

	beforeEach(() => {
		__resetDeprecationWarnings();
		originalWarn = console.warn;
		warnSpy = mock(() => {});
		console.warn = warnSpy as unknown as typeof console.warn;
		originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";
	});

	afterEach(() => {
		console.warn = originalWarn;
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnv;
		}
	});

	test("emits exactly once per label, even from different call sites", () => {
		const fired1 = warnDeprecatedOnce("alpha", "use canonical instead");
		const fired2 = warnDeprecatedOnce("alpha", "use canonical instead (again)");
		const fired3 = warnDeprecatedOnce("alpha", "yet again");

		expect(fired1).toBe(true);
		expect(fired2).toBe(false);
		expect(fired3).toBe(false);
		expect(warnSpy).toHaveBeenCalledTimes(1);
	});

	test("different labels each warn once", () => {
		warnDeprecatedOnce("alpha", "msg-a");
		warnDeprecatedOnce("beta", "msg-b");
		warnDeprecatedOnce("alpha", "msg-a-again");

		expect(warnSpy).toHaveBeenCalledTimes(2);
	});

	test("is silent in production", () => {
		process.env.NODE_ENV = "production";
		const fired = warnDeprecatedOnce("only-prod", "should not warn");
		expect(fired).toBe(false);
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
