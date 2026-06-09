import { json } from "@sveltejs/kit";
import { mergeSessionUpdates, runModelControllers } from "../controllers";
import { ensureSession, getDemoItem, getDemoItemId, saveSession } from "../db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		itemId?: string;
		sessionId?: string;
		assignmentId?: string;
		env?: Record<string, unknown>;
	};
	const itemId = body.itemId || getDemoItemId();
	const item = getDemoItem(itemId);
	if (!item) {
		return json({ error: `Unknown demo itemId: ${itemId}` }, { status: 404 });
	}
	let session;
	try {
		session = ensureSession(itemId, body.sessionId);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 409 },
		);
	}
	const env = {
		...(body.env || {}),
		mode: "gather",
		role: "student",
	};
	const modelResults = await runModelControllers({
		config: item.config,
		sessionData: session.data,
		env,
	});
	const sessionUpdates = modelResults.flatMap(
		(result) => result.sessionUpdates,
	);
	const persistedSession =
		sessionUpdates.length > 0
			? saveSession(
					session.id,
					mergeSessionUpdates(session.data, sessionUpdates),
					item.id,
				)
			: session;
	const processedConfig = {
		...item.config,
		models: modelResults.map((result) => result.model),
	};
	return json({
		js: { view: [] },
		item: processedConfig,
		session: persistedSession,
		metadata: {
			assignmentId: body.assignmentId || null,
			dbItemId: item.id,
			modelSource: "controller.model",
			rawModelCount: item.config.models.length,
			processedModelCount: processedConfig.models.length,
			source: "backend-demos",
		},
	});
};
