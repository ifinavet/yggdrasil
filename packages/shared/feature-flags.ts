// Central rollout registry shared by apps and backend. Changes take effect after deployment.
export const featureFlags = {
	food: {
		uiEnabled: false,
	},
};

export const browserOptInKeys = {
	foodPreview: "food-preview",
} as const;

export type BrowserOptIn = keyof typeof browserOptInKeys;

export type GatedFeature = keyof typeof featureFlags;

export const featurePreviewOptIns = {
	food: "foodPreview",
} as const satisfies Record<GatedFeature, BrowserOptIn>;
