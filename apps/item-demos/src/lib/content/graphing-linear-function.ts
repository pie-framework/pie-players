import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-linear-function",
	"name": "Linear Function - Slope Intercept",
	"description": "Plot points and draw a line through them to represent y = 2x + 1",
	"sourcePackage": "graphing",
	"sourceVariantId": "linear-function",
	"tags": [
		"algebra",
		"linear",
		"line",
		"point",
		"slope"
	],
	"item": {
		"id": "graphing-linear-function",
		"name": "Linear Function - Slope Intercept",
		"config": {
			"id": "",
			"markup": "<graphing-element id=\"1\"></graphing-element>",
			"elements": {
				"graphing-element": "@pie-element/graphing@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "graphing-element",
					"prompt": "<p>Plot the line for the equation <math><mi>y</mi><mo>=</mo><mn>2</mn><mi>x</mi><mo>+</mo><mn>1</mn></math></p><p>Use points to mark where the line crosses each axis.</p>",
					"promptEnabled": true,
					"title": "Graphing Linear Functions",
					"titleEnabled": true,
					"toolbarTools": [
						"point",
						"line",
						"segment"
					],
					"defaultTool": "point",
					"domain": {
						"min": -5,
						"max": 5,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "x"
					},
					"range": {
						"min": -5,
						"max": 5,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "y"
					},
					"graph": {
						"width": 480,
						"height": 480
					},
					"arrows": {
						"left": true,
						"right": true,
						"up": true,
						"down": true
					},
					"coordinatesOnHover": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "point",
									"x": 0,
									"y": 1,
									"label": "y-intercept",
									"showLabel": true
								},
								{
									"type": "point",
									"x": 2,
									"y": 5
								},
								{
									"type": "line",
									"from": {
										"x": -2,
										"y": -3
									},
									"to": {
										"x": 2,
										"y": 5
									}
								}
							]
						}
					},
					"backgroundMarks": [],
					"rationale": "<p>The line y = 2x + 1 has a slope of 2 and y-intercept of 1. It crosses the y-axis at (0, 1) and passes through points like (2, 5).</p>",
					"rationaleEnabled": true,
					"scoringType": "partial scoring"
				}
			]
		}
	}
};

export default demo;
