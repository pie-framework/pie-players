<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		subtitle: string;
		themeControl?: Snippet;
	}

	let { title, subtitle, themeControl }: Props = $props();
</script>

<header class="pie-demo-site-header border-b border-base-200 bg-base-100/80 backdrop-blur">
	<div class="pie-demo-site-header__inner">
		<a class="pie-demo-site-header__home btn btn-ghost" href="/" aria-label="{title} home">
			<svg
				class="pie-demo-site-header__logo text-primary"
				viewBox="0 0 448 448"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M208 240V32C93.125 32 0 125.125 0 240s93.125 208 208 208 208-93.125 208-208H208zm0 160c-88.227 0-160-71.781-160-160 0-71.516 47.148-132.219 112-152.641v199.047h200.648C340.211 351.25 279.508 400 208 400zM240 0v208h208C448 93.125 354.875 0 240 0z"
				/>
			</svg>
			<span class="pie-demo-site-header__titles">
				<span class="pie-demo-site-header__title text-base font-bold text-secondary">
					{title}
				</span>
				<span class="pie-demo-site-header__subtitle text-primary">
					{subtitle}
				</span>
			</span>
		</a>

		{#if themeControl}
			<div class="pie-demo-site-header__theme">
				{@render themeControl()}
			</div>
		{/if}
	</div>
</header>

<style>
	.pie-demo-site-header__inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		max-width: 80rem;
		min-height: 4rem;
		margin: 0 auto;
		padding: 0 1rem;
		box-sizing: border-box;
	}

	.pie-demo-site-header__home {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		justify-content: flex-start;
		gap: 0.75rem;
		padding-inline: 0.5rem;
	}

	.pie-demo-site-header__logo {
		width: 1.75rem;
		height: 1.75rem;
		flex: 0 0 auto;
	}

	.pie-demo-site-header__titles {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.25;
	}

	.pie-demo-site-header__title,
	.pie-demo-site-header__subtitle {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pie-demo-site-header__subtitle {
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.025em;
		text-transform: uppercase;
	}

	.pie-demo-site-header__theme {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
	}

	@media (max-width: 420px) {
		.pie-demo-site-header__inner {
			padding-inline: 0.5rem;
		}

		.pie-demo-site-header__home {
			gap: 0.5rem;
			padding-inline: 0.25rem;
		}

		.pie-demo-site-header__logo {
			width: 1.5rem;
			height: 1.5rem;
		}
	}
</style>
