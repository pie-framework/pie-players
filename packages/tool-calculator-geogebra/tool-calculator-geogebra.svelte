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
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script lang="ts">
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';
	import type { AssessmentToolkitRuntimeContext } from '@pie-players/pie-assessment-toolkit';
	import type {
		CalculatorProviderConfig,
		CalculatorType,
	} from '@pie-players/pie-assessment-toolkit/tools/client';
	import { CalculatorTool } from '@pie-players/pie-tool-calculator-shared/components';

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

<!-- GeoGebra's attribution comes from its provider, which the shared surface renders. -->
<CalculatorTool
	{visible}
	{toolId}
	{providerId}
	{calculatorType}
	{availableTypes}
	{calculatorConfig}
	{toolkitCoordinator}
/>
