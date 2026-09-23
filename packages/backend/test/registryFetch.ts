import { vi } from "vitest";

// Fakes brreg and the Peppol Directory for tests by stubbing the global fetch. Call
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
	peppol?: "found" | "not_found" | "error" | "down";
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** Replaces fetch with fake brreg and Peppol answers, and returns the URLs that were called. */
export function stubRegistries({
	unit = brregUnit(),
	unitStatus = 200,
	searchHits = [],
	brregDown = false,
	peppol = "found",
}: RegistryStubs = {}): string[] {
	const calls: string[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request) => {
			const url = input instanceof Request ? input.url : String(input);
			calls.push(url);

			if (url.startsWith("https://directory.peppol.eu/")) {
				if (peppol === "down") throw new TypeError("fetch failed");
				if (peppol === "error") return json(503, {});
				const found = peppol === "found";
				return json(200, { "total-result-count": found ? 1 : 0, matches: found ? [{}] : [] });
			}

			if (url.startsWith("https://data.brreg.no/")) {
				if (brregDown) throw new TypeError("fetch failed");
				if (url.includes("?")) {
					return json(
						200,
						searchHits.length ? { _embedded: { enheter: searchHits } } : { page: {} },
					);
				}
				return json(unitStatus, unit);
			}

			throw new Error(`Unexpected fetch in test: ${url}`);
		}),
	);

	return calls;
}
