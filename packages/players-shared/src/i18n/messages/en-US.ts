/**
 * English (United States) message catalog — the source of truth.
 *
 * This catalog's *shape* generates `MessageKey`, so every other locale is
 * checked against it and a mistyped key at a call site is a compile error. Add a
 * key here first.
 *
 * A TypeScript module rather than JSON: `tsc` compiles it to real JS, which
 * removes the `with { type: "json" }` import-attribute hazard that already broke
 * every non-English locale once under Node's ESM loader, and it lets the key
 * union be derived rather than maintained.
 *
 * Conventions:
 * - `{placeholder}` slots interpolate; keep the names stable across locales.
 * - A plural group is an object of CLDR categories; `other` is required and
 *   `Intl.PluralRules` picks the rest, so a locale may carry more forms than
 *   English has.
 * - Keys ending `A11y` are for assistive technology only and are never rendered
 *   as visible text. They carry the operating instructions a sighted user reads
 *   from the layout.
 * - Developer-facing diagnostics (`throw`/`console`) are deliberately absent.
 *   Only strings a learner, teacher or author can see belong here.
 *
 * @module @pie-players/pie-players-shared/i18n/messages/en-US
 */

const enUS = {
	/** Verbs and nouns reused across more than one package. */
	common: {
		close: "Close",
		cancel: "Cancel",
		save: "Save",
		reset: "Reset",
		retry: "Retry",
		back: "Back",
		next: "Next",
		previous: "Previous",
		submit: "Submit",
		continue: "Continue",
		finish: "Finish",
		yes: "Yes",
		no: "No",
		ok: "OK",
		any: "Any",
		off: "Off",
		auto: "Auto",
		all: "All",
		none: "None",
		loading: "Loading…",
		error: "Error",
		settings: "Settings",
		language: "Language",
		theme: "Theme",
		preview: "Preview",
		author: "Author",
		unknown: "Unknown",
		untitled: "Untitled",
		apply: "Apply",
		enabled: "Enabled",
		disabled: "Disabled",
		closeA11y: "Close",
		settingsA11y: "Open settings menu",
	},

	/**
	 * Player chrome: the section, item and assessment players' own surfaces.
	 * Not the authored content, which carries its own language.
	 */
	player: {
		passage: "Passage",
		passages: "Passages",
		question: "Question",
		questionNumbered: "Question {position}",
		questions: "Questions",
		items: "Items",
		section: "Section",
		loadingSection: "Loading section content…",
		loadingPassage: "Loading passage content…",
		configurationError: "Configuration Error",
		playerError: "Player Error",
		authoringBackendError: "Authoring Backend Configuration Error",
		itemLoadError: "Question could not be loaded.",
		sectionTabsA11y: "Section content tabs",
		passagesRegionA11y: "Passages",
		itemsRegionA11y: "Items",
		sectionToolsA11y: "Section tools",
		scrollDownA11y: "Scroll down",
		resizePanels: "Resize panels",
		resizePassagesAndItemsA11y: "Resize passages and items panels",
		resizeMediaRegion: "Resize media region",
		resizeQuestionAndMediaA11y: "Resize question and media panels",
		resizePassageAndMediaA11y: "Resize passage and media panels",

		/**
		 * The assessment player's own section-to-section navigation. Its Back and
		 * Next controls take `common.back` / `common.next`.
		 */
		assessment: {
			sectionPosition: "Section {position} of {total}",
			noSections: "No sections",
		},

		/** Formative delivery: check-answer control and its outcome announcements. */
		formative: {
			checkAnswer: "Check answer",
			tryAgain: "Try again",
			answerRecorded: "Answer recorded.",
			correct: "Correct.",
			partlyCorrect: "Partly correct.",
			notCorrect: "Not correct.",
			notAutoScored:
				"Answer recorded. This question is not scored automatically.",
			checkFailed: "This question could not be checked. Try again.",
			/**
			 * Appended after the outcome, so the announcement reads
			 * "Not correct. 2 tries left." Kept a separate plural group rather than
			 * folded into each outcome: the tries count varies independently of
			 * correctness, and cross-multiplying them is 4 x N strings.
			 */
			triesLeft: {
				one: "{count} try left.",
				other: "{count} tries left.",
			},
		},
	},

	/** Toolbar and tool-shell chrome owned by the assessment toolkit. */
	toolkit: {
		toolsA11y: "Assessment tools",
		toolbarInitError: "Unable to initialize assessment toolkit.",
		settingsTitle: "Settings",
		closeSettingsA11y: "Close settings",
		dragPanelA11y: "Drag panel",
		closePanelA11y: "Close panel",
		resizeWindow: "Resize window",
		minimize: "Minimize",
		maximize: "Maximize",
		minimizePanelA11y: "Minimize panel",
		maximizePanelA11y: "Maximize panel",

		/** Tool-window keyboard controls, exposed only to assistive technology. */
		window: {
			moveLeftA11y: "Move tool left",
			moveRightA11y: "Move tool right",
			moveUpA11y: "Move tool up",
			moveDownA11y: "Move tool down",
			shrinkA11y: "Shrink tool window",
			growA11y: "Grow tool window",
			centerA11y: "Center tool window",
			closeA11y: "Close tool",
		},

		/**
		 * Live-region announcements shared by the draggable tools — ruler,
		 * protractor, line reader. Keyboard movement and rotation read the same in
		 * every one of them, so the strings live once here rather than per tool.
		 */
		announce: {
			movedUp: "Moved up to {position}",
			movedDown: "Moved down to {position}",
			movedLeft: "Moved left to {position}",
			movedRight: "Moved right to {position}",
			rotatedTo: "Rotated to {degrees} degrees",
		},
	},

	/**
	 * Per-capability strings, keyed by `toolId`.
	 *
	 * `name` and `description` back `ToolRegistration.nameKey` /
	 * `descriptionKey`, so the toolbar label and the registration contract read
	 * the same catalog entry.
	 */
	tools: {
		calculator: {
			name: "Calculator",
			nameBasic: "Basic Calculator",
			nameScientific: "Scientific Calculator",
			nameGraphing: "Graphing Calculator",
			description: "Multi-type calculator (basic, scientific, graphing)",
			// Announced by the inline calculator's toggle. One key per variant and
			// state rather than "{name} opened": Dutch and German put the participle
			// last, so the sentence has to be authored whole. All three variants the
			// provider implements are covered, not just the two the packaged toolbar
			// registration offers — the inline element takes its type from the host.
			openedBasic: "Basic calculator opened",
			openedScientific: "Scientific calculator opened",
			openedGraphing: "Graphing calculator opened",
			closedBasic: "Basic calculator closed",
			closedScientific: "Scientific calculator closed",
			closedGraphing: "Graphing calculator closed",
			toolA11y: "Calculator tool",
			loading: "Loading calculator…",
			providerUnavailable: "The calculator is unavailable.",
		},
		graph: {
			name: "Graph",
			description: "Graphing calculator and coordinate plane",
			buttonA11y: "Graph, graphing calculator",
			tooltip: "Graph",
			toolA11y: "Graph tool — draw points and lines on a coordinate grid",
			canvasA11y: "Graph canvas — use tools to add points and draw lines",
			grid: "Grid:",
			gridOpacityA11y: "Grid opacity",
			pointA11y: "Graph point {id}",
			modeSelector: "Selector",
			modeSelectorHint:
				"Selector: click and drag points to move them or associated lines.",
			modePoint: "Point",
			modePointHint: "Point: click on the grid to add points.",
			modeLine: "Line",
			modeLineHint:
				"Line: click a starting point, then an ending point to draw a line.",
			modeDelete: "Delete",
			modeDeleteHint:
				"Delete: click on a point to delete it and any connected lines.",
		},
		periodicTable: {
			name: "Periodic Table",
			description: "Chemistry periodic table reference",
			buttonA11y: "Periodic Table, chemistry reference",
			tooltip: "Periodic Table",
			toolA11y: "Periodic table — select an element to view its details",
			elementsA11y: "Periodic table elements",
			showAllA11y: "Show all elements",
			allElements: "All Elements",
			atomicMass: "Atomic Mass",
			atomicNumber: "Atomic No",
			electronConfig: "Electron Config",
			phase: "Phase",
			filterByA11y: "Filter by {category}",
			/**
			 * Element cell label. Element *names* come from the periodic-table data
			 * file, not from here: they are content, and a locale that renames them
			 * needs a translated data file rather than 118 catalog keys.
			 */
			elementA11y:
				"{name}, Symbol: {symbol}, Atomic number: {number}, Atomic mass: {mass}, Category: {category}",
			outsideFilterA11y: ", outside the current filter",
			/** IUPAC element categories. Chemistry nomenclature, translated per locale. */
			category: {
				unknown: "Unknown",
				alkaliMetal: "Alkali Metal",
				alkalineEarthMetal: "Alkaline Earth Metal",
				transitionMetal: "Transition Metal",
				postTransitionMetal: "Post-transition Metal",
				metalloid: "Metalloid",
				diatomicNonmetal: "Diatomic Nonmetal",
				polyatomicNonmetal: "Polyatomic Nonmetal",
				nobleGas: "Noble Gas",
				lanthanide: "Lanthanide",
				actinide: "Actinide",
			},
		},
		ruler: {
			name: "Ruler",
			description: "On-screen ruler for measurements",
			buttonA11y: "Ruler",
			tooltip: "Ruler",
			toolA11y: "Draggable and rotatable ruler measurement tool",
			unitSelectionA11y: "Ruler unit selection",
			inches: "Inches",
			centimeters: "Centimeters",
			// Second form of each unit name, for interpolation into a sentence —
			// `switchedTo`, `applicationA11y`, `imageAlt`. English needs it for
			// sentence case; a language that capitalises nouns everywhere will have
			// the two forms identical. Both are spelled out rather than abbreviated
			// because every one of those three is read aloud, and a screen reader
			// says "cm" as two letters.
			inchesInSentence: "inches",
			centimetersInSentence: "centimeters",
			switchToInchesA11y: "Switch to inches",
			switchToCentimetersA11y: "Switch to centimeters",
			switchedTo: "Switched to {unit}",
			applicationA11y:
				"Ruler tool. Use arrow keys to move, Shift+arrows to rotate, PageUp or PageDown for fine rotation, U to toggle units. Current unit: {unit}",
			imageAlt: "Ruler showing {unit}",
		},
		protractor: {
			name: "Protractor",
			description: "On-screen protractor for angle measurements",
			buttonA11y: "Protractor",
			tooltip: "Protractor",
			toolA11y:
				"Protractor tool. Use arrow keys to move, Shift+arrows to rotate, and PageUp or PageDown for fine rotation.",
			roleA11y: "Draggable and rotatable protractor measurement tool",
			imageAlt:
				"Protractor with 180-degree semicircular scale marked from 0 to 180 degrees in both directions, with degree markings every 10 degrees",
		},
		/**
		 * The two dictionaries. `toolA11y` names the floating panel; the button
		 * names follow the toolbar rule — the tooltip verbatim, plus a purpose
		 * clause only where the tooltip alone does not identify the tool.
		 */
		dictionary: {
			name: "Dictionary",
			description: "Look up word definitions",
			buttonA11y: "Dictionary, look up word definitions",
			tooltip: "Dictionary",
			toolA11y: "Dictionary",
		},
		pictureDictionary: {
			name: "Picture Dictionary",
			description: "Look up pictures for words",
			buttonA11y: "Picture Dictionary, look up pictures for words",
			tooltip: "Picture Dictionary",
			toolA11y: "Picture Dictionary",
		},
		/**
		 * The Spanish variants. Named in the interface locale like every other tool label —
		 * a Dutch-speaking proctor reading a Dutch interface still sees which language the
		 * dictionary looks words up in.
		 */
		dictionarySpanish: {
			name: "Spanish Dictionary",
			description: "Look up word definitions in Spanish",
			buttonA11y: "Spanish Dictionary, look up word definitions in Spanish",
			tooltip: "Spanish Dictionary",
			toolA11y: "Spanish Dictionary",
		},
		pictureDictionarySpanish: {
			name: "Spanish Picture Dictionary",
			description: "Look up pictures for words in Spanish",
			buttonA11y: "Spanish Picture Dictionary, look up pictures for words in Spanish",
			tooltip: "Spanish Picture Dictionary",
			toolA11y: "Spanish Picture Dictionary",
		},
		lineReader: {
			name: "Line Reader",
			description: "Reading guide overlay",
			buttonA11y: "Line Reader, reading guide",
			tooltip: "Line Reader",
			roleA11y: "Draggable and resizable reading guide overlay",
			close: "Close line reader",
			resizeWindowA11y: "Drag to resize the reading window",
			resizeFrameA11y: "Drag to resize the frame and window width",
			windowHeightAnnounce: "Reading window height {pixels} pixels",
			frameHeightAnnounce: "Frame height {pixels} pixels",
			widthAnnounce: "Width {pixels} pixels",
			applicationA11y:
				"Line Reader tool. A clear reading window inside an obscuring frame. Use arrow keys to move, +/- to resize the reading window, Escape to close. Reading window height: {paneHeight} pixels, Frame height: {frameHeight} pixels",
			resizeWindowFullA11y:
				"Resize the reading window. Drag, or use the up and down arrow keys to change its height. Current height {paneHeight} pixels",
			resizeFrameFullA11y:
				"Resize the frame. Drag, or use the up and down arrow keys to change the frame height and the left and right arrow keys to change the width. Current frame height {frameHeight} pixels, width {width} pixels",
		},
		answerEliminator: {
			name: "Answer Eliminator",
			description: "Strike through answer choices",
			buttonA11y: "Strike Through, eliminate answer choices",
			tooltip: "Strike Through",
		},
		highlighter: {
			name: "Highlighter",
			description: "Highlight and annotate text",
			buttonA11y: "Highlight text",
			tooltip: "Highlight",
		},
		annotationToolbar: {
			name: "Annotation",
			description: "Highlight and annotate text",
			buttonA11y: "Annotate, highlight and mark up text",
			// Not "Highlight": that is `tools.highlighter.tooltip`, and two toolbar
			// buttons carrying the same visible label is a defect rather than a style
			// choice. This tool does more than highlight — underline, remove, clear.
			tooltip: "Annotate",
			toolbarA11y: "Text annotation toolbar",
			underline: "Underline",
			underlineA11y: "Underline selected text",
			readAloud: "Read Aloud",
			readAloudA11y: "Read selected text aloud",
			remove: "Remove",
			removeA11y: "Remove this annotation",
			clearAll: "Clear All",
			clearAllA11y: "Clear all annotations from document",
			highlightYellowA11y: "Yellow highlight",
			highlightPinkA11y: "Pink highlight",
			highlightBlueA11y: "Blue highlight",
			highlightGreenA11y: "Green highlight",
		},
		theme: {
			name: "Theme",
			description: "Accessible themes and contrast",
			buttonA11y: "Theme, change colors and contrast",
			tooltip: "Theme",
			selectorA11y: "Theme selector",
			hint: "Select a theme to improve readability and reduce eye strain.",
			selectA11y: "Select theme",
			selectCurrentA11y: "Select theme. Current theme: {name}",
			optionUnavailableA11y: "{name}, unavailable",
			unavailableName: "Unavailable theme: {id}",
			unavailableDescription:
				"PIE's managed base theme remains active until this theme becomes available again.",
			unavailableStatus:
				"The selected theme is unavailable. PIE's managed base theme is active until it becomes available again.",
		},
		textToSpeech: {
			name: "Text to Speech",
			description: "Read content aloud",
			toolA11y: "Text-to-speech tool",
			title: "Text-to-Speech",
			initializing: "Initializing…",
			initFailed: "Failed to initialize text-to-speech.",
			selectText: "Select text on the page to read it aloud.",
			speed: "Speed:",
			play: "Play",
			pause: "Pause",
			resume: "Resume",
			stop: "Stop",
			speaking: "Speaking…",
			paused: "Paused",
			charactersSelected: {
				one: "{count} character selected",
				other: "{count} characters selected",
			},
			rate: {
				slow: "Slow",
				slower: "Slower",
				normal: "Normal",
				faster: "Faster",
				fast: "Fast",
				veryFast: "Very Fast",
			},
			/** Inline reading controls and their live-region announcements. */
			inline: {
				controlsA11y: "Reading controls",
				playbackSpeedA11y: "Playback speed",
				rewindA11y: "Rewind",
				fastForwardA11y: "Fast-forward",
				stopA11y: "Stop reading",
				initializing: "Initializing text-to-speech",
				initFailed: "Unable to initialize text-to-speech. Try again.",
				starting: "Starting reading",
				started: "Reading started",
				resumed: "Reading resumed",
				pausedAnnouncement: "Reading paused",
				stopped: "Reading stopped",
				switchedSection: "Reading switched to another section",
				startFailed: "Unable to start reading",
				skippedForward: "Skipped forward",
				skipForwardFailed: "Unable to skip forward",
				skippedBackward: "Skipped backward",
				skipBackwardFailed: "Unable to skip backward",
				speedChangeFailed: "Unable to change playback speed",
				speedAnnounce: "Playback speed {label}",
				playA11y: "Play reading",
				pauseA11y: "Pause reading",
				resumeA11y: "Resume reading",
			},
		},
		signLanguage: {
			name: "Sign Language",
			description: "Signed alternate for authored content",

			/**
			 * Names of the signed language itself, keyed by its ISO 639-3 code.
			 *
			 * The name of the *adaptation*, never inferred from the item's content
			 * language. `signedEnglish` is not a distinct sign language; it rides
			 * the same card type tagged with a spoken-language code.
			 */
			generic: "Sign language",
			unknown: "Sign language ({code})",
			ase: "American Sign Language",
			bfi: "British Sign Language",
			fsl: "French Sign Language",
			gss: "Greek Sign Language",
			mfs: "Mexican Sign Language",
			signedEnglish: "Signed English",
			regionA11y: "{language} translation",
		},
		audioTranscript: {
			name: "Audio Transcript",
			description: "Text transcript of audio content",
			regionA11y: "Transcript",
		},
	},

	/**
	 * Developer panel chrome.
	 *
	 * These packages ship as published custom elements, so their chrome is
	 * localized like any other. The JSON payloads they dump are data, not
	 * message content, and stay as authored.
	 */
	debug: {
		session: "Session",
		sessionData: "Session Data",
		sessionDataPersistent: "PIE Session Data (Persistent)",
		noItemSessionYet:
			"No item session data yet. Interact with the item to see updates here.",
		itemSessionsSnapshot: "Item Sessions Snapshot",
		sectionControllerUnavailable:
			"Section controller not available for this section yet.",
		filteredModel: "Filtered Model",
		environment: "Environment",
		events: "Events",
		controllerEvents: "Controller Events",
		instrumentation: "Instrumentation",
		databaseState: "Database state",
		sessionDb: "Session DB (Server)",
		noRows: "No rows",
		noRecords: "No instrumentation records yet.",
		selectRecord: "Select a record to inspect details.",
		selectEvent: "Select an event to inspect payload details.",
		showRawTables: "Show raw tables",
		showReconstructedSnapshots: "Show reconstructed snapshots",
		showSectionRequest: "Show section request",
		showAssessmentRequest: "Show assessment request",
		liveUpdatesUnsupported: "Live updates are not supported in this browser",
		liveUpdatesDisconnected: "Live updates disconnected; retrying…",
		fieldType: "Type:",
		fieldTarget: "Target:",
		fieldItem: "Item:",
		fieldCanonical: "Canonical:",
		fieldIntent: "Intent:",
		fieldDuplicates: "Duplicates:",
		fieldSemanticRepeats: "Semantic Repeats:",
		dragItemSessionPanelA11y: "Drag item session panel",
		debuggerTabsA11y: "Debugger tabs",
		sessionDataJsonA11y: "Session data JSON",
		environmentJsonA11y: "Environment JSON",
		filteredModelJsonA11y: "Filtered model JSON",
		sectionSessionJsonA11y: "Section session snapshot JSON",
		eventLevelFilterA11y: "Event level filter",
		controllerEventDetailsA11y: "Controller event details",
		instrumentationFilterA11y: "Filter instrumentation record type",
		instrumentationDetailsA11y: "Instrumentation record details",
		toggleSessionPanelA11y: "Toggle session panel",
		toggleEventPanelA11y: "Toggle event broadcast panel",
		toggleDatabasePanelA11y: "Toggle database state panel",
		toggleInstrumentationPanelA11y: "Toggle instrumentation panel",

		/** PNP debugger. */
		pnp: {
			title: "PNP Profile",
			noAssessmentBound: "No assessment bound",
			determinationReadOnly: "Determination (read-only)",
			toolsEditor: "Tools Editor",
			enforcement: "PNP enforcement",
			allAvailableTools: "All available tools",
			clearPlacement: "Clear placement",
			tool: "Tool",
			placement: "Placement",
			provider: "Provider",
			simulation: "PNP simulation",
			resolvedTools: "Resolved Tools (toolkit)",
			provenanceSummary: "Tool Policy Provenance Summary",
			perToolDecisions: "Per-Tool Decisions",
			profileReadOnly: "PNP Profile (read-only)",
		},

		/** TTS settings panel. */
		tts: {
			title: "TTS settings",
			closeA11y: "Close TTS settings",
			toolbarLayoutMode: "Toolbar layout mode",
			reservedRow: "Reserved row",
			expandingRow: "Expanding row",
			floatingOverlay: "Floating overlay",
			leftAlignedControls: "Left-aligned controls",
			inlineSpeedButtons: "Inline speed buttons",
			resetToDefaults: "Reset to defaults",
			mathHighlighting: "Math highlighting",
			checkingAvailability: "Checking availability…",
			recheck: "Recheck",
			voice: "Voice",
			bestAvailableVoice: "Best available voice (auto)",
			unnamedVoice: "Unnamed voice",
			apiEndpoint: "API endpoint",
			gender: "Gender",
			any: "Any",
			male: "Male",
			female: "Female",
			neutral: "Neutral",
			engine: "Engine",
			neural: "Neural",
			standard: "Standard",
			providerDefault: "Provider default",
			format: "Format",
			sampleRate: "Sample rate",
			speechMarks: "Speech marks",
			word: "Word",
			wordAndSentence: "Word + sentence",
			voiceType: "Voice type",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Plain text",
			sampleText: "Sample text",
			resetSample: "Reset sample",
			providerAvailable: "Provider available.",
			providerUnavailable: "Provider unavailable.",
			providerCheckFailed: "Provider availability check failed.",
			providerNotChecked: "Provider availability has not been checked yet.",
			webSpeechUnavailable: "Web Speech API is not available in this browser.",
			browserNoVoices:
				"Browser text-to-speech is available, but no voices were returned yet.",
			browserUnavailable: "Browser text-to-speech is not available.",
			googleUnavailable:
				"Google Cloud TTS is not available from the configured API.",
			// No keys for the preview sample text: it is spoken by the voice under
			// test, so its language follows that voice, not the interface locale.
			pollyUnavailable: "AWS Polly is not available from the configured API.",
			recommendedVoices: "Recommended voices",
			allVoices: "All available voices",
			previewVoice: "Preview voice",
			stopPreview: "Stop preview",
			applying: "Applying…",
			ssmlPreviewUnsupported:
				"SSML preview is not supported in the Browser backend.",
			pollySsmlHint:
				"Some Polly neural voices reject certain SSML tags (for example emphasis). Use basic SSML tags if preview fails.",
			mathHighlightParts:
				"Highlighting each part of a formula as it is read, falling back to the whole formula when alignment is uncertain.",
			mathHighlightBlock:
				"Highlighting each formula as a single block instead of breaking it into parts.",
			previewFailed: "Failed to play preview audio.",
			previewNoAudio: "Preview response did not include audio content.",
			previewEnterText: "Enter preview text before starting playback.",
			previewUnavailable:
				"Cannot preview while this service is unavailable.",
			browserSynthesisUnavailable: "Browser speech synthesis is unavailable.",
			browserSynthesisEndedEarly:
				"Browser speech synthesis ended before audio started. Restart the browser and try again.",
			browserSynthesisQueueFailed:
				"Browser speech synthesis failed to queue preview audio.",
			browserPreviewFailed: "Failed to play browser voice preview.",
			ssmlWordTrackingDisabled:
				"Google SSML preview preserves authored SSML, so word tracking is disabled.",
			applyUnavailable:
				"Cannot apply settings while this service is unavailable.",
			coordinatorUnavailable:
				"Toolkit coordinator is not available for text-to-speech updates.",
		},
	},
};

export default enUS;
