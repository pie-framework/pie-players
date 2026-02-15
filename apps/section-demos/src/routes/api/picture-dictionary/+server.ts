import { json, error, type RequestHandler } from "@sveltejs/kit";

/**
 * Picture Dictionary API - Stub implementation for development
 *
 * Mirrors pie-api-aws /api/picture-dictionary endpoint.
 * In production, this would query MongoDB and return signed S3 URLs.
 *
 * Request Body (POST JSON):
 *   {
 *     keyword: string,      // Required - Search keyword
 *     language?: string,    // Optional - Language code (default: 'en-us')
 *     max?: number         // Optional - Max number of images to return
 *   }
 *
 * Returns:
 *   {
 *     images: [
 *       { image: string }  // Image URL for each result
 *     ]
 *   }
 */

const DEFAULT_LANGUAGE = "en-us";

// Mock image data for development
// In production, these would be signed S3 URLs
const MOCK_IMAGES: Record<string, string[]> = {
	triangle: [
		"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Equilateral_Triangle.svg/200px-Equilateral_Triangle.svg.png",
		"https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Triangle_illustration.svg/200px-Triangle_illustration.svg.png",
	],
	cat: [
		"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/200px-Cat03.jpg",
		"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/200px-Cat_November_2010-1a.jpg",
	],
	apple: [
		"https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/200px-Red_Apple.jpg",
		"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Apple_with_leaf.jpg/200px-Apple_with_leaf.jpg",
	],
	circle: [
		"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Circle_-_black_simple.svg/200px-Circle_-_black_simple.svg.png",
	],
	square: [
		"https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Square_-_black_simple.svg/200px-Square_-_black_simple.svg.png",
	],
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { keyword, language = DEFAULT_LANGUAGE, max } = body;

	if (!keyword) {
		error(400, "Missing required parameter: keyword");
	}

	try {
		console.log("[picture-dictionary] Searching for images:", {
			keyword,
			language,
			max,
		});

		// Check if we have mock images for this keyword
		const normalizedKeyword = keyword.toLowerCase().trim();
		let images = MOCK_IMAGES[normalizedKeyword] || [];

		// Apply max limit if specified
		if (max && max > 0) {
			images = images.slice(0, max);
		}

		// If no mock images, return placeholder
		if (images.length === 0) {
			console.log(
				"[picture-dictionary] No mock images, returning placeholder for:",
				keyword,
			);
			images = [
				`https://via.placeholder.com/200x200/cccccc/666666?text=${encodeURIComponent(keyword)}`,
			];
		}

		console.log(
			"[picture-dictionary] Returning %d images for keyword: %s",
			images.length,
			keyword,
		);

		// Return in PIE API format (array of objects with 'image' property)
		return json({
			images: images.map((image) => ({ image })),
		});
	} catch (e: any) {
		console.error(
			`[picture-dictionary] Failed to load pictures for keyword "${keyword}":`,
			e,
		);
		error(500, `Failed to load pictures: ${e.message}`);
	}
};

/**
 * OPTIONS handler for CORS preflight
 */
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
};
