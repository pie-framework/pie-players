/**
 * German message catalog — reviewed (agent pass in lieu of a native reader,
 * 2026-11-04; see `reviewedBy` in `catalog-manifest.json`).
 *
 * Serves every German host: registered under the bare `de` tag, so `de`,
 * `de-DE`, `de-AT` and `de-CH` all widen to it. Content flavour is standard
 * German as German school and assessment software writes it, per
 * `briefs/de.md` — domain register first (`Aufgabe` for a delivered question,
 * `Text` for a reading passage, `Lineal`, `Winkelmesser`, `Koordinatensystem`,
 * `Periodensystem`, `Hilfsmittel` for the exam-aid tools, `Sprachausgabe` for
 * browser read-aloud). Controls carry the infinitive; sentences and
 * instructions address the learner with `Sie`. State changes are announced as
 * events — `Einfacher Taschenrechner wurde geöffnet` — or in the German
 * media-player convention (`Vorlesen pausiert`), never as bare stative
 * participles. A Swiss host that avoids `ß` can override any key through
 * `customMessages`.
 *
 * Regeneration is surgical, never wholesale: `scripts/check-catalogs.ts`
 * diffs the English snapshot (`de.english-snapshot.json`) against the live
 * `en-US` source and lists exactly the keys whose English moved; translate
 * only those, keep every reviewed string, then refresh the snapshot per the
 * package README.
 *
 * @module @pie-players/pie-i18n-generated/messages/de
 */

