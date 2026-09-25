export const CAMPAIGN_STATUS_BADGES = {
	scheduled: { label: "Planlagt", variant: "secondary" },
	open: { label: "Åpen", variant: "default" },
	closed: { label: "Stengt", variant: "destructive" },
	cancelled: { label: "Avbrutt", variant: "outline" },
} as const;

export const REPORT_STATUS_LABELS = {
	revoked: "Tilgangen er trukket tilbake",
	draft: "Klar for gjennomgang",
} as const;

export const REPORT_DELIVERY_LABELS = {
	failed: "E-post feilet",
	delivered: "E-post levert",
	pending: "Klargjør e-post",
	queued: "E-post i kø",
} as const;
