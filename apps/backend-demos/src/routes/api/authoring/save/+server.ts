import { json } from "@sveltejs/kit";
import { getDemoItemId, saveDemoItemConfig } from "../../player/db";
import type { DemoItemConfig } from "../../player/db";
import type { RequestHandler } from "./$types";

function isDemoItemConfig(value: unknown): value is DemoItemConfig {
	if (!value || typeof value !== "object") return false;
	const config = value as Partial<DemoItemConfig>;
	return (
		typeof config.id === "string" &&
		typeof config.markup === "string" &&
		!!config.elements &&
		typeof config.elements === "object" &&
		Array.isArray(config.models)
	);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		contentId?: string;
		collectionId?: string;
		config?: unknown;
		env?: Record<string, unknown>;
		options?: {
			preReleaseType?: string | null;
		};
	};
	if (!isDemoItemConfig(body.config)) {
		return json({ error: "config is required" }, { status: 400 });
	}
	const contentId = body.contentId || body.config.id || getDemoItemId();
	const saved = saveDemoItemConfig({
		id: contentId,
		name: `Authoring Draft ${contentId}`,
		description: "Saved through the backend.authoring demo route.",
		config: body.config,
	});
	return json({
		contentId: saved.id,
		collectionId: body.collectionId || "backend-demo-collection",
		metadata: {
			source: "backend-demos",
			operation: "authoring.saveContent",
			preReleaseType: body.options?.preReleaseType ?? null,
			env: body.env || null,
		},
	});
};
