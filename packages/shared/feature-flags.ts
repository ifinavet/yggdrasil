// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
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
