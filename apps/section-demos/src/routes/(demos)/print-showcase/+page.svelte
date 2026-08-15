<script lang="ts">
	import { ResponsiveDemoMenuBar } from '@pie-players/demo-ui';
	import '@pie-players/pie-print-player';
	import type { AssessmentSection } from '@pie-players/pie-players-shared/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let role = $state<'student' | 'instructor'>('student');
	// The print job's learner. Question 1 carries a transcript card, so this is
	// the difference between an accommodation reaching paper and not.
	let transcriptGranted = $state(false);

	const accessibility = $derived({
		personalNeedsProfile: {
			supports: transcriptGranted ? ['transcript'] : [],
			prohibitedSupports: [],
			activateAtInit: []
		}
	});

	type PrintEntry = { key: string; label: string; kind: 'stimulus' | 'item'; item: unknown };

	const entries = $derived.by<PrintEntry[]>(() => {
		const section = data.section as AssessmentSection | null;
		if (!section) return [];
		const list: PrintEntry[] = [];
		for (const rb of section.rubricBlocks ?? []) {
			const cfg = (rb as any)?.passage?.config;
			if (cfg) {
				list.push({
					key: rb.identifier ?? `stimulus-${list.length}`,
					label: (rb as any)?.passage?.name ?? 'Stimulus',
					kind: 'stimulus',
					item: cfg,
				});
			}
		}
		for (const ref of section.assessmentItemRefs ?? []) {
			const cfg = (ref as any)?.item?.config;
			if (cfg) {
				list.push({
					key: ref.identifier ?? `item-${list.length}`,
					label: (ref as any)?.item?.name ?? ref.identifier ?? `Item ${list.length + 1}`,
					kind: 'item',
					item: cfg,
				});
			}
		}
		return list;
	});

	// `<pie-print>` takes its config via a JS property (not an attribute),
	// so set it imperatively and re-apply whenever the role changes.
	function printConfig(
		node: HTMLElement,
		params: { item: unknown; role: string; accessibility: unknown },
	) {
		const apply = (p: { item: unknown; role: string; accessibility: unknown }) => {
			(node as unknown as { config: unknown }).config = {
				item: p.item,
				options: { role: p.role },
				accessibility: p.accessibility,
			};
		};
		apply(params);
		return { update: apply };
	}
</script>

<svelte:head>
	<title>{data.demo?.name ?? 'Print Showcase'} - Section Demos</title>
</svelte:head>

<div class="print-demo">
	<div class="print-demo__bar">
		<ResponsiveDemoMenuBar class="bg-base-200 shadow-md">
			{#snippet start()}
				<a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
				<div class="print-demo__title">
					<div class="font-semibold">{data.demo?.name ?? 'Print Showcase'}</div>
					<div class="text-xs opacity-70">via @pie-players/pie-print-player</div>
				</div>
			{/snippet}

			{#snippet primary()}
				<div class="join" aria-label="Print role">
					<button
						type="button"
						class="btn btn-sm join-item"
						class:btn-active={role === 'student'}
						aria-pressed={role === 'student'}
						onclick={() => (role = 'student')}
					>
						Student
					</button>
					<button
						type="button"
						class="btn btn-sm join-item"
						class:btn-active={role === 'instructor'}
						aria-pressed={role === 'instructor'}
						onclick={() => (role = 'instructor')}
					>
						Instructor
					</button>
				</div>

				<button
					type="button"
					class="btn btn-sm"
					class:btn-active={transcriptGranted}
					aria-pressed={transcriptGranted}
					onclick={() => (transcriptGranted = !transcriptGranted)}
				>
					Transcript granted
				</button>
			{/snippet}

			{#snippet secondary()}
				<button type="button" class="btn btn-sm btn-primary" onclick={() => window.print()}>
					Print
				</button>
			{/snippet}
		</ResponsiveDemoMenuBar>
	</div>

	<div class="print-demo__scroll">
		<div class="print-demo__sheet">
			{#if data.demo?.description}
				<p class="print-demo__desc">{data.demo.description}</p>
			{/if}

			{#if entries.length === 0}
				<div class="text-error">No printable content found in this section.</div>
			{/if}

			{#each entries as entry (entry.key)}
				<section class="print-entry">
					<h2 class="print-entry__label">{entry.label}</h2>
					<pie-print use:printConfig={{ item: entry.item, role, accessibility }}></pie-print>
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.print-demo {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #f5f5f5;
	}

	.print-demo__bar {
		flex: 0 0 auto;
	}

	.print-demo__title {
		min-width: 0;
	}

	.print-demo__scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 1.5rem;
	}

	.print-demo__sheet {
		max-width: 820px;
		margin: 0 auto;
	}

	.print-demo__desc {
		color: #555;
		margin-bottom: 1.25rem;
	}

	.print-entry {
		margin-bottom: 1.5rem;
	}

	.print-entry__label {
		font-size: 1rem;
		font-weight: 600;
		color: #333;
		margin: 0 0 0.5rem;
	}

	.print-entry :global(pie-print) {
		display: block;
		background: #fff;
		border-radius: 4px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	@media print {
		.print-demo__bar {
			display: none;
		}

		.print-demo,
		.print-demo__scroll {
			height: auto;
			overflow: visible;
			background: #fff;
			padding: 0;
		}

		.print-entry :global(pie-print) {
			box-shadow: none;
		}
	}
</style>
