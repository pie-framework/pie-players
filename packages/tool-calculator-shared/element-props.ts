import type {
	CalculatorProviderConfig,
	CalculatorType,
} from "@pie-players/pie-calculator";

/** Inputs shared by the component and its native element declaration. */
export interface CalculatorProps {
	visible?: boolean;
	toolId?: string;
	calculatorType?: CalculatorType;
	availableTypes?: CalculatorType[] | string;
	calculatorConfig?: CalculatorProviderConfig;
}
