import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "number-line-intervals-ranges",
	"name": "Graph Intervals and Ranges",
	"description": "Represent mathematical intervals using line segments with various endpoint types",
	"sourcePackage": "number-line",
	"sourceVariantId": "intervals-ranges",
	"tags": [
		"intervals",
		"lines",
		"ranges",
		"notation"
	],
	"item": {
		"id": "number-line-intervals-ranges",
		"name": "Graph Intervals and Ranges",
		"config": {
			"id": "",
			"markup": "<number-line id=\"4\"></number-line>",
			"elements": {
				"number-line": "@pie-element/number-line@latest"
			},
			"models": [
				{
					"id": "4",
					"element": "number-line",
					"prompt": "<p>Graph the interval: <strong>[-3, 4)</strong></p><p><em>Note: Square bracket [ means closed endpoint, parenthesis ) means open endpoint</em></p>",
					"correctResponse": [
						{
							"type": "line",
							"domainPosition": -3,
							"size": 7,
							"leftPoint": "full",
							"rightPoint": "empty"
						}
					],
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Perfect! You correctly represented the interval [-3, 4) with a closed point at -3 and an open point at 4"
						},
						"partial": {
							"type": "default",
							"default": "Close! Check whether the endpoints should be open or closed"
						},
						"incorrect": {
							"type": "default",
							"default": "Incorrect. Remember: [a means closed at a, b) means open at b"
						}
					},
					"graph": {
						"title": "",
						"arrows": {
							"left": true,
							"right": true
						},
						"width": 650,
						"domain": {
							"min": -5,
							"max": 6
						},
						"ticks": {
							"minor": 1,
							"major": 1,
							"tickIntervalType": "Integer"
						},
						"initialElements": [],
						"maxNumberOfPoints": 1,
						"showMinorTicks": true,
						"snapPerTick": 1,
						"tickLabelOverrides": [],
						"initialType": "LFE",
						"exhibitOnly": false,
						"availableTypes": {
							"LFF": true,
							"LEF": true,
							"LFE": true,
							"LEE": true
						}
					}
				}
			]
		}
	}
};

export default demo;
