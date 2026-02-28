<script lang="ts">
	let {
		role = $bindable(),
		name = 'role',
		onChange,
	}: {
		role: 'student' | 'instructor';
		name?: string;
		onChange?: (value: 'student' | 'instructor') => void;
	} = $props();

	function handleChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement)
			.value as 'student' | 'instructor';
		onChange?.(value);
	}
</script>

<div class="form-control">
	<label class="label" for="role-select">
		<span class="label-text">Role</span>
	</label>
	<select
		id="role-select"
		class="select select-bordered"
		{name}
		bind:value={role}
		onchange={handleChange}
	>
		<option value="student">Student</option>
		<option value="instructor">Instructor</option>
	</select>
</div>
