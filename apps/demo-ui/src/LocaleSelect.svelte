<script lang="ts">
	/**
	 * Interface-locale picker for a demo site's header. Presentation only: the
	 * caller owns where the value lives, which in every demo app is the `locale`
	 * search param, so a demo can be linked in a second language.
	 */
	interface Props {
		/** Locales the players ship a catalog for, in the order to offer them. */
		locales: readonly string[];
		/** The selected tag, or `""` for "pass nothing". */
		value: string;
		onSelect: (locale: string) => void;
		/**
		 * Label for the empty option. It does not mean "the browser's language" —
		 * a player given no locale falls back to `en-US`, deliberately, and being
		 * able to see that is half the point of the control.
		 */
		unsetLabel?: string;
	}

	let { locales, value, onSelect, unsetLabel = "Host default" }: Props = $props();

	/**
	 * Each tag is labelled in its own language, so a reader finds the option that
	 * reads the way they expect. `Intl.DisplayNames` needs no table and labels a
	 * locale the moment a catalog for it is added.
	 */
	function label(tag: string): string {
		try {
			return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
		} catch {
			return tag;
		}
	}
</script>

<label class="flex items-center gap-2">
	<span class="sr-only">Select interface locale</span>
	<select
		class="select select-sm select-bordered"
		{value}
		onchange={(e) => onSelect((e.currentTarget as HTMLSelectElement).value)}
		aria-label="Select interface locale"
		title="Select interface locale"
		data-testid="demo-locale-select"
	>
		<option value="">{unsetLabel}</option>
		{#each locales as locale (locale)}
			<option value={locale}>{label(locale)} — {locale}</option>
		{/each}
	</select>
</label>
