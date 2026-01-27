export interface ProfileTemplate {
	id: string;
	name: string;
	description: string;
	profile: ProfileConfig;
}

export interface ProfileConfig {
	accessibility: {
		textToSpeech: {
			enabled: boolean;
			autoRead: boolean;
		};
		highContrast: boolean;
		fontSize: "small" | "medium" | "large" | "xlarge";
		screenReader: boolean;
		keyboardOnly: boolean;
	};
	tools: {
		calculator: "none" | "basic" | "scientific" | "graphing";
		protractor: boolean;
		ruler: boolean;
		periodicTable: boolean;
		graph: boolean;
		highlighter: boolean;
		notepad: boolean;
		answerEliminator: boolean;
		lineReader: boolean;
		magnifier: boolean;
	};
	timing: {
		extendedTimeMultiplier: number;
		unlimitedTime: boolean;
	};
	assessment: {
		subject: "math" | "ela" | "science" | "socialStudies";
		gradeLevel: "K" | "1-2" | "3-5" | "6-8" | "9-12";
		allowReview: boolean;
		showProgress: boolean;
	};
	district: {
		wcagLevel: "A" | "AA" | "AAA";
		keyboardNavigationRequired: boolean;
		blockedTools: string[];
		requiredTools: string[];
	};
}

export const DEFAULT_PROFILE: ProfileConfig = {
	accessibility: {
		textToSpeech: {
			enabled: false,
			autoRead: false,
		},
		highContrast: false,
		fontSize: "medium",
		screenReader: false,
		keyboardOnly: false,
	},
	tools: {
		calculator: "none",
		protractor: false,
		ruler: false,
		periodicTable: false,
		graph: false,
		highlighter: true,
		notepad: true,
		answerEliminator: false,
		lineReader: false,
		magnifier: false,
	},
	timing: {
		extendedTimeMultiplier: 1.0,
		unlimitedTime: false,
	},
	assessment: {
		subject: "ela",
		gradeLevel: "6-8",
		allowReview: true,
		showProgress: true,
	},
	district: {
		wcagLevel: "AA",
		keyboardNavigationRequired: true,
		blockedTools: [],
		requiredTools: [],
	},
};

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
	{
		id: "default",
		name: "Default Student",
		description: "Standard settings with basic tools",
		profile: DEFAULT_PROFILE,
	},
	{
		id: "iep-visual",
		name: "IEP - Visual",
		description: "High contrast, large font, text-to-speech",
		profile: {
			...DEFAULT_PROFILE,
			accessibility: {
				textToSpeech: {
					enabled: true,
					autoRead: true,
				},
				highContrast: true,
				fontSize: "xlarge",
				screenReader: false,
				keyboardOnly: false,
			},
			tools: {
				...DEFAULT_PROFILE.tools,
				highlighter: true,
				magnifier: true,
				lineReader: true,
			},
			timing: {
				extendedTimeMultiplier: 1.5,
				unlimitedTime: false,
			},
		},
	},
	{
		id: "iep-motor",
		name: "IEP - Motor",
		description: "Extended time, answer eliminator, keyboard-only",
		profile: {
			...DEFAULT_PROFILE,
			accessibility: {
				...DEFAULT_PROFILE.accessibility,
				keyboardOnly: true,
			},
			tools: {
				...DEFAULT_PROFILE.tools,
				answerEliminator: true,
				highlighter: true,
			},
			timing: {
				extendedTimeMultiplier: 2.0,
				unlimitedTime: false,
			},
		},
	},
	{
		id: "504",
		name: "Section 504",
		description: "Text-to-speech with extended time",
		profile: {
			...DEFAULT_PROFILE,
			accessibility: {
				textToSpeech: {
					enabled: true,
					autoRead: false,
				},
				highContrast: false,
				fontSize: "large",
				screenReader: false,
				keyboardOnly: false,
			},
			timing: {
				extendedTimeMultiplier: 1.5,
				unlimitedTime: false,
			},
		},
	},
	{
		id: "ell",
		name: "ELL Support",
		description: "Extended time with text-to-speech",
		profile: {
			...DEFAULT_PROFILE,
			accessibility: {
				textToSpeech: {
					enabled: true,
					autoRead: false,
				},
				highContrast: false,
				fontSize: "medium",
				screenReader: false,
				keyboardOnly: false,
			},
			tools: {
				...DEFAULT_PROFILE.tools,
				highlighter: true,
				notepad: true,
			},
			timing: {
				extendedTimeMultiplier: 1.25,
				unlimitedTime: false,
			},
		},
	},
	{
		id: "math",
		name: "Math Assessment",
		description: "Math-specific tools enabled",
		profile: {
			...DEFAULT_PROFILE,
			assessment: {
				...DEFAULT_PROFILE.assessment,
				subject: "math",
			},
			tools: {
				...DEFAULT_PROFILE.tools,
				calculator: "scientific",
				protractor: true,
				ruler: true,
				graph: true,
			},
		},
	},
	{
		id: "science",
		name: "Science Lab",
		description: "Science tools and calculator",
		profile: {
			...DEFAULT_PROFILE,
			assessment: {
				...DEFAULT_PROFILE.assessment,
				subject: "science",
			},
			tools: {
				...DEFAULT_PROFILE.tools,
				calculator: "scientific",
				periodicTable: true,
				graph: true,
			},
		},
	},
	{
		id: "minimal",
		name: "No Accommodations",
		description: "Minimal tools, standard settings",
		profile: {
			...DEFAULT_PROFILE,
			tools: {
				calculator: "none",
				protractor: false,
				ruler: false,
				periodicTable: false,
				graph: false,
				highlighter: false,
				notepad: false,
				answerEliminator: false,
				lineReader: false,
				magnifier: false,
			},
		},
	},
	{
		id: "full-accessibility",
		name: "Full Accessibility",
		description: "All accommodations enabled",
		profile: {
			accessibility: {
				textToSpeech: {
					enabled: true,
					autoRead: true,
				},
				highContrast: true,
				fontSize: "xlarge",
				screenReader: true,
				keyboardOnly: true,
			},
			tools: {
				calculator: "graphing",
				protractor: true,
				ruler: true,
				periodicTable: true,
				graph: true,
				highlighter: true,
				notepad: true,
				answerEliminator: true,
				lineReader: true,
				magnifier: true,
			},
			timing: {
				extendedTimeMultiplier: 2.0,
				unlimitedTime: true,
			},
			assessment: {
				subject: "math",
				gradeLevel: "6-8",
				allowReview: true,
				showProgress: true,
			},
			district: {
				wcagLevel: "AAA",
				keyboardNavigationRequired: true,
				blockedTools: [],
				requiredTools: [],
			},
		},
	},
];

export function getTemplateById(id: string): ProfileTemplate | undefined {
	return PROFILE_TEMPLATES.find((template) => template.id === id);
}
