/**
 * The `grepInvert` that leaves out the tests tagged `@iife`: those that load elements under
 * the iife strategy from the production bundle host. The host builds each element set the
 * first time a page asks for it, so these tests depend on a production service; a test that
 * stubs the bundle host, or rejects a config before anything loads, carries no tag.
 *
 * Opt-in through `PIE_E2E_IIFE=1`. The required suites and the pre-push gate run without it;
 * the `test:e2e:iife:*` scripts set it and select the tag.
 *
 * @returns {RegExp | undefined}
 */
export function iifeGrepInvert() {
	return process.env.PIE_E2E_IIFE === "1" ? undefined : /@iife\b/;
}
