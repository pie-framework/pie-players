import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

/**
 * Timed media: cues that reveal and gate questions against a media timeline.
 *
 * The interesting parts are all visible in one section:
 *
 * - `tm-q1` is revealed by a `reveal` cue at 4s and playback continues.
 * - `tm-q2` is revealed by a `gate` cue at 10s that holds playback until the
 *   answer is correct, with `onUnknownCorrectness: "release"` stated rather than
 *   assumed.
 * - `cue-summary` is a `metadata` cue: a timeline marker that reveals nothing.
 * - `tm-q3` is named by no cue at all, so it is delivered normally from the start
 *   — the timeline sequences what it names and nothing else.
 *
 * The stimulus is a **passage**, not a media field on the section: a
 * `class: "stimulus"` rubric block whose PIE config mounts the media element.
 * `timedMedia` carries only `stimulusRef`, the cues and the policy. Here that
 * config is authored `<video>` markup with no PIE element in it, which is the
 * "a host supplies its own media element" case the Media Time Source port exists
 * for — the section adapts whatever media element the stimulus mounted and never
 * talks to a media library.
 *
 * The clip is a short lesson on the water cycle, and each cue lands inside the
 * slide that answers its question — so watching the stimulus is what makes the
 * questions answerable, which is the whole point of a timed-media section. A real
 * stimulus carries its captions and transcript on the passage, through the
 * accessibility-catalog rail the passage owns as a Catalog Owner.
 *
 * See `docs/prds/timed-media-section-contract.md`.
 */

const CLIP = "/demo-assets/timed-media/water-cycle-lesson.webm";
const CLIP_TYPE = "video/webm";

const choiceItem = (args: {
	itemId: string;
	modelId: string;
	prompt: string;
	choices: Array<{ value: string; label: string; correct: boolean }>;
}) => ({
	id: args.itemId,
	name: args.itemId,
	baseId: args.itemId,
	version: { major: 1, minor: 0, patch: 0 },
	config: {
		markup: `<multiple-choice id="${args.modelId}"></multiple-choice>`,
		elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
		models: [
			{
				id: args.modelId,
				element: "multiple-choice",
				prompt: args.prompt,
				choiceMode: "radio",
				choices: args.choices,
			},
		],
	},
});

export const demoTimedMediaSection: AssessmentSection = {
	identifier: "timed-media",
	title: "Timed Media",
	keepTogether: true,
	sectionType: "timed-media",

	// Unlimited Tries is not a stylistic choice here: a gate that releases on
	// correctness over an item with a finite Try budget is refused by validation,
	// because a learner who runs out of Tries could never release playback again.
	formative: {
		enabled: true,
		maxTries: "unlimited",
		feedback: "correctness",
	},

	rubricBlocks: [
		{
			identifier: "video-stimulus-1",
			class: "stimulus",
			view: ["candidate"],
			passage: {
				id: "passage-water-cycle-video",
				baseId: "passage-water-cycle-video",
				version: { major: 1, minor: 0, patch: 0 },
				name: "The water cycle",
				config: {
					// Sized inline rather than from a demo stylesheet: the markup is
					// sanitized and injected by the item player, so the passage carries
					// its own presentation instead of depending on a selector reaching
					// into it. `aspect-ratio` is not decoration — a `<video>` given a
					// percentage width and no height lays out at zero height in Chrome
					// until it decides to apply the intrinsic ratio, so the authored
					// ratio is what makes the stimulus visible on first paint.
					markup: `<div class="demo-timed-media-stimulus">
	<video
		class="demo-timed-media-video"
		controls
		preload="metadata"
		playsinline
		style="width: 100%; aspect-ratio: 427 / 240; max-height: 60vh; background: #000; border-radius: 4px;"
	>
		<source src="${CLIP}" type="${CLIP_TYPE}" />
	</video>
	<p class="demo-timed-media-alt">
		Text alternative for a video-only stimulus (WCAG 1.2.1): the clip is a silent
		slide deck. Title — The Water Cycle, module 2. Step 1, evaporation: the sun
		heats water in oceans and lakes, and liquid water turns into water vapour that
		rises into the air. Step 2, condensation: higher up the air is colder, so water
		vapour condenses onto tiny particles and forms clouds. Summary: evaporation,
		then condensation, then precipitation.
	</p>
</div>`,
					elements: {},
					models: [],
				},
			},
		},
	],

	assessmentItemRefs: [
		{
			identifier: "tm-q1",
			required: true,
			item: choiceItem({
				itemId: "tm-item-1",
				modelId: "tm-m1",
				prompt:
					"Revealed by a cue at 0:04 while the video keeps playing. What does the sun's heat do to water in oceans and lakes?",
				choices: [
					{ value: "a", label: "It evaporates into water vapour", correct: true },
					{ value: "b", label: "It freezes into ice crystals", correct: false },
					{ value: "c", label: "It condenses into clouds", correct: false },
					{ value: "d", label: "It falls as precipitation", correct: false },
				],
			}),
		},
		{
			identifier: "tm-q2",
			required: true,
			item: choiceItem({
				itemId: "tm-item-2",
				modelId: "tm-m2",
				prompt:
					"A gate cue at 0:10 pauses playback until this is correct. What happens when water vapour rises into colder air?",
				choices: [
					{ value: "a", label: "It condenses and forms clouds", correct: true },
					{ value: "b", label: "It evaporates a second time", correct: false },
					{ value: "c", label: "It is absorbed by the ocean", correct: false },
					{ value: "d", label: "Nothing changes until it rains", correct: false },
				],
			}),
		},
		{
			identifier: "tm-q3",
			required: true,
			item: choiceItem({
				itemId: "tm-item-3",
				modelId: "tm-m3",
				prompt:
					"Named by no cue, so it is delivered normally from the start. Which stage returns water to the surface?",
				choices: [
					{ value: "a", label: "Precipitation", correct: true },
					{ value: "b", label: "Evaporation", correct: false },
					{ value: "c", label: "Transpiration", correct: false },
					{ value: "d", label: "Condensation", correct: false },
				],
			}),
		},
	],

	timedMedia: {
		// No media payload: this names the stimulus renderable above, and resolution
		// is validated — a section carrying cues with no resolvable stimulus is
		// malformed rather than silently cue-less.
		stimulusRef: "video-stimulus-1",
		cues: [
			{
				identifier: "cue-first-step",
				range: { startSeconds: 4 },
				itemRefs: ["tm-q1"],
				policy: { activation: "reveal" },
			},
			{
				identifier: "cue-scrub-time",
				range: { startSeconds: 10 },
				itemRefs: ["tm-q2"],
				policy: {
					activation: "gate",
					releaseOn: "correct",
					// Stated, never defaulted: this item is auto-scorable, but the field
					// is what an author would set for one that is not.
					onUnknownCorrectness: "release",
				},
			},
			{
				identifier: "cue-summary",
				range: { startSeconds: 20, endSeconds: 24 },
				itemRefs: [],
				policy: { activation: "metadata" },
			},
		],
		playbackPolicy: {
			// A forward seek is clamped to the furthest position already reached, so
			// the timeline cannot be skipped past a gate.
			allowSeekAhead: false,
			pauseOnRequiredCue: true,
			requireMediaCompletion: false,
		},
		scoringPolicy: {
			// Accepted and persisted; PIE derives no aggregate outcome from it yet.
			strategy: "sum-child-outcomes",
		},
	},
};
