import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "number-line-inequality-rays",
	"name": "Represent Inequalities with Rays",
	"description": "Show inequality solutions using rays with open and closed endpoints",
	"sourcePackage": "number-line",
	"sourceVariantId": "inequality-rays",
	"tags": [
		"rays",
		"inequalities",
		"algebra"
	],
	"item": {
		"id": "number-line-inequality-rays",
		"name": "Represent Inequalities with Rays",
		"config": {
			"id": "",
			"markup": "<number-line id=\"2\"></number-line>",
			"elements": {
				"number-line": "@pie-element/number-line@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "number-line",
					"prompt": "<p>Graph the solution set for the inequality: <strong>x ≤ -2</strong></p>",
					"correctResponse": [
						{
							"type": "ray",
							"domainPosition": -2,
							"pointType": "full",
							"direction": "negative"
						}
					],
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Correct! The inequality x ≤ -2 includes -2 (closed point) and all values to the left"
						},
						"partial": {
							"type": "default",
							"default": "Nearly correct - check if the endpoint should be open or closed"
						},
						"incorrect": {
							"type": "default",
							"default": "Incorrect. Remember: ≤ means 'less than or equal to', so use a closed point"
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
							"min": -6,
							"max": 2
						},
						"ticks": {
							"minor": 1,
							"major": 2,
							"tickIntervalType": "Integer"
						},
						"initialElements": [],
						"maxNumberOfPoints": 1,
						"showMinorTicks": true,
						"snapPerTick": 1,
						"tickLabelOverrides": [],
						"initialType": "RFN",
						"exhibitOnly": false,
						"availableTypes": {
							"RFN": true,
							"RFP": true,
							"REN": true,
							"REP": true
						}
					}
				}
			]
		}
	}
};

export default demo;
