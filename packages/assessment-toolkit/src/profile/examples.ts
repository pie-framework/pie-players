/**
 * Usage Examples for Assessment Context Profile System
 *
 * This file demonstrates various ways to use the profile system,
 * from simple to advanced customization scenarios.
 */

import { AssessmentPlayer } from "../player/AssessmentPlayer";
import { DefaultProfileResolver } from "./DefaultProfileResolver";
import type {
	AssessmentContextProfile,
	ProfileResolver,
	ResolutionContext,
	StudentInput,
	ToolResolution,
} from "./interfaces";

// ============================================================================
// Example 1: Simple Usage - Use Reference Resolver
// ============================================================================

export async function simpleProfileExample() {
	const resolver = new DefaultProfileResolver();

	// Define resolution context
	const context: ResolutionContext = {
		assessment: {
			id: "math-grade-5",
			title: "Grade 5 Math Assessment",
			subject: "math",
			gradeLevel: 5,
			defaultTools: ["calculator", "ruler", "protractor"],
		},
		student: {
			id: "student-123",
			grade: 5,
			accommodations: {
				textToSpeech: true,
				extendedTime: true,
			},
		},
	};

	// Resolve profile
	const profile = await resolver.resolve(context);

	// Use profile with player
	const player = new AssessmentPlayer({
		assessment: myAssessment,
		loadItem: myItemLoader,
		contextProfile: profile,
	});

	// Check what tools are available
	console.log("Available tools:", player.getAvailableTools());
	console.log("Is TTS enabled?", player.isToolEnabled("textToSpeech"));
}

// ============================================================================
// Example 2: Item-Specific Resolution
// ============================================================================

export async function itemSpecificExample() {
	const resolver = new DefaultProfileResolver();

	// Resolve profile for a specific item
	const profile = await resolver.resolve({
		assessment: {
			id: "math-test",
			defaultTools: ["calculator"],
		},
		student: {
			id: "student-456",
			accommodations: {
				calculator: true,
			},
		},
		item: {
			id: "question-789",
			requiredTools: ["graphing-calculator"], // Override: requires graphing calculator
			restrictedTools: ["ruler"], // Block ruler for this item
		},
	});

	// The profile will show graphing calculator as required
	const graphingCalc = profile.tools.available.find(
		(t) => t.toolId === "graphing-calculator",
	);
	console.log("Graphing calculator required:", graphingCalc?.required); // true

	// Ruler will not be in available tools (restricted)
	const ruler = profile.tools.available.find((t) => t.toolId === "ruler");
	console.log("Ruler available:", ruler?.enabled); // false
}

// ============================================================================
// Example 3: IEP/504 Accommodations
// ============================================================================

export async function iepAccommodationsExample() {
	const resolver = new DefaultProfileResolver();

	const profile = await resolver.resolve({
		assessment: {
			id: "ela-test",
			defaultTools: [],
		},
		student: {
			id: "student-with-iep",
			iep: {
				requiredTools: ["textToSpeech", "highlighter"],
				themeRequirements: {
					fontSize: 18,
					highContrast: true,
					colorScheme: "high-contrast",
				},
			},
		},
	});

	// IEP requirements override defaults
	console.log(
		"TTS always available:",
		profile.tools.available.find((t) => t.toolId === "textToSpeech")
			?.alwaysAvailable,
	); // true
	console.log("High contrast enabled:", profile.theme.highContrast); // true
	console.log("Font size:", profile.theme.fontSize); // 18

	// Use with player
	const player = new AssessmentPlayer({
		assessment: myAssessment,
		loadItem: myItemLoader,
		contextProfile: profile,
	});
}

// ============================================================================
// Example 4: District Policy Enforcement
// ============================================================================

