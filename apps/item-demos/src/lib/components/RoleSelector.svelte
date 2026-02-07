<script lang="ts">
	let { role = $bindable() }: { role: 'student' | 'instructor' } = $props();
</script>

<div class="form-control">
	<label class="label" for="role-select">
		<span class="label-text">Role</span>
	</label>
	<select id="role-select" class="select select-bordered" bind:value={role}>
		<option value="student">Student</option>
		<option value="instructor">Instructor</option>
	</select>
</div>
