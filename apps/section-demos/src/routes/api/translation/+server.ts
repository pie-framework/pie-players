import { json, error, type RequestHandler } from "@sveltejs/kit";

/**
 * Translation API - Stub implementation for development
 *
 * This endpoint provides text translation for the translation tool.
 * In production (pie-api-aws), this would integrate with a translation service
 * like Google Translate API, AWS Translate, or similar.
 *
 * Request Body (POST JSON):
 *   {
 *     text: string,           // Required - Text to translate
 *     sourceLanguage?: string, // Optional - Source language code (default: 'auto')
 *     targetLanguage: string,  // Required - Target language code
 *   }
 *
 * Returns:
 *   {
 *     text: string,              // Original text
 *     translatedText: string,    // Translated text
 *     sourceLanguage: string,    // Detected/specified source language
 *     targetLanguage: string,    // Target language
 *   }
 */

// Mock translations for common educational terms
const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
	// English to Spanish
	"en-es": {
		hello: "hola",
		triangle: "triángulo",
		circle: "círculo",
		square: "cuadrado",
		"what is your name?": "¿cómo te llamas?",
		"how are you?": "¿cómo estás?",
		photosynthesis: "fotosíntesis",
		"the quick brown fox": "el rápido zorro marrón",
		solve: "resolver",
		calculate: "calcular",
		answer: "respuesta",
		question: "pregunta",
	},
	// English to French
	"en-fr": {
		hello: "bonjour",
		triangle: "triangle",
		circle: "cercle",
		square: "carré",
		"what is your name?": "comment tu t'appelles?",
		"how are you?": "comment allez-vous?",
		photosynthesis: "photosynthèse",
		"the quick brown fox": "le rapide renard brun",
		solve: "résoudre",
		calculate: "calculer",
		answer: "réponse",
		question: "question",
	},
	// Spanish to English
	"es-en": {
		hola: "hello",
		triángulo: "triangle",
		círculo: "circle",
		cuadrado: "square",
		"¿cómo te llamas?": "what is your name?",
		"¿cómo estás?": "how are you?",
		fotosíntesis: "photosynthesis",
	},
	// French to English
	"fr-en": {
		bonjour: "hello",
		triangle: "triangle",
		cercle: "circle",
		carré: "square",
		"comment tu t'appelles?": "what is your name?",
		"comment allez-vous?": "how are you?",
		photosynthèse: "photosynthesis",
	},
};

// Language name mapping for better logging
const LANGUAGE_NAMES: Record<string, string> = {
	en: "English",
	es: "Spanish",
	fr: "French",
	de: "German",
	zh: "Chinese",
	ja: "Japanese",
	ko: "Korean",
	ar: "Arabic",
	auto: "Auto-detect",
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { text, sourceLanguage = "auto", targetLanguage } = body;

	if (!text) {
		error(400, "Missing required parameter: text");
	}

	if (!targetLanguage) {
		error(400, "Missing required parameter: targetLanguage");
	}

	try {
		console.log("[translation] Translating text:", {
			text: text.substring(0, 100),
			sourceLanguage,
			targetLanguage,
		});

		// Auto-detect source language (very naive implementation)
		let detectedSource = sourceLanguage;
		if (sourceLanguage === "auto") {
			// Naive language detection based on character sets
			if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) {
				detectedSource = "ja"; // Japanese/Chinese
			} else if (/[\u0600-\u06FF]/.test(text)) {
				detectedSource = "ar"; // Arabic
			} else if (/[àèéêëïôùûü]/i.test(text)) {
				detectedSource = "fr"; // French
			} else if (/[áéíóúñ¿¡]/i.test(text)) {
				detectedSource = "es"; // Spanish
			} else {
				detectedSource = "en"; // Default to English
			}
		}

		const translationKey = `${detectedSource}-${targetLanguage}`;
		const normalizedText = text.toLowerCase().trim();

		// Check if we have a mock translation
		let translatedText = MOCK_TRANSLATIONS[translationKey]?.[normalizedText];

		if (!translatedText) {
			// Generate a mock translation for development
			const sourceLang = LANGUAGE_NAMES[detectedSource] || detectedSource;
			const targetLang = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

			translatedText = `[Mock translation from ${sourceLang} to ${targetLang}: "${text}"]`;
			console.log(
				"[translation] No mock translation found, returning placeholder",
			);
		} else {
			console.log("[translation] Found mock translation for:", normalizedText);
		}

		return json({
			text,
			translatedText,
			sourceLanguage: detectedSource,
			targetLanguage,
		});
	} catch (e: any) {
		console.error(`[translation] Failed to translate text:`, e);
		error(500, `Translation failed: ${e.message}`);
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
