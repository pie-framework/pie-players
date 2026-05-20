import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	id: "authoring-contract-fixture",
	name: "Authoring Contract Fixture",
	description:
		"Authoring-focused demo for model lifecycle, validation, configuration, and media callback coverage.",
	sourcePackage: "authoring-fixture",
	sourceVariantId: "authoring-contract",
	tags: ["authoring", "contract"],
	item: {
		id: "authoring-contract-fixture",
		name: "Authoring Contract Fixture",
		config: {
			id: "authoring-contract-fixture",
			markup:
				'<pie-authoring-fixture id="authoring-fixture-model"></pie-authoring-fixture>',
			elements: {
				"pie-authoring-fixture": "@pie-element/authoring-fixture@1.0.0",
			},
			configuration: {
				"@pie-element/authoring-fixture@1.0.0": {
					deliveryShared: "delivery-value",
				},
				authoring: {
					"pie-authoring-fixture--version-1-0-0": {
						authoringOnly: "versioned-tag-authoring-value",
						requirePrompt: true,
					},
				},
			},
			models: [
				{
					id: "authoring-fixture-model",
					element: "pie-authoring-fixture",
					prompt: "<p>Which is the largest planet in our solar system?</p>",
				},
			],
		},
	},
};

export default demo;
