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
