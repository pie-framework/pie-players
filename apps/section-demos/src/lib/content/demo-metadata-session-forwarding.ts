import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

export const metadataSessionForwardingSection: AssessmentSection = {
	identifier: "metadata-session-forwarding",
	title: "Metadata Session Forwarding Regression",
	keepTogether: true,
	assessmentItemRefs: [
		{
			identifier: "metadata-session-ref",
			required: true,
			item: {
				id: "metadata-session-item",
				name: "Metadata Session Forwarding Fixture",
				baseId: "metadata-session-item",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<metadata-session-fixture id="metadata-choice"></metadata-session-fixture>',
					elements: {
						"metadata-session-fixture":
							"@pie-players/metadata-session-fixture@1.0.0",
					},
					models: [
						{
							id: "metadata-choice",
							element: "metadata-session-fixture",
							prompt:
								"Fixture for forwarding metadata-only item session events without changing response data.",
						},
					],
				},
			},
		},
	],
};
