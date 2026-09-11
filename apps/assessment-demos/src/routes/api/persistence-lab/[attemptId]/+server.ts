import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";
import type { AssessmentSession } from "@pie-players/pie-players-shared/types";
import type { LabBehavior } from "$lib/server/persistence-lab";
import type { RequestHandler } from "./$types";

async function requireLab(attemptId: string) {
	// Fault controls belong only to the local Vite demo, never the built app.
	if (!dev) error(404, "Not found");
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(attemptId)) error(400, "Invalid lab attempt");
	// Load the Vite/Node SQLite adapter only when a development request uses it.
	return import("$lib/server/persistence-lab");
}

export const GET: RequestHandler = async ({ params }) => {
	const { readLab } = await requireLab(params.attemptId);
	return json(readLab(params.attemptId), { headers: { "cache-control": "no-store" } });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const { saveLab } = await requireLab(params.attemptId);
	const text = await request.text();
	if (text.length > 1_000_000) error(413, "Lab snapshot is too large");
	let body: { snapshot?: AssessmentSession; behavior?: LabBehavior };
	try { body = JSON.parse(text); } catch { error(400, "Invalid JSON"); }
	if (!body || !body.snapshot || body.snapshot.assessmentId !== "assessment-persistence-lab" || !body.snapshot.navigationState || !body.snapshot.sectionSessions) error(400, "Expected a lab assessment snapshot");
	if (!body.behavior || !["save", "hold", "reject", "lose-ack"].includes(body.behavior)) error(400, "Invalid lab behavior");
	const { status, ...result } = await saveLab(params.attemptId, body.snapshot, body.behavior);
	return json(result, { status });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { releaseLab } = await requireLab(params.attemptId);
	const body = await request.json().catch(() => null);
	if (!body || !Number.isSafeInteger(body.id) || typeof body.commit !== "boolean") error(400, "Expected write id and commit choice");
	if (!releaseLab(params.attemptId, body.id, body.commit)) error(409, "Write is no longer held");
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { clearLab } = await requireLab(params.attemptId);
	clearLab(params.attemptId);
	return json({ ok: true });
};
