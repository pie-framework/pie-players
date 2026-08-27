import type { Calculator } from "@pie-players/pie-calculator";
import { CortexCalculatorProvider } from "@pie-players/pie-calculator-cortex";

declare global {
	interface Window {
		__cortexReady?: boolean;
		__cortexResults?: {
			basic: string;
			scientific: string;
		};
		__cortexCalculators?: Calculator[];
		__cortexTelemetry?: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}>;
	}
}

const requiredElement = (id: string): HTMLElement => {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing fixture element: ${id}`);
	return element;
};

window.__cortexTelemetry = [];
const provider = new CortexCalculatorProvider({
	onTelemetry: (eventName, payload) => {
		window.__cortexTelemetry?.push({ eventName, payload });
	},
});
await provider.initialize();

const basic = await provider.createCalculator("basic", requiredElement("basic"));
const scientific = await provider.createCalculator(
	"scientific",
	requiredElement("scientific"),
);
const graphing = await provider.createCalculator(
	"graphing",
	requiredElement("graphing"),
);

const basicResult = await basic.evaluate?.("2+2");
const scientificResult = await scientific.evaluate?.("\\sin(30)");
graphing.setValue("y=x^2");
graphing.resize?.();

window.__cortexCalculators = [basic, scientific, graphing];
window.__cortexResults = {
	basic: basicResult ?? "",
	scientific: scientificResult ?? "",
};
window.__cortexReady = true;
