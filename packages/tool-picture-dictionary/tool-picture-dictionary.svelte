<svelte:options
	customElement={{
		tag: 'pie-tool-picture-dictionary',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			term: { type: 'String', attribute: 'term' },
			endpoint: { type: 'String', attribute: 'endpoint' },
			language: { type: 'String', attribute: 'language' }
		}
	}}
/>

<script lang="ts">
	/**
	 * Picture dictionary panel.
	 *
	 * Renders only its body; the floating chrome and `visible` belong to the toolbar's
	 * shell.
	 *
	 * The field is the tool's keyboard route, not a convenience: a sighted
	 * keyboard-only learner cannot originate a text selection in non-editable content,
	 * because Chromium does not extend one with Shift+Arrow there without caret
	 * browsing — an OS toggle that does not exist on mobile. A selection-only picture
	 * dictionary would be unreachable for exactly the learners most likely to need it.
	 */
	import {
		createEndpointLookup,
		DEFAULT_MAX_PICTURES,
		isLookupableKeyword,
		normalizeKeyword,
		type PictureLookup,
		type PictureResult
	} from './lookup.js';

	let {
		visible = false,
		toolId = 'pictureDictionary',
		term = '',
		endpoint = '',
		language = '',
		lookup = undefined
	}: {
		visible?: boolean;
		toolId?: string;
		term?: string;
		endpoint?: string;
		language?: string;
		/** Host-supplied resolver, preferred over `endpoint`. */
		lookup?: PictureLookup;
	} = $props();

	type PanelState =
		| { kind: 'unconfigured' }
		| { kind: 'idle' }
		| { kind: 'searching'; term: string }
		| { kind: 'results'; term: string; pictures: PictureResult[] }
		| { kind: 'empty'; term: string }
		| { kind: 'error'; term: string; reason: string };

	let query = $state('');
	let panel = $state<PanelState>({ kind: 'idle' });
	let inFlight: AbortController | null = null;
	let searchedFor = '';

	const resolver = $derived<PictureLookup | null>(
		lookup ?? (endpoint ? createEndpointLookup({ endpoint }) : null)
	);

	$effect(() => {
		if (!resolver && panel.kind === 'idle') panel = { kind: 'unconfigured' };
		if (resolver && panel.kind === 'unconfigured') panel = { kind: 'idle' };
	});

	$effect(() => {
		const incoming = normalizeKeyword(term);
		if (!visible || !incoming || incoming === searchedFor) return;
		query = incoming;
		void runLookup(incoming);
	});

	// No initial focus taken here on purpose: the toolbar shell focuses its own header
	// when the panel opens, and racing that would depend on microtask ordering. The
	// field is one Tab away.

	async function runLookup(raw: string): Promise<void> {
		const activeResolver = resolver;
		if (!activeResolver) {
			panel = { kind: 'unconfigured' };
			return;
		}
		const keyword = normalizeKeyword(raw);
		if (!isLookupableKeyword(keyword)) {
			panel = {
				kind: 'error',
				term: keyword,
				reason: 'Look up a single word or short phrase.'
			};
			return;
		}
		inFlight?.abort();
		const controller = new AbortController();
		inFlight = controller;
		searchedFor = keyword;
		panel = { kind: 'searching', term: keyword };
		const result = await activeResolver(
			{ keyword, language: language || undefined, max: DEFAULT_MAX_PICTURES },
			controller.signal
		);
		if (controller !== inFlight) return;
		inFlight = null;
		if (result.status === 'ok') {
			panel = { kind: 'results', term: keyword, pictures: result.pictures };
		} else if (result.status === 'empty') {
			panel = { kind: 'empty', term: keyword };
		} else {
			panel = { kind: 'error', term: keyword, reason: result.reason };
		}
	}

	function onSubmit(event: SubmitEvent): void {
		event.preventDefault();
		void runLookup(query);
	}

	/**
	 * The picture is the definition, so it never gets an empty `alt`. Without a caption
	 * the keyword stands in, which at least tells a screen reader user what the picture
	 * is meant to depict.
	 */
	function altFor(picture: PictureResult, keyword: string): string {
		return picture.caption ?? keyword;
	}

	const statusMessage = $derived(
		panel.kind === 'searching'
			? `Looking up ${panel.term}`
			: panel.kind === 'results'
				? `${panel.pictures.length} ${panel.pictures.length === 1 ? 'picture' : 'pictures'} for ${panel.term}`
				: panel.kind === 'empty'
					? `No picture for ${panel.term}`
					: ''
	);
