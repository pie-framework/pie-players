import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import { demo1Item } from "./demo1-multiple-choice";
import { demo2Item } from "./demo2-passage";
import { demo3Item } from "./demo3-math";

export interface DemoInfo {
	id: string;
	name: string;
	description: string;
	item: Partial<ItemEntity>;
}

export const demos: Record<string, DemoInfo> = {
	"multiple-choice": {
		id: "multiple-choice",
		name: "Multiple Choice",
		description: "Basic multiple choice question with radio buttons",
		item: demo1Item,
	},
	passage: {
		id: "passage",
		name: "Passage Item",
		description: "Item with associated reading passage",
		item: demo2Item,
	},
	"math-expression": {
		id: "math-expression",
		name: "Math Expression",
		description: "Math input with expression validation",
		item: demo3Item,
	},
};

export function getDemoById(id: string | undefined): DemoInfo | null {
	if (!id) return null;
	return demos[id] || null;
}

export function getAllDemos(): DemoInfo[] {
	return Object.values(demos);
}
