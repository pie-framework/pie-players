/**
 * The layout kernel's stage chain, on a mounted `<pie-section-player-vertical>`
 * over its real toolkit and coordinator.
 *
 * Each test switches sections: under happy-dom an attempt-only switch does not
 * reach the toolkit, whose `attempt-id` write lands inside the base element's
 * flush, and `section-player-cohort-readiness.spec.ts` covers it in a browser.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, describe, expect, test } from "bun:test";

// Mounts register custom elements on this window, and bun runs every test file in
// one process with a shared module cache: another file mounting the same
// elements finds them defined here, so the DOM stays registered for the process.
if (typeof window === "undefined") GlobalRegistrator.register();
// The default toolkit starts browser TTS; without the API it reports a
// framework error that has nothing to do with the stage chain.
Object.assign(window, {
	speechSynthesis: {
		getVoices: () => [],
		speak() {},
		cancel() {},
		pause() {},
		resume() {},
		addEventListener() {},
		removeEventListener() {},
	},
});

await import("../src/components/section-player-vertical-element.js");
const { connectSectionPlayerLayoutContext } = await import(
	"../src/components/shared/section-player-layout-context.js"
);

afterEach(() => {
	document.body.replaceChildren();
});

type LayoutElement = HTMLElement & {
	section?: unknown;
	runtime?: unknown;
	getSectionController(): unknown;
	waitForSectionController(timeoutMs?: number): Promise<unknown>;
};

const section = (identifier: string) => ({ identifier, assessmentItemRefs: [] });

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(condition: () => boolean, message: string): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`timed out: ${message}`);
		await nextTask();
	}
}

function findElement(root: ParentNode, localName: string): Element | null {
	for (const element of Array.from(root.querySelectorAll("*"))) {
		if (element.localName === localName) return element;
		const nested = element.shadowRoot && findElement(element.shadowRoot, localName);
		if (nested) return nested;
	}
	return null;
}

const findToolkit = (root: ParentNode) =>
	findElement(root, "pie-assessment-toolkit");

async function tasks(count: number): Promise<void> {
	for (let task = 0; task < count; task += 1) await nextTask();
}

/**
 * Mounts a player on section `s1`, attempt `a1`, and records its stage changes
 * as `<stage>:<status>`, `section-ready` as `section-ready:<sectionId>`,
 * `toolkit-ready` and loading completion as `loading-complete`.
 */
async function mountPlayer({
	runtime = { assessmentId: "kernel" } as Record<string, unknown>,
	initial = section("s1") as unknown,
} = {}) {
	const player = document.createElement(
		"pie-section-player-vertical",
	) as LayoutElement;
	const events: string[] = [];
	player.addEventListener("pie-stage-change", (event) => {
		const { stage, status } = (event as CustomEvent).detail;
		events.push(`${stage}:${status}`);
	});
	player.addEventListener("section-ready", (event) => {
		events.push(`section-ready:${(event as CustomEvent).detail.sectionId}`);
	});
	player.addEventListener("toolkit-ready", () => events.push("toolkit-ready"));
	player.addEventListener("pie-loading-complete", () =>
		events.push("loading-complete"),
	);
	player.setAttribute("attempt-id", "a1");
	player.runtime = runtime;
	player.section = initial;
	document.body.appendChild(player);
	await until(() => events.includes("loading-complete"), "loading-complete");
	const toolkit = findToolkit(player);
	if (!toolkit) throw new Error("the player's toolkit was not found");
	return { player, toolkit, events };
}

const after = (events: string[], from: number) => events.slice(from);

/** What a switch from `s1` to `s2` records. */
const SWITCH_TO_S2 = [
	"disposed:entered",
	"composed:entered",
	"toolkit-ready",
	"engine-ready:entered",
	"section-ready:s2",
	"interactive:entered",
	"loading-complete",
];

/** Calls `act` as the player enters the next `composed`. */
function onComposed(player: HTMLElement, act: () => void) {
	const listener = (event: Event) => {
		if ((event as CustomEvent).detail.stage !== "composed") return;
		player.removeEventListener("pie-stage-change", listener);
		act();
	};
	player.addEventListener("pie-stage-change", listener);
}

