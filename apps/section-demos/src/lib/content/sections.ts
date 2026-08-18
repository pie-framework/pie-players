import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { demo1Section } from "./demo1-single-question";
import { demo2Section } from "./demo2-question-passage";
import { demo3Section } from "./demo3-three-questions";
import { demo4Section } from "./demo4-tts-ssml";
import { demo5Section } from "./demo5-resource-observability";
import { demo6Section } from "./demo6-tabbed-layout";
import { demo7Section } from "./demo7-heading-accessibility";
import { demo8ToolVisibilitySection } from "./demo8-tool-visibility";
import { demo9Section } from "./demo9-preloaded-fixed-elements";
import { demo10TtsGeneratedSsmlSection } from "./demo10-tts-generated-ssml";
import { demo11TtsToggleSpeedSection } from "./demo11-tts-toggle-speed";
import { metadataSessionForwardingSection } from "./demo-metadata-session-forwarding";
import { pie512SectionA, pie512SectionB } from "./pie-512-asymmetric-sections";
import { demoKeyboardNavMcEbsrSection } from "./demo-keyboard-nav-mc-ebsr";
import {
	demoSignLanguageGrantedSection,
	demoSignLanguageNotGrantedSection,
	demoSignLanguagePassageSection,
} from "./demo-sign-language";
import { demoReadAloudAccommodationsSection } from "./demo-read-aloud-accommodations";
import { demoTwoPassagesSection } from "./demo-two-passages";
import { demoPrintShowcaseSection } from "./demo-print-showcase";
import { demoFormativeDeliverySection } from "./demo-formative-delivery";
import { demoTimedMediaSection } from "./demo-timed-media";
import { demoInterfaceLocaleSection } from "./demo-interface-locale";

export interface SectionDemoInfo {
	id: string;
	name: string;
	description: string;
	integrationLevel?: number;
	integrationTheme?: string;
	focus?: string;
	whatMakesItTick?: string[];
	allowElementVersionOverrides?: boolean;
	section?: AssessmentSection;
	sections?: Array<{
		id: string;
		name: string;
		section: AssessmentSection;
	}>;
}

