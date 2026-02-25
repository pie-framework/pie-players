import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { demo1Section } from "./demo1-single-question";
import { demo2Section } from "./demo2-question-passage";
import { demo3Section } from "./demo3-three-questions";
import { demo4Section } from "./demo4-tts-ssml";

export interface SectionDemoInfo {
	id: string;
	name: string;
	description: string;
	section: AssessmentSection;
}

export const sectionDemos: Record<string, SectionDemoInfo> = {
	"single-question": {
		id: "single-question",
		name: "Single Question",
		description: "Section with one multiple choice question",
		section: demo1Section,
	},
	"question-passage": {
		id: "question-passage",
		name: "Question with Passage",
		description: "Section with passage and related question",
		section: demo2Section,
	},
	"three-questions": {
		id: "three-questions",
		name: "Three Questions",
		description: "Section with multiple questions in sequence",
		section: demo3Section,
	},
	"tts-ssml": {
		id: "tts-ssml",
		name: "TTS with SSML",
		description:
			"Three items with passage - demonstrates SSML extraction, AWS SSML tags, and multi-level TTS",
		section: demo4Section,
	},
};

export function getSectionDemoById(
	id: string | undefined,
): SectionDemoInfo | null {
	if (!id) return null;
	return sectionDemos[id] || null;
}

export function getAllSectionDemos(): SectionDemoInfo[] {
	return Object.values(sectionDemos);
}
