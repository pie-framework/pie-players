import { describe, expect, test } from "bun:test";
import {
  canPopulateCorrectResponses,
  getCorrectResponseEnv,
} from "../src/pie/correct-response-env";

describe("correct-response env compatibility", () => {
  test("forces instructor role for correct-response generation", () => {
    const env = { mode: "view", role: "student" } as const;
    const out = getCorrectResponseEnv(env);
    expect(out.mode).toBe("view");
    expect(out.role).toBe("instructor");
  });

  test("preserves non-role env fields while coercing role", () => {
    const env = {
      mode: "gather",
      role: "student",
      partialScoring: true,
      custom: "x",
    } as any;
    const out = getCorrectResponseEnv(env);
    expect(out).toEqual({
      mode: "gather",
      role: "instructor",
      partialScoring: true,
      custom: "x",
    });
  });

  test("blocks populate in evaluate mode", () => {
    expect(
      canPopulateCorrectResponses({
        mode: "evaluate",
        role: "student",
      } as any),
    ).toBe(false);
    expect(
      canPopulateCorrectResponses({
        mode: "view",
        role: "student",
      } as any),
    ).toBe(true);
  });
});
