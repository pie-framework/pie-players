/**
 * AssessmentPlayer
 *
 * Reference implementation showing how to wire PIE Assessment Toolkit services
 * together for a complete assessment player.
 *
 * This implementation provides:
 * - Navigation through assessment items (linear or nonlinear)
 * - QTI navigation model (testParts/sections/questionRefs)
 * - Section awareness and rubric block support
 * - Event-driven architecture using TypedEventBus
 * - Session state management
 * - TTS integration via TTSService
 * - Theme support via ThemeProvider
 * - Tool coordination (optional)
 *
 * Products can use this as-is, extend it, or use it as a pattern for their own implementation.
 */

import type {
	AssessmentAuthoringCallbacks,
	AssessmentEntity,
	ItemConfig,
	ItemEntity,
	RubricBlock,
} from "@pie-players/pie-players-shared/types";
import {
	createNewTestSession,
	createTestSessionIdentifier,
	getBrowserLocalStorage,
	loadTestSession,
	type StorageLike,
	saveTestSession,
	setCurrentPosition,
	type TestSession,
	upsertItemSessionFromPieSessionChange,
	upsertVisitedItem,
} from "../attempt/TestSession";
import {
	type AssessmentToolkitEvents,
	HighlightCoordinator,
	I18nService,
	type ThemeConfig,
	ThemeProvider,
	ToolCoordinator,
	TTSService,
	TypedEventBus,
} from "../index";
import type { LoadItem } from "../item-loader";
import { AssessmentAuthoringService } from "../services/AssessmentAuthoringService";
import { ContextVariableStore } from "../services/ContextVariableStore";
import {
	PNPToolResolver,
	type ResolvedToolConfig,
} from "../services/PNPToolResolver";
import { BrowserTTSProvider } from "../services/tts/browser-provider";
import {
	DesmosCalculatorProvider,
	TICalculatorProvider,
} from "../tools/client";
import {
	buildNavigationStructure,
	detectAssessmentFormat,
	getAllQuestionRefs,
	type NavigationNode,
	type QuestionRef,
} from "./qti-navigation";

export interface ReferencePlayerConfig {
	assessment: AssessmentEntity;
	organizationId?: string | null;
	bundleHost?: string;
	/**
	 * Item loader. Must be client-resolvable (can be backed by an API or local itemBank).
	 */
	loadItem: LoadItem;

	/**
	 * Player mode (defaults to 'gather' for student assessment mode)
	 */
	mode?: "gather" | "view" | "evaluate" | "author";

	/**
	 * Optional context to generate a deterministic TestSession identifier.
	 * If omitted, a stable anonymous device id is used.
	 */
	userId?: string | null;
	assignmentId?: string | null;
	/**
	 * Optional storage injection for tests / custom persistence.
	 * Defaults to browser localStorage when available.
	 */
	attemptStorage?: StorageLike;

	// QTI navigation settings
	navigationMode?: "linear" | "nonlinear";
	showSections?: boolean;
	allowSectionNavigation?: boolean;

	// Callbacks for product-specific logic
	onSessionChanged?: (session: any) => void | Promise<void>;
	onItemChanged?: (itemId: string, index: number) => void | Promise<void>;
	onNavigationRequested?: (
		direction: "next" | "previous" | "index",
		targetIndex?: number,
	) => void | Promise<void>;

	// Authoring mode support
	authoringCallbacks?: AssessmentAuthoringCallbacks;

	// Service injection (optional - for testing and customization)
	services?: {
		eventBus?: TypedEventBus<AssessmentToolkitEvents>;
		ttsService?: TTSService;
		toolCoordinator?: ToolCoordinator;
		themeProvider?: ThemeProvider;
		highlightCoordinator?: HighlightCoordinator;
		i18nService?: I18nService;
		desmosProvider?: DesmosCalculatorProvider;
		tiProvider?: TICalculatorProvider;
	};
}

export interface NavigationState {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	isLoading: boolean;
	// Section awareness
	currentSection?: {
		id: string;
		title?: string;
		index: number;
	};
	totalSections?: number;
}

