// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
	huginFeedback: {
		// Makes the Bifrost UI visible without the localStorage preview opt-in.
		uiEnabled: false,
		// Enables internal report preparation and review. Approved public links do not use this flag.
		reportsEnabled: false,
		// Allows approved company report emails.
		reportEmailsEnabled: false,
	},
};

export const browserOptInKeys = {
	huginFeedbackPreview: "hugin-feedback-preview",
	huginFeedbackTestSend: "hugin-feedback-testsend",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;
