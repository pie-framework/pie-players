/**
 * The New Relic browser agent's API, as far as PIE calls it. A local
 * structural type, so no vendor package reaches the published declarations.
 */
export type NewRelicAgent = {
	noticeError(error: Error, attributes?: Record<string, unknown>): void;
	addPageAction(name: string, attributes?: Record<string, unknown>): void;
	setUserId?(userId: string): void;
	setCustomAttribute?(name: string, value: unknown): void;
};

function hasAgentApi(handle: unknown): handle is NewRelicAgent {
	const candidate = handle as Partial<NewRelicAgent> | null | undefined;
	return (
		typeof candidate?.noticeError === "function" &&
		typeof candidate.addPageAction === "function"
	);
}

/**
 * Returns the New Relic browser agent's API if it is on the page now.
 *
 * `window.NREUM` is the agent's primary global and `window.newrelic` an alias
 * the loader assigns onto the same object, but the install snippet creates
 * `NREUM` as a configuration container before any agent code runs, so the probe
 * tests the callable shape over both names. Nothing is cached: an agent that
 * loads later is found on the next call.
 */
export function probeNewRelicAgent(): NewRelicAgent | undefined {
	if (typeof window === "undefined") return undefined;
	const { newrelic, NREUM } = window as unknown as {
		newrelic?: unknown;
		NREUM?: unknown;
	};
	if (hasAgentApi(newrelic)) return newrelic;
	if (hasAgentApi(NREUM)) return NREUM;
	return undefined;
}
