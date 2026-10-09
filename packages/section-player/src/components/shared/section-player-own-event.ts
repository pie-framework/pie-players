/**
 * Whether an event that reached a layout host belongs to that section player.
 *
 * The runtime engine dispatches its events on the host. The toolkit's
 * `framework-error` bubbles out of the player's own `<pie-section-player-base>`,
 * the first one in the host's render root: its light DOM, or the shadow root
 * of a host that has one, where the event arrives retargeted to the host. An
 * event from a player nested in an item reaches the host with another target.
 */
export function isOwnSectionPlayerEvent(event: Event, host: Element): boolean {
	const target = event.target;
	if (target === host) return true;
	return (
		target instanceof Element &&
		target.localName === "pie-section-player-base" &&
		(host.shadowRoot ?? host).querySelector("pie-section-player-base") ===
			target
	);
}
