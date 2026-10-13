/**
 * Waits for every value to settle and resolves with each outcome in input
 * order, as the `allSettled` static does. Built on `Promise.all` and `then` alone:
 * a host page can replace the global `Promise` with an implementation that
 * predates `allSettled` (zone.js 0.9.1 does), so published code calls no
 * `Promise` static beyond `all`, `race`, `resolve` and `reject`.
 * `bun run check:bundle-safety` enforces that on every built bundle.
 * @param values The promises or plain values to settle.
 */
export const settleAll = <T>(
	values: Iterable<T | PromiseLike<T>>,
): Promise<PromiseSettledResult<Awaited<T>>[]> =>
	Promise.all(
		Array.from(values, (value) =>
			Promise.resolve(value).then(
				(result): PromiseFulfilledResult<Awaited<T>> => ({
					status: "fulfilled",
					value: result,
				}),
				(reason: unknown): PromiseRejectedResult => ({
					status: "rejected",
					reason,
				}),
			),
		),
	);
