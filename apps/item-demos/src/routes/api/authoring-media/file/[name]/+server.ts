import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readStoredFile } from '$lib/server/authoring-media-store';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.wav': 'audio/wav',
	'.webm': 'audio/webm',
	'.ogg': 'audio/ogg',
};

function contentTypeFor(fileName: string): string {
	const ext = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase() || ''}` : '';
	return CONTENT_TYPE_BY_EXTENSION[ext] || 'application/octet-stream';
}

export const GET: RequestHandler = async ({ params }) => {
	const name = params.name;
	if (!name) {
		throw error(400, 'Missing file name.');
	}
	const bytes = await readStoredFile(name);
	if (!bytes) {
		throw error(404, 'Media file not found.');
	}
	const normalizedBytes = Uint8Array.from(bytes);
	const blob = new Blob([normalizedBytes], { type: contentTypeFor(name) });
	return new Response(blob, {
		headers: {
			'cache-control': 'no-store',
		},
	});
};
