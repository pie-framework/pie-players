<svelte:options
	customElement={{
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'Array', attribute: 'available-types' },
			calculatorConfig: { type: 'Object' },
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script module lang="ts">
	/** Registration metadata consumed by the package's guarded CE entry. */
	export const registration = { tag: 'pie-tool-calculator' } as const;
</script>

<script lang="ts">
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';
	import type {
		CalculatorProviderConfig,
		CalculatorType,
	} from '@pie-players/pie-calculator';
	import CalculatorTool from './CalculatorTool.svelte';

	let {
		visible = false,
		toolId = 'calculator',
		calculatorType = 'basic' as CalculatorType,
		availableTypes = ['basic', 'scientific', 'graphing'] as CalculatorType[],
		calculatorConfig = {} as CalculatorProviderConfig,
	}: {
		visible?: boolean;
		toolId?: string;
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[] | string;
		calculatorConfig?: CalculatorProviderConfig;
	} = $props();
</script>

<CalculatorTool
	{visible}
	{toolId}
	{calculatorType}
	{availableTypes}
	{calculatorConfig}
/>

<style>
	:global(.pie-tool-calculator__container .dcg-container) {
		width: 100% !important;
		height: 100% !important;
	}
</style>
