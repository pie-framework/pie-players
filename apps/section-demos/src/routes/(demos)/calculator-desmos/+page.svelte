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
	 * `restrictedMode` is the vendor-neutral half and is monotonic: it suppresses the
	 * expression topbar, settings menu, zoom buttons and links, and `settings` cannot
	 * relax it. The Desmos-specific fields below go further than it does.
	 */
	const calculatorConfig = {
		restrictedMode: true,
		settings: {
			degreeMode: 'radian',
			// Desmos' own function allowlist, the counterpart to Cortex's
			// `allowedFunctions`: it refuses what Desmos classes as unrestricted rather
			// than hiding keys from a keypad it does not gate.
			restrictedFunctions: true,
			// Chrome `restrictedMode` does not reach, and which a learner has no use for
			// mid-item.
			notes: false,
			folders: false,
			images: false,
			sliders: false
		}
	};
</script>

<SectionDemoRuntimePage {data} calculatorProvider="desmos" {calculatorConfig} />
