/**
 * Write a temp `.npmrc` carrying a scoped `_authToken` and return an env
 * object pointing `NPM_CONFIG_USERCONFIG` at it, so a publish subprocess
 * authenticates without a separate `npm login`. The token comes from
 * `NPM_TOKEN`/`NODE_AUTH_TOKEN` in `baseEnv` first, falling back to parsing
 * an `.env`-style file at `envPath` for either key.
 *
 * Call `cleanup()` once the subprocess using `env` has exited.
 */
export declare const createNpmAuthEnvironment: (
	envPath?: string,
	baseEnv?: NodeJS.ProcessEnv,
) => { env: NodeJS.ProcessEnv; cleanup: () => void };
