<script lang="ts">
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
	import {
		BUNDLED_LOCALES,
		createPieI18n,
		loadBundledCatalog,
	} from "@pie-players/pie-players-shared/i18n";
	import {
		GENERATED_LOCALES,
		loadGeneratedCatalog,
	} from "@pie-players/pie-i18n-generated";

	export const ssr = false;

	// The lifecycle spec drives `locale` programmatically on the host it mounts,
	// and the assembly's navigation chrome can only serve what the composing
	// host supplies — the bundled set is `en-US` alone. This fixture is the
	// stand-in host, so it wires the generated tier per that package's README
	// and exposes the provider for the spec to hand the element.
	const provider = createPieI18n({
		availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
		loadCatalog: (locale) =>
			loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale)),
	});
	// The consumer types the member on its own `Window` augmentation (the
	// lifecycle spec's global block); this side writes it through a cast.
	(window as unknown as { assessmentDemoI18n: typeof provider }).assessmentDemoI18n =
		provider;
</script>

<svelte:head>
	<title>Assessment lifecycle host</title>
</svelte:head>

<h1>Assessment lifecycle host</h1>
<div data-pie-assessment-fixture></div>

<style>
	[data-pie-assessment-fixture] {
		height: 42rem;
		min-height: 0;
	}
</style>
