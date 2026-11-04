/**
 * Haitian Creole message catalog — reviewed (agent generation-and-review pass
 * in lieu of a native reader, 2026-11-04; see `reviewedBy` in
 * `catalog-manifest.json`).
 *
 * Serves every Haitian Creole host: registered under the bare `ht` tag, so
 * `ht` and `ht-HT` widen to it. Content flavour is Haitian Kreyòl in the
 * reformed (1975/1987) orthography per `briefs/ht.md` — the delivered unit is
 * `kesyon` inside an `egzamen`, sections are `seksyon`, passages are `tèks`;
 * the definite article is postposed (`egzamen an`, `tèks la`, `repons lan`)
 * and generic `ou` fills the subject slot where Creole grammar wants one.
 * State changes are announced as `te`-marked events (`Te louvri
 * kalkilatris debaz la`, `Te deplase anwo`, `Te chanje an…`) — Creole has no
 * participles, so the event register costs nothing. Plural groups carry the
 * CLDR one/other pair; Creole nouns do not inflect after numerals, so both
 * categories read alike.
 *
 * Regeneration is surgical, never wholesale: `scripts/check-catalogs.ts`
 * diffs the English snapshot (`ht.english-snapshot.json`) against the live
 * `en-US` source and lists exactly the keys whose English moved; translate
 * only those, keep every reviewed string, then refresh the snapshot per the
 * package README.
 *
 * @module @pie-players/pie-i18n-generated/messages/ht
 */

