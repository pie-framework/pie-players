/**
 * Italian message catalog — reviewed (agent pass in lieu of a native reader,
 * 2026-11-04; see `reviewedBy` in `catalog-manifest.json`).
 *
 * Serves every Italian host: registered under the bare `it` tag, so `it`,
 * `it-IT` and `it-CH` all widen to it. Content flavour is standard Italian as
 * Italian school and assessment software writes it, per `briefs/it.md` —
 * domain register first (`domanda` for a delivered question, `brano` for a
 * reading passage, `prova` for the assessment, `piano cartesiano`,
 * `Rapportatore`, `Tavola periodica`, `sintesi vocale` for browser
 * read-aloud). Controls carry the impersonal infinitive; sentences stay
 * impersonal (`Non è stato possibile…`), state changes are authored as
 * events with a real subject or an event noun (`La risposta è stata
 * registrata.`, `Apertura della calcolatrice base`, `Spostamento in alto
 * verso {position}`) — never dangling gendered participles — and quotation
 * marks are the caporali « ».
 *
 * Regeneration is surgical, never wholesale: `scripts/check-catalogs.ts`
 * diffs the English snapshot (`it.english-snapshot.json`) against the live
 * `en-US` source and lists exactly the keys whose English moved; translate
 * only those, keep every reviewed string, then refresh the snapshot per the
 * package README.
 *
 * @module @pie-players/pie-i18n-generated/messages/it
 */

