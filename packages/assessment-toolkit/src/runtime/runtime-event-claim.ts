/**
 * Whether the toolkit running as `runtimeId` claims a shell's event. A shell
 * scope puts the id of the runtime that answered it in `detail.runtimeId`, and
 * only that runtime claims the event. An event without one, from a shell that
 * dispatches on its own, is claimed when `isLocalTarget` resolves its target
 * to this runtime.
 */
export function isRuntimeEventClaimed(
	event: Event,
	runtimeId: string,
	isLocalTarget: (target: EventTarget | null) => boolean,
): boolean {
	const addressedTo = (event as CustomEvent<{ runtimeId?: unknown } | null>)
		.detail?.runtimeId;
	if (typeof addressedTo === "string" && addressedTo !== "") {
		return addressedTo === runtimeId;
	}
	return isLocalTarget(event.target);
}
