<script lang="ts">
	import SectionDemoRuntimePage from '$lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/*
	 * The assessment lockdown a host configuring Desmos for a test actually sends.
	 * Everything under `settings` is Desmos' own API, typed as
	 * `DesmosCalculatorSettings` by `@pie-players/pie-calculator-desmos` rather than
	 * by the generic contract — the split this suite made when `desmos` stopped being
	 * a field on `CalculatorProviderConfig`.
	 *
	 * The other demos in this app deliberately pass none of this: they exercise the
	 * unconfigured Desmos default, which is the path a host that configures nothing
	 * is on.
	 *
	 * `restrictedMode` is deliberately not set. The Desmos adapter maps it to
	 * `expressions: false` for every type, which on a graphing calculator removes the
	 * expression list — graph paper with no way to enter a function. The fields below
	 * are the same lockdown expressed in Desmos' own terms, and they leave the
	 * calculator usable.
	 */
	const calculatorConfig = {
		settings: {
			degreeMode: 'radian',
			// Desmos' own function allowlist, the counterpart to Cortex's
			// `allowedFunctions`: it refuses what Desmos classes as unrestricted rather
			// than hiding keys from a keypad it does not gate.
			restrictedFunctions: true,
			// Chrome a learner has no use for mid-item, and which routes out of the tool.
			settingsMenu: false,
			links: false,
			notes: false,
			folders: false,
			images: false,
			sliders: false
		}
	};
</script>

<SectionDemoRuntimePage {data} calculatorProvider="desmos" {calculatorConfig} />
