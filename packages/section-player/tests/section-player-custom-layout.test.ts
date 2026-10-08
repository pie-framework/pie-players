/**
 * Custom section layouts: the kernel host's default body, the layout context
 * the panes read, and the rule that one pane of each kind renders.
 *
 * The helpers run against happy-dom directly. `<pie-section-player-kernel-host>`
 * loads from the package build, so rebuild the package before running this
 * file. pie-context's event classes extend the `Event` of the moment the module
 * first loads, and a `dispatchEvent` accepts only its own realm's events, so
 * this file re-bases them onto happy-dom's `Event` while it runs and puts back
 * the base the rest of the run expects when it ends.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

const NativeEvent = globalThis.Event;
const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { ContextProviderEvent, ContextRequestEvent } = await import(
	"@pie-players/pie-context"
);

type EventClass = { prototype: Event };
function rebase(eventClass: EventClass, base: EventClass): void {
	Object.setPrototypeOf(eventClass, base);
	Object.setPrototypeOf(eventClass.prototype, base.prototype);
}
const rebased = [ContextRequestEvent, ContextProviderEvent].map((eventClass) => {
	const base = Object.getPrototypeOf(eventClass) as EventClass;
	// Loaded by this file: the rest of the run expects the native base.
	const restore = base === window.Event ? NativeEvent : base;
	rebase(eventClass, window.Event);
	return { eventClass, restore };
});

const { attachKernelHostDefaultBody } = await import(
	"../src/components/shared/kernel-host-default-body.js"
);
const {
	connectSectionPlayerLayoutContext,
	createSectionPlayerLayoutContextProvider,
	createSectionPlayerPaneRegistry,
} = await import("../src/components/shared/section-player-layout-context.js");
const { getHostElementFromAnchor } = await import(
	"../src/components/shared/host-element.js"
);
const { isOwnSectionPlayerEvent } = await import(
	"../src/components/shared/section-player-own-event.js"
);
await import("../dist/pie-section-player.js");

type LayoutContext =
	import("../src/components/shared/section-player-layout-context.js").SectionPlayerLayoutContext;

afterAll(() => {
	for (const { eventClass, restore } of rebased) rebase(eventClass, restore);
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

afterEach(() => {
	document.body.replaceChildren();
});

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

async function until(
	condition: () => boolean,
	message: string,
	timeoutMs = 5_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`timed out: ${message}`);
		await nextTask();
	}
}

async function settle(rounds = 20): Promise<void> {
	for (let round = 0; round < rounds; round += 1) await nextTask();
}

describe("attachKernelHostDefaultBody", () => {
	function fakeBody() {
		const calls = { mounts: 0, unmounts: 0 };
		const mountBody = (target: HTMLElement) => {
			calls.mounts += 1;
			const body = document.createElement("div");
			body.className = "default-body";
			target.appendChild(body);
			return () => {
				calls.unmounts += 1;
				body.remove();
			};
		};
		return { calls, mountBody };
	}

	test("mounts the body while the host has no element children", async () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const { calls, mountBody } = fakeBody();
		const teardown = attachKernelHostDefaultBody(host, mountBody);

		expect(host.querySelector(":scope > .default-body")).not.toBeNull();
		// Markup whitespace and a framework's placeholder comments leave it.
		host.append(document.createTextNode("\n  "), document.createComment(""));
		await settle(2);
		expect(host.querySelector(":scope > .default-body")).not.toBeNull();
		expect(calls).toEqual({ mounts: 1, unmounts: 0 });
		teardown();
	});

	test("gives way to a host child and returns when the last one leaves", async () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const { calls, mountBody } = fakeBody();
		const teardown = attachKernelHostDefaultBody(host, mountBody);

		const first = document.createElement("section");
		const second = document.createElement("section");
		host.append(first, second);
		await settle(2);
		expect(host.querySelector(".default-body")).toBeNull();
		expect(calls).toEqual({ mounts: 1, unmounts: 1 });

		first.remove();
		await settle(2);
		expect(host.querySelector(".default-body")).toBeNull();
		second.remove();
		await settle(2);
		expect(host.querySelector(":scope > .default-body")).not.toBeNull();
		expect(calls).toEqual({ mounts: 2, unmounts: 1 });
		teardown();
	});

	test("starts without the body for a host that already has children", () => {
		const host = document.createElement("div");
		host.appendChild(document.createElement("section"));
		const { calls, mountBody } = fakeBody();
		const teardown = attachKernelHostDefaultBody(host, mountBody);
		expect(calls.mounts).toBe(0);
		teardown();
	});

	test("teardown unmounts the body and stops following the children", async () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const { calls, mountBody } = fakeBody();
		const teardown = attachKernelHostDefaultBody(host, mountBody);
		teardown();
		expect(host.querySelector(".default-body")).toBeNull();

		const child = document.createElement("section");
		host.appendChild(child);
		await settle(2);
		child.remove();
		await settle(2);
		expect(calls).toEqual({ mounts: 1, unmounts: 1 });
	});
});

describe("createSectionPlayerPaneRegistry", () => {
	function registry() {
		const warnings: string[] = [];
		const changes: Array<Record<string, Element | null>> = [];
		const panes = createSectionPlayerPaneRegistry({
			onChange: (active) => changes.push(active),
			warn: (message) => warnings.push(message),
		});
		return { panes, warnings, changes };
	}
	const pane = () => document.createElement("div");

	test("the first pane of a kind renders and the next takes over when it leaves", () => {
		const { panes, changes } = registry();
		const first = pane();
		const second = pane();
		const passages = pane();
		const unregisterFirst = panes.register("items", first);
		const unregisterSecond = panes.register("items", second);
		panes.register("passages", passages);
		// Identity: `toEqual` finds two empty elements equal.
		expect(panes.active().items).toBe(first);
		expect(panes.active().passages).toBe(passages);
		expect(changes.at(-1)?.items).toBe(first);

		unregisterFirst();
		expect(panes.active().items).toBe(second);
		expect(changes.at(-1)?.items).toBe(second);
		unregisterSecond();
		expect(panes.active().items).toBeNull();
		expect(panes.active().passages).toBe(passages);
	});

	test("a second pane still registered a task later is reported once per kind", async () => {
		const { panes, warnings } = registry();
		panes.register("items", pane());
		panes.register("items", pane());
		expect(warnings).toEqual([]);
		await nextTask();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("2 <pie-section-player-items-pane> elements");

		panes.register("items", pane());
		await nextTask();
		expect(warnings).toHaveLength(1);

		panes.register("passages", pane());
		panes.register("passages", pane());
		await nextTask();
		expect(warnings).toHaveLength(2);
		expect(warnings[1]).toContain("<pie-section-player-passages-pane>");
	});

	test("a pane replaced within a task is not reported", async () => {
		const { panes, warnings } = registry();
		const unregisterOld = panes.register("items", pane());
		const replacement = pane();
		panes.register("items", replacement);
		unregisterOld();
		await nextTask();
		expect(warnings).toEqual([]);
		expect(panes.active().items).toBe(replacement);
	});

	test("dispose drops a pending report and the change notifications", async () => {
		const { panes, warnings, changes } = registry();
		const unregister = panes.register("items", pane());
		panes.register("items", pane());
		const notified = changes.length;
		panes.dispose();
		unregister();
		await nextTask();
		expect(warnings).toEqual([]);
		expect(changes).toHaveLength(notified);
	});
});

describe("section player layout context", () => {
	const value = (label: string) =>
		({ componentTag: label }) as unknown as LayoutContext;

	test("a pane resolves the closest section player through its host's slot", () => {
		const outerHost = document.createElement("div");
		outerHost.attachShadow({ mode: "open" }).appendChild(
			document.createElement("slot"),
		);
		const outerPane = document.createElement("div");
		const innerHost = document.createElement("div");
		const innerPane = document.createElement("div");
		innerHost.appendChild(innerPane);
		outerPane.appendChild(innerHost);
		outerHost.appendChild(outerPane);
		document.body.appendChild(outerHost);

		const outer = createSectionPlayerLayoutContextProvider(
			outerHost,
			value("outer"),
		);
		const inner = createSectionPlayerLayoutContextProvider(
			innerHost,
			value("inner"),
		);
		const seen = { outer: [] as string[], inner: [] as string[] };
		const disconnects = [
			connectSectionPlayerLayoutContext(outerPane, (layout) =>
				seen.outer.push(layout.componentTag),
			),
			connectSectionPlayerLayoutContext(innerPane, (layout) =>
				seen.inner.push(layout.componentTag),
			),
		];
		outer.setValue(value("outer-republished"));
		expect(seen).toEqual({
			outer: ["outer", "outer-republished"],
			inner: ["inner"],
		});
		for (const disconnect of disconnects) disconnect();
		outer.disconnect();
		inner.disconnect();
	});

	test("a pane connected before its provider is answered when the provider connects", () => {
		const host = document.createElement("div");
		const paneElement = document.createElement("div");
		host.appendChild(paneElement);
		document.body.appendChild(host);
		const seen: string[] = [];
		const disconnect = connectSectionPlayerLayoutContext(paneElement, (layout) =>
			seen.push(layout.componentTag),
		);
		expect(seen).toEqual([]);
		const provider = createSectionPlayerLayoutContextProvider(
			host,
			value("late"),
		);
		expect(seen).toEqual(["late"]);
		disconnect();
		provider.disconnect();
	});
});

describe("layout host resolution", () => {
	test("an anchor resolves the element that renders it, not an enclosing shadow host", () => {
		const outer = document.createElement("div");
		const shadow = outer.attachShadow({ mode: "open" });
		const shadowAnchor = document.createElement("div");
		shadow.appendChild(shadowAnchor);
		const lightLayout = document.createElement("section");
		const lightAnchor = document.createElement("div");
		lightLayout.appendChild(lightAnchor);
		shadow.appendChild(lightLayout);
		document.body.appendChild(outer);

		expect(getHostElementFromAnchor(shadowAnchor)).toBe(outer);
		expect(getHostElementFromAnchor(lightAnchor)).toBe(lightLayout);
		expect(getHostElementFromAnchor(null)).toBeNull();
	});

	test("a host with a shadow root owns its base's events and not a nested player's", () => {
		// A document of its own, where the built players' elements stay inert.
		const inert = document.implementation.createHTMLDocument("");
		const host = inert.createElement("div");
		const base = inert.createElement("pie-section-player-base");
		host.attachShadow({ mode: "open" }).appendChild(base);
		const nestedBase = inert.createElement("pie-section-player-base");
		host.appendChild(nestedBase);
		inert.body.appendChild(host);
		const seen: boolean[] = [];
		host.addEventListener("framework-error", (event) => {
			seen.push(isOwnSectionPlayerEvent(event, host));
		});
		for (const target of [base, nestedBase]) {
			target.dispatchEvent(
				new CustomEvent("framework-error", { bubbles: true, composed: true }),
			);
		}
		expect(seen).toEqual([true, false]);
	});
});

const ITEM_TAG = "x-custom-layout-item";
const PASSAGE_TAG = "x-custom-layout-passage";
for (const tag of [
	ITEM_TAG,
	`${ITEM_TAG}--version-1-0-0`,
	PASSAGE_TAG,
	`${PASSAGE_TAG}--version-1-0-0`,
]) {
	if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
}

function sectionFixture(options: { passage: boolean }) {
	const version = { major: 1, minor: 0, patch: 0 };
	return {
		identifier: "custom-layout-section",
		keepTogether: true,
		rubricBlocks: options.passage
			? [
					{
						identifier: "custom-layout-passage-block",
						view: ["candidate"],
						class: "stimulus",
						passage: {
							id: "custom-layout-passage",
							baseId: "custom-layout-passage",
							name: "Passage",
							version,
							config: {
								markup: `<${PASSAGE_TAG} id="p1"></${PASSAGE_TAG}>`,
								elements: { [PASSAGE_TAG]: `@pie-element/${PASSAGE_TAG}@1.0.0` },
								models: [{ id: "p1", element: PASSAGE_TAG }],
							},
						},
					},
				]
			: [],
		assessmentItemRefs: [
			{
				identifier: "custom-layout-ref",
				required: true,
				item: {
					id: "custom-layout-item",
					baseId: "custom-layout-item",
					name: "Item",
					version,
					config: {
						markup: `<${ITEM_TAG} id="i1"></${ITEM_TAG}>`,
						elements: { [ITEM_TAG]: `@pie-element/${ITEM_TAG}@1.0.0` },
						models: [{ id: "i1", element: ITEM_TAG }],
					},
				},
			},
		],
	};
}

type KernelHost = HTMLElement & { section?: unknown };

interface Mounted {
	host: KernelHost;
	events: string[];
	warnings: string[];
	count(type: string): number;
}

/**
 * The players' console output, provider initialisation failures included, held
 * back while the element tests run so the run stays readable. Warnings go to
 * the current mount's `warnings`.
 */
