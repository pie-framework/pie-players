/**
 * Portuguese message catalog — machine-generated, not reviewed.
 *
 * Serves every Portuguese host: registered under the bare `pt` tag, so `pt`,
 * `pt-BR` and `pt-PT` all widen to it. Content flavour is Brazilian
 * Portuguese per `briefs/pt.md` — impersonal infinitive on controls, the
 * Brazilian math and chemistry register (`plano cartesiano`, `Reta`,
 * `Transferidor`, `Semimetal`, `Marca-texto`). A Portugal-focused host can
 * override any key through `customMessages`.
 *
 * Provenance — the source hash, model and generation date — is recorded in
 * `catalog-manifest.json`; `scripts/check-catalogs.ts` fails this file
 * against the English source when either drifts.
 *
 * @module @pie-players/pie-i18n-generated/messages/pt
 */

const pt = {
	common: {
		close: "Fechar",
		cancel: "Cancelar",
		save: "Salvar",
		reset: "Redefinir",
		retry: "Tentar novamente",
		back: "Voltar",
		next: "Avançar",
		previous: "Anterior",
		submit: "Entregar",
		continue: "Continuar",
		finish: "Finalizar",
		yes: "Sim",
		no: "Não",
		ok: "OK",
		any: "Qualquer",
		off: "Desligado",
		auto: "Automático",
		all: "Todas",
		none: "Nenhuma",
		loading: "Carregando…",
		error: "Erro",
		settings: "Configurações",
		language: "Idioma",
		theme: "Tema",
		preview: "Visualizar",
		author: "Autor",
		unknown: "Desconhecido",
		untitled: "Sem título",
		apply: "Aplicar",
		enabled: "Ativado",
		disabled: "Desativado",
		lookUp: "Buscar",
		wordOrPhrase: "Palavra ou expressão",
		closeA11y: "Fechar",
		settingsA11y: "Abrir o menu de configurações",
	},

	player: {
		passage: "Texto",
		passages: "Textos",
		question: "Pergunta",
		questionNumbered: "Pergunta {position}",
		questionPositionA11y: "Pergunta {position} de {total}",
		questionPositionLabeledA11y: "{label}, pergunta {position} de {total}",
		summary: {
			correctA11y: "Resposta correta",
			answer: "Resposta",
			manualScoring: "Corrigido por um professor",
			audio: "Áudio",
			video: "Vídeo",
		},
		list: {
			expandA11y: "Mostrar a pergunta completa",
		},
		questions: "Perguntas",
		items: "Perguntas",
		section: "Seção",
		loadingSection: "Carregando o conteúdo da seção…",
		sectionLoadError: "Não foi possível carregar o conteúdo da seção.",
		loadingPassage: "Carregando o conteúdo do texto…",
		configurationError: "Erro de configuração",
		playerError: "Erro do player",
		authoringBackendError: "Erro de configuração do servidor de autoria",
		itemLoadError: "Não foi possível carregar a pergunta.",
		sectionTabsA11y: "Guias de conteúdo da seção",
		passagesRegionA11y: "Textos",
		itemsRegionA11y: "Perguntas",
		sectionToolsA11y: "Ferramentas da seção",
		scrollDownA11y: "Rolar para baixo",
		resizePanels: "Redimensionar painéis",
		resizePassagesAndItemsA11y:
			"Redimensionar os painéis de textos e perguntas",
		resizeMediaRegion: "Redimensionar a área de mídia",
		resizeQuestionAndMediaA11y:
			"Redimensionar os painéis de pergunta e mídia",
		resizePassageAndMediaA11y:
			"Redimensionar os painéis de texto e mídia",
		resizePassageAndQuestionA11y: "Redimensionar os painéis de texto e pergunta",
		passageWidthA11y: "Largura do texto: {percent}%",

		assessment: {
			sectionPosition: "Seção {position} de {total}",
			noSections: "Nenhuma seção",
			loadFailed: "Não foi possível carregar a avaliação. Tente novamente.",
			restoreFailed:
				"Não foi possível restaurar suas respostas salvas desta seção. Tente novamente.",
		},

		formative: {
			checkAnswer: "Verificar resposta",
			tryAgain: "Tentar novamente",
			answerRecorded: "Resposta registrada.",
			correct: "Correto.",
			partlyCorrect: "Parcialmente correto.",
			notCorrect: "Incorreto.",
			notAutoScored:
				"Resposta registrada. Esta pergunta não é corrigida automaticamente.",
			checkFailed:
				"Não foi possível verificar esta pergunta. Tente novamente.",
			triesLeft: {
				one: "Resta {count} tentativa.",
				many: "Restam {count} tentativas.",
				other: "Restam {count} tentativas.",
			},
		},

		timedMedia: {
			waitingForMedia:
				"As perguntas aparecerão conforme a mídia é reproduzida.",
			questionAvailable: "A pergunta {position} já está disponível.",
			playbackPaused:
				"Reprodução pausada. Responda à pergunta {position} para continuar.",
			playbackAdvisory:
				"Responda à pergunta {position} antes de continuar a mídia.",
			playbackReleased:
				"Resposta aceita. Continue reproduzindo a mídia.",
		},
	},

	toolkit: {
		toolsA11y: "Ferramentas da avaliação",
		toolbarInitError: "Não foi possível inicializar o conjunto de ferramentas.",
		settingsTitle: "Configurações",
		closeSettingsA11y: "Fechar as configurações",
		dragPanelA11y: "Arrastar o painel",
		closePanelA11y: "Fechar o painel",
		resizeWindow: "Redimensionar a janela",
		minimize: "Minimizar",
		maximize: "Maximizar",
		minimizePanelA11y: "Minimizar o painel",
		maximizePanelA11y: "Maximizar o painel",

		window: {
			moveLeftA11y: "Mover a ferramenta para a esquerda",
			moveRightA11y: "Mover a ferramenta para a direita",
			moveUpA11y: "Mover a ferramenta para cima",
			moveDownA11y: "Mover a ferramenta para baixo",
			narrowerA11y: "Tornar a janela da ferramenta mais estreita",
			widerA11y: "Tornar a janela da ferramenta mais larga",
			shorterA11y: "Tornar a janela da ferramenta mais baixa",
			tallerA11y: "Tornar a janela da ferramenta mais alta",
			centerA11y: "Centralizar a janela da ferramenta",
			closeA11y: "Fechar a ferramenta",
		},

		placement: {
			controlsA11y: "Mover e girar",
			moveAndResizeA11y: "Mover e redimensionar",
			rotateClockwiseA11y: "Girar {degrees}° no sentido horário",
			rotateCounterclockwiseA11y: "Girar {degrees}° no sentido anti-horário",
		},

		announce: {
			movedUp: "Movido para cima até {position}",
			movedDown: "Movido para baixo até {position}",
			movedLeft: "Movido para a esquerda até {position}",
			movedRight: "Movido para a direita até {position}",
			rotatedTo: "Girado para {degrees} graus",
		},
	},

	tools: {
		calculator: {
			name: "Calculadora",
			nameBasic: "Calculadora básica",
			nameScientific: "Calculadora científica",
			nameGraphing: "Calculadora gráfica",
			description:
				"Calculadora de vários tipos (básica, científica, gráfica)",
			openedBasic: "Calculadora básica aberta",
			openedScientific: "Calculadora científica aberta",
			openedGraphing: "Calculadora gráfica aberta",
			closedBasic: "Calculadora básica fechada",
			closedScientific: "Calculadora científica fechada",
			closedGraphing: "Calculadora gráfica fechada",
			toolA11y: "Ferramenta Calculadora",
			loading: "Carregando a calculadora…",
			providerUnavailable: "A calculadora está indisponível.",
			initFailed: "Não foi possível inicializar a calculadora.",
		},
		graph: {
			name: "Gráfico",
			description: "Plano cartesiano",
			buttonA11y: "Gráfico, plano cartesiano",
			tooltip: "Gráfico",
			toolA11y:
				"Ferramenta de gráfico — marque pontos e trace retas em um plano cartesiano",
			canvasA11y:
				"Tela do gráfico — use as ferramentas para adicionar pontos e traçar retas",
			grid: "Grade:",
			gridOpacityA11y: "Opacidade da grade",
			pointA11y: "Ponto do gráfico {id}",
			modeSelector: "Seletor",
			modeSelectorHint:
				"Seletor: clique e arraste os pontos para movê-los ou mover as retas associadas.",
			modePoint: "Ponto",
			modePointHint: "Ponto: clique na grade para adicionar pontos.",
			modeLine: "Reta",
			modeLineHint:
				"Reta: clique em um ponto inicial e depois em um ponto final para traçar uma reta.",
			modeDelete: "Excluir",
			modeDeleteHint:
				"Excluir: clique em um ponto para excluí-lo junto com as retas conectadas.",
		},
		periodicTable: {
			name: "Tabela Periódica",
			description: "Referência da tabela periódica da química",
			buttonA11y: "Tabela Periódica, referência de química",
			tooltip: "Tabela Periódica",
			toolA11y:
				"Tabela periódica — selecione um elemento para ver seus detalhes",
			elementsA11y: "Elementos da tabela periódica",
			showAllA11y: "Mostrar todos os elementos",
			allElements: "Todos os elementos",
			atomicMass: "Massa Atômica",
			atomicNumber: "Número Atômico",
			electronConfig: "Configuração Eletrônica",
			phase: "Estado",
			filterByA11y: "Filtrar por {category}",
			elementA11y:
				"{name}, Símbolo: {symbol}, Número Atômico: {number}, Massa Atômica: {mass}, Categoria: {category}",
			outsideFilterA11y: ", fora do filtro atual",
			category: {
				unknown: "Desconhecida",
				alkaliMetal: "Metal alcalino",
				alkalineEarthMetal: "Metal alcalinoterroso",
				transitionMetal: "Metal de transição",
				postTransitionMetal: "Metal pós-transição",
				metalloid: "Semimetal",
				diatomicNonmetal: "Não metal diatômico",
				polyatomicNonmetal: "Não metal poliatômico",
				nobleGas: "Gás nobre",
				lanthanide: "Lantanídeo",
				actinide: "Actinídeo",
			},
		},
		ruler: {
			name: "Régua",
			description: "Régua na tela para medições",
			buttonA11y: "Régua",
			tooltip: "Régua",
			toolA11y: "Ferramenta de medição com régua, arrastável e giratória",
			unitSelectionA11y: "Seleção de unidade da régua",
			inches: "Polegadas",
			centimeters: "Centímetros",
			inchesInSentence: "polegadas",
			centimetersInSentence: "centímetros",
			switchToInchesA11y: "Mudar para polegadas",
			switchToCentimetersA11y: "Mudar para centímetros",
			switchedTo: "Mudou para {unit}",
			applicationA11y:
				"Ferramenta Régua. Use as setas para mover, Shift+setas para girar, PageUp ou PageDown para giro fino e U para alternar unidades. Unidade atual: {unit}",
			imageAlt: "Régua em {unit}",
		},
		protractor: {
			name: "Transferidor",
			description: "Transferidor na tela para medir ângulos",
			buttonA11y: "Transferidor",
			tooltip: "Transferidor",
			toolA11y:
				"Ferramenta Transferidor. Use as setas para mover, Shift+setas para girar e PageUp ou PageDown para giro fino.",
			roleA11y: "Ferramenta de medição de ângulos, arrastável e giratória",
			imageAlt:
				"Transferidor com escala semicircular de 180 graus, marcada de 0 a 180 graus em ambos os sentidos, com marcações a cada 10 graus",
		},
		dictionary: {
			name: "Dicionário",
			description: "Buscar definições de palavras",
			buttonA11y: "Dicionário, buscar definições de palavras",
			tooltip: "Dicionário",
			toolA11y: "Dicionário",
			notConfigured:
				"Nenhum serviço de dicionário está configurado para esta avaliação.",
			idleHint: "Digite uma palavra para buscar sua definição.",
			lookingUp: "Buscando “{term}”…",
			noEntryFor: "Nenhuma entrada para “{term}”.",
			entriesCount: {
				one: "{count} entrada",
				many: "{count} entradas",
				other: "{count} entradas",
			},
			noEntryStatusFor: "Nenhuma entrada de dicionário para {term}.",
		},
		pictureDictionary: {
			name: "Dicionário de imagens",
			description: "Buscar imagens para palavras",
			buttonA11y: "Dicionário de imagens, buscar imagens para palavras",
			tooltip: "Dicionário de imagens",
			toolA11y: "Dicionário de imagens",
			notConfigured:
				"Nenhum serviço de dicionário de imagens está configurado para esta avaliação.",
			idleHint: "Digite uma palavra para ver uma imagem.",
			lookingUp: "Buscando “{term}”…",
			noEntryFor: "Nenhuma imagem para “{term}”.",
			entriesCount: {
				one: "{count} imagem",
				many: "{count} imagens",
				other: "{count} imagens",
			},
			noEntryStatusFor: "Nenhuma imagem para {term}.",
		},
		dictionarySpanish: {
			name: "Dicionário em espanhol",
			description: "Buscar definições de palavras em espanhol",
			buttonA11y:
				"Dicionário em espanhol, buscar definições de palavras em espanhol",
			tooltip: "Dicionário em espanhol",
			toolA11y: "Dicionário em espanhol",
		},
		pictureDictionarySpanish: {
			name: "Dicionário de imagens em espanhol",
			description: "Buscar imagens para palavras em espanhol",
			buttonA11y:
				"Dicionário de imagens em espanhol, buscar imagens para palavras em espanhol",
			tooltip: "Dicionário de imagens em espanhol",
			toolA11y: "Dicionário de imagens em espanhol",
		},
		lineReader: {
			name: "Leitor de linhas",
			description: "Guia de leitura sobreposta",
			buttonA11y: "Leitor de linhas, guia de leitura",
			tooltip: "Leitor de linhas",
			roleA11y: "Guia de leitura sobreposta, arrastável e redimensionável",
			close: "Fechar o leitor de linhas",
			resizeWindowA11y: "Arraste para redimensionar a janela de leitura",
			resizeFrameA11y:
				"Arraste para redimensionar a moldura e a largura da janela",
			windowHeightAnnounce: "Altura da janela de leitura: {pixels} pixels",
			frameHeightAnnounce: "Altura da moldura: {pixels} pixels",
			widthAnnounce: "Largura: {pixels} pixels",
			shorterWindowA11y: "Tornar a janela de leitura mais baixa",
			tallerWindowA11y: "Tornar a janela de leitura mais alta",
			shorterFrameA11y: "Tornar a moldura mais baixa",
			tallerFrameA11y: "Tornar a moldura mais alta",
			narrowerA11y: "Tornar o leitor de linhas mais estreito",
			widerA11y: "Tornar o leitor de linhas mais largo",
			applicationA11y:
				"Ferramenta Leitor de linhas. Uma janela de leitura nítida dentro de uma moldura que escurece o conteúdo. Use as setas para mover, +/- para redimensionar a janela de leitura e Escape para fechar. Altura da janela de leitura: {paneHeight} pixels, altura da moldura: {frameHeight} pixels",
			resizeWindowFullA11y:
				"Redimensione a janela de leitura. Arraste, ou use as setas para cima e para baixo para mudar a altura. Altura atual: {paneHeight} pixels",
			resizeFrameFullA11y:
				"Redimensione a moldura. Arraste, ou use as setas para cima e para baixo para mudar a altura da moldura e as setas laterais para mudar a largura. Altura atual da moldura: {frameHeight} pixels, largura: {width} pixels",
		},
		magnification: {
			name: "Lupa",
			description: "Ampliar o conteúdo sob uma lente móvel",
			buttonA11y: "Lupa, ampliar o conteúdo sob uma lente",
			tooltip: "Lupa",
			roleA11y: "Lente de ampliação arrastável e redimensionável",
			applicationA11y:
				"Lupa com aumento de {zoom} vezes. Use as setas para mover a lente, + e - para mudar o zoom e Escape para fechar.",
			zoomIn: "Ampliar",
			zoomOut: "Reduzir",
			zoomLevel: "{zoom}×",
			zoomAnnounce: "Zoom de {zoom} vezes",
			close: "Fechar a lupa",
			resizeA11y: "Arraste para redimensionar a lupa",
			resizeFullA11y:
				"Redimensione a lupa. Arraste, ou use as setas. Tamanho atual: {width} por {height} pixels",
			sizeAnnounce: "Lupa de {width} por {height} pixels",
			narrowerA11y: "Tornar a lupa mais estreita",
			widerA11y: "Tornar a lupa mais larga",
			shorterA11y: "Tornar a lupa mais baixa",
			tallerA11y: "Tornar a lupa mais alta",
		},
		answerEliminator: {
			name: "Riscar respostas",
			description: "Riscar alternativas de resposta",
			buttonA11y: "Riscar, eliminar alternativas de resposta",
			tooltip: "Riscar",
		},
		highlighter: {
			name: "Marca-texto",
			description: "Realçar e anotar texto",
			buttonA11y: "Realçar texto",
			tooltip: "Realçar",
		},
		annotationToolbar: {
			name: "Anotação",
			description: "Realçar e anotar texto",
			buttonA11y: "Anotar, realçar e marcar texto",
			tooltip: "Anotar",
			toolbarA11y: "Barra de ferramentas de anotação de texto",
			underline: "Sublinhar",
			underlineA11y: "Sublinhar o texto selecionado",
			readAloud: "Ler em voz alta",
			readAloudA11y: "Ler em voz alta o texto selecionado",
			remove: "Remover",
			removeA11y: "Remover esta anotação",
			clearAll: "Limpar tudo",
			clearAllA11y: "Limpar todas as anotações do documento",
			highlightYellowA11y: "Realce amarelo",
			highlightPinkA11y: "Realce rosa",
			highlightBlueA11y: "Realce azul",
			highlightGreenA11y: "Realce verde",
		},
		theme: {
			name: "Tema",
			description: "Temas e contraste acessíveis",
			buttonA11y: "Tema, mudar cores e contraste",
			tooltip: "Tema",
			selectorA11y: "Seletor de temas",
			hint: "Escolha um tema para melhorar a legibilidade e reduzir o cansaço visual.",
			selectA11y: "Escolher tema",
			selectCurrentA11y: "Escolher tema. Tema atual: {name}",
			optionUnavailableA11y: "{name}, indisponível",
			unavailableName: "Tema indisponível: {id}",
			unavailableDescription:
				"O tema básico gerenciado pelo PIE permanece ativo até que este tema volte a ficar disponível.",
			unavailableStatus:
				"O tema selecionado está indisponível. O tema básico gerenciado pelo PIE permanece ativo até que volte a ficar disponível.",
		},
		textToSpeech: {
			name: "Ler em voz alta",
			description: "Ler o conteúdo em voz alta",
			initFailed:
				"Não foi possível inicializar a leitura em voz alta. Tente novamente.",
			inline: {
				controlsA11y: "Controles de leitura",
				playbackSpeedA11y: "Velocidade de leitura",
				rewindA11y: "Voltar",
				fastForwardA11y: "Avançar",
				stopA11y: "Parar a leitura",
				starting: "Iniciando a leitura",
				started: "Leitura iniciada",
				resumed: "Leitura retomada",
				pausedAnnouncement: "Leitura pausada",
				stopped: "Leitura interrompida",
				switchedSection: "A leitura mudou para outra seção",
				nothingToRead: "Nada para ler em voz alta aqui",
				startFailed: "Não foi possível iniciar a leitura",
				skippedForward: "Avançou a leitura",
				skipForwardFailed: "Não foi possível avançar a leitura",
				skippedBackward: "Retrocedeu a leitura",
				skipBackwardFailed: "Não foi possível voltar a leitura",
				speedChangeFailed: "Não foi possível mudar a velocidade de leitura",
				speedAnnounce: "Velocidade de leitura: {label}",
				playA11y: "Reproduzir a leitura",
				pauseA11y: "Pausar a leitura",
				resumeA11y: "Retomar a leitura",
			},
		},
		signLanguage: {
			name: "Língua de sinais",
			description: "Alternativa em língua de sinais do conteúdo",
			generic: "Língua de sinais",
			unknown: "Língua de sinais ({code})",
			ase: "Língua de sinais americana",
			bfi: "Língua de sinais britânica",
			fsl: "Língua de sinais francesa",
			gss: "Língua de sinais grega",
			mfs: "Língua de sinais mexicana",
			signedEnglish: "Inglês sinalizado",
			regionA11y: "Tradução em {language}",
		},
		audioTranscript: {
			name: "Transcrição de áudio",
			description: "Transcrição em texto do conteúdo de áudio",
			regionA11y: "Transcrição",
		},
	},

	debug: {
		session: "Sessão",
		sessionData: "Dados da sessão",
		sessionDataPersistent: "Dados de sessão do PIE (persistentes)",
		noItemSessionYet:
			"Ainda não há dados de sessão do item. Interaja com o item para ver as atualizações aqui.",
		itemSessionsSnapshot: "Instantâneo das sessões de itens",
		sectionControllerUnavailable:
			"O controlador desta seção ainda não está disponível.",
		filteredModel: "Modelo filtrado",
		environment: "Ambiente",
		events: "Eventos",
		controllerEvents: "Eventos do controlador",
		instrumentation: "Instrumentação",
		databaseState: "Estado do banco de dados",
		sessionDb: "Banco de dados de sessões (servidor)",
		noRows: "Nenhuma linha",
		noRecords: "Nenhum registro de instrumentação ainda.",
		selectRecord: "Selecione um registro para ver os detalhes.",
		selectEvent: "Selecione um evento para ver os detalhes da carga útil.",
		showRawTables: "Mostrar tabelas brutas",
		showReconstructedSnapshots: "Mostrar instantâneos reconstruídos",
		showSectionRequest: "Mostrar a requisição da seção",
		showAssessmentRequest: "Mostrar a requisição da avaliação",
		liveUpdatesUnsupported:
			"Atualizações ao vivo não são compatíveis com este navegador",
		liveUpdatesDisconnected:
			"Atualizações ao vivo desconectadas; tentando novamente…",
		fieldType: "Tipo:",
		fieldTarget: "Destino:",
		fieldItem: "Item:",
		fieldCanonical: "Canônico:",
		fieldIntent: "Intenção:",
		fieldDuplicates: "Duplicados:",
		fieldSemanticRepeats: "Repetições semânticas:",
		dragItemSessionPanelA11y: "Arrastar o painel de sessão do item",
		debuggerTabsA11y: "Guias do depurador",
		sessionDataJsonA11y: "JSON dos dados de sessão",
		environmentJsonA11y: "JSON do ambiente",
		filteredModelJsonA11y: "JSON do modelo filtrado",
		sectionSessionJsonA11y:
			"JSON do instantâneo da sessão da seção",
		eventLevelFilterA11y: "Filtro por nível de evento",
		controllerEventDetailsA11y: "Detalhes do evento do controlador",
		instrumentationFilterA11y:
			"Filtrar o tipo de registro de instrumentação",
		instrumentationDetailsA11y:
			"Detalhes do registro de instrumentação",
		toggleSessionPanelA11y: "Alternar o painel de sessão",
		toggleEventPanelA11y: "Alternar o painel de eventos",
		toggleDatabasePanelA11y:
			"Alternar o painel do banco de dados",
		toggleInstrumentationPanelA11y:
			"Alternar o painel de instrumentação",
		clear: "Limpar",
		pause: "Pausar",
		resume: "Retomar",
		controllerUnavailable: "Controlador indisponível",
		noMatchingEvents: "Ainda não há eventos correspondentes. Interaja com o item para capturar eventos do controlador.",
		noSectionSessionYet: "Ainda não há dados de sessão da seção. Interaja com as perguntas para ver as atualizações aqui.",
		eventLevelItem: "item",
		eventLevelSection: "seção",
		instrumentationKindAll: "all",
		instrumentationKindEvent: "event",
		instrumentationKindError: "error",
		instrumentationKindMetric: "metric",
		instrumentationKindUserContext: "user-context",
		instrumentationKindGlobalAttributes: "global-attributes",
		instrumentationFieldName: "nome:",
		instrumentationFieldKind: "tipo:",
		instrumentationFieldProvider: "provedor:",
		instrumentationFieldTimestamp: "data e hora:",
		instrumentationFieldValue: "valor:",
		instrumentationFieldError: "erro:",
		sessionDbAssessmentId: "assessmentId:",
		sessionDbSectionId: "sectionId:",
		sessionDbAttemptId: "attemptId:",
		sessionDbMode: "mode:",


		pnp: {
			title: "Perfil PNP",
			noAssessmentBound: "Nenhuma avaliação vinculada",
			noAssessmentBoundBody:
				"O perfil, o distrito e a política de aplicação do teste não têm nada para ler, então apenas os requiredTools de um item podem conceder uma adaptação. Passe a avaliação para a propriedade assessment do toolkit ou chame updateAssessment(...) no coordenador do toolkit.",
			determinationReadOnly: "Determinação (somente leitura)",
			toolsEditor: "Editor de ferramentas",
			enforcement: "Aplicação do PNP",
			allAvailableTools: "Todas as ferramentas disponíveis",
			clearPlacement: "Limpar posicionamento",
			tool: "Ferramenta",
			placement: "Posicionamento",
			provider: "Provedor",
			simulation: "Simulação de PNP",
			resolvedTools: "Ferramentas resolvidas (toolkit)",
			provenanceSummary:
				"Resumo de procedência da política de ferramentas",
			perToolDecisions: "Decisões por ferramenta",
			policyDiagnostics: "Diagnósticos da política",
			profileReadOnly: "Perfil PNP (somente leitura)",
			on: "Ativado",
			effective: "Efetivo:",
			needs: "requer",
			hostSurfaceNotPlaced: "superfície do host (não posicionada)",
			support: "permitir",
			prohibit: "proibir",
		},

		tts: {
			title: "Configurações de TTS",
			closeA11y: "Fechar as configurações de TTS",
			toolbarLayoutMode: "Modo de layout da barra de ferramentas",
			reservedRow: "Linha reservada",
			expandingRow: "Linha expansível",
			floatingOverlay: "Sobreposição flutuante",
			leftAlignedControls: "Controles alinhados à esquerda",
			inlineSpeedButtons: "Botões de velocidade embutidos",
			resetToDefaults: "Restaurar os padrões",
			mathHighlighting: "Realce de fórmulas",
			checkingAvailability: "Verificando a disponibilidade…",
			recheck: "Verificar novamente",
			voice: "Voz",
			bestAvailableVoice: "Melhor voz disponível (automático)",
			unnamedVoice: "Voz sem nome",
			apiEndpoint: "Endpoint da API",
			gender: "Gênero",
			any: "Qualquer",
			male: "Masculino",
			female: "Feminino",
			neutral: "Neutro",
			engine: "Motor",
			neural: "Neural",
			standard: "Padrão",
			providerDefault: "Padrão do provedor",
			format: "Formato",
			sampleRate: "Taxa de amostragem",
			speechMarks: "Marcas de fala",
			word: "Palavra",
			wordAndSentence: "Palavra + frase",
			voiceType: "Tipo de voz",
			wavenetVoiceType: "WaveNet",
			studioVoiceType: "Studio",
			plainText: "Texto simples",
			sampleText: "Texto de exemplo",
			resetSample: "Redefinir o exemplo",
			providerAvailable: "Provedor disponível.",
			providerUnavailable: "Provedor indisponível.",
			providerCheckFailed:
				"Falha na verificação de disponibilidade do provedor.",
			providerNotChecked:
				"A disponibilidade do provedor ainda não foi verificada.",
			webSpeechUnavailable:
				"A Web Speech API não está disponível neste navegador.",
			browserNoVoices:
				"A leitura por voz do navegador está disponível, mas nenhuma voz foi retornada ainda.",
			browserUnavailable:
				"A leitura por voz do navegador não está disponível.",
			googleUnavailable:
				"O Google Cloud TTS não está disponível pela API configurada.",
			pollyUnavailable:
				"O AWS Polly não está disponível pela API configurada.",
			recommendedVoices: "Vozes recomendadas",
			allVoices: "Todas as vozes disponíveis",
			previewVoice: "Ouvir uma amostra da voz",
			stopPreview: "Parar a amostra",
			applying: "Aplicando…",
			ssmlPreviewUnsupported:
				"A amostra de SSML não é compatível com o backend do navegador.",
			pollySsmlHint:
				"Algumas vozes neurais do Polly rejeitam certas tags SSML (por exemplo, emphasis). Se a amostra falhar, use tags SSML básicas.",
			mathHighlightParts:
				"Cada parte de uma fórmula é realçada durante a leitura, com a fórmula inteira quando o alinhamento é incerto.",
			mathHighlightBlock:
				"Cada fórmula é realçada como um bloco único em vez de ser dividida em partes.",
			previewFailed: "Falha ao reproduzir o áudio de amostra.",
			previewNoAudio:
				"A resposta da amostra não incluiu conteúdo de áudio.",
			previewEnterText:
				"Digite o texto de amostra antes de iniciar a reprodução.",
			previewUnavailable:
				"Não é possível reproduzir a amostra enquanto este serviço estiver indisponível.",
			browserSynthesisUnavailable:
				"A síntese de voz do navegador está indisponível.",
			ssmlWordTrackingDisabled:
				"A amostra de SSML do Google preserva o SSML original, então o acompanhamento de palavras está desativado.",
			applyUnavailable:
				"Não é possível aplicar as configurações enquanto este serviço estiver indisponível.",
			coordinatorUnavailable:
				"O coordenador do toolkit não está disponível para atualizações da leitura por voz.",
			customProviderNotRegistered:
				"O provedor personalizado '{id}' não está registrado.",
			customProviderNoConfig:
				"O provedor personalizado '{id}' não retornou uma configuração para aplicar.",
			httpError: "HTTP {status}: {message}",
			unknownError: "Erro desconhecido",
			previewRequestFailed:
				"Falha na requisição de amostra ({status}).",
			notAvailable: "n/d",
			voiceLocal: "local",
			voiceRemote: "remota",
			voiceBrowserDefault: "padrão do navegador",
			browserAvailable: {
				one: "Leitura por voz do navegador disponível ({count} voz detectada).",
				many: "Leitura por voz do navegador disponível ({count} vozes detectadas).",
				other: "Leitura por voz do navegador disponível ({count} vozes detectadas).",
			},
			pollyAvailable: {
				one: "AWS Polly disponível ({count} voz correspondente, motor {engine}).",
				many: "AWS Polly disponível ({count} vozes correspondentes, motor {engine}).",
				other: "AWS Polly disponível ({count} vozes correspondentes, motor {engine}).",
			},
			googleAvailable: {
				one: "Google Cloud TTS disponível ({count} voz correspondente).",
				many: "Google Cloud TTS disponível ({count} vozes correspondentes).",
				other: "Google Cloud TTS disponível ({count} vozes correspondentes).",
			},
			headerRowReservation:
				"Reserva da linha de cabeçalho do item: {state}",
			speedOptionsHelp:
				"Multiplicadores separados por vírgula ou ponto e vírgula. Inclua 1 para a velocidade normal; deixe vazio para ocultar os controles de velocidade.",
			usingSelectedVoice: "Voz em uso: {voice}",
			autoVoice: "Melhor voz disponível (automático): {voice}",
			autoVoiceWaiting:
				"Melhor voz disponível (automático): aguardando as vozes do navegador.",
			previewHintBrowserSsml:
				"SSML não é compatível com a amostra no navegador.",
			previewHintGoogleSsml: "SSML preservado. Acompanhamento desativado.",
			previewHintCustom:
				"Acompanhamento ativado quando o provedor retorna marcas de fala.",
			previewHintTracking:
				"Acompanhamento ativado durante a reprodução da amostra.",
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

export default pt;
