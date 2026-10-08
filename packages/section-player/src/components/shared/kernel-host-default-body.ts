/**
 * The kernel host's default body: its stock arrangement of the panes, present
 * exactly while the host gives the element no element children of its own.
 *
 * Mounted into the element's light DOM, beside any children, where the player's
 * item content renders in every layout: that is where page styles, the content
 * stylesheet and the item players' own injected styles reach it. As fallback
 * content of the shadow root's slot it would sit in the shadow tree, out of their
 * reach, and stay mounted, hidden, beside a host's own panes.
 *
 * Text and comment children do not count, so markup whitespace and a framework's
 * placeholder comments leave the default in place. Returns the teardown.
 */
export function attachKernelHostDefaultBody(
	host: HTMLElement,
	mountBody: (target: HTMLElement) => () => void,
): () => void {
	let unmountBody: (() => void) | null = null;
	let bodyNodes = new Set<Node>();

	const hasHostChildren = () =>
		Array.from(host.children).some((child) => !bodyNodes.has(child));

	const sync = () => {
		const wanted = !hasHostChildren();
		if (wanted && !unmountBody) {
			const before = new Set<Node>(host.childNodes);
			unmountBody = mountBody(host);
			bodyNodes = new Set(
				Array.from(host.childNodes).filter((node) => !before.has(node)),
			);
			return;
		}
		if (!wanted && unmountBody) {
			const unmount = unmountBody;
			unmountBody = null;
			bodyNodes = new Set();
			unmount();
		}
	};

	sync();
	const observer = new MutationObserver(sync);
	observer.observe(host, { childList: true });

	return () => {
		observer.disconnect();
		const unmount = unmountBody;
		unmountBody = null;
		bodyNodes = new Set();
		unmount?.();
	};
}
