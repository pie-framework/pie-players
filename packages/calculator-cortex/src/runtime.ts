import type {
	Calculator,
	CalculatorProvider,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";
import { mount, unmount } from "svelte";
import CalculatorView from "./CalculatorView.svelte";
import { CortexCalculatorController } from "./calculator-controller.js";
import type { ResolvedCortexSettings } from "./settings.js";

type TelemetryCallback = (
	eventName: string,
	payload?: Record<string, unknown>,
) => void | Promise<void>;

class CortexCalculator implements Calculator {
	readonly type: CalculatorType;
	private destroyed = false;

	constructor(
		readonly provider: CalculatorProvider,
		private readonly container: HTMLElement,
		private readonly controller: CortexCalculatorController,
		private readonly mounted: ReturnType<typeof mount>,
		private readonly onDestroy: () => void,
	) {
		this.type = controller.settings.type;
	}

	getValue(): string {
		return this.controller.getValue();
	}

	setValue(value: string): void {
		this.controller.setValue(value);
	}

	clear(): void {
		this.controller.clear();
	}

	getHistory() {
		return this.controller.getHistory();
	}

	clearHistory(): void {
		this.controller.clearHistory();
	}

	evaluate(expression: string): Promise<string> {
		return this.controller.evaluate(expression);
	}

	resize(): void {
		this.controller.requestResize();
	}

	focus(): void {
		this.controller.requestFocus();
	}

	exportState() {
		return this.controller.exportState();
	}

	importState(state: CalculatorState): void {
		this.controller.importState(state);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.controller.destroy();
		void unmount(this.mounted);
		this.container.replaceChildren();
		this.onDestroy();
	}
}

export function createCortexCalculator(
	provider: CalculatorProvider,
	container: HTMLElement,
	settings: ResolvedCortexSettings,
	onTelemetry: TelemetryCallback | undefined,
	onDestroy: (calculator: Calculator) => void,
): Calculator {
	container.replaceChildren();
	const controller = new CortexCalculatorController(settings, onTelemetry);
	const mounted = mount(CalculatorView, {
		target: container,
		props: { controller },
	});
	let calculator: Calculator;
	calculator = new CortexCalculator(
		provider,
		container,
		controller,
		mounted,
		() => onDestroy(calculator),
	);
	return calculator;
}
