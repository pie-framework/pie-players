import type { I18nProvider } from "@pie-players/pie-players-shared/i18n";
import type {
	AssessmentEntity,
	AssessmentSection,
	ItemEntity,
	ItemSettings,
	SectionControllerSessionState,
} from "@pie-players/pie-players-shared/types";
import type { ItemPlayerConfig, ItemPlayerType } from "../context/assessment-toolkit-context.js";
import type { FrameworkErrorModel } from "../services/framework-error.js";
import type { ToolRegistry } from "../services/ToolRegistry.js";
import type { ToolkitCoordinator, ToolkitCoordinatorConfig } from "../services/ToolkitCoordinator.js";
import type { ToolbarItem } from "../services/toolbar-items.js";
import type { ToolScopeLevel } from "../services/tool-instance-id.js";
import type { ToolConfigStrictness } from "../services/tool-config-validation.js";
import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";

/** The item-player fields a host may set on `<pie-assessment-toolkit>`'s `player`. */
export type HostItemPlayerInput = Partial<
	Pick<ItemPlayerConfig, "type" | "tagName" | "version" | "source" | "loaderConfig" | "loaderOptions">
> | null;

/** Property inputs of `<pie-item-scope>`. */
export interface ItemScopeElementProps {
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: string;
	regionPolicy?: string;
	scopeElement?: HTMLElement | null;
	ttsHighlightTargetResolver?: TTSHighlightTargetResolver | null;
	item?: unknown;
	settings?: ItemSettings | null;
}

/** Property inputs of `<pie-item-toolbar>`. */
export interface ItemToolbarElementProps {
	level?: ToolScopeLevel;
	scopeId?: string;
	itemId?: string;
	sectionId?: string;
	catalogId?: string;
	tools?: string;
	contentKind?: string;
	position?: "top" | "right" | "bottom" | "left" | "none";
	scopeElement?: HTMLElement | null;
	toolRegistry?: ToolRegistry | null;
	item?: ItemEntity | null;
	hostButtons?: ToolbarItem[];
	size?: "sm" | "md" | "lg";
	language?: string;
}

/** Property inputs of `<pie-section-toolbar>`. */
export interface SectionToolbarElementProps {
	enabledTools?: string;
	position?: string;
	sectionId?: string;
	size?: "sm" | "md" | "lg";
	language?: string;
	toolRegistry?: ToolRegistry | null;
	item?: ItemEntity | null;
	hostButtons?: ToolbarItem[];
}

/** Property inputs of `<pie-assessment-toolkit>`. */
export interface AssessmentToolkitElementProps {
	assessmentId?: string;
	section?: AssessmentSection | null;
	sectionId?: string;
	attemptId?: string;
	env?: { mode?: string; role?: string } & Record<string, unknown>;
	ndsIcons?: boolean;
	locale?: string;
	i18n?: I18nProvider | null;
	contentLanguage?: string;
	lazyInit?: boolean;
	toolConfigStrictness?: ToolConfigStrictness;
	tools?: ToolkitCoordinatorConfig["tools"];
	toolContextResolvers?: ToolkitCoordinatorConfig["toolContextResolvers"] | null;
	enabledTools?: string;
	toolRegistry?: ToolRegistry | null;
	accessibility?: ToolkitCoordinatorConfig["accessibility"];
	player?: HostItemPlayerInput;
	playerType?: ItemPlayerType | "";
	coordinator?: ToolkitCoordinator | null;
	createSectionController?: (() => unknown) | null;
	onFrameworkError?: ((errorModel: FrameworkErrorModel) => void) | null;
	errorRenderer?:
		| ((errorModel: FrameworkErrorModel) => { title?: string; details?: string[] })
		| null;
	assessment?: AssessmentEntity | null;
	isolation?: "inherit" | "force";
	session?: SectionControllerSessionState | null;
}

/** Methods the toolkit element exposes once it has mounted. */
export interface AssessmentToolkitElementMethods {
	waitUntilReady(): Promise<void>;
	setHooks(hooks: Record<string, unknown>): void;
	navigateToItem(index: number): unknown;
	getCompositionModel(): unknown;
	getItemPlayerConfig(): ItemPlayerConfig;
	persist(): Promise<void>;
	hydrate(): Promise<void>;
}

/** Native host interface for `<pie-item-scope>`. */
export interface PieItemScopeElement extends HTMLElement, ItemScopeElementProps {}

/** Native host interface for `<pie-item-toolbar>`. */
export interface PieItemToolbarElement extends HTMLElement, ItemToolbarElementProps {}

/** Native host interface for `<pie-section-toolbar>`. */
export interface PieSectionToolbarElement extends HTMLElement, SectionToolbarElementProps {}

/** Native host interface for `<pie-assessment-toolkit>`. */
export interface PieAssessmentToolkitElement
	extends HTMLElement,
		AssessmentToolkitElementProps,
		AssessmentToolkitElementMethods {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-item-scope": PieItemScopeElement;
		"pie-item-toolbar": PieItemToolbarElement;
		"pie-section-toolbar": PieSectionToolbarElement;
		"pie-assessment-toolkit": PieAssessmentToolkitElement;
	}
}
