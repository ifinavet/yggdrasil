import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "../../test/fixtures";
import { api } from "../_generated/api";
import { orderRateLimiter } from "./rateLimits";

const searchAddresses = api.jobListingOrders.addressSearch.searchAddresses;
const SESSION = "5f0c6f7e-2b1a-4c3d-9e8f-0a1b2c3d4e5f";
const OTHER_SESSION = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SESSION_CAPACITY = 30;
const GLOBAL_CAPACITY = 300;

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

		const addresses = await t.action(searchAddresses, {
			query: " Gaustadalléen 23 ",
			sessionId: SESSION,
		});

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

		expect(await t.action(searchAddresses, { query: "gata", sessionId: SESSION })).toEqual([
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

			expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual(
				[],
			);
		},
	);

	it("returns no suggestions when Geonorge answers with an error", async () => {
		const { t } = await setup();
		stubGeonorge(() => json(503, { message: "down" }));

		expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual(
			[],
		);
	});

	it("returns no suggestions when Geonorge cannot be reached", async () => {
		const { t } = await setup();
		stubGeonorge(() => Promise.reject(new TypeError("fetch failed")));

		expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual(
			[],
		);
	});

	it("rejects a query that is too short without calling Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));

		await expect(t.action(searchAddresses, { query: " ab ", sessionId: SESSION })).rejects.toThrow(
			"Skriv minst tre tegn.",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects a query that is too long without calling Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));

		await expect(
			t.action(searchAddresses, { query: "a".repeat(101), sessionId: SESSION }),
		).rejects.toThrow("Skriv minst tre tegn.");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects a session id that is not a uuid without calling Geonorge", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));

		await expect(
			t.action(searchAddresses, { query: "Storgata 1", sessionId: "x".repeat(500) }),
		).rejects.toThrow("Ugyldig søk.");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("limits one session without blocking another", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() =>
			json(200, {
				adresser: [{ adressetekst: "Storgata 1", postnummer: "0155", poststed: "OSLO" }],
			}),
		);

		for (let call = 0; call < SESSION_CAPACITY; call++) {
			expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual([
				"Storgata 1, 0155 OSLO",
			]);
		}

		expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual(
			[],
		);
		expect(fetchMock).toHaveBeenCalledTimes(SESSION_CAPACITY);
		expect(
			await t.action(searchAddresses, { query: "Storgata 1", sessionId: OTHER_SESSION }),
		).toEqual(["Storgata 1, 0155 OSLO"]);
	});

	it("stops every session once the global cap is spent", async () => {
		const { t } = await setup();
		const fetchMock = stubGeonorge(() => json(200, { adresser: [] }));
		await t.run((ctx) =>
			orderRateLimiter.limit(ctx, "jobListingOrderAddressSearchGlobal", {
				count: GLOBAL_CAPACITY,
			}),
		);

		expect(await t.action(searchAddresses, { query: "Storgata 1", sessionId: SESSION })).toEqual(
			[],
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