export async function districtPolicyExample() {
	const resolver = new DefaultProfileResolver();

	const profile = await resolver.resolve({
		assessment: {
			id: "state-test",
			defaultTools: ["calculator", "ruler"],
		},
		district: {
			id: "district-001",
			blockedTools: ["calculator"], // District blocks calculators on state tests
		},
		student: {
			id: "student-789",
			accommodations: {
				calculator: true, // Student wants calculator
			},
		},
	});

	// District block overrides student accommodation
	const calculator = profile.tools.available.find(
		(t) => t.toolId === "calculator",
	);
	console.log("Calculator blocked:", calculator?.enabled === false); // true

	// Check resolution trace for debugging
	if (profile.tools.resolutionTrace) {
		const trace = profile.tools.resolutionTrace.get("calculator");
		console.log("Calculator decision:", trace?.decision); // "blocked"
		console.log("Block reason:", trace?.reasons); // ["Tool blocked by district policy"]
	}
}

// ============================================================================
// Example 5: Custom Resolver - Extend Reference Implementation
// ============================================================================

export class CustomDistrictResolver extends DefaultProfileResolver {
	/**
	 * Override tool resolution to add custom district logic
	 */
	protected resolveToolAvailability(
		toolId: string,
		context: ResolutionContext,
	): ToolResolution {
		// Custom rule: Block calculators for grade 3 math
		if (
			toolId === "calculator" &&
			context.student?.grade === 3 &&
			context.assessment.subject === "math"
		) {
			return {
				enabled: false,
				restricted: true,
				explanation: {
					toolId,
					decision: "blocked",
					reasons: ["District policy: No calculators for 3rd grade math"],
					sources: ["District Policy"],
					precedenceOrder: ["custom-district-rule"],
				},
			};
		}

		// Custom rule: Require highlighter for ELA with struggling readers
		if (
			toolId === "highlighter" &&
			context.assessment.subject === "ela" &&
			context.student?.custom?.strugglingReader === true
		) {
			return {
				enabled: true,
				required: true,
				explanation: {
					toolId,
					decision: "required",
					reasons: [
						"District support: Highlighter required for struggling readers",
					],
					sources: ["District Support Program"],
					precedenceOrder: ["custom-district-rule"],
				},
			};
		}

		// Fall back to standard resolution
		return super.resolveToolAvailability(toolId, context);
	}
}

export async function customResolverExample() {
	const resolver = new CustomDistrictResolver();

	// Test grade 3 math calculator block
	const profile1 = await resolver.resolve({
		assessment: {
			id: "math-3",
			subject: "math",
			gradeLevel: 3,
			defaultTools: ["calculator"],
		},
		student: {
			id: "student-grade3",
			grade: 3,
		},
	});

	console.log(
		"Calculator blocked for grade 3:",
		!profile1.tools.available.find((t) => t.toolId === "calculator")?.enabled,
	);

	// Test struggling reader highlighter requirement
	const profile2 = await resolver.resolve({
		assessment: {
			id: "ela-5",
			subject: "ela",
		},
		student: {
			id: "student-ela",
			custom: {
				strugglingReader: true,
			},
		},
	});

	console.log(
		"Highlighter required:",
		profile2.tools.available.find((t) => t.toolId === "highlighter")?.required,
	);
}

// ============================================================================
// Example 6: Fully Custom Resolver (No Inheritance)
// ============================================================================

export class ProductSpecificResolver implements ProfileResolver {
	async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
		// Completely custom resolution logic
		// Could call external APIs, databases, complex rule engines, etc.

		const tools = await this.customToolResolution(context);
		const theme = await this.customThemeResolution(context);

		return {
			profileId: `custom-${context.assessment.id}-${Date.now()}`,
			studentId: context.student?.id,
			assessmentId: context.assessment.id,
			tools,
			theme,
			layout: {},
			metadata: {
				createdAt: new Date(),
				createdBy: "ProductSpecificResolver",
				version: "1.0.0",
			},
		};
	}

	private async customToolResolution(context: ResolutionContext) {
		// Your custom logic here
		// Could integrate with:
		// - External accommodation service
		// - Learning analytics platform
		// - District policy engine
		// - Real-time adaptive logic

		return {
			available: [
				{
					toolId: "calculator",
					enabled: true,
					config: {
						calculatorType: "scientific" as const,
					},
				},
			],
		};
	}

	private async customThemeResolution(context: ResolutionContext) {
		// Your custom theme logic
		return {
			colorScheme: "default" as const,
			fontSize: 16,
		};
	}
}

