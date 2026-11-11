/**
 * `focus()` on `<pie-item-player>` puts focus in the item's first input.
 *
 * A page of short items, where Enter moves the learner to the next one, is the
 * case it serves: the host calls `focus()` on the next player from its own
 * keydown listener. The page mixes an element with a `focusFirstInput()` hook
 * whose input mounts asynchronously, as a lazily loaded math field does, an
 * element without one, and a real multiple-choice item.
 */

import { expect, test, type Page } from "@playwright/test";

const HOST_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student&player=preloaded";
const HOST_PROMPT = "Which is the largest planet in our solar system?";
const HOOK_TAG = "focus-probe-hooked";
const PLAIN_TAG = "focus-probe-plain";
// Long enough that the hook is still waiting on its input when it is called.
const HOOK_MOUNT_DELAY_MS = 400;

type ActiveFocus = {
	player: number;
	tag: string;
	type: string;
	label: string;
	focusVisible: boolean;
};

declare global {
	interface Window {
		__focusGrid: {
			loaded: number[];
			hookCalls: string[];
			results: boolean[];
			itemConfig(index: number, tag: string): unknown;
			addPlayer(config: unknown | null): HTMLElement;
			active(): ActiveFocus | null;
		};
	}
}

async function openHost(page: Page): Promise<void> {
	await page.goto(HOST_PATH, { waitUntil: "domcontentloaded" });
	await expect(page.getByText(HOST_PROMPT)).toBeVisible({ timeout: 30_000 });
	await page.evaluate(
		({ hookTag, plainTag, mountDelayMs }) => {
			const deepActive = (): Element | null => {
				let active = document.activeElement;
				while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
				return active;
			};
			const containsDeep = (root: Element, node: Node | null): boolean => {
				for (let at = node; at; at = at instanceof ShadowRoot ? at.host : at.parentNode) {
					if (at === root) return true;
				}
				return false;
			};

			// No class fields: Playwright transpiles this function, and private
			// fields compile to helpers the page does not have.
			type ProbeState = {
				model?: { label?: string };
				session?: unknown;
				mounted?: Promise<void>;
			};
			const state = (el: HTMLElement): ProbeState => {
				const holder = el as HTMLElement & { __probe?: ProbeState };
				holder.__probe ??= {};
				return holder.__probe;
			};
			const renderInput = (el: HTMLElement): void => {
				if (el.querySelector("input")) return;
				const input = document.createElement("input");
				input.setAttribute("aria-label", state(el).model?.label ?? "");
				el.append(input);
			};

			class PlainProbe extends HTMLElement {
				get session() {
					return state(this).session;
				}
				set session(value: unknown) {
					state(this).session = value;
				}
				get model() {
					return state(this).model;
				}
				set model(value: { label?: string } | undefined) {
					state(this).model = value;
					renderInput(this);
				}
			}

			class HookedProbe extends HTMLElement {
				get session() {
					return state(this).session;
				}
				set session(value: unknown) {
					state(this).session = value;
				}
				get model() {
					return state(this).model;
				}
				set model(value: { label?: string } | undefined) {
					const probe = state(this);
					probe.model = value;
					probe.mounted ??= new Promise((resolve) =>
						setTimeout(() => {
							renderInput(this);
							resolve();
						}, mountDelayMs),
					);
				}
				async focusFirstInput(options?: FocusOptions): Promise<boolean> {
					window.__focusGrid.hookCalls.push(this.id);
					const before = deepActive();
					await state(this).mounted;
					if (deepActive() !== before) return false;
					const input = this.querySelector("input");
					if (!input) return false;
					input.focus(options);
					return true;
				}
			}

			// Under `preloaded` the player renders each package's versioned tag.
			customElements.define(`${plainTag}--version-1-0-0`, PlainProbe);
			customElements.define(`${hookTag}--version-1-0-0`, HookedProbe);

			const grid = document.createElement("section");
			grid.id = "focus-grid";
			grid.setAttribute("aria-label", "Facts");
			document.body.append(grid);

			const hostPlayer = document.querySelector("pie-item-player") as HTMLElement & {
				config: { markup: string; elements: Record<string, string>; models: Array<{ id: string }> };
			};
			const players = () => Array.from(grid.querySelectorAll("pie-item-player"));

			window.__focusGrid = {
				loaded: [],
				hookCalls: [],
				results: [],
				itemConfig(index, tag) {
					if (tag === "multiple-choice") {
						const source = structuredClone(hostPlayer.config);
						const id = `fact-${index}`;
						return {
							...source,
							markup: `<multiple-choice id="${id}"></multiple-choice>`,
							models: source.models.map((model) => ({ ...model, id })),
						};
					}
					const id = `fact-${index}`;
					return {
						id: `item-${index}`,
						markup: `<p>Fact ${index + 1}</p><${tag} id="${id}"></${tag}>`,
						elements: { [tag]: `@pie-element/${tag}@1.0.0` },
						models: [{ id, element: tag, label: `Fact ${index + 1}` }],
					};
				},
				addPlayer(config) {
					const player = document.createElement("pie-item-player") as HTMLElement &
						Record<string, unknown>;
					player.strategy = "preloaded";
					player.env = { mode: "gather", role: "student" };
					player.session = { id: `session-${players().length}`, data: [] };
					const index = players().length;
					player.addEventListener("load-complete", () =>
						window.__focusGrid.loaded.push(index),
					);
					grid.append(player);
					if (config) player.config = config;
					return player;
				},
				active() {
					const node = deepActive();
					if (!node || node === document.body) return null;
					return {
						player: players().findIndex((player) => containsDeep(player, node)),
						tag: node.localName,
						type: node.getAttribute("type") ?? "",
						label:
							node.getAttribute("aria-label") ??
							node.closest("label")?.textContent?.trim() ??
							"",
						focusVisible: node.matches(":focus-visible"),
					};
				},
			};

			// The host's own handler: Enter in one item moves to the next.
			grid.addEventListener("keydown", (event) => {
				if (event.key !== "Enter") return;
				const list = players();
				const index = list.findIndex((player) => containsDeep(player, event.target as Node));
				const next = list[index + 1] as (HTMLElement & { focus(): Promise<boolean> }) | undefined;
				if (index < 0 || !next) return;
				event.preventDefault();
				void next.focus().then((result) => window.__focusGrid.results.push(result));
			});
		},
		{ hookTag: HOOK_TAG, plainTag: PLAIN_TAG, mountDelayMs: HOOK_MOUNT_DELAY_MS },
	);
}

