import type { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
import type { SectionControllerHandle } from "../services/section-controller-types.js";
import type { RuntimeRegistrationDetail } from "./registration-events.js";
import { RuntimeRegistry } from "./RuntimeRegistry.js";

interface RuntimeController extends SectionControllerHandle {
	getCompositionModel?: () => unknown;
	getCanonicalItemId?: (itemId: string) => string;
	handleItemSessionChanged?: (
		itemId: string,
		session: unknown,
	) => { eventDetail?: unknown } | null;
	subscribe?: (listener: (event: unknown) => void) => () => void;
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
