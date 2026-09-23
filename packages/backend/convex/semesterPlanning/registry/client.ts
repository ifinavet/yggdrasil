import type { Infer } from "convex/values";
import type { blockedReason, brregSnapshotAtSubmission, peppolLookup } from "../schema";

// Clients for Enhetsregisteret (brreg) and the Peppol Directory. Both are free, public and need no
// key. They are only called from actions, never from the browser.

const BRREG_UNITS_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";
const PEPPOL_SEARCH_URL = "https://directory.peppol.eu/search/1.0/json";
const REGISTRY_TIMEOUT_MS = 8000;
const BRREG_SEARCH_LIMIT = 10;
// Peppol participant id scheme for Norwegian organization numbers.
const NORWEGIAN_ORG_NUMBER_SCHEME = "iso6523-actorid-upis::0192";

export type BrregSnapshot = Infer<typeof brregSnapshotAtSubmission>;
export type PeppolLookup = Infer<typeof peppolLookup>;

/** Why a unit cannot apply, or null when it can. */
export type BlockedReason = Infer<typeof blockedReason>;

export type BrregLookup =
	| { status: "found"; snapshot: BrregSnapshot; blockedReason: BlockedReason | null }
	| { status: "not_found" };

export type BrregHit = {
	orgNumber: string;
	name: string;
	organizationForm: string;
	city?: string;
	blockedReason?: BlockedReason;
};

/** Thrown when brreg does not answer, so the caller can show «prøv igjen» instead of «not found». */
export class RegistryUnavailableError extends Error {}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readRegistryCode(value: unknown): { code: string; description: string } | undefined {
	if (!isObject(value)) return undefined;
	const kode = readText(value.kode);
	const beskrivelse = readText(value.beskrivelse);
	return kode && beskrivelse ? { code: kode, description: beskrivelse } : undefined;
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
		});
	} catch (error) {
		throw new RegistryUnavailableError(`Request to ${url} failed: ${String(error)}`);
	}

	const body: unknown = await response.json().catch(() => null);
	return { status: response.status, body };
}

/** Why a brreg unit cannot apply: deleted, bankrupt, or being wound up. */
export function brregBlockedReason(unit: Json): BlockedReason | null {
	if (readText(unit.slettedato)) return "deleted";
	if (unit.konkurs === true) return "bankrupt";
	if (unit.underAvvikling === true || unit.underTvangsavviklingEllerTvangsopplosning === true) {
		return "liquidation";
	}
	return null;
}

/** The fields we keep from a brreg unit, as it was at this moment. */
export function toBrregSnapshot(unit: Json, fetchedAt: number): BrregSnapshot {
	const address = isObject(unit.forretningsadresse) ? unit.forretningsadresse : undefined;
	const addressLines = Array.isArray(address?.adresse)
		? address.adresse.filter((line): line is string => typeof line === "string" && line !== "")
		: [];
	const employeeCount = typeof unit.antallAnsatte === "number" ? unit.antallAnsatte : undefined;
	const organizationForm = readRegistryCode(unit.organisasjonsform) ?? {
		code: "",
		description: "",
	};
	const industry = readRegistryCode(unit.naeringskode1);
	const postalCode = readText(address?.postnummer);
	const city = readText(address?.poststed);
	const countryCode = readText(address?.landkode);
	const website = readText(unit.hjemmeside);

	return {
		name: readText(unit.navn) ?? "",
		organizationForm,
		...(address
			? {
					businessAddress: {
						addressLines,
						...(postalCode ? { postalCode } : {}),
						...(city ? { city } : {}),
						...(countryCode ? { countryCode } : {}),
					},
				}
			: {}),
		...(industry ? { industry } : {}),
		...(website ? { website } : {}),
		...(employeeCount !== undefined ? { employeeCount } : {}),
		fetchedAt,
	};
}

/**
 * Looks up one unit by organization number. Deleted units come back as found, with the reason.
 *
 * @throws {RegistryUnavailableError} When brreg does not answer.
 */
export async function fetchBrregUnit(orgNumber: string, now: number): Promise<BrregLookup> {
	const { status, body } = await getJson(`${BRREG_UNITS_URL}/${orgNumber}`);

	if (status === 404) return { status: "not_found" };
	if (status === 410) {
		// brreg answers 410 Gone for deleted units, with only a few fields.
		const unit = isObject(body) ? body : {};
		return { status: "found", snapshot: toBrregSnapshot(unit, now), blockedReason: "deleted" };
	}
	if (status !== 200 || !isObject(body)) {
		throw new RegistryUnavailableError(`brreg answered ${status} for ${orgNumber}`);
	}

	return {
		status: "found",
		snapshot: toBrregSnapshot(body, now),
		blockedReason: brregBlockedReason(body),
	};
}

/**
 * Searches brreg by name and returns up to ten hits for the Hugin picker.
 *
 * @throws {RegistryUnavailableError} When brreg does not answer.
 */
export async function searchBrregUnits(name: string): Promise<BrregHit[]> {
	const params = new URLSearchParams({ navn: name, size: String(BRREG_SEARCH_LIMIT) });
	const { status, body } = await getJson(`${BRREG_UNITS_URL}?${params}`);
	if (status !== 200 || !isObject(body)) {
		throw new RegistryUnavailableError(`brreg search answered ${status}`);
	}

	const embedded = isObject(body._embedded) ? body._embedded : {};
	const units = Array.isArray(embedded.enheter) ? embedded.enheter.filter(isObject) : [];

	return units.flatMap((unit) => {
		const orgNumber = readText(unit.organisasjonsnummer);
		const name = readText(unit.navn);
		if (!orgNumber || !name) return [];

		const address = isObject(unit.forretningsadresse) ? unit.forretningsadresse : undefined;
		const city = readText(address?.poststed);
		const blockedReason = brregBlockedReason(unit);

		return [
			{
				orgNumber,
				name,
				organizationForm: readRegistryCode(unit.organisasjonsform)?.description ?? "",
				...(city ? { city } : {}),
				...(blockedReason ? { blockedReason } : {}),
			},
		];
	});
}

/** Whether the company can receive EHF invoices. Never throws: a failed lookup is "failed". */
export async function lookupPeppolParticipant(orgNumber: string): Promise<PeppolLookup> {
	const params = new URLSearchParams({
		participant: `${NORWEGIAN_ORG_NUMBER_SCHEME}:${orgNumber}`,
	});
	try {
		const { status, body } = await getJson(`${PEPPOL_SEARCH_URL}?${params}`);
		if (status !== 200 || !isObject(body)) return "failed";

		const matches = Array.isArray(body.matches) ? body.matches.length : 0;
		const total = typeof body["total-result-count"] === "number" ? body["total-result-count"] : 0;
		return matches > 0 || total > 0 ? "found" : "not_found";
	} catch {
		return "failed";
	}
}
