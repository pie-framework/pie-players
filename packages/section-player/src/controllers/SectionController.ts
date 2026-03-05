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
	ContentLoadedEvent,
	ItemCompleteChangedEvent,
	ItemPlayerErrorEvent,
	ItemSelectedEvent,
	ItemSessionDataChangedEvent,
	ItemSessionMetaChangedEvent,
	NavigationResult,
	SectionContentKind,
	SectionCanonicalItemViewModel,
	SectionCanonicalSectionViewModel,
	SectionCanonicalSessionViewModel,
	SectionControllerChangeEvent,
	SectionControllerChangeListener,
	SectionCompositionModel,
	SectionAttemptSessionSlice,
	SectionControllerInput,
	SectionNavigationState,
	SectionErrorEvent,
	SectionItemsCompleteChangedEvent,
	SectionLoadingCompleteEvent,
	SectionSessionState,
	SectionViewModel,
	SessionChangedResult,
} from "./types.js";

interface SectionControllerState {
	input: SectionControllerInput | null;
	viewModel: SectionViewModel;
	testAttemptSession: TestAttemptSession | null;
}

interface TrackedRenderable {
	itemId: string;
	canonicalItemId: string;
	contentKind: SectionContentKind;
}

export class SectionController implements SectionControllerHandle {
	// SectionController intentionally owns aggregate section state only.
	// Item-level controllers may share contracts, but are not composed here.
	private readonly contentService = new SectionContentService();
	private readonly sessionService = new SectionSessionService();
	private readonly itemNavigationService = new SectionItemNavigationService();
	private persistenceStrategy: SectionControllerPersistenceStrategy | null =
		null;
	private persistenceContext: SectionControllerContext | null = null;
	private state: SectionControllerState = {
		input: null,
		viewModel: {
			passages: [],
			items: [],
			rubricBlocks: [],
			instructions: [],
			renderables: [],
			adapterItemRefs: [],
			currentItemIndex: 0,
			isPageMode: false,
		},
		testAttemptSession: null,
	};
	private readonly listeners = new Set<SectionControllerChangeListener>();
	private readonly trackedRenderables = new Map<string, TrackedRenderable>();
	private readonly loadedRenderableKeys = new Set<string>();
	private readonly itemCompletionByCanonicalId = new Map<string, boolean>();
	private sectionLoadingComplete = false;
	private sectionLoadingSnapshot: SectionLoadingCompleteEvent | null = null;
	private sectionItemsCompleteSnapshot: SectionItemsCompleteChangedEvent | null =
		null;
	private lastItemSelectionSnapshot: ItemSelectedEvent | null = null;
	private lastSectionErrorSnapshot: SectionErrorEvent | null = null;

	private emitChange(event: SectionControllerChangeEvent): void {
		this.captureReplaySnapshot(event);
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
		for (const event of this.buildReplayEvents()) {
			try {
				listener(event);
			} catch (error) {
				console.warn("[SectionController] replay listener failed", error);
			}
		}
		return () => {
			this.listeners.delete(listener);
		};
	}

