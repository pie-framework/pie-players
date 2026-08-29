import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

const VIDEO_STIMULUS_PACKAGE = "@pie-element/video-stimulus@0.1.0";
const VIDEO_SOURCE = "/video-stimulus/sample.webm";
const VIDEO_POSTER = "/video-stimulus/poster.svg";
const VIDEO_CAPTIONS = "/video-stimulus/captions-en.vtt";
const VIDEO_TRANSCRIPT =
	"Step one. Put on safety goggles before handling laboratory materials. Step two. Use heat-resistant gloves when touching a heated container. Step three. Place the container on a heat-safe surface, away from paper.";

/**
 * Package-backed proof for the video-stimulus timed-media seam.
 *
 * The passage config loads an exact package version and owns only accessible
 * media rendering. The section owns both cue-to-question links and playback
 * policy. Browser coverage routes that package spec to an extracted npm tarball
 * from the sibling pie-elements-ng checkout, never to a file or link dependency.
 */
export const demoTimedMediaVideoStimulusSection: AssessmentSection = {
	identifier: "timed-media-video-stimulus-package",
	title: "Timed Media with packaged video stimulus",
	keepTogether: true,
	sectionType: "timed-media",
	rubricBlocks: [
		{
			identifier: "lab-safety-video-stimulus",
			class: "stimulus",
			view: ["candidate"],
			passage: {
				id: "passage-lab-safety-video",
				baseId: "passage-lab-safety-video",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Lab safety demonstration",
				config: {
					markup: '<video-stimulus id="lab-safety-video"></video-stimulus>',
					elements: {
						"video-stimulus": VIDEO_STIMULUS_PACKAGE,
					},
					models: [
						{
							id: "lab-safety-video",
							element: "video-stimulus",
							media: {
								version: 1,
								id: "lab-safety-demonstration",
								kind: "video",
								sources: [{ src: VIDEO_SOURCE, type: "video/webm" }],
								poster: VIDEO_POSTER,
								durationSeconds: 12,
								tracks: [
									{
										src: VIDEO_CAPTIONS,
										kind: "captions",
										lang: "en",
										label: "English",
										default: true,
									},
								],
								transcript: { plainText: VIDEO_TRANSCRIPT, lang: "en" },
								label: "Lab safety demonstration",
								description:
									"Watch how the student prepares to handle a heated container safely.",
								lang: "en",
							},
							language: "en",
							accessibilityProfile: {
								audioContent: "meaningful",
								captionSupport: "track",
								visualSupport: "described",
							},
						},
					],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: "video-stimulus-q1",
			required: true,
			item: {
				id: "video-stimulus-item-1",
				baseId: "video-stimulus-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Safety equipment question",
				config: {
					markup:
						'<section data-video-stimulus-question="1"><p>Which piece of safety equipment should be put on before handling laboratory materials?</p><ul><li>Safety goggles</li><li>Paper gloves</li></ul></section>',
					elements: {},
					models: [],
				},
			},
		},
		{
			identifier: "video-stimulus-q2",
			required: true,
			item: {
				id: "video-stimulus-item-2",
				baseId: "video-stimulus-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Heated container question",
				config: {
					markup:
						'<section data-video-stimulus-question="2"><p>What should you wear when touching a heated container?</p><ul><li>Heat-resistant gloves</li><li>Safety goggles only</li></ul></section>',
					elements: {},
					models: [],
				},
			},
		},
	],
	timedMedia: {
		stimulusRef: "lab-safety-video-stimulus",
		cues: [
			{
				identifier: "lab-safety-goggles",
				range: { startSeconds: 1.5 },
				itemRefs: ["video-stimulus-q1"],
				policy: { activation: "reveal" },
			},
			{
				identifier: "lab-safety-gloves",
				range: { startSeconds: 5.5 },
				itemRefs: ["video-stimulus-q2"],
				policy: { activation: "reveal" },
			},
		],
		playbackPolicy: {
			allowSeekAhead: true,
			pauseOnRequiredCue: false,
			requireMediaCompletion: false,
		},
	},
};
