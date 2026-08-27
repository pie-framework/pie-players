import type { Calculator, CalculatorType } from "@pie-players/pie-calculator";
import { CortexCalculatorProvider } from "@pie-players/pie-calculator-cortex";

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

const container = document.querySelector<HTMLElement>("#calculator");
if (!container) throw new Error("The calculator demo container is missing.");

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

const calculator = await provider.createCalculator(mode, container);
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

window.addEventListener(
	"beforeunload",
	() => {
		provider.destroy();
	},
	{ once: true },
);
