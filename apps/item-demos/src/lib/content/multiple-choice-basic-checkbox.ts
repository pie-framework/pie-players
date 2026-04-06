import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "multiple-choice-basic-checkbox",
	"name": "Basic Multi-Select",
	"description": "Standard checkbox mode with multiple correct answers",
	"sourcePackage": "multiple-choice",
	"sourceVariantId": "basic-checkbox",
	"tags": [
		"checkbox",
		"multi-select",
		"basic",
		"feedback"
	],
	"item": {
		"id": "multiple-choice-basic-checkbox",
		"name": "Basic Multi-Select",
		"config": {
			"id": "",
			"markup": "<multiple-choice id=\"1\"></multiple-choice>",
			"elements": {
				"multiple-choice": "@pie-element/multiple-choice@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "multiple-choice",
					"choiceMode": "checkbox",
					"choicePrefix": "letters",
					"choices": [
						{
							"correct": true,
							"value": "photosynthesis",
							"label": "Photosynthesis converts light energy into chemical energy",
							"feedback": {
								"type": "default",
								"value": "Correct! Photosynthesis is the process by which plants convert sunlight into glucose."
							},
							"rationale": "Photosynthesis is performed by plants, algae, and some bacteria. It uses light energy to convert carbon dioxide and water into glucose and oxygen."
						},
						{
							"correct": false,
							"value": "mitochondria",
							"label": "Mitochondria are found only in plant cells",
							"feedback": {
								"type": "default",
								"value": "Incorrect. Mitochondria are found in both plant and animal cells."
							},
							"rationale": "Mitochondria are the \"powerhouses\" of the cell and are present in nearly all eukaryotic cells, including both plants and animals."
						},
						{
							"correct": true,
							"value": "cellular-respiration",
							"label": "Cellular respiration breaks down glucose to produce ATP",
							"feedback": {
								"type": "default",
								"value": "Correct! Cellular respiration is how cells extract energy from glucose."
							},
							"rationale": "Cellular respiration occurs in the mitochondria and converts glucose and oxygen into ATP (energy), carbon dioxide, and water. This is essentially the reverse of photosynthesis."
						},
						{
							"correct": false,
							"value": "chloroplasts",
							"label": "Chloroplasts are the site of cellular respiration",
							"feedback": {
								"type": "default",
								"value": "Incorrect. Chloroplasts are where photosynthesis occurs, not cellular respiration."
							},
							"rationale": "Chloroplasts contain chlorophyll and are responsible for photosynthesis in plant cells. Cellular respiration takes place in the mitochondria."
						}
					],
					"extraCSSRules": {
						"names": [
							"red",
							"blue"
						],
						"rules": "\n      .red {\n        color: red !important;\n      }\n\n      .blue {\n        color: blue !important;\n      }\n    "
					},
					"prompt": "<p><strong>Biology Question:</strong> Select all true statements about cellular processes.</p>",
					"promptEnabled": true,
					"toolbarEditorPosition": "bottom",
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
