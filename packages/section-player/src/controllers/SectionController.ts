import type { TestAttemptSession } from "@pie-players/pie-assessment-toolkit";
import { toItemSessionsRecord } from "@pie-players/pie-assessment-toolkit";
import type {
	SectionControllerContext,
	SectionControllerHandle,
	SectionControllerPersistenceStrategy,
} from "./toolkit-section-contracts.js";
import type { ItemEntity } from "@pie-players/pie-players-shared";
import { SectionContentService } from "./SectionContentService.js";
import { SectionItemNavigationService } from "./SectionItemNavigationService.js";
import { SectionSessionService } from "./SectionSessionService.js";
import type {
	NavigationResult,
	SectionControllerChangeEvent,
	SectionControllerChangeListener,
	SectionCompositionModel,
	SectionAttemptSessionSlice,
	SectionControllerInput,
	SectionNavigationState,
	SectionSessionState,
	SectionViewModel,
	SessionChangedResult,
} from "./types.js";

interface SectionControllerState {
	input: SectionControllerInput | null;
	viewModel: SectionViewModel;
	testAttemptSession: TestAttemptSession | null;
}

export class SectionController implements SectionControllerHandle {
	private readonly contentService = new SectionContentService();
	private readonly sessionService = new SectionSessionService();
	private readonly itemNavigationService = new SectionItemNavigationService();
	private persistenceStrategy: SectionControllerPersistenceStrategy | null = null;
	private persistenceContext: SectionControllerContext | null = null;
	private state: SectionControllerState = {
		input: null,
		viewModel: {
			passages: [],
			items: [],
			rubricBlocks: [],
			instructions: [],
			adapterItemRefs: [],
			currentItemIndex: 0,
			isPageMode: false,
		},
		testAttemptSession: null,
	};
	private readonly listeners = new Set<SectionControllerChangeListener>();

