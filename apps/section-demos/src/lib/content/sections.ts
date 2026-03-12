import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { demo1Section } from "./demo1-single-question";
import { demo2Section } from "./demo2-question-passage";
import { demo3Section } from "./demo3-three-questions";
import { demo4Section } from "./demo4-tts-ssml";

export interface SectionDemoInfo {
	id: string;
	name: string;
	description: string;
	section?: AssessmentSection;
	sections?: Array<{
		id: string;
		name: string;
		section: AssessmentSection;
	}>;
}

const sessionPersistencePageOne: AssessmentSection = {
	identifier: "session-persistence-page-one",
	title: "Session Persistence Page One",
	keepTogether: true,
	rubricBlocks: [],
	assessmentItemRefs: [
		{
			identifier: "sp1-q1",
			required: true,
			item: {
				id: "sp1-item-1",
				baseId: "sp1-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 1",
				config: {
					markup: '<multiple-choice id="sp1q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q1",
							element: "multiple-choice",
							prompt: "Page 1 / Item 1",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "Alpha", correct: false },
								{ value: "b", label: "Bravo", correct: true },
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp1-q2",
			required: true,
			item: {
				id: "sp1-item-2",
				baseId: "sp1-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 2",
				config: {
					markup: '<multiple-choice id="sp1q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q2",
							element: "multiple-choice",
							prompt: "Page 1 / Item 2",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "Charlie", correct: false },
								{ value: "b", label: "Delta", correct: true },
							],
						},
					],
				},
			},
		},
	],
};

const sessionPersistencePageTwo: AssessmentSection = {
	identifier: "session-persistence-page-two",
	title: "Session Persistence Page Two",
	keepTogether: true,
	rubricBlocks: [],
	assessmentItemRefs: [
		{
			identifier: "sp2-q1",
			required: true,
			item: {
				id: "sp2-item-1",
				baseId: "sp2-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 1",
				config: {
					markup: '<multiple-choice id="sp2q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q1",
							element: "multiple-choice",
							prompt: "Page 2 / Item 1",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "Echo", correct: false },
								{ value: "b", label: "Foxtrot", correct: true },
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp2-q2",
			required: true,
			item: {
				id: "sp2-item-2",
				baseId: "sp2-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 2",
				config: {
					markup: '<multiple-choice id="sp2q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q2",
							element: "multiple-choice",
							prompt: "Page 2 / Item 2",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "Golf", correct: false },
								{ value: "b", label: "Hotel", correct: true },
							],
						},
					],
				},
			},
		},
	],
};

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
	"session-persistence": {
		id: "session-persistence",
		name: "Session Persistence Across Sections",
		description:
			"Switch between multi-item section pages and keep each section's sessions via section persistence strategy",
		sections: [
			{
				id: "session-page-one",
				name: "Session Page One",
				section: sessionPersistencePageOne,
			},
			{
				id: "session-page-two",
				name: "Session Page Two",
				section: sessionPersistencePageTwo,
			},
		],
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
