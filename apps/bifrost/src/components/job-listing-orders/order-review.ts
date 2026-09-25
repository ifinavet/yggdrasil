import { formatOsloDate, osloDateTimeToEpoch } from "@workspace/shared/time";

type Billing = { address: string; email: string; reference: string };

export type CompanyChanges = {
	displayName?: string;
	description?: string;
	logoUrl?: string | null;
	billing?: Billing;
};

export type CompanyUpdate = {
	status: "pending" | "approved" | "rejected";
	changes: CompanyChanges;
	previous: CompanyChanges;
};

export const APPROVE_BLOCKED_MESSAGE =
	"Godkjenn eller avvis endringen i bedriftsinformasjonen først.";

const CHANGE_LABELS = {
	displayName: "Visningsnavn",
	description: "Beskrivelse",
	logoUrl: "Logo",
	billing: "Fakturainformasjon",
} satisfies Record<keyof CompanyChanges, string>;

type ChangeKey = keyof typeof CHANGE_LABELS;

export type CompanyChangeRow = {
	key: ChangeKey;
	label: string;
	before: CompanyChanges[ChangeKey];
	after: CompanyChanges[ChangeKey];
};

const CHANGE_KEYS = Object.keys(CHANGE_LABELS) as ChangeKey[];

export function approveBlocker(update: Pick<CompanyUpdate, "status"> | null): string | undefined {
	return update?.status === "pending" ? APPROVE_BLOCKED_MESSAGE : undefined;
}

export function companyChangeRows(update: CompanyUpdate): CompanyChangeRow[] {
	return CHANGE_KEYS.filter((key) => update.changes[key] !== undefined).map((key) => ({
		key,
		label: CHANGE_LABELS[key],
		before: update.previous[key],
		after: update.changes[key],
	}));
}

export function formatBilling(billing: Billing | undefined): string {
	if (!billing) return "";
	return [billing.address, billing.email, billing.reference].filter(Boolean).join(", ");
}

export function formatDeadline(deadline: string): string {
	return formatOsloDate(osloDateTimeToEpoch(deadline, "23:59"), "d. MMMM yyyy");
}
