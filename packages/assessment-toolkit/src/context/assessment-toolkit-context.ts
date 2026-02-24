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
	toolkitCoordinator?: IToolkitCoordinator | null;
	toolCoordinator?: IToolCoordinator | null;
	ttsService?: ITTSService | null;
	highlightCoordinator?: IHighlightCoordinator | null;
	catalogResolver?: IAccessibilityCatalogResolver | null;
	elementToolStateStore?: IElementToolStateStore | null;
	assessmentId?: string;
	sectionId?: string;
}

export const assessmentToolkitRuntimeContext =
	createContext<AssessmentToolkitRuntimeContext>(
		Symbol.for("pie.assessmentToolkit.runtimeContext"),
	);
