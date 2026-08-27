import type { Calculator, CalculatorType } from "@pie-players/pie-calculator";
import {
	CortexCalculatorProvider,
	type CortexTextDirection,
} from "@pie-players/pie-calculator-cortex";

declare global {
	interface Window {
		__cortexReady?: boolean;
		__cortexMode?: CalculatorType;
		__cortexResult?: string;
		__cortexCalculator?: Calculator;
		__cortexTelemetry?: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}>;
	}
}

function calculatorMode(): CalculatorType {
	const mode = document.body.dataset.mode;
	if (mode === "basic" || mode === "scientific" || mode === "graphing") {
		return mode;
	}
	throw new Error(`Unsupported calculator demo mode: ${String(mode)}`);
}

function requiredElement<ElementType extends Element>(
	selector: string,
): ElementType {
	const element = document.querySelector<ElementType>(selector);
	if (!element)
		throw new Error(`The calculator demo element ${selector} is missing.`);
	return element;
}

const container = requiredElement<HTMLElement>("#calculator");
const localeControl = requiredElement<HTMLSelectElement>("#locale");
const themeControl = requiredElement<HTMLSelectElement>("#theme");
const directionControl = requiredElement<HTMLSelectElement>("#direction");
const panelControl = requiredElement<HTMLSelectElement>("#panel");

const mode = calculatorMode();
document
	.querySelector(`[data-mode-link="${mode}"]`)
	?.setAttribute("aria-current", "page");

window.__cortexTelemetry = [];
const provider = new CortexCalculatorProvider({
	onTelemetry: (eventName, payload) => {
		window.__cortexTelemetry?.push({ eventName, payload });
	},
});
await provider.initialize();

let calculator: Calculator | null = null;

async function mountCalculator(): Promise<void> {
	window.__cortexReady = false;
	calculator?.destroy();
	const theme = themeControl.value as "light" | "dark" | "auto";
	const direction = directionControl.value as CortexTextDirection | "auto";
	calculator = await provider.createCalculator(mode, container, {
		locale: localeControl.value,
		theme,
		settings: { direction },
	});
	let result = "";
	if (mode === "basic") result = (await calculator.evaluate?.("2+2")) ?? "";
	if (mode === "scientific") {
		result = (await calculator.evaluate?.("\\sin(30)")) ?? "";
	}
	if (mode === "graphing") {
		calculator.setValue("y=x^2");
		calculator.resize?.();
	}
	window.__cortexMode = mode;
	window.__cortexResult = result;
	window.__cortexCalculator = calculator;
	window.__cortexReady = true;
}

/*
 * The shipped tool panel is 380x372 for every calculator type. Sizing the demo
 * container to it is what makes the demo exercise the layout that actually ships:
 * the package's rules are container queries, and a fluid 1280px demo would never
 * reach the narrow branch.
 */
function applyPanelSize(): void {
	container.classList.toggle(
		"pie-cortex-demo-calculator--shell",
		panelControl.value === "shell",
	);
	calculator?.resize?.();
}

panelControl.addEventListener("change", applyPanelSize);

for (const control of [localeControl, themeControl, directionControl]) {
	control.addEventListener("change", () => void mountCalculator());
}

applyPanelSize();
await mountCalculator();

window.addEventListener(
	"beforeunload",
	() => {
		calculator?.destroy();
		provider.destroy();
	},
	{ once: true },
);
