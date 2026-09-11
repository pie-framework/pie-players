import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { loadPieModule } from "../src/pie/initialization.js";
import { setMathRenderer } from "../src/pie/math-rendering.js";

/**
 * `loadPieModule` injects a `<script>` and waits for it. Every failure path
 * has to reject rather than hang: before this suite a bad URL threw inside
 * the DOM event handler — reaching the window, never the caller — and the
 * awaited promise stayed pending for the life of the page.
 *
 * The suite drives the injected element's outcome rather than the network.
 * `document.createElement("script")` is intercepted and answered with an
 * inert stand-in, which is then made to dispatch `error`, dispatch `load`,
 * or stall — the three cases a host sees as a 404 / CSP refusal, a served
 * bundle, and a hung request. A real happy-dom `HTMLScriptElement` cannot
 * play those parts: it either attempts a fetch or throws synchronously out
 * of `appendChild`, and neither is the behaviour under test.
 */

const SCRIPT_MARKER = "data-pie-test-script";
const BUNDLE_URL = "https://bundles.test/pie/does-not-exist.js";

type ScriptOutcome = "error" | "load" | "stall";

let registeredHere = false;
let outcome: ScriptOutcome = "error";
let injected: Element | null = null;

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
		registeredHere = true;
	}
	// Keeps `initializeMathRendering` off its dynamic import.
	setMathRenderer({ renderMath: () => {} });
});

afterAll(async () => {
	if (registeredHere && GlobalRegistrator.isRegistered) {
		await GlobalRegistrator.unregister();
	}
});

const emptyConfig = () => ({ elements: {}, models: [] }) as any;

const injectedInHead = () =>
	Array.from(document.head.querySelectorAll(`[${SCRIPT_MARKER}]`));

beforeEach(() => {
	outcome = "error";
	injected = null;

	const original = document.createElement.bind(document);
	(document as unknown as { createElement: unknown }).createElement = (
		tagName: string,
		...rest: unknown[]
	) => {
		if (tagName !== "script") {
			return (original as (...args: unknown[]) => Element)(tagName, ...rest);
		}
		const standIn = original("span");
		standIn.setAttribute(SCRIPT_MARKER, "true");
		injected = standIn;
		if (outcome !== "stall") {
			const settle = outcome;
			// `loadPieModule` appends synchronously after creating the element,
			// so the element is in the head by the time this macrotask runs.
			setTimeout(() => standIn.dispatchEvent(new Event(settle)), 0);
		}
		return standIn;
	};
});

afterEach(() => {
	delete (document as unknown as { createElement?: unknown }).createElement;
	document.head.innerHTML = "";
	delete (window as unknown as { pie?: unknown }).pie;
});

describe("loadPieModule failure settlement", () => {
	test("rejects with the bundle URL when the script errors", async () => {
		outcome = "error";

		await expect(
			loadPieModule(emptyConfig(), [], { bundleUrl: BUNDLE_URL }),
		).rejects.toThrow(`failed to load PIE bundle script: ${BUNDLE_URL}`);
		expect(injectedInHead()).toHaveLength(0);
	});

	test("rejects with the bundle URL when the request stalls past loadTimeoutMs", async () => {
		outcome = "stall";

		await expect(
			loadPieModule(emptyConfig(), [], {
				bundleUrl: BUNDLE_URL,
				loadTimeoutMs: 25,
			}),
		).rejects.toThrow(
			`PIE bundle script load timed out after 25ms: ${BUNDLE_URL}`,
		);
		expect(injectedInHead()).toHaveLength(0);
	});

	test("rejects when the script loads but registers no window.pie", async () => {
		outcome = "load";

		await expect(
			loadPieModule(emptyConfig(), [], { bundleUrl: BUNDLE_URL }),
		).rejects.toThrow(
			`PIE bundle loaded but window.pie is absent; is ${BUNDLE_URL} a proper PIE IIFE module?`,
		);
		expect(injectedInHead()).toHaveLength(0);
	});

	test("resolves and keeps the script when the bundle populates window.pie", async () => {
		outcome = "load";
		(window as unknown as { pie: unknown }).pie = { default: {} };

		const session: any[] = [];
		await expect(
			loadPieModule(emptyConfig(), session, { bundleUrl: BUNDLE_URL }),
		).resolves.toEqual({ session });
		expect(injectedInHead()).toHaveLength(1);
	});

	test("a zero loadTimeoutMs disables the deadline", async () => {
		outcome = "stall";
		let settled = false;

		const promise = loadPieModule(emptyConfig(), [], {
			bundleUrl: BUNDLE_URL,
			loadTimeoutMs: 0,
		}).then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);

		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(settled).toBe(false);

		injected?.dispatchEvent(new Event("error"));
		await promise;
		expect(settled).toBe(true);
	});
});