</script>

{#if visible}
	<!-- The panel declares the dialog, matching the other shell-hosted tools: the shell
	     supplies the floating chrome and the focus trap but no role of its own. -->
	<div
		class="pie-tool-picture-dictionary"
		data-pie-tool-id={toolId}
		role="dialog"
		aria-label="Picture Dictionary"
	>
		<form class="pie-tool-picture-dictionary__search" onsubmit={onSubmit}>
			<label
				class="pie-tool-picture-dictionary__label"
				for="pie-tool-picture-dictionary-term"
			>
				Word or phrase
			</label>
			<div class="pie-tool-picture-dictionary__row">
				<input
					id="pie-tool-picture-dictionary-term"
					class="pie-tool-picture-dictionary__input"
					type="text"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
					disabled={panel.kind === 'unconfigured'}
				/>
				<button
					class="pie-tool-picture-dictionary__submit"
					type="submit"
					disabled={panel.kind === 'unconfigured' || !query.trim()}
				>
					Look up
				</button>
			</div>
		</form>

		<div
			class="pie-tool-picture-dictionary__status"
			role="status"
			aria-live="polite"
		>
			{statusMessage}
		</div>

		<div class="pie-tool-picture-dictionary__body">
			{#if panel.kind === 'unconfigured'}
				<p class="pie-tool-picture-dictionary__notice">
					No picture dictionary service is configured for this assessment.
				</p>
			{:else if panel.kind === 'idle'}
				<p class="pie-tool-picture-dictionary__notice">
					Type a word to see a picture of it.
				</p>
			{:else if panel.kind === 'searching'}
				<p class="pie-tool-picture-dictionary__notice">
					Looking up “{panel.term}”…
				</p>
			{:else if panel.kind === 'empty'}
				<p class="pie-tool-picture-dictionary__notice">
					No picture for “{panel.term}”.
				</p>
			{:else if panel.kind === 'error'}
				<p class="pie-tool-picture-dictionary__error" role="alert">
					{panel.reason}
				</p>
			{:else}
				<ul class="pie-tool-picture-dictionary__grid">
					{#each panel.pictures as picture (picture.url)}
						<li class="pie-tool-picture-dictionary__cell">
							<img
								class="pie-tool-picture-dictionary__image"
								src={picture.url}
								alt={altFor(picture, panel.term)}
								width={picture.width}
								height={picture.height}
								loading="lazy"
								decoding="async"
							/>
							{#if picture.caption}
								<!-- aria-hidden: the caption is already the image's alt, and
								     announcing it twice is noise. -->
								<span class="pie-tool-picture-dictionary__caption" aria-hidden="true">
									{picture.caption}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pie-tool-picture-dictionary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		min-height: 0;
		padding: 0.75rem;
		box-sizing: border-box;
		color: var(--pie-text, #1f2937);
		background: var(--pie-background, #fff);
		font-size: 0.95rem;
	}

	.pie-tool-picture-dictionary__search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.pie-tool-picture-dictionary__label {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pie-tool-picture-dictionary__row {
		display: flex;
		gap: 0.5rem;
	}

	.pie-tool-picture-dictionary__input {
		flex: 1 1 auto;
		min-width: 0;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 0.375rem;
		background: var(--pie-background, #fff);
		color: inherit;
		font: inherit;
	}

	.pie-tool-picture-dictionary__submit {
		flex: 0 0 auto;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 0.375rem;
		background: var(--pie-background-light, #f9fafb);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pie-tool-picture-dictionary__submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pie-tool-picture-dictionary__input:focus-visible,
	.pie-tool-picture-dictionary__submit:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #2563eb);
		outline-offset: 2px;
	}

	.pie-tool-picture-dictionary__status {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	.pie-tool-picture-dictionary__body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	.pie-tool-picture-dictionary__notice,
	.pie-tool-picture-dictionary__error {
		margin: 0.25rem 0;
	}

	.pie-tool-picture-dictionary__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pie-tool-picture-dictionary__cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 0.375rem;
	}

	.pie-tool-picture-dictionary__image {
		max-width: 100%;
		height: auto;
	}

	.pie-tool-picture-dictionary__caption {
		text-align: center;
		font-size: 0.85rem;
		opacity: 0.85;
	}
</style>
