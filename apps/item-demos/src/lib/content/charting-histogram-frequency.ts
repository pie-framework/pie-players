import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "charting-histogram-frequency",
	"name": "Histogram - Survey Response Frequencies",
	"description": "Histogram showing frequency distribution with all editable categories",
	"sourcePackage": "charting",
	"sourceVariantId": "histogram-frequency",
	"tags": [
		"histogram",
		"frequency",
		"survey",
		"statistics",
		"editable"
	],
	"item": {
		"id": "charting-histogram-frequency",
		"name": "Histogram - Survey Response Frequencies",
		"config": {
			"id": "",
			"markup": "<charting-element id=\"3\"></charting-element>",
			"elements": {
				"charting-element": "@pie-element/charting@latest"
			},
			"models": [
				{
					"id": "3",
					"element": "charting-element",
					"chartType": "histogram",
					"title": "Hours of Weekly Exercise Survey",
					"prompt": "<p><strong>Statistics Problem:</strong> A survey asked 50 students how many hours they exercise per week. The results are shown in the histogram below.</p><p>However, some data was recorded incorrectly. Update the chart so that:</p><ul><li>The \"3-4 hours\" category has 8 responses</li><li>The \"5-6 hours\" category has 12 responses</li><li>All frequencies sum to exactly 50 students</li></ul>",
					"promptEnabled": true,
					"addCategoryEnabled": false,
					"changeInteractiveEnabled": true,
					"changeEditableEnabled": false,
					"changeAddCategoryEnabled": false,
					"studentNewCategoryDefaultLabel": "New Range",
					"data": [
						{
							"label": "0-1 hours",
							"value": 6,
							"interactive": true,
							"editable": false
						},
						{
							"label": "1-2 hours",
							"value": 10,
							"interactive": true,
							"editable": false
						},
						{
							"label": "2-3 hours",
							"value": 9,
							"interactive": true,
							"editable": false
						},
						{
							"label": "3-4 hours",
							"value": 5,
							"interactive": true,
							"editable": false
						},
						{
							"label": "5-6 hours",
							"value": 10,
							"interactive": true,
							"editable": false
						},
						{
							"label": "7+ hours",
							"value": 8,
							"interactive": true,
							"editable": false
						}
					],
					"correctAnswer": {
						"data": [
							{
								"label": "0-1 hours",
								"value": 6
							},
							{
								"label": "1-2 hours",
								"value": 10
							},
							{
								"label": "2-3 hours",
								"value": 9
							},
							{
								"label": "3-4 hours",
								"value": 8
							},
							{
								"label": "5-6 hours",
								"value": 12
							},
							{
								"label": "7+ hours",
								"value": 5
							}
						]
					},
					"domain": {
						"label": "Exercise Duration (hours per week)"
					},
					"range": {
						"label": "Number of Students",
						"min": 0,
						"max": 15,
						"labelStep": 1
					},
					"graph": {
						"width": 480,
						"height": 480
					},
					"scoringType": "all or nothing",
					"rationale": "<p>To make the frequencies sum to 50:<br/>Original sum: 6 + 10 + 9 + 5 + 10 + 8 = 48<br/>We need: 6 + 10 + 9 + 8 + 12 + 5 = 50<br/>Changed \"3-4 hours\" from 5 to 8 (+3), \"5-6 hours\" from 10 to 12 (+2), and \"7+ hours\" from 8 to 5 (-3) to balance the total.</p>",
					"rationaleEnabled": true,
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
