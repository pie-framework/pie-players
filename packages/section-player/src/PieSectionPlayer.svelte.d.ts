import type { SvelteComponent } from "svelte";
import type {
	ToolkitCoordinator,
} from "@pie-players/pie-assessment-toolkit";
import type { AssessmentSection } from "@pie-players/pie-players-shared";
import type { ComponentDefinition } from "./component-definitions.js";

export interface PieSectionPlayerProps {
	section?: AssessmentSection | null;
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
	layout?: string;
	layoutDefinitions?: Partial<Record<string, ComponentDefinition>>;
	toolbarPosition?: "top" | "right" | "bottom" | "left" | "none";
	showToolbar?: boolean;
	toolkitCoordinator?: ToolkitCoordinator | null;
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