export class AssessmentPlayer {
	// Toolkit services
	private eventBus: TypedEventBus<AssessmentToolkitEvents>;
	private ttsService: TTSService;
	private themeProvider: ThemeProvider | null = null;
	private toolCoordinator: ToolCoordinator;
	private highlightCoordinator: HighlightCoordinator | null = null;
	private i18nService: I18nService;
	private desmosProvider: DesmosCalculatorProvider;
	private tiProvider: TICalculatorProvider;
	private authoringService: AssessmentAuthoringService | null = null;

	// Configuration
	private config: ReferencePlayerConfig;

	// PNP-based tool resolution
	private pnpResolver!: PNPToolResolver;
	private currentTools: ResolvedToolConfig[] = [];

	// QTI 3.0 Context Variables
	private contextStore!: ContextVariableStore;

	// Assessment format and navigation
	private assessmentFormat: "flat" | "qti";
	private questionRefs: QuestionRef[];
	private navigationStructure: NavigationNode[];
	private navigationMode: "linear" | "nonlinear";

	// State
	private currentItemIndex = -1;
	private currentItem: ItemEntity | null = null;
	private isLoadingItem = false;
	private sessionState: { id: string; data: any[] } = { id: "", data: [] };

	// QTI-like attempt (client-only)
	private attemptStorage: StorageLike | null = null;
	private testSession: TestSession | null = null;

	// TTS state
	private ttsInitialized = false;
	private ttsSpeaking = false;
	private ttsPaused = false;
	private ttsRootElement: HTMLElement | null = null;

	// State change listeners
	private navigationListeners = new Set<(state: NavigationState) => void>();
	private itemListeners = new Set<(item: ItemEntity | null) => void>();
	private loadingListeners = new Set<(isLoading: boolean) => void>();
	private sessionListeners = new Set<(session: any) => void>();
	private ttsStateListeners = new Set<
		(speaking: boolean, paused: boolean) => void
	>();

	constructor(config: ReferencePlayerConfig) {
		this.config = config;

		// Detect assessment format and build navigation structure
		this.assessmentFormat = detectAssessmentFormat(config.assessment);
		this.questionRefs = getAllQuestionRefs(config.assessment);
		this.navigationStructure = buildNavigationStructure(config.assessment);

		// Initialize/load QTI-like TestSession (client-only)
		this.attemptStorage = config.attemptStorage || getBrowserLocalStorage();
		this.initializeOrLoadTestSession();

		// Determine navigation mode
		// Priority: explicit config > QTI testPart setting > default to nonlinear
		if (config.navigationMode) {
			this.navigationMode = config.navigationMode;
		} else {
			const qtiAssessment = config.assessment as any;
			this.navigationMode =
				qtiAssessment.testParts?.[0]?.navigationMode || "nonlinear";
		}

		// Initialize toolkit services (with dependency injection support)
		this.eventBus =
			config.services?.eventBus ?? new TypedEventBus<AssessmentToolkitEvents>();
		this.ttsService = config.services?.ttsService ?? new TTSService();
		this.toolCoordinator =
			config.services?.toolCoordinator ?? new ToolCoordinator();
		this.i18nService = config.services?.i18nService ?? new I18nService();
		this.desmosProvider =
			config.services?.desmosProvider ?? new DesmosCalculatorProvider();
		this.tiProvider = config.services?.tiProvider ?? new TICalculatorProvider();

		// Initialize PNP resolver and tools from assessment
		this.pnpResolver = new PNPToolResolver();
		this.initializeTools();
		this.applyAssessmentTheme();
		this.autoActivateTools();

		// Initialize context variable store from QTI 3.0 contextDeclarations
		this.contextStore = new ContextVariableStore(
			config.assessment.contextDeclarations,
		);
		this.restoreContextVariables();

		// Initialize highlight coordinator
		// Use injected coordinator, or create new one if supported
		if (config.services?.highlightCoordinator) {
			this.highlightCoordinator = config.services.highlightCoordinator;
		} else {
			const tempCoordinator = new HighlightCoordinator();
			if (tempCoordinator.isSupported()) {
				this.highlightCoordinator = tempCoordinator;
			}
		}

		// Connect highlight coordinator to TTS service for word highlighting
		if (this.highlightCoordinator) {
			this.ttsService.setHighlightCoordinator(this.highlightCoordinator);
		}

		// Initialize authoring service if in author mode
		if (config.mode === "author" && config.authoringCallbacks) {
			this.authoringService = new AssessmentAuthoringService(
				config.assessment,
				config.authoringCallbacks,
			);
		}

		// Set up event listeners
		this.setupEventListeners();

		// Initialize TTS if enabled via PNP
		if (this.isToolEnabled("pie-tool-text-to-speech")) {
			this.initializeTTS();
		}
	}

