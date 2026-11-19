import type { DemoInfo } from "./types";

const demo: DemoInfo = {
	id: "venn-classification-default",
	name: "Reptile & Egg-layer Venn Diagram",
	description:
		"Sort animals into a two-circle Venn diagram",
	sourcePackage: "venn-classification",
	sourceVariantId: "default",
	tags: ["venn-classification", "default", "biology"],
	item: {
		id: "venn-classification-default",
		name: "Reptile & Egg-layer Venn Diagram",
		config: {
			id: "",
			markup: '<venn-classification id="1"></venn-classification>',
			elements: {
				"venn-classification": "@pie-element/venn-classification@0.1.9",
			},
			models: [
				{
					id: "1",
					element: "venn-classification",
					prompt:
						"<p>Sort each animal into the correct region of the Venn diagram.</p>",
					promptEnabled: true,
					circles: [{ label: "Reptile" }, { label: "Egg-layer" }],
					tiles: [
						{ id: "crocodile", label: "Crocodile", correctRegion: [0, 1] },
						{ id: "turtle", label: "Turtle", correctRegion: [0, 1] },
						{ id: "frog", label: "Frog", correctRegion: [1] },
						{ id: "chicken", label: "Chicken", correctRegion: [1] },
						{ id: "snake", label: "Snake", correctRegion: [0, 1] },
						{ id: "dolphin", label: "Dolphin", correctRegion: [] },
					],
					scoringPolicy: "partialPerTile",
				},
			],
		},
	},
};

export default demo;
