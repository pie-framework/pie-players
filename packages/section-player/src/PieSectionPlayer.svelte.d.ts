import type { SvelteComponent } from "svelte";
import type { AssessmentSection } from "@pie-players/pie-players-shared";

export interface PieSectionPlayerProps {
	section?: AssessmentSection | null;
	mode?: "gather" | "view" | "evaluate" | "author";
	view?:
		| "candidate"
		| "scorer"
		| "author"
		| "proctor"
		| "testConstructor"
		| "tutor";
	itemSessions?: Record<string, any>;
	bundleHost?: string;
	esmCdnUrl?: string;
	customClassname?: string;
	debug?: string | boolean;
}

export default class PieSectionPlayer extends SvelteComponent<PieSectionPlayerProps> {
	navigateNext(): void;
	navigatePrevious(): void;
	getNavigationState(): {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		isLoading: boolean;
	};
}
