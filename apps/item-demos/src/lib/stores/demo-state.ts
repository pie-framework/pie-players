import { derived, get, writable } from 'svelte/store';

export type DemoMode = 'gather' | 'view' | 'evaluate';
export type DemoRole = 'student' | 'instructor';

export const mode = writable<DemoMode>('gather');
export const role = writable<DemoRole>('student');
export const config = writable<any>(null);
export const session = writable<any>({ id: '', data: [] });
export const score = writable<any>(null);

export const env = derived([mode, role], ([$mode, $role]) => ({ mode: $mode, role: $role }));

const SESSION_STORAGE_PREFIX = 'item-demos:session:';
let currentDemoId: string | null = null;

function cloneValue<T>(value: T): T {
	try {
		if (typeof structuredClone === 'function') {
			return structuredClone(value);
		}
	} catch {}
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return value;
	}
}

function hasSessionResponseValue(value: unknown): boolean {
	if (value == null) return false;
	if (Array.isArray(value)) {
		return value.some((entry) => hasSessionResponseValue(entry));
	}
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		for (const [key, nested] of Object.entries(record)) {
			if (
				key === 'value' &&
				nested !== undefined &&
				nested !== null &&
				!(typeof nested === 'string' && nested.trim() === '') &&
				!(Array.isArray(nested) && nested.length === 0)
			) {
				return true;
			}
			if (hasSessionResponseValue(nested)) {
				return true;
			}
		}
	}
	return false;
}

function getSessionStorageKey(demoId: string): string {
	return `${SESSION_STORAGE_PREFIX}${demoId}`;
}

function readPersistedSession(demoId: string): any | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(getSessionStorageKey(demoId));
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function persistSession(demoId: string, nextSession: any): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(
			getSessionStorageKey(demoId),
			JSON.stringify(nextSession),
		);
	} catch {}
}

export function initializeDemoState(demoId: string, nextConfig: any) {
	currentDemoId = demoId;
	const persistedSession = readPersistedSession(demoId);
	session.set(
		cloneValue(persistedSession ?? { id: `${demoId}-session`, data: [] }),
	);
	config.set(cloneValue(nextConfig));
	score.set(null);
}

export function updateConfig(nextConfig: any) {
	config.set(cloneValue(nextConfig));
}

export function updateSession(nextSession: any) {
	const cloned = cloneValue(nextSession);
	const current = get(session);
	// Prevent transient metadata-only updates (often emitted on init/reload)
	// from wiping a richer session that already has response values.
	if (
		hasSessionResponseValue(current) &&
		!hasSessionResponseValue(cloned)
	) {
		return;
	}
	session.set(cloned);
	if (currentDemoId) {
		persistSession(currentDemoId, cloned);
	}
}

export function updateScore(nextScore: any) {
	score.set(cloneValue(nextScore));
}