async function switchTo(player: LayoutElement, events: string[], identifier: string) {
	const from = events.length;
	player.section = section(identifier);
	await until(
		() => after(events, from).includes("loading-complete"),
		`${identifier} loading-complete`,
	);
	return after(events, from);
}

describe("section-player layout kernel", () => {
	// The switch also pins the readiness roll: the outgoing section's readiness,
	// carried over, completes the next one before its own `section-ready`.
	test("runs one stage chain per section, keyed on the section's identifier", async () => {
		const { player, events } = await mountPlayer();
		expect(events).toEqual([
			"composed:entered",
			"toolkit-ready",
			"engine-ready:entered",
			"section-ready:s1",
			"interactive:entered",
			"loading-complete",
		]);
		expect(await switchTo(player, events, "s2")).toEqual(SWITCH_TO_S2);
	});

	// The toolkit's own coordinator is named after the section when no
	// assessment id is set, which the section's id must not follow.
	test("a section with no identifier and no assessment id runs under the fallback id", async () => {
		const { events } = await mountPlayer({
			runtime: {},
			initial: { assessmentItemRefs: [] },
		});
		expect(events).toEqual([
			"composed:entered",
			"toolkit-ready",
			"engine-ready:entered",
			"section-ready:section-default",
			"interactive:entered",
			"loading-complete",
		]);
	});

	test("a section-ready ahead of its section's roll advances that section at the roll", async () => {
		const { player, toolkit, events } = await mountPlayer();
		const controller = await player.waitForSectionController(1_000);
		const from = events.length;
		toolkit.dispatchEvent(
			new CustomEvent("section-ready", {
				bubbles: true,
				composed: true,
				detail: { sectionId: "s2", attemptId: "a1", controller },
			}),
		);
		expect(after(events, from)).toEqual(["section-ready:s2"]);
		const next = await switchTo(player, events, "s2");
		expect(next.slice(0, 3)).toEqual([
			"disposed:entered",
			"composed:entered",
			"engine-ready:entered",
		]);
	});

	test("only a section-ready for the current section, with its controller, readies it", async () => {
		const { player, toolkit, events } = await mountPlayer();
		const controller = await player.waitForSectionController(1_000);
		// The toolkit's own section-ready for s2 is held back, so the test decides
		// which ones the layout hears.
		const sent = new WeakSet<Event>();
		toolkit.parentNode?.addEventListener(
			"section-ready",
			(event) => {
				if (!sent.has(event)) event.stopImmediatePropagation();
			},
			true,
		);
		const sendSectionReady = (detail: Record<string, unknown>) => {
			const event = new CustomEvent("section-ready", {
				bubbles: true,
				composed: true,
				detail,
			});
			sent.add(event);
			toolkit.dispatchEvent(event);
		};
		// Ahead of the roll, so s2 reaches engine-ready without being ready.
		sendSectionReady({ sectionId: "s2", attemptId: "a1", controller });
		const from = events.length;
		player.section = section("s2");
		await until(
			() => after(events, from).includes("engine-ready:entered"),
			"s2 engine-ready",
		);

		sendSectionReady({ sectionId: "s1", attemptId: "a1", controller });
		sendSectionReady({ sectionId: "s2", attemptId: "a1" });
		await tasks(10);
		expect(after(events, from)).not.toContain("interactive:entered");

		sendSectionReady({ sectionId: "s2", attemptId: "a1", controller });
		await until(
			() => after(events, from).includes("loading-complete"),
			"s2 loading-complete",
		);
	});

	test("reading the controller during a switch leaves the stage chain where it is", async () => {
		const { player, events } = await mountPlayer();
		onComposed(player, () => {
			player.getSectionController();
			void player.waitForSectionController(0);
		});
		expect(await switchTo(player, events, "s2")).toEqual(SWITCH_TO_S2);
	});

	test("the toolkit's framework-error reaches the document as the one event", async () => {
		const { toolkit } = await mountPlayer();
		const received: Event[] = [];
		const record = (event: Event) => received.push(event);
		document.addEventListener("framework-error", record);
		const error = new CustomEvent("framework-error", {
			bubbles: true,
			composed: true,
			detail: {
				kind: "tool-config",
				severity: "warning",
				source: "section-player-layout-kernel-test",
				message: "A recoverable warning",
				details: [],
				recoverable: true,
				scope: "runtime",
			},
		});
		toolkit.dispatchEvent(error);
		document.removeEventListener("framework-error", record);
		// Compared by identity: a failing match would print the DOM event.
		expect(received.map((event) => event === error)).toEqual([true]);
	});

	const cohortFailure = (sectionId: string) =>
		new CustomEvent("framework-error", {
			bubbles: true,
			composed: true,
			detail: {
				kind: "section-controller-init",
				severity: "error",
				source: "section-player-layout-kernel-test",
				message: `Section ${sectionId} failed`,
				details: [],
				recoverable: false,
				scope: "cohort",
				cohort: { sectionId, attemptId: "a1" },
			},
		});

	test("a failure reported for the outgoing section leaves the incoming one alone", async () => {
		const { player, toolkit, events } = await mountPlayer();
		onComposed(player, () => toolkit.dispatchEvent(cohortFailure("s1")));
		expect(await switchTo(player, events, "s2")).toEqual(SWITCH_TO_S2);
	});

	const runtimeFailure = () =>
		new CustomEvent("framework-error", {
			bubbles: true,
			composed: true,
			detail: {
				kind: "section-controller-init",
				severity: "error",
				source: "section-player-layout-kernel-test",
				message: "The runtime failed",
				details: [],
				recoverable: false,
				scope: "runtime",
			},
		});

	test("a failure from a toolkit nested in the section leaves its stage chain alone", async () => {
		const { player, toolkit, events } = await mountPlayer();
		const nested = document.createElement("pie-assessment-toolkit");
		nested.setAttribute("isolation", "force");
		toolkit.appendChild(nested);
		onComposed(player, () => nested.dispatchEvent(runtimeFailure()));
		expect(await switchTo(player, events, "s2")).toEqual(SWITCH_TO_S2);
	});

	test("a failure from the section's own content fails its stage chain", async () => {
		const { player, toolkit, events } = await mountPlayer();
		const content = toolkit.appendChild(document.createElement("div"));
		const from = events.length;
		onComposed(player, () => content.dispatchEvent(runtimeFailure()));
		player.section = section("s2");
		await until(
			() => after(events, from).some((entry) => entry.endsWith(":failed")),
			"s2 failed",
		);
		expect(after(events, from)).not.toContain("interactive:entered");
	});

	test("the items pane's preload reports reach the document from the layout", async () => {
		const { player } = await mountPlayer();
		const pane = findElement(player, "pie-section-player-items-pane") as HTMLElement;
		const reached: Array<[string, boolean, unknown]> = [];
		const record = (event: Event) =>
			reached.push([
				event.type,
				event.target === player,
				(event as CustomEvent).detail.sectionId,
			]);
		document.addEventListener("element-preload-retry", record);
		document.addEventListener("element-preload-error", record);
		let layout: Parameters<
			Parameters<typeof connectSectionPlayerLayoutContext>[1]
		>[0] | null = null;
		const disconnect = connectSectionPlayerLayoutContext(pane, (value) => {
			layout = value;
		});
		await until(() => layout !== null, "the layout context");
		layout!.reportPreloadRetry(pane, {
			componentTag: "pie-section-player-items-pane",
			attempt: 1,
		} as never);
		layout!.reportPreloadError(pane, {
			componentTag: "pie-section-player-items-pane",
			stage: "warmup",
			error: "failed",
		} as never);
		disconnect();
		document.removeEventListener("element-preload-retry", record);
		document.removeEventListener("element-preload-error", record);
		expect(reached).toEqual([
			["element-preload-retry", true, "s1"],
			["element-preload-error", true, "s1"],
		]);
	});

	test("a failure reported for the incoming section fails its stage chain", async () => {
		const { player, toolkit, events } = await mountPlayer();
		const from = events.length;
		onComposed(player, () => toolkit.dispatchEvent(cohortFailure("s2")));
		player.section = section("s2");
		await until(
			() => after(events, from).some((entry) => entry.endsWith(":failed")),
			"s2 failed",
		);
		expect(after(events, from)).not.toContain("interactive:entered");
	});
});
