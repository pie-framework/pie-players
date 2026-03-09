import type { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
import type {
	SectionControllerEvent,
	SectionControllerHandle,
} from "../services/section-controller-types.js";
import type { RuntimeRegistrationDetail } from "./registration-events.js";
import { RuntimeRegistry } from "./RuntimeRegistry.js";

interface RuntimeController extends SectionControllerHandle {
	getCompositionModel?: () => unknown;
	getCanonicalItemId?: (itemId: string) => string;
	handleContentLoaded?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}) => void;
	handleContentRegistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleContentUnregistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleItemPlayerError?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}) => void;
	reportSectionError?: (args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}) => void;
	handleItemSessionChanged?: (
		itemId: string,
		session: unknown,
	) => { eventDetail?: unknown } | null;
	subscribe?: (listener: (event: SectionControllerEvent) => void) => () => void;
	navigateToItem?: (index: number) => unknown;
}

interface EngineInitArgs {
	coordinator: ToolkitCoordinator;
	section: unknown;
	sectionId: string;
	assessmentId: string;
	view: string;
	attemptId?: string;
	createDefaultController: () => Promise<RuntimeController> | RuntimeController;
	onCompositionChanged?: (composition: unknown) => void;
}

export class SectionRuntimeEngine {
	private readonly registry = new RuntimeRegistry();
	private controller: RuntimeController | null = null;
	private coordinator: ToolkitCoordinator | null = null;
	private sectionId = "";
	private attemptId: string | undefined;
	private unsubscribeController: (() => void) | null = null;
	private activeInitToken = 0;

	async initialize(args: EngineInitArgs): Promise<void> {
		this.activeInitToken += 1;
		const token = this.activeInitToken;
		this.coordinator = args.coordinator;
		this.sectionId = args.sectionId;
		this.attemptId = args.attemptId;

		const resolved = (await args.coordinator.getOrCreateSectionController({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			input: {
				section: args.section,
				sectionId: args.sectionId,
				assessmentId: args.assessmentId,
				view: args.view,
			},
			updateExisting: true,
			createDefaultController: args.createDefaultController,
		})) as RuntimeController;

		if (token !== this.activeInitToken) return;
		this.unsubscribeController?.();
		this.controller = resolved;
		args.onCompositionChanged?.(resolved.getCompositionModel?.());
		this.unsubscribeController = resolved.subscribe?.(() => {
			args.onCompositionChanged?.(resolved.getCompositionModel?.());
		}) || null;
	}

	register(detail: RuntimeRegistrationDetail): boolean {
		return this.registry.register(detail);
	}

	unregister(element: HTMLElement): boolean {
		return this.registry.unregister(element);
	}

	getCompositionModel(): unknown {
		return this.controller?.getCompositionModel?.() ?? null;
	}

	getCanonicalItemId(itemId: string): string {
		const map = this.registry.getCanonicalIdMap();
		return map[itemId] || this.controller?.getCanonicalItemId?.(itemId) || itemId;
	}

	handleContentRegistered(detail: RuntimeRegistrationDetail): void {
		this.controller?.handleContentRegistered?.({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId || detail.itemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	handleContentUnregistered(detail: RuntimeRegistrationDetail): void {
		this.controller?.handleContentUnregistered?.({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId || detail.itemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	handleContentLoaded(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}): void {
		this.controller?.handleContentLoaded?.(args);
	}

	handleItemPlayerError(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}): void {
		this.controller?.handleItemPlayerError?.(args);
	}

	reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		this.controller?.reportSectionError?.(args);
	}

	handleItemSessionChanged(itemId: string, session: unknown): unknown {
		const canonicalId = this.getCanonicalItemId(itemId);
		return this.controller?.handleItemSessionChanged?.(canonicalId, session) ?? null;
	}

	navigateToItem(index: number): unknown {
		return this.controller?.navigateToItem?.(index) ?? null;
	}

	async persist(): Promise<void> {
		await this.controller?.persist?.();
	}

	async hydrate(): Promise<void> {
		await this.controller?.hydrate?.();
	}

	getRegistry() {
		return this.registry;
	}

	async dispose(): Promise<void> {
		this.activeInitToken += 1;
		this.unsubscribeController?.();
		this.unsubscribeController = null;
		if (this.coordinator && this.sectionId) {
			await this.coordinator.disposeSectionController({
				sectionId: this.sectionId,
				attemptId: this.attemptId,
			});
		}
		this.registry.clear();
		this.controller = null;
		this.coordinator = null;
	}
}
