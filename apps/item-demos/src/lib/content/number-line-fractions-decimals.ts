import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "number-line-fractions-decimals",
	"name": "Fractions and Mixed Numbers",
	"description": "Plot fractions and mixed numbers on a number line with fractional tick marks",
	"sourcePackage": "number-line",
	"sourceVariantId": "fractions-decimals",
	"tags": [
		"fractions",
		"decimals",
		"mixed-numbers"
	],
	"item": {
		"id": "number-line-fractions-decimals",
		"name": "Fractions and Mixed Numbers",
		"config": {
			"id": "",
			"markup": "<number-line id=\"3\"></number-line>",
			"elements": {
				"number-line": "@pie-element/number-line@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "number-line",
					"prompt": "<p>Plot the following values on the number line:</p><ul><li><strong>1/2</strong></li><li><strong>1 3/4</strong></li><li><strong>-1/4</strong></li></ul>",
					"correctResponse": [
						{
							"type": "point",
							"pointType": "full",
							"domainPosition": 0.5
						},
						{
							"type": "point",
							"pointType": "full",
							"domainPosition": 1.75
						},
						{
							"type": "point",
							"pointType": "full",
							"domainPosition": -0.25
						}
					],
					"feedback": {
						"correct": {
							"type": "default",
							"default": "Excellent! You correctly plotted all three fractional values"
						},
						"partial": {
							"type": "default",
							"default": "You have some correct points. Check your fraction calculations"
						},
						"incorrect": {
							"type": "default",
							"default": "Review: 1/2 = 0.5, 1 3/4 = 1.75, -1/4 = -0.25"
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
							"min": -1,
							"max": 3
						},
						"ticks": {
							"minor": 0.25,
							"major": 1,
							"tickIntervalType": "Fraction"
						},
						"labelStep": "1/4",
						"fraction": true,
						"initialElements": [],
						"maxNumberOfPoints": 3,
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
