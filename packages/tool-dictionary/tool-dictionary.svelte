<svelte:options
	customElement={{
		tag: 'pie-tool-dictionary',
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
	 * Dictionary panel.
	 *
	 * Renders only its body: the floating chrome — title bar, drag, resize, close —
	 * belongs to the toolbar's shell, which also owns `visible`.
	 *
	 * Two ways in, deliberately. The `term` prop is set by whatever selection
	 * affordance the host offers, and the field is how a learner looks up a word
	 * without one. A sighted keyboard-only learner cannot originate a text selection
	 * in non-editable content at all — Chromium does not extend a selection with
	 * Shift+Arrow there unless caret browsing is on, an OS toggle absent on mobile —
	 * so a selection-only dictionary is unreachable for them. The field is the reason
	 * this tool is keyboard accessible, not a convenience.
	 */
	import {
		createEndpointLookup,
		DEFAULT_MAX_ENTRIES,
		isLookupableTerm,
		normalizeTerm,
		type DictionaryEntry,
		type DictionaryLookup
	} from './lookup.js';

	let {
		visible = false,
		toolId = 'dictionary',
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
		/**
		 * Host-supplied resolver, preferred over `endpoint`. A property rather than an
		 * attribute because it is a function; a host with its own client passes it
		 * directly instead of routing through HTTP shaping this package guessed at.
		 */
		lookup?: DictionaryLookup;
	} = $props();

	type PanelState =
		| { kind: 'unconfigured' }
		| { kind: 'idle' }
		| { kind: 'searching'; term: string }
		| { kind: 'results'; term: string; entries: DictionaryEntry[] }
		| { kind: 'empty'; term: string }
		| { kind: 'error'; term: string; reason: string };

	let query = $state('');
	let panel = $state<PanelState>({ kind: 'idle' });
	/** Cancels a lookup the learner has already superseded. */
	let inFlight: AbortController | null = null;
	/** The term the last search ran for, so `term` changes do not re-search on every render. */
	let searchedFor = '';

	const resolver = $derived<DictionaryLookup | null>(
		lookup ?? (endpoint ? createEndpointLookup({ endpoint }) : null)
	);

	// A tool with nowhere to look words up says so, rather than offering a field that
	// silently fails. The host has misconfigured it and the learner needs to know it is
	// not their typing.
	$effect(() => {
		if (!resolver && panel.kind === 'idle') panel = { kind: 'unconfigured' };
		if (resolver && panel.kind === 'unconfigured') panel = { kind: 'idle' };
	});

	/**
	 * A term handed in from outside opens the panel already answered.
	 *
	 * Guarded on `searchedFor` so re-renders do not re-issue the same lookup, and on
	 * `visible` so a selection made while the panel is closed does not spend a request.
	 */
	$effect(() => {
		const incoming = normalizeTerm(term);
		if (!visible || !incoming || incoming === searchedFor) return;
		query = incoming;
		void runLookup(incoming);
	});

	// No initial focus taken here on purpose. The toolbar shell focuses its own header
	// when the panel opens, so its arrow keys move and resize the window; racing that
	// with a focus of our own would depend on which microtask landed last. The field is
	// one Tab away, which is what matters.

	async function runLookup(raw: string): Promise<void> {
		const activeResolver = resolver;
		if (!activeResolver) {
			panel = { kind: 'unconfigured' };
			return;
		}
		const keyword = normalizeTerm(raw);
		if (!isLookupableTerm(keyword)) {
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
			{ keyword, language: language || undefined, max: DEFAULT_MAX_ENTRIES },
			controller.signal
		);
		// A superseded lookup must not overwrite the newer one's state.
		if (controller !== inFlight) return;
		inFlight = null;
		if (result.status === 'ok') {
			panel = { kind: 'results', term: keyword, entries: result.entries };
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

	const statusMessage = $derived(
		panel.kind === 'searching'
			? `Looking up ${panel.term}`
			: panel.kind === 'results'
				? `${panel.entries.length} ${panel.entries.length === 1 ? 'entry' : 'entries'} for ${panel.term}`
				: panel.kind === 'empty'
					? `No dictionary entry for ${panel.term}`
					: ''
	);
</script>

{#if visible}
	<!-- The panel declares the dialog, as the other shell-hosted tools do: the toolbar's
	     shell supplies the floating chrome and the focus trap but no role of its own. -->
	<div
		class="pie-tool-dictionary"
		data-pie-tool-id={toolId}
		role="dialog"
		aria-label="Dictionary"
	>
		<form class="pie-tool-dictionary__search" onsubmit={onSubmit}>
			<label class="pie-tool-dictionary__label" for="pie-tool-dictionary-term">
				Word or phrase
			</label>
			<div class="pie-tool-dictionary__row">
				<input
					id="pie-tool-dictionary-term"
					class="pie-tool-dictionary__input"
					type="text"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
					disabled={panel.kind === 'unconfigured'}
				/>
				<button
					class="pie-tool-dictionary__submit"
					type="submit"
					disabled={panel.kind === 'unconfigured' || !query.trim()}
				>
					Look up
				</button>
			</div>
		</form>

		<!-- Polite, because a result the learner asked for should not cut across what a
		     screen reader is already reading out. -->
		<div class="pie-tool-dictionary__status" role="status" aria-live="polite">
			{statusMessage}
		</div>

		<div class="pie-tool-dictionary__body">
			{#if panel.kind === 'unconfigured'}
				<p class="pie-tool-dictionary__notice">
					No dictionary service is configured for this assessment.
				</p>
			{:else if panel.kind === 'idle'}
				<p class="pie-tool-dictionary__notice">
					Type a word to look it up.
				</p>
			{:else if panel.kind === 'searching'}
				<p class="pie-tool-dictionary__notice">Looking up “{panel.term}”…</p>
			{:else if panel.kind === 'empty'}
				<p class="pie-tool-dictionary__notice">
					No entry for “{panel.term}”.
				</p>
			{:else if panel.kind === 'error'}
				<!-- assertive: the learner is waiting on this and nothing else in the panel
				     has changed to tell them. -->
				<p class="pie-tool-dictionary__error" role="alert">{panel.reason}</p>
			{:else}
				<ul class="pie-tool-dictionary__entries">
					{#each panel.entries as entry (entry.word + entry.senses.length)}
						<li class="pie-tool-dictionary__entry">
							<p class="pie-tool-dictionary__word">
								{entry.word}
								{#if entry.pronunciation}
									<span class="pie-tool-dictionary__pronunciation">
										{entry.pronunciation}
									</span>
								{/if}
							</p>
							<ol class="pie-tool-dictionary__senses">
								{#each entry.senses as sense, index (index)}
									<li class="pie-tool-dictionary__sense">
										{#if sense.partOfSpeech}
											<span class="pie-tool-dictionary__pos">{sense.partOfSpeech}</span>
										{/if}
										<span class="pie-tool-dictionary__definition">{sense.definition}</span>
										{#if sense.example}
											<span class="pie-tool-dictionary__example">“{sense.example}”</span>
										{/if}
									</li>
								{/each}
							</ol>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pie-tool-dictionary {
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

	.pie-tool-dictionary__search {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.pie-tool-dictionary__label {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pie-tool-dictionary__row {
		display: flex;
		gap: 0.5rem;
	}

	.pie-tool-dictionary__input {
		flex: 1 1 auto;
		min-width: 0;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 0.375rem;
		background: var(--pie-background, #fff);
		color: inherit;
		font: inherit;
	}

	.pie-tool-dictionary__submit {
		flex: 0 0 auto;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 0.375rem;
		background: var(--pie-background-light, #f9fafb);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pie-tool-dictionary__submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Visible focus is not optional: this panel is the keyboard route into the tool. */
	.pie-tool-dictionary__input:focus-visible,
	.pie-tool-dictionary__submit:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #2563eb);
		outline-offset: 2px;
	}

	.pie-tool-dictionary__status {
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

	.pie-tool-dictionary__body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	.pie-tool-dictionary__notice,
	.pie-tool-dictionary__error {
		margin: 0.25rem 0;
	}

	.pie-tool-dictionary__entries,
	.pie-tool-dictionary__senses {
		margin: 0;
		padding: 0 0 0 1.1rem;
	}

	.pie-tool-dictionary__entries {
		list-style: none;
		padding-left: 0;
	}

	.pie-tool-dictionary__entry + .pie-tool-dictionary__entry {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-tool-dictionary__word {
		margin: 0 0 0.25rem;
		font-weight: 700;
	}

	.pie-tool-dictionary__pronunciation {
		margin-left: 0.4rem;
		font-weight: 400;
		opacity: 0.75;
	}

	.pie-tool-dictionary__sense {
		margin-bottom: 0.35rem;
	}

	.pie-tool-dictionary__pos {
		margin-right: 0.3rem;
		font-style: italic;
		opacity: 0.8;
	}

	.pie-tool-dictionary__example {
		display: block;
		opacity: 0.8;
	}
</style>
