import { createContext } from "@pie-players/pie-context";
import type {
	IAccessibilityCatalogResolver,
	IElementToolStateStore,
	IHighlightCoordinator,
	IToolCoordinator,
	IToolkitCoordinator,
	ITTSService,
} from "../services/interfaces.js";

export type ItemPlayerType = "iife" | "esm" | "fixed" | "custom";

export interface ItemPlayerConfig {
	type: ItemPlayerType;
	tagName: string;
	version?: string;
	source?: string;
	isDefault: boolean;
}

export interface AssessmentToolkitRuntimeContext {
	toolkitCoordinator: IToolkitCoordinator;
	toolCoordinator: IToolCoordinator;
	ttsService: ITTSService;
	highlightCoordinator: IHighlightCoordinator;
	catalogResolver: IAccessibilityCatalogResolver;
	elementToolStateStore: IElementToolStateStore;
	assessmentId: string;
	sectionId: string;
	itemPlayer: ItemPlayerConfig;
	reportSessionChanged?: (itemId: string, detail: unknown) => void;
}

export const assessmentToolkitRuntimeContext =
	createContext<AssessmentToolkitRuntimeContext>(
		Symbol.for("pie.assessmentToolkit.runtimeContext"),
	);