const sessionPersistencePageOne: AssessmentSection = {
	identifier: "session-persistence-page-one",
	title: "Dutch Golden Age: Trade and Cities",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "sp1-passage-dutch-trade",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "sp1-passage-dutch-trade",
				name: "The Dutch Republic and Maritime Trade",
				baseId: "sp1-passage-dutch-trade",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>The Dutch Republic and Maritime Trade</h2>
            <p>
              In the 1600s, the Dutch Republic became one of the most commercially powerful regions in Europe.
              Its merchants built large shipping networks that connected the Baltic, Atlantic, and Indian Ocean worlds.
              Amsterdam's harbor and financial institutions helped merchants invest in long-distance voyages with lower risk.
            </p>
            <p>
              A major institution in this period was the Dutch East India Company (VOC), chartered in 1602. The VOC could
              make treaties, maintain military forces, and establish fortified trading posts. Through these powers, the company
              gained strong control over the spice trade in parts of Southeast Asia and generated large profits for investors.
            </p>
            <p>
              Dutch success depended not only on overseas trade, but also on efficient domestic systems. Canals, warehouses,
              insurance markets, and shipbuilding yards supported a steady movement of goods and information. Historians often
              describe this as an early form of global capitalism, where trade, finance, and state policy worked closely together.
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
			identifier: "sp1-q1",
			required: true,
			item: {
				id: "sp1-item-1",
				baseId: "sp1-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 1",
				config: {
					markup: '<multiple-choice id="sp1q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q1",
							element: "multiple-choice",
							prompt:
								"According to the passage, which institution helped Amsterdam merchants reduce the risk of long-distance voyages?",
							choiceMode: "radio",
							choices: [
								{ value: "a", label: "City guild courts", correct: false },
								{
									value: "b",
									label: "Harbor and financial institutions in Amsterdam",
									correct: true,
								},
								{ value: "c", label: "Local church councils", correct: false },
								{ value: "d", label: "Spanish tax offices", correct: false },
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp1-q2",
			required: true,
			item: {
				id: "sp1-item-2",
				baseId: "sp1-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 2",
				config: {
					markup: '<multiple-choice id="sp1q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q2",
							element: "multiple-choice",
							prompt:
								"What was one important power granted to the VOC, based on the passage?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "It could establish fortified trading posts",
									correct: true,
								},
								{
									value: "b",
									label: "It could appoint the Holy Roman Emperor",
									correct: false,
								},
								{
									value: "c",
									label: "It could ban all private merchants in Europe",
									correct: false,
								},
								{
									value: "d",
									label: "It could mint coins for all kingdoms",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp1-q3",
			required: true,
			item: {
				id: "sp1-item-3",
				baseId: "sp1-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 1 Item 3",
				config: {
					markup: '<multiple-choice id="sp1q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp1q3",
							element: "multiple-choice",
							prompt:
								"Which statement best summarizes the passage's explanation of Dutch commercial success?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "It depended only on military conquest in Europe",
									correct: false,
								},
								{
									value: "b",
									label:
										"It combined overseas trade with strong domestic logistics and finance",
									correct: true,
								},
								{
									value: "c",
									label: "It was mostly caused by agricultural reforms",
									correct: false,
								},
								{
									value: "d",
									label: "It relied on support from the Spanish crown",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
	],
};

const sessionPersistencePageTwo: AssessmentSection = {
	identifier: "session-persistence-page-two",
	title: "Dutch Golden Age: Art, Society, and Power",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "sp2-passage-dutch-art",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "sp2-passage-dutch-art",
				name: "Art and Society in the Dutch Golden Age",
				baseId: "sp2-passage-dutch-art",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<div class="passage">
            <h2>Art and Society in the Dutch Golden Age</h2>
            <p>
              The Dutch Golden Age was not only an era of trade, but also a period of remarkable artistic production.
              Painters such as Rembrandt van Rijn, Johannes Vermeer, and Frans Hals became known for realistic portraits,
              domestic interiors, and scenes of everyday life. Their works reflected urban culture in the Dutch Republic,
              where a prosperous middle class purchased art for private homes.
            </p>
            <p>
              Unlike courts in some other European states, the Dutch Republic had no single royal patron directing most artistic
              commissions. Instead, artists often worked for an open market. This encouraged variety in subject matter: group
              portraits, landscapes, still lifes, and genre scenes all became popular. Paintings frequently communicated values
              such as thrift, diligence, and civic responsibility.
            </p>
            <p>
              At the same time, the wealth that supported cultural life was connected to global commercial networks, including
              colonial expansion and coercive labor systems. Historians therefore study the Dutch Golden Age as both a creative
              cultural moment and a period shaped by unequal power relationships across regions.
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
			identifier: "sp2-q1",
			required: true,
			item: {
				id: "sp2-item-1",
				baseId: "sp2-item-1",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 1",
				config: {
					markup: '<multiple-choice id="sp2q1"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q1",
							element: "multiple-choice",
							prompt:
								"According to the passage, what distinguished the Dutch art market from court-centered systems in other states?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"Artists sold to a broader market rather than mainly to one royal patron",
									correct: true,
								},
								{
									value: "b",
									label:
										"Only religious institutions were allowed to buy paintings",
									correct: false,
								},
								{
									value: "c",
									label: "The state banned landscapes and still lifes",
									correct: false,
								},
								{
									value: "d",
									label:
										"Artists were required to paint military victories only",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp2-q2",
			required: true,
			item: {
				id: "sp2-item-2",
				baseId: "sp2-item-2",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 2",
				config: {
					markup: '<multiple-choice id="sp2q2"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q2",
							element: "multiple-choice",
							prompt:
								"Which interpretation best matches the final paragraph of the passage?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label:
										"The period should be seen only as a neutral artistic movement",
									correct: false,
								},
								{
									value: "b",
									label:
										"Cultural achievements and global inequalities are both necessary to understanding the era",
									correct: true,
								},
								{
									value: "c",
									label:
										"Art in the Dutch Republic was disconnected from economic systems",
									correct: false,
								},
								{
									value: "d",
									label:
										"Colonial expansion ended before artistic growth began",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "sp2-q3",
			required: true,
			item: {
				id: "sp2-item-3",
				baseId: "sp2-item-3",
				version: { major: 1, minor: 0, patch: 0 },
				name: "Page 2 Item 3",
				config: {
					markup: '<multiple-choice id="sp2q3"></multiple-choice>',
					elements: {
						"multiple-choice": "@pie-element/multiple-choice@latest",
					},
					models: [
						{
							id: "sp2q3",
							element: "multiple-choice",
							prompt:
								"Which pair of artists is explicitly identified in the passage as associated with Dutch Golden Age painting?",
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "Rembrandt van Rijn and Johannes Vermeer",
									correct: true,
								},
								{
									value: "b",
									label: "Raphael and Michelangelo",
									correct: false,
								},
								{
									value: "c",
									label: "El Greco and Caravaggio",
									correct: false,
								},
								{ value: "d", label: "Titian and Botticelli", correct: false },
							],
						},
					],
				},
			},
		},
	],
};

export const sectionDemos: Record<string, SectionDemoInfo> = {
	"single-question": {
		id: "single-question",
		name: "Single Question",
		description: "Section with one multiple choice question",
		integrationLevel: 1,
		integrationTheme: "CE defaults",
		focus:
			"The smallest section-player setup: one item in one section, useful for verifying baseline rendering and session wiring.",
		whatMakesItTick: [
			"Single `assessmentItemRefs` entry keeps section composition minimal.",
			"Standard multiple-choice PIE element mapping (`@pie-element/multiple-choice@latest`).",
			"Uses shared route controls (mode/layout/player) without extra persistence complexity.",
		],
		section: demo1Section,
	},
	"quiz-engine-nds-icon": {
		id: "quiz-engine-nds-icon",
		name: "Quiz Engine NDS Icon",
		description:
			"Section player with the NDS icon buttons opted in via the `nds-icons` attribute",
		integrationLevel: 1,
		integrationTheme: "NDS icon opt-in",
		focus:
			"Shows the vendored `<nds-icon-button>` rendering for the toolbar tools (calculator), the calculator shell controls, the inline text-to-speech trigger, and the section scroll-hint. Identical to Single Question except the player element carries `nds-icons={true}`; every other demo omits it and renders plain `<button>`s.",
		whatMakesItTick: [
			"`nds-icons={true}` on the `<pie-section-player-*>` element is folded into the runtime and surfaced on the toolkit runtime context, so consumers render `<nds-icon-button>` instead of plain buttons.",
			"Opt-in with presence semantics: omit the attribute (the default) for plain buttons; `runtime.ndsIcons` still works and wins when both are set.",
			"`calculator` is placed on the item toolbar so both the NDS toolbar button and its NDS-styled floating shell controls are visible.",
			"Inline text-to-speech renders its NDS circular play/pause trigger.",
		],
		section: demo1Section,
	},
	"question-passage": {
		id: "question-passage",
		name: "Question with Passage",
		description: "Section with illustrated passage and related question",
		integrationLevel: 2,
		integrationTheme: "CE tool configuration",
		focus:
			"Shows how a stimulus passage and an associated item are authored and rendered together in one section, and exercises the PIE-94 horizontal-scroll wrapper for an intentionally overwide authored image.",
		whatMakesItTick: [
			"Passage content is supplied through `rubricBlocks` as a stimulus block.",
			"Item and passage coexist in section JSON so layout and reading flow can be tested.",
			"Passage markup embeds a 1792×592 Renaissance timeline image to verify `.pie-image-scroll` kicks in inside narrow columns and at 400% browser zoom (WCAG 1.4.10 Reflow).",
			"Shared demo host allows switching between student/scorer and splitpane/vertical layouts.",
		],
		section: demo2Section,
	},
	"interface-locale": {
		id: "interface-locale",
		name: "Interface Locale (nl-NL switcher)",
		description:
			"The only demo that supplies a `locale`: switch the player's own chrome between English and Dutch while the authored content stays put",
		integrationLevel: 2,
		integrationTheme: "Interface locale",
		focus:
			"Shows what a host's `locale` reaches and what it deliberately does not. Toolbar names, tool windows, card headings and live-region text follow the catalog; the passage and the questions are authored content and never move.",
		whatMakesItTick: [
			"`locale` on the `<pie-section-player-*>` element, taken from this demo's `?locale=` param. Every other demo omits the attribute, so they render the English a host with no locale gets — which is also what makes this one worth visiting deliberately.",
			"The catalog is a lazily imported chunk, so the first paint is English and the Dutch strings arrive a tick later; the toolbar and the open tool windows both have to follow that republish.",
			"Tool windows mount at `document.body`, outside the player's DOM. The toolbar re-publishes the runtime context on each shell so a shelled tool — theme, graph, periodic table, calculator — resolves the same provider as the chrome around it.",
			"Content language is a separate channel: the English passage and stems are unchanged by the switcher, and translating them would mean authoring a second item rather than adding a catalog key.",
		],
		section: demoInterfaceLocaleSection,
	},
	"two-passages": {
		id: "two-passages",
		name: "Two Passages with One Question",
		description:
			"Section with two stimulus passages stacked together, followed by a single comparison question",
		integrationLevel: 2,
		integrationTheme: "Multi-passage sections",
		focus:
			"Verifies that multiple stimulus passages render correctly in one section and that a question can ask the reader to reason across both.",
		whatMakesItTick: [
			"Two `rubricBlocks` entries, each carrying its own stimulus passage.",
			"One multiple-choice item asking the reader to synthesize across both passages.",
			"Useful for exercising layout and toolbar behavior when more than one passage is present.",
		],
		section: demoTwoPassagesSection,
	},
	"preloaded-fixed-elements": {
		id: "preloaded-fixed-elements",
		name: "Preloaded Fixed Element Versions",
		description:
			"Section with a PIE passage, multiple-choice item, and categorize item loaded through one fixed preloaded bundle",
		integrationLevel: 3,
		integrationTheme: "Preloaded fixed versions",
		focus:
			"Shows how a host can preload the exact PIE element bundle set a section needs and render the section-player with fixed item-player versions instead of `@latest`.",
		whatMakesItTick: [
			"Pins `@pie-element/passage@5.3.3`, `@pie-element/multiple-choice@11.4.3`, and `@pie-element/categorize@11.3.2` directly in `config.elements`.",
			'Defaults the demo route to `player-type="preloaded"`, so the host loads one bundle before rendering the section-player.',
			"Keeps authored markup IDs and logical tag names stable; the player derives runtime versioned custom-element tags from the pinned package specs.",
			"Disables section-demos element-version URL overrides so the pinned package specs remain the demo's source of truth.",
		],
		allowElementVersionOverrides: false,
		section: demo9Section,
	},
	"metadata-session-forwarding": {
		id: "metadata-session-forwarding",
		name: "Metadata Session Forwarding (Regression Fixture)",
		description:
			"Local fixture for responseful session state followed by a metadata-only unchanged-session echo",
		integrationLevel: 5,
		integrationTheme: "Regression fixture",
		focus:
			"Reproduces metadata-only `session-changed` forwarding after the canonical item session data is already responseful and unchanged.",
		whatMakesItTick: [
			"Uses a route-local preloaded custom element so no external PIE bundle is fetched.",
			"Seeds a responseful item session, then emits a wrapped identity-only metadata echo from the child fixture.",
			"Verifies the section/toolkit public `session-changed` surface receives the metadata-only event without treating it as response data.",
		],
		allowElementVersionOverrides: false,
		section: metadataSessionForwardingSection,
	},
	"sign-language": {
		id: "sign-language",
		name: "Sign Language (ASL) Region",
		description:
			"Signed alternates rendered in the item card's media region, gated on the signLanguage PNP support — one page with the accommodation granted, one without",
		integrationLevel: 4,
		integrationTheme: "Accessibility catalogs",
		focus:
			"Validates that signing shows only when the item carries a matching sign-language catalog card AND policy grants eligibility — both halves required, neither a default.",
		whatMakesItTick: [
			"A signed alternate arrives only as a catalog card. The first item authors one by hand on `accessibilityCatalogs` with a typed media payload; nothing lifts a signing video out of item markup at render time.",
			"The second item carries no signing content and shows no region, because an affordance where no content exists is a dead affordance.",
			"`?page=` switches between a PNP that grants `signLanguage` and one that does not; signing is excluded from the computed default profile, so it is never on by accident.",
			"The third item is not authored at all: it is the verbatim output of the Learnosity import in `pie-api-aws`, so the demo shows what an importer writes rather than what we believe it writes.",
			"A third page authors the alternate on a shared passage instead of an item; it renders on the passage card, from the same card model and the same host surface.",
			"The bundled clip is a real public-domain ASL recording that does not sign these prompts — a stand-in, since ASL video production and hosting are host-owned. See `static/demo-assets/sign-language/README.md`.",
		],
		sections: [
			{
				id: "signing-granted",
				name: "Signing granted",
				section: demoSignLanguageGrantedSection,
			},
			{
				id: "signing-not-granted",
				name: "Signing not granted",
				section: demoSignLanguageNotGrantedSection,
			},
			{
				id: "signing-passage",
				name: "Signed passage",
				section: demoSignLanguagePassageSection,
			},
		],
	},
	"three-questions": {
		id: "three-questions",
		name: "Three Questions",
		description: "Section with multiple questions in sequence",
		integrationLevel: 3,
		integrationTheme: "Host coordinator wiring",
		focus:
			"Exercises multi-item sequencing and navigation behavior within a single section attempt.",
		whatMakesItTick: [
			"Three distinct item refs in one section validate progression and state accumulation.",
			"Same host toolchain as other demos enables easy side-by-side behavior comparison.",
			"Useful baseline before testing advanced persistence or server-hydration flows.",
		],
		section: demo3Section,
	},
	"keyboard-nav-mc-ebsr": {
		id: "keyboard-nav-mc-ebsr",
		name: "Keyboard Nav in MC and EBSR",
		description:
			"Two multiple-choice and two EBSR items built around a WCAG keyboard-navigation passage — exercises radio roving-tabindex, checkbox Space-toggle, focus visibility, and accessible naming rules",
		integrationLevel: 3,
		integrationTheme: "Mixed element types",
		focus:
			"Validates that multiple-choice (radio) and EBSR (Part A radio + Part B checkbox) items render and respond to keyboard interaction correctly in a single section.",
		whatMakesItTick: [
			"Mixes `@pie-element/multiple-choice` (single-select radio) and `@pie-element/ebsr` (two-part radio + checkbox) in one section.",
			"All questions reference a shared WCAG keyboard-accessibility passage so content and interaction type reinforce each other.",
			"Pinned element versions (`multiple-choice@13.2.0-next.19`, `ebsr@14.2.0-next.19`) make this a reliable regression fixture for those pre-release builds.",
		],
		section: demoKeyboardNavMcEbsrSection,
	},
	"print-showcase": {
		id: "print-showcase",
		name: "Print Showcase (pie-print-player)",
		description:
			"Renders a section's stimulus + items through @pie-players/pie-print-player (non-interactive print view), loading the ng browser print bundles. Toggle Student/Instructor to reveal the answer key, and Transcript granted to print question 1's audio transcript as an accommodation.",
		integrationLevel: 3,
		integrationTheme: "Print rendering",
		focus:
			"Validates that the new ng browser print bundles (dist/browser/print/index.js) render correctly through the standalone print player, since the section player itself has no print view.",
		whatMakesItTick: [
			"Composes each `rubricBlock` passage and `assessmentItemRef` item into a `<pie-print>` config ({ item, options: { role }, accessibility }).",
			"Question 1 carries a `transcript` accessibility catalog card on its model, so `Transcript granted` is the whole difference between an accommodation reaching paper and not — resolved by the same capability and precedence the section player uses.",
			"Uses the print player's default resolver, which loads `dist/browser/print/index.js` via the browser-esm loader (React import map injected).",
			"Pins verified ng bundles: `passage@7.1.2-next.5`, `multiple-choice@13.2.2-next.5`, `ebsr@14.2.2-next.5`.",
		],
		allowElementVersionOverrides: false,
		section: demoPrintShowcaseSection,
	},
	"formative-delivery": {
		id: "formative-delivery",
		name: "Formative Delivery (check answer, retry, mastery)",
		description:
			"Check-answer delivery driven entirely by the section's `formative` policy: Try counts, feedback reveal, and per-item overrides. Four items show the four policy shapes side by side.",
		integrationLevel: 2,
		integrationTheme: "Formative delivery",
		focus:
			"Shows that PIE renders no feedback of its own — a reveal projects `mode: \"evaluate\"` onto that one item and the element draws the rest, which is why the behavior needed no new evaluation machinery.",
		whatMakesItTick: [
			"`section.formative` sets the default (three Tries, correctness feedback); each `assessmentItemRefs[].formative` overrides it field by field.",
			"A check calls the item player's existing `provideScore()` and reports the outcomes; the section controller derives correctness and owns Try state.",
			"Only the revealed item's `env` becomes `mode: \"evaluate\"` — its neighbours stay editable, which is the per-item seam the section env never had.",
			"`fd-q2` uses `feedback: \"solution\"`, so its reveal projects `role: \"instructor\"` and the element shows the authored correct response.",
			"`fd-q3` uses `revealOn: \"on-final-try\"`: the first two checks record a Try and reveal nothing.",
			"`fd-q4` sets `enabled: false`, so one ordinary item sits inside a formative section with no control at all.",
		],
		section: demoFormativeDeliverySection,
	},
	"timed-media": {
		id: "timed-media",
		name: "Timed Media (cue-driven questions over a video)",
		description:
			"A video stimulus whose timeline reveals and gates questions: one reveal cue, one gate cue that holds playback until the answer is correct, one metadata marker, and one item no cue names.",
		integrationLevel: 2,
		integrationTheme: "Timed media delivery",
		focus:
			"Shows that the section reaches media only through the Media Time Source port. The stimulus here is authored `<video>` markup with no PIE element in it, so the port is exercised by the exact case it exists for: a host supplying its own media element.",
		whatMakesItTick: [
			"The stimulus is a `class: \"stimulus\"` rubric block whose passage config mounts the media element; `timedMedia` carries only `stimulusRef`, the cues and the policy.",
			"`cue-first-step` reveals `tm-q1` at 0:04 and playback continues; a revealed card is mounted-and-hidden until its cue fires, so its session and shell registration survive a seek backwards.",
			"`cue-scrub-time` gates `tm-q2` at 0:10: playback pauses, focus moves to the card, and only a correct answer releases it — the condition names the formative `FormativeCorrectness` vocabulary rather than defining its own.",
			"`onUnknownCorrectness` is stated explicitly, because an item no controller can score has to have an authored answer rather than being treated as wrong.",
			"`allowSeekAhead: false` clamps a forward seek to the furthest position reached, which is what stops a learner scrubbing past a gate.",
			"`tm-q3` is named by no cue, so the timeline sequences what it names and leaves everything else alone.",
		],
		section: demoTimedMediaSection,
	},
	"invalid-tools-config": {
		id: "invalid-tools-config",
		name: "Invalid Tools Config (Error Surfacing)",
		description:
			"Intentionally malformed tools config shape to validate framework-owned diagnostics and user-facing error surfacing.",
		integrationLevel: 4,
		integrationTheme: "Validation diagnostics",
		focus:
			"Proves malformed host tools-config is validated and surfaced by the framework (console + UI + framework-error event) without host pre-validation.",
		whatMakesItTick: [
			"Uses an intentionally wrong nesting shape (`placement.section` as an object instead of array) to emulate common host wiring mistakes.",
			"Shows deterministic framework error fallback UI and event diagnostics driven by toolkit initialization.",
			"Designed as the canonical e2e target for config-error surfacing checks.",
		],
		section: demo3Section,
	},
	"pnp-default-on": {
		id: "pnp-default-on",
		name: "PNP Default On (Auto-detect)",
		description:
			"Smoke fixture: an assessment that carries profile policy material auto-promotes `pnpEnforcement` to 'on' without an explicit `pnp-enforcement` attribute.",
		integrationLevel: 4,
		integrationTheme: "Tool policy engine",
		focus:
			"Proves the M8 PR 4 narrow auto-on rule end-to-end: bind an `AssessmentEntity` with PNP / district policy through `coord.updateAssessment(...)` and the coordinator flips PNP/profile gates on by itself.",
		whatMakesItTick: [
			"Listens for `toolkit-ready` and binds an assessment with `personalNeedsProfile.supports = ['graph']` and `districtPolicy.requiredTools = ['graph']`.",
			"Never sets the `pnp-enforcement` attribute, so the auto-default rule (`assessmentHasPnpPolicyInputs` / `itemRefHasPnpPolicyInputs`) decides.",
			"Reads back `coord.getPolicyInputs().pnpEnforcement` and the engine's `decideToolPolicy(...)` so the resolved mode is visible in the page.",
		],
		section: demo1Section,
	},
	"dictionary-tools": {
		id: "dictionary-tools",
		name: "Dictionary and Picture Dictionary",
		description:
			"Word and picture lookup from host-supplied services, granted through the PNP rather than universally.",
		integrationLevel: 4,
		integrationTheme: "Host-supplied tool services",
		focus:
			"Shows the two entry points a lookup tool needs: a term handed in from a selection, and a field for the learner who cannot make one.",
		whatMakesItTick: [
			"Supplies each tool's endpoint through `runtime.toolContextResolvers`, the same per-tool params seam a real host uses; with no endpoint the panel reports itself unconfigured instead of failing silently.",
			"Grants both tools through `personalNeedsProfile.supports`, because PIE declares no universal support id for either — a dictionary is construct-relevant on a vocabulary item.",
			"Serves a fixed stub corpus from this app, including a reserved keyword that answers 503 so the error state is reachable.",
		],
		section: demo3Section,
	},
	"custom-tools": {
		id: "custom-tools",
		name: "Custom Tools (Host Registry)",
		description:
			"Host-provided custom tools via toolRegistry and hostButtons without publishing new packages",
		integrationLevel: 4,
		integrationTheme: "Host custom toolbar integration",
		focus:
			"Demonstrates additive host-side tool extension with one item-level and one section-level custom tool.",
		whatMakesItTick: [
			"Injects a host-owned ToolRegistry into section-player (`toolRegistry` prop).",
			"Adds an item/passage word counter tool with read-only word and character metrics.",
			"Adds a section metadata panel tool with stable read-only session details.",
		],
		section: demo3Section,
	},
	"tool-visibility": {
		id: "tool-visibility",
		name: "Tool Visibility from Item Data",
		description:
			"Host policy and registry wiring that shows a basic calculator, scientific calculator, or no calculator based on item data",
		integrationLevel: 4,
		integrationTheme: "Host data-driven tool policy",
		focus:
			"Demonstrates how hosts can decide whether a tool is available from item-level metadata without baking host business rules into section-player.",
		whatMakesItTick: [
			"Item refs carry neutral demo-owned `toolMetadata.calculator` values: `basic`, `scientific`, or omitted.",
			"A host-owned ToolRegistry override updates calculator labels and constrains each calculator element to the requested type.",
			"A custom PolicySource removes calculator from untagged item scopes before toolbar rendering.",
			"The same registry is passed to `createToolsConfig`, `ToolkitCoordinator`, and the section-player element.",
		],
		section: demo8ToolVisibilitySection,
	},
	"tts-ssml": {
		id: "tts-ssml",
		name: "TTS with SSML",
		description:
			"Focused TTS demo for SSML-driven pacing, emphasis, dates, acronyms, and provider-backed speech",
		integrationLevel: 4,
		integrationTheme: "SSML TTS controls",
		focus:
			"Demonstrates practical authored SSML controls for assessment passages and prompts.",
		whatMakesItTick: [
			"Defaults to a server-side SC proxy (`/api/tts/sc`) so auth remains off the client.",
			"Uses SSML-rich passage and item content for math pacing, emphasized instructions, dates, and acronyms.",
			"Toolkit tool config enables `textToSpeech` in item and passage placements.",
		],
		section: demo4Section,
	},
	"read-aloud-accommodations": {
		id: "read-aloud-accommodations",
		name: "Read-Aloud: suppression and recorded audio",
		description:
			"Content shown but never spoken, and `spoken` cards that carry a recording instead of a script",
		integrationLevel: 4,
		integrationTheme: "Accessibility catalogs",
		focus:
			"Shows the two things read-aloud does beyond synthesizing visible text: withholding content whose reading is the construct, and playing authored audio in place of synthesis.",
		whatMakesItTick: [
			'Item 1 marks one word `data-tts-suppress="all"`. Read-aloud speaks the rest of the prompt and the options but not that word, because the item measures whether the candidate can read it — an item-level read-aloud switch would have taken the directions away too.',
			"Item 2's `spoken` card carries an audio payload rather than a script, so the clip plays and the prompt highlights as a block: a recording emits no word boundaries, and timing them from its duration would highlight the wrong words confidently.",
			"Item 3 carries a recording *and* a script on the same node in the same language — APIP's pattern, which QTI's migration guidance keeps. Nothing distinguishes them but the slot each fills, and resolution prefers the recording.",
			"Item 4 points at a URL that 404s, so the fallback is observable: read-aloud speaks the script and says why in the console. Silence on a read-aloud node is the one failure a candidate cannot report.",
			"Worth doing by hand: select the suppressed word and use the annotation toolbar's read-aloud. It refuses — that path passes `range.toString()` straight to the provider and consults no catalog, so filtering only the DOM walk would leave selecting the word as a way around the guard.",
			"The narration is macOS `say` output, not human recording — it proves the file-playback path, not the fidelity of anyone's narration. See `static/demo-assets/read-aloud/README.md`.",
		],
		section: demoReadAloudAccommodationsSection,
	},
	"tts-generated-ssml": {
		id: "tts-generated-ssml",
		name: "TTS with Generated SSML",
		description:
			"Same content as the SSML demo, but with no authored SSML — the toolkit generates math SSML on the fly",
		integrationLevel: 4,
		integrationTheme: "Generated (on-the-fly) SSML TTS",
		focus:
			"Demonstrates PIE-native generation of math speech SSML for items that ship MathML but no authored `accessibilityCatalogs`, mirroring the `tts-ssml` demo content for an authored-vs-generated comparison.",
		whatMakesItTick: [
			"Reuses the `tts-ssml` quadratic content (passage, method-selection question, response directions) verbatim, minus every `<speak>` catalog and `data-catalog-idref` anchor.",
			"Defaults to the SSML-capable AWS Polly transport (`/api/tts`) so generated math SSML is actually voiced; non-SSML providers fall back to plain text.",
			"Toolkit tool config enables `textToSpeech` in item and passage placements.",
		],
		section: demo10TtsGeneratedSsmlSection,
	},
	"tts-toggle-speed": {
		id: "tts-toggle-speed",
		name: "TTS Toggle Speed Customization",
		description:
			"Host-owned custom TTS controls that preserve the old speed-toggle interaction",
		integrationLevel: 4,
		integrationTheme: "Host custom TTS controls",
		focus:
			"Shows how a host can keep the old speed-toggle UX as a customization while the packaged inline TTS tool uses radio-style speed selection.",
		whatMakesItTick: [
			"Overrides only the `textToSpeech` tool registration in the demo-local `ToolRegistry`.",
			"Preserves the packaged TTS provider setup and section-player integration.",
			"Renders demo-owned speed buttons with `aria-pressed`; clicking an active speed resets playback to normal `1.0x`.",
			"Does not add a toggle mode back to `@pie-players/pie-tool-tts-inline`.",
		],
		section: demo11TtsToggleSpeedSection,
	},
	"tabbed-layout": {
		id: "tabbed-layout",
		name: "Tabbed Layout",
		description:
			"Dedicated passage + three-question demo for tabbed section-player layouts and splitpane tabbed collapse strategy",
		integrationLevel: 4,
		integrationTheme: "Tabbed responsive layout",
		focus:
			"Exercises passage/items tab switching behavior with a single passage and three items in one section.",
		whatMakesItTick: [
			"Includes one passage and at least three items to validate tab navigation end-to-end.",
			"Uses dedicated bookmarkable subroutes: `/tabbed-layout/tabbed` and `/tabbed-layout/splitpane-tabbed-collapse`.",
			"Provides both direct `pie-section-player-tabbed` and splitpane tabbed-collapse behavior without query-param toggling.",
		],
		section: demo6Section,
	},
	"resource-observability": {
		id: "resource-observability",
		name: "Resource Observability",
		description:
			"Passage + items that load image/audio resources to validate resource-monitor instrumentation",
		integrationLevel: 5,
		integrationTheme: "Resource instrumentation",
		focus:
			"Demonstrates resource loading telemetry for media embedded in passage and item content.",
		whatMakesItTick: [
			"Passage includes image and audio assets served from local demo static files.",
			"Items also embed media in prompt content to exercise item-level resource monitoring.",
			"Instrumentation panel should show resource events such as `pie-resource-load`.",
		],
		section: demo5Section,
	},
	"session-hydrate-db": {
		id: "session-hydrate-db",
		name: "Session Hydration (Server DB)",
		description:
			"Starts empty, hydrates from server-side seeded session data, then streams updates back to the backend database",
		integrationLevel: 5,
		integrationTheme: "Persistence strategy hooks",
		focus:
			"Demonstrates server-backed session lifecycle: bootstrap, hydrate, live persist, and DB state inspection.",
		whatMakesItTick: [
			"`ToolkitCoordinator` hook `createSectionSessionPersistence` routes load/save/clear to API endpoints.",
			"Server bootstrap endpoint seeds section data before player hydration.",
			"DB panel streams state updates and exposes raw/reconstructed/session-request views.",
		],
		sections: [
			{
				id: "session-page-one",
				name: "Session Page One",
				section: sessionPersistencePageOne,
			},
			{
				id: "session-page-two",
				name: "Session Page Two",
				section: sessionPersistencePageTwo,
			},
		],
	},
	"pie-512-asymmetric-sections": {
		id: "pie-512-asymmetric-sections",
		name: "PIE-512: Asymmetric Sections (Regression Fixture)",
		description:
			"Narrow-viewport navigation across passage+single-item / multi-item sections.",
		integrationLevel: 5,
		integrationTheme: "Regression fixture",
		focus:
			"Reproduces the PIE-512 cross-section event-delivery regression: navigating between asymmetric sections in a narrow split-pane viewport must redeliver `content-loaded` and `section-loading-complete` to consumers on each cohort flip.",
		whatMakesItTick: [
			"Section A pairs a stimulus passage with a single MC item to seed a passage+item cohort.",
			"Section B has three MC items and no passage so the cohort shape changes on navigation.",
			"Wired into the multi-section route shape used by `session-hydrate-db` (`?page=` selects the active section).",
		],
		sections: [
			{
				id: "pie-512-section-a",
				name: "Section A (passage + one item)",
				section: pie512SectionA,
			},
			{
				id: "pie-512-section-b",
				name: "Section B (three items)",
				section: pie512SectionB,
			},
		],
	},
	"heading-accessibility": {
		id: "heading-accessibility",
		name: "Heading Accessibility (baseHeadingLevel & includeSrHeading)",
		description:
			"Demonstrates the baseHeadingLevel and includeSrHeading props on the section player. The item prompt uses data-heading paragraphs that are rewritten to real heading elements at the level specified by the host.",
		integrationLevel: 2,
		integrationTheme: "Accessibility props",
		focus:
			"Shows how data-heading paragraphs are promoted to semantic heading elements at a host-controlled level, and how the visually-hidden SR heading can be suppressed when the surrounding landmark already provides context.",
		whatMakesItTick: [
			'Item prompt contains `<p data-heading="heading1">` and `<p data-heading="heading2">` nodes.',
			"`baseHeadingLevel` passed via the section player `player` config prop causes those nodes to be rewritten to `<h2>` / `<h3>` (or whichever level the host chooses).",
			"`includeSrHeading={false}` suppresses the visually-hidden heading injected at the top of the player.",
			"Toggle controls in the demo let you flip both props live and inspect the resulting DOM.",
		],
		section: demo7Section,
	},
};

export function getSectionDemoById(
	id: string | undefined,
): SectionDemoInfo | null {
	if (!id) return null;
	return sectionDemos[id] || null;
}

export function getAllSectionDemos(): SectionDemoInfo[] {
	return Object.values(sectionDemos);
}
