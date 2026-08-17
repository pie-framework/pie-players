/**
 * The locale roster the SchoolCity TTS service actually serves.
 *
 * The service is AWS Polly behind a two-route Fastify app, and it carries one
 * default voice per locale in `src/helpers/voices.js`. That map is the source of
 * truth transcribed here, and it does two jobs upstream: it supplies the
 * `VoiceId` when a request omits `voice`, and it gates `lang_id` — an
 * unrecognized `lang_id` is **silently rewritten to `en-US`** rather than
 * refused, so a caller asking for an unserved locale gets English audio and no
 * error. `isSupportedSchoolCityLanguage` exists so a caller can see that coming.
 *
 * Why a transcription rather than a lookup: the service exposes no voice or
 * locale endpoint. `GET /ping` and an authenticated `POST /` are the whole
 * surface, so there is nothing to query and this table is the only way a caller
 * can learn which locales exist. The cost is that it goes stale silently if the
 * service adds a locale — a deliberate trade, and the reason each entry is
 * traceable to a single upstream line rather than derived.
 *
 * Only the *default* voice per locale is listed. The service accepts any
 * `VoiceId` Polly knows, and `voices.js` names alternates for most locales in
 * trailing comments, so a per-locale voice roster is reachable — but it would be
 * assembled from hand-maintained comments rather than from the map the service
 * reads, so it is left out.
 */

import type { GetVoicesOptions, Voice } from "@pie-players/tts-server-core";

/** One locale the service serves, and the voice it speaks by default. */
export interface SchoolCityVoiceEntry {
	/** `lang_id` as the service spells it. */
	readonly languageCode: string;
	/**
	 * Display name, matching Polly's own `LanguageName` for the same voice so
	 * this provider and `tts-server-polly` agree on the label for one voice id.
	 */
	readonly language: string;
	/** Polly `VoiceId`, sent as `voice` when the caller names none. */
	readonly voiceId: string;
	/**
	 * Absent where the upstream map records no gender. `voices.js` annotates most
	 * locales with the female and male voices available, and two — `arb` and
	 * `cmn-CN` — carry no annotation at all. Inferring those from elsewhere would
	 * put a fact in this table that its source does not support, so they stay
	 * unset and a gender-filtered query does not return them.
	 */
	readonly gender?: "male" | "female";
}

/**
 * Transcribed from `sc-texttospeech-api/src/helpers/voices.js`, in upstream
 * order. Genders come from that file's own trailing comments.
 */
export const SCHOOLCITY_DEFAULT_VOICES: readonly SchoolCityVoiceEntry[] = [
	{ languageCode: "arb", language: "Arabic", voiceId: "Zeina" },
	{ languageCode: "cmn-CN", language: "Chinese Mandarin", voiceId: "Zhiyu" },
	{
		languageCode: "da-DK",
		language: "Danish",
		voiceId: "Naja",
		gender: "female",
	},
	{
		languageCode: "nl-NL",
		language: "Dutch",
		voiceId: "Lotte",
		gender: "female",
	},
	{
		languageCode: "en-AU",
		language: "Australian English",
		voiceId: "Nicole",
		gender: "female",
	},
	{
		languageCode: "en-GB",
		language: "British English",
		voiceId: "Amy",
		gender: "female",
	},
	{
		languageCode: "en-IN",
		language: "Indian English",
		voiceId: "Aditi",
		gender: "female",
	},
	{
		languageCode: "en-US",
		language: "US English",
		voiceId: "Salli",
		gender: "female",
	},
	{
		languageCode: "en-GB-WLS",
		language: "Welsh English",
		voiceId: "Geraint",
		gender: "male",
	},
	{
		languageCode: "fr-FR",
		language: "French",
		voiceId: "Mathieu",
		gender: "male",
	},
	{
		languageCode: "fr-CA",
		language: "Canadian French",
		voiceId: "Chantal",
		gender: "female",
	},
	{
		languageCode: "de-DE",
		language: "German",
		voiceId: "Vicki",
		gender: "female",
	},
	{
		languageCode: "hi-IN",
		language: "Hindi",
		voiceId: "Aditi",
		gender: "female",
	},
	{
		languageCode: "is-IS",
		language: "Icelandic",
		voiceId: "Dora",
		gender: "female",
	},
	{
		languageCode: "it-IT",
		language: "Italian",
		voiceId: "Bianca",
		gender: "female",
	},
	{
		languageCode: "ja-JP",
		language: "Japanese",
		voiceId: "Mizuki",
		gender: "female",
	},
	{
		languageCode: "ko-KR",
		language: "Korean",
		voiceId: "Seoyeon",
		gender: "female",
	},
	{
		languageCode: "nb-NO",
		language: "Norwegian",
		voiceId: "Liv",
		gender: "female",
	},
	{
		languageCode: "pl-PL",
		language: "Polish",
		voiceId: "Ewa",
		gender: "female",
	},
	{
		languageCode: "pt-BR",
		language: "Brazilian Portuguese",
		voiceId: "Vitoria",
		gender: "female",
	},
	{
		languageCode: "pt-PT",
		language: "Portuguese",
		voiceId: "Ines",
		gender: "female",
	},
	{
		languageCode: "ro-RO",
		language: "Romanian",
		voiceId: "Carmen",
		gender: "female",
	},
	{
		languageCode: "ru-RU",
		language: "Russian",
		voiceId: "Tatyana",
		gender: "female",
	},
	{
		languageCode: "es-ES",
		language: "Castilian Spanish",
		voiceId: "Conchita",
		gender: "female",
	},
	{
		languageCode: "es-MX",
		language: "Mexican Spanish",
		voiceId: "Mia",
		gender: "female",
	},
	{
		languageCode: "es-US",
		language: "US Spanish",
		voiceId: "Miguel",
		gender: "male",
	},
	{
		languageCode: "sv-SE",
		language: "Swedish",
		voiceId: "Astrid",
		gender: "female",
	},
	{
		languageCode: "tr-TR",
		language: "Turkish",
		voiceId: "Filiz",
		gender: "female",
	},
	{
		languageCode: "cy-GB",
		language: "Welsh",
		voiceId: "Gwyneth",
		gender: "female",
	},
];

