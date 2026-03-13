import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { demo1Section } from "./demo1-single-question";
import { demo2Section } from "./demo2-question-passage";
import { demo3Section } from "./demo3-three-questions";
import { demo4Section } from "./demo4-tts-ssml";

export interface SectionDemoInfo {
	id: string;
	name: string;
	description: string;
	focus?: string;
	whatMakesItTick?: string[];
	section?: AssessmentSection;
	sections?: Array<{
		id: string;
		name: string;
		section: AssessmentSection;
	}>;
}

const sessionPersistencePageOne: AssessmentSection = {
	identifier: "session-persistence-page-one",
	title: "Dutch Golden Age: Trade and Cities",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "sp1-passage-dutch-trade",
			view: "candidate",
			class: "stimulus",
			passage: {
				id: "sp1-passage-dutch-trade",
				name: "The Dutch Republic and Maritime Trade",
				baseId: "sp1-passage-dutch-trade",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>The Dutch Republic and Maritime Trade</h2>
            <p>
              In the 1600s, the Dutch Republic became one of the most commercially powerful regions in Europe.
              Its merchants built large shipping networks that connected the Baltic, Atlantic, and Indian Ocean worlds.
              Amsterdam's harbor and financial institutions helped merchants invest in long-distance voyages with lower risk.
            </p>
            <p>
              A major institution in this period was the Dutch East India Company (VOC), chartered in 1602. The VOC could
              make treaties, maintain military forces, and establish fortified trading posts. Through these powers, the company
              gained strong control over the spice trade in parts of Southeast Asia and generated large profits for investors.
            </p>
            <p>
              Dutch success depended not only on overseas trade, but also on efficient domestic systems. Canals, warehouses,
              insurance markets, and shipbuilding yards supported a steady movement of goods and information. Historians often
              describe this as an early form of global capitalism, where trade, finance, and state policy worked closely together.
            </p>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
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
							prompt:
								"According to the passage, which institution helped Amsterdam merchants reduce the risk of long-distance voyages?",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "City guild courts", correct: false },
								{
									value: "b",
									label: "Harbor and financial institutions in Amsterdam",
									correct: true,
								},
								{ value: "c", label: "Local church councils", correct: false },
								{ value: "d", label: "Spanish tax offices", correct: false },
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
							prompt:
								"What was one important power granted to the VOC, based on the passage?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "It could establish fortified trading posts",
									correct: true,
								},
								{
									value: "b",
									label: "It could appoint the Holy Roman Emperor",
									correct: false,
								},
								{
									value: "c",
									label: "It could ban all private merchants in Europe",
									correct: false,
								},
								{
									value: "d",
									label: "It could mint coins for all kingdoms",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp1-q3",
			required: true,
			item: {
				id: "sp1-item-3",
				baseId: "sp1-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 3",
				config: {
					markup: '<multiple-choice id="sp1q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q3",
							element: "multiple-choice",
							prompt:
								"Which statement best summarizes the passage's explanation of Dutch commercial success?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "It depended only on military conquest in Europe",
									correct: false,
								},
								{
									value: "b",
									label:
										"It combined overseas trade with strong domestic logistics and finance",
									correct: true,
								},
								{
									value: "c",
									label: "It was mostly caused by agricultural reforms",
									correct: false,
								},
								{
									value: "d",
									label: "It relied on support from the Spanish crown",
									correct: false,
								},
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
	title: "Dutch Golden Age: Art, Society, and Power",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "sp2-passage-dutch-art",
			view: "candidate",
			class: "stimulus",
			passage: {
				id: "sp2-passage-dutch-art",
				name: "Art and Society in the Dutch Golden Age",
				baseId: "sp2-passage-dutch-art",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Art and Society in the Dutch Golden Age</h2>
            <p>
              The Dutch Golden Age was not only an era of trade, but also a period of remarkable artistic production.
              Painters such as Rembrandt van Rijn, Johannes Vermeer, and Frans Hals became known for realistic portraits,
              domestic interiors, and scenes of everyday life. Their works reflected urban culture in the Dutch Republic,
              where a prosperous middle class purchased art for private homes.
            </p>
            <p>
              Unlike courts in some other European states, the Dutch Republic had no single royal patron directing most artistic
              commissions. Instead, artists often worked for an open market. This encouraged variety in subject matter: group
              portraits, landscapes, still lifes, and genre scenes all became popular. Paintings frequently communicated values
              such as thrift, diligence, and civic responsibility.
            </p>
            <p>
              At the same time, the wealth that supported cultural life was connected to global commercial networks, including
              colonial expansion and coercive labor systems. Historians therefore study the Dutch Golden Age as both a creative
              cultural moment and a period shaped by unequal power relationships across regions.
            </p>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
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
							prompt:
								"According to the passage, what distinguished the Dutch art market from court-centered systems in other states?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Artists sold to a broader market rather than mainly to one royal patron",
									correct: true,
								},
								{
									value: "b",
									label: "Only religious institutions were allowed to buy paintings",
									correct: false,
								},
								{
									value: "c",
									label: "The state banned landscapes and still lifes",
									correct: false,
								},
								{
									value: "d",
									label: "Artists were required to paint military victories only",
									correct: false,
								},
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
							prompt:
								"Which interpretation best matches the final paragraph of the passage?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"The period should be seen only as a neutral artistic movement",
									correct: false,
								},
								{
									value: "b",
									label:
										"Cultural achievements and global inequalities are both necessary to understanding the era",
									correct: true,
								},
								{
									value: "c",
									label:
										"Art in the Dutch Republic was disconnected from economic systems",
									correct: false,
								},
								{
									value: "d",
									label: "Colonial expansion ended before artistic growth began",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp2-q3",
			required: true,
			item: {
				id: "sp2-item-3",
				baseId: "sp2-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 3",
				config: {
					markup: '<multiple-choice id="sp2q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q3",
							element: "multiple-choice",
							prompt:
								"Which pair of artists is explicitly identified in the passage as associated with Dutch Golden Age painting?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Rembrandt van Rijn and Johannes Vermeer",
									correct: true,
								},
								{ value: "b", label: "Raphael and Michelangelo", correct: false },
								{ value: "c", label: "El Greco and Caravaggio", correct: false },
								{ value: "d", label: "Titian and Botticelli", correct: false },
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
		focus:
			"The smallest section-player setup: one item in one section, useful for verifying baseline rendering and session wiring.",
		whatMakesItTick: [
			"Single `assessmentItemRefs` entry keeps section composition minimal.",
			"Standard multiple-choice PIE element mapping (`@pie-element/multiple-choice@latest`).",
			"Uses shared route controls (mode/layout/player) without extra persistence complexity."
		],
		section: demo1Section,
	},
	"question-passage": {
		id: "question-passage",
		name: "Question with Passage",
		description: "Section with passage and related question",
		focus:
			"Shows how a stimulus passage and an associated item are authored and rendered together in one section.",
		whatMakesItTick: [
			"Passage content is supplied through `rubricBlocks` as a stimulus block.",
			"Item and passage coexist in section JSON so layout and reading flow can be tested.",
			"Shared demo host allows switching between student/scorer and splitpane/vertical layouts."
		],
		section: demo2Section,
	},
	"three-questions": {
		id: "three-questions",
		name: "Three Questions",
		description: "Section with multiple questions in sequence",
		focus:
			"Exercises multi-item sequencing and navigation behavior within a single section attempt.",
		whatMakesItTick: [
			"Three distinct item refs in one section validate progression and state accumulation.",
			"Same host toolchain as other demos enables easy side-by-side behavior comparison.",
			"Useful baseline before testing advanced persistence or server-hydration flows."
		],
		section: demo3Section,
	},
	"tts-ssml": {
		id: "tts-ssml",
		name: "TTS with SSML",
		description:
			"Three items with passage - demonstrates SSML extraction, AWS SSML tags, and multi-level TTS",
		focus:
			"Demonstrates text-to-speech behavior across plain text, authored SSML, and backend-specific SSML handling.",
		whatMakesItTick: [
			"TTS settings panel lets you switch browser, Polly, and Google providers at runtime.",
			"Section content intentionally mixes plain text and SSML-rich prompts/passages for comparison.",
			"Toolkit tool config enables `textToSpeech` in item and passage placements."
		],
		section: demo4Section,
	},
	"session-persistence": {
		id: "session-persistence",
		name: "Session Persistence Across Sections",
		description:
			"Switch between multi-item section pages and keep each section's sessions via section persistence strategy",
		focus:
			"Shows persistence across section pages so answers survive route/page switching within the same attempt.",
		whatMakesItTick: [
			"Multi-page demo uses `sections[]` with page-specific `section` payloads.",
			"Section controller persistence keys are attempt- and section-scoped.",
			"Session controls expose persist/hydrate/apply flows for direct inspection."
		],
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
	"session-hydrate-db": {
		id: "session-hydrate-db",
		name: "Session Hydration (Server DB)",
		description:
			"Starts empty, hydrates from server-side seeded session data, then streams updates back to the backend database",
		focus:
			"Demonstrates server-backed session lifecycle: bootstrap, hydrate, live persist, and DB state inspection.",
		whatMakesItTick: [
			"`ToolkitCoordinator` hook `createSectionSessionPersistence` routes load/save/clear to API endpoints.",
			"Server bootstrap endpoint seeds section data before player hydration.",
			"DB panel streams state updates and exposes raw/reconstructed/session-request views."
		],
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
