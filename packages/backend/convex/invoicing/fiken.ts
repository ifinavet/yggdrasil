const DEFAULT_BASE_URL = "https://api.fiken.no/api/v2";
const REQUEST_TIMEOUT_MS = 20_000;

export type FikenConfig = { baseUrl: string; token: string; companySlug: string };

export type FikenContact = {
	name: string;
	organizationNumber: string;
	email?: string;
};

export type FikenDraftLine = {
	description: string;
	unitPrice: number;
	quantity: number;
	vatType: string;
};

export type FikenDraft = {
	customerId: number;
	issueDate: string;
	daysUntilDueDate: number;
	invoiceText: string;
	yourReference?: string;
	lines: FikenDraftLine[];
};

const VAT_TYPES: Record<number, string> = { 25: "HIGH", 15: "MEDIUM", 12: "LOW", 0: "NONE" };

export class FikenError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
	}
}

export function fikenConfigured(): boolean {
	return Boolean(process.env.FIKEN_API_TOKEN && process.env.FIKEN_COMPANY_SLUG);
}

export function fikenConfig(): FikenConfig {
	const token = process.env.FIKEN_API_TOKEN;
	const companySlug = process.env.FIKEN_COMPANY_SLUG;
	if (!token || !companySlug) {
		throw new FikenError("FIKEN_API_TOKEN og FIKEN_COMPANY_SLUG må være satt", false);
	}
	return { baseUrl: process.env.FIKEN_API_BASE_URL ?? DEFAULT_BASE_URL, token, companySlug };
}

export function vatTypeFor(vatRate: number): string {
	const vatType = VAT_TYPES[vatRate];
	if (!vatType) throw new FikenError(`Ukjent MVA-sats ${vatRate}`, false);
	return vatType;
}

async function request(config: FikenConfig, path: string, init: RequestInit = {}) {
	const url = `${config.baseUrl}/companies/${config.companySlug}${path}`;
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: `Bearer ${config.token}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	}).catch((error: unknown) => {
		throw new FikenError(`Fiken svarte ikke: ${String(error)}`, true);
	});
	if (response.ok) return response;
	const retryable = response.status === 429 || response.status >= 500;
	const body = (await response.text()).slice(0, 500);
	throw new FikenError(`Fiken svarte ${response.status}: ${body}`, retryable);
}

function createdId(response: Response): number {
	const id = Number(response.headers.get("Location")?.split("/").pop());
	if (!Number.isInteger(id)) throw new FikenError("Fiken svarte uten Location-header", false);
	return id;
}

export async function findCustomerId(
	config: FikenConfig,
	organizationNumber: string,
): Promise<number | null> {
	const query = new URLSearchParams({ organizationNumber, customer: "true" });
	const response = await request(config, `/contacts?${query}`);
	const contacts = (await response.json()) as { contactId: number }[];
	return contacts[0]?.contactId ?? null;
}

export async function createCustomer(config: FikenConfig, contact: FikenContact): Promise<number> {
	const response = await request(config, "/contacts", {
		method: "POST",
		body: JSON.stringify({ ...contact, customer: true }),
	});
	return createdId(response);
}

export async function createInvoiceDraft(config: FikenConfig, draft: FikenDraft): Promise<number> {
	const response = await request(config, "/invoices/drafts", {
		method: "POST",
		body: JSON.stringify({ ...draft, type: "invoice" }),
	});
	return createdId(response);
}