const heldConsole = {
	warnings: [] as string[],
	restore: null as (() => void) | null,
	hold() {
		const { warn, error, log, info, debug } = console;
		Object.assign(console, {
			warn: (...args: unknown[]) => heldConsole.warnings.push(String(args[0])),
			error: () => {},
			log: () => {},
			info: () => {},
			debug: () => {},
		});
		heldConsole.restore = () =>
			Object.assign(console, { warn, error, log, info, debug });
	},
};

/** Mounts a kernel host with `children` as its layout. */
async function mountKernelHost(
	children: Node[],
	section: unknown,
): Promise<Mounted> {
	const events: string[] = [];
	const warnings: string[] = [];
	const host = document.createElement(
		"pie-section-player-kernel-host",
	) as KernelHost;
	host.setAttribute("assessment-id", "custom-layout-assessment");
	host.setAttribute("section-id", "custom-layout-section");
	host.setAttribute("attempt-id", `custom-layout-${Date.now()}`);
	for (const type of ["pie-stage-change", "pie-loading-complete"]) {
		host.addEventListener(type, (event) => {
			const stage = (event as CustomEvent<{ stage?: string }>).detail?.stage;
			events.push(stage ? `${type}:${stage}` : type);
		});
	}
	host.append(...children);
	if (section) host.section = section;
	heldConsole.warnings = warnings;
	document.body.appendChild(host);
	await settle(2);
	return {
		host,
		events,
		warnings,
		count: (type) => events.filter((entry) => entry.startsWith(type)).length,
	};
}

