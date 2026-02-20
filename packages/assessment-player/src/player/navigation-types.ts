/**
 * Navigation Types
 *
 * Interfaces for navigation provider that delegates navigation decisions to the platform.
 */

import type {
	ItemEntity,
	PassageEntity,
} from "@pie-players/pie-players-shared";
import type { ItemMetadata } from "@pie-players/pie-assessment-toolkit";

export interface NavigationResult {
	success: boolean;
	itemVId?: string;
	itemIndex?: number;
	itemConfig?: ItemEntity;
	passageConfig?: PassageEntity;
	error?: string;
	metadata?: ItemMetadata;
}

export interface NavigationProvider {
	// Current state
	getCurrentIndex(): number;
	getCurrentItemId(): string | null;
	getTotalItems(): number;

	// Navigation decisions (platform implements)
	canNavigateNext(): Promise<boolean>;
	canNavigatePrevious(): Promise<boolean>;
	navigateNext(): Promise<NavigationResult>;
	navigatePrevious(): Promise<NavigationResult>;
	navigateToIndex(index: number): Promise<NavigationResult>;

	// Metadata
	getItemMetadata(index: number): Promise<ItemMetadata | null>;
}

/**
 * Rich context for adaptive navigation
 */
export interface NavigationContext {
	// Identity
	assessmentId: string;
	studentId: string;
	currentItemId: string | null;

	// Response history
	responseHistory: ResponseHistoryEntry[];

	// Student profile
	studentProfile: {
		readingLevel?: string;
		mathLevel?: string;
		accommodations: string[];
	};

	// Time tracking
	totalTimeSpent: number;
	timeSpentOnCurrentItem: number;
	timeRemaining?: number;

	// Performance
	currentDifficulty?: number;
	correctAnswers: number;
	totalAnswered: number;

	// Navigation history
	visitedItems: string[];
	skippedItems: string[];

	// Tool usage
	toolsUsed: ToolUsageEntry[];
}

export interface ResponseHistoryEntry {
	itemVId: string;
	correct: boolean;
	timeSpent: number;
	timestamp: number;
}

export interface ToolUsageEntry {
	itemVId: string;
	toolId: string;
	duration: number;
	timestamp: number;
}
