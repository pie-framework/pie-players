import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-solution-set-inequality-solid-line",
	"name": "Linear Inequality - Less Than or Equal (Solid Line)",
	"description": "Graph the solution set for y ≤ -x + 4",
	"sourcePackage": "graphing-solution-set",
	"sourceVariantId": "inequality-solid-line",
	"tags": [],
	"item": {
		"id": "graphing-solution-set-inequality-solid-line",
		"name": "Linear Inequality - Less Than or Equal (Solid Line)",
		"config": {
			"id": "",
			"markup": "<graphing-solution-set id=\"inequality-solid-line\"></graphing-solution-set>",
			"elements": {
				"graphing-solution-set": "@pie-element/graphing-solution-set@latest"
			},
			"models": [
				{
					"id": "inequality-solid-line",
					"element": "graphing-solution-set",
					"prompt": "Graph the solution set for the inequality: <math>y \\leq -x + 4</math>",
					"promptEnabled": true,
					"title": "Linear Inequality with Solid Boundary",
					"rationale": "The inequality y ≤ -x + 4 requires a solid line (since it includes ≤) at y = -x + 4, with the region below and including the line shaded as the solution set.",
					"rationaleEnabled": true,
					"teacherInstructions": "Students should draw a solid line through points like (0, 4) and (4, 0), then select the region below the line as the solution set.",
					"teacherInstructionsEnabled": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "line",
									"from": {
										"x": -10,
										"y": 14
									},
									"to": {
										"x": 10,
										"y": -6
									},
									"fill": "Solid",
									"building": false
								},
								{
									"type": "polygon",
									"points": [
										{
											"x": -10,
											"y": 14
										},
										{
											"x": 10,
											"y": -6
										},
										{
											"x": 10,
											"y": -10
										},
										{
											"x": -10,
											"y": -10
										}
									],
									"building": false,
									"closed": true,
									"isSolution": true
								}
							]
						}
					},
					"gssLineData": {
						"numberOfLines": 1,
						"selectedTool": "lineA",
						"sections": [
							[
								{
									"x": -10,
									"y": 14
								},
								{
									"x": 10,
									"y": -6
								},
								{
									"x": 10,
									"y": 10
								},
								{
									"x": -10,
									"y": 10
								}
							],
							[
								{
									"x": -10,
									"y": 14
								},
								{
									"x": 10,
									"y": -6
								},
								{
									"x": 10,
									"y": -10
								},
								{
									"x": -10,
									"y": -10
								}
							]
						],
						"lineA": {
							"lineType": "Solid"
						}
					},
					"domain": {
						"min": -10,
						"max": 10,
						"step": 1,
						"labelStep": 1,
						"axisLabel": "x"
					},
					"range": {
						"min": -10,
						"max": 10,
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
					"standardGrid": true,
					"padding": true,
					"coordinatesOnHover": true,
					"labels": {},
					"labelsEnabled": false
				}
			]
		}
	}
};

export default demo;
