<svelte:options
	customElement={{
		tag: 'pie-tool-calculator-geogebra',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			providerId: { type: 'String', attribute: 'provider-id' },
			calculatorType: { type: 'String', attribute: 'calculator-type' },
			availableTypes: { type: 'Array', attribute: 'available-types' },
			calculatorConfig: { type: 'Object' },
			toolkitCoordinator: { type: 'Object' },
		}
	}}
/>

<script lang="ts">
	import type { AssessmentToolkitRuntimeContext } from '@pie-players/pie-assessment-toolkit';
	import type {
		CalculatorProviderConfig,
		CalculatorType,
	} from '@pie-players/pie-assessment-toolkit/tools/client';
	import { CalculatorTool } from '@pie-players/pie-tool-calculator-shared';

	let {
		visible = false,
		toolId = 'calculator',
		providerId = 'calculator-geogebra',
		calculatorType = 'basic' as CalculatorType,
		availableTypes = ['basic', 'scientific', 'graphing'] as CalculatorType[],
		calculatorConfig = {} as CalculatorProviderConfig,
		toolkitCoordinator = null,
	}: {
		visible?: boolean;
		toolId?: string;
		providerId?: string;
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[] | string;
		calculatorConfig?: CalculatorProviderConfig;
		toolkitCoordinator?: AssessmentToolkitRuntimeContext['toolkitCoordinator'] | null;
	} = $props();
</script>

<div class="pie-tool-calculator-geogebra__surface">
	<div class="pie-tool-calculator-geogebra__calculator">
		<CalculatorTool
			{visible}
			{toolId}
			{providerId}
			{calculatorType}
			{availableTypes}
			{calculatorConfig}
			{toolkitCoordinator}
		/>
	</div>
	{#if visible}
		<a
			class="pie-tool-calculator-geogebra__attribution"
			href="https://www.geogebra.org/"
			target="_blank"
			rel="noreferrer"
			aria-label="Made with GeoGebra® (opens in a new tab)"
		>Made with GeoGebra®</a>
	{/if}
</div>

<style>
	.pie-tool-calculator-geogebra__surface {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.pie-tool-calculator-geogebra__calculator {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
	}

	.pie-tool-calculator-geogebra__attribution {
		align-self: flex-end;
		flex: 0 0 auto;
		padding: 0.1rem 0.25rem;
		border-radius: 0.2rem;
		background: rgb(255 255 255 / 88%);
		color: #334155;
		font-size: 0.65rem;
	}
</style>
