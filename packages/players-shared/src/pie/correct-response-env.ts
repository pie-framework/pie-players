import type { Env } from "../types/index.js";

export const canPopulateCorrectResponses = (env: Env): boolean =>
  env.mode !== "evaluate";

export const getCorrectResponseEnv = (env: Env): Env => ({
  ...env,
  role: "instructor",
});
