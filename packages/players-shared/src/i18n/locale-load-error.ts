/**
 * The `framework-error` report for a failed interface-locale catalog load.
 *
 * Every locale driver — the toolkit through its error bus, the standalone item
 * player and the reference assembly through this helper — reports the same
 * failure the same way: a `framework-error` DOM event whose detail carries the
 * `i18n-locale-load` kind with `recoverable: true`, because every key still
 * resolves through the English fallback chain and the player renders — in the
 * wrong language, which a host wants to know about.
 *
 * The shape mirrors the toolkit's `FrameworkErrorModel` field for field. It is
 * declared here, narrowly, because the standalone item player does not depend
 * on the toolkit and a type-only import would still drag it into the published
 * declarations; what this module commits to is the fields below, which is what
 * a host reading `.kind` and `.recoverable` consumes.
 */
export interface InterfaceLocaleLoadErrorModel {
	kind: "i18n-locale-load";
	source: string;
	message: string;
	details: string[];
	recoverable: true;
	scope: "runtime";
	cause?: unknown;
}

/**
 * Dispatches the recoverable load-failure report on `target` as a
 * `bubbles`/`composed` `framework-error` event. No-op without a target, so a
 * caller mounted as a plain component rather than an element stays silent.
 *
 * Failed loads are not cached: re-setting the `locale` attribute, or
 * recomposing the `i18n` provider, drives `setLocale` again and so retries.
 */
export function reportInterfaceLocaleLoadError(
	target: Element | null | undefined,
	source: string,
	cause: unknown,
): void {
	if (!target) return;
	const message =
		cause instanceof Error && cause.message.trim().length > 0
			? cause.message
			: String(cause ?? "Unknown catalog load failure");
	const detail: InterfaceLocaleLoadErrorModel = {
		kind: "i18n-locale-load",
		source,
		message,
		details: [],
		recoverable: true,
		scope: "runtime",
		cause,
	};
	target.dispatchEvent(
		new CustomEvent("framework-error", {
			detail,
			bubbles: true,
			composed: true,
		}),
	);
}
