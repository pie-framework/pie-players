import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	"id": "image-cloze-association-default",
	"name": "Drag and drop the data labels into the",
	"description": "Basic image cloze association configuration",
	"sourcePackage": "image-cloze-association",
	"sourceVariantId": "default",
	"tags": [
		"image-cloze-association",
		"default"
	],
	"item": {
		"id": "image-cloze-association-default",
		"name": "Drag and drop the data labels into the",
		"config": {
			"id": "",
			"markup": "<image-cloze-association id=\"1\"></image-cloze-association>",
			"elements": {
				"image-cloze-association": "@pie-element/image-cloze-association@latest"
			},
			"models": [
				{
					"id": "1",
					"element": "image-cloze-association",
					"prompt": "This is the question prompt",
					"image": {
						"src": "https://app.fluence.net/ia/image/6412223997a34018b15f8512bee6c04c",
						"width": 465,
						"scale": false,
						"height": 313
					},
					"responseAreaFill": "rgba(240,255,224,0.9)",
					"response_container": {
						"wordwrap": true,
						"width": "130px",
						"height": "55px"
					},
					"metadata": {},
					"is_math": true,
					"response_id": "8a808081592940240159464a277609e7",
					"response_containers": [
						{
							"wordwrap": true,
							"x": 64.3,
							"width": "35.70%",
							"y": 1.6,
							"height": "23.64%",
							"aria_label": ""
						},
						{
							"pointer": "undefined",
							"wordwrap": true,
							"x": 64.09,
							"width": "35.92%",
							"y": 39.62,
							"height": "23.32%",
							"aria_label": ""
						}
					],
					"stimulus": "<p>A car manufacturer proposes the development of a car tire disposal area near an important wetland habitat. In this area, tires will be broken into pieces and buried. The manufacturer needs to design this area to address the environmental concerns from the list in the passage. After breaking the tires into pieces, the manufacturer decides to recycle some of the pieces and dispose of the rest in this newly developed area. Drag and drop the data labels into the graph to show how this decision will likely affect the number of tire pieces collected from a sample area of the wetland after many years.</p>",
					"metadatadistractor_rationale": "<p>A correct response is shown below.&#160;This response best shows how this decision will likely affect the number tire pieces collected.<img alt=\"image 03de38019abe41b1bc95d1199658327f\" id=\"03de38019abe41b1bc95d1199658327f\" src=\"https://localhost:8443/ia/image/03de38019abe41b1bc95d1199658327f\" /></p>",
					"ui_style": {
						"possibility_list_position": "bottom",
						"fontsize": "small"
					},
					"possible_responses": [
						"<img alt=\"\" src=\"https://app.fluence.net/ia/image/9e5ed1d6762c4dac87b080e190af113d\"/>",
						"<img alt=\"\" src=\"https://app.fluence.net/ia/image/729ca157d04c440ab7ae1c2abfb9c057\"/>"
					],
					"validation": {
						"scoring_type": "exactMatch",
						"valid_response": {
							"score": 1,
							"value": [
								{
									"images": [
										"<img alt=\"\" src=\"https://app.fluence.net/ia/image/729ca157d04c440ab7ae1c2abfb9c057\"/>"
									]
								},
								{
									"images": [
										"<img alt=\"\" src=\"https://app.fluence.net/ia/image/9e5ed1d6762c4dac87b080e190af113d\"/>"
									]
								}
							]
						}
					},
					"partialScoring": false,
					"shuffle": true,
					"rubricEnabled": false,
					"imageDropTargetPadding": "2px",
					"responseContainerPadding": "8px"
				}
			]
		}
	}
};

export default demo;
