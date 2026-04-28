import { describe, expect, mock, test } from "bun:test";
import { FrameworkErrorBus } from "../src/services/framework-error-bus";
import type { FrameworkErrorModel } from "../src/services/framework-error";

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
