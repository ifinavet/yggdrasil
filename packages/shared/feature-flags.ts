// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
	huginFeedback: {
		// Makes the Bifrost UI visible without the localStorage preview opt-in.
		uiEnabled: false,
		// Enables internal report preparation and review. Approved public links do not use this flag.
		reportsEnabled: true,
		// Allows approved company report emails.
		reportEmailsEnabled: true,
	},
	slackBot: {
		// Creates private Slack channels for upcoming bedpresser and posts checklist reminders.
		enabled: true,
	},
};

export const browserOptInKeys = {
	huginFeedbackPreview: "hugin-feedback-preview",
	huginFeedbackTestSend: "hugin-feedback-testsend",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;
