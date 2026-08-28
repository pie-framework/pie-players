<svelte:options
	customElement={{
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

<script module lang="ts">
	/** Registration metadata consumed by the package's guarded CE entry. */
	export const registration = { tag: 'pie-tool-calculator' } as const;
</script>

<script lang="ts">
	import type { AssessmentToolkitRuntimeContext } from '@pie-players/pie-assessment-toolkit';
	import type {
		CalculatorProviderConfig,
		CalculatorType,
	} from '@pie-players/pie-assessment-toolkit/tools/client';
	import CalculatorTool from './CalculatorTool.svelte';

	let {
		visible = false,
		toolId = 'calculator',
		providerId = 'calculator-desmos',
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

<CalculatorTool
	{visible}
	{toolId}
	{providerId}
	{calculatorType}
	{availableTypes}
	{calculatorConfig}
	{toolkitCoordinator}
/>

<style>
	:global(.pie-tool-calculator__container .dcg-container) {
		width: 100% !important;
		height: 100% !important;
	}
</style>
