import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "../../test/fixtures";
import { api } from "../_generated/api";

const searchAddresses = api.jobListingOrders.addressSearch.searchAddresses;

function stubGeonorge(respond: (url: URL) => Response | Promise<Response>) {
	const fetchMock = vi.fn((input: RequestInfo | URL) => respond(new URL(String(input))));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("searchAddresses", () => {
	it("returns formatted suggestions from Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() =>
			json(200, {
				adresser: [{ adressetekst: "Gaustadalléen 23A", postnummer: "0373", poststed: "OSLO" }],
			}),
		);

		const addresses = await t.action(searchAddresses, { query: " Gaustadalléen 23 " });

		expect(addresses).toEqual(["Gaustadalléen 23A, 0373 OSLO"]);
		const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
		expect(url.origin + url.pathname).toBe("https://ws.geonorge.no/adresser/v1/sok");
		expect(url.searchParams.get("sok")).toBe("Gaustadalléen 23");
	});

	it("joins street, postcode and place, and drops duplicates and hits without a street", async () => {
		const { t } = await setup();
		stubGeonorge(() =>
			json(200, {
				adresser: [
					{ adressetekst: "Gaustadalléen 23A", postnummer: "0373", poststed: "OSLO" },
					{ adressetekst: "Gaustadalléen 23A", postnummer: "0373", poststed: "OSLO" },
					{ adressetekst: "Storgata 1", postnummer: "", poststed: "" },
					{ adressetekst: "Kirkeveien 2" },
					{ adressetekst: "", postnummer: "0155", poststed: "OSLO" },
					null,
				],
			}),
		);

		expect(await t.action(searchAddresses, { query: "gata" })).toEqual([
			"Gaustadalléen 23A, 0373 OSLO",
			"Storgata 1",
			"Kirkeveien 2",
		]);
	});

	it.each([{}, null, { adresser: "nope" }])(
		"returns no suggestions for an unexpected body %j",
		async (body) => {
			const { t } = await setup();
			stubGeonorge(() => json(200, body));

			expect(await t.action(searchAddresses, { query: "Storgata 1" })).toEqual([]);
		},
	);

	it("returns no suggestions when Geonorge answers with an error", async () => {
		const { t } = await setup();
		stubGeonorge(() => json(503, { message: "down" }));

		expect(await t.action(searchAddresses, { query: "Storgata 1" })).toEqual([]);
	});

	it("returns no suggestions when Geonorge cannot be reached", async () => {
		const { t } = await setup();
		stubGeonorge(() => Promise.reject(new TypeError("fetch failed")));

		expect(await t.action(searchAddresses, { query: "Storgata 1" })).toEqual([]);
	});

	it("rejects a query that is too short without calling Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));

		await expect(t.action(searchAddresses, { query: " ab " })).rejects.toThrow(
			"Skriv minst tre tegn.",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects a query that is too long without calling Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));

		await expect(t.action(searchAddresses, { query: "a".repeat(101) })).rejects.toThrow(
			"Skriv minst tre tegn.",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
