import { describe, expect, test } from "bun:test";
import type {
	EventAttributes,
	InstrumentationProvider,
} from "../src/instrumentation/types";
import {
	forwardMathjaxEvents,
	MATHJAX_NO_ASSET_ROOT_EVENT,
	MATHJAX_VERSION_CONFLICT_EVENT,
} from "../src/loaders/mathjax-events";

const DOCS_URL =
	"https://github.com/pie-framework/pie-players/blob/develop/docs/item-player/loading-strategies.md#one-mathjax-version-per-page";

const ASSETS_DOCS_URL =
	"https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#assets";

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

describe("forwardMathjaxEvents", () => {
	test("tracks the condition and docs link of each conflict", () => {
		const provider = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxEvents(view, () => provider);

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

	test("tracks the effect and docs link of a copy with no asset root", () => {
		const provider = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxEvents(view, () => provider);

		view.dispatchEvent(
			new CustomEvent(MATHJAX_NO_ASSET_ROOT_EVENT, {
				detail: {
					effect: "no-web-fonts-or-speech",
					message: "[math-rendering] No asset root for MathJax: ...",
					docsUrl: ASSETS_DOCS_URL,
				},
			}),
		);

		expect(provider.trackedEvents).toEqual([
			{
				name: "pie-mathjax-no-asset-root",
				attributes: { effect: "no-web-fonts-or-speech", docsUrl: ASSETS_DOCS_URL },
			},
		]);
	});

	test("stops forwarding once the returned function is called", () => {
		const provider = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxEvents(view, () => provider)();

		view.dispatchEvent(conflictEvent("mathjax-3-global"));

		expect(provider.trackedEvents).toEqual([]);
	});

	test("reads the provider when the event fires", () => {
		const provider = new FakeInstrumentationProvider();
		let current: InstrumentationProvider | undefined;
		const view = new EventTarget();
		forwardMathjaxEvents(view, () => current);

		view.dispatchEvent(conflictEvent("mathjax-3-global"));
		current = provider;
		view.dispatchEvent(conflictEvent("foreign-output-stylesheet"));

		expect(provider.trackedEvents.map((event) => event.attributes)).toEqual([
			{ condition: "foreign-output-stylesheet", docsUrl: DOCS_URL },
		]);
	});

	test("tracks an event once per provider however many backends listen", () => {
		const shared = new FakeInstrumentationProvider();
		const other = new FakeInstrumentationProvider();
		const view = new EventTarget();
		forwardMathjaxEvents(view, () => shared);
		forwardMathjaxEvents(view, () => shared);
		forwardMathjaxEvents(view, () => other);

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
		forwardMathjaxEvents(view, () => provider);

		expect(() =>
			view.dispatchEvent(conflictEvent("mathjax-3-global")),
		).not.toThrow();
	});
});
