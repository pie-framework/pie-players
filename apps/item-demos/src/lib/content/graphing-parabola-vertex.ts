import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "graphing-parabola-vertex",
	"name": "Quadratic Function - Parabola",
	"description": "Graph a parabola by defining its vertex and a point on the curve",
	"sourcePackage": "graphing",
	"sourceVariantId": "parabola-vertex",
	"tags": [
		"algebra",
		"quadratic",
		"parabola",
		"vertex"
	],
	"item": {
		"id": "graphing-parabola-vertex",
		"name": "Quadratic Function - Parabola",
		"config": {
			"id": "",
			"markup": "<graphing-element id=\"2\"></graphing-element>",
			"elements": {
				"graphing-element": "@pie-element/graphing@latest"
			},
			"models": [
				{
					"id": "2",
					"element": "graphing-element",
					"prompt": "<p>Graph the parabola with vertex at (1, -4) that passes through the point (3, 0).</p><p><strong>Hint:</strong> Click the vertex first (root), then click a point on the parabola (edge).</p>",
					"promptEnabled": true,
					"title": "Parabola Graphing",
					"titleEnabled": true,
					"toolbarTools": [
						"parabola",
						"point",
						"label"
					],
					"defaultTool": "parabola",
					"domain": {
						"min": -5,
						"max": 7,
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
						"width": 500,
						"height": 500
					},
					"arrows": {
						"left": true,
						"right": true,
						"up": true,
						"down": false
					},
					"coordinatesOnHover": true,
					"answers": {
						"correctAnswer": {
							"name": "Correct Answer",
							"marks": [
								{
									"type": "parabola",
									"root": {
										"x": 1,
										"y": -4
									},
									"edge": {
										"x": 3,
										"y": 0
									}
								},
								{
									"type": "point",
									"x": 1,
									"y": -4,
									"label": "Vertex",
									"showLabel": true
								}
							]
						}
					},
					"backgroundMarks": [
						{
							"type": "point",
							"x": 3,
							"y": 0,
							"label": "Point on curve",
							"showLabel": false
						}
					],
					"rationale": "<p>The parabola has its vertex (minimum point) at (1, -4) and opens upward. Using the given point (3, 0), we can determine the exact shape of the parabola.</p>",
					"rationaleEnabled": true,
					"scoringType": "partial scoring"
				}
			]
		}
	}
};

export default demo;
