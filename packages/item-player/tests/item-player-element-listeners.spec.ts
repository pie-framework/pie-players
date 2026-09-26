/**
 * What the built player forwards of its elements' own events, against synthetic
 * elements. The delivery element announces from its `session` setter, as
 * `defineDeliveryElement` elements do, and the configure element announces its
 * model from its `configuration` setter, as multiple-choice's does. Both
 * therefore dispatch during the renderer's own initialization, before
 * `load-complete`.
 */

import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, resolve, sep } from "node:path";

const distDir = resolve(import.meta.dirname, "../dist");
const probes = [
	{
		id: "a",
		tag: "element-probe-a--version-1-0-0",
		pkg: "@pie-element/element-probe-a@1.0.0",
	},
	{
		id: "b",
		tag: "element-probe-b--version-1-0-0",
		pkg: "@pie-element/element-probe-b@1.0.0",
	},
];
let server: Server;
let origin: string;

type HostSession = {
	data?: Array<{ id?: string; value?: string[] }>;
} | null;

type HostSessionEvent = {
	fromElement: boolean;
	hasSessionKey: boolean;
	intent: unknown;
	session: HostSession;
};

declare global {
	interface Window {
		__sessionEvents: HostSessionEvent[];
		__modelUpdates: unknown[];
		__announcedBeforeLoad: number | null;
		__lastEventAt: number;
	}
}

