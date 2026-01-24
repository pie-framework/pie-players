export type A11yFixture = {
	id: string;
	name: string;
	description: string;
};

export const A11Y_FIXTURES: A11yFixture[] = [
	{
		id: "simple-form",
		name: "Simple form",
		description: "Basic focusable controls to validate keyboard/focus styling.",
	},
	{
		id: "navigation-smoke",
		name: "Navigation smoke",
		description: "Verifies navbar/menu structure is accessible.",
	},
];
