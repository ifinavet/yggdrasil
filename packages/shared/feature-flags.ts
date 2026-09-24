export interface FeatureFlags {
	huginFeedback: {
		uiEnabled: boolean;
		emailsEnabled: boolean;
		reportsEnabled: boolean;
		reportEmailsEnabled: boolean;
	};
}

export type BrowserOptIn = "huginFeedbackPreview" | "huginFeedbackTestSend";

// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags: FeatureFlags = {
	huginFeedback: {
		// Makes the Bifrost UI visible without the localStorage preview opt-in.
		uiEnabled: false,
		// Allows feedback invitations and reminders to be sent.
		emailsEnabled: false,
		// Enables internal report preparation and review. Approved public links do not use this flag.
		reportsEnabled: false,
		// Allows approved company report emails, alongside emailsEnabled.
		reportEmailsEnabled: false,
	},
};

export const browserOptInKeys: Record<BrowserOptIn, string> = {
	huginFeedbackPreview: "hugin-feedback-preview",
	huginFeedbackTestSend: "hugin-feedback-testsend",
};
