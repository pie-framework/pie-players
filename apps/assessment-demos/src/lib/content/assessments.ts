import type {
	AssessmentSection,
	TestPart,
} from "@pie-players/pie-players-shared/types";

export interface AssessmentDemoInfo {
	id: string;
	name: string;
	description: string;
	assessment: {
		identifier: string;
		title: string;
		testParts: TestPart[];
	};
}

const sectionOne: AssessmentSection = {
	identifier: "assessment-demo-colonial-sea-section-one",
	title: "Section 1: Trade Networks and Early Colonial Entry",
	rubricBlocks: [
		{
			identifier: "assessment-demo-colonial-sea-passage-1",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "assessment-demo-colonial-sea-passage-1",
				baseId: "assessment-demo-colonial-sea-passage-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Portuguese and Dutch Entry into Maritime Southeast Asia",
				config: {
					markup: `<div class="passage">
  <h3>Passage: Maritime Gateways and Colonial Entry</h3>
  <p>In the early 1500s, Melaka sat at one of the world's most valuable maritime chokepoints. Ships carrying spices, textiles, and ceramics moved through the strait in dense seasonal traffic. Portuguese commanders recognized that control over this route offered both customs revenue and strategic leverage.</p>
  <p>By the 1600s, Dutch merchants and investors used joint-stock financing to spread risk and sustain larger expeditions. The Dutch East India Company (VOC) combined commercial goals with state-like powers, including fortified posts, treaties, and naval enforcement in parts of the archipelago.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "assessment-demo-colonial-sea-item-1",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-1",
				baseId: "assessment-demo-colonial-sea-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 1",
				config: {
					markup: '<multiple-choice id="sea12q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q1",
							element: "multiple-choice",
							prompt:
								"Which factor most directly motivated Portuguese seizure of Melaka in 1511?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Control of the strategic maritime choke point and spice trade routes",
									correct: true,
								},
								{
									value: "b",
									label: "An alliance to restore the Majapahit empire",
									correct: false,
								},
								{
									value: "c",
									label: "A mission to establish rice plantation colonies",
									correct: false,
								},
								{
									value: "d",
									label: "Direct invitation by the Malacca Sultanate",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "assessment-demo-colonial-sea-item-2",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-2",
				baseId: "assessment-demo-colonial-sea-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 2",
				config: {
					markup: '<multiple-choice id="sea12q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q2",
							element: "multiple-choice",
							prompt:
								"How did the Dutch East India Company (VOC) differ from earlier Portuguese expansion in Southeast Asia?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "The VOC operated as a chartered corporation with quasi-state powers",
									correct: true,
								},
								{
									value: "b",
									label: "The VOC avoided all fortifications and naval force",
									correct: false,
								},
								{
									value: "c",
									label: "The VOC focused only on missionary conversion",
									correct: false,
								},
								{
									value: "d",
									label: "The VOC had no role in the spice islands",
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

const sectionTwo: AssessmentSection = {
	identifier: "assessment-demo-colonial-sea-section-two",
	title: "Section 2: Colonial Governance and Resistance",
	rubricBlocks: [
		{
			identifier: "assessment-demo-colonial-sea-passage-2",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "assessment-demo-colonial-sea-passage-2",
				baseId: "assessment-demo-colonial-sea-passage-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial Governance in the Philippines and Indonesia",
				config: {
					markup: `<div class="passage">
  <h3>Passage: Governance Models and Imperial Priorities</h3>
  <p>Spanish rule in the Philippines relied heavily on church networks, tribute structures, and the Manila galleon trade that linked Asia to the Americas. Dutch rule in Indonesia centered more strongly on monopolizing high-value commodities and using chartered-company administration.</p>
  <p>The 1824 Anglo-Dutch Treaty formalized British and Dutch spheres in maritime Southeast Asia. The agreement shaped later political boundaries and redirected colonial investment into more tightly managed administrative zones.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "assessment-demo-colonial-sea-item-3",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-3",
				baseId: "assessment-demo-colonial-sea-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 3",
				config: {
					markup: '<multiple-choice id="sea12q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q3",
							element: "multiple-choice",
							prompt:
								"Which statement best describes Spain's colonial strategy in the Philippines compared to Dutch rule in Indonesia?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Spain relied more heavily on church-mission networks and galleon trade integration",
									correct: true,
								},
								{
									value: "b",
									label: "Spain governed primarily through VOC shareholders",
									correct: false,
								},
								{
									value: "c",
									label: "Spain had no military presence and used only private merchants",
									correct: false,
								},
								{
									value: "d",
									label: "Spain was absent from the Philippines until the late 1800s",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "assessment-demo-colonial-sea-item-4",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-4",
				baseId: "assessment-demo-colonial-sea-item-4",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 4",
				config: {
					markup: '<multiple-choice id="sea12q4"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q4",
							element: "multiple-choice",
							prompt:
								"The 1824 Anglo-Dutch Treaty is historically significant because it:",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Created clear British and Dutch spheres in maritime Southeast Asia",
									correct: true,
								},
								{
									value: "b",
									label: "Ended all European influence in the region",
									correct: false,
								},
								{
									value: "c",
									label: "Transferred Java to Spanish control",
									correct: false,
								},
								{
									value: "d",
									label: "Established independence for Malaya and Indonesia",
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

const sectionThree: AssessmentSection = {
	identifier: "assessment-demo-colonial-sea-section-three",
	title: "Section 3: Decolonization and Historical Interpretation",
	rubricBlocks: [
		{
			identifier: "assessment-demo-colonial-sea-passage-3",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "assessment-demo-colonial-sea-passage-3",
				baseId: "assessment-demo-colonial-sea-passage-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Decolonization and Historical Interpretation",
				config: {
					markup: `<div class="passage">
  <h3>Passage: War, Nationalism, and Competing Legacies</h3>
  <p>World War II disrupted long-standing European authority in Southeast Asia. Japanese occupation weakened colonial administrations and accelerated nationalist mobilization across multiple territories.</p>
  <p>Postwar independence movements interpreted colonial legacies differently. Some historians emphasize extractive labor and unequal trade; others note that railways, ports, and bureaucratic systems also shaped later state-building. Current scholarship often compares both dynamics rather than treating them as mutually exclusive.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "assessment-demo-colonial-sea-item-5",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-5",
				baseId: "assessment-demo-colonial-sea-item-5",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 5",
				config: {
					markup: '<multiple-choice id="sea12q5"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q5",
							element: "multiple-choice",
							prompt:
								"Which combination most strongly accelerated post-World War II decolonization in Southeast Asia?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Japanese wartime disruption of European authority plus growth of nationalist movements",
									correct: true,
								},
								{
									value: "b",
									label: "A complete collapse of global trade networks before 1900",
									correct: false,
								},
								{
									value: "c",
									label: "Immediate military withdrawal by all colonial powers in 1939",
									correct: false,
								},
								{
									value: "d",
									label: "A unified single-party government across all colonies",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "assessment-demo-colonial-sea-item-6",
			required: true,
			item: {
				id: "assessment-demo-colonial-sea-item-6",
				baseId: "assessment-demo-colonial-sea-item-6",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Colonial SEA Item 6",
				config: {
					markup: '<multiple-choice id="sea12q6"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sea12q6",
							element: "multiple-choice",
							prompt:
								"A historian argues that colonial infrastructure had both extractive and modernizing effects. This is best described as:",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "A nuanced interpretation balancing continuity and change",
									correct: true,
								},
								{
									value: "b",
									label: "A purely nationalist myth with no evidence",
									correct: false,
								},
								{
									value: "c",
									label: "A claim that colonialism had no impact",
									correct: false,
								},
								{
									value: "d",
									label: "An argument that all colonies developed identically",
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

const baseTestParts: TestPart[] = [
	{
		identifier: "assessment-demo-stage-one",
		navigationMode: "linear",
		submissionMode: "individual",
		sections: [sectionOne, sectionTwo, sectionThree],
	},
];

const sessionDbSectionOne: AssessmentSection = {
	identifier: "assessment-session-db-section-one",
	title: "Assessment Session DB: Section One",
	rubricBlocks: [
		{
			identifier: "assessment-session-db-passage-1",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "assessment-session-db-passage-1",
				baseId: "assessment-session-db-passage-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Assessment Host Policy and Persistence",
				config: {
					markup: `<div class="passage">
  <h3>Passage: Host-Owned Policy with Durable Session State</h3>
  <p>The assessment player coordinates section delivery, but host applications own product policy such as timing rules, gating, and app-level workflow decisions. The framework provides hooks and events so hosts can compose these behaviors without forking core runtime code.</p>
  <p>For persistence, hosts should store canonical assessment session snapshots and rehydrate them when attempts resume. This keeps route, section, and response context aligned across refreshes and device transitions.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "assessment-db-q1",
			required: true,
			item: {
				id: "assessment-db-item-1",
				baseId: "assessment-db-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Assessment DB Item 1",
				config: {
					markup: '<multiple-choice id="assessmentdbq1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "assessmentdbq1",
							element: "multiple-choice",
							prompt:
								"Which layer should primarily own assessment policy such as navigation gating?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Assessment player framework internals",
									correct: false,
								},
								{
									value: "b",
									label: "Host application policy layer",
									correct: true,
								},
								{
									value: "c",
									label: "Item-level component schema",
									correct: false,
								},
								{
									value: "d",
									label: "Toolkit coordinator default providers",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "assessment-db-q2",
			required: true,
			item: {
				id: "assessment-db-item-2",
				baseId: "assessment-db-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Assessment DB Item 2",
				config: {
					markup: '<multiple-choice id="assessmentdbq2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "assessmentdbq2",
							element: "multiple-choice",
							prompt:
								"Which contract should hosts persist as canonical assessment state?",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "getRuntimeState output", correct: false },
								{ value: "b", label: "AssessmentSession snapshot", correct: true },
								{
									value: "c",
									label: "Only route-changed event payloads",
									correct: false,
								},
								{
									value: "d",
									label: "Tool registry state",
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

const sessionDbSectionTwo: AssessmentSection = {
	identifier: "assessment-session-db-section-two",
	title: "Assessment Session DB: Section Two",
	rubricBlocks: [
		{
			identifier: "assessment-session-db-passage-2",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "assessment-session-db-passage-2",
				baseId: "assessment-session-db-passage-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Framework Scope and Extensibility",
				config: {
					markup: `<div class="passage">
  <h3>Passage: What the Framework Owns (and What It Doesn't)</h3>
  <p>The assessment framework should expose stable primitives: navigation state, lifecycle hooks, session persistence interfaces, and telemetry events. These primitives support many product variants without hardcoding one institution's policy.</p>
  <p>Authentication, user profiles, LMS routing, and wider application shell concerns remain host responsibilities. This boundary keeps the framework small while still enabling rich, product-specific behavior.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "assessment-db-q3",
			required: true,
			item: {
				id: "assessment-db-item-3",
				baseId: "assessment-db-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Assessment DB Item 3",
				config: {
					markup: '<multiple-choice id="assessmentdbq3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "assessmentdbq3",
							element: "multiple-choice",
							prompt:
								"When multiple products consume the same framework, what should the framework optimize for?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "One fixed product workflow with many hardcoded policies",
									correct: false,
								},
								{
									value: "b",
									label:
										"Stable primitives and extensibility so each host can implement its own spin",
									correct: true,
								},
								{
									value: "c",
									label: "No events or hooks, only baked-in UI",
									correct: false,
								},
								{
									value: "d",
									label: "No persistence surface",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "assessment-db-q4",
			required: true,
			item: {
				id: "assessment-db-item-4",
				baseId: "assessment-db-item-4",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Assessment DB Item 4",
				config: {
					markup: '<multiple-choice id="assessmentdbq4"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "assessmentdbq4",
							element: "multiple-choice",
							prompt:
								"Which concern is generally out of scope for the assessment-player framework?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Assessment route snapshots",
									correct: false,
								},
								{
									value: "b",
									label: "Section switching orchestration",
									correct: false,
								},
								{
									value: "c",
									label: "User auth and app-level navigation shell",
									correct: true,
								},
								{
									value: "d",
									label: "Assessment session persistence hooks",
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

const sessionDbTestParts: TestPart[] = [
	{
		identifier: "assessment-session-db-stage-one",
		navigationMode: "linear",
		submissionMode: "individual",
		sections: [sessionDbSectionOne, sessionDbSectionTwo],
	},
];

const assessmentDemos: Record<string, AssessmentDemoInfo> = {
	"three-section-assessment": {
		id: "three-section-assessment",
		name: "Grade 12: Colonial Southeast Asia (Three Sections)",
		description:
			"K-12 style history assessment with three sections on colonial Southeast Asia, plus assessment-level navigation and session continuity.",
		assessment: {
			identifier: "assessment-demo-001",
			title: "Grade 12 History Assessment: Colonial Southeast Asia",
			testParts: baseTestParts,
		},
	},
	"session-hydrate-db": {
		id: "session-hydrate-db",
		name: "Session Hydration (Server DB)",
		description:
			"Assessment-player-first demo with server-seeded assessment session hydration, live persistence, and reset flows.",
		assessment: {
			identifier: "assessment-session-db-demo-001",
			title: "Assessment Session DB Demo",
			testParts: sessionDbTestParts,
		},
	},
};

export function getAssessmentDemoById(id: string | undefined) {
	if (!id) return null;
	return assessmentDemos[id] || null;
}

export function getAllAssessmentDemos(): AssessmentDemoInfo[] {
	return Object.values(assessmentDemos);
}
