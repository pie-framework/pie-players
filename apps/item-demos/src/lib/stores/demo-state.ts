import { derived, writable } from 'svelte/store';

export type DemoMode = 'gather' | 'view' | 'evaluate';
export type DemoRole = 'student' | 'instructor';

export const mode = writable<DemoMode>('gather');
export const role = writable<DemoRole>('student');
export const config = writable<any>(null);
export const session = writable<any>({ id: '', data: [] });
export const score = writable<any>(null);

export const env = derived([mode, role], ([$mode, $role]) => ({ mode: $mode, role: $role }));

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

export function initializeDemoState(demoId: string, nextConfig: any) {
	session.set({ id: `${demoId}-session`, data: [] });
	config.set(cloneValue(nextConfig));
	score.set(null);
}

export function updateConfig(nextConfig: any) {
	config.set(cloneValue(nextConfig));
}

export function updateSession(nextSession: any) {
	session.set(cloneValue(nextSession));
}

export function updateScore(nextScore: any) {
	score.set(cloneValue(nextScore));
}
