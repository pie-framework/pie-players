<svelte:options
	customElement={{
		tag: 'pie-tool-calculator-inline-geogebra',
		shadow: 'open',
		props: {
			targetToolId: { type: 'String', attribute: 'target-tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'String', attribute: 'available-types' },
			size: { type: 'String', attribute: 'size' },
		}
	}}
/>

<script lang="ts">
	import { CalculatorInlineTool } from '@pie-players/pie-tool-calculator-shared/components';

	let {
		targetToolId = '',
		calculatorType = 'basic',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
	}: {
		targetToolId?: string;
		calculatorType?: string;
		availableTypes?: string;
		size?: 'sm' | 'md' | 'lg';
	} = $props();
</script>

<CalculatorInlineTool
	{targetToolId}
	{calculatorType}
	{availableTypes}
	{size}
/>
