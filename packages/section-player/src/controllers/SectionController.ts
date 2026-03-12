import type { TestAttemptSession } from "@pie-players/pie-assessment-toolkit";
import { toItemSessionsRecord } from "@pie-players/pie-assessment-toolkit";
import type {
	SectionControllerHandle,
	SectionSessionPersistenceConfig,
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
	SectionControllerChangeEvent,
	SectionControllerChangeListener,
	SectionCompositionModel,
	SectionNavigationChangeEvent,
	SectionAttemptSessionSlice,
	SectionControllerInput,
	SectionNavigationState,
	SectionErrorEvent,
	SectionItemsCompleteChangedEvent,
	SectionLoadingCompleteEvent,
	SectionSessionAppliedEvent,
	SectionViewModel,
	SessionChangedResult,
} from "./types.js";
import type {
	SectionControllerRuntimeState,
	SectionControllerSessionState,
} from "./toolkit-section-contracts.js";

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

interface PendingApplyReplay {
	revision: number;
	mode: "replace" | "merge";
	session: SectionControllerSessionState;
}

interface NormalizedApplySession {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: TestAttemptSession["itemSessions"];
	itemSessionCount: number;
}

export class SectionController implements SectionControllerHandle {
	// SectionController intentionally owns aggregate section state only.
	// Item-level controllers may share contracts, but are not composed here.
	private readonly contentService = new SectionContentService();
	private readonly sessionService = new SectionSessionService();
	private readonly itemNavigationService = new SectionItemNavigationService();
	private sessionPersistence: SectionSessionPersistenceConfig | null = null;
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
	private totalRegistered = 0;
	private totalLoaded = 0;
	private sectionItemsComplete = false;
	private completedCount = 0;
	private totalItems = 0;
	private nextApplyRevision = 0;
	private lastReplayedApplyRevision = 0;
	private pendingApplyReplay: PendingApplyReplay | null = null;

	private emitChange(event: SectionControllerChangeEvent): void {
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
		const previousSectionId =
			this.state.input?.section?.identifier || this.state.input?.sectionId || undefined;

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
		const currentSectionId =
			typedInput.section?.identifier || typedInput.sectionId || undefined;
		if (previousSectionId !== currentSectionId) {
			const sectionNavigationEvent: SectionNavigationChangeEvent = {
				type: "section-navigation-change",
				previousSectionId,
				currentSectionId,
				reason: "input-change",
				timestamp: Date.now(),
			};
			this.emitChange(sectionNavigationEvent);
		}
	}

	public async updateInput(input?: unknown): Promise<void> {
		const previousSession = this.getSession();
		await this.initialize(input);
		if (previousSession) {
			await this.applySession(previousSession, { mode: "replace" });
		}
	}

	public configureSessionPersistence(
		config: SectionSessionPersistenceConfig,
	): void {
		this.sessionPersistence = config;
	}

	public async hydrate(): Promise<void> {
		if (!this.sessionPersistence) return;
		const snapshot = await this.sessionPersistence.strategy.loadSession(
			this.sessionPersistence.context,
		);
		if (!snapshot) return;
		await this.applySession(snapshot, { mode: "replace" });
	}

	public async persist(): Promise<void> {
		if (!this.sessionPersistence) return;
		await this.sessionPersistence.strategy.saveSession(
			this.sessionPersistence.context,
			this.getSession(),
		);
	}

	public dispose(): void {
		this.listeners.clear();
		this.resetLifecycleTracking();
		this.pendingApplyReplay = null;
		this.nextApplyRevision = 0;
		this.lastReplayedApplyRevision = 0;
	}

