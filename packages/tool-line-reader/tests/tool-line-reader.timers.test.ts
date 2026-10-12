import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, beforeEach, expect, jest, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

await import("../tool-line-reader.svelte");

// Timers scheduled through the page's `setTimeout`, tracked here because the
// fake clock's own count includes the bookkeeping timer happy-dom schedules
// whenever its task queue drains.
const pageTimers = {
	setTimeout: globalThis.setTimeout,
	clearTimeout: globalThis.clearTimeout,
};
const pending = new Set<unknown>();
let unmounted = false;
/** The delay of each callback that ran after the tool unmounted. */
let late: number[] = [];

function trackTimers() {
	Object.assign(globalThis, {
		setTimeout(
			callback: (...args: unknown[]) => void,
			delay?: number,
			...args: unknown[]
		) {
			const id = pageTimers.setTimeout(() => {
				pending.delete(id);
				if (unmounted) late.push(delay ?? 0);
				callback(...args);
			}, delay);
			pending.add(id);
			return id;
		},
		clearTimeout(id?: ReturnType<typeof setTimeout>) {
			pending.delete(id);
			pageTimers.clearTimeout(id);
		},
	});
}

// A custom element mounts its component, and destroys it after removal, on a
// microtask, and the DOM updates on one; fake timers leave microtasks alone.
const flush = async () => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
};

async function mountVisible() {
	const reader = document.createElement("pie-tool-line-reader");
	reader.setAttribute("visible", "true");
	document.body.append(reader);
	await flush();
	const panel = reader.shadowRoot?.querySelector<HTMLElement>(".pie-tool-line-reader");
	if (!panel) throw new Error("line reader panel did not render");
	return { reader, panel };
}

async function nudge(panel: HTMLElement) {
	panel.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await flush();
}

const status = (reader: Element) =>
	reader.shadowRoot?.querySelector('[role="status"]')?.textContent?.trim();

async function unmount(reader: Element) {
	reader.remove();
	await flush();
	unmounted = true;
}

beforeEach(() => {
	jest.useFakeTimers();
	pending.clear();
	unmounted = false;
	late = [];
	trackTimers();
});

afterEach(async () => {
	document.body.replaceChildren();
	await flush();
	Object.assign(globalThis, pageTimers);
	jest.useRealTimers();
});

test("no timer callback runs after closing before the auto-focus fires", async () => {
	const { reader } = await mountVisible();
	// The auto-focus is still pending.
	expect(pending.size).toBeGreaterThan(0);

	await unmount(reader);
	jest.advanceTimersByTime(2000);

	expect(late).toEqual([]);
});

test("no timer callback runs after closing while an announcement shows", async () => {
	const { reader, panel } = await mountVisible();
	await nudge(panel);
	await nudge(panel);
	// Svelte's event delegation schedules a zero-delay timer of its own; this
	// drains it. The auto-focus and the announcement's clear are still pending.
	jest.advanceTimersByTime(0);
	expect(pending.size).toBeGreaterThan(0);

	await unmount(reader);
	jest.advanceTimersByTime(2000);

	expect(late).toEqual([]);
});

test("an earlier announcement's clear does not blank a later one", async () => {
	const { reader, panel } = await mountVisible();
	await nudge(panel);
	jest.advanceTimersByTime(600);
	await nudge(panel);
	const second = status(reader);
	jest.advanceTimersByTime(600);
	await flush();

	expect(second).toBeTruthy();
	expect(status(reader)).toBe(second);
});
