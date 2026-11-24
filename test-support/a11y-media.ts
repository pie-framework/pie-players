import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The checks an axe test adds in the `a11y-*` Playwright projects, which
 * `scripts/lib/playwright-media-projects.mjs` defines. In every other project both
 * are no-ops, so a test calls them unconditionally.
 */

function emulatedMedia() {
	const { forcedColors, reducedMotion, colorScheme } = test.info().project.use;
	return {
		forcedColors: forcedColors === "active",
		reducedMotion: reducedMotion === "reduce",
		colorScheme: colorScheme ?? "light",
	};
}

/**
 * The axe rules a media project turns off: `color-contrast` under forced colours,
 * where the system palette belongs to the user.
 */
export function mediaDisabledAxeRules(): string[] {
	return emulatedMedia().forcedColors ? ["color-contrast"] : [];
}

/**
 * The media project's check of `scope`, the root the test's axe scan covers.
 *
 * Under forced colours it attaches a full-page screenshot: axe does not judge
 * forced-colours rendering, so the screenshot is the audit input. Under reduced
 * motion it walks `scope`, its open shadow roots and their `::before` and `::after`,
 * and fails softly, so the test's own assertions still run, on every element whose
 * computed transition time is above 0s or whose animation outlasts 0.01ms or repeats.
 * The walk reads computed styles, so it does not depend on timing; an animation a
 * script starts shows only once triggered.
 */
export async function checkMedia(page: Page, scope: string): Promise<void> {
	const info = test.info();
	const media = emulatedMedia();
	if (media.forcedColors) {
		const name = `forced-colors-${media.colorScheme}.png`;
		const path = info.outputPath(name);
		await page.screenshot({ path, fullPage: true });
		await info.attach(name, { path, contentType: "image/png" });
	}
	if (media.reducedMotion) {
		const motion = await findMotion(page, scope);
		const path = info.outputPath("reduced-motion.json");
		writeFileSync(path, `${JSON.stringify(motion, null, 2)}\n`);
		await info.attach("reduced-motion.json", { path, contentType: "application/json" });
		const total = motion.reduce((sum, entry) => sum + entry.count, 0);
		const lines = motion.slice(0, 30).map((entry) =>
			[
				`${entry.element}${entry.pseudo ?? ""}`,
				entry.transition && `transition ${entry.transition}`,
				entry.animation && `animation ${entry.animation}`,
				entry.count > 1 && `×${entry.count}`,
			]
				.filter(Boolean)
				.join(" — "),
		);
		expect
			.soft(
				total,
				`${total} element(s) in ${scope} move with reduced motion on (reduced-motion.json lists all ${motion.length} distinct):\n${lines.join("\n")}`,
			)
			.toBe(0);
	}
}

export type Motion = {
	/** The custom elements above it, then the element itself. */
	element: string;
	pseudo?: "::before" | "::after";
	transition?: string;
	animation?: string;
	/** How many elements share this description. */
	count: number;
};

async function findMotion(page: Page, scope: string): Promise<Motion[]> {
	return await page.evaluate((selector) => {
		const NOT_RENDERED = new Set(["script", "style", "template", "noscript", "link", "meta"]);
		const ms = (time: string) =>
			Number.parseFloat(time) * (time.endsWith("ms") ? 1 : 1000);
		const list = (value: string) => value.split(",").map((entry) => entry.trim());
		const describe = (element: Element) => {
			let text = element.localName;
			if (element.id) text += `#${element.id}`;
			for (const name of Array.from(element.classList).slice(0, 3)) text += `.${name}`;
			const hosts: string[] = [];
			let node: Node | null = element.parentNode;
			while (node) {
				if (node instanceof ShadowRoot) node = node.host;
				if (node instanceof Element && node.localName.includes("-")) {
					hosts.unshift(node.localName);
				}
				node = node.parentNode;
			}
			return [...hosts, text].join(" ");
		};

		const found = new Map<string, Motion>();
		const longest = new Map<string, number>();
		const inspect = (element: Element, pseudo?: "::before" | "::after") => {
			const style = getComputedStyle(element, pseudo);
			if (pseudo && (style.content === "none" || style.content === "normal")) return;
			const properties = list(style.transitionProperty);
			const durations = list(style.transitionDuration);
			const transitions = properties
				.map((property, index) => [property, durations[index % durations.length]])
				.filter(([property, duration]) => property !== "none" && ms(duration) > 0);
			const transition = transitions.map((pair) => pair.join(" ")).join(", ");
			const names = list(style.animationName);
			const animationDurations = list(style.animationDuration);
			const counts = list(style.animationIterationCount);
			const animations = names
				.map((name, index) => [
					name,
					animationDurations[index % animationDurations.length],
					counts[index % counts.length],
				])
				.filter(
					([name, duration, count]) =>
						name !== "none" &&
						// Chromium serialises 0.01ms as 1e-05s, which reads back a hair above it.
						(ms(duration) - 0.01 > 1e-9 || count === "infinite" || Number(count) > 1),
				);
			const animation = animations
				.map(([name, duration, count]) => `${name} ${duration} ${count}`)
				.join(", ");
			if (!transition && !animation) return;
			const weight = Math.max(
				...transitions.map(([, duration]) => ms(duration)),
				...animations.map(([, duration, count]) =>
					count === "infinite" ? Number.POSITIVE_INFINITY : ms(duration) * Number(count),
				),
			);
			const entry: Motion = {
				element: describe(element),
				...(pseudo ? { pseudo } : {}),
				...(transition ? { transition } : {}),
				...(animation ? { animation } : {}),
				count: 1,
			};
			const key = JSON.stringify([entry.element, pseudo, transition, animation]);
			const seen = found.get(key);
			if (seen) seen.count += 1;
			else {
				found.set(key, entry);
				longest.set(key, weight);
			}
		};
		const visit = (element: Element) => {
			if (NOT_RENDERED.has(element.localName)) return;
			inspect(element);
			inspect(element, "::before");
			inspect(element, "::after");
			for (const child of Array.from(element.shadowRoot?.children ?? [])) visit(child);
			for (const child of Array.from(element.children)) visit(child);
		};

		const roots = Array.from(document.querySelectorAll(selector));
		if (roots.length === 0) throw new Error(`No element matches ${selector}`);
		for (const root of roots) visit(root);
		// Longest first, so the report opens on the motion a learner would notice.
		return Array.from(found.entries())
			.sort(([a], [b]) => (longest.get(b) ?? 0) - (longest.get(a) ?? 0))
			.map(([, entry]) => entry);
	}, scope);
}