	public getViewModel(): SectionViewModel {
		return this.cloneForRead(this.state.viewModel);
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

	public getInstructions() {
		return this.cloneForRead(this.state.viewModel.instructions);
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
		return this.cloneForRead(this.state.testAttemptSession);
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
	public getSession(): SectionControllerSessionState | null {
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
	 * Unlike getSession(), this is optimized for runtime introspection, not host persistence.
	 */
	public getRuntimeState(): SectionControllerRuntimeState | null {
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

		const runtimeState: SectionAttemptSessionSlice = {
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
			loadingComplete: this.sectionLoadingComplete,
			totalRegistered: this.totalRegistered,
			totalLoaded: this.totalLoaded,
			itemsComplete: this.sectionItemsComplete,
			completedCount: this.completedCount,
			totalItems: this.totalItems,
		};
		return runtimeState;
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

	public updateItemSession(
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

	public async applySession(
		session: SectionControllerSessionState | null,
		options?: { mode?: "replace" | "merge" },
	): Promise<void> {
		if (!this.state.testAttemptSession || !session) return;
		const mode = options?.mode || "replace";
		const normalized = this.normalizeApplySession(session);
		this.applyNormalizedSessionToState(normalized, mode);
		this.bootstrapCompletionFromSessions();
		const applyRevision = ++this.nextApplyRevision;
		if (!this.sectionLoadingComplete) {
			this.pendingApplyReplay = {
				revision: applyRevision,
				mode,
				session: this.cloneForRead(session),
			};
		}
		const event: SectionSessionAppliedEvent = {
			type: "section-session-applied",
			mode,
			itemSessionCount: normalized.itemSessionCount,
			replay: false,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
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
		this.totalRegistered = 0;
		this.totalLoaded = 0;
		this.sectionItemsComplete = false;
		this.completedCount = 0;
		this.totalItems = 0;
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
		this.totalItems = totalItems;
		if (totalItems === 0) {
			this.completedCount = 0;
			this.sectionItemsComplete = false;
			return;
		}
		let completedCount = 0;
		for (const item of itemViewModels) {
			const complete = this.itemCompletionByCanonicalId.get(item.canonicalItemId);
			if (complete === true) {
				completedCount += 1;
			}
		}
		const complete = completedCount === totalItems;
		this.completedCount = completedCount;
		// Emit only when aggregate completion state flips (false<->true), not
		// for intermediate count changes while state remains the same.
		if (this.sectionItemsComplete === complete) {
			return;
		}
		this.sectionItemsComplete = complete;
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
		this.totalRegistered = totalRegistered;
		this.totalLoaded = totalLoaded;
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
		void this.replayPendingAppliedSession();
	}

	private async replayPendingAppliedSession(): Promise<void> {
		const pending = this.pendingApplyReplay;
		if (!pending) return;
		if (pending.revision <= this.lastReplayedApplyRevision) return;
		if (!this.sectionLoadingComplete) return;
		const normalized = this.normalizeApplySession(pending.session);
		if (!this.state.testAttemptSession) return;
		this.applyNormalizedSessionToState(normalized, pending.mode);
		this.bootstrapCompletionFromSessions();
		this.lastReplayedApplyRevision = pending.revision;
		const replayEvent: SectionSessionAppliedEvent = {
			type: "section-session-applied",
			mode: pending.mode,
			itemSessionCount: normalized.itemSessionCount,
			replay: true,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(replayEvent);
	}

	private normalizeApplySession(
		session: SectionControllerSessionState,
	): NormalizedApplySession {
		const nextItemSessionsInput =
			session.itemSessions && typeof session.itemSessions === "object"
				? (session.itemSessions as Record<string, unknown>)
				: {};
		const allowedCanonicalIds = new Set<string>(
			this.state.viewModel.adapterItemRefs
				.map((itemRef) => this.getCanonicalItemId(itemRef.identifier || itemRef.item?.id || ""))
				.filter((id): id is string => typeof id === "string" && !!id),
		);
		const normalizedItemSessions: TestAttemptSession["itemSessions"] = {};
		for (const [rawItemId, rawEntry] of Object.entries(nextItemSessionsInput)) {
			const canonicalItemId = this.getCanonicalItemId(rawItemId);
			if (!allowedCanonicalIds.has(canonicalItemId)) {
				continue;
			}
			const normalizedEntry = this.normalizeItemSessionEntry(
				canonicalItemId,
				rawEntry,
			);
			if (!normalizedEntry) continue;
			normalizedItemSessions[canonicalItemId] = normalizedEntry;
		}
		const visited = Array.isArray(session.visitedItemIdentifiers)
			? Array.from(
					new Set(
						session.visitedItemIdentifiers
							.map((id) => this.getCanonicalItemId(id))
							.filter((id): id is string => allowedCanonicalIds.has(id)),
					),
			  )
			: undefined;
		const maxIndex = Math.max(0, this.state.viewModel.items.length - 1);
		const nextCurrentItemIndex =
			typeof session.currentItemIndex === "number" &&
			Number.isFinite(session.currentItemIndex)
				? Math.min(Math.max(0, session.currentItemIndex), maxIndex)
				: undefined;
		return {
			currentItemIndex: nextCurrentItemIndex,
			visitedItemIdentifiers: visited,
			itemSessions: normalizedItemSessions,
			itemSessionCount: Object.keys(normalizedItemSessions).length,
		};
	}

	private normalizeItemSessionEntry(
		itemIdentifier: string,
		entry: unknown,
	): TestAttemptSession["itemSessions"][string] | null {
		if (!entry || typeof entry !== "object") return null;
		const candidate = entry as Record<string, unknown>;
		const typedCandidate = candidate as {
			itemIdentifier?: unknown;
			attemptCount?: unknown;
			isCompleted?: unknown;
			session?: unknown;
			complete?: unknown;
		};
		const hasCanonicalShape =
			typeof typedCandidate.itemIdentifier === "string" &&
			typedCandidate.session &&
			typeof typedCandidate.session === "object";
		if (hasCanonicalShape) {
			return {
				itemIdentifier,
				attemptCount:
					typeof typedCandidate.attemptCount === "number" &&
					Number.isFinite(typedCandidate.attemptCount)
						? typedCandidate.attemptCount
						: 1,
				isCompleted: Boolean(typedCandidate.isCompleted),
				session: typedCandidate.session as Record<string, unknown>,
			};
		}
		const rawSession = typedCandidate.session && typeof typedCandidate.session === "object"
			? (typedCandidate.session as Record<string, unknown>)
			: candidate;
		return {
			itemIdentifier,
			attemptCount: 1,
			isCompleted:
				typeof typedCandidate.complete === "boolean"
					? typedCandidate.complete
					: Boolean((rawSession as { complete?: unknown }).complete),
			session: rawSession,
		};
	}

	private applyNormalizedSessionToState(
		normalized: NormalizedApplySession,
		mode: "replace" | "merge",
	): void {
		if (!this.state.testAttemptSession) return;
		if (mode === "merge") {
			this.state.testAttemptSession.itemSessions = {
				...this.state.testAttemptSession.itemSessions,
				...normalized.itemSessions,
			};
		} else {
			this.state.testAttemptSession.itemSessions = normalized.itemSessions;
		}
		if (Array.isArray(normalized.visitedItemIdentifiers)) {
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers =
				normalized.visitedItemIdentifiers;
		} else if (mode === "replace") {
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers = [];
		}
		if (typeof normalized.currentItemIndex === "number") {
			this.state.testAttemptSession.navigationState.currentItemIndex =
				normalized.currentItemIndex;
			this.state.viewModel.currentItemIndex = normalized.currentItemIndex;
		} else if (mode === "replace") {
			this.state.testAttemptSession.navigationState.currentItemIndex = 0;
			this.state.viewModel.currentItemIndex = 0;
		}
	}

	private cloneForRead<T>(value: T): T {
		if (value === null || value === undefined) return value;
		try {
			return structuredClone(value);
		} catch {
			try {
				return JSON.parse(JSON.stringify(value)) as T;
			} catch {
				return value;
			}
		}
	}
}