test.beforeAll(async () => {
	server = createServer((request, response) => {
		void (async () => {
			const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
			if (pathname === "/") {
				response.writeHead(200, { "content-type": "text/html" });
				response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
					<title>Element listeners</title><link rel="icon" href="data:,">
					<main></main></html>`);
				return;
			}
			if (!pathname.startsWith("/dist/")) {
				response.writeHead(404).end();
				return;
			}
			const filename = resolve(
				distDir,
				`.${decodeURIComponent(pathname.slice("/dist".length))}`,
			);
			if (!filename.startsWith(`${distDir}${sep}`)) {
				response.writeHead(404).end();
				return;
			}
			try {
				const data = await readFile(filename);
				const mime: Record<string, string> = {
					".js": "text/javascript",
					".css": "text/css",
				};
				response.writeHead(200, {
					"content-type": mime[extname(filename)] ?? "application/octet-stream",
				});
				response.end(data);
			} catch {
				response.writeHead(404).end();
			}
		})().catch(() => response.writeHead(500).end());
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Static server did not bind");
	}
	origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
	if (server) await new Promise<void>((done) => server.close(() => done()));
});

// Each forwarded change hands the elements their entries again, and each
// element announces again from its setter; wait those rounds out.
const settle = (page: Page) =>
	page.waitForFunction(() => performance.now() - window.__lastEventAt > 300);

async function mountPlayer(
	page: Page,
	options: { mode: "view" | "author"; session?: unknown },
): Promise<void> {
	await page.route("**/*", (route) =>
		new URL(route.request().url()).origin === origin
			? route.continue()
			: route.abort(),
	);
	await page.goto(origin);
	await page.evaluate(
		async ({ mode, hostSession, probes }) => {
			let announcements = 0;
			window.__sessionEvents = [];
			window.__modelUpdates = [];
			window.__announcedBeforeLoad = null;
			window.__lastEventAt = performance.now();
			const emit = (element: HTMLElement, type: string, detail: unknown) => {
				announcements += 1;
				element.dispatchEvent(
					new CustomEvent(type, { bubbles: true, composed: true, detail }),
				);
			};
			class DeliveryProbe extends HTMLElement {
				probeSession: any;
				set model(_value: unknown) {}
				set session(value: any) {
					this.probeSession = value;
					this.announce();
				}
				get session() {
					return this.probeSession;
				}
				answer(value: string) {
					this.probeSession.value = [value];
					this.announce();
				}
				announce() {
					emit(this, "session-changed", {
						complete: (this.probeSession?.value ?? []).length > 0,
						component: this.localName,
					});
				}
			}
			class ConfigureProbe extends HTMLElement {
				probeModel: any;
				set model(value: any) {
					this.probeModel = value;
				}
				get model() {
					return this.probeModel;
				}
				set configuration(_value: unknown) {
					this.announce();
				}
				edit(prompt: string) {
					this.probeModel = { ...this.probeModel, prompt };
					this.announce();
				}
				announce() {
					emit(this, "model.updated", { update: this.probeModel, reset: false });
				}
			}
			for (const { tag } of probes) {
				customElements.define(tag, class extends DeliveryProbe {});
				customElements.define(`${tag}-config`, class extends ConfigureProbe {});
			}
			const entry = "/dist/pie-item-player.js";
			await import(entry);
			const player = document.createElement("pie-item-player") as any;
			player.addEventListener("load-complete", () => {
				window.__lastEventAt = performance.now();
				window.__announcedBeforeLoad = announcements;
			});
			player.addEventListener("session-changed", (event: Event) => {
				window.__lastEventAt = performance.now();
				const detail = ((event as CustomEvent).detail ?? {}) as Record<
					string,
					unknown
				>;
				window.__sessionEvents.push({
					fromElement: event.target instanceof DeliveryProbe,
					hasSessionKey: "session" in detail,
					intent: detail.intent ?? null,
					session: JSON.parse(JSON.stringify(detail.session ?? null)),
				});
			});
			player.addEventListener("model-updated", (event: Event) => {
				window.__lastEventAt = performance.now();
				window.__modelUpdates.push(
					(event as CustomEvent).detail?.update?.prompt ?? null,
				);
			});
			player.strategy = "preloaded";
			player.mode = mode;
			player.env = { mode: "gather", role: "student" };
			if (hostSession) player.session = hostSession;
			player.config = {
				id: "element-listeners-item",
				elements: Object.fromEntries(probes.map(({ tag, pkg }) => [tag, pkg])),
				markup: probes.map(({ id, tag }) => `<${tag} id="${id}"></${tag}>`).join(""),
				models: probes.map(({ id, tag }) => ({ id, element: tag })),
			};
			document.querySelector("main")?.appendChild(player);
		},
		{ mode: options.mode, hostSession: options.session ?? null, probes },
	);
	await page.waitForFunction(() => window.__announcedBeforeLoad !== null);
	await settle(page);
}

const valuesOf = (session: HostSession) =>
	Object.fromEntries(
		(session?.data ?? []).map((entry) => [entry.id, entry.value]),
	);

test.describe("delivery", () => {
	test("an element announcing from its session setter during load reaches the host only as a canonical event", async ({
		page,
	}) => {
		await mountPlayer(page, {
			mode: "view",
			session: {
				id: "attempt-1",
				data: [
					{ id: "a", element: "element-probe-a", value: ["x"] },
					{ id: "b", element: "element-probe-b", value: ["y"] },
				],
			},
		});
		expect(
			await page.evaluate(() => window.__announcedBeforeLoad),
		).toBeGreaterThan(0);
		const events = await page.evaluate(() => window.__sessionEvents);
		expect(events.length).toBeGreaterThan(0);
		expect(
			events.filter(
				(event) =>
					event.fromElement ||
					!event.hasSessionKey ||
					(event.session === null && event.intent !== "metadata-only"),
			),
		).toEqual([]);
	});

	test("two elements announcing in one task both reach the host", async ({
		page,
	}) => {
		await mountPlayer(page, {
			mode: "view",
			session: { id: "attempt-2", data: [] },
		});
		await page.evaluate(
			({ probes }) => {
				window.__sessionEvents.length = 0;
				for (const [index, { tag }] of probes.entries()) {
					(document.querySelector(tag) as any).answer(["x", "y"][index]);
				}
			},
			{ probes },
		);
		await expect
			.poll(async () =>
				valuesOf(
					await page.evaluate(
						() => (document.querySelector("pie-item-player") as any).session,
					),
				),
			)
			.toEqual({ a: ["x"], b: ["y"] });
		await settle(page);
		const announced = (await page.evaluate(() => window.__sessionEvents)).filter(
			(event) => event.session !== null,
		);
		expect(valuesOf(announced.at(-1)?.session ?? null)).toEqual({
			a: ["x"],
			b: ["y"],
		});
	});
});

test.describe("authoring", () => {
	test("forwards edits, including two in one task, and not the models announced during initialization", async ({
		page,
	}) => {
		await mountPlayer(page, { mode: "author" });
		expect(
			await page.evaluate(() => window.__announcedBeforeLoad),
		).toBeGreaterThan(0);
		expect(await page.evaluate(() => window.__modelUpdates)).toEqual([]);
		await page.evaluate(
			({ probes }) => {
				for (const [index, { tag }] of probes.entries()) {
					(document.querySelector(`${tag}-config`) as any).edit(
						["first edit", "second edit"][index],
					);
				}
			},
			{ probes },
		);
		await expect
			.poll(() => page.evaluate(() => window.__modelUpdates))
			.toEqual(["first edit", "second edit"]);
	});
});
