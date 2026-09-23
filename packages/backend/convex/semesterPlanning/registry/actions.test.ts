import { afterEach, describe, expect, it, vi } from "vitest";
import { refusalMessageFrom, setup } from "../../../test/fixtures";
import { brregUnit, stubRegistries, VALID_ORG_NUMBER } from "../../../test/registryFetch";
import { api } from "../../_generated/api";

const actions = api.semesterPlanning.registry.actions;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("searchCompanies", () => {
	it("returns name hits with city, and flags companies that cannot apply", async () => {
		const { t } = await setup();
		stubRegistries({
			searchHits: [
				brregUnit(),
				brregUnit({
					organisasjonsnummer: "933440710",
					navn: "FJORDKODE BERGEN AS",
					forretningsadresse: { poststed: "BERGEN" },
					konkurs: true,
				}),
				brregUnit({
					organisasjonsnummer: "918204557",
					navn: "FJORDKODE VEST AS",
					underAvvikling: true,
				}),
			],
		});

		const hits = await t.action(actions.searchCompanies, { query: "fjordkode" });

		expect(hits).toEqual([
			{
				orgNumber: VALID_ORG_NUMBER,
				name: "FJORDKODE AS",
				organizationForm: "Aksjeselskap",
				city: "OSLO",
			},
			{
				orgNumber: "933440710",
				name: "FJORDKODE BERGEN AS",
				organizationForm: "Aksjeselskap",
				city: "BERGEN",
				blockedReason: "bankrupt",
			},
			{
				orgNumber: "918204557",
				name: "FJORDKODE VEST AS",
				organizationForm: "Aksjeselskap",
				city: "OSLO",
				blockedReason: "liquidation",
			},
		]);
	});

	it("looks up an organization number directly, also with spaces", async () => {
		const { t } = await setup();
		const calls = stubRegistries();

		const hits = await t.action(actions.searchCompanies, { query: "982 463 718" });

		expect(hits.map((hit) => hit.orgNumber)).toEqual([VALID_ORG_NUMBER]);
		expect(calls).toEqual([
			`https://data.brreg.no/enhetsregisteret/api/enheter/${VALID_ORG_NUMBER}`,
		]);
	});

	it("shows a deleted company as blocked", async () => {
		const { t } = await setup();
		stubRegistries({
			unitStatus: 410,
			unit: {
				organisasjonsnummer: VALID_ORG_NUMBER,
				navn: "FJORDKODE AS",
				slettedato: "2024-01-01",
			},
		});

		const hits = await t.action(actions.searchCompanies, { query: VALID_ORG_NUMBER });

		expect(hits[0]?.blockedReason).toBe("deleted");
	});

	it("returns nothing for an unknown or invalid organization number", async () => {
		const { t } = await setup();
		const calls = stubRegistries({ unitStatus: 404, unit: {} });

		expect(await t.action(actions.searchCompanies, { query: VALID_ORG_NUMBER })).toEqual([]);
		expect(await t.action(actions.searchCompanies, { query: "982463719" })).toEqual([]);
		expect(calls).toHaveLength(1);
	});

	it("says «try again» when brreg is down", async () => {
		const { t } = await setup();
		stubRegistries({ brregDown: true });

		const message = await refusalMessageFrom(
			t.action(actions.searchCompanies, { query: "fjordkode" }),
		);
		expect(message).toBe(
			"Vi får ikke kontakt med Brønnøysundregistrene akkurat nå. Prøv igjen om litt.",
		);
	});

	it("refuses a query that is too short", async () => {
		const { t } = await setup();
		stubRegistries();

		expect(await refusalMessageFrom(t.action(actions.searchCompanies, { query: " f " }))).toBe(
			"Skriv minst to tegn.",
		);
	});
});

describe("lookupPeppol", () => {
	it.each([
		["found", "found"],
		["not_found", "not_found"],
		["error", "failed"],
		["down", "failed"],
	] as const)("maps a Peppol answer of %s to %s", async (peppol, expected) => {
		const { t } = await setup();
		stubRegistries({ peppol });

		expect(await t.action(actions.lookupPeppol, { orgNumber: VALID_ORG_NUMBER })).toBe(expected);
	});

	it("refuses an invalid organization number without calling Peppol", async () => {
		const { t } = await setup();
		const calls = stubRegistries();

		const message = await refusalMessageFrom(t.action(actions.lookupPeppol, { orgNumber: "123" }));

		expect(message).toBe("Organisasjonsnummeret er ugyldig.");
		expect(calls).toEqual([]);
	});
});