	private initializeOrLoadTestSession(): void {
		if (!this.attemptStorage) {
			return;
		}

		const assessmentId =
			(this.config.assessment as any)?.id ||
			(this.config.assessment as any)?._id;
		if (!assessmentId) {
			return;
		}

		const { testSessionIdentifier, seed } = createTestSessionIdentifier({
			assessmentId,
			assignmentId: this.config.assignmentId,
			userId: this.config.userId,
			storage: this.attemptStorage,
		});

		const existing = loadTestSession(
			this.attemptStorage,
			testSessionIdentifier,
		);
		const currentItemIdentifiers = this.questionRefs.map((q) => q.identifier);

		if (existing) {
			// Keep existing runtime state, but make sure realized order matches current definition
			// (for now we don't implement selection/shuffle, so realization is the current flat order).
			const needsUpdate =
				!existing.realization?.itemIdentifiers ||
				existing.realization.itemIdentifiers.length !==
					currentItemIdentifiers.length;

			this.testSession = needsUpdate
				? {
						...existing,
						realization: {
							...existing.realization,
							seed: existing.realization?.seed || seed,
							itemIdentifiers: currentItemIdentifiers,
						},
					}
				: existing;
		} else {
			this.testSession = createNewTestSession({
				testSessionIdentifier,
				assessmentId,
				seed,
				itemIdentifiers: currentItemIdentifiers,
			});
		}

		// Persist immediately to ensure updatedAt/version exists
		if (this.testSession) {
			saveTestSession(this.attemptStorage, this.testSession);
		}
	}

	/**
	 * Set up internal event listeners
	 */
	private setupEventListeners(): void {
		// Listen to player events
		this.eventBus.on("player:session-changed", async (e: any) => {
			const { id, ...sessionData } = e.detail as any;
			if (id) {
				const existingEntry = this.sessionState.data.find((d) => d.id === id);
				if (existingEntry) {
					Object.assign(existingEntry, sessionData);
				} else {
					this.sessionState.data.push({ id, ...sessionData });
				}
			}

			// Notify session listeners
			this.notifySessionListeners();

			// Call product callback
			if (this.config.onSessionChanged) {
				await this.config.onSessionChanged(this.sessionState);
			}
		});

		this.eventBus.on("nav:item-changed", async (e: any) => {
			if (this.config.onItemChanged) {
				await this.config.onItemChanged(
					e.detail.currentItemId,
					e.detail.itemIndex,
				);
			}
		});

		this.eventBus.on("nav:next-requested", async (e: any) => {
			await this.navigateNext();
		});

		this.eventBus.on("nav:previous-requested", async (e: any) => {
			await this.navigatePrevious();
		});
	}

	/**
	 * Initialize TTS service
	 */
	private async initializeTTS(): Promise<void> {
		try {
			// Initialize TTS with browser provider
			const provider = new BrowserTTSProvider();
			await this.ttsService.initialize(provider, {
				organizationId: this.config.organizationId || undefined,
			});
			this.ttsInitialized = true;

			// Listen to TTS state changes
			this.ttsService.onStateChange("reference-player", (state: any) => {
				this.ttsSpeaking = state === "playing";
				this.ttsPaused = state === "paused";
				this.notifyTTSStateListeners();
			});
		} catch (error) {
			console.error("[AssessmentPlayer] Failed to initialize TTS:", error);
		}
	}

	/**
	 * Get event bus for external listeners
	 */
	getEventBus(): TypedEventBus<AssessmentToolkitEvents> {
		return this.eventBus;
	}

