import {
	ItemController,
	SessionStorageItemSessionStorage,
	type ItemSessionContainer,
} from '@pie-players/pie-players-shared';
import { derived, writable } from 'svelte/store';

export type DemoMode = 'gather' | 'view' | 'evaluate';
export type DemoRole = 'student' | 'instructor';

export const mode = writable<DemoMode>('gather');
export const role = writable<DemoRole>('student');
export const config = writable<any>(null);
export const session = writable<any>({ id: '', data: [] });
export const score = writable<any>(null);

export const env = derived([mode, role], ([$mode, $role]) => ({ mode: $mode, role: $role }));

const SESSION_STORAGE_PREFIX = 'item-demos:session:';
let sessionController: ItemController | null = null;

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

function getSessionStorageKey(demoId: string): string {
	return `${SESSION_STORAGE_PREFIX}${demoId}`;
}

export function initializeDemoState(demoId: string, nextConfig: any) {
	sessionController = new ItemController({
		itemId: demoId,
		storage: new SessionStorageItemSessionStorage(),
		storageKey: getSessionStorageKey(demoId),
		initialSession: { id: `${demoId}-session`, data: [] },
	});
	session.set(cloneValue(sessionController.getSession()));
	void sessionController.hydrate().then((hydrated: ItemSessionContainer) => {
		session.set(cloneValue(hydrated));
	});
	config.set(cloneValue(nextConfig));
	score.set(null);
}

export function updateConfig(nextConfig: any) {
	config.set(cloneValue(nextConfig));
}

export function updateSession(nextSession: any) {
	const normalized = (sessionController?.setSession(nextSession, {
		persist: true,
		allowMetadataOverwrite: false,
	}) ?? nextSession) as ItemSessionContainer;
	session.set(cloneValue(normalized));
}

export function updateScore(nextScore: any) {
	score.set(cloneValue(nextScore));
}
