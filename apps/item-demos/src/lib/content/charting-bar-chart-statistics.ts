import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "charting-bar-chart-statistics",
	"name": "Bar Chart - Test Score Distribution",
	"description": "Interactive bar chart for analyzing student test scores with editable values",
	"sourcePackage": "charting",
	"sourceVariantId": "bar-chart-statistics",
	"tags": [
		"bar",
		"statistics",
		"data-analysis",
		"interactive"
	],
	"item": {
		"id": "charting-bar-chart-statistics",
		"name": "Bar Chart - Test Score Distribution",
		"config": {
			"id": "",
			"markup": "<charting-element id=\"1\"></charting-element>",
			"elements": {
				"charting-element": "@pie-element/charting@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "charting-element",
					"chartType": "bar",
					"title": "Class Test Score Distribution",
					"prompt": "<p><strong>Data Analysis:</strong> The bar chart shows test scores for five students. Student C scored 15 points less than the class average of 85. Update the chart to show the correct score for Student C.</p><p>You can also add additional students if needed.</p>",
					"promptEnabled": true,
					"teacherInstructions": "<p><strong>Scoring:</strong> Student C should have a score of 70 (85 - 15 = 70). Award full credit if students correctly calculate and enter 70 for Student C.</p>",
					"teacherInstructionsEnabled": true,
					"addCategoryEnabled": true,
					"changeInteractiveEnabled": true,
					"changeEditableEnabled": true,
					"changeAddCategoryEnabled": true,
					"studentNewCategoryDefaultLabel": "New Student",
					"data": [
						{
							"label": "Student A",
							"value": 95,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Student B",
							"value": 88,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Student C",
							"value": 75,
							"interactive": true,
							"editable": false
						},
						{
							"label": "Student D",
							"value": 82,
							"interactive": false,
							"editable": false
						},
						{
							"label": "Student E",
							"value": 90,
							"interactive": false,
							"editable": false
						}
					],
					"correctAnswer": {
						"data": [
							{
								"label": "Student A",
								"value": 95
							},
							{
								"label": "Student B",
								"value": 88
							},
							{
								"label": "Student C",
								"value": 70
							},
							{
								"label": "Student D",
								"value": 82
							},
							{
								"label": "Student E",
								"value": 90
							}
						]
					},
					"domain": {
						"label": "Students"
					},
					"range": {
						"label": "Test Scores",
						"min": 0,
						"max": 100,
						"labelStep": 10
					},
					"graph": {
						"width": 480,
						"height": 480
					},
					"scoringType": "partial scoring",
					"rationale": "<p>Student C's score should be 70 because the class average is 85 and Student C scored 15 points less: 85 - 15 = 70.</p>",
					"rationaleEnabled": true,
					"rubricEnabled": false
				}
			]
		}
	}
};

export default demo;
