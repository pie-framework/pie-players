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
	import { untrack } from 'svelte';
	import {
		normalizeTerm,
		termPanelStatusMessage,
		TermLookupSession,
		type TermPanelState
	} from '@pie-players/pie-players-shared/tools/term-lookup';
	import {
		createEndpointLookup,
		DEFAULT_MAX_ENTRIES,
		type DictionaryEntry,
		type DictionaryLookup
	} from './lookup.js';

	let {
		visible = false,
		toolId = 'dictionary',
		term = '',
		termRequestId = undefined,
		endpoint = '',
		language = '',
		lookup = undefined,
		headers = undefined,
		credentials = undefined
	}: {
		visible?: boolean;
		toolId?: string;
		term?: string;
		/**
		 * Identity of the current `term`, changing once per time it was asked for.
		 *
		 * Optional: a host assigning `term` directly need not mint one, and the panel
		 * falls back to the term itself. What it buys is a learner selecting the same
		 * word twice — a second request for `cat` has a new id, so it re-runs, where an
		 * unchanged `term` alone looks like a re-render.
		 */
		termRequestId?: string | number;
		endpoint?: string;
		language?: string;
		/**
		 * Host-supplied resolver, preferred over `endpoint`. A property rather than an
		 * attribute because it is a function; a host with its own client passes it
		 * directly instead of routing through HTTP shaping this package guessed at.
		 */
		lookup?: DictionaryLookup;
		/**
		 * Extra request headers for the `endpoint` path, read per request so a
		 * short-lived token is fetched fresh rather than captured at mount.
		 *
		 * Only for a host whose route is not authorised by the assessment's own session:
		 * the endpoint is called `same-origin` by default, so a route behind that session
		 * needs nothing here.
		 */
		headers?: () => Promise<Record<string, string>> | Record<string, string>;
		/** Overrides the `same-origin` default for the `endpoint` path. */
		credentials?: RequestCredentials;
	} = $props();

	let query = $state('');
	let panel = $state<TermPanelState<DictionaryEntry>>({ kind: 'idle' });

	const resolver = $derived<DictionaryLookup | null>(
		lookup ?? (endpoint ? createEndpointLookup({ endpoint, headers, credentials }) : null)
	);

	// Request sequencing and the state transitions are shared with the picture
	// dictionary; only what an entry looks like is this tool's own.
	const session = new TermLookupSession<DictionaryEntry>({
		resolver: () => resolver,
		max: DEFAULT_MAX_ENTRIES,
		language: () => language,
		onState: (next) => {
			panel = next;
		}
	});

	// `untrack` because the body both reads and writes `panel`: the write goes through
	// `onState`, and a tracked read of what it writes is a self-invalidating effect.
	$effect(() => {
		void resolver;
		untrack(() => session.syncConfigured(panel));
	});

	/**
	 * A term handed in from outside opens the panel already answered.
	 *
	 * The session owns the once-per-request guard; all this effect decides is when to
	 * mirror the term into the visible field, which is only when a lookup actually ran.
	 */
	$effect(() => {
		const incoming = normalizeTerm(term);
		const requestId = termRequestId;
		const isVisible = visible;
		untrack(() => {
			if (session.syncRequestedTerm({ term: incoming, requestId, visible: isVisible })) {
				query = incoming;
			}
		});
	});

	// No initial focus taken here on purpose. The toolbar shell focuses its own header
	// when the panel opens, so its arrow keys move and resize the window; racing that
	// with a focus of our own would depend on which microtask landed last. The field is
	// one Tab away, which is what matters.

	function onSubmit(event: SubmitEvent): void {
		event.preventDefault();
		void session.run(query);
	}

	const statusMessage = $derived(
		termPanelStatusMessage(panel, {
			countLabel: (count) => `${count} ${count === 1 ? 'entry' : 'entries'}`,
			emptyLabel: (word) => `No dictionary entry for ${word}`
		})
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
					{#each panel.items as entry (entry.word + entry.senses.length)}
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
