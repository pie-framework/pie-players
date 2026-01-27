<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';

	const { children } = $props();
	let theme = $state('light');
	const currentPath = $derived($page.url.pathname);

	const themes = ['light', 'dark', 'corporate', 'business'];

	onMount(() => {
		const savedTheme = localStorage.getItem('theme') || 'light';
		theme = themes.includes(savedTheme) ? savedTheme : 'light';
		document.documentElement.setAttribute('data-theme', theme);
	});

	function changeTheme(newTheme: string) {
		theme = newTheme;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	function href(path: string) {
		return `${base}${path}`;
	}
</script>

<svelte:head>
	<title>PIE Players</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-base-200">
	<div class="navbar bg-base-100 shadow-lg">
		<div class="navbar-start">
				<div class="dropdown lg:hidden">
					<div tabindex="0" role="button" class="btn btn-ghost" aria-label="Open navigation menu">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</div>
					<ul class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-56 p-2 shadow">
						<li><a href={href('/')} class:active={currentPath === href('/')}>Home</a></li>
						<li><a href={href('/samples/')} class:active={currentPath === href('/samples/')}>Item Samples</a></li>
						<li><a href={href('/assessment/')} class:active={currentPath === href('/assessment/')}>Assessment Demo</a></li>
						<li><a href={href('/playground/')} class:active={currentPath === href('/playground/')}>Playground</a></li>
						<li><a href={href('/authoring/')} class:active={currentPath === href('/authoring/')}>Item Authoring</a></li>
						<li>
							<a
								href={href('/a11y-components/')}
								class:active={currentPath.startsWith(href('/a11y-components/'))}
							>
								A11y
							</a>
						</li>
						<li>
							<a
								href={href('/toolkit-preview/')}
								class:active={currentPath.startsWith(href('/toolkit-preview/'))}
							>
								Toolkit Preview
							</a>
						</li>
					</ul>
				</div>
			<a href={href('/')} class="btn btn-ghost normal-case text-xl px-2">
				<img src="{base}/pie-logo-orange.svg" alt="PIE Logo" class="h-8 w-8" />
				PIE Players
			</a>
		</div>

		<div class="navbar-center hidden lg:flex">
				<ul class="menu menu-horizontal px-1">
					<li><a href={href('/')} class:active={currentPath === href('/')}>Home</a></li>
					<li><a href={href('/samples/')} class:active={currentPath === href('/samples/')}>Item Samples</a></li>
					<li><a href={href('/assessment/')} class:active={currentPath === href('/assessment/')}>Assessment Demo</a></li>
					<li><a href={href('/playground/')} class:active={currentPath === href('/playground/')}>Playground</a></li>
					<li><a href={href('/authoring/')} class:active={currentPath === href('/authoring/')}>Item Authoring</a></li>
					<li>
						<a
							href={href('/a11y-components/')}
							class:active={currentPath.startsWith(href('/a11y-components/'))}
						>
							A11y
						</a>
					</li>
					<li>
						<a
							href={href('/toolkit-preview/')}
							class:active={currentPath.startsWith(href('/toolkit-preview/'))}
						>
							Toolkit Preview
						</a>
					</li>
			</ul>
		</div>

		<div class="navbar-end">
			<SettingsMenu {theme} onThemeChange={changeTheme} availableThemes={themes} />
		</div>
	</div>

	<div class="flex-1">
		{@render children()}
	</div>
</div>

<style>
	.menu a.active {
		background-color: hsl(var(--p) / 0.1);
		color: hsl(var(--p));
		font-weight: 600;
	}
</style>