	/**
	 * Get current navigation state
	 */
	getNavigationState(): NavigationState {
		const totalItems = this.questionRefs.length;

		// Find current section if we have navigation structure
		let currentSection: NavigationState["currentSection"] | undefined;
		let totalSections = 0;

		if (this.navigationStructure.length > 0 && this.currentItemIndex >= 0) {
			// Count sections (filter out non-section nodes like testParts)
			const sections = this.flattenSections(this.navigationStructure);
			totalSections = sections.length;

			// Find which section contains the current question
			if (totalSections > 0) {
				const currentQuestion = this.questionRefs[this.currentItemIndex];
				if (currentQuestion) {
					for (let i = 0; i < sections.length; i++) {
						const section = sections[i];
						// Check if this section contains the current question
						if (
							this.sectionContainsQuestion(section, currentQuestion.identifier)
						) {
							currentSection = {
								id: section.id,
								title: section.title,
								index: i,
							};
							break;
						}
					}
				}
			}
		}

		return {
			currentIndex: this.currentItemIndex,
			totalItems,
			canNext: this.currentItemIndex < totalItems - 1,
			canPrevious: this.currentItemIndex > 0,
			isLoading: this.isLoadingItem,
			currentSection,
			totalSections: totalSections > 0 ? totalSections : undefined,
		};
	}

	/**
	 * Flatten navigation structure to get all sections
	 */
	private flattenSections(nodes: NavigationNode[]): NavigationNode[] {
		const sections: NavigationNode[] = [];
		for (const node of nodes) {
			if (node.type === "section") {
				sections.push(node);
			}
			if (node.children) {
				sections.push(...this.flattenSections(node.children));
			}
		}
		return sections;
	}

