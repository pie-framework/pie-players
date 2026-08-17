/**
 * Dictionary lookup stub for the demos.
 *
 * A fixed corpus, not a dictionary service. PIE ships no dictionary endpoint — the
 * corpus behind one is licensed per programme — so this exists to exercise the tool's
 * states in the demo app and in e2e: a hit, a miss, and a failure.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

interface Sense {
	partOfSpeech?: string;
	definition: string;
	example?: string;
}

const CORPUS: Record<string, { pronunciation?: string; senses: Sense[] }> = {
	photosynthesis: {
		pronunciation: "ˌfəʊtəʊˈsɪnθəsɪs",
		senses: [
			{
				partOfSpeech: "noun",
				definition:
					"The process by which a plant uses sunlight to turn water and carbon dioxide into food.",
				example: "Leaves are where most photosynthesis happens.",
			},
		],
	},
	evidence: {
		pronunciation: "ˈɛvɪdəns",
		senses: [
			{
				partOfSpeech: "noun",
				definition: "Facts or signs that show whether something is true.",
				example: "She used two quotations as evidence.",
			},
		],
	},
	reason: {
		pronunciation: "ˈriːzən",
		senses: [
			{
				partOfSpeech: "noun",
				definition: "A cause or explanation for something.",
				example: "Give a reason for your answer.",
			},
			{
				partOfSpeech: "verb",
				definition: "To think about something in a logical way.",
			},
		],
	},
	current: {
		senses: [
			{
				partOfSpeech: "noun",
				definition: "A flow of water, air, or electricity in one direction.",
			},
			{
				partOfSpeech: "adjective",
				definition: "Happening now.",
			},
		],
	},
	// Words the demo passage actually contains, so the selection door has something to
	// answer when a learner picks a word out of the text rather than typing one.
	glucose: {
		pronunciation: "ˈɡluːkəʊz",
		senses: [
			{
				partOfSpeech: "noun",
				definition: "A simple sugar that living things use for energy.",
				example: "Plants store glucose made during photosynthesis.",
			},
		],
	},
	chloroplasts: {
		senses: [
			{
				partOfSpeech: "noun",
				definition:
					"The parts of a plant cell where photosynthesis takes place.",
			},
		],
	},
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		keyword?: unknown;
		max?: unknown;
	};
	const keyword =
		typeof body.keyword === "string" ? body.keyword.trim().toLowerCase() : "";

	// A reserved word for driving the error state, so the demo and e2e can reach it
	// without taking the dev server down.
	if (keyword === "servicefailure") {
		return json({ message: "Simulated dictionary failure." }, { status: 503 });
	}

	const entry = CORPUS[keyword];
	if (!entry) return json({ entries: [] });

	const max = typeof body.max === "number" && body.max > 0 ? body.max : 6;
	return json({
		entries: [
			{ word: keyword, pronunciation: entry.pronunciation, senses: entry.senses },
		].slice(0, max),
	});
};
