import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MEDIA_ROOT = path.join(os.tmpdir(), 'pie-item-demos-authoring-media');
const URL_PREFIX = '/api/authoring-media/file/';

const MIME_EXTENSION_MAP: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/svg+xml': '.svg',
	'audio/mpeg': '.mp3',
	'audio/mp4': '.m4a',
	'audio/wav': '.wav',
	'audio/webm': '.webm',
	'audio/ogg': '.ogg',
};

function normalizeFileNamePart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function extensionFromNameOrType(fileName: string, contentType: string): string {
	const extFromName = path.extname(fileName || '');
	if (extFromName) {
		return normalizeFileNamePart(extFromName.toLowerCase());
	}
	return MIME_EXTENSION_MAP[contentType] || '';
}

export function mediaUrlFromFileName(fileName: string): string {
	return `${URL_PREFIX}${encodeURIComponent(fileName)}`;
}

export function fileNameFromMediaUrl(src: string): string | null {
	try {
		const parsed = src.startsWith('http://') || src.startsWith('https://') ? new URL(src) : null;
		const pathname = parsed ? parsed.pathname : src;
		if (!pathname.startsWith(URL_PREFIX)) return null;
		const encoded = pathname.slice(URL_PREFIX.length);
		if (!encoded) return null;
		return decodeURIComponent(encoded);
	} catch {
		return null;
	}
}

export async function ensureMediaRoot(): Promise<void> {
	await fs.mkdir(MEDIA_ROOT, { recursive: true });
}

export async function saveUploadedFile(file: File): Promise<{ fileName: string; src: string }> {
	await ensureMediaRoot();
	const ext = extensionFromNameOrType(file.name || '', file.type || '');
	const baseName = normalizeFileNamePart(path.basename(file.name || 'upload').replace(/\.[^.]+$/, ''));
	const safeBase = baseName || 'upload';
	const fileName = `${safeBase}-${randomUUID()}${ext}`;
	const absolutePath = path.join(MEDIA_ROOT, fileName);
	const bytes = new Uint8Array(await file.arrayBuffer());
	await fs.writeFile(absolutePath, bytes);
	return {
		fileName,
		src: mediaUrlFromFileName(fileName),
	};
}

export async function readStoredFile(fileName: string): Promise<Uint8Array | null> {
	const safeName = path.basename(fileName);
	if (!safeName) return null;
	try {
		const buffer = await fs.readFile(path.join(MEDIA_ROOT, safeName));
		return new Uint8Array(buffer);
	} catch {
		return null;
	}
}

export async function deleteStoredFile(fileName: string): Promise<boolean> {
	const safeName = path.basename(fileName);
	if (!safeName) return false;
	try {
		await fs.unlink(path.join(MEDIA_ROOT, safeName));
		return true;
	} catch {
		return false;
	}
}
