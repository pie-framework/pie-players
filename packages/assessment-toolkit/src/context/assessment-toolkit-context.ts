import { createContext } from "@pie-players/pie-context";
import type {
	IAccessibilityCatalogResolver,
	IElementToolStateStore,
	IHighlightCoordinator,
	IToolCoordinator,
	IToolkitCoordinator,
	ITTSService,
} from "../services/interfaces.js";

export interface AssessmentToolkitRuntimeContext {
	toolkitCoordinator: IToolkitCoordinator;
	toolCoordinator: IToolCoordinator;
	ttsService: ITTSService;
	highlightCoordinator: IHighlightCoordinator;
	catalogResolver: IAccessibilityCatalogResolver;
	elementToolStateStore: IElementToolStateStore;
	assessmentId: string;
	sectionId: string;
}

export const assessmentToolkitRuntimeContext =
	createContext<AssessmentToolkitRuntimeContext>(
		Symbol.for("pie.assessmentToolkit.runtimeContext"),
	);
