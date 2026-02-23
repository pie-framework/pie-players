import type { SvelteComponent } from "svelte";
import type { QtiAssessmentSection } from "@pie-players/pie-players-shared";
import type { ComponentDefinition } from "./component-definitions.js";

export interface PieSectionPlayerProps {
	section?: QtiAssessmentSection | null;
	env?: {
		mode: "gather" | "view" | "evaluate" | "author";
		role: "student" | "instructor";
	};
	view?:
		| "candidate"
		| "scorer"
		| "author"
		| "proctor"
		| "testConstructor"
		| "tutor";
	itemSessions?: Record<string, any>;
	pageLayout?: string;
	player?: string;
	playerVersion?: string;
	playerDefinitions?: Partial<Record<string, ComponentDefinition>>;
	layoutDefinitions?: Partial<Record<string, ComponentDefinition>>;
	toolbarPosition?: "top" | "right" | "bottom" | "left" | "none";
	showToolbar?: boolean;
	toolkitCoordinator?: any;
	customClassName?: string;
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
