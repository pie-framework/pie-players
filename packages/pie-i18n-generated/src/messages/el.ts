/**
 * Greek message catalog — reviewed (agent pass in lieu of a native reader,
 * 2026-11-04; see `reviewedBy` in `catalog-manifest.json`).
 *
 * Serves every Greek host: registered under the bare `el` tag, so `el`,
 * `el-GR` and `el-CY` widen to it. Content flavour is the Microsoft-Greek
 * school register per `briefs/el.md` — controls carry the noun form where
 * Greek software has one and the polite imperative plural elsewhere, errors
 * use the "Δεν ήταν δυνατή…" pattern, state changes are authored as aorist
 * event sentences, and school terminology is the Greek classroom's own
 * (ερώτηση, κείμενο, ενότητα, χάρακας, μοιρογνωμόνιο). A Greece- or
 * Cyprus-focused host can override any key through `customMessages`.
 *
 * Regeneration is surgical, never wholesale: `scripts/check-catalogs.ts`
 * diffs the English snapshot (`el.english-snapshot.json`) against the live
 * `en-US` source and lists exactly the keys whose English moved; translate
 * only those, keep every reviewed string, then refresh the snapshot per the
 * package README.
 *
 * @module @pie-players/pie-i18n-generated/messages/el
 */

const el = {
	common: {
		close: "Κλείσιμο",
		cancel: "Ακύρωση",
		save: "Αποθήκευση",
		reset: "Επαναφορά",
		retry: "Επανάληψη",
		back: "Πίσω",
		next: "Επόμενο",
		previous: "Προηγούμενο",
		submit: "Υποβολή",
		continue: "Συνέχεια",
		finish: "Ολοκλήρωση",
		yes: "Ναι",
		no: "Όχι",
		ok: "ΟΚ",
		any: "Οποιοδήποτε",
		off: "Ανενεργό",
		auto: "Αυτόματο",
		all: "Όλα",
		none: "Κανένα",
		loading: "Φόρτωση…",
		error: "Σφάλμα",
		settings: "Ρυθμίσεις",
		language: "Γλώσσα",
		theme: "Θέμα",
		preview: "Προεπισκόπηση",
		author: "Συγγραφή",
		unknown: "Άγνωστο",
		untitled: "Χωρίς τίτλο",
		apply: "Εφαρμογή",
		enabled: "Ενεργό",
		disabled: "Ανενεργό",
		lookUp: "Αναζήτηση",
		wordOrPhrase: "Λέξη ή φράση",
		closeA11y: "Κλείσιμο",
		settingsA11y: "Άνοιγμα του μενού ρυθμίσεων",
	},

	player: {
		passage: "Κείμενο",
		passages: "Κείμενα",
		question: "Ερώτηση",
		questionNumbered: "Ερώτηση {position}",
		questions: "Ερωτήσεις",
		items: "Ερωτήσεις",
		section: "Ενότητα",
		loadingSection: "Φόρτωση του περιεχομένου της ενότητας…",
		sectionLoadError: "Δεν ήταν δυνατή η φόρτωση του περιεχομένου της ενότητας.",
		loadingPassage: "Φόρτωση του περιεχομένου του κειμένου…",
		configurationError: "Σφάλμα διαμόρφωσης",
		playerError: "Σφάλμα αναπαραγωγέα",
		authoringBackendError: "Σφάλμα διαμόρφωσης του backend συγγραφής",
		itemLoadError: "Δεν ήταν δυνατή η φόρτωση της ερώτησης.",
		sectionTabsA11y: "Καρτέλες περιεχομένου της ενότητας",
		passagesRegionA11y: "Κείμενα",
		itemsRegionA11y: "Ερωτήσεις",
		sectionToolsA11y: "Εργαλεία της ενότητας",
		scrollDownA11y: "Κύλιση προς τα κάτω",
		resizePanels: "Αλλαγή μεγέθους των πάνελ",
		resizePassagesAndItemsA11y:
			"Αλλαγή μεγέθους των πάνελ κειμένων και ερωτήσεων",
		resizeMediaRegion: "Αλλαγή μεγέθους της περιοχής πολυμέσων",
		resizeQuestionAndMediaA11y:
			"Αλλαγή μεγέθους των πάνελ ερώτησης και πολυμέσων",
		resizePassageAndMediaA11y:
			"Αλλαγή μεγέθους των πάνελ κειμένου και πολυμέσων",
		resizePassageAndQuestionA11y:
			"Αλλαγή μεγέθους των πάνελ κειμένου και ερώτησης",
		passageWidthA11y: "Πλάτος κειμένου: {percent}%",
		questionPositionA11y: "Ερώτηση {position} από {total}",
		questionPositionLabeledA11y: "{label}, ερώτηση {position} από {total}",

		assessment: {
			sectionPosition: "Ενότητα {position} από {total}",
			noSections: "Δεν υπάρχουν ενότητες",
			loadFailed: "Δεν ήταν δυνατή η φόρτωση της αξιολόγησης. Δοκιμάστε ξανά.",
			restoreFailed:
				"Δεν ήταν δυνατή η επαναφορά των αποθηκευμένων απαντήσεών σας για αυτήν την ενότητα. Δοκιμάστε ξανά.",
		},

		check: {
			answer: "Έλεγχος απάντησης",
			tryAgain: "Δοκιμή ξανά",
			answerRecorded: "Η απάντηση καταγράφηκε.",
			correct: "Σωστό.",
			partlyCorrect: "Εν μέρει σωστό.",
			notCorrect: "Λανθασμένο.",
			notAutoScored:
				"Η απάντηση καταγράφηκε. Αυτή η ερώτηση δεν βαθμολογείται αυτόματα.",
			failed: "Δεν ήταν δυνατός ο έλεγχος αυτής της ερώτησης. Δοκιμάστε ξανά.",
			triesLeft: {
				one: "Απομένει {count} προσπάθεια.",
				other: "Απομένουν {count} προσπάθειες.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"Οι ερωτήσεις θα εμφανίζονται καθώς αναπαράγεται το μέσο.",
			questionAvailable: "Η ερώτηση {position} είναι πλέον διαθέσιμη.",
			playbackPaused:
				"Η αναπαραγωγή σε παύση. Απαντήστε στην ερώτηση {position} για να συνεχίσει.",
			playbackAdvisory:
				"Απαντήστε στην ερώτηση {position} πριν συνεχίσετε με το μέσο.",
			playbackReleased:
				"Η απάντηση έγινε δεκτή. Συνεχίστε την αναπαραγωγή του μέσου.",
		},

		summary: {
			correctA11y: "Σωστή απάντηση",
			answer: "Απάντηση",
			manualScoring: "Βαθμολογείται από εκπαιδευτικό",
			audio: "Ήχος",
			video: "Βίντεο",
		},
		list: {
			expandA11y: "Εμφάνιση ολόκληρης της ερώτησης",
			highlights: "Αντιστοιχίες αναζήτησης",
			collapse: "Εμφάνιση σύνοψης",
			playerError: "Δεν ήταν δυνατή η φόρτωση ολόκληρης της ερώτησης.",
		},
	},

	toolkit: {
		toolsA11y: "Εργαλεία αξιολόγησης",
		toolbarInitError: "Δεν ήταν δυνατή η εκκίνηση των εργαλείων αξιολόγησης.",
		settingsTitle: "Ρυθμίσεις",
		closeSettingsA11y: "Κλείσιμο ρυθμίσεων",
		dragPanelA11y: "Σύρετε το πάνελ",
		closePanelA11y: "Κλείσιμο πάνελ",
		resizeWindow: "Αλλαγή μεγέθους παραθύρου",
		minimize: "Ελαχιστοποίηση",
		maximize: "Μεγιστοποίηση",
		minimizePanelA11y: "Ελαχιστοποίηση πάνελ",
		maximizePanelA11y: "Μεγιστοποίηση πάνελ",

		window: {
			moveLeftA11y: "Μετακίνηση του εργαλείου αριστερά",
			moveRightA11y: "Μετακίνηση του εργαλείου δεξιά",
			moveUpA11y: "Μετακίνηση του εργαλείου πάνω",
			moveDownA11y: "Μετακίνηση του εργαλείου κάτω",
			narrowerA11y: "Μείωση του πλάτους του παραθύρου εργαλείου",
			widerA11y: "Αύξηση του πλάτους του παραθύρου εργαλείου",
			shorterA11y: "Μείωση του ύψους του παραθύρου εργαλείου",
			tallerA11y: "Αύξηση του ύψους του παραθύρου εργαλείου",
			centerA11y: "Κεντράρισμα του παραθύρου εργαλείου",
			closeA11y: "Κλείσιμο του εργαλείου",
		},

		placement: {
			controlsA11y: "Μετακίνηση και περιστροφή",
			moveAndResizeA11y: "Μετακίνηση και αλλαγή μεγέθους",
			rotateClockwiseA11y: "Περιστροφή {degrees}° δεξιόστροφα",
			rotateCounterclockwiseA11y: "Περιστροφή {degrees}° αριστερόστροφα",
		},

		announce: {
			movedUp: "Μετακινήθηκε προς τα πάνω στη θέση {position}",
			movedDown: "Μετακινήθηκε προς τα κάτω στη θέση {position}",
			movedLeft: "Μετακινήθηκε προς τα αριστερά στη θέση {position}",
			movedRight: "Μετακινήθηκε προς τα δεξιά στη θέση {position}",
			rotatedTo: "Περιστράφηκε στις {degrees} μοίρες",
		},
	},

	tools: {
		calculator: {
			name: "Αριθμομηχανή",
			nameBasic: "Βασική αριθμομηχανή",
			nameScientific: "Επιστημονική αριθμομηχανή",
			nameGraphing: "Γραφική αριθμομηχανή",
			description:
				"Αριθμομηχανή πολλαπλών τύπων (βασική, επιστημονική, γραφική)",
			openedBasic: "Άνοιξε η βασική αριθμομηχανή",
			openedScientific: "Άνοιξε η επιστημονική αριθμομηχανή",
			openedGraphing: "Άνοιξε η γραφική αριθμομηχανή",
			closedBasic: "Έκλεισε η βασική αριθμομηχανή",
			closedScientific: "Έκλεισε η επιστημονική αριθμομηχανή",
			closedGraphing: "Έκλεισε η γραφική αριθμομηχανή",
			toolA11y: "Αριθμομηχανή",
			loading: "Φόρτωση αριθμομηχανής…",
			providerUnavailable: "Η αριθμομηχανή δεν είναι διαθέσιμη.",
			initFailed: "Δεν ήταν δυνατή η εκκίνηση της αριθμομηχανής.",
		},
		graph: {
			name: "Γράφημα",
			description: "Σύστημα συντεταγμένων",
			buttonA11y: "Γράφημα, σύστημα συντεταγμένων",
			tooltip: "Γράφημα",
			toolA11y:
				"Εργαλείο γραφήματος — προσθέστε σημεία και σχεδιάστε γραμμές στο σύστημα συντεταγμένων",
			canvasA11y:
				"Καμβάς γραφήματος — χρησιμοποιήστε τα εργαλεία για να προσθέσετε σημεία και να σχεδιάσετε γραμμές",
			grid: "Πλέγμα:",
			gridOpacityA11y: "Αδιαφάνεια πλέγματος",
			pointA11y: "Σημείο {id}",
			modeSelector: "Επιλογή",
			modeSelectorHint:
				"Επιλογή: κάντε κλικ και σύρετε τα σημεία για να τα μετακινήσετε ή να μετακινήσετε τις γραμμές που συνδέονται με αυτά.",
			modePoint: "Σημείο",
			modePointHint:
				"Σημείο: κάντε κλικ στο πλέγμα για να προσθέσετε σημεία.",
			modeLine: "Γραμμή",
			modeLineHint:
				"Γραμμή: κάντε κλικ σε ένα σημείο εκκίνησης και μετά σε ένα τελικό σημείο για να σχεδιάσετε μια γραμμή.",
			modeDelete: "Διαγραφή",
			modeDeleteHint:
				"Διαγραφή: κάντε κλικ σε ένα σημείο για να το διαγράψετε μαζί με τις γραμμές που συνδέονται με αυτό.",
		},
		periodicTable: {
			name: "Περιοδικός πίνακας",
			description: "Πηγή αναφοράς για τον περιοδικό πίνακα της χημείας",
			buttonA11y: "Περιοδικός πίνακας, πηγή αναφοράς χημείας",
			tooltip: "Περιοδικός πίνακας",
			toolA11y:
				"Περιοδικός πίνακας — επιλέξτε ένα χημικό στοιχείο για να δείτε τις λεπτομέρειές του",
			elementsA11y: "Στοιχεία του περιοδικού πίνακα",
			showAllA11y: "Εμφάνιση όλων των στοιχείων",
			allElements: "Όλα τα στοιχεία",
			atomicMass: "Ατομική μάζα",
			atomicNumber: "Ατομικός αριθμός",
			electronConfig: "Ηλεκτρονική διαμόρφωση",
			phase: "Φάση",
			filterByA11y: "Φιλτράρισμα κατά {category}",
			elementA11y:
				"{name}, σύμβολο: {symbol}, ατομικός αριθμός: {number}, ατομική μάζα: {mass}, κατηγορία: {category}",
			outsideFilterA11y: ", εκτός του τρέχοντος φίλτρου",
			category: {
				unknown: "Άγνωστη",
				alkaliMetal: "Αλκαλικό μέταλλο",
				alkalineEarthMetal: "Μέταλλο αλκαλικών γαιών",
				transitionMetal: "Μέταλλο μετάβασης",
				postTransitionMetal: "Μέταλλο μετά τη μετάβαση",
				metalloid: "Μεταλλοειδές",
				diatomicNonmetal: "Διατομικό αμέταλλο",
				polyatomicNonmetal: "Πολυατομικό αμέταλλο",
				nobleGas: "Ευγενές αέριο",
				lanthanide: "Λανθανίδιο",
				actinide: "Ακτινίδιο",
			},
			phaseValue: {
				solid: "Στερεό",
				liquid: "Υγρό",
				gas: "Αέριο",
			},
		},
		ruler: {
			name: "Χάρακας",
			description: "Χάρακας στην οθόνη για μετρήσεις",
			buttonA11y: "Χάρακας",
			tooltip: "Χάρακας",
			toolA11y:
				"Εργαλείο μέτρησης με χάρακα που σύρεται και περιστρέφεται",
			unitSelectionA11y: "Επιλογή μονάδας χάρακα",
			inches: "Ίντσες",
			centimeters: "Εκατοστά",
			inchesInSentence: "ίντσες",
			centimetersInSentence: "εκατοστά",
			switchToInchesA11y: "Μετάβαση σε ίντσες",
			switchToCentimetersA11y: "Μετάβαση σε εκατοστά",
			switchedTo: "Έγινε μετάβαση στη μονάδα {unit}",
			applicationA11y:
				"Εργαλείο χάρακα. Χρησιμοποιήστε τα βέλη για μετακίνηση, Shift+βέλη για περιστροφή και PageUp ή PageDown για λεπτή περιστροφή. Με το U εναλλάσσονται οι μονάδες. Τρέχουσα μονάδα: {unit}",
			imageAlt: "Χάρακας που δείχνει {unit}",
		},
		protractor: {
			name: "Μοιρογνωμόνιο",
			description: "Μοιρογνωμόνιο στην οθόνη για μέτρηση γωνιών",
			buttonA11y: "Μοιρογνωμόνιο",
			tooltip: "Μοιρογνωμόνιο",
			toolA11y:
				"Εργαλείο μοιρογνωμονίου. Χρησιμοποιήστε τα βέλη για μετακίνηση, Shift+βέλη για περιστροφή και PageUp ή PageDown για λεπτή περιστροφή.",
			roleA11y:
				"Εργαλείο μέτρησης γωνιών με μοιρογνωμόνιο που σύρεται και περιστρέφεται",
			imageAlt:
				"Μοιρογνωμόνιο με ημικυκλική κλίμακα 180 μοιρών, χαραγμένη από 0 έως 180 μοίρες και προς τις δύο κατευθύνσεις, με χαράξεις ανά 10 μοίρες",
		},
		dictionary: {
			name: "Λεξικό",
			description: "Αναζήτηση ορισμών λέξεων",
			buttonA11y: "Λεξικό, αναζήτηση ορισμών λέξεων",
			tooltip: "Λεξικό",
			toolA11y: "Λεξικό",
			notConfigured:
				"Δεν έχει ρυθμιστεί υπηρεσία λεξικού για αυτήν την αξιολόγηση.",
			idleHint: "Πληκτρολογήστε μια λέξη για να την αναζητήσετε.",
			lookingUp: "Αναζήτηση «{term}»…",
			noEntryFor: "Δεν υπάρχει λήμμα για «{term}».",
			entriesCount: {
				one: "{count} λήμμα",
				other: "{count} λήμματα",
			},
			noEntryStatusFor: "Δεν υπάρχει λήμμα λεξικού για {term}.",
		},
		pictureDictionary: {
			name: "Εικονογραφημένο λεξικό",
			description: "Αναζήτηση εικόνων για λέξεις",
			buttonA11y: "Εικονογραφημένο λεξικό, αναζήτηση εικόνων για λέξεις",
			tooltip: "Εικονογραφημένο λεξικό",
			toolA11y: "Εικονογραφημένο λεξικό",
			notConfigured:
				"Δεν έχει ρυθμιστεί υπηρεσία εικονογραφημένου λεξικού για αυτήν την αξιολόγηση.",
			idleHint: "Πληκτρολογήστε μια λέξη για να δείτε την εικόνα της.",
			lookingUp: "Αναζήτηση «{term}»…",
			noEntryFor: "Δεν υπάρχει εικόνα για «{term}».",
			entriesCount: {
				one: "{count} εικόνα",
				other: "{count} εικόνες",
			},
			noEntryStatusFor: "Δεν υπάρχει εικόνα για {term}.",
		},
		dictionarySpanish: {
			name: "Ισπανικό λεξικό",
			description: "Αναζήτηση ορισμών λέξεων στα ισπανικά",
			buttonA11y: "Ισπανικό λεξικό, αναζήτηση ορισμών λέξεων στα ισπανικά",
			tooltip: "Ισπανικό λεξικό",
			toolA11y: "Ισπανικό λεξικό",
		},
		pictureDictionarySpanish: {
			name: "Ισπανικό εικονογραφημένο λεξικό",
			description: "Αναζήτηση εικόνων για λέξεις στα ισπανικά",
			buttonA11y:
				"Ισπανικό εικονογραφημένο λεξικό, αναζήτηση εικόνων για λέξεις στα ισπανικά",
			tooltip: "Ισπανικό εικονογραφημένο λεξικό",
			toolA11y: "Ισπανικό εικονογραφημένο λεξικό",
		},
		lineReader: {
			name: "Οδηγός ανάγνωσης",
			description: "Επικάλυψη οδηγού ανάγνωσης",
			buttonA11y: "Οδηγός ανάγνωσης, βοήθεια στην ανάγνωση",
			tooltip: "Οδηγός ανάγνωσης",
			roleA11y:
				"Επικάλυψη οδηγού ανάγνωσης που σύρεται και αλλάζει μέγεθος",
			close: "Κλείσιμο του οδηγού ανάγνωσης",
			resizeWindowA11y:
				"Σύρετε για αλλαγή μεγέθους του παραθύρου ανάγνωσης",
			resizeFrameA11y:
				"Σύρετε για αλλαγή μεγέθους του πλαισίου και του πλάτους του παραθύρου",
			windowHeightAnnounce:
				"Ύψος παραθύρου ανάγνωσης: {pixels} εικονοστοιχεία",
			frameHeightAnnounce: "Ύψος πλαισίου: {pixels} εικονοστοιχεία",
			widthAnnounce: "Πλάτος: {pixels} εικονοστοιχεία",
			shorterWindowA11y: "Μείωση του ύψους του παραθύρου ανάγνωσης",
			tallerWindowA11y: "Αύξηση του ύψους του παραθύρου ανάγνωσης",
			shorterFrameA11y: "Μείωση του ύψους του πλαισίου",
			tallerFrameA11y: "Αύξηση του ύψους του πλαισίου",
			narrowerA11y: "Μείωση του πλάτους του οδηγού ανάγνωσης",
			widerA11y: "Αύξηση του πλάτους του οδηγού ανάγνωσης",
			applicationA11y:
				"Εργαλείο οδηγού ανάγνωσης. Ένα καθαρό παράθυρο ανάγνωσης μέσα σε ένα πλαίσιο που σκιάζει το περιεχόμενο. Χρησιμοποιήστε τα βέλη για μετακίνηση, +/- για αλλαγή μεγέθους του παραθύρου ανάγνωσης και Escape για κλείσιμο. Ύψος παραθύρου ανάγνωσης: {paneHeight} εικονοστοιχεία, ύψος πλαισίου: {frameHeight} εικονοστοιχεία",
			resizeWindowFullA11y:
				"Αλλαγή μεγέθους του παραθύρου ανάγνωσης. Σύρετε ή χρησιμοποιήστε τα πλήκτρα βέλους πάνω και κάτω για αλλαγή του ύψους του. Τρέχον ύψος: {paneHeight} εικονοστοιχεία",
			resizeFrameFullA11y:
				"Αλλαγή μεγέθους του πλαισίου. Σύρετε ή χρησιμοποιήστε τα πλήκτρα βέλους πάνω και κάτω για αλλαγή του ύψους του πλαισίου και τα πλήκτρα βέλους αριστερά και δεξιά για αλλαγή του πλάτους. Τρέχον ύψος πλαισίου: {frameHeight} εικονοστοιχεία, πλάτος: {width} εικονοστοιχεία",
		},
		magnification: {
			name: "Μεγεθυντικός φακός",
			description:
				"Μεγέθυνση του περιεχομένου κάτω από έναν μετακινούμενο φακό",
			buttonA11y: "Μεγεθυντικός φακός, μεγέθυνση του περιεχομένου κάτω από φακό",
			tooltip: "Μεγεθυντικός φακός",
			roleA11y: "Μεγεθυντικός φακός που σύρεται και αλλάζει μέγεθος",
			applicationA11y:
				"Μεγεθυντικός φακός {zoom} φορές. Χρησιμοποιήστε τα βέλη για μετακίνηση του φακού, + και - για αλλαγή της μεγέθυνσης και Escape για κλείσιμο.",
			zoomIn: "Μεγέθυνση",
			zoomOut: "Σμίκρυνση",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Μεγέθυνση {zoom} φορές",
			close: "Κλείσιμο του μεγεθυντικού φακού",
			resizeA11y: "Σύρετε για αλλαγή μεγέθους του μεγεθυντικού φακού",
			resizeFullA11y:
				"Αλλαγή μεγέθους του μεγεθυντικού φακού. Σύρετε ή χρησιμοποιήστε τα βέλη. Τρέχον μέγεθος: {width} επί {height} εικονοστοιχεία",
			sizeAnnounce: "Μεγεθυντικός φακός {width} επί {height} εικονοστοιχεία",
			narrowerA11y: "Μείωση του πλάτους του μεγεθυντικού φακού",
			widerA11y: "Αύξηση του πλάτους του μεγεθυντικού φακού",
			shorterA11y: "Μείωση του ύψους του μεγεθυντικού φακού",
			tallerA11y: "Αύξηση του ύψους του μεγεθυντικού φακού",
		},
		answerEliminator: {
			name: "Διαγράμμιση απαντήσεων",
			description: "Διαγράμμιση των επιλογών απάντησης",
			buttonA11y: "Διαγράμμιση, αποκλεισμός των επιλογών απάντησης",
			tooltip: "Διαγράμμιση",
			toggleA11y: "Εναλλαγή αποκλεισμού για την επιλογή {choice}",
			eliminatedA11y: "(αποκλεισμένη)",
			unlabeledChoice: "Επιλογή χωρίς ετικέτα",
		},
		highlighter: {
			name: "Επισήμανση",
			description: "Επισήμανση και σχολιασμός κειμένου",
			buttonA11y: "Επισήμανση κειμένου",
			tooltip: "Επισήμανση",
		},
		annotationToolbar: {
			name: "Σχολιασμός",
			description: "Επισήμανση και σχολιασμός κειμένου",
			buttonA11y: "Σχολιασμός, επισήμανση και σημείωση πάνω στο κείμενο",
			tooltip: "Σχολιασμός",
			toolbarA11y: "Γραμμή εργαλείων σχολιασμού κειμένου",
			underline: "Υπογράμμιση",
			underlineA11y: "Υπογράμμιση του επιλεγμένου κειμένου",
			readAloud: "Εκφώνηση δυνατά",
			readAloudA11y: "Εκφώνηση του επιλεγμένου κειμένου δυνατά",
			remove: "Αφαίρεση",
			removeA11y: "Αφαίρεση αυτού του σχολίου",
			clearAll: "Απαλοιφή όλων",
			clearAllA11y: "Απαλοιφή όλων των σχολίων από το έγγραφο",
			highlightYellowA11y: "Κίτρινη επισήμανση",
			highlightPinkA11y: "Ροζ επισήμανση",
			highlightBlueA11y: "Μπλε επισήμανση",
			highlightGreenA11y: "Πράσινη επισήμανση",
			selectionAvailableA11y:
				"Η γραμμή εργαλείων σχολιασμού κειμένου είναι διαθέσιμη για «{text}». Πατήστε Shift+F10 για τα εργαλεία σχολιασμού.",
			highlightedYellowA11y: "Το «{text}» επισημάνθηκε με κίτρινο",
			highlightedPinkA11y: "Το «{text}» επισημάνθηκε με ροζ",
			highlightedBlueA11y: "Το «{text}» επισημάνθηκε με μπλε",
			highlightedGreenA11y: "Το «{text}» επισημάνθηκε με πράσινο",
			underlinedA11y: "Το «{text}» υπογραμμίστηκε",
			removedA11y: "Το σχόλιο αφαιρέθηκε από το «{text}»",
			clearedA11y: {
				one: "Απαλείφθηκε {count} σχόλιο",
				other: "Απαλείφθηκαν {count} σχόλια",
			},
		},
		theme: {
			name: "Θέμα",
			description: "Προσβάσιμα θέματα και αντίθεση",
			buttonA11y: "Θέμα, αλλαγή χρωμάτων και αντίθεσης",
			tooltip: "Θέμα",
			selectorA11y: "Επιλογέας θεμάτων",
			hint: "Επιλέξτε ένα θέμα για να βελτιώσετε την αναγνωσιμότητα και να μειώσετε την κόπωση των ματιών.",
			selectA11y: "Επιλογή θέματος",
			selectCurrentA11y: "Επιλογή θέματος. Τρέχον θέμα: {name}",
			optionUnavailableA11y: "{name}, μη διαθέσιμο",
			unavailableName: "Μη διαθέσιμο θέμα: {id}",
			unavailableDescription:
				"Το βασικό θέμα που διαχειρίζεται το PIE παραμένει ενεργό μέχρι αυτό το θέμα να είναι ξανά διαθέσιμο.",
			unavailableStatus:
				"Το επιλεγμένο θέμα δεν είναι διαθέσιμο. Το βασικό θέμα που διαχειρίζεται το PIE παραμένει ενεργό μέχρι να είναι ξανά διαθέσιμο.",
		},
		textToSpeech: {
			name: "Εκφώνηση κειμένου",
			description: "Εκφώνηση του περιεχομένου δυνατά",
			initFailed:
				"Δεν ήταν δυνατή η εκκίνηση της εκφώνησης κειμένου. Δοκιμάστε ξανά.",
			inline: {
				controlsA11y: "Στοιχεία ελέγχου εκφώνησης",
				playbackSpeedA11y: "Ταχύτητα εκφώνησης",
				rewindA11y: "Επιστροφή πίσω",
				fastForwardA11y: "Μετάβαση μπροστά",
				stopA11y: "Διακοπή εκφώνησης",
				starting: "Εκκίνηση εκφώνησης",
				started: "Η εκφώνηση ξεκίνησε",
				resumed: "Η εκφώνηση συνεχίστηκε",
				pausedAnnouncement: "Η εκφώνηση σε παύση",
				stopped: "Η εκφώνηση σταμάτησε",
				switchedSection: "Η εκφώνηση πέρασε σε άλλη ενότητα",
				nothingToRead: "Δεν υπάρχει εδώ κάτι για εκφώνηση",
				startFailed: "Δεν ήταν δυνατή η εκκίνηση της εκφώνησης",
				skippedForward: "Έγινε μετάβαση μπροστά",
				skipForwardFailed: "Δεν ήταν δυνατή η μετάβαση μπροστά",
				skippedBackward: "Έγινε μετάβαση πίσω",
				skipBackwardFailed: "Δεν ήταν δυνατή η μετάβαση πίσω",
				speedChangeFailed:
					"Δεν ήταν δυνατή η αλλαγή της ταχύτητας εκφώνησης",
				speedAnnounce: "Ταχύτητα εκφώνησης: {label}",
				playA11y: "Αναπαραγωγή της εκφώνησης",
				pauseA11y: "Παύση της εκφώνησης",
				resumeA11y: "Συνέχιση της εκφώνησης",
			},
		},
		signLanguage: {
			name: "Νοηματική γλώσσα",
			description: "Εναλλακτική σε νοηματική γλώσσα για το περιεχόμενο",

			generic: "Νοηματική γλώσσα",
			unknown: "Νοηματική γλώσσα ({code})",
			ase: "Αμερικανική νοηματική γλώσσα",
			bfi: "Βρετανική νοηματική γλώσσα",
			fsl: "Γαλλική νοηματική γλώσσα",
			gss: "Ελληνική νοηματική γλώσσα",
			mfs: "Μεξικανική νοηματική γλώσσα",
			signedEnglish: "Αγγλικά με νοήματα",
			regionA11y: "Μετάφραση σε {language}",
		},
		audioTranscript: {
			name: "Μεταγραφή ήχου",
			description: "Μεταγραφή σε κείμενο του ηχητικού περιεχομένου",
			regionA11y: "Μεταγραφή",
		},
	},

	debug: {
		session: "Συνεδρία",
		sessionData: "Δεδομένα συνεδρίας",
		sessionDataPersistent: "Δεδομένα συνεδρίας PIE (μόνιμα)",
		noItemSessionYet:
			"Δεν υπάρχουν ακόμα δεδομένα συνεδρίας ερώτησης. Αλληλεπιδράστε με την ερώτηση για να δείτε ενημερώσεις εδώ.",
		itemSessionsSnapshot: "Στιγμιότυπο συνεδριών ερωτήσεων",
		sectionControllerUnavailable:
			"Ο ελεγκτής της ενότητας δεν είναι ακόμα διαθέσιμος για αυτήν την ενότητα.",
		filteredModel: "Φιλτραρισμένο μοντέλο",
		environment: "Περιβάλλον",
		events: "Γεγονότα",
		controllerEvents: "Γεγονότα ελεγκτή",
		instrumentation: "Τηλεμετρία",
		databaseState: "Κατάσταση βάσης δεδομένων",
		sessionDb: "Βάση δεδομένων συνεδριών (διακομιστής)",
		noRows: "Καμία γραμμή",
		noRecords: "Δεν υπάρχουν ακόμα εγγραφές τηλεμετρίας.",
		selectRecord: "Επιλέξτε μια εγγραφή για να εξετάσετε τις λεπτομέρειες.",
		selectEvent:
			"Επιλέξτε ένα γεγονός για να εξετάσετε τις λεπτομέρειες του φορτίου.",
		showRawTables: "Εμφάνιση ακατέργαστων πινάκων",
		showReconstructedSnapshots: "Εμφάνιση ανακατασκευασμένων στιγμιότυπων",
		showSectionRequest: "Εμφάνιση αιτήματος ενότητας",
		showAssessmentRequest: "Εμφάνιση αιτήματος αξιολόγησης",
		liveUpdatesUnsupported:
			"Οι ζωντανές ενημερώσεις δεν υποστηρίζονται σε αυτόν τον περιηγητή",
		liveUpdatesDisconnected:
			"Οι ζωντανές ενημερώσεις αποσυνδέθηκαν· γίνεται νέα προσπάθεια…",
		fieldType: "Τύπος:",
		fieldTarget: "Στόχος:",
		fieldItem: "Ερώτηση:",
		fieldCanonical: "Κανονικοποιημένο:",
		fieldIntent: "Πρόθεση:",
		fieldDuplicates: "Διπλότυπα:",
		fieldSemanticRepeats: "Σημασιολογικές επαναλήψεις:",
		dragItemSessionPanelA11y: "Σύρετε το πάνελ συνεδρίας ερώτησης",
		debuggerTabsA11y: "Καρτέλες αποσφαλματωτή",
		sessionDataJsonA11y: "JSON δεδομένων συνεδρίας",
		environmentJsonA11y: "JSON περιβάλλοντος",
		filteredModelJsonA11y: "JSON φιλτραρισμένου μοντέλου",
		sectionSessionJsonA11y: "JSON στιγμιότυπου συνεδρίας ενότητας",
		eventLevelFilterA11y: "Φίλτρο επιπέδου γεγονότων",
		controllerEventDetailsA11y: "Λεπτομέρειες γεγονότος ελεγκτή",
		instrumentationFilterA11y: "Φιλτράρισμα τύπου εγγραφής τηλεμετρίας",
		instrumentationDetailsA11y: "Λεπτομέρειες εγγραφής τηλεμετρίας",
		toggleSessionPanelA11y: "Εναλλαγή του πάνελ συνεδρίας",
		toggleEventPanelA11y: "Εναλλαγή του πάνελ μετάδοσης γεγονότων",
		toggleDatabasePanelA11y: "Εναλλαγή του πάνελ κατάστασης βάσης δεδομένων",
		toggleInstrumentationPanelA11y: "Εναλλαγή του πάνελ τηλεμετρίας",

		clear: "απαλοιφή",
		pause: "παύση",
		resume: "συνέχιση",
		controllerUnavailable: "ο ελεγκτής δεν είναι διαθέσιμος",
		noMatchingEvents:
			"Δεν υπάρχουν ακόμα αντίστοιχα γεγονότα. Αλληλεπιδράστε με μια ερώτηση για να καταγραφούν γεγονότα ελεγκτή.",
		noSectionSessionYet:
			"Δεν υπάρχουν ακόμα δεδομένα συνεδρίας ενότητας. Αλληλεπιδράστε με τις ερωτήσεις για να δείτε ενημερώσεις.",
		eventLevelItem: "ερώτηση",
		eventLevelSection: "ενότητα",
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		instrumentationFieldName: "όνομα:",
		instrumentationFieldKind: "τύπος:",
		instrumentationFieldProvider: "πάροχος:",
		instrumentationFieldTimestamp: "χρονική σήμανση:",
		instrumentationFieldValue: "τιμή:",
		instrumentationFieldError: "σφάλμα:",
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",

		pnp: {
			title: "Προφίλ PNP",
			noAssessmentBound: "Δεν έχει συνδεθεί αξιολόγηση",
			noAssessmentBoundBody:
				"Το προφίλ, η περιφέρεια και η πολιτική διενέργειας της εξέτασης δεν έχουν τίποτα να διαβάσουν, οπότε μόνο τα requiredTools μιας ερώτησης μπορούν να χορηγήσουν μια προσαρμογή. Περάστε την αξιολόγηση στην ιδιότητα assessment της εργαλειοθήκης ή καλέστε την updateAssessment(...) στον συντονιστή της εργαλειοθήκης.",
			determinationReadOnly: "Καθορισμός (μόνο για ανάγνωση)",
			toolsEditor: "Επεξεργαστής εργαλείων",
			enforcement: "Επιβολή PNP",
			allAvailableTools: "Όλα τα διαθέσιμα εργαλεία",
			clearPlacement: "Απαλοιφή τοποθέτησης",
			tool: "Εργαλείο",
			placement: "Τοποθέτηση",
			provider: "Πάροχος",
			simulation: "Προσομοίωση PNP",
			resolvedTools: "Επιλυμένα εργαλεία (εργαλειοθήκη)",
			provenanceSummary: "Σύνοψη προέλευσης της πολιτικής εργαλείων",
			perToolDecisions: "Αποφάσεις ανά εργαλείο",
			policyDiagnostics: "Διαγνωστικά πολιτικής",
			profileReadOnly: "Προφίλ PNP (μόνο για ανάγνωση)",
			on: "Ενεργό",
			effective: "Σε ισχύ:",
			needs: "απαιτεί",
			hostSurfaceNotPlaced: "επιφάνεια host (χωρίς τοποθέτηση)",
			support: "χορήγηση",
			prohibit: "απαγόρευση",
		},

		tts: {
			title: "Ρυθμίσεις εκφώνησης",
			closeA11y: "Κλείσιμο ρυθμίσεων εκφώνησης",
			toolbarLayoutMode: "Λειτουργία διάταξης γραμμής εργαλείων",
			reservedRow: "Δεσμευμένη σειρά",
			expandingRow: "Σειρά που αναπτύσσεται",
			floatingOverlay: "Επιπλέουσα επικάλυψη",
			leftAlignedControls: "Στοιχεία ελέγχου στοιχισμένα αριστερά",
			inlineSpeedButtons: "Ενσωματωμένα κουμπιά ταχύτητας",
			resetToDefaults: "Επαναφορά προεπιλογών",
			mathHighlighting: "Επισήμανση μαθηματικών τύπων",
			checkingAvailability: "Έλεγχος διαθεσιμότητας…",
			recheck: "Νέος έλεγχος",
			voice: "Φωνή",
			bestAvailableVoice: "Καλύτερη διαθέσιμη φωνή (αυτόματο)",
			unnamedVoice: "Ανώνυμη φωνή",
			apiEndpoint: "Τελικό σημείο API",
			gender: "Φύλο",
			any: "Οποιοδήποτε",
			male: "Ανδρική",
			female: "Γυναικεία",
			neutral: "Ουδέτερη",
			engine: "Μηχανή",
			neural: "Νευρωνική",
			standard: "Συμβατική",
			providerDefault: "Προεπιλογή πάροχου",
			format: "Μορφή",
			sampleRate: "Ρυθμός δειγματοληψίας",
			speechMarks: "Σημάνσεις ομιλίας",
			word: "Λέξη",
			wordAndSentence: "Λέξη + πρόταση",
			voiceType: "Τύπος φωνής",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Απλό κείμενο",
			sampleText: "Δείγμα κειμένου",
			resetSample: "Επαναφορά δείγματος",
			providerAvailable: "Ο πάροχος είναι διαθέσιμος.",
			providerUnavailable: "Ο πάροχος δεν είναι διαθέσιμος.",
			providerCheckFailed:
				"Ο έλεγχος διαθεσιμότητας του πάροχου απέτυχε.",
			providerNotChecked:
				"Η διαθεσιμότητα του πάροχου δεν έχει ελεγχθεί ακόμα.",
			webSpeechUnavailable:
				"Το Web Speech API δεν είναι διαθέσιμο σε αυτόν τον περιηγητή.",
			browserNoVoices:
				"Η εκφώνηση του περιηγητή είναι διαθέσιμη, αλλά δεν έχουν επιστραφεί ακόμα φωνές.",
			browserUnavailable:
				"Η εκφώνηση του περιηγητή δεν είναι διαθέσιμη.",
			googleUnavailable:
				"Το Google Cloud TTS δεν είναι διαθέσιμο από το ρυθμισμένο API.",
			pollyUnavailable:
				"Το AWS Polly δεν είναι διαθέσιμο από το ρυθμισμένο API.",
			recommendedVoices: "Προτεινόμενες φωνές",
			allVoices: "Όλες οι διαθέσιμες φωνές",
			previewVoice: "Προεπισκόπηση φωνής",
			stopPreview: "Διακοπή προεπισκόπησης",
			applying: "Εφαρμογή…",
			ssmlPreviewUnsupported:
				"Η προεπισκόπηση SSML δεν υποστηρίζεται στο backend του περιηγητή.",
			pollySsmlHint:
				"Ορισμένες νευρωνικές φωνές του Polly απορρίπτουν ορισμένες ετικέτες SSML (για παράδειγμα την emphasis). Αν αποτύχει η προεπισκόπηση, χρησιμοποιήστε βασικές ετικέτες SSML.",
			mathHighlightParts:
				"Κατά την ανάγνωση επισημαίνεται κάθε τμήμα του μαθηματικού τύπου, με εναλλαγή σε ολόκληρο τον τύπο όταν η στοίχιση είναι αβέβαιη.",
			mathHighlightBlock:
				"Κάθε μαθηματικός τύπος επισημαίνεται ως ένα ενιαίο σύνολο αντί να χωρίζεται σε τμήματα.",
			previewFailed:
				"Απέτυχε η αναπαραγωγή του ήχου προεπισκόπησης.",
			previewNoAudio:
				"Η απάντηση προεπισκόπησης δεν περιείχε ηχητικό περιεχόμενο.",
			previewEnterText:
				"Εισαγάγετε κείμενο προεπισκόπησης πριν ξεκινήσει η αναπαραγωγή.",
			previewUnavailable:
				"Δεν είναι δυνατή η προεπισκόπηση όσο αυτή η υπηρεσία δεν είναι διαθέσιμη.",
			browserSynthesisUnavailable:
				"Η σύνθεση ομιλίας του περιηγητή δεν είναι διαθέσιμη.",
			ssmlWordTrackingDisabled:
				"Η προεπισκόπηση SSML του Google διατηρεί το αρχικό SSML, οπότε η παρακολούθηση λέξεων είναι απενεργοποιημένη.",
			applyUnavailable:
				"Δεν είναι δυνατή η εφαρμογή ρυθμίσεων όσο αυτή η υπηρεσία δεν είναι διαθέσιμη.",
			coordinatorUnavailable:
				"Ο συντονιστής της εργαλειοθήκης δεν είναι διαθέσιμος για ενημερώσεις εκφώνησης κειμένου.",
			customProviderNotRegistered:
				"Ο προσαρμοσμένος πάροχος «{id}» δεν είναι εγγεγραμμένος.",
			customProviderNoConfig:
				"Ο προσαρμοσμένος πάροχος «{id}» δεν επέστρεψε διαμόρφωση εφαρμογής.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Άγνωστο σφάλμα",
			previewRequestFailed: "Η αίτηση προεπισκόπησης απέτυχε ({status}).",
			notAvailable: "Μη διαθέσιμο",
			voiceLocal: "τοπική",
			voiceRemote: "απομακρυσμένη",
			voiceBrowserDefault: "προεπιλογή περιηγητή",
			browserAvailable: {
				one: "Η εκφώνηση του περιηγητή είναι διαθέσιμη (εντοπίστηκε {count} φωνή).",
				other: "Η εκφώνηση του περιηγητή είναι διαθέσιμη (εντοπίστηκαν {count} φωνές).",
			},
			pollyAvailable: {
				one: "Το AWS Polly είναι διαθέσιμο ({count} συμβατή φωνή, μηχανή {engine}).",
				other: "Το AWS Polly είναι διαθέσιμο ({count} συμβατές φωνές, μηχανή {engine}).",
			},
			googleAvailable: {
				one: "Το Google Cloud TTS είναι διαθέσιμο ({count} συμβατή φωνή).",
				other: "Το Google Cloud TTS είναι διαθέσιμο ({count} συμβατές φωνές).",
			},
			headerRowReservation: "Δέσμευση σειράς κεφαλίδας ερώτησης: {state}",
			speedOptionsHelp:
				"Πολλαπλασιαστές διαχωρισμένοι με «,» ή με «;». Συμπεριλάβετε το 1 για την Κανονική ταχύτητα· αφήστε το κενό για απόκρυψη των στοιχείων ελέγχου ταχύτητας.",
			usingSelectedVoice: "Χρησιμοποιείται η επιλεγμένη φωνή: {voice}",
			autoVoice: "Καλύτερη διαθέσιμη φωνή (αυτόματο): {voice}",
			autoVoiceWaiting:
				"Καλύτερη διαθέσιμη φωνή (αυτόματο): αναμονή για φωνές του περιηγητή.",
			previewHintBrowserSsml:
				"Το SSML δεν υποστηρίζεται στην προεπισκόπηση του περιηγητή.",
			previewHintGoogleSsml:
				"Το SSML διατηρήθηκε. Η παρακολούθηση είναι απενεργοποιημένη.",
			previewHintCustom:
				"Η παρακολούθηση ενεργοποιείται όταν ο πάροχος επιστρέφει σημάνσεις ομιλίας.",
			previewHintTracking:
				"Η παρακολούθηση είναι ενεργή κατά την αναπαραγωγή της προεπισκόπησης.",
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

export default el;
