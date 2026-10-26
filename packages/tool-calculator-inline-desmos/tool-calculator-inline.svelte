<svelte:options
	customElement={{
		tag: 'pie-tool-calculator-inline',
		shadow: 'open',
		props: {
			targetToolId: { type: 'String', attribute: 'target-tool-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'String', attribute: 'available-types' },
			size: { type: 'String', attribute: 'size' },
		}
	}}
/>

<!--
@component
Calculator toggle button for an item header inside `<pie-item-scope>`. It opens
and closes the calculator the item toolbar renders, through the toolkit
coordinator's tool requests, and reflects that calculator's visibility in
`aria-pressed`; `target-tool-id` points it at another toolbar's calculator. It
stays disabled until the runtime context supplies a tool coordinator and the
target toolbar renders a calculator.
-->

<script lang="ts">
	import type { CalculatorInlineProps } from "./element-props.js";
	import { CalculatorInlineTool } from '@pie-players/pie-tool-calculator-shared/components';

	let {
		targetToolId = '',
		calculatorType = 'basic',
		availableTypes = 'basic,scientific,graphing',
		size = 'md' as 'sm' | 'md' | 'lg',
	}: CalculatorInlineProps = $props();
</script>

<CalculatorInlineTool
	{targetToolId}
	{calculatorType}
	{availableTypes}
	{size}
/>