const it = {
	common: {
		close: "Chiudere",
		cancel: "Annullare",
		save: "Salvare",
		reset: "Ripristinare",
		retry: "Riprovare",
		back: "Indietro",
		next: "Avanti",
		previous: "Precedente",
		submit: "Consegnare",
		continue: "Continuare",
		finish: "Terminare",
		yes: "Sì",
		no: "No",
		ok: "OK",
		any: "Qualsiasi",
		off: "Disattivato",
		auto: "Automatico",
		all: "Tutti",
		none: "Nessuno",
		loading: "Caricamento…",
		error: "Errore",
		settings: "Impostazioni",
		language: "Lingua",
		theme: "Tema",
		preview: "Anteprima",
		author: "Modifica",
		unknown: "Sconosciuto",
		untitled: "Senza titolo",
		apply: "Applicare",
		enabled: "Attivato",
		disabled: "Disattivato",
		lookUp: "Cercare",
		wordOrPhrase: "Parola o frase",
		closeA11y: "Chiudere",
		settingsA11y: "Aprire il menu delle impostazioni",
	},

	player: {
		passage: "Brano",
		passages: "Brani",
		question: "Domanda",
		questionNumbered: "Domanda {position}",
		questions: "Domande",
		items: "Domande",
		section: "Sezione",
		loadingSection: "Caricamento del contenuto della sezione…",
		sectionLoadError: "Non è stato possibile caricare il contenuto della sezione.",
		loadingPassage: "Caricamento del contenuto del brano…",
		configurationError: "Errore di configurazione",
		playerError: "Errore del player",
		authoringBackendError:
			"Errore di configurazione del backend di creazione",
		itemLoadError: "Non è stato possibile caricare la domanda.",
		sectionTabsA11y: "Schede del contenuto della sezione",
		passagesRegionA11y: "Brani",
		itemsRegionA11y: "Domande",
		sectionToolsA11y: "Strumenti della sezione",
		scrollDownA11y: "Scorrere verso il basso",
		resizePanels: "Ridimensionare i pannelli",
		resizePassagesAndItemsA11y:
			"Ridimensionare i pannelli dei brani e delle domande",
		resizeMediaRegion: "Ridimensionare l'area multimediale",
		resizeQuestionAndMediaA11y:
			"Ridimensionare i pannelli della domanda e dei contenuti multimediali",
		resizePassageAndMediaA11y:
			"Ridimensionare i pannelli del brano e dei contenuti multimediali",
		resizePassageAndQuestionA11y:
			"Ridimensionare i pannelli del brano e della domanda",
		passageWidthA11y: "Larghezza del brano: {percent}%",
		questionPositionA11y: "Domanda {position} di {total}",
		questionPositionLabeledA11y: "{label}, domanda {position} di {total}",

		assessment: {
			sectionPosition: "Sezione {position} di {total}",
			noSections: "Nessuna sezione",
			loadFailed: "Non è stato possibile caricare la prova. Riprovare.",
			restoreFailed:
				"Non è stato possibile ripristinare le risposte salvate di questa sezione. Riprovare.",
		},

		formative: {
			checkAnswer: "Verificare la risposta",
			tryAgain: "Provare di nuovo",
			answerRecorded: "La risposta è stata registrata.",
			correct: "Corretta.",
			partlyCorrect: "Parzialmente corretta.",
			notCorrect: "Non corretta.",
			notAutoScored:
				"La risposta è stata registrata. Questa domanda non è valutata automaticamente.",
			checkFailed:
				"Non è stato possibile verificare questa domanda. Riprovare.",
			// Appended after the outcome, so the announcement reads
			// "Non corretta. Rimangono ancora 2 tentativi." Kept a separate
			// plural group rather than folded into each outcome, like English.
			triesLeft: {
				one: "Rimane ancora {count} tentativo.",
				many: "Rimangono ancora {count} tentativi.",
				other: "Rimangono ancora {count} tentativi.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Le domande appariranno durante la riproduzione del contenuto multimediale.",
			questionAvailable: "La domanda {position} è ora disponibile.",
			playbackPaused:
				"Riproduzione in pausa. Rispondere alla domanda {position} per continuare.",
			playbackAdvisory:
				"Rispondere alla domanda {position} prima di continuare con il contenuto multimediale.",
			playbackReleased:
				"Risposta accettata. Continuare la riproduzione del contenuto multimediale.",
		},

		summary: {
			correctA11y: "Risposta corretta",
			answer: "Risposta",
			manualScoring: "Valutata da un insegnante",
			audio: "Audio",
			video: "Video",
		},
		list: {
			expandA11y: "Mostrare la domanda completa",
			highlights: "Corrispondenze della ricerca",
			collapse: "Mostrare il riepilogo",
			playerError: "Non è stato possibile caricare la domanda completa.",
		},
	},

	toolkit: {
		toolsA11y: "Strumenti della prova",
		toolbarInitError: "Non è stato possibile avviare gli strumenti.",
		settingsTitle: "Impostazioni",
		closeSettingsA11y: "Chiudere le impostazioni",
		dragPanelA11y: "Trascinare il pannello",
		closePanelA11y: "Chiudere il pannello",
		resizeWindow: "Ridimensionare la finestra",
		minimize: "Ridurre a icona",
		maximize: "Ingrandire",
		minimizePanelA11y: "Ridurre a icona il pannello",
		maximizePanelA11y: "Ingrandire il pannello",

		window: {
			moveLeftA11y: "Spostare lo strumento a sinistra",
			moveRightA11y: "Spostare lo strumento a destra",
			moveUpA11y: "Spostare lo strumento in alto",
			moveDownA11y: "Spostare lo strumento in basso",
			narrowerA11y: "Ridurre la larghezza della finestra dello strumento",
			widerA11y: "Aumentare la larghezza della finestra dello strumento",
			shorterA11y: "Ridurre l'altezza della finestra dello strumento",
			tallerA11y: "Aumentare l'altezza della finestra dello strumento",
			centerA11y: "Centrare la finestra dello strumento",
			closeA11y: "Chiudere lo strumento",
		},

		placement: {
			controlsA11y: "Spostare e ruotare",
			moveAndResizeA11y: "Spostare e ridimensionare",
			rotateClockwiseA11y: "Ruotare di {degrees}° in senso orario",
			rotateCounterclockwiseA11y:
				"Ruotare di {degrees}° in senso antiorario",
		},

		// Movement and rotation are announced as event nouns, never gendered
		// participles — the tool's gender is not presumed.
		announce: {
			movedUp: "Spostamento in alto verso {position}",
			movedDown: "Spostamento in basso verso {position}",
			movedLeft: "Spostamento a sinistra verso {position}",
			movedRight: "Spostamento a destra verso {position}",
			rotatedTo: "Rotazione a {degrees} gradi",
		},
	},

	tools: {
		calculator: {
			name: "Calcolatrice",
			nameBasic: "Calcolatrice base",
			nameScientific: "Calcolatrice scientifica",
			nameGraphing: "Calcolatrice grafica",
			description:
				"Calcolatrice con più tipologie (base, scientifica, grafica)",
			// Announced by the inline calculator's toggle. One event sentence per
			// variant and state, authored whole — the event noun form, never a
			// dangling participle that would presume the tool's gender.
			openedBasic: "Apertura della calcolatrice base",
			openedScientific: "Apertura della calcolatrice scientifica",
			openedGraphing: "Apertura della calcolatrice grafica",
			closedBasic: "Chiusura della calcolatrice base",
			closedScientific: "Chiusura della calcolatrice scientifica",
			closedGraphing: "Chiusura della calcolatrice grafica",
			toolA11y: "Calcolatrice",
			loading: "Caricamento della calcolatrice…",
			providerUnavailable: "La calcolatrice non è disponibile.",
			initFailed: "Non è stato possibile inizializzare la calcolatrice.",
		},
		graph: {
			name: "Grafico",
			description: "Piano cartesiano",
			buttonA11y: "Grafico, piano cartesiano",
			tooltip: "Grafico",
			toolA11y:
				"Strumento Grafico: disegna punti e segmenti su un piano cartesiano",
			canvasA11y:
				"Area di disegno del grafico: usare gli strumenti per aggiungere punti e tracciare segmenti",
			grid: "Griglia:",
			gridOpacityA11y: "Opacità della griglia",
			pointA11y: "Punto {id}",
			modeSelector: "Selezionare",
			modeSelectorHint:
				"Selezionare: fare clic e trascinare i punti per spostarli o spostare i segmenti associati.",
			modePoint: "Punto",
			modePointHint: "Punto: fare clic sulla griglia per aggiungere punti.",
			modeLine: "Segmento",
			modeLineHint:
				"Segmento: fare clic su un punto di inizio e poi su un punto di fine per tracciare un segmento.",
			modeDelete: "Eliminare",
			modeDeleteHint:
				"Eliminare: fare clic su un punto per eliminarlo insieme ai segmenti collegati.",
		},
		periodicTable: {
			name: "Tavola periodica",
			description: "Riferimento chimico: Tavola periodica degli elementi",
			buttonA11y: "Tavola periodica, riferimento di chimica",
			tooltip: "Tavola periodica",
			toolA11y:
				"Tavola periodica — selezionare un elemento per visualizzarne i dettagli",
			elementsA11y: "Elementi della Tavola periodica",
			showAllA11y: "Mostrare tutti gli elementi",
			allElements: "Tutti gli elementi",
			atomicMass: "Massa atomica",
			atomicNumber: "Numero atomico",
			electronConfig: "Configurazione elettronica",
			phase: "Stato",
			filterByA11y: "Filtrare per {category}",
			// Field labels stay capitalized, like the English label register.
			elementA11y:
				"{name}, Simbolo: {symbol}, Numero atomico: {number}, Massa atomica: {mass}, Categoria: {category}",
			outsideFilterA11y: ", fuori dal filtro attuale",
			// IUPAC element categories, Italian chemistry nomenclature.
			category: {
				unknown: "Sconosciuta",
				alkaliMetal: "Metallo alcalino",
				alkalineEarthMetal: "Metallo alcalino-terroso",
				transitionMetal: "Metallo di transizione",
				postTransitionMetal: "Metallo del blocco p",
				metalloid: "Metalloide",
				diatomicNonmetal: "Non metallo diatomico",
				polyatomicNonmetal: "Non metallo poliatomico",
				nobleGas: "Gas nobile",
				lanthanide: "Lantanide",
				actinide: "Attinide",
			},
			phaseValue: {
				solid: "Solido",
				liquid: "Liquido",
				gas: "Gas",
			},
		},
		ruler: {
			name: "Righello",
			description: "Righello sullo schermo per le misurazioni",
			buttonA11y: "Righello",
			tooltip: "Righello",
			toolA11y: "Righello spostabile e ruotabile",
			unitSelectionA11y: "Selezione dell'unità del righello",
			// Italian does not capitalize common nouns, so the label and sentence
			// forms differ — the distinction the English source's comment draws.
			// Spelled out, never abbreviated: screen readers read every one of
			// these aloud.
			inches: "Pollici",
			centimeters: "Centimetri",
			inchesInSentence: "pollici",
			centimetersInSentence: "centimetri",
			switchToInchesA11y: "Passare ai pollici",
			switchToCentimetersA11y: "Passare ai centimetri",
			// The participle "Passato/Passata" would gender the switch, so the
			// event states its real subject instead.
			switchedTo: "Unità impostata su {unit}",
			applicationA11y:
				"Righello. Usare i tasti freccia per spostarlo, Shift+frecce per ruotarlo, PageUp o PageDown per una rotazione fine e U per cambiare unità. Unità attuale: {unit}",
			imageAlt: "Righello in {unit}",
		},
		protractor: {
			name: "Rapportatore",
			description: "Rapportatore sullo schermo per la misura degli angoli",
			buttonA11y: "Rapportatore",
			tooltip: "Rapportatore",
			toolA11y:
				"Rapportatore. Usare i tasti freccia per spostarlo, Shift+frecce per ruotarlo e PageUp o PageDown per una rotazione fine.",
			roleA11y: "Rapportatore spostabile e ruotabile",
			imageAlt:
				"Rapportatore con scala semicircolare di 180 gradi, contrassegnata da 0 a 180 gradi in entrambe le direzioni, con tacche ogni 10 gradi",
		},
		dictionary: {
			name: "Dizionario",
			description: "Cercare le definizioni delle parole",
			buttonA11y: "Dizionario, cercare le definizioni delle parole",
			tooltip: "Dizionario",
			toolA11y: "Dizionario",
			// The lookup panel's notices are authored whole: the term interpolates
			// into the sentence, never around it.
			notConfigured:
				"Per questa prova non è configurato alcun servizio di dizionario.",
			idleHint: "Digitare una parola per cercarla.",
			lookingUp: "Ricerca di «{term}» in corso…",
			noEntryFor: "Nessuna voce per «{term}».",
			entriesCount: {
				one: "{count} voce",
				many: "{count} voci",
				other: "{count} voci",
			},
			noEntryStatusFor: "Nessuna voce di dizionario per {term}.",
		},
		pictureDictionary: {
			name: "Dizionario illustrato",
			description: "Cercare le immagini delle parole",
			buttonA11y: "Dizionario illustrato, cercare le immagini delle parole",
			tooltip: "Dizionario illustrato",
			toolA11y: "Dizionario illustrato",
			notConfigured:
				"Per questa prova non è configurato alcun servizio di dizionario illustrato.",
			idleHint: "Digitare una parola per vederne un'immagine.",
			lookingUp: "Ricerca di «{term}» in corso…",
			noEntryFor: "Nessuna immagine per «{term}».",
			entriesCount: {
				one: "{count} immagine",
				many: "{count} immagini",
				other: "{count} immagini",
			},
			noEntryStatusFor: "Nessuna immagine per {term}.",
		},
		dictionarySpanish: {
			name: "Dizionario spagnolo",
			description: "Cercare le definizioni delle parole in spagnolo",
			buttonA11y:
				"Dizionario spagnolo, cercare le definizioni delle parole in spagnolo",
			tooltip: "Dizionario spagnolo",
			toolA11y: "Dizionario spagnolo",
		},
		pictureDictionarySpanish: {
			name: "Dizionario illustrato spagnolo",
			description: "Cercare le immagini delle parole in spagnolo",
			buttonA11y:
				"Dizionario illustrato spagnolo, cercare le immagini delle parole in spagnolo",
			tooltip: "Dizionario illustrato spagnolo",
			toolA11y: "Dizionario illustrato spagnolo",
		},
		lineReader: {
			name: "Guida di lettura",
			description: "Guida di lettura sovrapposta al testo",
			buttonA11y: "Guida di lettura, supporto per la lettura",
			tooltip: "Guida di lettura",
			roleA11y: "Guida di lettura sovrapposta, spostabile e ridimensionabile",
			close: "Chiudere la guida di lettura",
			resizeWindowA11y:
				"Trascinare per ridimensionare la finestra di lettura",
			resizeFrameA11y:
				"Trascinare per modificare la cornice e la larghezza della finestra",
			windowHeightAnnounce: "Altezza della finestra di lettura: {pixels} pixel",
			frameHeightAnnounce: "Altezza della cornice: {pixels} pixel",
			widthAnnounce: "Larghezza: {pixels} pixel",
			shorterWindowA11y: "Ridurre l'altezza della finestra di lettura",
			tallerWindowA11y: "Aumentare l'altezza della finestra di lettura",
			shorterFrameA11y: "Ridurre l'altezza della cornice",
			tallerFrameA11y: "Aumentare l'altezza della cornice",
			narrowerA11y: "Ridurre la larghezza della guida di lettura",
			widerA11y: "Aumentare la larghezza della guida di lettura",
			applicationA11y:
				"Guida di lettura. Una finestra di lettura chiara all'interno di una cornice che oscura il contenuto. Usare i tasti freccia per spostare, +/- per ridimensionare la finestra di lettura ed Escape per chiudere. Altezza della finestra di lettura: {paneHeight} pixel, altezza della cornice: {frameHeight} pixel",
			resizeWindowFullA11y:
				"Ridimensionare la finestra di lettura. Trascinare, oppure usare i tasti freccia su e giù per modificarne l'altezza. Altezza attuale: {paneHeight} pixel",
			resizeFrameFullA11y:
				"Ridimensionare la cornice. Trascinare, oppure usare i tasti freccia su e giù per modificare l'altezza della cornice e i tasti freccia destra e sinistra per modificarne la larghezza. Altezza attuale della cornice: {frameHeight} pixel, larghezza: {width} pixel",
		},
		magnification: {
			name: "Lente di ingrandimento",
			description: "Ingrandire il contenuto sotto una lente mobile",
			buttonA11y:
				"Lente di ingrandimento, ingrandire il contenuto sotto una lente",
			tooltip: "Lente di ingrandimento",
			roleA11y: "Lente di ingrandimento spostabile e ridimensionabile",
			applicationA11y:
				"Lente di ingrandimento a {zoom}x. Usare i tasti freccia per spostare la lente, + e - per modificare l'ingrandimento ed Escape per chiudere.",
			zoomIn: "Ingrandire",
			zoomOut: "Ridurre",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Ingrandimento di {zoom} volte",
			close: "Chiudere la lente di ingrandimento",
			resizeA11y: "Trascinare per ridimensionare la lente di ingrandimento",
			resizeFullA11y:
				"Ridimensionare la lente di ingrandimento. Trascinare, oppure usare i tasti freccia. Dimensione attuale: {width} per {height} pixel",
			sizeAnnounce: "Lente di ingrandimento {width} per {height} pixel",
			narrowerA11y: "Ridurre la larghezza della lente di ingrandimento",
			widerA11y: "Aumentare la larghezza della lente di ingrandimento",
			shorterA11y: "Ridurre l'altezza della lente di ingrandimento",
			tallerA11y: "Aumentare l'altezza della lente di ingrandimento",
		},
		answerEliminator: {
			name: "Barrare le risposte",
			description: "Barrare le opzioni di risposta",
			buttonA11y: "Barrare, escludere le opzioni di risposta",
			tooltip: "Barrare",
			toggleA11y: "Attivare o disattivare l'esclusione di {choice}",
			// Agrees with "opzione", the choice's own grammatical gender.
			eliminatedA11y: "(barrata)",
			unlabeledChoice: "Opzione senza etichetta",
		},
		highlighter: {
			name: "Evidenziatore",
			description: "Evidenziare e annotare il testo",
			buttonA11y: "Evidenziare il testo",
			tooltip: "Evidenziare",
		},
		annotationToolbar: {
			name: "Annotazione",
			description: "Evidenziare e annotare il testo",
			buttonA11y: "Annotare, evidenziare e contrassegnare il testo",
			// Not "Evidenziare": that is `tools.highlighter.tooltip`, and two
			// toolbar buttons carrying the same visible label is a defect.
			tooltip: "Annotare",
			toolbarA11y: "Barra degli strumenti per l'annotazione del testo",
			underline: "Sottolineare",
			underlineA11y: "Sottolineare il testo selezionato",
			readAloud: "Leggere ad alta voce",
			readAloudA11y: "Leggere ad alta voce il testo selezionato",
			remove: "Rimuovere",
			removeA11y: "Rimuovere questa annotazione",
			clearAll: "Cancellare tutto",
			clearAllA11y: "Cancellare tutte le annotazioni dal documento",
			highlightYellowA11y: "Evidenziazione gialla",
			highlightPinkA11y: "Evidenziazione rosa",
			highlightBlueA11y: "Evidenziazione blu",
			highlightGreenA11y: "Evidenziazione verde",
			selectionAvailableA11y:
				"Barra degli strumenti per l'annotazione disponibile per «{text}». Premere Shift+F10 per gli strumenti di annotazione.",
			highlightedYellowA11y: "Testo «{text}» evidenziato in giallo",
			highlightedPinkA11y: "Testo «{text}» evidenziato in rosa",
			highlightedBlueA11y: "Testo «{text}» evidenziato in blu",
			highlightedGreenA11y: "Testo «{text}» evidenziato in verde",
			underlinedA11y: "Testo «{text}» sottolineato",
			removedA11y: "Annotazione rimossa da «{text}»",
			clearedA11y: {
				one: "{count} annotazione cancellata",
				many: "{count} annotazioni cancellate",
				other: "{count} annotazioni cancellate",
			},
		},
		theme: {
			name: "Tema",
			description: "Temi accessibili e contrasto",
			buttonA11y: "Tema, cambiare colori e contrasto",
			tooltip: "Tema",
			selectorA11y: "Selettore del tema",
			hint: "Selezionare un tema per migliorare la leggibilità e ridurre l'affaticamento degli occhi.",
			selectA11y: "Selezionare il tema",
			selectCurrentA11y: "Selezionare il tema. Tema attuale: {name}",
			optionUnavailableA11y: "{name}, non disponibile",
			unavailableName: "Tema non disponibile: {id}",
			unavailableDescription:
				"Il tema di base gestito da PIE resta attivo finché questo tema non torna disponibile.",
			unavailableStatus:
				"Il tema selezionato non è disponibile. Il tema di base gestito da PIE resta attivo finché non torna disponibile.",
		},
		textToSpeech: {
			name: "Lettura ad alta voce",
			description: "Leggere il contenuto ad alta voce",
			initFailed:
				"Non è stato possibile avviare la lettura ad alta voce. Riprovare.",
			inline: {
				controlsA11y: "Controlli della lettura",
				playbackSpeedA11y: "Velocità di lettura",
				rewindA11y: "Riavvolgere",
				fastForwardA11y: "Avanzare rapidamente",
				stopA11y: "Interrompere la lettura",
				// Playback announcements state the subject "lettura" and agree
				// with it — the Italian event form for read-aloud states.
				starting: "Avvio della lettura",
				started: "Lettura avviata",
				resumed: "Lettura ripresa",
				pausedAnnouncement: "Lettura in pausa",
				stopped: "Lettura interrotta",
				switchedSection: "La lettura è passata a un'altra sezione",
				nothingToRead: "Qui non c'è nulla da leggere ad alta voce",
				startFailed: "Non è stato possibile avviare la lettura",
				skippedForward: "Lettura avanzata",
				skipForwardFailed: "Non è stato possibile avanzare rapidamente",
				skippedBackward: "Lettura riavvolta",
				skipBackwardFailed: "Non è stato possibile riavvolgere",
				speedChangeFailed:
					"Non è stato possibile modificare la velocità di lettura",
				speedAnnounce: "Velocità di lettura {label}",
				playA11y: "Avviare la lettura",
				pauseA11y: "Mettere in pausa la lettura",
				resumeA11y: "Riprendere la lettura",
			},
		},
		signLanguage: {
			name: "Lingua dei segni",
			description: "Versione in lingua dei segni del contenuto",
			generic: "Lingua dei segni",
			unknown: "Lingua dei segni ({code})",
			ase: "Lingua dei segni americana",
			bfi: "Lingua dei segni britannica",
			fsl: "Lingua dei segni francese",
			gss: "Lingua dei segni greca",
			mfs: "Lingua dei segni messicana",
			signedEnglish: "Inglese segnato",
			regionA11y: "Traduzione in {language}",
		},
		audioTranscript: {
			name: "Trascrizione audio",
			description: "Trascrizione testuale del contenuto audio",
			regionA11y: "Trascrizione",
		},
	},

	debug: {
		session: "Sessione",
		sessionData: "Dati della sessione",
		sessionDataPersistent: "Dati di sessione di PIE (persistenti)",
		noItemSessionYet:
			"Ancora nessun dato di sessione della domanda. Interagire con la domanda per vedere qui gli aggiornamenti.",
		itemSessionsSnapshot: "Istantanea delle sessioni delle domande",
		sectionControllerUnavailable:
			"Il controller di questa sezione non è ancora disponibile.",
		filteredModel: "Modello filtrato",
		environment: "Ambiente",
		events: "Eventi",
		controllerEvents: "Eventi del controller",
		instrumentation: "Strumentazione",
		databaseState: "Stato del database",
		sessionDb: "Database delle sessioni (server)",
		noRows: "Nessuna riga",
		noRecords: "Ancora nessun record di strumentazione.",
		selectRecord: "Selezionare un record per esaminarne i dettagli.",
		selectEvent:
			"Selezionare un evento per esaminare i dettagli del payload.",
		showRawTables: "Mostrare le tabelle grezze",
		showReconstructedSnapshots: "Mostrare le istantanee ricostruite",
		showSectionRequest: "Mostrare la richiesta della sezione",
		showAssessmentRequest: "Mostrare la richiesta della prova",
		liveUpdatesUnsupported:
			"Gli aggiornamenti in tempo reale non sono supportati in questo browser",
		liveUpdatesDisconnected:
			"Aggiornamenti in tempo reale disconnessi; nuovo tentativo…",
		fieldType: "Tipo:",
		fieldTarget: "Destinazione:",
		fieldItem: "Domanda:",
		fieldCanonical: "Canonico:",
		fieldIntent: "Intento:",
		fieldDuplicates: "Duplicati:",
		fieldSemanticRepeats: "Ripetizioni semantiche:",
		dragItemSessionPanelA11y: "Trascinare il pannello della sessione della domanda",
		debuggerTabsA11y: "Schede del debugger",
		sessionDataJsonA11y: "JSON dei dati di sessione",
		environmentJsonA11y: "JSON dell'ambiente",
		filteredModelJsonA11y: "JSON del modello filtrato",
		sectionSessionJsonA11y:
			"JSON dell'istantanea della sessione della sezione",
		eventLevelFilterA11y: "Filtro per livello di evento",
		controllerEventDetailsA11y: "Dettagli dell'evento del controller",
		instrumentationFilterA11y:
			"Filtrare il tipo di record di strumentazione",
		instrumentationDetailsA11y: "Dettagli del record di strumentazione",
		toggleSessionPanelA11y: "Mostrare o nascondere il pannello della sessione",
		toggleEventPanelA11y: "Mostrare o nascondere il pannello degli eventi",
		toggleDatabasePanelA11y: "Mostrare o nascondere il pannello del database",
		toggleInstrumentationPanelA11y:
			"Mostrare o nascondere il pannello della strumentazione",

		// Panel actions and status. "clear"/"pause"/"resume" stay lowercase in
		// English to match the dev panels' chrome; the Italian register renders
		// the impersonal infinitives.
		clear: "Cancellare",
		pause: "Sospendere",
		resume: "Riprendere",
		controllerUnavailable: "Controller non disponibile",
		noMatchingEvents:
			"Ancora nessun evento corrispondente. Interagire con una domanda per acquisire gli eventi del controller.",
		noSectionSessionYet:
			"Ancora nessun dato di sessione della sezione. Interagire con le domande per vedere gli aggiornamenti.",
		eventLevelItem: "domanda",
		eventLevelSection: "sezione",
		// Record-kind identifiers, verbatim across locales like the audited
		// Dutch catalog.
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		instrumentationFieldName: "nome:",
		instrumentationFieldKind: "tipo:",
		instrumentationFieldProvider: "fornitore:",
		instrumentationFieldTimestamp: "marca temporale:",
		instrumentationFieldValue: "valore:",
		instrumentationFieldError: "errore:",
		// Session-db payload field names — identifiers, verbatim.
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",

		pnp: {
			title: "Profilo PNP",
			noAssessmentBound: "Nessuna prova associata",
			noAssessmentBoundBody:
				"Il profilo, il distretto scolastico e la policy di somministrazione della prova non hanno nulla da leggere, quindi solo i requiredTools di una domanda possono concedere un adattamento. Passare la prova alla proprietà assessment del toolkit oppure chiamare updateAssessment(...) sul coordinatore del toolkit.",
			determinationReadOnly: "Determinazione (sola lettura)",
			toolsEditor: "Editor degli strumenti",
			enforcement: "Applicazione del PNP",
			allAvailableTools: "Tutti gli strumenti disponibili",
			clearPlacement: "Rimuovere il posizionamento",
			tool: "Strumento",
			placement: "Posizionamento",
			provider: "Fornitore",
			simulation: "Simulazione PNP",
			resolvedTools: "Strumenti determinati (toolkit)",
			provenanceSummary:
				"Riepilogo della provenienza delle policy degli strumenti",
			perToolDecisions: "Decisioni per strumento",
			policyDiagnostics: "Diagnostica delle policy",
			profileReadOnly: "Profilo PNP (sola lettura)",
			on: "Attivo",
			effective: "Effettivo:",
			needs: "richiede",
			hostSurfaceNotPlaced: "superficie dell'host (non posizionata)",
			support: "consentire",
			prohibit: "vietare",
		},

		tts: {
			title: "Impostazioni della lettura ad alta voce",
			closeA11y: "Chiudere le impostazioni della lettura ad alta voce",
			toolbarLayoutMode: "Modalità di layout della barra degli strumenti",
			reservedRow: "Riga riservata",
			expandingRow: "Riga espandibile",
			floatingOverlay: "Sovrapposizione flottante",
			leftAlignedControls: "Controlli allineati a sinistra",
			inlineSpeedButtons: "Pulsanti di velocità inline",
			resetToDefaults: "Ripristinare i valori predefiniti",
			mathHighlighting: "Evidenziazione delle formule",
			checkingAvailability: "Verifica della disponibilità…",
			recheck: "Verificare di nuovo",
			voice: "Voce",
			bestAvailableVoice: "Migliore voce disponibile (automatica)",
			unnamedVoice: "Voce senza nome",
			apiEndpoint: "Endpoint dell'API",
			gender: "Genere",
			any: "Qualsiasi",
			male: "Maschile",
			female: "Femminile",
			neutral: "Neutro",
			engine: "Motore",
			neural: "Neurale",
			standard: "Standard",
			providerDefault: "Predefinito del fornitore",
			format: "Formato",
			sampleRate: "Frequenza di campionamento",
			speechMarks: "Marcatori vocali",
			word: "Parola",
			wordAndSentence: "Parola + frase",
			voiceType: "Tipo di voce",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Testo semplice",
			sampleText: "Testo di esempio",
			resetSample: "Ripristinare il testo di esempio",
			providerAvailable: "Fornitore disponibile.",
			providerUnavailable: "Fornitore non disponibile.",
			providerCheckFailed:
				"La verifica della disponibilità del fornitore non è riuscita.",
			providerNotChecked:
				"La disponibilità del fornitore non è stata ancora verificata.",
			webSpeechUnavailable:
				"La Web Speech API non è disponibile in questo browser.",
			browserNoVoices:
				"La sintesi vocale del browser è disponibile, ma non sono state ancora restituite voci.",
			browserUnavailable:
				"La sintesi vocale del browser non è disponibile.",
			googleUnavailable:
				"Google Cloud TTS non è disponibile tramite l'API configurata.",
			// No keys for the preview sample text: it is spoken by the voice under
			// test, so its language follows that voice, not the interface locale.
			pollyUnavailable:
				"AWS Polly non è disponibile tramite l'API configurata.",
			recommendedVoices: "Voci consigliate",
			allVoices: "Tutte le voci disponibili",
			previewVoice: "Ascoltare un'anteprima della voce",
			stopPreview: "Interrompere l'anteprima",
			applying: "Applicazione in corso…",
			ssmlPreviewUnsupported:
				"L'anteprima SSML non è supportata nel backend del browser.",
			pollySsmlHint:
				"Alcune voci neurali di Polly rifiutano determinati tag SSML (ad esempio emphasis). Se l'anteprima non riesce, usare tag SSML di base.",
			mathHighlightParts:
				"Ogni parte di una formula viene evidenziata durante la lettura; quando l'allineamento è incerto, viene evidenziata la formula intera.",
			mathHighlightBlock:
				"Ogni formula viene evidenziata come un unico blocco invece di essere suddivisa in parti.",
			previewFailed:
				"La riproduzione dell'audio di anteprima non è riuscita.",
			previewNoAudio:
				"La risposta dell'anteprima non includeva contenuto audio.",
			previewEnterText:
				"Inserire il testo di anteprima prima di avviare la riproduzione.",
			previewUnavailable:
				"Non è possibile creare l'anteprima finché questo servizio non è disponibile.",
			browserSynthesisUnavailable:
				"La sintesi vocale del browser non è disponibile.",
			ssmlWordTrackingDisabled:
				"L'anteprima SSML di Google conserva l'SSML originale, quindi il seguimento delle parole è disattivato.",
			applyUnavailable:
				"Non è possibile applicare le impostazioni finché questo servizio non è disponibile.",
			coordinatorUnavailable:
				"Il coordinatore del toolkit non è disponibile per gli aggiornamenti della lettura ad alta voce.",
			customProviderNotRegistered:
				"Il fornitore personalizzato «{id}» non è registrato.",
			customProviderNoConfig:
				"Il fornitore personalizzato «{id}» non ha restituito una configurazione da applicare.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Errore sconosciuto",
			previewRequestFailed:
				"Richiesta di anteprima non riuscita ({status}).",
			notAvailable: "n.d.",
			voiceLocal: "locale",
			voiceRemote: "remota",
			voiceBrowserDefault: "predefinita del browser",
			browserAvailable: {
				one: "Sintesi vocale del browser disponibile ({count} voce rilevata).",
				many: "Sintesi vocale del browser disponibile ({count} voci rilevate).",
				other: "Sintesi vocale del browser disponibile ({count} voci rilevate).",
			},
			pollyAvailable: {
				one: "AWS Polly disponibile ({count} voce corrispondente, motore {engine}).",
				many: "AWS Polly disponibile ({count} voci corrispondenti, motore {engine}).",
				other: "AWS Polly disponibile ({count} voci corrispondenti, motore {engine}).",
			},
			googleAvailable: {
				one: "Google Cloud TTS disponibile ({count} voce corrispondente).",
				many: "Google Cloud TTS disponibile ({count} voci corrispondenti).",
				other: "Google Cloud TTS disponibile ({count} voci corrispondenti).",
			},
			headerRowReservation:
				"Prenotazione della riga di intestazione della domanda: {state}",
			speedOptionsHelp:
				"Moltiplicatori separati da virgole o punti e virgola. Includere 1 per la velocità normale; lasciare vuoto per nascondere i controlli della velocità.",
			usingSelectedVoice: "Voce in uso: {voice}",
			autoVoice: "Migliore voce disponibile (automatica): {voice}",
			autoVoiceWaiting:
				"Migliore voce disponibile (automatica): in attesa delle voci del browser.",
			previewHintBrowserSsml:
				"SSML non supportato nell'anteprima del browser.",
			previewHintGoogleSsml: "SSML conservato. Seguimento disattivato.",
			previewHintCustom:
				"Seguimento attivo quando il fornitore restituisce marcatori vocali.",
			previewHintTracking:
				"Seguimento attivo durante la riproduzione dell'anteprima.",
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

export default it;