	/**
	 * Check if a section contains a specific question
	 */
	private sectionContainsQuestion(
		section: NavigationNode,
		questionIdentifier: string,
	): boolean {
		if (!section.children) {
			return false;
		}
		for (const child of section.children) {
			if (
				child.type === "question" &&
				child.identifier === questionIdentifier
			) {
				return true;
			}
			// Check nested sections
			if (
				child.type === "section" &&
				this.sectionContainsQuestion(child, questionIdentifier)
			) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get current item
	 */
	getCurrentItem(): ItemEntity | null {
		return this.currentItem;
	}

	/**
	 * Get current item config
	 */
	getCurrentItemConfig(): ItemConfig | null {
		return this.currentItem?.config as ItemConfig | null;
	}

	/**
	 * Get session state
	 */
	getSessionState(): { id: string; data: any[] } {
		return this.sessionState;
	}

	/**
	 * Get the client-side QTI-like TestSession (attempt) state.
	 */
	getTestSession(): TestSession | null {
		return this.testSession;
	}

	/**
	 * Get player environment
	 */
	getEnv() {
		return {
			mode: this.config.mode || "gather",
		};
	}

	/**
	 * Get ToolCoordinator for tool management
	 */
	getToolCoordinator(): ToolCoordinator {
		return this.toolCoordinator;
	}

	/**
	 * Get HighlightCoordinator for annotation/TTS highlighting
	 */
	getHighlightCoordinator(): HighlightCoordinator | null {
		return this.highlightCoordinator;
	}

	/**
	 * Get ThemeProvider for accessibility theming
	 */
	getThemeProvider(): ThemeProvider | null {
		return this.themeProvider;
	}

	/**
	 * Get I18nService for internationalization
	 */
	getI18nService(): I18nService {
		return this.i18nService;
	}

	/**
	 * Get Desmos calculator provider
	 */
	getDesmosProvider(): DesmosCalculatorProvider {
		return this.desmosProvider;
	}

	/**
	 * Get TI calculator provider
	 */
	getTIProvider(): TICalculatorProvider {
		return this.tiProvider;
	}

	/**
	 * Navigate to specific item index
	 */
	async navigate(index: number): Promise<void> {
		if (index < 0 || index >= this.questionRefs.length) {
			return;
		}

		// Stop TTS when navigating
		if (this.ttsSpeaking) {
			this.stopTTS();
		}

		this.isLoadingItem = true;
		this.notifyLoadingListeners(true);

		const previousItemId = this.currentItem?.id || null;
		this.currentItemIndex = index;
		const questionRef = this.questionRefs[index];

		// Persist attempt navigation immediately (even if item fetch fails)
		this.persistAttemptNavigation(questionRef?.identifier, index);

		if (questionRef && questionRef.itemVId) {
			try {
				this.currentItem = await this.config.loadItem(questionRef.itemVId, {
					organizationId: this.config.organizationId ?? null,
				});

				// Emit item-changed event - use questionRef.itemVId for bookmarkability
				this.eventBus.emit("nav:item-changed", {
					previousItemId,
					currentItemId: questionRef.itemVId, // Use itemVId from assessment question for URL bookmarking
					itemIndex: index,
					totalItems: this.questionRefs.length,
					timestamp: Date.now(),
				});

				// Notify item listeners
				this.notifyItemListeners();
				this.notifyNavigationListeners();
			} catch (error) {
				console.error("[AssessmentPlayer] Error fetching item:", error);
				this.currentItem = null;
			}
		} else {
			this.currentItem = null;
		}

		this.isLoadingItem = false;
		this.notifyLoadingListeners(false);
		this.notifyItemListeners();
		this.notifyNavigationListeners();
	}

	/**
	 * Navigate to next item
	 */
	async navigateNext(): Promise<void> {
		if (this.currentItemIndex < this.questionRefs.length - 1) {
			// In linear mode, prevent skipping items
			// (No additional restrictions needed here - just move to next)
			await this.navigate(this.currentItemIndex + 1);
		}
	}

	/**
	 * Navigate to previous item
	 */
	async navigatePrevious(): Promise<void> {
		// In linear mode, allow going back to previous items
		if (this.currentItemIndex > 0) {
			await this.navigate(this.currentItemIndex - 1);
		}
	}

	/**
	 * Start assessment (navigate to first item)
	 */
	async start(): Promise<void> {
		const startIndexRaw =
			this.testSession?.navigationState?.currentItemIndex ?? 0;
		const startIndex = startIndexRaw >= 0 ? startIndexRaw : 0;
		await this.navigate(startIndex);

		this.eventBus.emit("assessment:started", {
			assessmentId: this.config.assessment.id || "",
			studentId: "current-student", // TODO: Get from auth context
			timestamp: Date.now(),
		});
	}

	/**
	 * TTS: Read current question
	 */
	async readQuestion(rootElement: HTMLElement): Promise<void> {
		if (!this.ttsInitialized) return;

		this.ttsRootElement = rootElement;

		// Get the question prompt
		const promptElement = rootElement.querySelector(
			".pie-question-prompt, [data-pie-prompt], .prompt",
		);
		if (!promptElement) return;

		// Extract text (using same extraction as existing implementation)
		const text = this.extractText(promptElement as HTMLElement);
		if (!text.trim()) return;

		try {
			this.ttsSpeaking = true;
			this.ttsPaused = false;
			this.notifyTTSStateListeners();

			// Set root for highlighting
			(this.ttsService as any).setRootElement?.(promptElement as HTMLElement);

			await this.ttsService.speak(text);

			this.ttsSpeaking = false;
			this.ttsPaused = false;
			this.notifyTTSStateListeners();
		} catch (error) {
			console.error("[AssessmentPlayer] TTS error:", error);
			this.ttsSpeaking = false;
			this.ttsPaused = false;
			this.notifyTTSStateListeners();
		}
	}

	/**
	 * TTS: Toggle play/pause
	 */
	toggleTTS(rootElement?: HTMLElement): void {
		if (!this.ttsInitialized) return;

		if (this.ttsSpeaking) {
			if (this.ttsPaused) {
				this.ttsService.resume();
			} else {
				this.ttsService.pause();
			}
		} else if (rootElement) {
			this.readQuestion(rootElement);
		}
	}

	/**
	 * TTS: Stop reading
	 */
	stopTTS(): void {
		if (this.ttsSpeaking) {
			this.ttsService.stop();
			this.ttsSpeaking = false;
			this.ttsPaused = false;
			this.notifyTTSStateListeners();
		}
	}

	/**
	 * TTS: Get state
	 */
	getTTSState(): { initialized: boolean; speaking: boolean; paused: boolean } {
		return {
			initialized: this.ttsInitialized,
			speaking: this.ttsSpeaking,
			paused: this.ttsPaused,
		};
	}

	/**
	 * Apply theme
	 */
	applyTheme(theme: ThemeConfig): void {
		if (!this.themeProvider) {
			this.themeProvider = new ThemeProvider();
		}
		this.themeProvider.applyTheme(theme);
	}

	/**
	 * Handle PIE player session-changed event
	 * Call this from your component when you receive session-changed from pie-iife-player
	 */
	handlePieSessionChanged(detail: any): void {
		this.eventBus.emit("player:session-changed", {
			itemId: this.currentItem?.id || "",
			component: detail.component || "",
			complete: detail.complete || false,
			session: this.sessionState,
			timestamp: Date.now(),
		});

		// Update/persist TestSession itemSessions mapping (QTI item identifier -> PIE session id)
		const pieSessionId = detail?.id;
		const currentQuestion = this.questionRefs[this.currentItemIndex];
		if (
			this.attemptStorage &&
			this.testSession &&
			currentQuestion?.identifier &&
			pieSessionId
		) {
			this.testSession = upsertItemSessionFromPieSessionChange(
				this.testSession,
				{
					itemIdentifier: currentQuestion.identifier,
					pieSessionId,
					isCompleted: !!detail.complete,
				},
			);
			saveTestSession(this.attemptStorage, this.testSession);
		}
	}

	private persistAttemptNavigation(
		itemIdentifier: string | undefined,
		index: number,
	): void {
		if (!this.attemptStorage || !this.testSession || !itemIdentifier) {
			return;
		}

		const currentSectionIdentifier =
			this.findSectionIdentifierForQuestion(itemIdentifier) || undefined;
		this.testSession = setCurrentPosition(
			upsertVisitedItem(this.testSession, itemIdentifier),
			{
				currentItemIndex: index,
				currentSectionIdentifier,
			},
		);
		saveTestSession(this.attemptStorage, this.testSession);
	}

	private findSectionIdentifierForQuestion(
		questionIdentifier: string,
	): string | null {
		const sections = this.flattenSections(this.navigationStructure);
		for (const section of sections) {
			if (this.sectionContainsQuestion(section, questionIdentifier)) {
				return section.identifier;
			}
		}
		return null;
	}

	/**
	 * Subscribe to navigation state changes
	 */
	onNavigationChange(listener: (state: NavigationState) => void): () => void {
		this.navigationListeners.add(listener);
		return () => this.navigationListeners.delete(listener);
	}

	/**
	 * Subscribe to item changes
	 */
	onItemChange(listener: (item: ItemEntity | null) => void): () => void {
		this.itemListeners.add(listener);
		return () => this.itemListeners.delete(listener);
	}

	/**
	 * Subscribe to loading state changes
	 */
	onLoadingChange(listener: (isLoading: boolean) => void): () => void {
		this.loadingListeners.add(listener);
		return () => this.loadingListeners.delete(listener);
	}

	/**
	 * Subscribe to session changes
	 */
	onSessionChange(listener: (session: any) => void): () => void {
		this.sessionListeners.add(listener);
		return () => this.sessionListeners.delete(listener);
	}

	/**
	 * Subscribe to TTS state changes
	 */
	onTTSStateChange(
		listener: (speaking: boolean, paused: boolean) => void,
	): () => void {
		this.ttsStateListeners.add(listener);
		return () => this.ttsStateListeners.delete(listener);
	}

	/**
	 * Notify listeners
	 */
	private notifyNavigationListeners(): void {
		const state = this.getNavigationState();
		this.navigationListeners.forEach((listener) => listener(state));
	}

	private notifyItemListeners(): void {
		this.itemListeners.forEach((listener) => listener(this.currentItem));
	}

	private notifyLoadingListeners(isLoading: boolean): void {
		this.loadingListeners.forEach((listener) => listener(isLoading));
	}

	private notifySessionListeners(): void {
		this.sessionListeners.forEach((listener) => listener(this.sessionState));
	}

	private notifyTTSStateListeners(): void {
		this.ttsStateListeners.forEach((listener) =>
			listener(this.ttsSpeaking, this.ttsPaused),
		);
	}

	/**
	 * Extract text from element (simplified)
	 * Production would use extractTextFromElement from tts/utils
	 */
	private extractText(element: HTMLElement): string {
		// This is simplified - production should use the actual extraction logic
		return element.textContent || "";
	}

	/**
	 * Get current section's rubric blocks (passages, instructions)
	 */
	getCurrentSectionRubricBlocks(): RubricBlock[] {
		const navState = this.getNavigationState();
		if (!navState.currentSection || this.navigationStructure.length === 0) {
			return [];
		}

		// Find the current section node
		const sections = this.flattenSections(this.navigationStructure);
		const currentSectionNode = sections[navState.currentSection.index];

		if (!currentSectionNode) {
			return [];
		}

		// Extract rubric blocks from the assessment structure
		// This requires accessing the original assessment data
		return this.extractRubricBlocksForSection(currentSectionNode.identifier);
	}

	/**
	 * Extract rubric blocks for a specific section identifier
	 */
	private extractRubricBlocksForSection(
		sectionIdentifier: string,
	): RubricBlock[] {
		const format = this.assessmentFormat;

		if (format === "qti") {
			// Type assertion needed for QTI fields
			const qtiAssessment = this.config.assessment as any;

			if (!qtiAssessment.testParts) {
				return [];
			}

			// Search through testParts and sections
			for (const testPart of qtiAssessment.testParts) {
				const rubricBlocks = this.findRubricBlocksInSections(
					testPart.sections,
					sectionIdentifier,
				);
				if (rubricBlocks.length > 0) {
					return rubricBlocks;
				}
			}
		}

		return [];
	}

	/**
	 * Recursively search for rubric blocks in sections
	 */
	private findRubricBlocksInSections(
		sections: any[],
		targetIdentifier: string,
	): RubricBlock[] {
		if (!sections) {
			return [];
		}

		for (const section of sections) {
			if (section.identifier === targetIdentifier && section.rubricBlocks) {
				return section.rubricBlocks;
			}

			// Check nested sections
			if (section.sections) {
				const rubricBlocks = this.findRubricBlocksInSections(
					section.sections,
					targetIdentifier,
				);
				if (rubricBlocks.length > 0) {
					return rubricBlocks;
				}
			}
		}

		return [];
	}

	/**
	 * Navigate to a specific section (goes to first item in section)
	 */
	async navigateToSection(sectionIndex: number): Promise<void> {
		if (
			!this.config.allowSectionNavigation &&
			this.config.allowSectionNavigation !== undefined
		) {
			console.warn("[AssessmentPlayer] Section navigation is disabled");
			return;
		}

		const sections = this.flattenSections(this.navigationStructure);
		if (sectionIndex < 0 || sectionIndex >= sections.length) {
			return;
		}

		const targetSection = sections[sectionIndex];

		// Find the first question in this section
		const firstQuestionInSection =
			this.findFirstQuestionInSection(targetSection);
		if (firstQuestionInSection !== -1) {
			await this.navigate(firstQuestionInSection);
		}
	}

	/**
	 * Find the index of the first question in a section
	 */
	private findFirstQuestionInSection(section: NavigationNode): number {
		if (!section.children) {
			return -1;
		}

		// Look for first question node
		for (const child of section.children) {
			if (child.type === "question") {
				// Find this question's index in questionRefs
				const index = this.questionRefs.findIndex(
					(q) => q.identifier === child.identifier,
				);
				if (index !== -1) {
					return index;
				}
			}
			// Check nested sections
			if (child.type === "section") {
				const index = this.findFirstQuestionInSection(child);
				if (index !== -1) {
					return index;
				}
			}
		}

		return -1;
	}

	/**
	 * Get navigation mode (linear or nonlinear)
	 */
	getNavigationMode(): "linear" | "nonlinear" {
		return this.navigationMode;
	}

	/**
	 * Get all sections for display (e.g., in a section menu)
	 */
	getAllSections(): Array<{ id: string; title?: string; index: number }> {
		const sections = this.flattenSections(this.navigationStructure);
		return sections.map((section, index) => ({
			id: section.id,
			title: section.title,
			index,
		}));
	}

	/**
	 * Get the authoring service (only available in author mode)
	 */
	getAuthoringService(): AssessmentAuthoringService | null {
		return this.authoringService;
	}

	/**
	 * Enable or disable authoring mode
	 */
	setAuthoringMode(enabled: boolean): void {
		if (enabled && !this.authoringService) {
			this.authoringService = new AssessmentAuthoringService(
				this.config.assessment,
				this.config.authoringCallbacks || {},
			);
			this.config.mode = "author";
		} else if (!enabled && this.authoringService) {
			this.authoringService = null;
			this.config.mode = "gather";
		}
	}

	// ===== PROFILE-BASED CONFIGURATION =====

	/**
	 * Apply an assessment context profile
	 */
	/**
	 * Initialize tools from assessment PNP
	 */
	private initializeTools(): void {
		const assessment = this.config.assessment;

		// Resolve tools from PNP + settings
		this.currentTools = this.pnpResolver.resolveTools(assessment);

		// Register tools with coordinator
		for (const tool of this.currentTools) {
			if (tool.enabled) {
				this.toolCoordinator.registerTool(tool.id, this.humanizeName(tool.id));

				// Configure tool-specific settings
				if (tool.id === "pie-tool-calculator" && tool.settings) {
					this.configureCalculator(tool.settings);
				}
			}
		}
	}

	/**
	 * Apply theme from assessment settings
	 */
	private applyAssessmentTheme(): void {
		const settings = this.config.assessment.settings;
		const themeConfig = settings?.themeConfig;

		if (themeConfig) {
			this.themeProvider =
				this.config.services?.themeProvider ?? new ThemeProvider();
			this.themeProvider.applyTheme(themeConfig as any);
		}
	}

	/**
	 * Auto-activate tools marked in PNP
	 */
	private autoActivateTools(): void {
		const autoActivate = this.pnpResolver.getAutoActivateTools(
			this.config.assessment,
		);

		for (const toolId of autoActivate) {
			this.toolCoordinator.showTool(toolId);
		}
	}

	/**
	 * Configure calculator with settings
	 */
	private configureCalculator(settings: any): void {
		// Calculator configuration logic
		// (existing logic would be here)
	}

	/**
	 * Convert tool ID to human-readable name
	 */
	private humanizeName(toolId: string): string {
		return toolId
			.replace(/^pie-tool-/, "")
			.replace(/-/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Get available tools (resolved from PNP)
	 */
	getAvailableTools(): ResolvedToolConfig[] {
		return this.currentTools;
	}

	/**
	 * Check if a specific tool is enabled
	 */
	isToolEnabled(toolId: string): boolean {
		return this.currentTools.some((t) => t.id === toolId && t.enabled);
	}

	/**
	 * Check if a specific tool is required
	 */
	isToolRequired(toolId: string): boolean {
		const tool = this.currentTools.find((t) => t.id === toolId);
		return tool?.required || tool?.alwaysAvailable || false;
	}

	/**
	 * Get configuration for a specific tool
	 */
	getToolConfig(toolId: string): any | undefined {
		return this.currentTools.find((t) => t.id === toolId)?.settings;
	}

	/**
	 * Get layout preferences from settings
	 */
	getLayoutPreferences(): any {
		return this.config.assessment.settings?.themeConfig || {};
	}

	// ============================================================================
	// Context Variables (QTI 3.0 Context Declarations)
	// ============================================================================

	/**
	 * Get context variable value
	 *
	 * @param identifier Variable identifier
	 * @returns Variable value or undefined
	 */
	getContextVariable(identifier: string): any {
		return this.contextStore.get(identifier);
	}

	/**
	 * Set context variable value
	 *
	 * @param identifier Variable identifier
	 * @param value New value
	 */
	setContextVariable(identifier: string, value: any): void {
		this.contextStore.set(identifier, value);
		this.persistContextVariables();
	}

	/**
	 * Get all context variables as object
	 *
	 * @returns Object containing all context variables
	 */
	getContextVariables(): Record<string, any> {
		return this.contextStore.toObject();
	}

	/**
	 * Reset context variables to default values
	 */
	resetContextVariables(): void {
		this.contextStore.reset();
		this.persistContextVariables();
	}

	/**
	 * Restore context variables from session storage
	 */
	private restoreContextVariables(): void {
		if (this.testSession?.contextVariables) {
			this.contextStore.fromObject(this.testSession.contextVariables);
		}
	}

	/**
	 * Persist context variables to session storage
	 */
	private persistContextVariables(): void {
		if (this.testSession && this.attemptStorage) {
			this.testSession = {
				...this.testSession,
				contextVariables: this.contextStore.toObject(),
			};
			saveTestSession(this.attemptStorage, this.testSession);
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.ttsInitialized) {
			this.ttsService.offStateChange("reference-player", () => {});
		}

		if (this.themeProvider) {
			this.themeProvider.destroy();
		}

		if (this.highlightCoordinator) {
			this.highlightCoordinator.destroy();
		}

		this.navigationListeners.clear();
		this.itemListeners.clear();
		this.loadingListeners.clear();
		this.sessionListeners.clear();
		this.ttsStateListeners.clear();
	}
}
