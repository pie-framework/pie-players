<script lang="ts">
	let {
		mode = $bindable(),
		role = 'student',
		name = 'mode',
		onChange,
	}: {
		mode: 'gather' | 'view' | 'evaluate';
		role?: 'student' | 'instructor';
		name?: string;
		onChange?: (value: 'gather' | 'view' | 'evaluate') => void;
	} = $props();

	function handleChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement)
			.value as 'gather' | 'view' | 'evaluate';
		onChange?.(value);
	}
</script>

<div class="form-control">
	<label class="label" for="mode-select">
		<span class="label-text">Mode</span>
	</label>
	<select
		id="mode-select"
		class="select select-bordered"
		{name}
		bind:value={mode}
		onchange={handleChange}
	>
		<option value="gather">Gather</option>
		<option value="view">View</option>
		<option value="evaluate" disabled={role !== 'instructor'}>Evaluate</option>
	</select>
</div>