/**
 * Every voice the service serves is a Polly *standard* voice: no `Engine` is
 * ever sent on the synthesis call, and standard is Polly's default.
 */
const SCHOOLCITY_VOICE_QUALITY = "standard" as const;

const normalizeTag = (tag: string): string =>
	tag.trim().toLowerCase().replace(/_/g, "-");

/**
 * RFC 4647 basic filtering: a range matches a tag it equals, or a tag it prefixes
 * at a subtag boundary. So `en` reaches every English locale and `en-GB` reaches
 * `en-GB-WLS`, while `en-G` reaches nothing.
 */
const languageMatches = (languageCode: string, filter: string): boolean => {
	const tag = normalizeTag(languageCode);
	const range = normalizeTag(filter);
	if (!range) return true;
	return tag === range || tag.startsWith(`${range}-`);
};

const toVoice = (entry: SchoolCityVoiceEntry): Voice => ({
	// The service identifies a voice by its Polly `VoiceId`, and that is what a
	// caller passes back as `SynthesizeRequest.voice`.
	id: entry.voiceId,
	name: entry.voiceId,
	language: entry.language,
	languageCode: entry.languageCode,
	...(entry.gender ? { gender: entry.gender } : {}),
	quality: SCHOOLCITY_VOICE_QUALITY,
	supportedFeatures: {
		// The service always sends `TextType: "ssml"`, so SSML is not optional here.
		ssml: true,
		emotions: false,
		styles: false,
	},
	providerMetadata: {
		/** This is the voice the service picks for the locale when none is named. */
		isServiceDefault: true,
	},
});

/** The service's roster as `Voice` records, narrowed by `options`. */
export const schoolCityVoices = (options?: GetVoicesOptions): Voice[] => {
	// Every entry is standard, so any other quality asks for a voice the service
	// cannot produce.
	if (options?.quality && options.quality !== SCHOOLCITY_VOICE_QUALITY) {
		return [];
	}
	return SCHOOLCITY_DEFAULT_VOICES.filter((entry) => {
		if (
			options?.language &&
			!languageMatches(entry.languageCode, options.language)
		) {
			return false;
		}
		if (options?.gender && entry.gender !== options.gender) return false;
		return true;
	}).map(toVoice);
};

/**
 * Whether the service serves this locale, matched exactly as `lang_id` is.
 *
 * Worth checking before synthesis: an unserved `lang_id` is not an error
 * upstream, it is English audio.
 */
export const isSupportedSchoolCityLanguage = (
	languageCode: string,
): boolean => {
	const tag = normalizeTag(languageCode);
	return SCHOOLCITY_DEFAULT_VOICES.some(
		(entry) => normalizeTag(entry.languageCode) === tag,
	);
};

/** The `VoiceId` the service would choose for a locale, if it serves it. */
export const defaultVoiceForSchoolCityLanguage = (
	languageCode: string,
): string | undefined => {
	const tag = normalizeTag(languageCode);
	return SCHOOLCITY_DEFAULT_VOICES.find(
		(entry) => normalizeTag(entry.languageCode) === tag,
	)?.voiceId;
};
