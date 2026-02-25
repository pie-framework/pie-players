import type {
	TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
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
	SectionControllerInput,
	SectionViewModel,
	SessionChangedResult,
} from "./types.js";

interface SectionControllerState {
	input: SectionControllerInput | null;
	viewModel: SectionViewModel;
	testAttemptSession: TestAttemptSession | null;
	itemSessions: Record<string, any>;
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
		itemSessions: {},
	};

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
				isPageMode: typedInput.section?.keepTogether === true,
			},
			testAttemptSession: sessionState.testAttemptSession,
			itemSessions: sessionState.itemSessions,
		};
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
			this.state.itemSessions = (this.state.testAttemptSession.itemSessions
				? Object.fromEntries(
						Object.entries(this.state.testAttemptSession.itemSessions).map(
							([itemId, value]) => [itemId, value.session],
						),
					)
				: {}) as Record<string, any>;
		}
		if (typeof snapshot.currentItemIndex === "number") {
			this.state.viewModel.currentItemIndex = snapshot.currentItemIndex;
		}
	}

	public async persist(): Promise<void> {
		if (!this.persistenceStrategy || !this.persistenceContext) return;
		await this.persistenceStrategy.save(this.persistenceContext, this.getSnapshot());
	}

	public dispose(): void {
		// no-op for now
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

	public getResolvedItemSessions(): Record<string, any> {
		return this.state.itemSessions;
	}

	public getResolvedTestAttemptSession(): TestAttemptSession | null {
		return this.state.testAttemptSession;
	}

	public getCurrentItem(): ItemEntity | null {
		if (this.state.viewModel.isPageMode) return null;
		return this.state.viewModel.items[this.state.viewModel.currentItemIndex] || null;
	}

	public handleItemSessionChanged(
		itemId: string,
		sessionDetail: any,
	): SessionChangedResult | null {
		if (!this.state.testAttemptSession) return null;
		const result = this.sessionService.applyItemSessionChanged({
			itemId,
			sessionDetail,
			testAttemptSession: this.state.testAttemptSession,
			itemSessions: this.state.itemSessions,
		});
		this.state.testAttemptSession = result.testAttemptSession;
		this.state.itemSessions = result.itemSessions;
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
			sectionIdentifier: this.state.input?.section?.identifier,
			testAttemptSession: this.state.testAttemptSession,
		});
		if (!result) return null;

		this.state.viewModel.currentItemIndex = result.nextIndex;
		this.state.testAttemptSession = result.testAttemptSession;
		return result;
	}
}
