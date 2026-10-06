declare module "speech-rule-engine" {
	export function setupEngine(
		options: Record<string, unknown>,
	): Promise<void> | void;
	export function engineReady(): Promise<void>;
	export function toSpeech(mathml: string): string;
	const sre: {
		setupEngine: typeof setupEngine;
		engineReady: typeof engineReady;
		toSpeech: typeof toSpeech;
	};
	export default sre;
}

// Locale tables sre-locales.ts hands back to SRE unread. Opaque, because
// inferring types from 4 MB of JSON doubles the package's typecheck memory; the
// package tsconfig turns off `resolveJsonModule` so this declaration applies.
declare module "speech-rule-engine/lib/mathmaps/*.json" {
	const table: unknown;
	export default table;
}
