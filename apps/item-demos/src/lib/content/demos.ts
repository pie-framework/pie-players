import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import reactDemos from "./react-demos.generated.json";

export interface DemoInfo {
	id: string;
	name: string;
	description: string;
	sourcePackage: string;
	sourceVariantId: string;
	tags: string[];
	initialSession?: unknown;
	item: Partial<ItemEntity>;
}

const importedDemos = reactDemos as unknown as DemoInfo[];

export const demos: Record<string, DemoInfo> = Object.fromEntries(
	importedDemos.map((demo) => [demo.id, demo]),
);

export function getDemoById(id: string | undefined): DemoInfo | null {
	if (!id) return null;
	return demos[id] || null;
}

export function getAllDemos(): DemoInfo[] {
	return importedDemos;
}