const scrollHintOf = (pane: Element) =>
	pane.querySelector(":scope > .pie-section-player-scroll-hint");
const pieceWarnings = (mounted: Mounted, piece: string) =>
	mounted.warnings.filter(
		(message) => message.startsWith("[pie-section-player]") && message.includes(piece),
	);

describe("<pie-section-player-kernel-host>", () => {
	beforeAll(() => heldConsole.hold());
	afterAll(async () => {
		document.body.replaceChildren();
		// Teardown logs land some tasks after the elements leave.
		await settle(20);
		heldConsole.restore?.();
	});

	test("renders the stock body when the host gives it no children", async () => {
		const mounted = await mountKernelHost([], null);
		const { host } = mounted;
		await until(
			() => !!host.querySelector(".pie-section-player-kernel-host-content"),
			"stock body",
		);
		expect(host.shadowRoot?.querySelector("pie-section-player-base slot")).not.toBeNull();
		const stockPane = host.querySelector(
			":scope > .pie-section-player-kernel-host-content > pie-section-player-items-pane",
		);
		expect(stockPane).not.toBeNull();
		// The pane renders only once it has resolved the layout context and been
		// made the rendering items pane.
		await until(() => !!scrollHintOf(stockPane as Element), "stock items pane content");
	});

	test("a host's own panes replace the stock body, which returns when they leave", async () => {
		const column = document.createElement("div");
		const hostPane = document.createElement("pie-section-player-items-pane");
		column.appendChild(hostPane);
		const mounted = await mountKernelHost([column], null);
		const { host } = mounted;
		await until(() => !!scrollHintOf(hostPane), "host items pane content");
		expect(host.querySelector(".pie-section-player-kernel-host-content")).toBeNull();

		column.remove();
		await until(
			() => !!host.querySelector(".pie-section-player-kernel-host-content"),
			"stock body after the host layout leaves",
		);
	});

	test("items and passages render in a host layout and loading completes", async () => {
		const itemsColumn = document.createElement("div");
		const passagesColumn = document.createElement("div");
		const itemsPane = document.createElement("pie-section-player-items-pane");
		const passagesPane = document.createElement("pie-section-player-passages-pane");
		itemsColumn.appendChild(itemsPane);
		passagesColumn.appendChild(passagesPane);
		const mounted = await mountKernelHost(
			[itemsColumn, passagesColumn],
			sectionFixture({ passage: true }),
		);
		await until(() => mounted.count("pie-loading-complete") > 0, "pie-loading-complete");

		expect(itemsPane.querySelectorAll("pie-section-player-item-card")).toHaveLength(1);
		await until(
			() => passagesPane.querySelectorAll("pie-section-player-passage-card").length === 1,
			"passage card",
		);
		expect(mounted.events).toContain("pie-stage-change:composed");
		expect(mounted.events).toContain("pie-stage-change:interactive");
		expect(mounted.count("pie-loading-complete")).toBe(1);
		expect(pieceWarnings(mounted, "<pie-section-player-")).toEqual([]);
	});

	test("the stock body places a passages pane for a section with passages", async () => {
		const mounted = await mountKernelHost([], sectionFixture({ passage: true }));
		await until(() => mounted.count("pie-loading-complete") > 0, "pie-loading-complete");
		const content = mounted.host.querySelector(
			":scope > .pie-section-player-kernel-host-content",
		);
		expect(
			Array.from(content?.children ?? []).map((child) => child.localName),
		).toEqual(["pie-section-player-passages-pane", "pie-section-player-items-pane"]);
		await until(
			() => !!content?.querySelector("pie-section-player-passage-card"),
			"stock passage card",
		);
	});

	test("a second items pane renders nothing, leaves readiness alone and takes over", async () => {
		const first = document.createElement("pie-section-player-items-pane");
		const second = document.createElement("pie-section-player-items-pane");
		const mounted = await mountKernelHost([first, second], sectionFixture({ passage: false }));
		await until(() => mounted.count("pie-loading-complete") > 0, "pie-loading-complete");

		expect(first.querySelectorAll("pie-section-player-item-card")).toHaveLength(1);
		expect(second.querySelector("pie-section-player-item-card")).toBeNull();
		expect(scrollHintOf(second)).toBeNull();
		expect(pieceWarnings(mounted, "2 <pie-section-player-items-pane> elements")).toHaveLength(1);

		first.remove();
		await until(
			() => second.querySelectorAll("pie-section-player-item-card").length === 1,
			"the second pane taking over",
		);
	});

	test("reports from a pane that does not render leave readiness alone", async () => {
		const itemsPane = document.createElement("pie-section-player-items-pane");
		const probe = document.createElement("div");
		const mounted = await mountKernelHost([itemsPane, probe], sectionFixture({ passage: false }));
		await until(() => mounted.count("pie-loading-complete") > 0, "pie-loading-complete");
		let layout: LayoutContext | null = null;
		const disconnect = connectSectionPlayerLayoutContext(probe, (value) => {
			layout = value;
		});
		await until(() => layout?.elementsLoaded === true, "a loaded layout context");
		const loaded = layout as unknown as LayoutContext;
		expect(loaded.activePanes.items).toBe(itemsPane);

		loaded.reportElementsLoaded(probe, {
			elementsLoaded: false,
			renderablesSignature: loaded.preloadedRenderablesSignature,
		});
		await settle(5);
		expect((layout as unknown as LayoutContext).elementsLoaded).toBe(true);
		disconnect();
	});

	test("a section with items and no items pane says so once", async () => {
		const mounted = await mountKernelHost(
			[document.createElement("div")],
			sectionFixture({ passage: false }),
		);
		await until(
			() => pieceWarnings(mounted, "no <pie-section-player-items-pane>").length > 0,
			"the missing-pane warning",
		);
		await settle(10);
		expect(pieceWarnings(mounted, "no <pie-section-player-items-pane>")).toHaveLength(1);
		expect(mounted.count("pie-loading-complete")).toBe(0);
	});
});
