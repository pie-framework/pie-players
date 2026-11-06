/**
 * Filipino message catalog — reviewed (agent generation-and-review pass in
 * lieu of a native reader, 2026-11-04; see `reviewedBy` in
 * `catalog-manifest.json`).
 *
 * Serves every Filipino host: registered under the bare `fil` tag, and the
 * `tl` tag aliases this same catalog (US assessment systems label the
 * language Tagalog). Content flavour is modern Filipino per `briefs/fil.md` —
 * the delivered unit is `tanong` inside a `pagsusulit`, sections are
 * `bahagi`, passages are `akda`; controls carry the verb (context-marked
 * `Isara`, `Suriin`), state changes are announced as perfective events
 * (`Binuksan ang kalkuladora`, `Inilipat pataas`, `Napalitan`), and loan
 * verbs take the Filipino affix hyphenated (`i-save`, `na-load`,
 * `naka-enable`). Plural groups carry exactly the CLDR `fil` categories
 * one/other — Filipino nouns do not inflect after numerals, so both
 * categories read alike.
 *
 * Regeneration is surgical, never wholesale: `scripts/check-catalogs.ts`
 * diffs the English snapshot (`fil.english-snapshot.json`) against the live
 * `en-US` source and lists exactly the keys whose English moved; translate
 * only those, keep every reviewed string, then refresh the snapshot per the
 * package README.
 *
 * @module @pie-players/pie-i18n-generated/messages/fil
 */

