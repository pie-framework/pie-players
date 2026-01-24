/**
 * Local type definitions for search package types used in client code.
 *
 * These are copied from @pie-api-aws/search to avoid importing from a server-only package.
 * This prevents Vite from trying to process the package and its Node.js dependencies.
 *
 * Server-side code should import directly from @pie-api-aws/search.
 *
 * When these types change in the search package, they should be updated here as well.
 */

export interface GenerationDebugInfo {
	step1: {
		prompt: string;
		response: string;
		parsedIntent: {
			subject?: string;
			standardSet?: string;
			gradeLevels: number[];
			keywords: string[];
			standardSearchHints: string[];
			[key: string]: any;
		};
		cost?: {
			inputTokens: number;
			outputTokens: number;
			estimatedCost: number;
		};
	};
	step2: {
		intent: {
			subject?: string;
			standardSet?: string;
			gradeLevels: number[];
			keywords: string[];
			standardSearchHints: string[];
			[key: string]: any;
		};
		searchQuery?: {
			filters: {
				subject?: string;
				standardSet?: string;
				gradeLevels: number[];
			};
			keywords: string[];
			searchHints: string[];
			[key: string]: any;
		};
		candidatesFound: number;
		candidatesEmbedded?: number;
		topStandards?: Array<{
			guid: string;
			title?: string;
			score?: number;
			similarity?: number;
		}>;
		topStandardsReturned?: number;
		cost?: {
			embeddingCalls: number;
			estimatedCost: number;
		};
	};
	step3: {
		prompt: string;
		response: string;
		parsedBlueprint: {
			name: string;
			description?: string;
			subject?: string;
			standardSet?: string;
			gradeLevels: number[];
			assessmentGoal?: {
				dokDistribution?: {
					dok1?: number;
					dok2?: number;
					dok3?: number;
					dok4?: number;
				};
				totalItemCount?: {
					target?: number;
					min?: number;
					max?: number;
				};
				[key: string]: any;
			};
			standards: Array<{
				guid: string;
				count: number;
				rationale?: string;
				[key: string]: any;
			}>;
			[key: string]: any;
		};
		cost?: {
			inputTokens: number;
			outputTokens: number;
			estimatedCost: number;
		};
	};
	totalCost?: {
		llmCalls: number;
		embeddingCalls?: number;
		estimatedTotalCost: number;
	};
}
