import type { ItemEntity } from "@pie-players/pie-players-shared/types";

export const demo2Item: Partial<ItemEntity> = {
	id: "water-cycle-passage",
	name: "Water Cycle Passage",
	config: {
		elements: {
			"passage-element": "@pie-element/passage@latest",
		},
		models: [
			{
				id: "passage1",
				element: "passage-element",
				passages: [
					{
						title: "The Water Cycle: Earth's Renewable Resource",
						text: `<p>Water is constantly moving through our planet in a process called the water cycle. This continuous movement helps regulate Earth's temperature, distributes essential nutrients, and provides fresh water for all living things.</p>

<p>The water cycle begins with <strong>evaporation</strong>, when the sun heats water in oceans, lakes, and rivers. This heat causes water molecules to transform from liquid into invisible water vapor, which rises into the atmosphere. Plants also contribute to this process through <em>transpiration</em>, releasing water vapor through tiny pores in their leaves.</p>

<p>As water vapor rises higher in the atmosphere, it cools and undergoes <strong>condensation</strong>. During condensation, water vapor transforms back into tiny liquid droplets, forming clouds and fog. When these droplets combine and become heavy enough, they fall back to Earth as <strong>precipitation</strong> - rain, snow, sleet, or hail.</p>

<p>Once precipitation reaches the ground, it follows several paths. Some water flows across the surface as runoff, eventually reaching streams, rivers, and oceans. Other water seeps into the ground, becoming groundwater that plants can access through their roots or that humans can tap through wells. This groundwater slowly makes its way back to surface water bodies, where the cycle begins again.</p>

<p>The water cycle plays a crucial role in our modern world. It distributes fresh water to different regions, shapes weather patterns, and helps regulate global temperatures. Understanding this process is essential for managing water resources and addressing environmental challenges like droughts and floods.</p>`,
					},
				],
			},
		],
		markup: '<passage-element id="passage1"></passage-element>',
		id: "",
	},
};
