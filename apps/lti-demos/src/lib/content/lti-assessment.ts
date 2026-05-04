import type {
	AssessmentSection,
	TestPart,
} from "@pie-players/pie-players-shared/types";

export const LTI_DEMO_ASSESSMENT_ID = "lti-demo-civics-check";

const launchAndPersistenceSection: AssessmentSection = {
	identifier: "lti-demo-launch-section",
	title: "LTI Launch And Persistence",
	rubricBlocks: [
		{
			identifier: "lti-demo-launch-passage",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "lti-demo-launch-passage",
				baseId: "lti-demo-launch-passage",
				version: { major: 1, minor: 0, patch: 0 },
				name: "LTI Host Boundary",
				config: {
					markup: `<div class="passage">
  <h3>Passage: LTI Tool Hosts</h3>
  <p>An LTI tool launch starts in the LMS, but the tool host validates the launch and creates the attempt context. The player receives only the content, environment, attempt identifier, and persistence hooks it needs to render the assessment.</p>
  <p>This keeps protocol validation, user identity, and grade passback outside the browser custom elements while still letting the player own runtime rendering and session mechanics.</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "lti-demo-launch-item-1",
			required: true,
			item: {
				id: "lti-demo-launch-item-1",
				baseId: "lti-demo-launch-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "LTI Launch Ownership",
				config: {
					markup: '<multiple-choice id="ltiLaunchQ1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "ltiLaunchQ1",
							element: "multiple-choice",
							prompt:
								"Which layer should validate the LTI launch before PIE players render?",
							choiceMode: "radio",
							choices: [
								{
									value: "tool-host",
									label: "The LTI tool host application",
									correct: true,
								},
								{
									value: "custom-element",
									label: "The pie-assessment-player custom element",
									correct: false,
								},
								{
									value: "pie-item",
									label: "Each individual PIE item element",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "lti-demo-launch-item-2",
			required: true,
			item: {
				id: "lti-demo-launch-item-2",
				baseId: "lti-demo-launch-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "LTI Persistence Ownership",
				config: {
					markup: '<multiple-choice id="ltiLaunchQ2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "ltiLaunchQ2",
							element: "multiple-choice",
							prompt:
								"What should a production LTI host persist for an assessment attempt?",
							choiceMode: "radio",
							choices: [
								{
									value: "session",
									label: "The assessment controller's getSession() snapshot",
									correct: true,
								},
								{
									value: "runtime",
									label: "The player runtime state object",
									correct: false,
								},
								{
									value: "dom",
									label: "The rendered DOM inside the iframe",
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

const testPart: TestPart = {
	identifier: "lti-demo-test-part",
	navigationMode: "linear",
	submissionMode: "individual",
	sections: [launchAndPersistenceSection],
};

export const ltiDemoAssessment = {
	identifier: LTI_DEMO_ASSESSMENT_ID,
	title: "LTI Launch Integration Demo",
	testParts: [testPart],
};
