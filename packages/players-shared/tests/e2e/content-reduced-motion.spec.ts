import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies the content stylesheet's reduced-motion backstop by computed style
 * in a real engine: happy-dom evaluates neither `prefers-reduced-motion` nor
 * pseudo-element styles.
 */

const COMPONENTS_CSS = readFileSync(
	path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"../../../theme/src/components.css",
	),
	"utf8",
);

// Motion an element sets for itself: a class rule, a more specific rule, a
// pseudo-element and an inline transition in MUI's form.
const ELEMENT_CSS = `
@keyframes test-pulse { from { opacity: 0.2; } to { opacity: 1; } }
.moving {
	transition: opacity 300ms ease 100ms;
	animation: test-pulse 2s ease-in-out 500ms infinite;
}
.moving::before,
.moving::after {
	content: "";
	transition: transform 250ms 50ms;
	animation: test-pulse 1s infinite;
}
#specific.moving { transition-duration: 400ms; }`;

const CONTENT = `
<div data-pie-content class="moving" id="root">
	<p class="moving" id="inside">Inside</p>
	<p class="moving" id="specific">Specific</p>
	<div id="inline" style="transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms; animation: test-pulse 1s infinite">Inline</div>
	<div class="pie-loading" id="loader"></div>
</div>
<p class="moving" id="outside">Outside</p>`;

async function load(page: Page, reducedMotion: "reduce" | "no-preference") {
	await page.emulateMedia({ reducedMotion });
	await page.setContent(
		`<!doctype html><html><head></head><body>${CONTENT}</body></html>`,
	);
	await page.addStyleTag({ content: ELEMENT_CSS });
	await page.addStyleTag({ content: COMPONENTS_CSS });
}

type Motion = {
	transitionDuration: string;
	transitionDelay: string;
	animationDuration: string;
	animationDelay: string;
	animationIterationCount: string;
};

/** Each element's motion, and its pseudo-elements' as `<id>::before`. */
const motions = (page: Page, selector: string) =>
	page.evaluate((selector) => {
		const out: Record<string, Motion> = {};
		const elements = document.querySelectorAll<HTMLElement>(selector);
		elements.forEach((element, index) => {
			const key = element.id || `${element.tagName.toLowerCase()}#${index}`;
			for (const pseudo of ["", "::before", "::after"]) {
				const style = getComputedStyle(element, pseudo || null);
				out[`${key}${pseudo}`] = {
					transitionDuration: style.transitionDuration,
					transitionDelay: style.transitionDelay,
					animationDuration: style.animationDuration,
					animationDelay: style.animationDelay,
					animationIterationCount: style.animationIterationCount,
				};
			}
		});
		return out;
	}, selector);

const seconds = (list: string) =>
	list.split(",").map((value) => {
		const trimmed = value.trim();
		return trimmed.endsWith("ms")
			? Number.parseFloat(trimmed) / 1000
			: Number.parseFloat(trimmed);
	});

test.describe("reduced motion in item content (real browser)", () => {
	test("stops every transition and animation inside the content root", async ({
		page,
	}) => {
		await load(page, "reduce");
		const inside = await motions(
			page,
			"[data-pie-content], [data-pie-content] *",
		);
		expect(Object.keys(inside).length).toBeGreaterThanOrEqual(15);
		for (const [key, motion] of Object.entries(inside)) {
			for (const time of [
				...seconds(motion.transitionDuration),
				...seconds(motion.transitionDelay),
				...seconds(motion.animationDelay),
			]) {
				expect(time, key).toBe(0);
			}
			for (const duration of seconds(motion.animationDuration)) {
				expect(duration, key).toBeLessThanOrEqual(0.00001);
			}
			expect(motion.animationIterationCount, key).toBe("1");
		}
	});

	test("leaves motion outside the content root as authored", async ({
		page,
	}) => {
		await load(page, "reduce");
		const outside = await motions(page, "#outside");
		expect(outside.outside).toEqual({
			transitionDuration: "0.3s",
			transitionDelay: "0.1s",
			animationDuration: "2s",
			animationDelay: "0.5s",
			animationIterationCount: "infinite",
		});
		expect(outside["outside::before"].animationIterationCount).toBe(
			"infinite",
		);
	});

	test("leaves motion as authored when the setting is off", async ({
		page,
	}) => {
		await load(page, "no-preference");
		const inside = await motions(
			page,
			"#root, #inside, #specific, #inline, #loader",
		);
		expect(inside.inside).toEqual({
			transitionDuration: "0.3s",
			transitionDelay: "0.1s",
			animationDuration: "2s",
			animationDelay: "0.5s",
			animationIterationCount: "infinite",
		});
		expect(inside.specific.transitionDuration).toBe("0.4s");
		expect(inside["inside::after"]).toEqual({
			transitionDuration: "0.25s",
			transitionDelay: "0.05s",
			animationDuration: "1s",
			animationDelay: "0s",
			animationIterationCount: "infinite",
		});
		expect(inside.inline.transitionDuration).toBe("0.225s");
		expect(inside["loader::before"].animationIterationCount).toBe("infinite");
		expect(inside["loader::after"].animationIterationCount).toBe("infinite");
	});

	test("leaves the loader a visible still ring", async ({ page }) => {
		await load(page, "reduce");
		const ring = () =>
			page.evaluate(() => {
				const loader = document.getElementById("loader") as HTMLElement;
				return ["::before", "::after"].map((pseudo) => {
					const style = getComputedStyle(loader, pseudo);
					return {
						opacity: style.opacity,
						transform: style.transform,
						borderTopWidth: style.borderTopWidth,
					};
				});
			});
		await expect
			.poll(ring)
			.toEqual([
				{ opacity: "0.9", transform: "none", borderTopWidth: "5px" },
				{ opacity: "0.9", transform: "none", borderTopWidth: "5px" },
			]);
	});
});
