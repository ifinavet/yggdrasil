// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
	huginFeedback: {
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
	engagement: {
		uiEnabled: true,
	},
};

export const browserOptInKeys = {
	productsPreview: "products-preview",
	jobListingOrdersPreview: "job-listing-orders-preview",
	semesterPlanningPreview: "semester-planning-preview",
	engagementPreview: "engagement-preview",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;

export const featurePreviewOptIns = {
	products: "productsPreview",
	jobListingOrders: "jobListingOrdersPreview",
	semesterPlanning: "semesterPlanningPreview",
	engagement: "engagementPreview",
} as const satisfies Partial<Record<keyof typeof featureFlags, BrowserOptIn>>;

export type GatedFeature = keyof typeof featurePreviewOptIns;
