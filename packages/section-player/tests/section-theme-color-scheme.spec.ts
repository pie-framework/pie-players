import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const TOKENS_CSS = readFileSync(
	new URL("../../theme/src/tokens.css", import.meta.url),
	"utf8",
);
const COLOR_SCHEMES_CSS = readFileSync(
	new URL("../../theme/src/color-schemes.css", import.meta.url),
	"utf8",
);

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
}

/**
 * Resolve once every CSS transition running on `locator` and its descendants has
 * finished, so a colour read lands on the resting value rather than an
 * interpolated `oklab()` mix. A fixed pause cannot do this: the tab ink and pill
 * fill ease over 150ms, and an `ease` curve is still moving at 130ms while
 * sitting close enough to the resting pair to pass most runs.
 *
 * `finished` rejects with an AbortError when a transition is cancelled -- a
 * second style change landing mid-flight -- which is settled for this purpose.
 */
async function settleTransitions(locator: Locator) {
	await locator.evaluate(async (element: Element) => {
		// Transitions start on the next style recalculation, so yield two frames
		// before collecting them or there is nothing yet to await.
		await new Promise((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(resolve)),
		);
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});
}

test.describe("section theme and color scheme integration", () => {
	test("keeps stylesheet-only built-in and host schemes in the normal cascade", async ({
		page,
	}) => {
		await page.setContent("<main>CSS adapter probe</main>");
		const result = await page.evaluate(
			({ tokensCss, schemesCss }) => {
				const frame = document.createElement("iframe");
				document.body.append(frame);
				const frameDocument = frame.contentDocument;
				if (!frameDocument) throw new Error("CSS probe iframe unavailable");
				frameDocument.open();
				frameDocument.write(
					`<style>${tokensCss}\n${schemesCss}\n` +
						'[data-color-scheme="host-css-only"] { --pie-primary: #123456; }</style>' +
						'<pie-theme id="built-in" theme="light" data-color-scheme="white-on-black"></pie-theme>' +
						'<pie-theme id="host-css-only" theme="light" data-color-scheme="host-css-only" style="--pie-tool-trigger-active-color: host-optional-value"></pie-theme>',
				);
				frameDocument.close();
				const builtIn = frameDocument.querySelector("#built-in");
				const hostCssOnly = frameDocument.querySelector("#host-css-only");
				if (!builtIn || !hostCssOnly) {
					throw new Error("CSS probe elements unavailable");
				}
				const builtInStyle = frame.contentWindow?.getComputedStyle(builtIn);
				const hostStyle = frame.contentWindow?.getComputedStyle(hostCssOnly);
				return {
					builtIn: {
						background: builtInStyle
							?.getPropertyValue("--pie-background")
							.trim(),
						primary: builtInStyle?.getPropertyValue("--pie-primary").trim(),
					},
					hostCssOnly: {
						primary: hostStyle?.getPropertyValue("--pie-primary").trim(),
						optional: hostStyle
							?.getPropertyValue("--pie-tool-trigger-active-color")
							.trim(),
					},
				};
			},
			{ tokensCss: TOKENS_CSS, schemesCss: COLOR_SCHEMES_CSS },
		);

		expect(result).toEqual({
			builtIn: {
				background: "#000000",
				primary: "#ffff00",
			},
			hostCssOnly: {
				primary: "#123456",
				optional: "host-optional-value",
			},
		});
	});

	test("requires important for CSS-only rules competing with mounted runtime tokens", async ({
		page,
	}) => {
		await gotoDemo(page);

		const result = await page.evaluate(() => {
			const style = document.createElement("style");
			style.textContent = `
				[data-color-scheme="host-css-normal"] {
					--pie-primary: #123456;
				}
				[data-color-scheme="host-css-important"] {
					--pie-primary: #654321 !important;
				}
			`;
			document.head.append(style);

			const themeHost = document.querySelector('pie-theme[scope="document"]');
			if (!themeHost) throw new Error("Document theme host unavailable");

			themeHost.setAttribute("theme", "light");
			themeHost.setAttribute("provider", "none");
			themeHost.setAttribute("scheme", "host-css-normal");
			const normal = getComputedStyle(document.documentElement)
				.getPropertyValue("--pie-primary")
				.trim();
			const normalRequest =
				document.documentElement.getAttribute("data-color-scheme");

			themeHost.setAttribute("scheme", "host-css-important");
			const important = getComputedStyle(document.documentElement)
				.getPropertyValue("--pie-primary")
				.trim();

			return { normal, normalRequest, important };
		});

		expect(result).toEqual({
			normal: "#3f51b5",
			normalRequest: "host-css-normal",
			important: "#654321",
		});
	});

	test("propagates themed css variables to light and shadow dom", async ({
		page,
	}) => {
		await gotoDemo(page);

		const vars = await page.evaluate(() => {
			const themeHost = document.querySelector("pie-theme");
			if (!themeHost) {
				return { light: "", shadow: "" };
			}
			themeHost.setAttribute("scheme", "white-on-black");

			const lightNode = document.createElement("div");
			lightNode.id = "light-dom-theme-probe";
			document.body.appendChild(lightNode);

			const shadowHost = document.createElement("div");
			shadowHost.id = "shadow-dom-theme-host";
			const root = shadowHost.attachShadow({ mode: "open" });
			const shadowNode = document.createElement("span");
			shadowNode.id = "shadow-dom-theme-probe";
			root.appendChild(shadowNode);
			document.body.appendChild(shadowHost);

			return {
				light: getComputedStyle(lightNode)
					.getPropertyValue("--pie-primary")
					.trim(),
				shadow: getComputedStyle(shadowNode)
					.getPropertyValue("--pie-primary")
					.trim(),
			};
		});

		expect(vars.light).toBeTruthy();
		expect(vars.light).toBe("#ffff00");
		expect(vars.shadow).toBe(vars.light);
	});

	test("updates existing light and shadow nodes when scheme switches", async ({
		page,
	}) => {
		await gotoDemo(page);

		const vars = await page.evaluate(() => {
			const themeHost = document.querySelector("pie-theme");
			if (!themeHost) {
				return {
					blackOnWhite: { light: "", shadow: "" },
					whiteOnBlack: { light: "", shadow: "" },
				};
			}

			const lightNode = document.createElement("div");
			lightNode.id = "light-dom-theme-switch-probe";
			document.body.appendChild(lightNode);

			const shadowHost = document.createElement("div");
			shadowHost.id = "shadow-dom-theme-switch-host";
			const root = shadowHost.attachShadow({ mode: "open" });
			const shadowNode = document.createElement("span");
			shadowNode.id = "shadow-dom-theme-switch-probe";
			root.appendChild(shadowNode);
			document.body.appendChild(shadowHost);

			const readVars = () => ({
				light: getComputedStyle(lightNode)
					.getPropertyValue("--pie-primary")
					.trim(),
				shadow: getComputedStyle(shadowNode)
					.getPropertyValue("--pie-primary")
					.trim(),
			});

			themeHost.setAttribute("scheme", "black-on-white");
			const blackOnWhite = readVars();
			themeHost.setAttribute("scheme", "white-on-black");
			const whiteOnBlack = readVars();

			return { blackOnWhite, whiteOnBlack };
		});

		expect(vars.blackOnWhite.light).toBeTruthy();
		expect(vars.blackOnWhite.shadow).toBe(vars.blackOnWhite.light);
		expect(vars.whiteOnBlack.light).toBe("#ffff00");
		expect(vars.whiteOnBlack.shadow).toBe(vars.whiteOnBlack.light);
		expect(vars.whiteOnBlack.light).not.toBe(vars.blackOnWhite.light);
	});

	test("offers the low-glare schemes in the theme picker and applies them", async ({
		page,
	}) => {
		const SCHEMES = [
			{
				id: "grey-on-light-grey",
				name: "Grey on Light Grey",
				bg: "rgb(235, 235, 235)",
				text: "rgb(74, 74, 74)",
			},
			{
				id: "purple-on-light-green",
				name: "Purple on Light Green",
				bg: "rgb(204, 232, 212)",
				text: "rgb(142, 36, 100)",
			},
			{
				id: "black-on-violet",
				name: "Black on Violet",
				bg: "rgb(212, 169, 222)",
				text: "rgb(0, 0, 0)",
			},
			{
				id: "yellow-on-navy",
				name: "Yellow on Navy",
				bg: "rgb(51, 80, 138)",
				text: "rgb(255, 255, 85)",
			},
		];

		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();
		const themeTool = page.locator("pie-tool-theme").first();
		await expect(themeTool).toBeVisible();
		await themeTool.getByRole("button", { name: "Select theme" }).click();

		// The picker derives its list from listPieColorSchemes(), so every
		// registered scheme has to show up as a menu item.
		for (const scheme of SCHEMES) {
			await expect(
				themeTool.getByRole("menuitem", { name: scheme.name, exact: true }),
				`${scheme.name} listed in picker`,
			).toBeVisible();
		}

		// Selecting through the picker applies the scheme's tokens...
		await themeTool
			.getByRole("menuitem", { name: SCHEMES[0].name, exact: true })
			.click();
		const readApplied = async (schemeId?: string) =>
			await page.evaluate(async (id) => {
				if (id) {
					const host =
						document.querySelector('pie-theme[scope="document"]') ||
						document.querySelector("pie-theme");
					host?.setAttribute("scheme", id);
				}
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
				const probe = document.createElement("div");
				probe.style.color = "var(--pie-text)";
				probe.style.backgroundColor = "var(--pie-background)";
				document.body.appendChild(probe);
				const computed = getComputedStyle(probe);
				const applied = {
					bg: computed.backgroundColor,
					text: computed.color,
				};
				probe.remove();
				return applied;
			}, schemeId);

		const viaPicker = await readApplied();
		expect(viaPicker.bg).toBe(SCHEMES[0].bg);
		expect(viaPicker.text).toBe(SCHEMES[0].text);

		// ...and each scheme resolves its background/text pair.
		for (const scheme of SCHEMES) {
			const applied = await readApplied(scheme.id);
			expect(applied.bg, `${scheme.id} background`).toBe(scheme.bg);
			expect(applied.text, `${scheme.id} text`).toBe(scheme.text);
		}
	});

	test("keeps every built-in picker state at its named contrast threshold", async ({
		page,
	}) => {
		const schemeIds = [
			"black-on-white",
			"white-on-black",
			"rose-on-green",
			"yellow-on-blue",
			"black-on-rose",
			"light-gray-on-dark-gray",
			"grey-on-light-grey",
			"purple-on-light-green",
			"black-on-violet",
			"yellow-on-navy",
		];

		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();
		const themeTool = page.locator("pie-tool-theme").first();
		await themeTool.getByRole("button", { name: "Select theme" }).click();
		const options = themeTool.locator(".pie-tool-color-scheme__option");
		const activeOption = themeTool.locator(
			".pie-tool-color-scheme__option--active",
		);
		const hoverOption = options.nth(1);
		const contrastProbe = await page.evaluateHandle(() => {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const context = canvas.getContext("2d", { willReadFrequently: true });
			if (!context) throw new Error("Canvas color parser unavailable");
			return {
				ratio(foreground: string, background: string) {
					const parse = (value: string) => {
						context.clearRect(0, 0, 1, 1);
						context.fillStyle = "rgba(1, 2, 3, 0.5)";
						context.fillStyle = value;
						context.fillRect(0, 0, 1, 1);
						return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
					};
					const luminance = (value: string) => {
						const channels = parse(value).map((channel) => {
							const normalized = channel / 255;
							return normalized <= 0.04045
								? normalized / 12.92
								: ((normalized + 0.055) / 1.055) ** 2.4;
						});
						return (
							0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
						);
					};
					const a = luminance(foreground);
					const b = luminance(background);
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				},
			};
		});

		for (const schemeId of schemeIds) {
			await page.evaluate(async (id) => {
				const host =
					document.querySelector('pie-theme[scope="document"]') ||
					document.querySelector("pie-theme");
				host?.setAttribute("scheme", id);
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
			}, schemeId);
			await page.waitForTimeout(200);

			await hoverOption.hover();
			await page.waitForTimeout(200);
			await page.keyboard.press("Tab");
			await activeOption.focus();
			const states = await themeTool.evaluate((element) => {
				const root = element.shadowRoot;
				if (!root) throw new Error("Theme tool has no shadow root");
				const find = <T extends Element>(selector: string) => {
					const match = root.querySelector<T>(selector);
					if (!match) throw new Error(`Missing ${selector}`);
					return match;
				};
				const allOptions = root.querySelectorAll<HTMLElement>(
					".pie-tool-color-scheme__option",
				);
				const active = find<HTMLElement>(
					".pie-tool-color-scheme__option--active",
				);
				const activeStyle = getComputedStyle(active);
				const hoverStyle = getComputedStyle(allOptions[1]);
				const normalStyle = getComputedStyle(allOptions[2]);
				const dropdownStyle = getComputedStyle(
					find<HTMLElement>(".pie-tool-color-scheme__dropdown"),
				);
				return {
					active: {
						color: activeStyle.color,
						background: activeStyle.backgroundColor,
						outline: activeStyle.outlineColor,
						outlineStyle: activeStyle.outlineStyle,
						name: getComputedStyle(
							find<HTMLElement>(
								".pie-tool-color-scheme__option--active .pie-tool-color-scheme__name",
							),
						).color,
						description: getComputedStyle(
							find<HTMLElement>(
								".pie-tool-color-scheme__option--active .pie-tool-color-scheme__description",
							),
						).color,
						check: getComputedStyle(
							find<HTMLElement>(".pie-tool-color-scheme__check"),
						).color,
					},
					hover: {
						color: hoverStyle.color,
						background: hoverStyle.backgroundColor,
					},
					normal: {
						color: normalStyle.color,
						background: dropdownStyle.backgroundColor,
					},
				};
			});

			const ratios = await contrastProbe.evaluate(
				(probe, values) => ({
					active: probe.ratio(values.active.color, values.active.background),
					hover: probe.ratio(values.hover.color, values.hover.background),
					normal: probe.ratio(values.normal.color, values.normal.background),
					focus: probe.ratio(values.active.outline, values.active.background),
				}),
				states,
			);
			expect(
				ratios.active,
				`${schemeId} selected text (${states.active.color} on ${states.active.background})`,
			).toBeGreaterThanOrEqual(4.5);
			expect(states.active.name).toBe(states.active.color);
			expect(states.active.description).toBe(states.active.color);
			expect(states.active.check).toBe(states.active.color);
			expect(ratios.hover, `${schemeId} hover text`).toBeGreaterThanOrEqual(
				4.5,
			);
			expect(
				ratios.normal,
				`${schemeId} ordinary option text`,
			).toBeGreaterThanOrEqual(4.5);
			expect(states.active.outlineStyle).not.toBe("none");
			expect(
				ratios.focus,
				`${schemeId} selected focus indicator (${states.active.outline} on ${states.active.background})`,
			).toBeGreaterThanOrEqual(3);
		}
	});

	test("keeps selected picker text legible through the DaisyUI provider", async ({
		page,
	}) => {
		await gotoDemo(page);
		await page.evaluate(async () => {
			document.documentElement.setAttribute("data-theme", "valentine");
			const host =
				document.querySelector('pie-theme[scope="document"]') ||
				document.querySelector("pie-theme");
			host?.setAttribute("theme", "valentine");
			host?.setAttribute("scheme", "default");
			await new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			);
		});
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();

		const themeTool = page.locator("pie-tool-theme").first();
		await themeTool.getByRole("button", { name: "Select theme" }).click();
		const activeOption = themeTool.locator(
			".pie-tool-color-scheme__option--active",
		);
		const result = await activeOption.evaluate((element) => {
			const computed = getComputedStyle(element);
			const rootStyle = getComputedStyle(document.documentElement);
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const context = canvas.getContext("2d", { willReadFrequently: true });
			if (!context) throw new Error("Canvas color parser unavailable");
			const luminance = (value: string) => {
				context.clearRect(0, 0, 1, 1);
				context.fillStyle = value;
				context.fillRect(0, 0, 1, 1);
				const channels = [
					...context.getImageData(0, 0, 1, 1).data.slice(0, 3),
				].map((channel) => {
					const normalized = channel / 255;
					return normalized <= 0.04045
						? normalized / 12.92
						: ((normalized + 0.055) / 1.055) ** 2.4;
				});
				return (
					0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
				);
			};
			const foreground = luminance(computed.color);
			const background = luminance(computed.backgroundColor);
			return {
				color: computed.color,
				background: computed.backgroundColor,
				pieButtonColor: rootStyle.getPropertyValue("--pie-button-color").trim(),
				daisyBaseContent: rootStyle
					.getPropertyValue("--color-base-content")
					.trim(),
				ratio:
					(Math.max(foreground, background) + 0.05) /
					(Math.min(foreground, background) + 0.05),
			};
		});

		expect(result.pieButtonColor).toBe(result.daisyBaseContent);
		expect(
			result.ratio,
			`DaisyUI valentine selected text (${result.color} on ${result.background})`,
		).toBeGreaterThanOrEqual(4.5);
	});

	test("keeps the passage/questions toggle legible in every built-in scheme", async ({
		page,
	}) => {
		// The unselected tab paints no fill of its own, so its ink is measured
		// against whichever surface shows through: the track's background when that
		// is opaque, and the frame behind it when the light Base Theme leaves the
		// track transparent.
		const schemeIds = [
			"default",
			"black-on-white",
			"white-on-black",
			"rose-on-green",
			"yellow-on-blue",
			"black-on-rose",
			"light-gray-on-dark-gray",
			"grey-on-light-grey",
			"purple-on-light-green",
			"black-on-violet",
			"yellow-on-navy",
		];

		// The dedicated `/tabbed-layout/*` routes mount the player without the demo
		// chrome, so they carry no `pie-theme` host and every token would fall back
		// to its literal -- which would pass this loop without measuring a scheme at
		// all. The splitpane demo collapses to the same toggle inside the chrome.
		await page.setViewportSize({ width: 900, height: 900 });
		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await expectDemoChromeReady(page);
		const unselectedTab = page.getByRole("tab", { name: "Questions" });
		const toggleTrack = page.locator(".pie-section-player-tabs").first();
		await expect(unselectedTab).toBeVisible();
		expect(
			await page.evaluate(() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--pie-text")
					.trim(),
			),
			"themed host required, or the loop below measures only CSS literals",
		).not.toBe("");

		for (const schemeId of schemeIds) {
			await page.evaluate(async (id) => {
				const host =
					document.querySelector('pie-theme[scope="document"]') ||
					document.querySelector("pie-theme");
				host?.setAttribute("scheme", id);
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
			}, schemeId);
			await settleTransitions(toggleTrack);

			const measured = await unselectedTab.evaluate((tab) => {
				const track = tab.closest<HTMLElement>(".pie-section-player-tabs");
				const frame = tab.closest<HTMLElement>(
					".pie-section-player-tabbed-content",
				);
				if (!track || !frame) throw new Error("Toggle track not found");
				const canvas = document.createElement("canvas");
				canvas.width = 1;
				canvas.height = 1;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) throw new Error("Canvas color parser unavailable");
				const parse = (value: string) => {
					context.clearRect(0, 0, 1, 1);
					context.fillStyle = "rgba(1, 2, 3, 0.5)";
					context.fillStyle = value;
					context.fillRect(0, 0, 1, 1);
					return [...context.getImageData(0, 0, 1, 1).data];
				};
				const opaque = (value: string) => parse(value)[3] === 255;
				const luminance = (value: string) => {
					const channels = parse(value)
						.slice(0, 3)
						.map((channel) => {
							const normalized = channel / 255;
							return normalized <= 0.04045
								? normalized / 12.92
								: ((normalized + 0.055) / 1.055) ** 2.4;
						});
					return (
						0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
					);
				};
				const ratio = (foreground: string, background: string) => {
					const a = luminance(foreground);
					const b = luminance(background);
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				};
				const trackStyle = getComputedStyle(track);
				const frameStyle = getComputedStyle(frame);
				const surface = opaque(trackStyle.backgroundColor)
					? trackStyle.backgroundColor
					: frameStyle.backgroundColor;
				const tabStyle = getComputedStyle(tab);
				const selected = track.querySelector<HTMLElement>(
					".pie-section-player-tab--active",
				);
				if (!selected) throw new Error("Selected tab not found");
				const selectedStyle = getComputedStyle(selected);
				return {
					color: tabStyle.color,
					surface,
					border: trackStyle.borderTopColor,
					selectedColor: selectedStyle.color,
					selectedFill: selectedStyle.backgroundColor,
					text: ratio(tabStyle.color, surface),
					boundary: ratio(
						trackStyle.borderTopColor,
						frameStyle.backgroundColor,
					),
					selectedText: ratio(
						selectedStyle.color,
						selectedStyle.backgroundColor,
					),
					selectedFillAgainstTrack: ratio(
						selectedStyle.backgroundColor,
						surface,
					),
				};
			});

			// Chromium interpolates a colour transition in oklab, so an `oklab()`
			// computed value here means the read landed mid-flight and the ratios
			// below describe a frame no learner rests on: the selected pair measured
			// 4.19:1 in flight against 5.44:1 settled under Light Gray on Dark Gray.
			for (const [label, value] of Object.entries({
				"unselected ink": measured.color,
				surface: measured.surface,
				"selected ink": measured.selectedColor,
				"selected fill": measured.selectedFill,
			})) {
				expect(
					value,
					`${schemeId} ${label} was read while transitioning (${value})`,
				).not.toContain("oklab(");
			}

			expect(
				measured.text,
				`${schemeId} unselected tab text (${measured.color} on ${measured.surface})`,
			).toBeGreaterThanOrEqual(4.5);
			expect(
				measured.boundary,
				`${schemeId} toggle track boundary (${measured.border})`,
			).toBeGreaterThanOrEqual(3);
			expect(
				measured.selectedText,
				`${schemeId} selected tab text (${measured.selectedColor} on ${measured.selectedFill})`,
			).toBeGreaterThanOrEqual(4.5);
			// The pill is what marks the selection, so it owes 1.4.11's non-text
			// minimum against the track. `default` is exempt: no scheme is asking for
			// a palette, so the fill stays the pinned brand hue.
			if (schemeId !== "default") {
				expect(
					measured.selectedFillAgainstTrack,
					`${schemeId} selected pill against the track (${measured.selectedFill} on ${measured.surface})`,
				).toBeGreaterThanOrEqual(3);
			}
		}
	});

	test("supports menu keyboard navigation and returns focus on Escape", async ({
		page,
	}) => {
		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();

		const themeTool = page.locator("pie-tool-theme").first();
		const trigger = themeTool.getByRole("button", { name: "Select theme" });
		await trigger.click();

		await page.keyboard.press("ArrowDown");
		const defaultOption = themeTool.getByRole("menuitem", {
			name: "Default",
			exact: true,
		});
		await expect(defaultOption).toBeFocused();

		await page.keyboard.press("ArrowDown");
		await expect(
			themeTool.getByRole("menuitem", {
				name: "Black on White",
				exact: true,
			}),
		).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(themeTool.getByRole("menu")).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});

	test("keeps a persisted unavailable scheme visible without making it selectable", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.localStorage.setItem("pie-color-scheme", "district-retired");
		});
		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();

		const themeTool = page.locator("pie-tool-theme").first();
		await expect(themeTool.getByRole("status")).toContainText(
			"selected theme is unavailable",
		);

		const trigger = themeTool.getByRole("button", {
			name: /Unavailable theme: district-retired/,
		});
		await trigger.click();
		const unavailableOption = themeTool.getByRole("menuitem", {
			name: "Unavailable theme: district-retired, unavailable",
			exact: true,
		});
		await expect(unavailableOption).toBeVisible();
		await expect(unavailableOption).toBeDisabled();
		await expect(page.locator('pie-theme[scope="document"]')).toHaveAttribute(
			"scheme",
			"district-retired",
		);
	});

	test("leaves forced-color rendering to the browser and keeps keyboard focus visible", async ({
		page,
	}) => {
		await page.emulateMedia({ forcedColors: "active" });
		await page.addInitScript(() => {
			window.localStorage.setItem("pie-color-scheme", "forced-unavailable");
		});
		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme, change colors and contrast" })
			.first()
			.click();

		const themeTool = page.locator("pie-tool-theme").first();
		await expect(themeTool).toBeVisible();
		await expect(themeTool.getByRole("status")).toContainText("unavailable");
		const trigger = themeTool.getByRole("button", { name: /Select theme/ });

		// Establish keyboard modality before moving focus directly to the control.
		await page.keyboard.press("Tab");
		await trigger.focus();
		await expect
			.poll(() =>
				trigger.evaluate((element) => element.matches(":focus-visible")),
			)
			.toBe(true);

		const styles = await trigger.evaluate((element) => {
			const computed = getComputedStyle(element);
			return {
				forcedColorAdjust: computed.forcedColorAdjust,
				outlineStyle: computed.outlineStyle,
				outlineWidth: Number.parseFloat(computed.outlineWidth),
			};
		});

		expect(styles.forcedColorAdjust).toBe("auto");
		expect(styles.outlineStyle).not.toBe("none");
		expect(styles.outlineWidth).toBeGreaterThanOrEqual(2);

		await trigger.click();
		await page.keyboard.press("ArrowDown");
		const option = themeTool.getByRole("menuitem", {
			name: "Default",
			exact: true,
		});
		await expect(option).toBeFocused();
		const optionStyles = await option.evaluate((element) => {
			const computed = getComputedStyle(element);
			return {
				forcedColorAdjust: computed.forcedColorAdjust,
				outlineStyle: computed.outlineStyle,
				outlineWidth: Number.parseFloat(computed.outlineWidth),
			};
		});
		expect(optionStyles.forcedColorAdjust).toBe("auto");
		expect(optionStyles.outlineStyle).not.toBe("none");
		expect(optionStyles.outlineWidth).toBeGreaterThanOrEqual(2);
	});
});
