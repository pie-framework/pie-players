import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

export const demo9Section: AssessmentSection = {
	identifier: "demo9-preloaded-fixed-elements",
	title: "Demo 9: Preloaded Fixed Element Versions",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "preloaded-fixed-passage-block",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "preloaded-fixed-passage",
				name: "Preloaded Passage",
				baseId: "preloaded-fixed-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<passage-element id="preloaded-passage"></passage-element>',
					elements: {
						"passage-element": "@pie-element/passage@5.3.3",
					},
					models: [
						{
							id: "preloaded-passage",
							element: "passage-element",
							passages: [
								{
									title: "How a Preloaded Section Runs",
									subtitle: "Fixed package versions in section JSON",
									text: `<p>
The section-player can render item and passage content from a host-supplied section configuration. In this demo, the host lists every PIE element package and version directly in <code>config.elements</code> before the player starts.
</p>
<p>
The demo route collects those package specs, builds one preloaded bundle URL, loads that bundle once, and then renders the section with <code>player-type="preloaded"</code>. Because the package specs are pinned, the passage and item players are fixed to known versions for this section.
</p>`,
								},
							],
						},
					],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "preloaded-fixed-multiple-choice-ref",
			required: true,
			item: {
				id: "preloaded-fixed-multiple-choice",
				name: "Fixed Multiple Choice",
				baseId: "preloaded-fixed-multiple-choice",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="preloaded-mc"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@11.4.3",
					},
					models: [
						{
							id: "preloaded-mc",
							element: "multiple-choice",
							prompt:
								"Which field fixes the multiple-choice package version used by this section?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "<code>config.elements</code>",
									correct: true,
								},
								{
									value: "b",
									label: "<code>assessmentItemRefs.required</code>",
									correct: false,
								},
								{
									value: "c",
									label: "<code>rubricBlocks.view</code>",
									correct: false,
								},
								{
									value: "d",
									label: "<code>version.major</code> on the demo item entity",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "preloaded-fixed-categorize-ref",
			required: true,
			item: {
				id: "preloaded-fixed-categorize",
				name: "Fixed Categorize",
				baseId: "preloaded-fixed-categorize",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<categorize-element id="preloaded-categorize"></categorize-element>',
					elements: {
						"categorize-element": "@pie-element/categorize@11.3.2",
					},
					models: [
						{
							id: "preloaded-categorize",
							element: "categorize-element",
							prompt:
								"<p>Sort each demo responsibility into the part of the preloaded flow that handles it.</p>",
							promptEnabled: true,
							categories: [
								{
									id: "host",
									label: "Host route",
								},
								{
									id: "section",
									label: "Section configuration",
								},
								{
									id: "player",
									label: "Player runtime",
								},
							],
							categoriesPerRow: 3,
							choicesPosition: "above",
							choicesLabel: "Responsibilities",
							choices: [
								{
									id: "collect-packages",
									content: "Collects package specs and injects the preloaded bundle",
									categoryCount: 1,
									correctResponseCount: 1,
								},
								{
									id: "pin-versions",
									content: "Pins exact PIE element versions in <code>config.elements</code>",
									categoryCount: 1,
									correctResponseCount: 1,
								},
								{
									id: "render-tags",
									content:
										"Derives runtime versioned custom-element tags from the package specs",
									categoryCount: 1,
									correctResponseCount: 1,
								},
								{
									id: "bind-models",
									content: "Matches authored element IDs to models",
									categoryCount: 1,
									correctResponseCount: 1,
								},
							],
							correctResponse: [
								{
									category: "host",
									choices: ["collect-packages"],
								},
								{
									category: "section",
									choices: ["pin-versions", "bind-models"],
								},
								{
									category: "player",
									choices: ["render-tags"],
								},
							],
							lockChoiceOrder: true,
							maxChoicesPerCategory: 0,
							partialScoring: true,
							minRowHeight: "96px",
						},
					],
				},
			},
		},
	],
};
