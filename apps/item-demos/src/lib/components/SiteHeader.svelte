<script lang="ts">
	import ThemeSelect from "./ThemeSelect.svelte";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let { title = "PIE Item Demos", subtitle = "Item player recipes" }: Props = $props();
</script>

<header class="border-b border-base-200 bg-base-100/80 backdrop-blur">
	<div class="navbar mx-auto max-w-7xl px-4">
		<div class="navbar-start">
			<a class="btn btn-ghost gap-3 px-2" href="/" aria-label="{title} home">
				<svg
					class="h-7 w-7 shrink-0 text-primary"
					viewBox="0 0 448 448"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M208 240V32C93.125 32 0 125.125 0 240s93.125 208 208 208 208-93.125 208-208H208zm0 160c-88.227 0-160-71.781-160-160 0-71.516 47.148-132.219 112-152.641v199.047h200.648C340.211 351.25 279.508 400 208 400zM240 0v208h208C448 93.125 354.875 0 240 0z"
					/>
				</svg>
				<span class="flex flex-col items-start leading-tight">
					<span class="text-base font-bold text-secondary">{title}</span>
					<span class="text-[0.7rem] font-medium text-primary uppercase tracking-wide">
						{subtitle}
					</span>
				</span>
			</a>
		</div>
		<div class="navbar-end gap-1">
			<ThemeSelect />
		</div>
	</div>
</header>
