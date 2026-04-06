import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "charting-line-chart-growth",
	"name": "Line Chart - Plant Growth with Math",
	"description": "Line chart with cross markers showing exponential plant growth over time",
	"sourcePackage": "charting",
	"sourceVariantId": "line-chart-growth",
	"tags": [
		"line",
		"lineCross",
		"growth",
		"math",
		"science"
	],
	"item": {
		"id": "charting-line-chart-growth",
		"name": "Line Chart - Plant Growth with Math",
		"config": {
			"id": "",
			"markup": "<charting-element id=\"2\"></charting-element>",
			"elements": {
				"charting-element": "@pie-element/charting@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "charting-element",
					"chartType": "lineCross",
					"title": "Plant Height Growth Over Time",
					"prompt": "<p><strong>Biology Experiment:</strong> A plant grows according to the formula <em>h(t) = 2t + 3</em>, where <em>h</em> is height in centimeters and <em>t</em> is time in weeks.</p><p>The chart shows measurements for weeks 0-3. Calculate and plot the height for <strong>Week 4</strong> and <strong>Week 5</strong> using the growth formula.</p>",
					"promptEnabled": true,
					"teacherInstructions": "<p><strong>Answer Key:</strong> Week 4: h(4) = 2(4) + 3 = 11 cm. Week 5: h(5) = 2(5) + 3 = 13 cm. Students should add these two data points to complete the growth pattern.</p>",
					"teacherInstructionsEnabled": true,
					"addCategoryEnabled": true,
					"changeInteractiveEnabled": false,
					"changeEditableEnabled": true,
					"changeAddCategoryEnabled": true,
					"studentNewCategoryDefaultLabel": "New Week",
					"data": [
						{
							"label": "Week 0",
							"value": 3,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Week 1",
							"value": 5,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Week 2",
							"value": 7,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Week 3",
							"value": 9,
							"interactive": false,
							"editable": false
						}
					],
					"correctAnswer": {
						"data": [
							{
								"label": "Week 0",
								"value": 3
							},
							{
								"label": "Week 1",
								"value": 5
							},
							{
								"label": "Week 2",
								"value": 7
							},
							{
								"label": "Week 3",
								"value": 9
							},
							{
								"label": "Week 4",
								"value": 11
							},
							{
								"label": "Week 5",
								"value": 13
							}
						]
					},
					"domain": {
						"label": "Time (weeks)"
					},
					"range": {
						"label": "Height (cm)",
						"min": 0,
						"max": 15,
						"labelStep": 1
					},
					"graph": {
						"width": 480,
						"height": 480
					},
					"scoringType": "partial scoring",
					"rationale": "<p>Using the formula h(t) = 2t + 3:<br/>Week 4: h(4) = 2(4) + 3 = 8 + 3 = 11 cm<br/>Week 5: h(5) = 2(5) + 3 = 10 + 3 = 13 cm<br/>The plant grows 2 cm each week with a starting height of 3 cm.</p>",
					"rationaleEnabled": true,
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
