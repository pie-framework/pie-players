export function withReentrancyGuard<T>(
	guard: { active: boolean },
	run: () => T,
): T | undefined {
	if (guard.active) return undefined;
	guard.active = true;
	try {
		return run();
	} finally {
		guard.active = false;
	}
}
