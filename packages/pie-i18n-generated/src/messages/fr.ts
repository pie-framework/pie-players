/**
 * French message catalog — machine-generated, not reviewed.
 *
 * Serves every French host: registered under the bare `fr` tag, so `fr`,
 * `fr-FR` and `fr-CA` all widen to it. Content flavour is standard
 * international/France French per `briefs/fr.md` — impersonal infinitive on
 * controls, French math register where the tools teach (`repère cartésien`,
 * `Droite`, `Rapporteur`, `Métal pauvre`), and U+00A0 (written `\u00A0`)
 * before the double punctuation and inside the guillemets, per French
 * typography. A Canadian host can override any key through
 * `customMessages`.
 *
 * Provenance — the source hash, model and generation date — is recorded in
 * `catalog-manifest.json`; `scripts/check-catalogs.ts` fails this file
 * against the English source when either drifts.
 *
 * @module @pie-players/pie-i18n-generated/messages/fr
 */

const fr = {
	common: {
		close: "Fermer",
		cancel: "Annuler",
		save: "Enregistrer",
		reset: "Réinitialiser",
		retry: "Réessayer",
		back: "Retour",
		next: "Suivant",
		previous: "Précédent",
		submit: "Valider",
		continue: "Continuer",
		finish: "Terminer",
		yes: "Oui",
		no: "Non",
		ok: "OK",
		any: "Tout",
		off: "Désactivé",
		auto: "Automatique",
		all: "Tous",
		none: "Aucun",
		loading: "Chargement…",
		error: "Erreur",
		settings: "Paramètres",
		language: "Langue",
		theme: "Thème",
		preview: "Aperçu",
		author: "Auteur",
		unknown: "Inconnu",
		untitled: "Sans titre",
		apply: "Appliquer",
		enabled: "Activé",
		disabled: "Désactivé",
		lookUp: "Rechercher",
		wordOrPhrase: "Mot ou expression",
		closeA11y: "Fermer",
		settingsA11y: "Ouvrir le menu des paramètres",
	},

	player: {
		passage: "Texte",
		passages: "Textes",
		question: "Question",
		questionNumbered: "Question {position}",
		questionPositionA11y: "Question {position} sur {total}",
		questionPositionLabeledA11y: "{label}, question {position} sur {total}",
		summary: {
			correctA11y: "Réponse correcte",
			answer: "Réponse",
			manualScoring: "Noté par un enseignant",
			audio: "Audio",
			video: "Vidéo",
		},
		list: {
			expandA11y: "Afficher la question complète",
		},
		questions: "Questions",
		items: "Questions",
		section: "Partie",
		loadingSection: "Chargement du contenu de la partie…",
		sectionLoadError: "Le contenu de la partie n'a pas pu être chargé.",
		loadingPassage: "Chargement du contenu du texte…",
		configurationError: "Erreur de configuration",
		playerError: "Erreur du lecteur",
		authoringBackendError:
			"Erreur de configuration du serveur d'édition",
		itemLoadError: "La question n'a pas pu être chargée.",
		sectionTabsA11y: "Onglets du contenu de la partie",
		passagesRegionA11y: "Textes",
		itemsRegionA11y: "Questions",
		sectionToolsA11y: "Outils de la partie",
		scrollDownA11y: "Défiler vers le bas",
		resizePanels: "Redimensionner les panneaux",
		resizePassagesAndItemsA11y:
			"Redimensionner les panneaux des textes et des questions",
		resizeMediaRegion: "Redimensionner la zone multimédia",
		resizeQuestionAndMediaA11y:
			"Redimensionner les panneaux de la question et du multimédia",
		resizePassageAndMediaA11y:
			"Redimensionner les panneaux du texte et du multimédia",
		resizePassageAndQuestionA11y: "Redimensionner les panneaux du texte et de la question",
		passageWidthA11y: "Largeur du texte\u00A0: {percent}\u00A0%",

		assessment: {
			sectionPosition: "Partie {position} sur {total}",
			noSections: "Aucune partie",
			loadFailed:
				"Le test n'a pas pu être chargé. Réessayez.",
			restoreFailed:
				"Vos réponses enregistrées pour cette partie n'ont pas pu être restaurées. Réessayez.",
		},

		formative: {
			checkAnswer: "Vérifier la réponse",
			tryAgain: "Réessayer",
			answerRecorded: "Réponse enregistrée.",
			correct: "Correct.",
			partlyCorrect: "Partiellement correct.",
			notCorrect: "Incorrect.",
			notAutoScored:
				"Réponse enregistrée. Cette question n'est pas notée automatiquement.",
			checkFailed:
				"Cette question n'a pas pu être vérifiée. Réessayez.",
			triesLeft: {
				one: "Il reste {count} tentative.",
				other: "Il reste {count} tentatives.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Les questions apparaissent pendant la lecture du média.",
			questionAvailable: "La question {position} est disponible.",
			playbackPaused:
				"Lecture en pause. Répondez à la question {position} pour continuer.",
			playbackAdvisory:
				"Répondez à la question {position} avant de poursuivre la lecture du média.",
			playbackReleased:
				"Réponse acceptée. Reprenez la lecture du média.",
		},
	},

	toolkit: {
		toolsA11y: "Outils du test",
		toolbarInitError: "Impossible d'initialiser les outils.",
		settingsTitle: "Paramètres",
		closeSettingsA11y: "Fermer les paramètres",
		dragPanelA11y: "Faire glisser le panneau",
		closePanelA11y: "Fermer le panneau",
		resizeWindow: "Redimensionner la fenêtre",
		minimize: "Réduire",
		maximize: "Agrandir",
		minimizePanelA11y: "Réduire le panneau",
		maximizePanelA11y: "Agrandir le panneau",

		window: {
			moveLeftA11y: "Déplacer l'outil vers la gauche",
			moveRightA11y: "Déplacer l'outil vers la droite",
			moveUpA11y: "Déplacer l'outil vers le haut",
			moveDownA11y: "Déplacer l'outil vers le bas",
			narrowerA11y: "Rendre la fenêtre de l'outil plus étroite",
			widerA11y: "Rendre la fenêtre de l'outil plus large",
			shorterA11y: "Rendre la fenêtre de l'outil moins haute",
			tallerA11y: "Rendre la fenêtre de l'outil plus haute",
			centerA11y: "Centrer la fenêtre de l'outil",
			closeA11y: "Fermer l'outil",
		},

		placement: {
			controlsA11y: "Déplacer et faire pivoter",
			moveAndResizeA11y: "Déplacer et redimensionner",
			rotateClockwiseA11y: "Pivoter de {degrees}° dans le sens horaire",
			rotateCounterclockwiseA11y:
				"Pivoter de {degrees}° dans le sens antihoraire",
		},

		announce: {
			movedUp: "Déplacé vers le haut à {position}",
			movedDown: "Déplacé vers le bas à {position}",
			movedLeft: "Déplacé vers la gauche à {position}",
			movedRight: "Déplacé vers la droite à {position}",
			rotatedTo: "Pivoté à {degrees} degrés",
		},
	},

	tools: {
		calculator: {
			name: "Calculatrice",
			nameBasic: "Calculatrice basique",
			nameScientific: "Calculatrice scientifique",
			nameGraphing: "Calculatrice graphique",
			description:
				"Calculatrice multi-types (basique, scientifique, graphique)",
			openedBasic: "Calculatrice basique ouverte",
			openedScientific: "Calculatrice scientifique ouverte",
			openedGraphing: "Calculatrice graphique ouverte",
			closedBasic: "Calculatrice basique fermée",
			closedScientific: "Calculatrice scientifique fermée",
			closedGraphing: "Calculatrice graphique fermée",
			toolA11y: "Outil Calculatrice",
			loading: "Chargement de la calculatrice…",
			providerUnavailable: "La calculatrice est indisponible.",
			initFailed: "Impossible d'initialiser la calculatrice.",
		},
		graph: {
			name: "Graphique",
			description: "Repère cartésien",
			buttonA11y: "Graphique, repère cartésien",
			tooltip: "Graphique",
			toolA11y:
				"Outil Graphique — placer des points et tracer des droites dans un repère cartésien",
			canvasA11y:
				"Zone de graphique — utilisez les outils pour ajouter des points et tracer des droites",
			grid: "Quadrillage\u00A0:",
			gridOpacityA11y: "Opacité du quadrillage",
			pointA11y: "Point du graphique {id}",
			modeSelector: "Sélecteur",
			modeSelectorHint:
				"Sélecteur\u00A0: cliquez et faites glisser les points pour les déplacer, ainsi que les droites associées.",
			modePoint: "Point",
			modePointHint:
				"Point\u00A0: cliquez dans le quadrillage pour ajouter des points.",
			modeLine: "Droite",
			modeLineHint:
				"Droite\u00A0: cliquez sur un point de départ, puis sur un point d'arrivée pour tracer une droite.",
			modeDelete: "Supprimer",
			modeDeleteHint:
				"Supprimer\u00A0: cliquez sur un point pour le supprimer, ainsi que les droites qui y sont reliées.",
		},
		periodicTable: {
			name: "Tableau périodique",
			description: "Tableau périodique des éléments",
			buttonA11y: "Tableau périodique, référence de chimie",
			tooltip: "Tableau périodique",
			toolA11y:
				"Tableau périodique — sélectionnez un élément pour voir ses données",
			elementsA11y: "Éléments du tableau périodique",
			showAllA11y: "Afficher tous les éléments",
			allElements: "Tous les éléments",
			atomicMass: "Masse atomique",
			atomicNumber: "Numéro atomique",
			electronConfig: "Configuration électronique",
			phase: "État",
			filterByA11y: "Filtrer par {category}",
			elementA11y:
				"{name}, symbole\u00A0: {symbol}, numéro atomique\u00A0: {number}, masse atomique\u00A0: {mass}, catégorie\u00A0: {category}",
			outsideFilterA11y: ", hors du filtre actuel",
			category: {
				unknown: "Inconnue",
				alkaliMetal: "Métal alcalin",
				alkalineEarthMetal: "Métal alcalino-terreux",
				transitionMetal: "Métal de transition",
				postTransitionMetal: "Métal pauvre",
				metalloid: "Métalloïde",
				diatomicNonmetal: "Non-métal diatomique",
				polyatomicNonmetal: "Non-métal polyatomique",
				nobleGas: "Gaz noble",
				lanthanide: "Lanthanide",
				actinide: "Actinide",
			},
		},
		ruler: {
			name: "Règle",
			description: "Règle à l'écran pour mesurer",
			buttonA11y: "Règle",
			tooltip: "Règle",
			toolA11y: "Règle, outil de mesure déplaçable et orientable",
			unitSelectionA11y: "Choix de l'unité de la règle",
			inches: "Pouces",
			centimeters: "Centimètres",
			inchesInSentence: "pouces",
			centimetersInSentence: "centimètres",
			switchToInchesA11y: "Passer aux pouces",
			switchToCentimetersA11y: "Passer aux centimètres",
			switchedTo: "Passé à l'unité {unit}",
			applicationA11y:
				"Outil Règle. Flèches pour déplacer, Shift+flèches pour pivoter, PageUp ou PageDown pour un réglage fin de la rotation, et U pour changer d'unité. Unité actuelle\u00A0: {unit}",
			imageAlt: "Règle en {unit}",
		},
		protractor: {
			name: "Rapporteur",
			description: "Rapporteur à l'écran pour mesurer les angles",
			buttonA11y: "Rapporteur",
			tooltip: "Rapporteur",
			toolA11y:
				"Outil Rapporteur. Flèches pour déplacer, Shift+flèches pour pivoter, et PageUp ou PageDown pour un réglage fin de la rotation.",
			roleA11y: "Rapporteur, outil de mesure déplaçable et orientable",
			imageAlt:
				"Rapporteur à échelle semi-circulaire de 180 degrés, gradué de 0 à 180 degrés dans les deux sens, avec des graduations tous les 10 degrés",
		},
		dictionary: {
			name: "Dictionnaire",
			description: "Chercher les définitions des mots",
			buttonA11y: "Dictionnaire, chercher les définitions des mots",
			tooltip: "Dictionnaire",
			toolA11y: "Dictionnaire",
			notConfigured:
				"Aucun service de dictionnaire n'est configuré pour ce test.",
			idleHint: "Saisissez un mot pour chercher sa définition.",
			lookingUp: "Recherche de «\u00A0{term}\u00A0»…",
			noEntryFor: "Aucune entrée pour «\u00A0{term}\u00A0».",
			entriesCount: {
				one: "{count} entrée",
				other: "{count} entrées",
			},
			noEntryStatusFor: "Aucune entrée de dictionnaire pour {term}.",
		},
		pictureDictionary: {
			name: "Dictionnaire en images",
			description: "Chercher des images pour les mots",
			buttonA11y: "Dictionnaire en images, chercher des images pour les mots",
			tooltip: "Dictionnaire en images",
			toolA11y: "Dictionnaire en images",
			notConfigured:
				"Aucun service de dictionnaire en images n'est configuré pour ce test.",
			idleHint: "Saisissez un mot pour voir une image.",
			lookingUp: "Recherche de «\u00A0{term}\u00A0»…",
			noEntryFor: "Aucune image pour «\u00A0{term}\u00A0».",
			entriesCount: {
				one: "{count} image",
				other: "{count} images",
			},
			noEntryStatusFor: "Aucune image pour {term}.",
		},
		dictionarySpanish: {
			name: "Dictionnaire en espagnol",
			description: "Chercher les définitions des mots en espagnol",
			buttonA11y:
				"Dictionnaire en espagnol, chercher les définitions des mots en espagnol",
			tooltip: "Dictionnaire en espagnol",
			toolA11y: "Dictionnaire en espagnol",
		},
		pictureDictionarySpanish: {
			name: "Dictionnaire en images en espagnol",
			description: "Chercher des images pour les mots en espagnol",
			buttonA11y:
				"Dictionnaire en images en espagnol, chercher des images pour les mots en espagnol",
			tooltip: "Dictionnaire en images en espagnol",
			toolA11y: "Dictionnaire en images en espagnol",
		},
		lineReader: {
			name: "Aide à la lecture",
			description: "Guide de lecture superposé",
			buttonA11y: "Aide à la lecture, guide de lecture",
			tooltip: "Aide à la lecture",
			roleA11y: "Guide de lecture superposé, déplaçable et redimensionnable",
			close: "Fermer l'aide à la lecture",
			resizeWindowA11y:
				"Faites glisser pour redimensionner la fenêtre de lecture",
			resizeFrameA11y:
				"Faites glisser pour redimensionner le cadre et la largeur de la fenêtre",
			windowHeightAnnounce:
				"Hauteur de la fenêtre de lecture\u00A0: {pixels} pixels",
			frameHeightAnnounce: "Hauteur du cadre\u00A0: {pixels} pixels",
			widthAnnounce: "Largeur\u00A0: {pixels} pixels",
			shorterWindowA11y: "Rendre la fenêtre de lecture moins haute",
			tallerWindowA11y: "Rendre la fenêtre de lecture plus haute",
			shorterFrameA11y: "Rendre le cadre moins haut",
			tallerFrameA11y: "Rendre le cadre plus haut",
			narrowerA11y: "Rendre l'aide à la lecture plus étroite",
			widerA11y: "Rendre l'aide à la lecture plus large",
			applicationA11y:
				"Outil Aide à la lecture. Une fenêtre de lecture claire dans un cadre occultant. Flèches pour déplacer, +/- pour redimensionner la fenêtre de lecture, Échap pour fermer. Hauteur de la fenêtre de lecture\u00A0: {paneHeight} pixels, hauteur du cadre\u00A0: {frameHeight} pixels",
			resizeWindowFullA11y:
				"Redimensionner la fenêtre de lecture. Faites glisser, ou utilisez les flèches haut et bas pour changer sa hauteur. Hauteur actuelle {paneHeight} pixels",
			resizeFrameFullA11y:
				"Redimensionner le cadre. Faites glisser, ou utilisez les flèches haut et bas pour changer la hauteur du cadre et les flèches gauche et droite pour changer la largeur. Hauteur actuelle du cadre {frameHeight} pixels, largeur {width} pixels",
		},
		magnification: {
			name: "Loupe",
			description: "Agrandir le contenu sous une lentille mobile",
			buttonA11y: "Loupe, agrandir le contenu sous une lentille",
			tooltip: "Loupe",
			roleA11y: "Lentille grossissante déplaçable et redimensionnable",
			applicationA11y:
				"Loupe à {zoom} fois. Flèches pour déplacer la lentille, + et - pour changer l'agrandissement, et Échap pour fermer.",
			zoomIn: "Zoom avant",
			zoomOut: "Zoom arrière",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Agrandissement de {zoom} fois",
			close: "Fermer la loupe",
			resizeA11y: "Faites glisser pour redimensionner la loupe",
			resizeFullA11y:
				"Redimensionner la loupe. Faites glisser, ou utilisez les flèches. Taille actuelle {width} par {height} pixels",
			sizeAnnounce: "Loupe {width} par {height} pixels",
			narrowerA11y: "Rendre la loupe plus étroite",
			widerA11y: "Rendre la loupe plus large",
			shorterA11y: "Rendre la loupe moins haute",
			tallerA11y: "Rendre la loupe plus haute",
		},
		answerEliminator: {
			name: "Barrer les réponses",
			description: "Barrer les options de réponse",
			buttonA11y: "Barrer, éliminer des options de réponse",
			tooltip: "Barrer",
		},
		highlighter: {
			name: "Surligneur",
			description: "Surligner et annoter le texte",
			buttonA11y: "Surligner le texte",
			tooltip: "Surligner",
		},
		annotationToolbar: {
			name: "Annotation",
			description: "Surligner et annoter le texte",
			buttonA11y: "Annoter, surligner et marquer le texte",
			tooltip: "Annoter",
			toolbarA11y: "Barre d'outils d'annotation de texte",
			underline: "Souligner",
			underlineA11y: "Souligner le texte sélectionné",
			readAloud: "Lire à voix haute",
			readAloudA11y: "Lire à voix haute le texte sélectionné",
			remove: "Supprimer",
			removeA11y: "Supprimer cette annotation",
			clearAll: "Tout effacer",
			clearAllA11y: "Effacer toutes les annotations du document",
			highlightYellowA11y: "Surlignage jaune",
			highlightPinkA11y: "Surlignage rose",
			highlightBlueA11y: "Surlignage bleu",
			highlightGreenA11y: "Surlignage vert",
		},
		theme: {
			name: "Thème",
			description: "Thèmes et contraste accessibles",
			buttonA11y: "Thème, changer les couleurs et le contraste",
			tooltip: "Thème",
			selectorA11y: "Sélecteur de thème",
			hint: "Choisissez un thème pour améliorer la lisibilité et réduire la fatigue oculaire.",
			selectA11y: "Choisir un thème",
			selectCurrentA11y: "Choisir un thème. Thème actuel\u00A0: {name}",
			optionUnavailableA11y: "{name}, indisponible",
			unavailableName: "Thème indisponible\u00A0: {id}",
			unavailableDescription:
				"Le thème de base géré par PIE reste actif jusqu'à ce que ce thème redevienne disponible.",
			unavailableStatus:
				"Le thème choisi est indisponible. Le thème de base géré par PIE reste actif jusqu'à ce qu'il redevienne disponible.",
		},
		textToSpeech: {
			name: "Lecture à voix haute",
			description: "Lire le contenu à voix haute",
			initFailed:
				"Impossible d'initialiser la lecture à voix haute. Réessayez.",
			inline: {
				controlsA11y: "Commandes de lecture",
				playbackSpeedA11y: "Vitesse de lecture",
				rewindA11y: "Rembobiner",
				fastForwardA11y: "Avancer rapidement",
				stopA11y: "Arrêter la lecture",
				starting: "Démarrage de la lecture",
				started: "Lecture démarrée",
				resumed: "Lecture reprise",
				pausedAnnouncement: "Lecture en pause",
				stopped: "Lecture arrêtée",
				switchedSection: "La lecture est passée à une autre partie",
				nothingToRead: "Rien à lire à voix haute ici",
				startFailed: "Impossible de démarrer la lecture",
				skippedForward: "Avancé rapidement",
				skipForwardFailed: "Impossible d'avancer rapidement",
				skippedBackward: "Rembobiné",
				skipBackwardFailed: "Impossible de rembobiner",
				speedChangeFailed: "Impossible de changer la vitesse de lecture",
				speedAnnounce: "Vitesse de lecture\u00A0: {label}",
				playA11y: "Lire",
				pauseA11y: "Mettre la lecture en pause",
				resumeA11y: "Reprendre la lecture",
			},
		},
		signLanguage: {
			name: "Langue des signes",
			description: "Alternative signée du contenu",
			generic: "Langue des signes",
			unknown: "Langue des signes ({code})",
			ase: "Langue des signes américaine",
			bfi: "Langue des signes britannique",
			fsl: "Langue des signes française",
			gss: "Langue des signes grecque",
			mfs: "Langue des signes mexicaine",
			signedEnglish: "Anglais signé",
			regionA11y: "Traduction en {language}",
		},
		audioTranscript: {
			name: "Transcription audio",
			description: "Transcription textuelle du contenu audio",
			regionA11y: "Transcription",
		},
	},

	debug: {
		session: "Session",
		sessionData: "Données de session",
		sessionDataPersistent: "Données de session PIE (persistantes)",
		noItemSessionYet:
			"Pas encore de données de session d'item. Interagissez avec l'item pour voir les mises à jour ici.",
		itemSessionsSnapshot: "Instantané des sessions d'items",
		sectionControllerUnavailable:
			"Le contrôleur de cette partie n'est pas encore disponible.",
		filteredModel: "Modèle filtré",
		environment: "Environnement",
		events: "Événements",
		controllerEvents: "Événements du contrôleur",
		instrumentation: "Instrumentation",
		databaseState: "État de la base de données",
		sessionDb: "Base de données de sessions (serveur)",
		noRows: "Aucune ligne",
		noRecords: "Pas encore d'enregistrements d'instrumentation.",
		selectRecord: "Sélectionnez un enregistrement pour voir les détails.",
		selectEvent:
			"Sélectionnez un événement pour voir les détails de sa charge utile.",
		showRawTables: "Afficher les tableaux bruts",
		showReconstructedSnapshots: "Afficher les instantanés reconstruits",
		showSectionRequest: "Afficher la requête de la partie",
		showAssessmentRequest: "Afficher la requête du test",
		liveUpdatesUnsupported:
			"Les mises à jour en direct ne sont pas prises en charge dans ce navigateur",
		liveUpdatesDisconnected:
			"Mises à jour en direct interrompues\u00A0; nouvelle tentative…",
		fieldType: "Type\u00A0:",
		fieldTarget: "Cible\u00A0:",
		fieldItem: "Item\u00A0:",
		fieldCanonical: "Canonique\u00A0:",
		fieldIntent: "Intention\u00A0:",
		fieldDuplicates: "Doublons\u00A0:",
		fieldSemanticRepeats: "Répétitions sémantiques\u00A0:",
		dragItemSessionPanelA11y: "Faire glisser le panneau de session d'item",
		debuggerTabsA11y: "Onglets du débogueur",
		sessionDataJsonA11y: "JSON des données de session",
		environmentJsonA11y: "JSON de l'environnement",
		filteredModelJsonA11y: "JSON du modèle filtré",
		sectionSessionJsonA11y:
			"JSON de l'instantané de la session de la partie",
		eventLevelFilterA11y: "Filtre par niveau d'événement",
		controllerEventDetailsA11y: "Détails de l'événement du contrôleur",
		instrumentationFilterA11y:
			"Filtrer le type d'enregistrement d'instrumentation",
		instrumentationDetailsA11y:
			"Détails de l'enregistrement d'instrumentation",
		toggleSessionPanelA11y: "Afficher ou masquer le panneau de session",
		toggleEventPanelA11y:
			"Afficher ou masquer le panneau des événements",
		toggleDatabasePanelA11y:
			"Afficher ou masquer le panneau de la base de données",
		toggleInstrumentationPanelA11y:
			"Afficher ou masquer le panneau d'instrumentation",
		clear: "Effacer",
		pause: "Suspendre",
		resume: "Reprendre",
		controllerUnavailable: "Contrôleur indisponible",
		noMatchingEvents: "Aucun événement correspondant pour l'instant. Interagissez avec une question pour capturer les événements du contrôleur.",
		noSectionSessionYet: "Pas encore de données de session de la partie. Interagissez avec les questions pour voir les mises à jour ici.",
		eventLevelItem: "item",
		eventLevelSection: "partie",
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		instrumentationFieldName: "nom :",
		instrumentationFieldKind: "type :",
		instrumentationFieldProvider: "fournisseur :",
		instrumentationFieldTimestamp: "horodatage :",
		instrumentationFieldValue: "valeur :",
		instrumentationFieldError: "erreur :",
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",


		pnp: {
			title: "Profil PNP",
			noAssessmentBound: "Aucun test associé",
			noAssessmentBoundBody:
				"Le profil, les politiques de l'établissement et de passation n'ont rien à lire, donc seuls les requiredTools d'un item peuvent accorder un aménagement. Passez le test à la propriété assessment du toolkit, ou appelez updateAssessment(...) sur le coordinateur du toolkit.",
			determinationReadOnly: "Décision (lecture seule)",
			toolsEditor: "Éditeur d'outils",
			enforcement: "Application du PNP",
			allAvailableTools: "Tous les outils disponibles",
			clearPlacement: "Effacer le placement",
			tool: "Outil",
			placement: "Placement",
			provider: "Fournisseur",
			simulation: "Simulation PNP",
			resolvedTools: "Outils résolus (toolkit)",
			provenanceSummary:
				"Résumé de la provenance de la politique d'outils",
			perToolDecisions: "Décisions par outil",
			policyDiagnostics: "Diagnostics de la politique",
			profileReadOnly: "Profil PNP (lecture seule)",
			on: "Activé",
			effective: "Effectif :",
			needs: "requiert",
			hostSurfaceNotPlaced: "surface hôte (non placée)",
			support: "autoriser",
			prohibit: "interdire",
		},

		tts: {
			title: "Paramètres de synthèse vocale",
			closeA11y: "Fermer les paramètres de synthèse vocale",
			toolbarLayoutMode: "Mode de disposition de la barre d'outils",
			reservedRow: "Ligne réservée",
			expandingRow: "Ligne extensible",
			floatingOverlay: "Superposition flottante",
			leftAlignedControls: "Commandes alignées à gauche",
			inlineSpeedButtons: "Boutons de vitesse en ligne",
			resetToDefaults: "Rétablir les valeurs par défaut",
			mathHighlighting: "Surlignage des formules",
			checkingAvailability: "Vérification de la disponibilité…",
			recheck: "Revérifier",
			voice: "Voix",
			bestAvailableVoice: "Meilleure voix disponible (auto)",
			unnamedVoice: "Voix sans nom",
			apiEndpoint: "Point d'accès API",
			gender: "Genre",
			any: "Indifférent",
			male: "Masculin",
			female: "Féminin",
			neutral: "Neutre",
			engine: "Moteur",
			neural: "Neuronal",
			standard: "Standard",
			providerDefault: "Valeur par défaut du fournisseur",
			format: "Format",
			sampleRate: "Fréquence d'échantillonnage",
			speechMarks: "Marques de parole",
			word: "Mot",
			wordAndSentence: "Mot + phrase",
			voiceType: "Type de voix",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Texte brut",
			sampleText: "Texte d'exemple",
			resetSample: "Réinitialiser l'exemple",
			providerAvailable: "Fournisseur disponible.",
			providerUnavailable: "Fournisseur indisponible.",
			providerCheckFailed:
				"La vérification de la disponibilité du fournisseur a échoué.",
			providerNotChecked:
				"La disponibilité du fournisseur n'a pas encore été vérifiée.",
			webSpeechUnavailable:
				"La Web Speech API n'est pas disponible dans ce navigateur.",
			browserNoVoices:
				"La synthèse vocale du navigateur est disponible, mais aucune voix n'a encore été renvoyée.",
			browserUnavailable:
				"La synthèse vocale du navigateur n'est pas disponible.",
			googleUnavailable:
				"Google Cloud TTS n'est pas disponible via l'API configurée.",
			pollyUnavailable:
				"AWS Polly n'est pas disponible via l'API configurée.",
			recommendedVoices: "Voix recommandées",
			allVoices: "Toutes les voix disponibles",
			previewVoice: "Écouter un échantillon de la voix",
			stopPreview: "Arrêter l'échantillon",
			applying: "Application en cours…",
			ssmlPreviewUnsupported:
				"L'aperçu SSML n'est pas pris en charge par le backend navigateur.",
			pollySsmlHint:
				"Certaines voix neuronales Polly rejettent certaines balises SSML (par exemple emphasis). Utilisez des balises SSML simples si l'aperçu échoue.",
			mathHighlightParts:
				"Chaque partie d'une formule est surlignée pendant sa lecture, l'ensemble de la formule l'est lorsque l'alignement est incertain.",
			mathHighlightBlock:
				"Chaque formule est surlignée comme un bloc unique au lieu d'être découpée en parties.",
			previewFailed: "Échec de la lecture de l'aperçu audio.",
			previewNoAudio:
				"La réponse de l'aperçu ne contenait pas de contenu audio.",
			previewEnterText:
				"Saisissez le texte de l'aperçu avant de lancer la lecture.",
			previewUnavailable:
				"Aperçu impossible tant que ce service est indisponible.",
			browserSynthesisUnavailable:
				"La synthèse vocale du navigateur est indisponible.",
			ssmlWordTrackingDisabled:
				"L'aperçu SSML de Google conserve le SSML d'origine, le suivi des mots est donc désactivé.",
			applyUnavailable:
				"Impossible d'appliquer les paramètres tant que ce service est indisponible.",
			coordinatorUnavailable:
				"Le coordinateur du toolkit n'est pas disponible pour les mises à jour de la synthèse vocale.",
			customProviderNotRegistered:
				"Le fournisseur personnalisé '{id}' n'est pas enregistré.",
			customProviderNoConfig:
				"Le fournisseur personnalisé '{id}' n'a renvoyé aucune configuration à appliquer.",
			httpError: "HTTP {status}\u00A0: {message}",
			unknownError: "Erreur inconnue",
			previewRequestFailed:
				"Échec de la requête d'aperçu ({status}).",
			notAvailable: "n.d.",
			voiceLocal: "locale",
			voiceRemote: "distante",
			voiceBrowserDefault: "voix par défaut du navigateur",
			browserAvailable: {
				one: "Synthèse vocale du navigateur disponible ({count} voix détectée).",
				other: "Synthèse vocale du navigateur disponible ({count} voix détectées).",
			},
			pollyAvailable: {
				one: "AWS Polly disponible ({count} voix correspondante, moteur {engine}).",
				other: "AWS Polly disponible ({count} voix correspondantes, moteur {engine}).",
			},
			googleAvailable: {
				one: "Google Cloud TTS disponible ({count} voix correspondante).",
				other: "Google Cloud TTS disponible ({count} voix correspondantes).",
			},
			headerRowReservation:
				"Réservation de la ligne d'en-tête de l'item\u00A0: {state}",
			speedOptionsHelp:
				"Multiplicateurs séparés par des virgules ou des points-virgules. Incluez 1 pour la vitesse normale\u00A0; laissez vide pour masquer les commandes de vitesse.",
			usingSelectedVoice: "Voix utilisée\u00A0: {voice}",
			autoVoice: "Meilleure voix disponible (auto)\u00A0: {voice}",
			autoVoiceWaiting:
				"Meilleure voix disponible (auto)\u00A0: en attente des voix du navigateur.",
			previewHintBrowserSsml:
				"SSML non pris en charge dans l'aperçu navigateur.",
			previewHintGoogleSsml: "SSML conservé. Suivi désactivé.",
			previewHintCustom:
				"Suivi activé lorsque le fournisseur renvoie des marques de parole.",
			previewHintTracking: "Suivi actif pendant la lecture de l'aperçu.",
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

export default fr;
