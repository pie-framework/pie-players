import { describe, expect, test } from "bun:test";
import type {
	EventAttributes,
	InstrumentationProvider,
} from "../src/instrumentation/types";
import {
	forwardMathjaxVersionConflicts,
	MATHJAX_VERSION_CONFLICT_EVENT,
} from "../src/loaders/mathjax-version-conflict";

const DOCS_URL =
	"https://github.com/pie-framework/pie-players/blob/develop/docs/item-player/loading-strategies.md#one-mathjax-version-per-page";

class FakeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "fake";
	readonly providerName = "Fake";
	readonly trackedEvents: Array<{
		name: string;
		attributes: EventAttributes;
	}> = [];

	async initialize(): Promise<void> {}
	trackError(): void {}
	trackEvent(eventName: string, attributes: EventAttributes): void {
		this.trackedEvents.push({ name: eventName, attributes });
	}
	destroy(): void {}
	isReady(): boolean {
		return true;
	}
}

/** The event as the MathJax adapter dispatches it. */
function conflictEvent(condition: string): CustomEvent {
	return new CustomEvent(MATHJAX_VERSION_CONFLICT_EVENT, {
		detail: {
			condition,
			message: `[math-rendering] Unsupported page (${condition}): ...`,
			docsUrl: DOCS_URL,
		},
	});
}

describe("forwardMathjaxVersionConflicts", () => {
	test("tracks the condition and docs link of each conflict", () => {
		const provider = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxVersionConflicts(view, () => provider);

		view.dispatchEvent(conflictEvent("foreign-output-stylesheet"));
		view.dispatchEvent(conflictEvent("mathjax-3-global"));

		expect(provider.trackedEvents).toEqual([
			{
				name: "pie-mathjax-version-conflict",
				attributes: {
					condition: "foreign-output-stylesheet",
					docsUrl: DOCS_URL,
				},
			},
			{
				name: "pie-mathjax-version-conflict",
				attributes: { condition: "mathjax-3-global", docsUrl: DOCS_URL },
			},
		]);
	});

	test("reads the provider when the event fires", () => {
		const provider = new FakeInstrumentationProvider();
		let current: InstrumentationProvider | undefined;
		const view = new EventTarget();
		forwardMathjaxVersionConflicts(view, () => current);

		view.dispatchEvent(conflictEvent("mathjax-3-global"));
		current = provider;
		view.dispatchEvent(conflictEvent("legacy-renderer-delegation"));

		expect(provider.trackedEvents.map((event) => event.attributes)).toEqual([
			{ condition: "legacy-renderer-delegation", docsUrl: DOCS_URL },
		]);
	});

	test("tracks an event once per provider however many backends listen", () => {
		const shared = new FakeInstrumentationProvider();
		const other = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxVersionConflicts(view, () => shared);
		forwardMathjaxVersionConflicts(view, () => shared);
		forwardMathjaxVersionConflicts(view, () => other);

		view.dispatchEvent(conflictEvent("mathjax-3-global"));

		expect(shared.trackedEvents).toHaveLength(1);
		expect(other.trackedEvents).toHaveLength(1);
	});

	test("keeps a failing provider from reaching the dispatcher", () => {
		const provider = new FakeInstrumentationProvider();
		provider.trackEvent = () => {
			throw new Error("provider down");
		};
		const view = new EventTarget();
		forwardMathjaxVersionConflicts(view, () => provider);

		expect(() =>
			view.dispatchEvent(conflictEvent("mathjax-3-global")),
		).not.toThrow();
	});
});
