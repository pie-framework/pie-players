import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteStoredFile, fileNameFromMediaUrl } from '$lib/server/authoring-media-store';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { src?: string };
	const fileName = body.src ? fileNameFromMediaUrl(body.src) : null;
	const deleted = fileName ? await deleteStoredFile(fileName) : false;

	console.log('[item-demos] authoring media service: delete-image', {
		src: body.src ?? null,
		fileName,
		deleted,
	});

	return json({ ok: true });
};
