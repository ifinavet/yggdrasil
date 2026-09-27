import { vi } from "vitest";

// Fakes brreg for tests by stubbing the global fetch. Call
// vi.unstubAllGlobals() after each test.

type Unit = Record<string, unknown>;

export const VALID_ORG_NUMBER = "982463718";

export function brregUnit(overrides: Unit = {}): Unit {
	return {
		organisasjonsnummer: VALID_ORG_NUMBER,
		navn: "FJORDKODE AS",
		organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
		forretningsadresse: {
			adresse: ["Storgata 12"],
			postnummer: "0155",
			poststed: "OSLO",
			landkode: "NO",
		},
		naeringskode1: { kode: "62.100", beskrivelse: "Programmeringstjenester" },
		hjemmeside: "www.fjordkode.no",
		antallAnsatte: 48,
		konkurs: false,
		underAvvikling: false,
		underTvangsavviklingEllerTvangsopplosning: false,
		...overrides,
	};
}

export type RegistryStubs = {
	unit?: Unit;
	unitStatus?: number;
	searchHits?: Unit[];
	brregDown?: boolean;
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function brregResponse(
	url: string,
	{ unit, unitStatus, searchHits, brregDown }: Required<RegistryStubs>,
): Response {
	if (brregDown) throw new TypeError("fetch failed");
	if (!url.includes("?")) return json(unitStatus, unit);
	return json(200, searchHits.length ? { _embedded: { enheter: searchHits } } : { page: {} });
}

/** Replaces fetch with fake brreg answers, and returns the URLs that were called. */
export function stubRegistries({
	unit = brregUnit(),
	unitStatus = 200,
	searchHits = [],
	brregDown = false,
}: RegistryStubs = {}): string[] {
	const calls: string[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request) => {
			const url = input instanceof Request ? input.url : String(input);
			calls.push(url);

			if (url.startsWith("https://data.brreg.no/")) {
				return brregResponse(url, { unit, unitStatus, searchHits, brregDown });
			}
			throw new Error(`Unexpected fetch in test: ${url}`);
		}),
	);

	return calls;
}