const active = (page: Page) => page.evaluate(() => window.__focusGrid.active());

test.describe("item-player focus()", () => {
	test("Enter moves focus through a page of items", async ({ page }) => {
		await openHost(page);
		const tags = [HOOK_TAG, PLAIN_TAG, HOOK_TAG, "multiple-choice"];
		await page.evaluate((list) => {
			list.forEach((tag, index) =>
				window.__focusGrid.addPlayer(window.__focusGrid.itemConfig(index, tag)),
			);
		}, tags);
		await expect
			.poll(() => page.evaluate(() => window.__focusGrid.loaded.length), { timeout: 20_000 })
			.toBe(tags.length);

		const first = await page.evaluate(() =>
			(document.querySelector("#focus-grid pie-item-player") as HTMLElement & {
				focus(): Promise<boolean>;
			}).focus(),
		);
		expect(first).toBe(true);
		expect(await active(page)).toMatchObject({ player: 0, tag: "input", label: "Fact 1" });

		for (const [index, label] of [
			[1, "Fact 2"],
			[2, "Fact 3"],
		] as const) {
			await page.keyboard.type(String(index));
			await page.keyboard.press("Enter");
			await expect.poll(() => active(page)).toMatchObject({ player: index, tag: "input", label });
		}

		await page.keyboard.press("Enter");
		await expect
			.poll(() => active(page))
			.toMatchObject({ player: 3, tag: "input", type: "radio" });
		expect((await active(page))?.label).toContain("Mercury");
		// The indicator a Tab would show: focus moved by keyboard is focus-visible.
		expect((await active(page))?.focusVisible).toBe(true);

		const { results, hookCalls } = await page.evaluate(() => ({
			results: window.__focusGrid.results,
			hookCalls: window.__focusGrid.hookCalls,
		}));
		expect(results).toEqual([true, true, true]);
		expect(hookCalls).toEqual(["fact-0", "fact-2"]);
	});

	test("a call made while the item loads focuses once it has loaded", async ({ page }) => {
		await openHost(page);
		await page.evaluate(() => {
			const player = window.__focusGrid.addPlayer(null) as HTMLElement & {
				focus(): Promise<boolean>;
				config: unknown;
			};
			void player.focus().then((result) => window.__focusGrid.results.push(result));
			setTimeout(() => {
				player.config = window.__focusGrid.itemConfig(0, "focus-probe-plain");
			}, 200);
		});
		await expect.poll(() => page.evaluate(() => window.__focusGrid.results)).toEqual([true]);
		expect(await active(page)).toMatchObject({ player: 0, label: "Fact 1" });
	});

	test("focus the learner moves while the item loads stays where they put it", async ({
		page,
	}) => {
		await openHost(page);
		await page.evaluate(() => {
			const outside = document.createElement("input");
			outside.setAttribute("aria-label", "Notes");
			document.body.append(outside);
			const player = window.__focusGrid.addPlayer(null) as HTMLElement & {
				focus(): Promise<boolean>;
				config: unknown;
			};
			void player.focus().then((result) => window.__focusGrid.results.push(result));
			outside.focus();
			player.config = window.__focusGrid.itemConfig(0, "focus-probe-plain");
		});
		await expect.poll(() => page.evaluate(() => window.__focusGrid.results)).toEqual([false]);
		await expect(page.getByRole("textbox", { name: "Notes" })).toBeFocused();
	});

	test("resolves false, without throwing, on a player that is not in the document", async ({
		page,
	}) => {
		await openHost(page);
		const result = await page.evaluate(() =>
			(document.createElement("pie-item-player") as HTMLElement & {
				focus(): Promise<boolean>;
			}).focus(),
		);
		expect(result).toBe(false);
	});
});
