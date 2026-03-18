import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Demo 5: Resource Loading Observability
 *
 * Purpose:
 * - Exercise image and audio loading paths in passage + item content.
 * - Surface resource-monitor instrumentation events in the debug panel.
 */
export const demo5Section: AssessmentSection = {
	identifier: "demo5-resource-observability",
	title: "Demo 5: Resource Loading Observability",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "resource-observability-passage",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "resource-observability-passage-001",
				name: "Resource Observability Passage",
				baseId: "resource-observability-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>How instruments extend human perception</h2>
            <p>
              This demo intentionally embeds image and audio resources to validate client-side
              resource instrumentation. Open the instrumentation panel and look for
              <code>pie-resource-load</code> records as these assets load.
            </p>

            <figure>
              <img
                src="/demo-assets/resource-observability/spectrum-observer.svg"
                alt="Stylized observatory spectrum chart with layered light bands"
                width="640"
                height="320"
              />
              <figcaption>
                Figure 1. Sample spectrum visualization used for resource-load instrumentation.
              </figcaption>
            </figure>

            <p>Use the playback control below to ensure audio resource fetches are exercised.</p>
            <audio controls preload="auto" src="/demo-assets/resource-observability/signal-chime.wav">
              Your browser does not support embedded audio.
            </audio>
          </div>`,
					elements: {},
					models: [],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "resource-item-1",
			required: true,
			item: {
				id: "resource-item-1",
				name: "Resource Item 1",
				baseId: "resource-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="resourceQ1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "resourceQ1",
							element: "multiple-choice",
							prompt: `Inspect the reference image below and answer the question.<div><img src="/demo-assets/resource-observability/spectrum-observer.svg" alt="Mini spectrum reference image" width="360" height="180" /></div><p>Which statement best describes why this demo includes inline media?</p>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"To test whether resource loads emit instrumentation records in realistic item content.",
									correct: true,
								},
								{
									value: "b",
									label: "To disable all instrumentation providers during rendering.",
									correct: false,
								},
								{
									value: "c",
									label: "To bypass section runtime and render static HTML only.",
									correct: false,
								},
								{
									value: "d",
									label: "To force all images to fail and skip retries.",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "resource-item-2",
			required: true,
			item: {
				id: "resource-item-2",
				name: "Resource Item 2",
				baseId: "resource-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: '<multiple-choice id="resourceQ2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "resourceQ2",
							element: "multiple-choice",
							prompt: `Play the short clip in the option text, then choose the best answer.<div><audio controls preload="auto" src="/demo-assets/resource-observability/signal-chime.wav">Your browser does not support audio.</audio></div><p>What should you expect in the instrumentation panel after media loads?</p>`,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"At least one <strong>pie-resource-load</strong> event, with resource metadata.",
									correct: true,
								},
								{
									value: "b",
									label: "Only scorer-mode events; no resource telemetry is emitted.",
									correct: false,
								},
								{
									value: "c",
									label: "Only New Relic browser errors, never generic events.",
									correct: false,
								},
								{
									value: "d",
									label: "No events unless item responses are submitted first.",
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
