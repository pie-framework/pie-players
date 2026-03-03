import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveUploadedFile } from '$lib/server/authoring-media-store';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData().catch(() => null);
	const upload = formData?.get('file');
	if (!(upload instanceof File)) {
		return json({ ok: false, error: 'Missing uploaded file.' }, { status: 400 });
	}

	console.log('[item-demos] authoring media service: insert-sound', {
		fileName: upload.name || null,
		size: upload.size ?? null,
		type: upload.type ?? null,
	});

	const saved = await saveUploadedFile(upload);
	return json({ ok: true, src: saved.src, fileName: saved.fileName });
};
