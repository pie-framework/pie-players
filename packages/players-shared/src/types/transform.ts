/**
 * Local type definitions for transform package types used in client code.
 *
 * These are copied from @pie-api-aws/transform to avoid importing from a server-only package.
 * This prevents Vite from trying to process the package and its Node.js dependencies.
 *
 * Server-side code should import directly from @pie-api-aws/transform.
 *
 * When these types change in the transform package, they should be updated here as well.
 */

// Minimal type definitions needed for client-side code
// Full definitions are in @pie-api-aws/transform (use in server code)
export type LearnosityItem = Partial<{
	reference?: string;
	description?: string;
	status?: string; // 'published' | 'unpublished' | 'archived'
	scoring_type?: string; // e.g. exactMatch
	questions: Array<
		Partial<{
			id?: string;
			reference?: string;
			metaData?: { [key: string]: any };
			data: { [key: string]: any };
			[key: string]: any;
		}>
	>;
	tags?: { [key: string]: string[] };
	[key: string]: any;
}>;

export class LearnosityToPieMappingLog {
	learnosityTypes: string[] = [];
	mappers: string[] = [];
	pieElementTypes: string[] = [];
}

export class PieToLearnosityMappingLog {
	learnosityTypes: string[] = [];
	mappers: string[] = [];
	pieElementTypes: string[] = [];
}

export interface MapLearnosityToPieOptions {
	log: LearnosityToPieMappingLog;
}

export interface MapPieToLearnosityOptions {
	log: PieToLearnosityMappingLog;
}
