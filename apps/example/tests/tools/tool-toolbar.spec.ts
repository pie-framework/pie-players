import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURE_PATH = path.resolve(process.cwd(), "tests/tools/fixtures/tool-toolbar.html");
const FIXTURE_URL = pathToFileURL(FIXTURE_PATH).toString();

type ToolId =
	| "calculator"
	| "graph"
	| "periodicTable"
	| "protractor"
	| "lineReader"
	| "magnifier"
	| "ruler";

const EXPECTED_TOOLS: Array<{
	id: ToolId;
	label: string;
	tag: string;
}> = [
	{ id: "calculator", label: "Calculator", tag: "pie-tool-calculator" },
	{ id: "graph", label: "Graph", tag: "pie-tool-graph" },
	{ id: "periodicTable", label: "Periodic Table", tag: "pie-tool-periodic-table" },
	{ id: "protractor", label: "Protractor", tag: "pie-tool-protractor" },
	{ id: "lineReader", label: "Line Reader", tag: "pie-tool-line-reader" },
	{ id: "magnifier", label: "Magnifier", tag: "pie-tool-magnifier" },
	{ id: "ruler", label: "Ruler", tag: "pie-tool-ruler" },
];

test("tool toolbar renders buttons and toggles tools visible", async ({ page }) => {
	// Load a file:// fixture that imports the ESM bundle (avoids CORS restrictions from about:blank).
	await page.goto(FIXTURE_URL);

	// Ensure the toolbar custom element is registered.
	await expect
		.poll(
			() => page.evaluate(() => !!customElements.get("pie-tool-toolbar")),
			{ timeout: 15_000 },
		)
		.toBeTruthy();

	// Minimal coordinator that satisfies the APIs used by the toolbar + tools.
	await page.evaluate(() => {
		class MinimalToolCoordinator {
			#tools = new Map();
			#listeners = new Set();
			#z = 1000;

			subscribe(listener) {
				this.#listeners.add(listener);
				return () => this.#listeners.delete(listener);
			}

			#notify() {
				for (const l of this.#listeners) l();
			}

			registerTool(id, name, element) {
				if (this.#tools.has(id)) return;
				this.#tools.set(id, { id, name, element: element ?? null, isVisible: false });
			}

			unregisterTool(id) {
				this.#tools.delete(id);
			}

			updateToolElement(id, element) {
				const t = this.#tools.get(id);
				if (!t) return;
				t.element = element;
			}

			bringToFront(element) {
				if (!element) return;
				element.style.zIndex = String(++this.#z);
			}

			isToolVisible(id) {
				return this.#tools.get(id)?.isVisible ?? false;
			}

			showTool(id) {
				const t = this.#tools.get(id);
				if (!t) return;
				t.isVisible = true;
				this.#notify();
			}

			hideTool(id) {
				const t = this.#tools.get(id);
				if (!t) return;
				t.isVisible = false;
				this.#notify();
			}

			toggleTool(id) {
				const t = this.#tools.get(id);
				if (!t) return;
				t.isVisible = !t.isVisible;
				this.#notify();
			}
		}

		const root = document.getElementById("root");
		if (!root) throw new Error("root missing");

		const toolbar = document.createElement("pie-tool-toolbar");
		toolbar.setAttribute(
			"tools",
			"calculator,graph,periodicTable,protractor,lineReader,magnifier,ruler",
		);
		toolbar.setAttribute("position", "bottom");

		// Pass coordinator as JS property (not attribute).
		toolbar.toolCoordinator = new MinimalToolCoordinator();
		toolbar.highlightCoordinator = null;

		root.appendChild(toolbar);
	});

	const toolbar = page.locator("pie-tool-toolbar");
	await expect(toolbar).toBeVisible();

	// Buttons should render (icons only; labels are aria-label).
	for (const tool of EXPECTED_TOOLS) {
		await expect(toolbar.locator(`button[aria-label="${tool.label}"]`)).toBeVisible();
	}

	// Clicking each tool button should toggle it visible and mount its custom element.
	for (const tool of EXPECTED_TOOLS) {
		const button = toolbar.locator(`button[aria-label="${tool.label}"]`);

		await button.click();

		const toolEl = toolbar.locator(tool.tag);
		await expect(toolEl).toHaveCount(1);

		// The tool custom element should receive `visible=true` via property.
		await expect
			.poll(() =>
				page.evaluate((tag) => {
					const el = document.querySelector(`pie-tool-toolbar ${tag}`);
					return !!el && (el).visible === true;
				}, tool.tag),
			)
			.toBeTruthy();
	}
});

