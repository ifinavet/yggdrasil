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
	products: {
		uiEnabled: false,
	},
	jobListingOrders: {
		uiEnabled: false,
	},
	semesterPlanning: {
		// Shows Semesterplan in Bifrost, the application and offer pages on Hugin and the button on
		// Midgard to everyone. While off, only browsers with the preview opt-in see them.
		uiEnabled: false,
	},
};

export const browserOptInKeys = {
	productsPreview: "products-preview",
	jobListingOrdersPreview: "job-listing-orders-preview",
	huginFeedbackPreview: "hugin-feedback-preview",
	huginFeedbackTestSend: "hugin-feedback-testsend",
	semesterPlanningPreview: "semester-planning-preview",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;

export type GatedFeature = keyof typeof featureFlags;

export const featurePreviewOptIns = {
	huginFeedback: "huginFeedbackPreview",
	products: "productsPreview",
	jobListingOrders: "jobListingOrdersPreview",
	semesterPlanning: "semesterPlanningPreview",
} as const satisfies Record<GatedFeature, BrowserOptIn>;