	private emitChange(
		reason: SectionControllerChangeEvent["reason"],
		partial: Partial<SectionControllerChangeEvent> = {},
	): void {
		const event: SectionControllerChangeEvent = {
			reason,
			itemId: partial.itemId,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: partial.timestamp ?? Date.now(),
		};
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.warn("[SectionController] listener failed", error);
			}
		}
	}

	public subscribe(listener: SectionControllerChangeListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	public async initialize(input?: unknown): Promise<void> {
		const typedInput = input as SectionControllerInput | undefined;
		if (!typedInput) return;

		const content = this.contentService.build(typedInput.section, typedInput.view);
		const sessionState = this.sessionService.resolve({
			...typedInput,
			adapterItemRefs: content.adapterItemRefs,
		});
		const currentItemIndex =
			sessionState.testAttemptSession?.navigationState?.currentItemIndex ?? 0;

		this.state = {
			input: typedInput,
			viewModel: {
				...content,
				currentItemIndex,
				isPageMode:
					!!typedInput.section &&
					"keepTogether" in typedInput.section &&
					typedInput.section.keepTogether === true,
			},
			testAttemptSession: sessionState.testAttemptSession,
		};
		this.emitChange("initialize");
	}

	public async updateInput(input?: unknown): Promise<void> {
		await this.initialize(input);
	}

	public async setPersistenceStrategy(
		strategy: SectionControllerPersistenceStrategy,
	): Promise<void> {
		this.persistenceStrategy = strategy;
	}

	public setPersistenceContext(context: SectionControllerContext): void {
		this.persistenceContext = context;
	}

	public async hydrate(): Promise<void> {
		if (!this.persistenceStrategy || !this.persistenceContext) return;
		const snapshot = (await this.persistenceStrategy.load(
			this.persistenceContext,
		)) as
			| {
					testAttemptSession?: TestAttemptSession;
					currentItemIndex?: number;
			  }
			| null;
		if (!snapshot) return;
		if (snapshot.testAttemptSession) {
			this.state.testAttemptSession = snapshot.testAttemptSession;
		}
		if (typeof snapshot.currentItemIndex === "number") {
			this.state.viewModel.currentItemIndex = snapshot.currentItemIndex;
		}
		this.emitChange("hydrate");
	}

	public async persist(): Promise<void> {
		if (!this.persistenceStrategy || !this.persistenceContext) return;
		await this.persistenceStrategy.save(this.persistenceContext, this.getSnapshot());
	}

	public dispose(): void {
		this.listeners.clear();
	}

	public getSnapshot(): unknown {
		return {
			testAttemptSession: this.state.testAttemptSession,
			currentItemIndex: this.state.viewModel.currentItemIndex,
		};
	}

	public getViewModel(): SectionViewModel {
		return this.state.viewModel;
	}

	public getCompositionModel(): SectionCompositionModel {
		return {
			section: this.state.input?.section || null,
			assessmentItemRefs: this.state.input?.section?.assessmentItemRefs || [],
			passages: this.state.viewModel.passages,
			items: this.state.viewModel.items,
			rubricBlocks: this.state.viewModel.rubricBlocks,
			instructions: this.state.viewModel.instructions,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			currentItem: this.getCurrentItem(),
			isPageMode: this.state.viewModel.isPageMode,
			itemSessionsByItemId: this.getItemSessionsByItemId(),
			testAttemptSession: this.getResolvedTestAttemptSession(),
		};
	}

	public getInstructions() {
		return this.state.viewModel.instructions;
	}

	public getSectionLoadedEventDetail(): {
		sectionId: string;
		itemCount: number;
		passageCount: number;
		isPageMode: boolean;
	} {
		return {
			sectionId: this.state.input?.section?.identifier || this.state.input?.sectionId || "",
			itemCount: this.state.viewModel.items.length,
			passageCount: this.state.viewModel.passages.length,
			isPageMode: this.state.viewModel.isPageMode,
		};
	}

	public getResolvedItemSessions(): Record<string, any> {
		if (!this.state.testAttemptSession) return {};
		return toItemSessionsRecord(this.state.testAttemptSession) as Record<string, any>;
	}

	public getResolvedTestAttemptSession(): TestAttemptSession | null {
		return this.state.testAttemptSession;
	}

	public getCanonicalItemId(itemId: string): string {
		if (!itemId) return itemId;
		const adapterMatch = this.state.viewModel.adapterItemRefs.find(
			(itemRef) => itemRef.item?.id === itemId,
		);
		return adapterMatch?.identifier || itemId;
	}

	public getItemSessionsByItemId(): Record<string, any> {
		const resolvedItemSessions = this.getResolvedItemSessions();
		const mapped = Object.fromEntries(
			this.state.viewModel.adapterItemRefs
				.map((itemRef) => {
					const itemId = itemRef.item?.id;
					if (!itemId) return null;
					const canonicalId = itemRef.identifier || itemId;
					return [
						itemId,
						resolvedItemSessions[canonicalId] ?? resolvedItemSessions[itemId],
					] as const;
				})
				.filter(
					(entry): entry is readonly [string, any] =>
						!!entry && typeof entry[0] === "string" && !!entry[0],
				),
		) as Record<string, any>;
		for (const [key, value] of Object.entries(resolvedItemSessions)) {
			if (!(key in mapped)) {
				mapped[key] = value;
			}
		}
		return mapped;
	}

	/**
	 * Host-facing persistence shape.
	 * Use this for serializing/restoring section session state across reloads.
	 * This is intentionally compact and not a full runtime diagnostics view.
	 */
	public getSessionState(): SectionSessionState | null {
		if (!this.state.testAttemptSession) return null;
		return this.sessionService.toSessionState(this.state.testAttemptSession);
	}

	private getSectionItemIdentifiers(): string[] {
		const fromRefs = this.state.viewModel.adapterItemRefs
			.map((itemRef) => itemRef.identifier || itemRef.item?.id)
			.filter((id): id is string => typeof id === "string" && !!id);
		if (fromRefs.length > 0) return fromRefs;
		return this.state.viewModel.items
			.map((item) => item.id)
			.filter((id): id is string => typeof id === "string" && !!id);
	}

	/**
	 * Runtime/debugger shape scoped to the current section.
	 * Use this for widgets that need a section-scoped live snapshot (debug panels, diagnostics).
	 * Unlike getSessionState(), this is optimized for runtime introspection, not host persistence.
	 */
	public getCurrentSectionAttemptSlice(): SectionAttemptSessionSlice | null {
		if (!this.state.testAttemptSession) return null;
		const itemIdentifiers = this.getSectionItemIdentifiers();
		const currentItemId =
			itemIdentifiers[this.state.viewModel.currentItemIndex] || "";
		const visitedSet = new Set(
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers || [],
		);
		const visitedItemIdentifiers = itemIdentifiers.filter((id) => visitedSet.has(id));
		const itemSessions = Object.fromEntries(
			itemIdentifiers
				.map((id) => [id, this.state.testAttemptSession?.itemSessions?.[id]?.session])
				.filter(([, session]) => !!session),
		) as Record<string, unknown>;

		return {
			sectionId: this.state.input?.sectionId || "",
			sectionIdentifier:
				this.state.input?.section?.identifier ||
				this.state.input?.sectionId ||
				undefined,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			currentItemId,
			itemIdentifiers,
			visitedItemIdentifiers,
			itemSessions,
		};
	}

	public getCurrentItem(): ItemEntity | null {
		if (this.state.viewModel.isPageMode) return null;
		return this.state.viewModel.items[this.state.viewModel.currentItemIndex] || null;
	}

	public getCurrentItemSession(): unknown {
		const currentItem = this.getCurrentItem();
		if (!currentItem?.id) return undefined;
		return this.getItemSessionsByItemId()[currentItem.id];
	}

	public getNavigationState(isLoading = false): SectionNavigationState {
		const currentIndex = this.state.viewModel.currentItemIndex;
		const totalItems = this.state.viewModel.items.length;
		const isPageMode = this.state.viewModel.isPageMode;
		return {
			currentIndex,
			totalItems,
			canNext: !isPageMode && currentIndex < totalItems - 1,
			canPrevious: !isPageMode && currentIndex > 0,
			isLoading,
		};
	}

	public handleItemSessionChanged(
		itemId: string,
		sessionDetail: any,
	): SessionChangedResult | null {
		if (!this.state.testAttemptSession) return null;
		console.debug("[SectionController][SessionTrace] handleItemSessionChanged:start", {
			itemId,
			sessionDetail,
			testAttemptSessionIdentifier:
				(this.state.testAttemptSession as any)?.testAttemptSessionIdentifier || null,
		});
		const itemSessions = this.getResolvedItemSessions();
		const result = this.sessionService.applyItemSessionChanged({
			itemId,
			sessionDetail,
			testAttemptSession: this.state.testAttemptSession,
			itemSessions,
		});
		this.state.testAttemptSession = result.testAttemptSession;
		console.debug("[SectionController][SessionTrace] handleItemSessionChanged:applied", {
			itemId: result.eventDetail.itemId,
			testAttemptSessionIdentifier:
				(result.testAttemptSession as any)?.testAttemptSessionIdentifier || null,
			itemSessionCount: Object.keys((result.testAttemptSession as any)?.itemSessions || {})
				.length,
			navigationState: (result.testAttemptSession as any)?.navigationState,
		});
		this.emitChange("session-change", {
			itemId: result.eventDetail.itemId,
			timestamp: result.eventDetail.timestamp,
		});
		return result;
	}

	/**
	 * Move between items inside the current section only.
	 * Cross-section navigation belongs to the higher-level assessment player.
	 */
	public navigateToItem(index: number): NavigationResult | null {
		if (!this.state.testAttemptSession) return null;
		const result = this.itemNavigationService.navigate({
			index,
			isPageMode: this.state.viewModel.isPageMode,
			items: this.state.viewModel.items,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			sectionIdentifier:
				this.state.input?.section?.identifier || this.state.input?.sectionId,
			testAttemptSession: this.state.testAttemptSession,
		});
		if (!result) return null;

		this.state.viewModel.currentItemIndex = result.nextIndex;
		this.state.testAttemptSession = result.testAttemptSession;
		this.emitChange("navigation-change", {
			itemId: result.eventDetail.currentItemId,
			timestamp: result.eventDetail.timestamp,
		});
		return result;
	}
}
