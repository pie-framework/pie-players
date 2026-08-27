<svelte:options
	customElement={{
		tag: 'pie-tool-calculator-inline',
		shadow: 'open',
		props: {
			toolId: { type: 'String', attribute: 'tool-id' },
			targetToolId: { type: 'String', attribute: 'target-tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'String', attribute: 'available-types' },
			size: { type: 'String', attribute: 'size' },
		}
	}}
/>

<script lang="ts">
	import { CalculatorInlineTool } from '@pie-players/pie-tool-calculator-shared';

	let {
		toolId = 'calculator-inline',
		targetToolId = '',
		calculatorType = 'basic',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
	}: {
		toolId?: string;
		targetToolId?: string;
		calculatorType?: string;
		availableTypes?: string;
		size?: 'sm' | 'md' | 'lg';
	} = $props();
</script>

<CalculatorInlineTool
	{toolId}
	{targetToolId}
	{calculatorType}
	{availableTypes}
	{size}
/>
