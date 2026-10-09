import { describe, expect, spyOn, test } from "bun:test";
import type { ToolSurfaceRenderContext } from "@pie-players/pie-assessment-toolkit/tools/registration";

import {
	CONTENT_MEDIA_SURFACE,
	signLanguageRegistration,
} from "../src/sign-language-registration.js";

describe("signLanguageRegistration.renderSurface", () => {
	test("reports once when it is asked to render without resolved content", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const context = {
				toolId: signLanguageRegistration.toolId,
				granted: true,
				surface: CONTENT_MEDIA_SURFACE,
				content: null,
				services: {},
			} as unknown as ToolSurfaceRenderContext;
			expect(signLanguageRegistration.renderSurface?.(context)).toBeNull();
			expect(signLanguageRegistration.renderSurface?.(context)).toBeNull();

			const messages = warn.mock.calls.map((call) => String(call[0]));
			expect(messages).toHaveLength(1);
			expect(messages[0]).toContain("carries no resolved signed alternate");
		} finally {
			warn.mockRestore();
		}
	});
});