const ht = {
	common: {
		close: "Fèmen",
		cancel: "Anile",
		save: "Sove",
		reset: "Remèt",
		retry: "Reesaye",
		back: "Retounen",
		next: "Pwochen",
		previous: "Presedan",
		submit: "Soumèt",
		continue: "Kontinye",
		finish: "Fini",
		yes: "Wi",
		no: "Non",
		ok: "OK",
		any: "Nenpòt",
		off: "Etenn",
		auto: "Oto",
		all: "Tout",
		none: "Anyen",
		loading: "Ap chaje…",
		error: "Erè",
		settings: "Paramèt",
		language: "Lang",
		theme: "Tèm",
		preview: "Apèsi",
		author: "Kreyasyon",
		unknown: "Enkoni",
		untitled: "San tit",
		apply: "Aplike",
		enabled: "Aktive",
		disabled: "Dezaktive",
		lookUp: "Chèche",
		wordOrPhrase: "Mo oswa fraz",
		closeA11y: "Fèmen",
		settingsA11y: "Ouvri meni paramèt yo",
	},

	player: {
		passage: "Tèks",
		passages: "Tèks",
		question: "Kesyon",
		questionNumbered: "Kesyon {position}",
		questions: "Kesyon yo",
		items: "Kesyon yo",
		section: "Seksyon",
		loadingSection: "Ap chaje kontni seksyon an…",
		sectionLoadError: "Kontni seksyon an pa t ka chaje.",
		loadingPassage: "Ap chaje kontni tèks la…",
		configurationError: "Erè konfigirasyon",
		playerError: "Erè jwè a",
		authoringBackendError: "Erè konfigirasyon backend pou redaksyon kontni",
		itemLoadError: "Kesyon an pa t ka chaje.",
		sectionTabsA11y: "Tab kontni seksyon an",
		passagesRegionA11y: "Tèks yo",
		itemsRegionA11y: "Kesyon yo",
		sectionToolsA11y: "Zouti seksyon an",
		scrollDownA11y: "Defile anba",
		resizePanels: "Chanje gwosè panèl yo",
		resizePassagesAndItemsA11y:
			"Chanje gwosè panèl tèks yo ak panèl kesyon yo",
		resizeMediaRegion: "Chanje gwosè zòn medya a",
		resizeQuestionAndMediaA11y:
			"Chanje gwosè panèl kesyon an ak panèl medya a",
		resizePassageAndMediaA11y:
			"Chanje gwosè panèl tèks la ak panèl medya a",
		resizePassageAndQuestionA11y:
			"Chanje gwosè panèl tèks la ak panèl kesyon an",
		passageWidthA11y: "Lajè tèks la: {percent}%",
		questionPositionA11y: "Kesyon {position} sou {total}",
		questionPositionLabeledA11y: "{label}, kesyon {position} sou {total}",

		assessment: {
			sectionPosition: "Seksyon {position} sou {total}",
			noSections: "Pa gen seksyon",
			loadFailed: "Egzamen an pa t ka chaje. Eseye ankò.",
			restoreFailed:
				"Repons ou te sove pou seksyon sa a pa t ka retabli. Eseye ankò.",
		},

		formative: {
			checkAnswer: "Tcheke repons lan",
			tryAgain: "Eseye ankò",
			answerRecorded: "Repons lan anrejistre.",
			correct: "Kòrèk.",
			partlyCorrect: "Pasyèlman kòrèk.",
			notCorrect: "Pa kòrèk.",
			notAutoScored:
				"Repons lan anrejistre. Kesyon sa a pa evalye otomatikman.",
			checkFailed: "Kesyon sa a pa t ka tcheke. Eseye ankò.",
			triesLeft: {
				one: "{count} esè ki rete.",
				other: "{count} esè ki rete.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Kesyon yo ap parèt pandan medya a ap jwe.",
			questionAvailable: "Kesyon {position} disponib kounye a.",
			playbackPaused:
				"Jwe a kanpe. Reponn kesyon {position} pou kontinye.",
			playbackAdvisory:
				"Reponn kesyon {position} anvan ou kontinye ak medya a.",
			playbackReleased: "Repons lan aksepte. Kontinye jwe medya a.",
		},

		summary: {
			correctA11y: "Repons kòrèk",
			answer: "Repons",
			manualScoring: "Evalyasyon fèt pa yon pwofesè",
			audio: "Odyo",
			video: "Videyo",
		},
		list: {
			expandA11y: "Montre kesyon an antye",
			highlights: "Korespondans rechèch la",
			collapse: "Montre rezime a",
			playerError: "Kesyon an antye pa t ka chaje.",
		},
	},

	toolkit: {
		toolsA11y: "Zouti pou egzamen an",
		toolbarInitError: "Zouti egzamen an pa t ka demare.",
		settingsTitle: "Paramèt",
		closeSettingsA11y: "Fèmen paramèt yo",
		dragPanelA11y: "Tire panèl la",
		closePanelA11y: "Fèmen panèl la",
		resizeWindow: "Chanje gwosè fenèt la",
		minimize: "Redwi",
		maximize: "Agandi",
		minimizePanelA11y: "Redwi panèl la",
		maximizePanelA11y: "Agandi panèl la",

		window: {
			moveLeftA11y: "Deplace zouti a ale goch",
			moveRightA11y: "Deplace zouti a ale dwat",
			moveUpA11y: "Deplace zouti a anwo",
			moveDownA11y: "Deplace zouti a anba",
			narrowerA11y: "Fè fenèt zouti a pi estrik",
			widerA11y: "Fè fenèt zouti a pi laj",
			shorterA11y: "Fè fenèt zouti a pi kout",
			tallerA11y: "Fè fenèt zouti a pi wo",
			centerA11y: "Mete fenèt zouti a nan sant la",
			closeA11y: "Fèmen zouti a",
		},

		placement: {
			controlsA11y: "Deplace e vire",
			moveAndResizeA11y: "Deplace e chanje gwosè",
			rotateClockwiseA11y: "Vire {degrees}° nan sans kadrann an",
			rotateCounterclockwiseA11y: "Vire {degrees}° kont sans kadrann an",
		},

		announce: {
			movedUp: "Te deplase anwo nan {position}",
			movedDown: "Te deplase anba nan {position}",
			movedLeft: "Te deplase ale goch nan {position}",
			movedRight: "Te deplase ale dwat nan {position}",
			rotatedTo: "Te vire nan {degrees} degre",
		},
	},

	tools: {
		calculator: {
			name: "Kalkilatris",
			nameBasic: "Kalkilatris Debaz",
			nameScientific: "Kalkilatris Syantifik",
			nameGraphing: "Kalkilatris Grafik",
			description:
				"Kalkilatris anpil tip (debaz, syantifik, grafik)",
			// Anons chanjman eta kòm evènman ki make ak `te` — kreyòl pa gen
			// patisip, kidonk rejis evènman an koute anyen.
			openedBasic: "Te louvri kalkilatris debaz la",
			openedScientific: "Te louvri kalkilatris syantifik la",
			openedGraphing: "Te louvri kalkilatris grafik la",
			closedBasic: "Te fèmen kalkilatris debaz la",
			closedScientific: "Te fèmen kalkilatris syantifik la",
			closedGraphing: "Te fèmen kalkilatris grafik la",
			toolA11y: "Kalkilatris",
			loading: "Ap chaje kalkilatris la…",
			providerUnavailable: "Kalkilatris la pa disponib.",
			initFailed: "Kalkilatris la pa t ka demare.",
		},
		graph: {
			name: "Graf",
			description: "Plan kowòdone",
			buttonA11y: "Graf, plan kowòdone",
			tooltip: "Graf",
			toolA11y:
				"Zouti graf — mete pwen e trase liy sou plan kowòdone a",
			canvasA11y:
				"Kanvas graf la — sèvi ak zouti yo pou mete pwen e trase liy",
			grid: "Griy:",
			gridOpacityA11y: "Opasite griy la",
			pointA11y: "Pwen {id}",
			modeSelector: "Chwazi",
			modeSelectorHint:
				"Chwazi: klike e rale pwen yo pou deplace yo oswa liy ki konekte ak yo.",
			modePoint: "Pwen",
			modePointHint: "Pwen: klike sou griy la pou ajoute pwen.",
			modeLine: "Liy",
			modeLineHint:
				"Liy: klike sou yon pwen depa, apre sa yon pwen rive, pou trase yon liy.",
			modeDelete: "Efase",
			modeDeleteHint:
				"Efase: klike sou yon pwen pou efase l ak tout liy ki konekte ak li.",
		},
		periodicTable: {
			name: "Tablo Periyodik",
			description: "Referans tablo periyodik chimi",
			buttonA11y: "Tablo Periyodik, referans chimi",
			tooltip: "Tablo Periyodik",
			toolA11y:
				"Tablo periyodik — chwazi yon elemen pou wè detay li",
			elementsA11y: "Elemen tablo periyodik la",
			showAllA11y: "Montre tout elemen yo",
			allElements: "Tout Elemen",
			atomicMass: "Mas Atomik",
			atomicNumber: "Nimewo Atomik",
			electronConfig: "Konfigirasyon Elektwon",
			phase: "Eta",
			filterByA11y: "Filte dapre {category}",
			elementA11y:
				"{name}, senbòl: {symbol}, nimewo atomik: {number}, mas atomik: {mass}, kategori: {category}",
			outsideFilterA11y: ", deyò filt aktyèl la",
			category: {
				unknown: "Enkoni",
				alkaliMetal: "Metal Alkalin",
				alkalineEarthMetal: "Metal Alkalin Tè",
				transitionMetal: "Metal Tranzisyon",
				postTransitionMetal: "Metal Pòs-Tranzisyon",
				metalloid: "Metaloyd",
				diatomicNonmetal: "Nonmetal Dyatomik",
				polyatomicNonmetal: "Nonmetal Polyatomik",
				nobleGas: "Gaz Nob",
				lanthanide: "Lantanid",
				actinide: "Aktinid",
			},
			phaseValue: {
				solid: "Solid",
				liquid: "Likid",
				gas: "Gaz",
			},
		},
		ruler: {
			name: "Règ",
			description: "Règ sou ekran pou mezire",
			buttonA11y: "Règ",
			tooltip: "Règ",
			toolA11y: "Zouti mezi règ ki ka deplace e vire",
			unitSelectionA11y: "Seleksyon inite règ la",
			inches: "Pous",
			centimeters: "Sentimèt",
			inchesInSentence: "pous",
			centimetersInSentence: "sentimèt",
			switchToInchesA11y: "Chanje an pous",
			switchToCentimetersA11y: "Chanje an sentimèt",
			switchedTo: "Te chanje an {unit}",
			applicationA11y:
				"Zouti règ la. Sèvi ak flèch yo pou deplace l, Shift+flèch pou vire l, PageUp oswa PageDown pou vire l pi presi, U pou chanje inite a. Inite aktyèl: {unit}",
			imageAlt: "Règ ki montre {unit}",
		},
		protractor: {
			name: "Rapòtè",
			description: "Rapòtè sou ekran pou mezire ang",
			buttonA11y: "Rapòtè",
			tooltip: "Rapòtè",
			toolA11y:
				"Zouti rapòtè. Sèvi ak flèch yo pou deplace l, Shift+flèch pou vire l, e PageUp oswa PageDown pou vire l pi presi.",
			roleA11y: "Rapòtè pou mezi ang ki ka deplace e vire",
			imageAlt:
				"Rapòtè ak yon eskal mwatye-sèk 180 degre ki make soti 0 rive 180 degre nan toude direksyon yo, ak yon mak chak 10 degre",
		},
		dictionary: {
			name: "Diksyonè",
			description: "Chèche definisyon mo",
			buttonA11y: "Diksyonè, chèche definisyon mo",
			tooltip: "Diksyonè",
			toolA11y: "Diksyonè",
			notConfigured: "Pa gen sèvis diksyonè ki konfigire pou egzamen sa a.",
			idleHint: "Tape yon mo pou chèche l.",
			lookingUp: "Ap chèche «{term}»…",
			noEntryFor: "Pa gen atik pou «{term}».",
			// Non kreyòl yo pa enflechi apre nimewo, kidonk toude kategori
			// gen menm tèks la.
			entriesCount: {
				one: "{count} atik",
				other: "{count} atik",
			},
			noEntryStatusFor: "Pa gen atik diksyonè pou {term}.",
		},
		pictureDictionary: {
			name: "Diksyonè Imaj",
			description: "Chèche imaj pou mo",
			buttonA11y: "Diksyonè Imaj, chèche imaj pou mo",
			tooltip: "Diksyonè Imaj",
			toolA11y: "Diksyonè Imaj",
			notConfigured:
				"Pa gen sèvis diksyonè imaj ki konfigire pou egzamen sa a.",
			idleHint: "Tape yon mo pou wè yon imaj li.",
			lookingUp: "Ap chèche «{term}»…",
			noEntryFor: "Pa gen imaj pou «{term}».",
			entriesCount: {
				one: "{count} imaj",
				other: "{count} imaj",
			},
			noEntryStatusFor: "Pa gen imaj pou {term}.",
		},
		dictionarySpanish: {
			name: "Diksyonè Panyòl",
			description: "Chèche definisyon mo an panyòl",
			buttonA11y: "Diksyonè Panyòl, chèche definisyon mo an panyòl",
			tooltip: "Diksyonè Panyòl",
			toolA11y: "Diksyonè Panyòl",
		},
		pictureDictionarySpanish: {
			name: "Diksyonè Imaj Panyòl",
			description: "Chèche imaj pou mo an panyòl",
			buttonA11y: "Diksyonè Imaj Panyòl, chèche imaj pou mo an panyòl",
			tooltip: "Diksyonè Imaj Panyòl",
			toolA11y: "Diksyonè Imaj Panyòl",
		},
		lineReader: {
			name: "Gid Lekti",
			description: "Gid lekti ki kouvri tèks la",
			buttonA11y: "Gid Lekti, gid pou lekti",
			tooltip: "Gid Lekti",
			roleA11y: "Gid lekti ki kouvri tèks la, ki ka deplace e chanje gwosè",
			close: "Fèmen gid lekti a",
			resizeWindowA11y: "Tire pou chanje gwosè fenèt lekti a",
			resizeFrameA11y:
				"Tire pou chanje gwosè kadr la ak lajè fenèt la",
			windowHeightAnnounce: "Wotè fenèt lekti a: {pixels} piksèl",
			frameHeightAnnounce: "Wotè kadr la: {pixels} piksèl",
			widthAnnounce: "Lajè: {pixels} piksèl",
			shorterWindowA11y: "Fè fenèt lekti a pi kout",
			tallerWindowA11y: "Fè fenèt lekti a pi wo",
			shorterFrameA11y: "Fè kadr la pi kout",
			tallerFrameA11y: "Fè kadr la pi wo",
			narrowerA11y: "Fè gid lekti a pi estrik",
			widerA11y: "Fè gid lekti a pi laj",
			applicationA11y:
				"Zouti Gid Lekti. Yon fenèt lekti klè andedan yon kadr ki kouvri tèks la. Sèvi ak flèch yo pou deplace l, +/- pou chanje gwosè fenèt lekti a, ak Escape pou fèmen l. Wotè fenèt lekti a: {paneHeight} piksèl, wotè kadr la: {frameHeight} piksèl",
			resizeWindowFullA11y:
				"Chanje gwosè fenèt lekti a. Tire l, oswa sèvi ak flèch anwo ak anba pou chanje wotè li. Wotè aktyèl: {paneHeight} piksèl",
			resizeFrameFullA11y:
				"Chanje gwosè kadr la. Tire l, oswa sèvi ak flèch anwo ak anba pou chanje wotè kadr la ak flèch ale goch ak ale dwat pou chanje lajè li. Wotè kadr la aktyèl: {frameHeight} piksèl, lajè: {width} piksèl",
		},
		magnification: {
			// "Loupe" fransè a vin "lou" ("lèd") nan kreyòl — homonim entèdi.
			// Konpoze transparent la pran plas li.
			name: "Vè Agandisman",
			description: "Agandi kontni an anba yon lens ki ka deplace",
			buttonA11y: "Vè Agandisman, agandi kontni an anba yon lens",
			tooltip: "Vè Agandisman",
			roleA11y: "Lens ki ka deplace e chanje gwosè",
			applicationA11y:
				"Vè Agandisman nan {zoom} fwa. Sèvi ak flèch yo pou deplace lens la, + ak - pou chanje zoom la, ak Escape pou fèmen.",
			zoomIn: "Agandi",
			zoomOut: "Redwi",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Te agandi nan {zoom} fwa",
			close: "Fèmen vè agandisman an",
			resizeA11y: "Tire pou chanje gwosè vè agandisman an",
			resizeFullA11y:
				"Chanje gwosè vè agandisman an. Tire l, oswa sèvi ak flèch yo. Gwosè aktyèl: {width} × {height} piksèl",
			sizeAnnounce: "Gwosè vè agandisman an: {width} × {height} piksèl",
			narrowerA11y: "Fè vè agandisman an pi estrik",
			widerA11y: "Fè vè agandisman an pi laj",
			shorterA11y: "Fè vè agandisman an pi kout",
			tallerA11y: "Fè vè agandisman an pi wo",
		},
		answerEliminator: {
			name: "Bare Repons",
			description: "Bare chwa repons yo",
			buttonA11y: "Bare, eliminen chwa repons yo",
			tooltip: "Bare",
			toggleA11y: "Chanje bare pou {choice}",
			eliminatedA11y: "(bare)",
			unlabeledChoice: "Chwa san etikèt",
		},
		highlighter: {
			name: "Makè",
			description: "Make e anote tèks",
			buttonA11y: "Make tèks la",
			tooltip: "Make",
		},
		annotationToolbar: {
			name: "Anotasyon",
			description: "Make e anote tèks",
			buttonA11y: "Anote, make e mete mak sou tèks la",
			// Pa "Make" — se tooltip makè a; de bouton bar ki gen menm
			// etikèt vizib la se yon defo, se pa yon chwa stil.
			tooltip: "Anote",
			toolbarA11y: "Bar anotasyon tèks la",
			underline: "Souliye",
			underlineA11y: "Souliye tèks ki seleksyone a",
			readAloud: "Li Fò",
			readAloudA11y: "Li fò tèks ki seleksyone a",
			remove: "Retire",
			removeA11y: "Retire anotasyon sa a",
			clearAll: "Efase Tout",
			clearAllA11y: "Efase tout anotasyon nan dokiman an",
			highlightYellowA11y: "Mak Jòn",
			highlightPinkA11y: "Mak Woz",
			highlightBlueA11y: "Mak Ble",
			highlightGreenA11y: "Mak Vèt",
		},
		theme: {
			name: "Tèm",
			description: "Tèm aksesib ak kontras",
			buttonA11y: "Tèm, chanje koulè ak kontras",
			tooltip: "Tèm",
			selectorA11y: "Seleksyon tèm",
			hint: "Chwazi yon tèm pou amelyore lizibilite e redwi fatig je.",
			selectA11y: "Chwazi tèm",
			selectCurrentA11y: "Chwazi tèm. Tèm aktyèl: {name}",
			optionUnavailableA11y: "{name}, pa disponib",
			unavailableName: "Tèm ki pa disponib: {id}",
			unavailableDescription:
				"Pandan tèm sa a pa disponib, tèm debaz ki PIE ap jere ap kontinye aktif.",
			unavailableStatus:
				"Tèm ou te chwazi a pa disponib. Pandan li pa disponib, tèm debaz ki PIE ap jere ap kontinye aktif.",
		},
		textToSpeech: {
			name: "Lekti",
			description: "Li kontni an fò",
			initFailed: "Pa t ka demare lekti a. Eseye ankò.",
			inline: {
				controlsA11y: "Kontwòl lekti a",
				playbackSpeedA11y: "Vitès lekti a",
				rewindA11y: "Tounen An Aryè",
				fastForwardA11y: "Avanse",
				stopA11y: "Sispann lekti a",
				starting: "Lekti a ap kòmanse",
				started: "Lekti a te kòmanse",
				resumed: "Lekti a te repri",
				pausedAnnouncement: "Lekti a te kanpe",
				stopped: "Lekti a te sispann",
				switchedSection: "Lekti a te chanje pou yon lòt seksyon",
				nothingToRead: "Pa gen anyen pou li fò isit la",
				startFailed: "Pa t ka kòmanse lekti a",
				skippedForward: "Te avanse",
				skipForwardFailed: "Pa t ka avanse",
				skippedBackward: "Te tounen an aryè",
				skipBackwardFailed: "Pa t ka tounen an aryè",
				speedChangeFailed: "Pa t ka chanje vitès lekti a",
				speedAnnounce: "Vitès lekti a: {label}",
				playA11y: "Kòmanse lekti a",
				pauseA11y: "Kanpe lekti a",
				resumeA11y: "Repri lekti a",
			},
		},
		signLanguage: {
			name: "Lang Siny",
			description: "Vèsyon an lang siny pou kontni an",
			// Ti let nan mitan fraz; regionA11y konpoze "Tradiksyon an {language}".
			generic: "lang siny",
			unknown: "Lang Siny ({code})",
			ase: "Lang Siny Ameriken",
			bfi: "Lang Siny Britanik",
			fsl: "Lang Siny Fransè",
			gss: "Lang Siny Grek",
			mfs: "Lang Siny Meksiken",
			signedEnglish: "Anglè Siye",
			regionA11y: "Tradiksyon an {language}",
		},
		audioTranscript: {
			name: "Transkripsyon Odyo",
			description: "Transkripsyon tèks pou kontni odyo",
			regionA11y: "Transkripsyon",
		},
	},

	debug: {
		session: "Sesyon",
		sessionData: "Done Sesyon",
		sessionDataPersistent: "Done Sesyon PIE (Pèmanan)",
		noItemSessionYet:
			"Pa gen done sesyon item ankò. Fè entèaksyon ak item la pou wè misajou yo isit la.",
		itemSessionsSnapshot: "Snapshot Sesyon Item yo",
		sectionControllerUnavailable:
			"Kontwolè seksyon sa a poko disponib.",
		filteredModel: "Modèl Filtre",
		environment: "Anviwònman",
		events: "Evènman",
		controllerEvents: "Evènman Kontwolè a",
		instrumentation: "Enstrumantasyon",
		databaseState: "Eta baz done a",
		sessionDb: "Baz done sesyon (Sèvè)",
		noRows: "Pa gen ranje",
		noRecords: "Pa gen anrejistreman enstrumantasyon ankò.",
		selectRecord: "Chwazi yon anrejistreman pou wè detay yo.",
		selectEvent: "Chwazi yon evènman pou wè detay payload la.",
		showRawTables: "Montre tablo bri yo",
		showReconstructedSnapshots: "Montre snapshot rekonstitye yo",
		showSectionRequest: "Montre demann seksyon an",
		showAssessmentRequest: "Montre demann egzamen an",
		liveUpdatesUnsupported:
			"Misajou an dirèk pa sipòte nan navigatè sa a",
		liveUpdatesDisconnected:
			"Misajou an dirèk dekonekte; ap eseye ankò…",
		fieldType: "Tip:",
		fieldTarget: "Sib:",
		fieldItem: "Item:",
		fieldCanonical: "Kanonik:",
		fieldIntent: "Entansyon:",
		fieldDuplicates: "Dublon:",
		fieldSemanticRepeats: "Repèt Semantik:",
		dragItemSessionPanelA11y: "Tire panèl sesyon item la",
		debuggerTabsA11y: "Tab debogè yo",
		sessionDataJsonA11y: "JSON done sesyon",
		environmentJsonA11y: "JSON anviwònman an",
		filteredModelJsonA11y: "JSON modèl filtre a",
		sectionSessionJsonA11y: "JSON snapshot sesyon seksyon an",
		eventLevelFilterA11y: "Filte evènman pa nivo",
		controllerEventDetailsA11y: "Detay evènman kontwolè a",
		instrumentationFilterA11y: "Filte anrejistreman enstrumantasyon pa tip",
		instrumentationDetailsA11y: "Detay anrejistreman enstrumantasyon",
		toggleSessionPanelA11y: "Chanje panèl sesyon an",
		toggleEventPanelA11y: "Chanje panèl evènman an",
		toggleDatabasePanelA11y: "Chanje panèl eta baz done a",
		toggleInstrumentationPanelA11y: "Chanje panèl enstrumantasyon an",

		// Aksyon panèl yo — ti let, tankou kwa dev angle a; chak locale
		// ranje pwòp rejis li.
		clear: "efase",
		pause: "kanpe",
		resume: "repri",
		controllerUnavailable: "kontwolè a pa disponib",
		noMatchingEvents:
			"Pa gen evènman koresponn ankò. Fè entèaksyon ak item la pou kaptire evènman kontwolè a.",
		noSectionSessionYet:
			"Pa gen done sesyon seksyon ankò. Fè entèaksyon ak kesyon yo pou wè misajou yo.",
		eventLevelItem: "item",
		eventLevelSection: "seksyon",
		// Idantifyan ki tip anrejistreman yo — literal nan chak locale.
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		// Etikèt pou detay enstrumantasyon yo.
		instrumentationFieldName: "non:",
		instrumentationFieldKind: "kalite:",
		instrumentationFieldProvider: "founisè:",
		instrumentationFieldTimestamp: "dat-lè:",
		instrumentationFieldValue: "valè:",
		instrumentationFieldError: "erè:",
		// Non baz done sesyon an — idantifyan, literal nan chak locale.
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",

		pnp: {
			title: "Pwofil PNP",
			noAssessmentBound: "Pa gen egzamen ki lye",
			noAssessmentBoundBody:
				"Pwofil la, distri a ak politik administrasyon tès la pa gen anyen pou li, kidonk se sèlman requiredTools item la ki ka akòde yon akomodasyon. Mete egzamen an nan pwopriyete assessment toolkit la, oswa rele updateAssessment(...) sou koordinatè toolkit la.",
			determinationReadOnly: "Detèminasyon (lekti sèlman)",
			toolsEditor: "Editè Zouti",
			enforcement: "Aplikasyon PNP",
			allAvailableTools: "Tout zouti disponib yo",
			clearPlacement: "Efase plasman an",
			tool: "Zouti",
			placement: "Plasman",
			provider: "Founisè",
			simulation: "Similasyon PNP",
			resolvedTools: "Zouti Rezoud (toolkit)",
			provenanceSummary: "Rezime Orijin Politik Zouti",
			perToolDecisions: "Desizyon Pou Chak Zouti",
			policyDiagnostics: "Dyagnostik Politik",
			profileReadOnly: "Pwofil PNP (lekti sèlman)",
			on: "Alim",
			effective: "Efektif:",
			needs: "bezwen",
			hostSurfaceNotPlaced: "sifas host la (pa gen plasman)",
			support: "pèmèt",
			prohibit: "entèdi",
		},

		tts: {
			title: "Paramèt Lekti a",
			closeA11y: "Fèmen paramèt lekti a",
			toolbarLayoutMode: "Fason layout bar zouti a",
			reservedRow: "Ranje Rezève",
			expandingRow: "Ranje ki elaji",
			floatingOverlay: "Sipèpozisyon Flotan",
			leftAlignedControls: "Kontwòl ki aliyen ale goch",
			inlineSpeedButtons: "Bouton vitès enliy",
			resetToDefaults: "Remèt valè pa defo yo",
			mathHighlighting: "Maraj matematik",
			checkingAvailability: "Ap tcheke disponiblite…",
			recheck: "Tcheke ankò",
			voice: "Vwa",
			bestAvailableVoice: "Pi bon vwa disponib (oto)",
			unnamedVoice: "Vwa san non",
			apiEndpoint: "Endpoint API",
			gender: "Sèks",
			any: "Nenpòt",
			male: "Gason",
			female: "Fanm",
			neutral: "Nètral",
			engine: "Motè",
			neural: "Neural",
			standard: "Estanda",
			providerDefault: "Default founisè a",
			format: "Fòma",
			sampleRate: "Frekans echantiyonaj",
			speechMarks: "Mak pawòl",
			word: "Mo",
			wordAndSentence: "Mo + fraz",
			voiceType: "Tip vwa",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Tèks senp",
			sampleText: "Tèks egzanp",
			resetSample: "Remèt tèks egzanp la",
			providerAvailable: "Founisè a disponib.",
			providerUnavailable: "Founisè a pa disponib.",
			providerCheckFailed: "Tcheke disponiblite founisè a pa reyisi.",
			providerNotChecked: "Disponiblite founisè a poko tcheke.",
			webSpeechUnavailable:
				"Web Speech API pa disponib nan navigatè sa a.",
			browserNoVoices:
				"Sentez vwa navigatè a disponib, men poko gen vwa ki t retounen.",
			browserUnavailable: "Sentez vwa navigatè a pa disponib.",
			googleUnavailable:
				"Google Cloud TTS pa disponib depi API ki konfigire a.",
			// Pa gen kle pou tèks egzanp apèsi a: se vwa ki t ap tès la ki
			// pale l, kidonk lang li swiv vwa a, pa locale entèfas la.
			pollyUnavailable:
				"AWS Polly pa disponib depi API ki konfigire a.",
			recommendedVoices: "Vwa ki rekòmande yo",
			allVoices: "Tout vwa disponib yo",
			previewVoice: "Tande vwa a",
			stopPreview: "Kanpe apèsi a",
			applying: "Ap aplike…",
			ssmlPreviewUnsupported:
				"Apèsi SSML pa sipòte nan backend navigatè a.",
			pollySsmlHint:
				"Gen kèk vwa neural Polly ki refize sèten tag SSML (pa egzanp, emphasis). Si apèsi a pa mache, sèvi ak tag SSML debaz.",
			mathHighlightParts:
				"Ap make chak pati nan yon fòmil pandan li ap li l; lè aliyman an ensèten, li make tout fòmil la.",
			mathHighlightBlock:
				"Ap make chak fòmil kòm yon sèl blòk olye pou dekoupe l an pati.",
			previewFailed: "Jwe odyo apèsi a pa reyisi.",
			previewNoAudio: "Repons apèsi a pa te genyen odyo.",
			previewEnterText: "Antre tèks apèsi a anvan ou kòmanse jwe.",
			previewUnavailable:
				"Pa ka fè apèsi pandan sèvis sa a pa disponib.",
			browserSynthesisUnavailable: "Sentez vwa navigatè a pa disponib.",
			ssmlWordTrackingDisabled:
				"Apèsi SSML Google la konsève SSML otè a, kidonk swiv mo yo dezaktive.",
			applyUnavailable:
				"Pa ka aplike paramèt yo pandan sèvis sa a pa disponib.",
			coordinatorUnavailable:
				"Koordinatè toolkit la pa disponib pou misajou lekti a.",
			customProviderNotRegistered:
				"Founisè pèsonalize '{id}' la pa anrejistre.",
			customProviderNoConfig:
				"Founisè pèsonalize '{id}' la pa t retounen konfigirasyon pou aplike.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Erè enkoni",
			previewRequestFailed: "Demann apèsi a pa reyisi ({status}).",
			notAvailable: "n/a",
			voiceLocal: "Lokal",
			voiceRemote: "Distan",
			voiceBrowserDefault: "Default navigatè a",
			browserAvailable: {
				one: "Sentez vwa navigatè a disponib ({count} vwa detekte).",
				other: "Sentez vwa navigatè a disponib ({count} vwa detekte).",
			},
			pollyAvailable: {
				one: "AWS Polly disponib ({count} vwa koresponn, motè {engine}).",
				other: "AWS Polly disponib ({count} vwa koresponn, motè {engine}).",
			},
			googleAvailable: {
				one: "Google Cloud TTS disponib ({count} vwa koresponn).",
				other: "Google Cloud TTS disponib ({count} vwa koresponn).",
			},
			headerRowReservation: "Rezèv ranj header item la: {state}",
			speedOptionsHelp:
				"Miltiplikatè separe pa vigil oswa pwen-vigil. Mete 1 pou Nòmal; kite vid pou kache kontwòl vitès yo.",
			usingSelectedVoice: "Ap sèvi ak vwa ki chwazi a: {voice}",
			autoVoice: "Pi bon vwa disponib (oto): {voice}",
			autoVoiceWaiting:
				"Pi bon vwa disponib (oto): ap tann vwa navigatè a.",
			previewHintBrowserSsml:
				"SSML pa sipòte nan apèsi navigatè a.",
			previewHintGoogleSsml: "SSML konsève. Swiv dezaktive.",
			previewHintCustom:
				"Swiv aktif lè founisè a retounen mak pawòl.",
			previewHintTracking: "Swiv aktif pandan apèsi a ap jwe.",
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

export default ht;