const de = {
	common: {
		close: "Schließen",
		cancel: "Abbrechen",
		save: "Speichern",
		reset: "Zurücksetzen",
		retry: "Erneut versuchen",
		back: "Zurück",
		next: "Weiter",
		previous: "Zurück",
		submit: "Abgeben",
		continue: "Fortfahren",
		finish: "Fertigstellen",
		yes: "Ja",
		no: "Nein",
		ok: "OK",
		any: "Beliebig",
		off: "Aus",
		auto: "Automatisch",
		all: "Alle",
		none: "Keine",
		loading: "Wird geladen…",
		error: "Fehler",
		settings: "Einstellungen",
		language: "Sprache",
		theme: "Design",
		preview: "Vorschau",
		author: "Bearbeiten",
		unknown: "Unbekannt",
		untitled: "Ohne Titel",
		apply: "Anwenden",
		enabled: "Ein",
		disabled: "Aus",
		lookUp: "Nachschlagen",
		wordOrPhrase: "Wort oder Begriff",
		closeA11y: "Schließen",
		settingsA11y: "Einstellungsmenü öffnen",
	},

	player: {
		passage: "Text",
		passages: "Texte",
		question: "Aufgabe",
		questionNumbered: "Aufgabe {position}",
		questions: "Aufgaben",
		items: "Aufgaben",
		section: "Abschnitt",
		loadingSection: "Abschnittsinhalt wird geladen…",
		sectionLoadError: "Der Abschnittsinhalt konnte nicht geladen werden.",
		loadingPassage: "Text wird geladen…",
		configurationError: "Konfigurationsfehler",
		playerError: "Fehler im Player",
		authoringBackendError: "Konfigurationsfehler des Authoring-Backends",
		itemLoadError: "Die Aufgabe konnte nicht geladen werden.",
		sectionTabsA11y: "Tabs des Abschnittsinhalts",
		passagesRegionA11y: "Texte",
		itemsRegionA11y: "Aufgaben",
		sectionToolsA11y: "Hilfsmittel für diesen Abschnitt",
		scrollDownA11y: "Nach unten scrollen",
		resizePanels: "Größe der Bereiche ändern",
		resizePassagesAndItemsA11y:
			"Größe der Bereiche für Texte und Aufgaben ändern",
		resizeMediaRegion: "Größe des Medienbereichs ändern",
		resizeQuestionAndMediaA11y:
			"Größe der Bereiche für Aufgabe und Medien ändern",
		resizePassageAndMediaA11y:
			"Größe der Bereiche für Text und Medien ändern",
		resizePassageAndQuestionA11y:
			"Größe der Bereiche für Text und Aufgabe ändern",
		passageWidthA11y: "Textbreite: {percent} %",
		questionPositionA11y: "Aufgabe {position} von {total}",
		questionPositionLabeledA11y: "{label}, Aufgabe {position} von {total}",

		assessment: {
			sectionPosition: "Abschnitt {position} von {total}",
			noSections: "Keine Abschnitte",
			loadFailed:
				"Die Prüfung konnte nicht geladen werden. Versuchen Sie es erneut.",
			restoreFailed:
				"Ihre gespeicherten Antworten für diesen Abschnitt konnten nicht wiederhergestellt werden. Versuchen Sie es erneut.",
		},

		formative: {
			checkAnswer: "Antwort prüfen",
			tryAgain: "Erneut versuchen",
			answerRecorded: "Antwort gespeichert.",
			correct: "Richtig.",
			partlyCorrect: "Teilweise richtig.",
			notCorrect: "Nicht richtig.",
			notAutoScored:
				"Antwort gespeichert. Diese Aufgabe wird nicht automatisch ausgewertet.",
			checkFailed:
				"Diese Aufgabe konnte nicht geprüft werden. Versuchen Sie es erneut.",
			triesLeft: {
				one: "Noch {count} Versuch übrig.",
				other: "Noch {count} Versuche übrig.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Die Aufgaben werden eingeblendet, während das Medium abgespielt wird.",
			questionAvailable: "Aufgabe {position} ist jetzt verfügbar.",
			playbackPaused:
				"Wiedergabe pausiert. Beantworten Sie Aufgabe {position}, um fortzufahren.",
			playbackAdvisory:
				"Beantworten Sie Aufgabe {position}, bevor Sie mit dem Medium fortfahren.",
			playbackReleased:
				"Antwort akzeptiert. Spielen Sie das Medium weiter.",
		},

		summary: {
			correctA11y: "Richtige Antwort",
			answer: "Antwort",
			manualScoring: "Von einer Lehrkraft bewertet",
			audio: "Audio",
			video: "Video",
		},
		list: {
			expandA11y: "Die vollständige Aufgabe anzeigen",
			highlights: "Suchtreffer",
			collapse: "Die Zusammenfassung anzeigen",
			playerError:
				"Die vollständige Aufgabe konnte nicht geladen werden.",
		},
	},

	toolkit: {
		toolsA11y: "Hilfsmittel",
		toolbarInitError: "Die Hilfsmittel konnten nicht gestartet werden.",
		settingsTitle: "Einstellungen",
		closeSettingsA11y: "Einstellungen schließen",
		dragPanelA11y: "Bereich verschieben",
		closePanelA11y: "Bereich schließen",
		resizeWindow: "Fenstergröße ändern",
		minimize: "Minimieren",
		maximize: "Maximieren",
		minimizePanelA11y: "Bereich minimieren",
		maximizePanelA11y: "Bereich maximieren",

		window: {
			moveLeftA11y: "Hilfsmittel nach links verschieben",
			moveRightA11y: "Hilfsmittel nach rechts verschieben",
			moveUpA11y: "Hilfsmittel nach oben verschieben",
			moveDownA11y: "Hilfsmittel nach unten verschieben",
			narrowerA11y: "Fenster schmaler machen",
			widerA11y: "Fenster breiter machen",
			shorterA11y: "Fenster niedriger machen",
			tallerA11y: "Fenster höher machen",
			centerA11y: "Fenster zentrieren",
			closeA11y: "Hilfsmittel schließen",
		},

		placement: {
			controlsA11y: "Verschieben und Drehen",
			moveAndResizeA11y: "Verschieben und Größe ändern",
			rotateClockwiseA11y: "{degrees}° im Uhrzeigersinn drehen",
			rotateCounterclockwiseA11y: "{degrees}° gegen den Uhrzeigersinn drehen",
		},

		announce: {
			movedUp: "Nach oben auf {position} verschoben",
			movedDown: "Nach unten auf {position} verschoben",
			movedLeft: "Nach links auf {position} verschoben",
			movedRight: "Nach rechts auf {position} verschoben",
			rotatedTo: "Auf {degrees} Grad gedreht",
		},
	},

	tools: {
		calculator: {
			name: "Taschenrechner",
			nameBasic: "Einfacher Taschenrechner",
			nameScientific: "Wissenschaftlicher Taschenrechner",
			nameGraphing: "Grafikrechner",
			description:
				"Taschenrechner in mehreren Varianten (einfach, wissenschaftlich, grafikfähig)",
			// State changes are passive events, authored whole per variant —
			// never the bare participle, which German reads as a state
			// ("Taschenrechner geöffnet" = the calculator is open).
			openedBasic: "Einfacher Taschenrechner wurde geöffnet",
			openedScientific: "Wissenschaftlicher Taschenrechner wurde geöffnet",
			openedGraphing: "Grafikrechner wurde geöffnet",
			closedBasic: "Einfacher Taschenrechner wurde geschlossen",
			closedScientific: "Wissenschaftlicher Taschenrechner wurde geschlossen",
			closedGraphing: "Grafikrechner wurde geschlossen",
			toolA11y: "Taschenrechner",
			loading: "Taschenrechner wird geladen…",
			providerUnavailable: "Der Taschenrechner ist nicht verfügbar.",
			initFailed: "Der Taschenrechner konnte nicht gestartet werden.",
		},
		graph: {
			name: "Graph",
			description: "Koordinatensystem",
			buttonA11y: "Graph, Koordinatensystem",
			tooltip: "Graph",
			toolA11y:
				"Graph — Punkte und Strecken in einem Koordinatensystem zeichnen",
			canvasA11y:
				"Zeichenfläche des Graphen — mit den Werkzeugen Punkte hinzufügen und Strecken zeichnen",
			grid: "Gitter:",
			gridOpacityA11y: "Deckkraft des Gitters",
			pointA11y: "Punkt {id}",
			modeSelector: "Auswählen",
			modeSelectorHint:
				"Auswählen: Klicken und ziehen Sie Punkte, um sie oder die zugehörigen Strecken zu verschieben.",
			modePoint: "Punkt",
			modePointHint:
				"Punkt: Klicken Sie in das Gitter, um Punkte hinzuzufügen.",
			modeLine: "Strecke",
			modeLineHint:
				"Strecke: Klicken Sie auf einen Startpunkt und danach auf einen Endpunkt, um eine Strecke zu zeichnen.",
			modeDelete: "Löschen",
			modeDeleteHint:
				"Löschen: Klicken Sie auf einen Punkt, um ihn und alle angeschlossenen Strecken zu löschen.",
		},
		periodicTable: {
			name: "Periodensystem",
			description: "Nachschlagewerk: das Periodensystem der Elemente",
			buttonA11y: "Periodensystem, chemisches Nachschlagewerk",
			tooltip: "Periodensystem",
			toolA11y:
				"Periodensystem — wählen Sie ein Element aus, um seine Daten zu sehen",
			elementsA11y: "Elemente des Periodensystems",
			showAllA11y: "Alle Elemente anzeigen",
			allElements: "Alle Elemente",
			atomicMass: "Atommasse",
			atomicNumber: "Ordnungszahl",
			electronConfig: "Elektronenkonfiguration",
			phase: "Aggregatzustand",
			filterByA11y: "Nach {category} filtern",
			// German capitalizes every noun, so the Dutch calibration's
			// sentence-internal lowercase field-label rule does not transfer:
			// these stay capitalized.
			elementA11y:
				"{name}, Symbol: {symbol}, Ordnungszahl: {number}, Atommasse: {mass}, Kategorie: {category}",
			outsideFilterA11y: ", außerhalb des aktuellen Filters",
			category: {
				unknown: "Unbekannt",
				alkaliMetal: "Alkalimetall",
				alkalineEarthMetal: "Erdalkalimetall",
				transitionMetal: "Übergangsmetall",
				postTransitionMetal: "Metall der p-Gruppe",
				metalloid: "Halbmetall",
				diatomicNonmetal: "Zweiatomiges Nichtmetall",
				polyatomicNonmetal: "Mehratomiges Nichtmetall",
				nobleGas: "Edelgas",
				lanthanide: "Lanthanoide",
				actinide: "Actinoide",
			},
			phaseValue: {
				solid: "Fest",
				liquid: "Flüssig",
				gas: "Gasförmig",
			},
		},
		ruler: {
			name: "Lineal",
			description: "Lineal auf dem Bildschirm zum Messen",
			buttonA11y: "Lineal",
			tooltip: "Lineal",
			toolA11y: "Verschieb- und drehbares Lineal",
			unitSelectionA11y: "Maßeinheit des Lineals",
			// German capitalizes nouns everywhere, so both forms of each unit
			// are identical — the case the English source's comment anticipates.
			// Spelled out, never abbreviated: screen readers read every one of
			// these aloud.
			inches: "Zoll",
			centimeters: "Zentimeter",
			inchesInSentence: "Zoll",
			centimetersInSentence: "Zentimeter",
			switchToInchesA11y: "Zu Zoll wechseln",
			switchToCentimetersA11y: "Zu Zentimeter wechseln",
			switchedTo: "Zu {unit} gewechselt",
			applicationA11y:
				"Lineal. Verschieben mit den Pfeiltasten, Drehen mit Shift+Pfeiltasten, feines Drehen mit PageUp oder PageDown, Einheit wechseln mit U. Aktuelle Einheit: {unit}",
			imageAlt: "Lineal mit {unit}",
		},
		protractor: {
			name: "Winkelmesser",
			description: "Winkelmesser auf dem Bildschirm zum Messen von Winkeln",
			buttonA11y: "Winkelmesser",
			tooltip: "Winkelmesser",
			toolA11y:
				"Winkelmesser. Verschieben mit den Pfeiltasten, Drehen mit Shift+Pfeiltasten und feines Drehen mit PageUp oder PageDown.",
			roleA11y: "Verschieb- und drehbarer Winkelmesser",
			imageAlt:
				"Winkelmesser mit halbkreisförmiger 180-Grad-Skala, von 0 bis 180 Grad in beide Richtungen beschriftet, mit Gradmarkierungen alle 10 Grad",
		},
		dictionary: {
			name: "Wörterbuch",
			description: "Bedeutungen von Wörtern nachschlagen",
			buttonA11y: "Wörterbuch, Bedeutungen von Wörtern nachschlagen",
			tooltip: "Wörterbuch",
			toolA11y: "Wörterbuch",
			// The lookup panel's notices are authored whole: the term interpolates
			// into the sentence, never around it.
			notConfigured:
				"Für diese Prüfung ist kein Wörterbuchdienst eingerichtet.",
			idleHint: "Geben Sie ein Wort ein, um es nachzuschlagen.",
			lookingUp: "„{term}“ wird nachgeschlagen…",
			noEntryFor: "Kein Eintrag für „{term}“.",
			entriesCount: {
				one: "{count} Eintrag",
				other: "{count} Einträge",
			},
			noEntryStatusFor: "Kein Wörterbucheintrag für {term}.",
		},
		pictureDictionary: {
			name: "Bildwörterbuch",
			description: "Bilder zu Wörtern nachschlagen",
			buttonA11y: "Bildwörterbuch, Bilder zu Wörtern nachschlagen",
			tooltip: "Bildwörterbuch",
			toolA11y: "Bildwörterbuch",
			notConfigured:
				"Für diese Prüfung ist kein Bildwörterbuchdienst eingerichtet.",
			idleHint: "Geben Sie ein Wort ein, um ein Bild dazu zu sehen.",
			lookingUp: "„{term}“ wird nachgeschlagen…",
			noEntryFor: "Kein Bild für „{term}“.",
			entriesCount: {
				one: "{count} Bild",
				other: "{count} Bilder",
			},
			noEntryStatusFor: "Kein Bild für {term}.",
		},
		dictionarySpanish: {
			name: "Spanisches Wörterbuch",
			description: "Bedeutungen von Wörtern auf Spanisch nachschlagen",
			buttonA11y:
				"Spanisches Wörterbuch, Bedeutungen von Wörtern auf Spanisch nachschlagen",
			tooltip: "Spanisches Wörterbuch",
			toolA11y: "Spanisches Wörterbuch",
		},
		pictureDictionarySpanish: {
			name: "Spanisches Bildwörterbuch",
			description: "Bilder zu Wörtern auf Spanisch nachschlagen",
			buttonA11y:
				"Spanisches Bildwörterbuch, Bilder zu Wörtern auf Spanisch nachschlagen",
			tooltip: "Spanisches Bildwörterbuch",
			toolA11y: "Spanisches Bildwörterbuch",
		},
		lineReader: {
			name: "Lesehilfe",
			description: "Lesehilfe über dem Text",
			buttonA11y: "Lesehilfe, Lesefenster",
			tooltip: "Lesehilfe",
			roleA11y: "Verschieb- und verstellbare Lesehilfe",
			close: "Lesehilfe schließen",
			resizeWindowA11y:
				"Ziehen, um die Größe des Lesefensters zu ändern",
			resizeFrameA11y:
				"Ziehen, um den Rahmen und die Fensterbreite zu ändern",
			windowHeightAnnounce: "Höhe des Lesefensters: {pixels} Pixel",
			frameHeightAnnounce: "Höhe des Rahmens: {pixels} Pixel",
			widthAnnounce: "Breite: {pixels} Pixel",
			shorterWindowA11y: "Das Lesefenster niedriger machen",
			tallerWindowA11y: "Das Lesefenster höher machen",
			shorterFrameA11y: "Den Rahmen niedriger machen",
			tallerFrameA11y: "Den Rahmen höher machen",
			narrowerA11y: "Die Lesehilfe schmaler machen",
			widerA11y: "Die Lesehilfe breiter machen",
			applicationA11y:
				"Lesehilfe. Ein klares Lesefenster innerhalb eines abdunkelnden Rahmens. Verschieben mit den Pfeiltasten, Größe des Lesefensters ändern mit +/-, Schließen mit Escape. Höhe des Lesefensters: {paneHeight} Pixel, Höhe des Rahmens: {frameHeight} Pixel",
			resizeWindowFullA11y:
				"Größe des Lesefensters ändern. Ziehen oder mit den Pfeiltasten nach oben und unten die Höhe ändern. Aktuelle Höhe: {paneHeight} Pixel",
			resizeFrameFullA11y:
				"Größe des Rahmens ändern. Ziehen oder mit den Pfeiltasten nach oben und unten die Rahmenhöhe und mit den Pfeiltasten nach links und rechts die Breite ändern. Aktuelle Rahmenhöhe: {frameHeight} Pixel, Breite: {width} Pixel",
		},
		magnification: {
			name: "Lupe",
			description: "Den Inhalt unter einer beweglichen Lupe vergrößern",
			buttonA11y: "Lupe, den Inhalt unter einer beweglichen Linse vergrößern",
			tooltip: "Lupe",
			roleA11y: "Verschieb- und verstellbare Lupe",
			applicationA11y:
				"Lupe mit {zoom}-facher Vergrößerung. Linse mit den Pfeiltasten verschieben, Vergrößerung mit + und - ändern, mit Escape schließen.",
			zoomIn: "Vergrößern",
			zoomOut: "Verkleinern",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Vergrößerung {zoom}-fach",
			close: "Lupe schließen",
			resizeA11y: "Ziehen, um die Größe der Lupe zu ändern",
			resizeFullA11y:
				"Größe der Lupe ändern. Ziehen oder Pfeiltasten verwenden. Aktuelle Größe: {width} mal {height} Pixel",
			sizeAnnounce: "Lupe {width} mal {height} Pixel",
			narrowerA11y: "Die Lupe schmaler machen",
			widerA11y: "Die Lupe breiter machen",
			shorterA11y: "Die Lupe niedriger machen",
			tallerA11y: "Die Lupe höher machen",
		},
		answerEliminator: {
			name: "Antworten durchstreichen",
			description: "Antwortmöglichkeiten durchstreichen",
			buttonA11y: "Durchstreichen, Antwortmöglichkeiten ausschließen",
			tooltip: "Durchstreichen",
			toggleA11y: "Durchstreichen für {choice} ein- oder ausschalten",
			eliminatedA11y: "(durchgestrichen)",
			unlabeledChoice: "Antwortmöglichkeit ohne Beschriftung",
		},
		highlighter: {
			name: "Textmarker",
			description: "Text hervorheben und mit Anmerkungen versehen",
			buttonA11y: "Text hervorheben",
			tooltip: "Hervorheben",
		},
		annotationToolbar: {
			name: "Anmerkungen",
			description: "Text hervorheben und mit Anmerkungen versehen",
			buttonA11y: "Annotieren, Text hervorheben und bearbeiten",
			// Not "Hervorheben": that is `tools.highlighter.tooltip`, and two
			// toolbar buttons carrying the same visible label is a defect.
			tooltip: "Annotieren",
			toolbarA11y: "Werkzeugleiste für Textanmerkungen",
			underline: "Unterstreichen",
			underlineA11y: "Ausgewählten Text unterstreichen",
			readAloud: "Vorlesen",
			readAloudA11y: "Ausgewählten Text vorlesen",
			remove: "Entfernen",
			removeA11y: "Diese Anmerkung entfernen",
			clearAll: "Alles löschen",
			clearAllA11y: "Alle Anmerkungen im Dokument löschen",
			highlightYellowA11y: "Gelb hervorheben",
			highlightPinkA11y: "Rosa hervorheben",
			highlightBlueA11y: "Blau hervorheben",
			highlightGreenA11y: "Grün hervorheben",
			selectionAvailableA11y:
				"Die Werkzeugleiste für Textanmerkungen ist für „{text}“ verfügbar. Drücken Sie Shift+F10 für die Anmerkungswerkzeuge.",
			highlightedYellowA11y: "„{text}“ wurde gelb hervorgehoben",
			highlightedPinkA11y: "„{text}“ wurde rosa hervorgehoben",
			highlightedBlueA11y: "„{text}“ wurde blau hervorgehoben",
			highlightedGreenA11y: "„{text}“ wurde grün hervorgehoben",
			underlinedA11y: "„{text}“ wurde unterstrichen",
			removedA11y: "Anmerkung von „{text}“ wurde entfernt",
			clearedA11y: {
				one: "{count} Anmerkung wurde gelöscht",
				other: "{count} Anmerkungen wurden gelöscht",
			},
		},
		theme: {
			name: "Design",
			description: "Barrierefreie Designs und Kontraste",
			buttonA11y: "Design, Farben und Kontrast ändern",
			tooltip: "Design",
			selectorA11y: "Designauswahl",
			hint: "Wählen Sie ein Design aus, um die Lesbarkeit zu verbessern und die Augen zu entlasten.",
			selectA11y: "Design auswählen",
			selectCurrentA11y: "Design auswählen. Aktuelles Design: {name}",
			optionUnavailableA11y: "{name}, nicht verfügbar",
			unavailableName: "Nicht verfügbares Design: {id}",
			unavailableDescription:
				"Das von PIE verwaltete Basisdesign bleibt aktiv, bis dieses Design wieder verfügbar ist.",
			unavailableStatus:
				"Das ausgewählte Design ist nicht verfügbar. Das von PIE verwaltete Basisdesign bleibt aktiv, bis es wieder verfügbar ist.",
		},
		textToSpeech: {
			name: "Vorlesen",
			description: "Inhalt vorlesen",
			initFailed:
				"Vorlesen konnte nicht gestartet werden. Versuchen Sie es erneut.",
			inline: {
				controlsA11y: "Vorlesesteuerung",
				playbackSpeedA11y: "Vorlesegeschwindigkeit",
				rewindA11y: "Zurückspulen",
				fastForwardA11y: "Vorspulen",
				stopA11y: "Vorlesen stoppen",
				// Terse playback announcements follow the German media-player
				// convention (noun + Partizip II), which reads as an event.
				starting: "Vorlesen wird gestartet",
				started: "Vorlesen gestartet",
				resumed: "Vorlesen fortgesetzt",
				pausedAnnouncement: "Vorlesen pausiert",
				stopped: "Vorlesen gestoppt",
				switchedSection:
					"Das Vorlesen läuft jetzt in einem anderen Abschnitt",
				nothingToRead: "Hier gibt es nichts zum Vorlesen",
				startFailed: "Vorlesen konnte nicht gestartet werden",
				skippedForward: "Vorgespult",
				skipForwardFailed: "Vorspulen war nicht möglich",
				skippedBackward: "Zurückgespult",
				skipBackwardFailed: "Zurückspulen war nicht möglich",
				speedChangeFailed:
					"Die Vorlesegeschwindigkeit konnte nicht geändert werden",
				speedAnnounce: "Vorlesegeschwindigkeit {label}",
				playA11y: "Vorlesen starten",
				pauseA11y: "Vorlesen pausieren",
				resumeA11y: "Vorlesen fortsetzen",
			},
		},
		signLanguage: {
			name: "Gebärdensprache",
			description: "Gebärdensprachliche Version des Inhalts",
			generic: "Gebärdensprache",
			unknown: "Gebärdensprache ({code})",
			ase: "Amerikanische Gebärdensprache",
			bfi: "Britische Gebärdensprache",
			fsl: "Französische Gebärdensprache",
			gss: "Griechische Gebärdensprache",
			mfs: "Mexikanische Gebärdensprache",
			signedEnglish: "Gebärdetes Englisch",
			regionA11y: "Übersetzung in {language}",
		},
		audioTranscript: {
			name: "Audiotranskript",
			description: "Transkript des Audioinhalts",
			regionA11y: "Transkript",
		},
	},

	debug: {
		session: "Sitzung",
		sessionData: "Sitzungsdaten",
		sessionDataPersistent: "PIE-Sitzungsdaten (persistent)",
		noItemSessionYet:
			"Noch keine Sitzungsdaten der Aufgabe. Interagieren Sie mit der Aufgabe, um hier Aktualisierungen zu sehen.",
		itemSessionsSnapshot: "Momentaufnahme der Aufgabensitzungen",
		sectionControllerUnavailable:
			"Für diesen Abschnitt ist noch kein Controller verfügbar.",
		filteredModel: "Gefiltertes Modell",
		environment: "Umgebung",
		events: "Ereignisse",
		controllerEvents: "Controller-Ereignisse",
		instrumentation: "Instrumentierung",
		databaseState: "Datenbankstatus",
		sessionDb: "Sitzungsdatenbank (Server)",
		noRows: "Keine Zeilen",
		noRecords: "Noch keine Instrumentierungsdatensätze.",
		selectRecord: "Wählen Sie einen Datensatz aus, um Details zu sehen.",
		selectEvent:
			"Wählen Sie ein Ereignis aus, um die Details der Nutzdaten zu sehen.",
		showRawTables: "Unbearbeitete Tabellen anzeigen",
		showReconstructedSnapshots: "Rekonstruierte Momentaufnahmen anzeigen",
		showSectionRequest: "Anfrage des Abschnitts anzeigen",
		showAssessmentRequest: "Anfrage der Prüfung anzeigen",
		liveUpdatesUnsupported:
			"Live-Aktualisierungen werden in diesem Browser nicht unterstützt",
		liveUpdatesDisconnected:
			"Live-Aktualisierungen getrennt; es wird erneut versucht…",
		fieldType: "Typ:",
		fieldTarget: "Ziel:",
		fieldItem: "Aufgabe:",
		fieldCanonical: "Kanonisch:",
		fieldIntent: "Absicht:",
		fieldDuplicates: "Duplikate:",
		fieldSemanticRepeats: "Semantische Wiederholungen:",
		dragItemSessionPanelA11y: "Bereich der Aufgabensitzung verschieben",
		debuggerTabsA11y: "Tabs des Debuggers",
		sessionDataJsonA11y: "Sitzungsdaten als JSON",
		environmentJsonA11y: "Umgebung als JSON",
		filteredModelJsonA11y: "Gefiltertes Modell als JSON",
		sectionSessionJsonA11y: "Momentaufnahme der Abschnittssitzung als JSON",
		eventLevelFilterA11y: "Nach Ereignisebene filtern",
		controllerEventDetailsA11y: "Details eines Controller-Ereignisses",
		instrumentationFilterA11y:
			"Nach Typ des Instrumentierungsdatensatzes filtern",
		instrumentationDetailsA11y: "Details des Instrumentierungsdatensatzes",
		toggleSessionPanelA11y: "Sitzungsbereich ein- oder ausblenden",
		toggleEventPanelA11y: "Ereignisbereich ein- oder ausblenden",
		toggleDatabasePanelA11y: "Datenbankbereich ein- oder ausblenden",
		toggleInstrumentationPanelA11y:
			"Instrumentierungsbereich ein- oder ausblenden",

		// Panel actions and status. English keeps these lowercase for its dev
		// panels; German capitalizes as its own register requires.
		clear: "Leeren",
		pause: "Pausieren",
		resume: "Fortsetzen",
		controllerUnavailable: "Controller nicht verfügbar",
		noMatchingEvents:
			"Noch keine passenden Ereignisse. Interagieren Sie mit einer Aufgabe, um Controller-Ereignisse aufzuzeichnen.",
		noSectionSessionYet:
			"Noch keine Sitzungsdaten des Abschnitts. Interagieren Sie mit den Aufgaben, um Aktualisierungen zu sehen.",
		eventLevelItem: "Aufgabe",
		eventLevelSection: "Abschnitt",
		// Record-kind identifiers, verbatim across locales like the audited
		// Dutch catalog.
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		instrumentationFieldName: "Name:",
		instrumentationFieldKind: "Art:",
		instrumentationFieldProvider: "Anbieter:",
		instrumentationFieldTimestamp: "Zeitstempel:",
		instrumentationFieldValue: "Wert:",
		instrumentationFieldError: "Fehler:",
		// Session-db payload field names — identifiers, verbatim.
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",

		pnp: {
			title: "PNP-Profil",
			noAssessmentBound: "Keine Prüfung verknüpft",
			noAssessmentBoundBody:
				"Profil, Schulträger und Durchführungsrichtlinie haben nichts zum Lesen, daher können nur die requiredTools einer Aufgabe eine Anpassung gewähren. Übergeben Sie die Prüfung an die assessment-Eigenschaft des Toolkits, oder rufen Sie updateAssessment(...) beim Toolkit-Koordinator auf.",
			determinationReadOnly: "Feststellung (schreibgeschützt)",
			toolsEditor: "Hilfsmittel-Editor",
			enforcement: "PNP-Durchsetzung",
			allAvailableTools: "Alle verfügbaren Hilfsmittel",
			clearPlacement: "Platzierung aufheben",
			tool: "Hilfsmittel",
			placement: "Platzierung",
			provider: "Anbieter",
			simulation: "PNP-Simulation",
			resolvedTools: "Aufgelöste Hilfsmittel (Toolkit)",
			provenanceSummary:
				"Überblick über die Herkunft der Hilfsmittelrichtlinie",
			perToolDecisions: "Entscheidungen pro Hilfsmittel",
			policyDiagnostics: "Diagnose der Richtlinien",
			profileReadOnly: "PNP-Profil (schreibgeschützt)",
			on: "Ein",
			effective: "Wirksam:",
			needs: "benötigt",
			hostSurfaceNotPlaced: "Host-Oberfläche (nicht platziert)",
			support: "zulassen",
			prohibit: "verbieten",
		},

		tts: {
			title: "Vorleseeinstellungen",
			closeA11y: "Vorleseeinstellungen schließen",
			toolbarLayoutMode: "Layoutmodus der Werkzeugleiste",
			reservedRow: "Reservierte Zeile",
			expandingRow: "Ausklappbare Zeile",
			floatingOverlay: "Schwebende Überlagerung",
			leftAlignedControls: "Linksbündige Steuerelemente",
			inlineSpeedButtons: "Geschwindigkeitsschaltflächen inline",
			resetToDefaults: "Auf Standardwerte zurücksetzen",
			mathHighlighting: "Formelhervorhebung",
			checkingAvailability: "Verfügbarkeit wird geprüft…",
			recheck: "Erneut prüfen",
			voice: "Stimme",
			bestAvailableVoice: "Beste verfügbare Stimme (automatisch)",
			unnamedVoice: "Unbenannte Stimme",
			apiEndpoint: "API-Endpunkt",
			gender: "Geschlecht",
			any: "Beliebig",
			male: "Männlich",
			female: "Weiblich",
			neutral: "Neutral",
			engine: "Engine",
			neural: "Neuronal",
			standard: "Standard",
			providerDefault: "Standard des Anbieters",
			format: "Format",
			sampleRate: "Abtastrate",
			speechMarks: "Sprachmarken",
			word: "Wort",
			wordAndSentence: "Wort + Satz",
			voiceType: "Stimmtyp",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Nur Text",
			sampleText: "Beispieltext",
			resetSample: "Beispieltext zurücksetzen",
			providerAvailable: "Anbieter verfügbar.",
			providerUnavailable: "Anbieter nicht verfügbar.",
			providerCheckFailed:
				"Die Verfügbarkeitsprüfung des Anbieters ist fehlgeschlagen.",
			providerNotChecked:
				"Die Verfügbarkeit des Anbieters wurde noch nicht geprüft.",
			webSpeechUnavailable:
				"Die Web Speech API ist in diesem Browser nicht verfügbar.",
			browserNoVoices:
				"Die Sprachausgabe des Browsers ist verfügbar, aber es wurden noch keine Stimmen zurückgegeben.",
			browserUnavailable:
				"Die Sprachausgabe des Browsers ist nicht verfügbar.",
			googleUnavailable:
				"Google Cloud TTS ist über die konfigurierte API nicht verfügbar.",
			// No keys for the preview sample text: it is spoken by the voice under
			// test, so its language follows that voice, not the interface locale.
			pollyUnavailable:
				"AWS Polly ist über die konfigurierte API nicht verfügbar.",
			recommendedVoices: "Empfohlene Stimmen",
			allVoices: "Alle verfügbaren Stimmen",
			previewVoice: "Stimme anhören",
			stopPreview: "Anhören stoppen",
			applying: "Wird angewendet…",
			ssmlPreviewUnsupported:
				"Die SSML-Vorschau wird vom Browser-Backend nicht unterstützt.",
			pollySsmlHint:
				"Einige neurale Polly-Stimmen lehnen bestimmte SSML-Tags ab (zum Beispiel emphasis). Wenn die Vorschau fehlschlägt, verwenden Sie einfache SSML-Tags.",
			mathHighlightParts:
				"Jeder Teil einer Formel wird beim Vorlesen hervorgehoben; bei unsicherer Ausrichtung wird die gesamte Formel hervorgehoben.",
			mathHighlightBlock:
				"Jede Formel wird als ein ganzer Block hervorgehoben, statt in Teile aufgeteilt zu werden.",
			previewFailed:
				"Die Wiedergabe des Vorschau-Audios ist fehlgeschlagen.",
			previewNoAudio: "Die Vorschauantwort enthielt keinen Audioinhalt.",
			previewEnterText:
				"Geben Sie vor dem Start der Wiedergabe einen Vorschautext ein.",
			previewUnavailable:
				"Eine Vorschau ist nicht möglich, solange dieser Dienst nicht verfügbar ist.",
			browserSynthesisUnavailable:
				"Die Sprachsynthese des Browsers ist nicht verfügbar.",
			ssmlWordTrackingDisabled:
				"Die Google-SSML-Vorschau übernimmt das SSML unverändert, daher ist das wortweise Mitlesen deaktiviert.",
			applyUnavailable:
				"Einstellungen können nicht angewendet werden, solange dieser Dienst nicht verfügbar ist.",
			coordinatorUnavailable:
				"Der Toolkit-Koordinator ist für Aktualisierungen des Vorlesens nicht verfügbar.",
			customProviderNotRegistered:
				"Der benutzerdefinierte Anbieter „{id}“ ist nicht registriert.",
			customProviderNoConfig:
				"Der benutzerdefinierte Anbieter „{id}“ hat keine Konfiguration zum Anwenden zurückgegeben.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Unbekannter Fehler",
			previewRequestFailed:
				"Die Vorschauanfrage ist fehlgeschlagen ({status}).",
			notAvailable: "k. A.",
			voiceLocal: "lokal",
			voiceRemote: "remote",
			voiceBrowserDefault: "Browserstandard",
			browserAvailable: {
				one: "Sprachausgabe des Browsers verfügbar ({count} Stimme erkannt).",
				other: "Sprachausgabe des Browsers verfügbar ({count} Stimmen erkannt).",
			},
			pollyAvailable: {
				one: "AWS Polly verfügbar ({count} passende Stimme, Engine {engine}).",
				other: "AWS Polly verfügbar ({count} passende Stimmen, Engine {engine}).",
			},
			googleAvailable: {
				one: "Google Cloud TTS verfügbar ({count} passende Stimme).",
				other: "Google Cloud TTS verfügbar ({count} passende Stimmen).",
			},
			headerRowReservation: "Reservierung der Kopfzeile der Aufgabe: {state}",
			speedOptionsHelp:
				"Multiplikatoren, getrennt durch Kommas oder Semikolons. Nehmen Sie 1 für Normal auf; lassen Sie das Feld leer, um die Geschwindigkeitssteuerung auszublenden.",
			usingSelectedVoice: "Verwendete Stimme: {voice}",
			autoVoice: "Beste verfügbare Stimme (automatisch): {voice}",
			autoVoiceWaiting:
				"Beste verfügbare Stimme (automatisch): es wird auf die Stimmen des Browsers gewartet.",
			previewHintBrowserSsml:
				"SSML wird in der Browser-Vorschau nicht unterstützt.",
			previewHintGoogleSsml: "SSML bleibt unverändert. Mitlesen deaktiviert.",
			previewHintCustom:
				"Mitlesen aktiviert, wenn der Anbieter Sprachmarken zurückgibt.",
			previewHintTracking:
				"Mitlesen aktiviert, während die Vorschau abgespielt wird.",
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

export default de;
