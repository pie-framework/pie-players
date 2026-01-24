<div class="card bg-base-100 shadow-xl" data-testid="a11y-fixture-root">
	<div class="card-body">
		<h2 class="card-title">Simple form fixture</h2>
		<p class="text-sm opacity-80">
			This fixture exists to validate focus styles and baseline WCAG checks with DaisyUI.
		</p>

		<label class="form-control w-full max-w-md">
			<div class="label">
				<span class="label-text">Name</span>
			</div>
			<input class="input input-bordered" type="text" placeholder="Jane Doe" />
		</label>

		<label class="form-control w-full max-w-md">
			<div class="label">
				<span class="label-text">Mode</span>
			</div>
			<select class="select select-bordered">
				<option>gather</option>
				<option>view</option>
				<option>evaluate</option>
			</select>
		</label>

		<div class="flex gap-2">
			<button class="btn btn-primary">Primary action</button>
			<button class="btn btn-ghost">Secondary action</button>
		</div>
	</div>
</div>


