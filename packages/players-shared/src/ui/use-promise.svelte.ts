/**
 * Svelte 5 composable that turns a promise factory into a reactive lifecycle
 * value with four explicit states. Consumers read `handle.current` in a
 * `$derived`/template and get race-free status transitions.
 *
 * Why this exists
 * ---------------
 *
 * Svelte 5's reactivity is runes-based, and placing a promise directly inside
 * a `$derived` is awkward: the derived value is the promise itself, and the
 * component needs to await it indirectly, usually via an ad-hoc `$state` flag
 * set from a `$effect`. That pattern is the root cause of the section-swap
 * readiness race fixed as part of the deep ElementLoader architecture work:
 *
 *   let ready = $state(false);
 *   $effect(() => { loader(args).then(() => ready = true); });
 *   {#if ready} <Items /> {/if}
 *
 * When `args` change under a live component, `ready` can be stale while the
 * template has already re-rendered with the new inputs. The fix is to treat
 * the loader call as a lifecycle value that (a) carries its own status,
 * (b) invalidates instantly when its inputs change, and (c) ignores late
 * resolutions from stale invocations.
 *
 * Contract
 * --------
 *
 * - The factory is called reactively; every tracked read inside the factory
 *   participates in the effect's dependencies.
 * - When the factory returns `null`, the handle moves back to `idle`.
 * - Each invocation is tagged with a monotonic token; only the most-recent
 *   invocation can transition the handle out of `pending`. Earlier
 *   resolutions are silently dropped.
 * - `handle.current` is the single read surface; the underlying `$state` is
 *   not exposed. Templates use `{#if handle.current.status === "resolved"}`.
 *
 * Example
 * -------
 *
 * ```svelte
 * <script lang="ts">
 *   import { usePromise } from "@pie-players/pie-players-shared/ui";
 *
 *   let { items } = $props();
 *
 *   const readiness = usePromise(() =>
 *     items.length === 0 ? null : loader.ensureRegistered(aggregate(items)),
 *   );
 * </script>
 *
 * {#if readiness.current.status === "resolved"}
 *   {#each items as item}<item-card {item} />{/each}
 * {:else if readiness.current.status === "rejected"}
 *   <ErrorBanner error={readiness.current.error} />
 * {:else}
 *   <LoadingSpinner />
 * {/if}
 * ```
 */

export type PromiseState<T> =
	| { status: "idle" }
	| { status: "pending" }
	| { status: "resolved"; data: T }
	| { status: "rejected"; error: unknown };

export type PromiseHandle<T> = {
	readonly current: PromiseState<T>;
};

/**
 * Reactive promise lifecycle helper.
 *
 * @param factory Function that returns the promise to track, or `null` to
 *   return to `idle`. Called inside a `$effect`, so every reactive read
 *   participates in the invalidation graph.
 */
export function usePromise<T>(
	factory: () => Promise<T> | null | undefined,
): PromiseHandle<T> {
	let state = $state<PromiseState<T>>({ status: "idle" });
	let token = 0;

	$effect(() => {
		const promise = factory();
		if (!promise) {
			state = { status: "idle" };
			return;
		}
		const thisToken = ++token;
		state = { status: "pending" };
		promise.then(
			(data) => {
				if (thisToken !== token) return;
				state = { status: "resolved", data };
			},
			(error) => {
				if (thisToken !== token) return;
				state = { status: "rejected", error };
			},
		);
	});

	return {
		get current() {
			return state;
		},
	};
}
