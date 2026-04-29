import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "select-text-default",
	"name": "Narrator Reliability Evidence",
	"description": "8th-grade language arts sentence evidence selection",
	"sourcePackage": "select-text",
	"sourceVariantId": "default",
	"tags": [
		"select-text",
		"default",
		"sentence-mode",
		"language-arts",
		"grade-8"
	],
	"item": {
		"id": "select-text-default",
		"name": "Narrator Reliability Evidence",
		"config": {
			"id": "",
			"markup": "<select-text id=\"1\"></select-text>",
			"elements": {
				"select-text": "@pie-element/select-text@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "select-text",
					"highlightChoices": false,
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Correct. Those two sentences provide evidence that the narrator is unreliable."
						},
						"incorrect": {
							"type": "default",
							"default": "Not quite. Look for specific details showing the narrator changes facts."
						},
						"partial": {
							"type": "default",
							"default": "Almost there. You identified one piece of evidence."
						}
					},
					"partialScoring": true,
					"maxSelections": 2,
					"mode": "sentence",
					"rationale": "The strongest evidence is where the narrator is described as unreliable and where specific changed facts are mentioned.",
					"prompt": "Select the two sentences that best support the claim that the narrator is unreliable.",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom",
					"text": "Maya reread the chapter before class discussion. She highlighted two details that showed the narrator was unreliable. During discussion, she explained how the narrator changed key facts between scenes. Her group agreed that the contradictions built suspense.",
					"tokens": [
						{
							"text": "Maya reread the chapter before class discussion.",
							"start": 0,
							"end": 48,
							"correct": false
						},
						{
							"text": "She highlighted two details that showed the narrator was unreliable.",
							"start": 49,
							"end": 117,
							"correct": true
						},
						{
							"text": "During discussion, she explained how the narrator changed key facts between scenes.",
							"start": 118,
							"end": 201,
							"correct": true
						},
						{
							"text": "Her group agreed that the contradictions built suspense.",
							"start": 202,
							"end": 258,
							"correct": false
						}
					],
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
