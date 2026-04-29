import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-sine-wave-trigonometry",
	"name": "Sine Wave - Trigonometric Function",
	"description": "Create a sine wave with specific amplitude and frequency",
	"sourcePackage": "graphing",
	"sourceVariantId": "sine-wave-trigonometry",
	"tags": [
		"trigonometry",
		"sine",
		"wave",
		"periodic"
	],
	"item": {
		"id": "graphing-sine-wave-trigonometry",
		"name": "Sine Wave - Trigonometric Function",
		"config": {
			"id": "",
			"markup": "<graphing-element id=\"3\"></graphing-element>",
			"elements": {
				"graphing-element": "@pie-element/graphing@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "graphing-element",
					"prompt": "<p>Graph a sine wave with amplitude 2 and period <math><mn>2</mn><mi>π</mi></math>.</p><p>The function is <math><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><mn>2</mn><mo>sin</mo><mo>(</mo><mi>x</mi><mo>)</mo></math></p>",
					"promptEnabled": true,
					"title": "Sine Wave Graphing",
					"titleEnabled": true,
					"toolbarTools": [
						"sine",
						"point",
						"label"
					],
					"defaultTool": "sine",
					"domain": {
						"min": -8,
						"max": 8,
						"step": 1,
						"labelStep": 2,
						"axisLabel": "x"
					},
					"range": {
						"min": -3,
						"max": 3,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "y"
					},
					"graph": {
						"width": 600,
						"height": 400
					},
					"arrows": {
						"left": true,
						"right": true,
						"up": true,
						"down": true
					},
					"coordinatesOnHover": true,
					"labels": {
						"bottom": "Angle (radians)",
						"left": "Amplitude",
						"top": "",
						"right": ""
					},
					"labelsEnabled": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "sine",
									"root": {
										"x": 0,
										"y": 0
									},
									"edge": {
										"x": 1.57,
										"y": 2
									}
								}
							]
						},
						"alternate1": {
							"name": "Alternate (phase shifted)",
							"marks": [
								{
									"type": "sine",
									"root": {
										"x": 3.14,
										"y": 0
									},
									"edge": {
										"x": 4.71,
										"y": 2
									}
								}
							]
						}
					},
					"backgroundMarks": [],
					"rationale": "<p>A sine wave with amplitude 2 oscillates between -2 and 2. The period of 2π means one complete cycle occurs every 2π units along the x-axis. The root is at the origin (0,0) and the edge defines the amplitude at π/2 (approximately 1.57).</p>",
					"rationaleEnabled": true,
					"teacherInstructions": "<p>Students should understand that the root point marks where the sine wave crosses the x-axis, and the edge point defines both the amplitude and frequency of the wave.</p>",
					"teacherInstructionsEnabled": true,
					"scoringType": "partial scoring"
				}
			]
		}
	}
};

export default demo;
