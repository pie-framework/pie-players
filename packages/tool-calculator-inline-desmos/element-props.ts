/** Inputs shared by the component and its native element declaration. */
export interface CalculatorInlineProps {
	targetToolId?: string;
	calculatorType?: string;
	availableTypes?: string;
	size?: 'sm' | 'md' | 'lg';
}
