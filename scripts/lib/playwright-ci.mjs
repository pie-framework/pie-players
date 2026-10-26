/** The browser image must match the resolved runner, not its manifest range. */
export function playwrightImage(lock) {
	const version = lock.packages?.["@playwright/test"]?.[0]?.match(
		/^@playwright\/test@(\d+\.\d+\.\d+)$/,
	)?.[1];
	if (!version) {
		throw new Error("CI needs a released @playwright/test version in bun.lock.");
	}
	for (const name of ["playwright", "playwright-core"]) {
		if (lock.packages?.[name]?.[0] !== `${name}@${version}`) {
			throw new Error(`CI browser image requires ${name} to match @playwright/test ${version}.`);
		}
	}
	return `mcr.microsoft.com/playwright:v${version}-noble`;
}
