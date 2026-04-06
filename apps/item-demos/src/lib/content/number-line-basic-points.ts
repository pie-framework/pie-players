import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "number-line-basic-points",
	"name": "Plot Points on Integer Number Line",
	"description": "Basic point plotting with closed points on an integer number line",
	"sourcePackage": "number-line",
	"sourceVariantId": "basic-points",
	"tags": [
		"points",
		"integers",
		"basic"
	],
	"item": {
		"id": "number-line-basic-points",
		"name": "Plot Points on Integer Number Line",
		"config": {
			"id": "",
			"markup": "<number-line id=\"1\"></number-line>",
			"elements": {
				"number-line": "@pie-element/number-line@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "number-line",
					"prompt": "<p>Plot the solutions to the equation: <strong>x<sup>2</sup> - 9 = 0</strong></p>",
					"correctResponse": [
						{
							"type": "point",
							"pointType": "full",
							"domainPosition": -3
						},
						{
							"type": "point",
							"pointType": "full",
							"domainPosition": 3
						}
					],
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Correct! The equation x² - 9 = 0 has solutions at x = -3 and x = 3"
						},
						"partial": {
							"type": "default",
							"default": "You have some correct points, but not all"
						},
						"incorrect": {
							"type": "default",
							"default": "Incorrect. Solve for x by factoring: (x-3)(x+3) = 0"
						}
					},
					"graph": {
						"title": "",
						"arrows": {
							"left": true,
							"right": true
						},
						"width": 600,
						"domain": {
							"min": -5,
							"max": 5
						},
						"ticks": {
							"minor": 1,
							"major": 1,
							"tickIntervalType": "Integer"
						},
						"initialElements": [],
						"maxNumberOfPoints": 2,
						"showMinorTicks": true,
						"snapPerTick": 1,
						"tickLabelOverrides": [],
						"initialType": "PF",
						"exhibitOnly": false,
						"availableTypes": {
							"PF": true
						}
					}
				}
			]
		}
	}
};

export default demo;
