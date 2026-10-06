// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
	semesterPlanning: {
		// Shows Semesterplan in Bifrost, the application and offer pages on Hugin and the button on
		// Midgard to everyone. While off, only browsers with the preview opt-in see them.
		uiEnabled: false,
	},
	food: {
		uiEnabled: false,
	},
};

export const browserOptInKeys = {
	semesterPlanningPreview: "semester-planning-preview",
	foodPreview: "food-preview",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;

export type GatedFeature = keyof typeof featureFlags;

export const featurePreviewOptIns = {
	semesterPlanning: "semesterPlanningPreview",
	food: "foodPreview",
} as const satisfies Record<GatedFeature, BrowserOptIn>;