const fil = {
	common: {
		close: "Isara",
		cancel: "Kanselahin",
		save: "I-save",
		reset: "I-reset",
		retry: "Subukan muli",
		back: "Bumalik",
		next: "Susunod",
		previous: "Nakaraan",
		submit: "Ipasa",
		continue: "Magpatuloy",
		finish: "Tapusin",
		yes: "Oo",
		no: "Hindi",
		ok: "OK",
		any: "Anuman",
		off: "Naka-off",
		auto: "Auto",
		all: "Lahat",
		none: "Wala",
		loading: "Naglo-load…",
		error: "Error",
		settings: "Mga Setting",
		language: "Wika",
		theme: "Tema",
		preview: "Preview",
		author: "Pag-edit",
		unknown: "Di-kilala",
		untitled: "Walang pamagat",
		apply: "I-apply",
		enabled: "Naka-enable",
		disabled: "Naka-disable",
		lookUp: "Hanapin",
		wordOrPhrase: "Salita o parirala",
		closeA11y: "Isara",
		settingsA11y: "Buksan ang menu ng mga setting",
	},

	player: {
		passage: "Akda",
		passages: "Mga Akda",
		question: "Tanong",
		questionNumbered: "Tanong {position}",
		questions: "Mga Tanong",
		items: "Mga Tanong",
		section: "Bahagi",
		loadingSection: "Naglo-load ang nilalaman ng bahagi…",
		sectionLoadError: "Hindi na-load ang nilalaman ng bahagi.",
		loadingPassage: "Naglo-load ang nilalaman ng akda…",
		configurationError: "Error sa configuration",
		playerError: "Error sa player",
		authoringBackendError: "Error sa configuration ng authoring backend",
		itemLoadError: "Hindi na-load ang tanong.",
		sectionTabsA11y: "Mga tab ng nilalaman ng bahagi",
		passagesRegionA11y: "Mga Akda",
		itemsRegionA11y: "Mga Tanong",
		sectionToolsA11y: "Mga kagamitan ng bahagi",
		scrollDownA11y: "Mag-scroll pababa",
		resizePanels: "Baguhin ang laki ng mga panel",
		resizePassagesAndItemsA11y:
			"Baguhin ang laki ng mga panel ng akda at tanong",
		resizeMediaRegion: "Baguhin ang laki ng rehiyon ng media",
		resizeQuestionAndMediaA11y:
			"Baguhin ang laki ng mga panel ng tanong at media",
		resizePassageAndMediaA11y:
			"Baguhin ang laki ng mga panel ng akda at media",
		resizePassageAndQuestionA11y:
			"Baguhin ang laki ng mga panel ng akda at tanong",
		passageWidthA11y: "Lapad ng akda: {percent}%",
		questionPositionA11y: "Tanong {position} sa {total}",
		questionPositionLabeledA11y: "{label}, tanong {position} sa {total}",

		assessment: {
			sectionPosition: "Bahagi {position} sa {total}",
			noSections: "Walang bahagi",
			loadFailed: "Hindi na-load ang pagsusulit. Subukan muli.",
			restoreFailed:
				"Hindi naibalik ang mga naka-save na sagot sa bahaging ito. Subukan muli.",
		},

		check: {
			checkAnswer: "Suriin ang sagot",
			tryAgain: "Subukan muli",
			answerRecorded: "Naitala ang sagot.",
			correct: "Tama.",
			partlyCorrect: "Bahagyang tama.",
			notCorrect: "Hindi tama.",
			notAutoScored:
				"Naitala ang sagot. Hindi awtomatikong ini-grade ang tanong na ito.",
			checkFailed: "Hindi masuri ang tanong na ito. Subukan muli.",
			triesLeft: {
				one: "May {count} pagsubok na natitira.",
				other: "May {count} pagsubok na natitira.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Lalabas ang mga tanong habang nagpe-play ang media.",
			questionAvailable: "Available na ang Tanong {position}.",
			playbackPaused:
				"Na-pause ang pag-play. Sagutin ang Tanong {position} para magpatuloy.",
			playbackAdvisory:
				"Sagutin ang Tanong {position} bago magpatuloy sa media.",
			playbackReleased:
				"Natanggap ang sagot. Ipagpatuloy ang pag-play ng media.",
		},

		summary: {
			correctA11y: "Tamang sagot",
			answer: "Sagot",
			manualScoring: "Ginagrado ng guro",
			audio: "Audio",
			video: "Video",
		},
		list: {
			expandA11y: "Ipakita ang buong tanong",
			highlights: "Mga tugma sa paghahanap",
			collapse: "Ipakita ang buod",
			playerError: "Hindi na-load ang buong tanong.",
		},
	},

	toolkit: {
		toolsA11y: "Mga kagamitan sa pagsusulit",
		toolbarInitError: "Hindi masimulan ang mga kagamitan sa pagsusulit.",
		settingsTitle: "Mga Setting",
		closeSettingsA11y: "Isara ang mga setting",
		dragPanelA11y: "I-drag ang panel",
		closePanelA11y: "Isara ang panel",
		resizeWindow: "Baguhin ang laki ng bintana",
		minimize: "I-minimize",
		maximize: "I-maximize",
		minimizePanelA11y: "I-minimize ang panel",
		maximizePanelA11y: "I-maximize ang panel",

		window: {
			moveLeftA11y: "Ilipat ang kagamitan pakaliwa",
			moveRightA11y: "Ilipat ang kagamitan pakanan",
			moveUpA11y: "Ilipat ang kagamitan pataas",
			moveDownA11y: "Ilipat ang kagamitan pababa",
			narrowerA11y: "Paliitin ang bintana ng kagamitan",
			widerA11y: "Palakihin ang bintana ng kagamitan",
			shorterA11y: "Paikliin ang bintana ng kagamitan",
			tallerA11y: "Pahabain ang bintana ng kagamitan",
			centerA11y: "I-center ang bintana ng kagamitan",
			closeA11y: "Isara ang kagamitan",
		},

		placement: {
			controlsA11y: "Ilipat at ikutin",
			moveAndResizeA11y: "Ilipat at baguhin ang laki",
			rotateClockwiseA11y: "Ikutin ng {degrees}° clockwise",
			rotateCounterclockwiseA11y: "Ikutin ng {degrees}° counterclockwise",
		},

		announce: {
			movedUp: "Inilipat pataas sa {position}",
			movedDown: "Inilipat pababa sa {position}",
			movedLeft: "Inilipat pakaliwa sa {position}",
			movedRight: "Inilipat pakanan sa {position}",
			rotatedTo: "Ni-rotate sa {degrees} degrees",
		},
	},

	tools: {
		calculator: {
			name: "Kalkuladora",
			nameBasic: "Payak na Kalkuladora",
			nameScientific: "Siyentipikong Kalkuladora",
			nameGraphing: "Graping Kalkuladora",
			description:
				"Kalkuladora na maraming uri (payak, siyentipiko, graping)",
			// Ang mga state-change announcement ay perpektibong event
			// (binuksan/isinara), hindi statibo.
			openedBasic: "Binuksan ang payak na kalkuladora",
			openedScientific: "Binuksan ang siyentipikong kalkuladora",
			openedGraphing: "Binuksan ang graping kalkuladora",
			closedBasic: "Isinara ang payak na kalkuladora",
			closedScientific: "Isinara ang siyentipikong kalkuladora",
			closedGraphing: "Isinara ang graping kalkuladora",
			toolA11y: "Kalkuladora",
			loading: "Naglo-load ang kalkuladora…",
			providerUnavailable: "Hindi available ang kalkuladora.",
			initFailed: "Hindi na-initialize ang kalkuladora.",
		},
		graph: {
			name: "Grap",
			description: "Plano ng mga Coordinate",
			buttonA11y: "Grap, plano ng mga coordinate",
			tooltip: "Grap",
			toolA11y:
				"Kagamitang grap — maglagay ng mga punto at gumuhit ng mga linya sa plano ng coordinate",
			canvasA11y:
				"Kanvas ng grap — gamitin ang mga kagamitan para maglagay ng mga punto at gumuhit ng mga linya",
			grid: "Grid:",
			gridOpacityA11y: "Opacity ng grid",
			pointA11y: "Punto {id}",
			modeSelector: "Piliin",
			modeSelectorHint:
				"Piliin: i-click at i-drag ang mga punto para ilipat ang mga ito o ang mga linyang konektado dito.",
			modePoint: "Punto",
			modePointHint: "Punto: i-click ang grid para magdagdag ng mga punto.",
			modeLine: "Linya",
			modeLineHint:
				"Linya: i-click ang panimulang punto, pagkatapos ang panghuling punto, para gumuhit ng linya.",
			modeDelete: "Tanggalin",
			modeDeleteHint:
				"Tanggalin: i-click ang isang punto para tanggalin ito at ang mga linyang konektado dito.",
		},
		periodicTable: {
			name: "Periyodikong Talaan",
			description: "Sangguniang periyodikong talaan sa kimika",
			buttonA11y: "Periyodikong Talaan, sanggunian sa kimika",
			tooltip: "Periyodikong Talaan",
			toolA11y:
				"Periyodikong talaan — pumili ng elemento para makita ang mga detalye nito",
			elementsA11y: "Mga elemento ng periyodikong talaan",
			showAllA11y: "Ipakita lahat ng elemento",
			allElements: "Lahat ng Elemento",
			atomicMass: "Atomikong Masa",
			atomicNumber: "Atomikong Bilang",
			electronConfig: "Kaayusan ng Elektron",
			phase: "Anyo",
			filterByA11y: "Salain ayon sa {category}",
			elementA11y:
				"{name}, simbolo: {symbol}, atomikong bilang: {number}, atomikong masa: {mass}, kategorya: {category}",
			outsideFilterA11y: ", sa labas ng kasalukuyang salaan",
			category: {
				unknown: "Di-kilala",
				alkaliMetal: "Metal na Alkali",
				alkalineEarthMetal: "Metal na Alkaline Earth",
				transitionMetal: "Metal na Transition",
				postTransitionMetal: "Metal na Post-Transition",
				metalloid: "Metaloyd",
				diatomicNonmetal: "Diatomikong Di-metal",
				polyatomicNonmetal: "Polyatomikong Di-metal",
				nobleGas: "Marangal na Gas",
				lanthanide: "Lantanido",
				actinide: "Aktinido",
			},
			phaseValue: {
				solid: "Solido",
				liquid: "Likido",
				gas: "Gas",
			},
		},
		ruler: {
			// "Ruler" iniwan sa Ingles — ang salitang pang-eskwela sa Pilipinas;
			// tinanggihan ang "regla" dahil sa homonimo nitong kahulugan
			// (buwanang regla).
			name: "Ruler",
			description: "Ruler sa screen para sa pagsukat",
			buttonA11y: "Ruler",
			tooltip: "Ruler",
			toolA11y: "Kagamitang panukat na ruler na maaaring galawin at ikutin",
			unitSelectionA11y: "Pagpili ng yunit ng ruler",
			inches: "Pulgada",
			centimeters: "Sentimetro",
			inchesInSentence: "pulgada",
			centimetersInSentence: "sentimetro",
			switchToInchesA11y: "Ilipat sa pulgada",
			switchToCentimetersA11y: "Ilipat sa sentimetro",
			switchedTo: "Napalitan ng {unit}",
			applicationA11y:
				"Kagamitang Ruler. Gamitin ang mga arrow key para ilipat, Shift+arrow key para ikutin, PageUp o PageDown para sa malinis na pag-ikot, at U para palitan ang yunit. Kasalukuyang yunit: {unit}",
			imageAlt: "Ruler na nagpapakita ng {unit}",
		},
		protractor: {
			// "Protractor" iniwan sa Ingles — ang tawag ng mga klasrum sa
			// Pilipinas; walang naturalisadong salitang Filipino.
			name: "Protractor",
			description: "Protractor sa screen para sa pagsukat ng anggulo",
			buttonA11y: "Protractor",
			tooltip: "Protractor",
			toolA11y:
				"Kagamitang Protractor. Gamitin ang mga arrow key para ilipat, Shift+arrow key para ikutin, at PageUp o PageDown para sa malinis na pag-ikot.",
			roleA11y:
				"Kagamitang panukat ng anggulo na protractor na maaaring galawin at ikutin",
			imageAlt:
				"Protractor na may 180-degrees na hugis-kalahating bilog, may marka mula 0 hanggang 180 degrees sa magkabilang direksyon, may marka kada 10 degrees",
		},
		dictionary: {
			name: "Diksiyonaryo",
			description: "Maghanap ng kahulugan ng mga salita",
			buttonA11y: "Diksiyonaryo, maghanap ng kahulugan ng mga salita",
			tooltip: "Diksiyonaryo",
			toolA11y: "Diksiyonaryo",
			notConfigured:
				"Walang naka-configure na serbisyo ng diksiyonaryo para sa pagsusulit na ito.",
			idleHint: "Mag-type ng salita para hanapin ito.",
			lookingUp: "Hinahanap ang “{term}”…",
			noEntryFor: "Walang tala para sa “{term}”.",
			// Ang mga pangngalan ng Filipino ay hindi nagbabago pagkatapos ng
			// bilang, kaya pareho ang teksto ng dalawang kategorya.
			entriesCount: {
				one: "{count} tala",
				other: "{count} tala",
			},
			noEntryStatusFor: "Walang tala sa diksiyonaryo para sa {term}.",
		},
		pictureDictionary: {
			name: "Diksiyonaryo ng Larawan",
			description: "Maghanap ng larawan ng mga salita",
			buttonA11y: "Diksiyonaryo ng Larawan, maghanap ng larawan ng mga salita",
			tooltip: "Diksiyonaryo ng Larawan",
			toolA11y: "Diksiyonaryo ng Larawan",
			notConfigured:
				"Walang naka-configure na serbisyo ng diksiyonaryo ng larawan para sa pagsusulit na ito.",
			idleHint: "Mag-type ng salita para makita ang larawan nito.",
			lookingUp: "Hinahanap ang “{term}”…",
			noEntryFor: "Walang larawan para sa “{term}”.",
			entriesCount: {
				one: "{count} larawan",
				other: "{count} larawan",
			},
			noEntryStatusFor: "Walang larawan para sa {term}.",
		},
		dictionarySpanish: {
			name: "Diksiyonaryong Espanyol",
			description: "Maghanap ng kahulugan ng mga salita sa Espanyol",
			buttonA11y:
				"Diksiyonaryong Espanyol, maghanap ng kahulugan ng mga salita sa Espanyol",
			tooltip: "Diksiyonaryong Espanyol",
			toolA11y: "Diksiyonaryong Espanyol",
		},
		pictureDictionarySpanish: {
			name: "Diksiyonaryo ng Larawan sa Espanyol",
			description: "Maghanap ng larawan ng mga salita sa Espanyol",
			buttonA11y:
				"Diksiyonaryo ng Larawan sa Espanyol, maghanap ng larawan ng mga salita sa Espanyol",
			tooltip: "Diksiyonaryo ng Larawan sa Espanyol",
			toolA11y: "Diksiyonaryo ng Larawan sa Espanyol",
		},
		lineReader: {
			name: "Gabay sa Pagbasa",
			description: "Naka-overlay na gabay sa pagbasa",
			buttonA11y: "Gabay sa Pagbasa, gabay habang nagbabasa",
			tooltip: "Gabay sa Pagbasa",
			roleA11y:
				"Gabay sa pagbasa na maaaring galawin at baguhin ang laki",
			close: "Isara ang gabay sa pagbasa",
			resizeWindowA11y: "I-drag para baguhin ang laki ng bintana ng pagbasa",
			resizeFrameA11y:
				"I-drag para baguhin ang laki ng balangkas at ang lapad ng bintana",
			windowHeightAnnounce: "Taas ng bintana ng pagbasa: {pixels} pixel",
			frameHeightAnnounce: "Taas ng balangkas: {pixels} pixel",
			widthAnnounce: "Lapad: {pixels} pixel",
			shorterWindowA11y: "Paikliin ang taas ng bintana ng pagbasa",
			tallerWindowA11y: "Pahabain ang taas ng bintana ng pagbasa",
			shorterFrameA11y: "Paikliin ang taas ng balangkas",
			tallerFrameA11y: "Pahabain ang taas ng balangkas",
			narrowerA11y: "Paliitin ang lapad ng gabay sa pagbasa",
			widerA11y: "Palakihin ang lapad ng gabay sa pagbasa",
			applicationA11y:
				"Kagamitang Gabay sa Pagbasa. Malinaw na bintana ng pagbasa sa loob ng balangkas na tumatablip sa teksto. Gamitin ang mga arrow key para ilipat, ang +/- para baguhin ang laki ng bintana ng pagbasa, at ang Escape para isara. Taas ng bintana ng pagbasa: {paneHeight} pixel, taas ng balangkas: {frameHeight} pixel",
			resizeWindowFullA11y:
				"Baguhin ang laki ng bintana ng pagbasa. I-drag, o gamitin ang mga arrow key pataas at pababa para baguhin ang taas nito. Kasalukuyang taas: {paneHeight} pixel",
			resizeFrameFullA11y:
				"Baguhin ang laki ng balangkas. I-drag, o gamitin ang mga arrow key pataas at pababa para baguhin ang taas ng balangkas at ang mga arrow key pakaliwa at pakanan para baguhin ang lapad. Kasalukuyang taas ng balangkas: {frameHeight} pixel, lapad: {width} pixel",
		},
		magnification: {
			// "Magnifier" iniwan sa Ingles, kagaya ng Ruler at Protractor; ang
			// "lupa" ay lupaing-tanim sa Filipino — bawal na homonimo.
			name: "Magnifier",
			description:
				"Palakihin ang nilalaman sa ilalim ng lens na maaaring galawin",
			buttonA11y: "Magnifier, palakihin ang nilalaman sa ilalim ng lens",
			tooltip: "Magnifier",
			roleA11y: "Lens na maaaring galawin at baguhin ang laki",
			applicationA11y:
				"Magnifier sa {zoom}×. Gamitin ang mga arrow key para ilipat ang lens, ang + at - para baguhin ang zoom, at ang Escape para isara.",
			zoomIn: "Palakihin",
			zoomOut: "Paliitin",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Na-zoom sa {zoom} beses",
			close: "Isara ang magnifier",
			resizeA11y: "I-drag para baguhin ang laki ng magnifier",
			resizeFullA11y:
				"Baguhin ang laki ng magnifier. I-drag, o gumamit ng mga arrow key. Kasalukuyang laki: {width} × {height} pixel",
			sizeAnnounce: "Laki ng magnifier: {width} × {height} pixel",
			narrowerA11y: "Paliitin ang lapad ng magnifier",
			widerA11y: "Palakihin ang lapad ng magnifier",
			shorterA11y: "Paikliin ang taas ng magnifier",
			tallerA11y: "Pahabain ang taas ng magnifier",
		},
		answerEliminator: {
			name: "Pag-cross Out ng Sagot",
			description: "I-cross out ang mga pagpipilian sa sagot",
			buttonA11y: "I-Cross Out, alisin ang mga pagpipilian sa sagot",
			tooltip: "I-Cross Out",
			toggleA11y: "I-toggle ang cross out para sa {choice}",
			eliminatedA11y: "(na-cross out)",
			unlabeledChoice: "Pagpipiliang walang label",
		},
		highlighter: {
			name: "Highlighter",
			description: "I-highlight at mag-annotate ng teksto",
			buttonA11y: "I-highlight ang teksto",
			tooltip: "I-highlight",
		},
		annotationToolbar: {
			name: "Anotasyon",
			description: "I-highlight at mag-annotate ng teksto",
			buttonA11y: "Mag-annotate, i-highlight at markahan ang teksto",
			// Hindi "I-highlight" — iyon ang tooltip ng highlighter, at dalawang
			// toolbar button na magkapareho ang nakikitang label ay isang depekto.
			tooltip: "Mag-annotate",
			toolbarA11y: "Toolbar ng anotasyon ng teksto",
			underline: "Salungguhitan",
			underlineA11y: "Salungguhitan ang napiling teksto",
			readAloud: "Basahin nang Malakas",
			readAloudA11y: "Basahin nang malakas ang napiling teksto",
			remove: "Alisin",
			removeA11y: "Alisin ang anotasyong ito",
			clearAll: "Burahin Lahat",
			clearAllA11y: "Burahin ang lahat ng anotasyon sa dokumento",
			highlightYellowA11y: "Dilaw na highlight",
			highlightPinkA11y: "Rosas na highlight",
			highlightBlueA11y: "Asul na highlight",
			highlightGreenA11y: "Berde na highlight",
			// Mga announcement ng live region: perpektibong event (na-), curly
			// quotes; clearedA11y ay may CLDR one/other, pareho ang teksto.
			selectionAvailableA11y:
				"Available ang toolbar ng anotasyon para sa “{text}”. Pindutin ang Shift+F10 para sa mga kagamitan sa anotasyon.",
			highlightedYellowA11y: "Nai-highlight sa dilaw ang “{text}”",
			highlightedPinkA11y: "Nai-highlight sa rosas ang “{text}”",
			highlightedBlueA11y: "Nai-highlight sa asul ang “{text}”",
			highlightedGreenA11y: "Nai-highlight sa berde ang “{text}”",
			underlinedA11y: "Naisalungguhitan ang “{text}”",
			removedA11y: "Inalis ang anotasyon sa “{text}”",
			clearedA11y: {
				one: "Nabura ang {count} anotasyon",
				other: "Nabura ang {count} anotasyon",
			},
		},
		theme: {
			name: "Tema",
			description: "Mga tema at contrast para sa accessibility",
			buttonA11y: "Tema, palitan ang mga kulay at contrast",
			tooltip: "Tema",
			selectorA11y: "Tagapili ng tema",
			hint: "Pumili ng tema para mapabuti ang kalinawan ng teksto at maiwasan ang pagod ng mata.",
			selectA11y: "Pumili ng tema",
			selectCurrentA11y: "Pumili ng tema. Kasalukuyang tema: {name}",
			optionUnavailableA11y: "{name}, hindi available",
			unavailableName: "Temang hindi available: {id}",
			unavailableDescription:
				"Habang hindi available ang temang ito, nananatiling aktibo ang pangunahing temang pinamamahalaan ng PIE.",
			unavailableStatus:
				"Hindi available ang napiling tema. Nananatiling aktibo ang pangunahing temang pinamamahalaan ng PIE habang hindi ito available muli.",
		},
		textToSpeech: {
			name: "Pagbasa nang Malakas",
			description: "Basahin nang malakas ang nilalaman",
			initFailed:
				"Hindi masimulan ang pagbasa nang malakas. Subukan muli.",
			inline: {
				controlsA11y: "Mga kontrol ng pagbasa",
				playbackSpeedA11y: "Bilis ng pagbasa",
				rewindA11y: "I-rewind",
				fastForwardA11y: "I-fast forward",
				stopA11y: "Itigil ang pagbasa",
				starting: "Sinisimulan ang pagbasa",
				started: "Nagsimula ang pagbasa",
				resumed: "Ipinagpatuloy ang pagbasa",
				pausedAnnouncement: "Pinahinto ang pagbasa",
				stopped: "Itinigil ang pagbasa",
				switchedSection: "Nagpalipat ang pagbasa sa ibang bahagi",
				nothingToRead: "Walang babasahin nang malakas dito",
				startFailed: "Hindi masimulan ang pagbasa",
				skippedForward: "Na-fast forward",
				skipForwardFailed: "Hindi ma-fast forward",
				skippedBackward: "Na-rewind",
				skipBackwardFailed: "Hindi ma-rewind",
				speedChangeFailed: "Hindi mabago ang bilis ng pagbasa",
				speedAnnounce: "Bilis ng pagbasa: {label}",
				playA11y: "I-play ang pagbasa",
				pauseA11y: "I-pause ang pagbasa",
				resumeA11y: "Ipagpatuloy ang pagbasa",
			},
		},
		signLanguage: {
			name: "Wikang Senyas",
			description: "Bersyon sa wikang senyas ng nilalaman",
			// Maliliit na titik sa gitna ng pangungusap; binubuo ng regionA11y ang
			// "Salin sa {language}".
			generic: "wikang senyas",
			unknown: "Wikang Senyas ({code})",
			ase: "Wikang Senyas ng Amerika",
			bfi: "Wikang Senyas ng Britanya",
			fsl: "Wikang Senyas ng Pransya",
			gss: "Wikang Senyas ng Gresya",
			mfs: "Wikang Senyas ng Mehiko",
			signedEnglish: "Senyas na Ingles",
			regionA11y: "Salin sa {language}",
		},
		audioTranscript: {
			name: "Transkrip ng Audio",
			description: "Tekstong transkrip ng nilalamang audio",
			regionA11y: "Transkrip",
		},
	},

	debug: {
		session: "Sesyon",
		sessionData: "Data ng Sesyon",
		sessionDataPersistent: "Data ng Sesyon ng PIE (Permanente)",
		noItemSessionYet:
			"Wala pang data ng sesyon ng item. Mag-interact sa item para makita ang mga update dito.",
		itemSessionsSnapshot: "Snapshot ng mga sesyon ng item",
		sectionControllerUnavailable:
			"Hindi pa available ang controller ng bahaging ito.",
		filteredModel: "Na-filter na Model",
		environment: "Environment",
		events: "Mga Event",
		controllerEvents: "Mga Event ng Controller",
		instrumentation: "Instrumentasyon",
		databaseState: "Estado ng database",
		sessionDb: "Session DB (server)",
		noRows: "Walang row",
		noRecords: "Wala pang record ng instrumentasyon.",
		selectRecord: "Pumili ng record para makita ang mga detalye.",
		selectEvent: "Pumili ng event para makita ang mga detalye ng payload nito.",
		showRawTables: "Ipakita ang mga raw table",
		showReconstructedSnapshots: "Ipakita ang mga reconstructed snapshot",
		showSectionRequest: "Ipakita ang request ng bahagi",
		showAssessmentRequest: "Ipakita ang request ng pagsusulit",
		liveUpdatesUnsupported: "Hindi suportado ang live updates sa browser na ito",
		liveUpdatesDisconnected:
			"Nadiskonekta ang live updates; sinusubukan muli…",
		fieldType: "Uri:",
		fieldTarget: "Target:",
		fieldItem: "Item:",
		fieldCanonical: "Canonical:",
		fieldIntent: "Intent:",
		fieldDuplicates: "Mga Duplicate:",
		fieldSemanticRepeats: "Mga Semantic Repeat:",
		dragItemSessionPanelA11y: "I-drag ang panel ng item session",
		debuggerTabsA11y: "Mga tab ng debugger",
		sessionDataJsonA11y: "JSON ng data ng sesyon",
		environmentJsonA11y: "JSON ng environment",
		filteredModelJsonA11y: "JSON ng na-filter na model",
		sectionSessionJsonA11y: "JSON ng snapshot ng sesyon ng bahagi",
		eventLevelFilterA11y: "Filter sa level ng event",
		controllerEventDetailsA11y: "Mga detalye ng event ng controller",
		instrumentationFilterA11y:
			"I-filter ang uri ng record ng instrumentasyon",
		instrumentationDetailsA11y:
			"Mga detalye ng record ng instrumentasyon",
		toggleSessionPanelA11y: "I-toggle ang panel ng sesyon",
		toggleEventPanelA11y: "I-toggle ang panel ng event",
		toggleDatabasePanelA11y: "I-toggle ang panel ng estado ng database",
		toggleInstrumentationPanelA11y: "I-toggle ang panel ng instrumentasyon",

		// Mga aksyon ng panel — maliit na titik, suno sa dev na chrome ng
		// Ingles; ang sariling register ng locale ang mananagot.
		clear: "i-clear",
		pause: "i-pause",
		resume: "i-resume",
		controllerUnavailable: "hindi available ang controller",
		noMatchingEvents:
			"Wala pang katugmang event. Mag-interact sa item para makuha ang mga event ng controller.",
		noSectionSessionYet:
			"Wala pang data ng sesyon ng bahagi. Mag-interact sa mga tanong para makita ang mga update.",
		eventLevelItem: "item",
		eventLevelSection: "bahagi",
		// Mga identifier ng uri ng record — maliteral sa bawat locale.
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		// Mga label ng detalyeng-field ng instrumentasyon.
		instrumentationFieldName: "pangalan:",
		instrumentationFieldKind: "uri:",
		instrumentationFieldProvider: "provider:",
		instrumentationFieldTimestamp: "timestamp:",
		instrumentationFieldValue: "value:",
		instrumentationFieldError: "error:",
		// Mga pangalan ng field ng session-db — mga identifier, maliteral.
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",

		pnp: {
			title: "PNP Profile",
			noAssessmentBound: "Walang nakakabit na pagsusulit",
			noAssessmentBoundBody:
				"Walang maibabasa ang profile, distrito at patakaran sa pag-administer ng test, kaya ang requiredTools ng item lang ang maaaring magbigay ng akomodasyon. Ipasa ang pagsusulit sa assessment property ng toolkit, o tawagan ang updateAssessment(...) sa toolkit coordinator.",
			determinationReadOnly: "Determination (read-only)",
			toolsEditor: "Editor ng Mga Kagamitan",
			enforcement: "Pagpapatupad ng PNP",
			allAvailableTools: "Lahat ng available na kagamitan",
			clearPlacement: "Burahin ang placement",
			tool: "Kagamitan",
			placement: "Placement",
			provider: "Provider",
			simulation: "PNP simulation",
			resolvedTools: "Mga Kagamitang Naresolba (toolkit)",
			provenanceSummary: "Buod ng Pinagmulan ng Patakaran ng Kagamitan",
			perToolDecisions: "Mga Desisyon kada Kagamitan",
			policyDiagnostics: "Diagnostics ng Patakaran",
			profileReadOnly: "PNP Profile (read-only)",
			on: "Naka-on",
			effective: "Epektibo:",
			needs: "kailangan",
			hostSurfaceNotPlaced: "host surface (hindi inilagay)",
			support: "payagan",
			prohibit: "ipagbawal",
		},

		tts: {
			title: "Mga Setting ng Pagbasa nang Malakas",
			closeA11y: "Isara ang mga setting ng pagbasa nang malakas",
			toolbarLayoutMode: "Mode ng layout ng toolbar",
			reservedRow: "Nakareserbang row",
			expandingRow: "Nag-e-expand na row",
			floatingOverlay: "Floating na overlay",
			leftAlignedControls: "Mga kontrol na naka-align sa kaliwa",
			inlineSpeedButtons: "Inline na mga button ng bilis",
			resetToDefaults: "I-reset sa mga default",
			mathHighlighting: "Pag-highlight ng matematika",
			checkingAvailability: "Sinusuri ang availability…",
			recheck: "Suriin muli",
			voice: "Boses",
			bestAvailableVoice: "Pinakamahusay na available na boses (auto)",
			unnamedVoice: "Boses na walang pangalan",
			apiEndpoint: "API endpoint",
			gender: "Kasarian",
			any: "Anuman",
			male: "Lalaki",
			female: "Babae",
			neutral: "Neutral",
			engine: "Engine",
			neural: "Neural",
			standard: "Standard",
			providerDefault: "Default ng provider",
			format: "Format",
			sampleRate: "Sample rate",
			speechMarks: "Speech marks",
			word: "Salita",
			wordAndSentence: "Salita + pangungusap",
			voiceType: "Uri ng boses",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Simpleng teksto",
			sampleText: "Halimbawang teksto",
			resetSample: "I-reset ang halimbawa",
			providerAvailable: "Available ang provider.",
			providerUnavailable: "Hindi available ang provider.",
			providerCheckFailed: "Nabigo ang pagsusuri ng availability ng provider.",
			providerNotChecked: "Hindi pa nasusuri ang availability ng provider.",
			webSpeechUnavailable:
				"Hindi available ang Web Speech API sa browser na ito.",
			browserNoVoices:
				"Available ang text-to-speech ng browser, pero walang mga boses na naibalik pa.",
			browserUnavailable: "Hindi available ang text-to-speech ng browser.",
			googleUnavailable:
				"Hindi available ang Google Cloud TTS mula sa naka-configure na API.",
			// Walang mga key para sa sample text ng preview: binabasa ito ng
			// binibigyang-test na boses, kaya sumusunod ang wika nito sa boses,
			// hindi sa locale ng interface.
			pollyUnavailable:
				"Hindi available ang AWS Polly mula sa naka-configure na API.",
			recommendedVoices: "Inirerekomendang mga boses",
			allVoices: "Lahat ng available na boses",
			previewVoice: "I-preview ang boses",
			stopPreview: "Itigil ang preview",
			applying: "Inilalapat…",
			ssmlPreviewUnsupported:
				"Hindi suportado ang SSML preview sa Browser backend.",
			pollySsmlHint:
				"May mga neural na boses ng Polly na tumatanggi sa ilang SSML tag (halimbawa, emphasis). Kung nabigo ang preview, gumamit ng mga basic na SSML tag.",
			mathHighlightParts:
				"Binibigyang-highlight ang bawat bahagi ng pormula habang binabasa; kapag hindi tiyak ang alignment, ang buong pormula ang ini-highlight.",
			mathHighlightBlock:
				"Ini-highlight ang bawat pormula bilang isang buong block sa halip na hatiin sa mga bahagi.",
			previewFailed: "Nabigo ang pag-play ng preview audio.",
			previewNoAudio: "Walang audio content ang sagot ng preview.",
			previewEnterText:
				"Maglagay ng preview text bago magsimulang mag-play.",
			previewUnavailable:
				"Hindi maaaring mag-preview habang hindi available ang serbisyong ito.",
			browserSynthesisUnavailable:
				"Hindi available ang speech synthesis ng browser.",
			ssmlWordTrackingDisabled:
				"Pinapanatili ng Google SSML preview ang orihinal na SSML, kaya naka-disable ang word tracking.",
			applyUnavailable:
				"Hindi maaaring i-apply ang mga setting habang hindi available ang serbisyong ito.",
			coordinatorUnavailable:
				"Hindi available ang toolkit coordinator para sa mga update ng text-to-speech.",
			customProviderNotRegistered:
				"Hindi naka-register ang custom provider '{id}'.",
			customProviderNoConfig:
				"Hindi nagbalik ng apply config ang custom provider '{id}'.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Hindi kilalang error",
			previewRequestFailed: "Nabigo ang preview request ({status}).",
			notAvailable: "n/a",
			voiceLocal: "local",
			voiceRemote: "remote",
			voiceBrowserDefault: "default ng browser",
			browserAvailable: {
				one: "Available ang TTS ng browser (na-detect na {count} boses).",
				other: "Available ang TTS ng browser (na-detect na {count} boses).",
			},
			pollyAvailable: {
				one: "Available ang AWS Polly ({count} katugmang boses, {engine} engine).",
				other: "Available ang AWS Polly ({count} katugmang boses, {engine} engine).",
			},
			googleAvailable: {
				one: "Available ang Google Cloud TTS ({count} katugmang boses).",
				other: "Available ang Google Cloud TTS ({count} katugmang boses).",
			},
			headerRowReservation: "Reserbasyon ng row ng header ng item: {state}",
			speedOptionsHelp:
				"Mga multiplier na pinaghihiwalay ng kuwit o semicolon. Isama ang 1 para sa Normal; iwanang blangko para itago ang mga speed control.",
			usingSelectedVoice: "Ginagamit ang napiling boses: {voice}",
			autoVoice: "Pinakamahusay na available na boses (auto): {voice}",
			autoVoiceWaiting:
				"Pinakamahusay na available na boses (auto): naghihintay sa mga boses ng browser.",
			previewHintBrowserSsml:
				"Hindi suportado ang SSML sa browser preview.",
			previewHintGoogleSsml: "Napanatili ang SSML. Naka-disable ang tracking.",
			previewHintCustom:
				"Naka-enable ang tracking kapag nagbalik ng speech marks ang provider.",
			previewHintTracking: "Naka-enable ang tracking habang tumutugtog ang preview.",
			formatMp3: "MP3",
			formatOgg: "OGG",
			formatPcm: "PCM",
			sampleRate8000: "8000 Hz",
			sampleRate16000: "16000 Hz",
			sampleRate22050: "22050 Hz",
			sampleRate24000: "24000 Hz",
			apiEndpointPlaceholder: "/api/tts",
			languagePlaceholder: "en-US",
			ssml: "SSML",
		},
	},
};

export default fil;
