<script lang="ts">
	let { mode = $bindable() }: { mode: 'gather' | 'view' | 'evaluate' } = $props();
</script>

<div class="form-control">
	<label class="label" for="mode-select">
		<span class="label-text">Mode</span>
	</label>
	<select id="mode-select" class="select select-bordered" bind:value={mode}>
		<option value="gather">Gather</option>
		<option value="view">View</option>
		<option value="evaluate">Evaluate</option>
	</select>
</div>
