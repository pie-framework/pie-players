import { json, error, type RequestHandler } from '@sveltejs/kit';

/**
 * Dictionary API - Stub implementation for development
 *
 * This endpoint provides dictionary definitions for the dictionary lookup tool.
 * In production (pie-api-aws), this would integrate with a real dictionary service.
 *
 * Request Body (POST JSON):
 *   {
 *     keyword: string,      // Required - Word to look up
 *     language?: string,    // Optional - Language code (default: 'en-us')
 *   }
 *
 * Returns:
 *   {
 *     keyword: string,
 *     language: string,
 *     definitions: [
 *       {
 *         partOfSpeech: string,
 *         definition: string,
 *         example?: string
 *       }
 *     ]
 *   }
 */

const DEFAULT_LANGUAGE = 'en-us';

// Mock dictionary data for development
const MOCK_DEFINITIONS: Record<string, any> = {
	hello: {
		definitions: [
			{
				partOfSpeech: 'interjection',
				definition: 'Used as a greeting or to begin a phone conversation.',
				example: 'Hello, how are you?'
			},
			{
				partOfSpeech: 'noun',
				definition: 'An utterance of "hello"; a greeting.',
				example: 'She gave a warm hello.'
			}
		]
	},
	triangle: {
		definitions: [
			{
				partOfSpeech: 'noun',
				definition:
					'A plane figure with three straight sides and three angles.',
				example: 'An equilateral triangle has all sides equal.'
			},
			{
				partOfSpeech: 'noun',
				definition:
					'A musical instrument consisting of a steel rod bent into a triangle.',
				example: 'The triangle player waited for their cue.'
			}
		]
	},
	photosynthesis: {
		definitions: [
			{
				partOfSpeech: 'noun',
				definition:
					'The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.',
				example:
					'Photosynthesis generates oxygen as a byproduct.'
			}
		]
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { keyword, language = DEFAULT_LANGUAGE } = body;

	if (!keyword) {
		error(400, 'Missing required parameter: keyword');
	}

	try {
		console.log('[dictionary] Looking up word:', {
			keyword,
			language
		});

		// Check if we have mock data for this word
		const normalizedKeyword = keyword.toLowerCase().trim();
		const mockData = MOCK_DEFINITIONS[normalizedKeyword];

		if (mockData) {
			console.log(
				'[dictionary] Found %d definitions for: %s',
				mockData.definitions.length,
				keyword
			);

			return json({
				keyword,
				language,
				definitions: mockData.definitions
			});
		}

		// Return generic definition for unknown words
		console.log('[dictionary] No mock data, returning generic definition for:', keyword);

		return json({
			keyword,
			language,
			definitions: [
				{
					partOfSpeech: 'noun',
					definition: `A word or term used in educational content. (Mock definition for "${keyword}")`,
					example: `This is a placeholder definition for development purposes.`
				}
			]
		});
	} catch (e: any) {
		console.error(`[dictionary] Failed to look up word "${keyword}":`, e);
		error(500, `Dictionary lookup failed: ${e.message}`);
	}
};

/**
 * OPTIONS handler for CORS preflight
 */
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
