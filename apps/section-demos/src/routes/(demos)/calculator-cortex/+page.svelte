<script lang="ts">
	import SectionDemoRuntimePage from '$lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/*
	 * Configured rather than defaulted, because the seam is the point of this demo:
	 * `allowedFunctions` drops factorial and log-base-n, so the scientific keypad
	 * omits both keys instead of offering a key the validator would refuse.
	 * `restrictedMode` is monotonic and cannot be relaxed by `settings.allowClipboard`.
	 */
	const calculatorConfig = {
		restrictedMode: true,
		settings: {
			angleMode: 'radian',
			historyLimit: 20,
			allowedFunctions: [
				'square-root',
				'power',
				'root',
				'exponential',
				'natural-log',
				'common-log',
				'sine',
				'cosine',
				'tangent',
				'inverse-sine',
				'inverse-cosine',
				'inverse-tangent',
				'absolute-value'
			]
		}
	};
</script>

<SectionDemoRuntimePage {data} calculatorProvider="cortex" {calculatorConfig} />
