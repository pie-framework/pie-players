import type { SvelteComponent } from "svelte";
import type { QtiAssessmentSection } from "@pie-players/pie-players-shared/types";

export interface PieSectionPlayerProps {
	section?: QtiAssessmentSection | null;
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