// ============================================================================
// Example 7: Profile Caching and Reuse
// ============================================================================

export class ProfileCache {
	private cache = new Map<string, AssessmentContextProfile>();

	async getOrCreateProfile(
		resolver: ProfileResolver,
		context: ResolutionContext,
	): Promise<AssessmentContextProfile> {
		const cacheKey = this.buildCacheKey(context);

		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		const profile = await resolver.resolve(context);
		this.cache.set(cacheKey, profile);

		return profile;
	}

	private buildCacheKey(context: ResolutionContext): string {
		return `${context.assessment.id}-${context.student?.id || "anonymous"}-${context.item?.id || "all"}`;
	}

	clear(): void {
		this.cache.clear();
	}
}

export async function profileCachingExample() {
	const cache = new ProfileCache();
	const resolver = new DefaultProfileResolver();

	const context: ResolutionContext = {
		assessment: { id: "test-123" },
		student: { id: "student-456" } as StudentInput,
	};

	// First call resolves
	const profile1 = await cache.getOrCreateProfile(resolver, context);

	// Second call returns cached profile (fast)
	const profile2 = await cache.getOrCreateProfile(resolver, context);

	console.log("Same profile instance:", profile1 === profile2); // true
}

// ============================================================================
// Example 8: Dynamic Profile Updates
// ============================================================================

export async function dynamicProfileExample() {
	const resolver = new DefaultProfileResolver();

	// Initial profile
	let profile = await resolver.resolve({
		assessment: { id: "test" },
		student: { id: "student", accommodations: { calculator: true } },
	});

	const player = new AssessmentPlayer({
		assessment: myAssessment,
		loadItem: myItemLoader,
		contextProfile: profile,
	});

	// Later: Item changes, re-resolve with item context
	const currentItem = player.getCurrentItem();
	if (currentItem?.id) {
		profile = await resolver.resolve({
			assessment: { id: "test" },
			student: { id: "student", accommodations: { calculator: true } },
			item: {
				id: currentItem.id,
				requiredTools: ["graphing-calculator"],
			},
		});

		// Could apply updated profile to player
		// (Would require additional player API for profile updates)
	}
}

// ============================================================================
// Example 9: Testing with Mock Profiles
// ============================================================================

export function createMockProfile(
	overrides?: Partial<AssessmentContextProfile>,
): AssessmentContextProfile {
	return {
		profileId: "mock-profile",
		assessmentId: "mock-assessment",
		tools: {
			available: [
				{ toolId: "calculator", enabled: true },
				{ toolId: "ruler", enabled: true },
			],
		},
		theme: {
			colorScheme: "default",
			fontSize: 16,
		},
		layout: {},
		...overrides,
	};
}

export function testPlayerWithMockProfile() {
	const profile = createMockProfile({
		tools: {
			available: [
				{ toolId: "calculator", enabled: true, required: true },
				{ toolId: "textToSpeech", enabled: true, alwaysAvailable: true },
			],
		},
	});

	const player = new AssessmentPlayer({
		assessment: myMockAssessment,
		loadItem: myMockLoader,
		contextProfile: profile,
	});

	// Test tool availability
	expect(player.isToolEnabled("calculator")).toBe(true);
	expect(player.isToolRequired("calculator")).toBe(true);
}

// ============================================================================
// Helper: Declarations for examples
// ============================================================================

declare const myAssessment: any;
declare const myItemLoader: any;
declare const myMockAssessment: any;
declare const myMockLoader: any;
declare function expect(value: any): any;