	public async initialize(input?: unknown): Promise<void> {
		const typedInput = input as SectionControllerInput | undefined;
		if (!typedInput) return;

		const content = this.contentService.build(
			typedInput.section,
			typedInput.view,
		);
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
		this.resetLifecycleTracking();
		this.bootstrapCompletionFromSessions();
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
		)) as {
			testAttemptSession?: TestAttemptSession;
			currentItemIndex?: number;
		} | null;
		if (!snapshot) return;
		if (snapshot.testAttemptSession) {
			this.state.testAttemptSession = snapshot.testAttemptSession;
		}
		if (typeof snapshot.currentItemIndex === "number") {
			this.state.viewModel.currentItemIndex = snapshot.currentItemIndex;
		}
		this.bootstrapCompletionFromSessions();
	}

	public async persist(): Promise<void> {
		if (!this.persistenceStrategy || !this.persistenceContext) return;
		await this.persistenceStrategy.save(
			this.persistenceContext,
			this.getSnapshot(),
		);
	}

	public dispose(): void {
		this.listeners.clear();
		this.resetLifecycleTracking();
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
		const itemViewModels = this.getItemViewModels();
		return {
			section: this.state.input?.section || null,
			assessmentItemRefs: this.state.input?.section?.assessmentItemRefs || [],
			passages: this.state.viewModel.passages,
			items: this.state.viewModel.items,
			rubricBlocks: this.state.viewModel.rubricBlocks,
			instructions: this.state.viewModel.instructions,
			renderables: this.state.viewModel.renderables,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			currentItem: this.getCurrentItem(),
			isPageMode: this.state.viewModel.isPageMode,
			itemSessionsByItemId: this.getItemSessionsByItemId(),
			testAttemptSession: this.getResolvedTestAttemptSession(),
			itemViewModels,
		};
	}

	public getCanonicalItemViewModel(
		itemId: string,
	): SectionCanonicalItemViewModel | null {
		if (!itemId) return null;
		const itemViewModel = this.getItemViewModels().find((entry) => {
			return entry.itemId === itemId || entry.canonicalItemId === itemId;
		});
		return itemViewModel || null;
	}

	public getCanonicalSectionViewModel(): SectionCanonicalSectionViewModel {
		return {
			sectionId: this.state.input?.sectionId || "",
			currentItemIndex: this.state.viewModel.currentItemIndex,
			items: this.getItemViewModels(),
		};
	}

	public getCanonicalSessionViewModel(): SectionCanonicalSessionViewModel {
		const currentItemIndex = this.state.viewModel.currentItemIndex;
		const itemSessionsByCanonicalId = Object.fromEntries(
			this.state.viewModel.adapterItemRefs
				.map((itemRef) => {
					const canonicalItemId = itemRef.identifier || itemRef.item?.id;
					if (!canonicalItemId) return null;
					const itemViewModel = this.getCanonicalItemViewModel(canonicalItemId);
					return [canonicalItemId, itemViewModel?.session] as const;
				})
				.filter(
					(entry): entry is readonly [string, unknown] =>
						!!entry && typeof entry[0] === "string" && !!entry[0],
				),
		) as Record<string, unknown>;
		return {
			currentItemIndex,
			itemSessionsByCanonicalId,
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
			sectionId:
				this.state.input?.section?.identifier ||
				this.state.input?.sectionId ||
				"",
			itemCount: this.state.viewModel.items.length,
			passageCount: this.state.viewModel.passages.length,
			isPageMode: this.state.viewModel.isPageMode,
		};
	}

	public getResolvedItemSessions(): Record<string, any> {
		if (!this.state.testAttemptSession) return {};
		return toItemSessionsRecord(this.state.testAttemptSession) as Record<
			string,
			any
		>;
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

	private getItemViewModels(): SectionCanonicalItemViewModel[] {
		const itemSessionsByItemId = this.getItemSessionsByItemId();
		return this.state.viewModel.items.map((item, index) => {
			const itemId = item.id || "";
			const canonicalItemId = this.getCanonicalItemId(itemId);
			return {
				item,
				itemId,
				canonicalItemId,
				index,
				isCurrent: index === this.state.viewModel.currentItemIndex,
				session:
					itemSessionsByItemId[itemId] ?? itemSessionsByItemId[canonicalItemId],
			};
		});
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
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers ||
				[],
		);
		const visitedItemIdentifiers = itemIdentifiers.filter((id) =>
			visitedSet.has(id),
		);
		const itemSessions: Record<string, unknown> = {};
		for (const itemRef of this.state.viewModel.adapterItemRefs) {
			const canonicalId = itemRef.identifier || itemRef.item?.id;
			const runtimeItemId = itemRef.item?.id;
			if (!canonicalId) continue;
			const sessionValue =
				this.state.testAttemptSession?.itemSessions?.[canonicalId]?.session ??
				(runtimeItemId
					? this.state.testAttemptSession?.itemSessions?.[runtimeItemId]
							?.session
					: undefined);
			if (!sessionValue) continue;
			itemSessions[canonicalId] = sessionValue;
		}

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
		return (
			this.state.viewModel.items[this.state.viewModel.currentItemIndex] || null
		);
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
		const itemSessions = this.getResolvedItemSessions();
		const result = this.sessionService.applyItemSessionChanged({
			itemId,
			sessionDetail,
			testAttemptSession: this.state.testAttemptSession,
			itemSessions,
		});
		this.state.testAttemptSession = result.testAttemptSession;
		const canonicalItemId = this.getCanonicalItemId(result.eventDetail.itemId);
		const timestamp = result.eventDetail.timestamp;
		const intent = result.eventDetail.intent;
		const completeFromEvent =
			typeof result.eventDetail.complete === "boolean"
				? result.eventDetail.complete
				: this.readCompleteFromSession(result.eventDetail.session);

		if (intent === "metadata-only") {
			const metaEvent: ItemSessionMetaChangedEvent = {
				type: "item-session-meta-changed",
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				complete: result.eventDetail.complete,
				component: result.eventDetail.component,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp,
			};
			this.emitChange(metaEvent);
		} else {
			const dataEvent: ItemSessionDataChangedEvent = {
				type: "item-session-data-changed",
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				session: result.eventDetail.session,
				intent: result.eventDetail.intent,
				complete: result.eventDetail.complete,
				component: result.eventDetail.component,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp,
			};
			this.emitChange(dataEvent);
		}

		if (typeof completeFromEvent === "boolean") {
			this.updateItemCompleteState({
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				complete: completeFromEvent,
				timestamp,
			});
		}
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
		const selectedEvent: ItemSelectedEvent = {
			type: "item-selected",
			previousItemId: result.eventDetail.previousItemId,
			currentItemId: result.eventDetail.currentItemId,
			itemIndex: result.eventDetail.itemIndex,
			totalItems: result.eventDetail.totalItems,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: result.eventDetail.timestamp,
		};
		this.emitChange(selectedEvent);
		return result;
	}

	public handleContentRegistered(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}): void {
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const key = this.getRenderableKey(canonicalItemId, args.contentKind);
		this.trackedRenderables.set(key, {
			itemId: args.itemId,
			canonicalItemId,
			contentKind: this.toSectionContentKind(args.contentKind),
		});
		this.evaluateSectionLoadingState(Date.now());
	}

	public handleContentUnregistered(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}): void {
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const key = this.getRenderableKey(canonicalItemId, args.contentKind);
		this.trackedRenderables.delete(key);
		this.loadedRenderableKeys.delete(key);
		this.evaluateSectionLoadingState(Date.now());
	}

	public handleContentLoaded(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}): void {
		const timestamp = args.timestamp ?? Date.now();
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const contentKind = this.toSectionContentKind(args.contentKind);
		const key = this.getRenderableKey(canonicalItemId, contentKind);
		this.loadedRenderableKeys.add(key);
		const event: ContentLoadedEvent = {
			type: "content-loaded",
			contentKind,
			itemId: args.itemId,
			canonicalItemId,
			detail: args.detail,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
		this.evaluateSectionLoadingState(timestamp);
	}

	public handleItemPlayerError(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}): void {
		const timestamp = args.timestamp ?? Date.now();
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const contentKind = this.toSectionContentKind(args.contentKind);
		const itemErrorEvent: ItemPlayerErrorEvent = {
			type: "item-player-error",
			contentKind,
			itemId: args.itemId,
			canonicalItemId,
			error: args.error,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(itemErrorEvent);
		this.reportSectionError({
			source: "item-player",
			error: args.error,
			itemId: args.itemId,
			canonicalItemId,
			contentKind,
			timestamp,
		});
	}

	public reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		const event: SectionErrorEvent = {
			type: "section-error",
			source: args.source,
			error: args.error,
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId,
			contentKind: args.contentKind
				? this.toSectionContentKind(args.contentKind)
				: undefined,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: args.timestamp ?? Date.now(),
		};
		this.emitChange(event);
	}

	private resetLifecycleTracking(): void {
		this.trackedRenderables.clear();
		this.loadedRenderableKeys.clear();
		this.itemCompletionByCanonicalId.clear();
		this.sectionLoadingComplete = false;
		this.sectionLoadingSnapshot = null;
		this.sectionItemsCompleteSnapshot = null;
		this.lastItemSelectionSnapshot = null;
		this.lastSectionErrorSnapshot = null;
	}

	private toSectionContentKind(raw?: string): SectionContentKind {
		const value = String(raw || "").toLowerCase();
		if (value === "item" || value.includes("assessment-item")) return "item";
		if (value === "passage") return "passage";
		if (value === "rubric" || value.includes("rubric")) return "rubric";
		return value ? "unknown" : "unknown";
	}

	private getRenderableKey(
		canonicalItemId: string,
		contentKind?: string | SectionContentKind,
	): string {
		return `${this.toSectionContentKind(contentKind)}:${canonicalItemId}`;
	}

	private readCompleteFromSession(session: unknown): boolean | undefined {
		if (!session || typeof session !== "object") return undefined;
		const value = (session as Record<string, unknown>).complete;
		return typeof value === "boolean" ? value : undefined;
	}

	private bootstrapCompletionFromSessions(): void {
		const items = this.getItemViewModels();
		for (const item of items) {
			const complete = this.readCompleteFromSession(item.session);
			if (typeof complete === "boolean") {
				this.itemCompletionByCanonicalId.set(item.canonicalItemId, complete);
			} else if (!this.itemCompletionByCanonicalId.has(item.canonicalItemId)) {
				this.itemCompletionByCanonicalId.set(item.canonicalItemId, false);
			}
		}
		this.emitSectionItemsCompleteIfChanged(Date.now());
	}

	private updateItemCompleteState(args: {
		itemId: string;
		canonicalItemId: string;
		complete: boolean;
		timestamp: number;
	}): void {
		const previousComplete =
			this.itemCompletionByCanonicalId.get(args.canonicalItemId) ?? false;
		if (previousComplete === args.complete) {
			this.emitSectionItemsCompleteIfChanged(args.timestamp);
			return;
		}
		this.itemCompletionByCanonicalId.set(args.canonicalItemId, args.complete);
		const event: ItemCompleteChangedEvent = {
			type: "item-complete-changed",
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId,
			complete: args.complete,
			previousComplete,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: args.timestamp,
		};
		this.emitChange(event);
		this.emitSectionItemsCompleteIfChanged(args.timestamp);
	}

	private emitSectionItemsCompleteIfChanged(timestamp: number): void {
		const itemViewModels = this.getItemViewModels();
		const totalItems = itemViewModels.length;
		if (totalItems === 0) return;
		let completedCount = 0;
		for (const item of itemViewModels) {
			const complete = this.itemCompletionByCanonicalId.get(item.canonicalItemId);
			if (complete === true) {
				completedCount += 1;
			}
		}
		const complete = completedCount === totalItems;
		// Emit only when aggregate completion state flips (false<->true), not
		// for intermediate count changes while state remains the same.
		if (
			this.sectionItemsCompleteSnapshot &&
			this.sectionItemsCompleteSnapshot.complete === complete
		) {
			return;
		}
		const event: SectionItemsCompleteChangedEvent = {
			type: "section-items-complete-changed",
			complete,
			completedCount,
			totalItems,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
	}

	private evaluateSectionLoadingState(timestamp: number): void {
		const totalRegistered = this.trackedRenderables.size;
		const totalLoaded = this.loadedRenderableKeys.size;
		const nextLoaded = totalRegistered > 0 && totalLoaded >= totalRegistered;
		if (nextLoaded === this.sectionLoadingComplete) return;
		this.sectionLoadingComplete = nextLoaded;
		if (!nextLoaded) return;
		const event: SectionLoadingCompleteEvent = {
			type: "section-loading-complete",
			totalRegistered,
			totalLoaded,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
	}

	private captureReplaySnapshot(event: SectionControllerChangeEvent): void {
		if (event.type === "section-loading-complete") {
			this.sectionLoadingSnapshot = event;
		}
		if (event.type === "section-items-complete-changed") {
			this.sectionItemsCompleteSnapshot = event;
		}
		if (event.type === "item-selected") {
			this.lastItemSelectionSnapshot = event;
		}
		if (event.type === "section-error") {
			this.lastSectionErrorSnapshot = event;
		}
	}

	private buildReplayEvents(): SectionControllerChangeEvent[] {
		const replayedAt = Date.now();
		const replayEvents: SectionControllerChangeEvent[] = [];
		for (const loadedKey of this.loadedRenderableKeys) {
			const tracked = this.trackedRenderables.get(loadedKey);
			if (!tracked) continue;
			replayEvents.push({
				type: "content-loaded",
				contentKind: tracked.contentKind,
				itemId: tracked.itemId,
				canonicalItemId: tracked.canonicalItemId,
				detail: undefined,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp: replayedAt,
				replayed: true,
			});
		}
		for (const item of this.getItemViewModels()) {
			const complete =
				this.itemCompletionByCanonicalId.get(item.canonicalItemId) ?? false;
			replayEvents.push({
				type: "item-complete-changed",
				itemId: item.itemId,
				canonicalItemId: item.canonicalItemId,
				complete,
				previousComplete: complete,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp: replayedAt,
				replayed: true,
			});
		}
		if (this.lastItemSelectionSnapshot) {
			replayEvents.push({
				...this.lastItemSelectionSnapshot,
				timestamp: replayedAt,
				replayed: true,
			});
		} else {
			const currentItem = this.getCurrentItem();
			if (currentItem?.id) {
				replayEvents.push({
					type: "item-selected",
					previousItemId: currentItem.id,
					currentItemId: currentItem.id,
					itemIndex: this.state.viewModel.currentItemIndex ?? 0,
					totalItems: this.state.viewModel.items.length,
					currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
					timestamp: replayedAt,
					replayed: true,
				});
			}
		}
		if (this.sectionLoadingSnapshot) {
			replayEvents.push({
				...this.sectionLoadingSnapshot,
				timestamp: replayedAt,
				replayed: true,
			});
		}
		if (this.sectionItemsCompleteSnapshot) {
			replayEvents.push({
				...this.sectionItemsCompleteSnapshot,
				timestamp: replayedAt,
				replayed: true,
			});
		}
		if (this.lastSectionErrorSnapshot) {
			replayEvents.push({
				...this.lastSectionErrorSnapshot,
				timestamp: replayedAt,
				replayed: true,
			});
		}
		return replayEvents;
	}
}
