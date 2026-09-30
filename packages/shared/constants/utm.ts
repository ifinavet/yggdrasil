export const UTM_SOURCE = {
	IFI_NAVET: "ifinavet",
	EMAIL: "email",
} as const;

export const UTM_MEDIUM = {
	BANNER: "banner",
	EMAIL: "email",
} as const;

export const UTM_CAMPAIGN = {
	FEEDBACK_REMINDER: "feedback_reminder",
} as const;

type Values<T> = T[keyof T];

export type UtmTags = {
	source: Values<typeof UTM_SOURCE>;
	medium: Values<typeof UTM_MEDIUM>;
	campaign: Values<typeof UTM_CAMPAIGN>;
	content?: string;
};

export function utmParams({ source, medium, campaign, content }: UtmTags): Record<string, string> {
	return {
		utm_source: source,
		utm_medium: medium,
		utm_campaign: campaign,
		...(content ? { utm_content: content } : {}),
	};
}
