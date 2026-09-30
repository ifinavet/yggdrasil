import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertEvent,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
import { api } from "../_generated/api";

describe("company history", () => {
	it("combines company records in timestamp order with their saved statuses and links", async () => {
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.test");
		await grantRole(t, admin._id, "admin");
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId, {
			orgNumber: "123456789",
			status: "confirmed",
		});
		await t.run((ctx) =>
			Promise.all(
				[
					{
						type: "status_changed" as const,
						actor: "internal" as const,
						fromStatus: "applied" as const,
						toStatus: "confirmed" as const,
					},
					{ type: "submitted" as const, actor: "company" as const },
					{ type: "date_assigned" as const, actor: "internal" as const, date: "2027-02-09" },
					{ type: "date_cleared" as const, actor: "internal" as const },
					{ type: "event_linked" as const, actor: "system" as const },
					{ type: "status_changed" as const, actor: "internal" as const },
					{
						type: "status_changed" as const,
						actor: "internal" as const,
						toStatus: "confirmed" as const,
					},
				].map((activity) =>
					ctx.db.insert("companyApplicationActivity", { applicationId, ...activity }),
				),
			),
		);

		await t.run(async (ctx) => {
			const eventId = await ctx.db.insert("events", {
				title: "Vårarrangement",
				teaser: "",
				description: "",
				eventStart: 8_000,
				registrationOpens: 1_000,
				participationLimit: 10,
				location: "Oslo",
				language: "norsk",
				ageRestriction: "",
				externalEvent: false,
				hostingCompany: companyId,
				published: true,
				slug: "testarrangement",
			});
			const reportCampaignId = await ctx.db.insert("feedbackCampaigns", {
				eventId,
				status: "closed",
				opensAt: 1_000,
				closesAt: 2_000,
				generation: 1,
			});
			await ctx.db.insert("feedbackReports", {
				campaignId: reportCampaignId,
				eventId,
				eventTitle: "Vårarrangement",
				eventStart: 8_000,
				companyName: "Testbedrift",
				recipientEmail: "bedrift@example.test",
				status: "approved",
				questions: [],
				totalResponses: 3,
				buildCursor: null,
				revision: 1,
				retentionAt: 100_000,
				approvedAt: 9_000,
			});
			const productId = await ctx.db.insert("products", {
				name: "Stillingsannonse",
				shortDescription: "",
				longDescription: "",
				category: "job_listing",
				vatRate: 25,
				sortOrder: 0,
				active: true,
			});
			const orderId = await ctx.db.insert("jobListingOrders", {
				reference: "JOB-2027-01",
				submissionId: "company-history-test",
				status: "confirmed",
				companyId,
				productId,
				productName: "Stillingsannonse",
				startup: false,
				quantity: 1,
				priceOre: 100_000,
				contact: { name: "Ada", email: "ada@example.test" },
				confirmedAt: 7_000,
			});
			await ctx.db.insert("companyUpdateRequests", {
				companyId,
				orderId,
				changes: { displayName: "Nytt navn" },
				previous: { displayName: "Testbedrift" },
				status: "approved",
				decidedAt: 6_000,
			});
			for (const [status, decidedAt] of [
				["pending", undefined],
				["rejected", 5_000],
			] as const) {
				await ctx.db.insert("companyUpdateRequests", {
					companyId,
					orderId,
					changes: {},
					previous: {},
					status,
					decidedAt,
				});
			}
			for (const status of ["awaiting_email", "published", "rejected"] as const) {
				await ctx.db.insert("jobListingOrders", {
					reference: `JOB-${status}`,
					submissionId: `company-history-${status}`,
					status,
					companyId,
					productId,
					productName: "Stillingsannonse",
					startup: false,
					quantity: status === "published" ? 2 : 1,
					priceOre: 100_000,
					contact: { name: "Ada", email: "ada@example.test" },
					...(status === "published" ? { decidedAt: 5_500 } : {}),
				});
			}
			const unpublishedEventId = await ctx.db.insert("events", {
				title: "Kladd uten dato",
				teaser: "",
				description: "",
				eventStart: 4_000,
				registrationOpens: 1_000,
				participationLimit: 10,
				location: "Oslo",
				language: "norsk",
				ageRestriction: "",
				externalEvent: false,
				hostingCompany: companyId,
				published: false,
			});
			const campaignId = await ctx.db.insert("feedbackCampaigns", {
				eventId: unpublishedEventId,
				status: "closed",
				opensAt: 1_000,
				closesAt: 2_000,
				generation: 1,
			});
			await ctx.db.insert("feedbackReports", {
				campaignId,
				eventId: unpublishedEventId,
				eventTitle: "Kladd uten dato",
				eventStart: 4_000,
				companyName: "Testbedrift",
				recipientEmail: "bedrift@example.test",
				status: "approved",
				questions: [],
				totalResponses: 0,
				buildCursor: null,
				revision: 1,
				retentionAt: 100_000,
				approvedAt: 4_500,
			});
			const eventWithoutCampaignId = await ctx.db.insert("events", {
				title: "Uten tilbakemelding",
				teaser: "",
				description: "",
				eventStart: 3_000,
				registrationOpens: 1_000,
				participationLimit: 10,
				location: "Oslo",
				language: "norsk",
				ageRestriction: "",
				externalEvent: false,
				hostingCompany: companyId,
				published: true,
			});
			const campaignWithoutApprovalId = await ctx.db.insert("feedbackCampaigns", {
				eventId: eventWithoutCampaignId,
				status: "closed",
				opensAt: 1_000,
				closesAt: 2_000,
				generation: 1,
			});
			await ctx.db.insert("feedbackReports", {
				campaignId: campaignWithoutApprovalId,
				eventId: eventWithoutCampaignId,
				eventTitle: "Uten tilbakemelding",
				eventStart: 3_000,
				companyName: "Testbedrift",
				recipientEmail: "bedrift@example.test",
				status: "approved",
				questions: [],
				totalResponses: 0,
				buildCursor: null,
				revision: 1,
				retentionAt: 100_000,
			});
			await ctx.db.insert("events", {
				title: "Uten kampanje",
				teaser: "",
				description: "",
				eventStart: 2_000,
				registrationOpens: 1_000,
				participationLimit: 10,
				location: "Oslo",
				language: "norsk",
				ageRestriction: "",
				externalEvent: false,
				hostingCompany: companyId,
				published: true,
			});
		});
		const autumnSemester = await insertSemester(t, { year: 2026, term: "autumn" });
		await insertApplication(t, autumnSemester, { orgNumber: "123456789" });
		const deletedSemester = await insertSemester(t, { year: 2025 });
		await insertApplication(t, deletedSemester, { orgNumber: "123456789" });
		await t.run((ctx) => ctx.db.delete(deletedSemester));
		const otherCompanyId = await t.run(async (ctx) => {
			const company = await ctx.db.get(companyId);
			if (!company) throw new Error("Expected company fixture");
			return ctx.db.insert("companies", {
				orgNumber: 987654321,
				name: "Other company",
				description: company.description,
				mainSponsor: false,
				logo: company.logo,
			});
		});
		await insertEvent(t, otherCompanyId, { title: "Other company's event", eventStart: 99_000 });
		const otherSemester = await insertSemester(t, { year: 2028 });
		await insertApplication(t, otherSemester, { orgNumber: "987654321" });
		await t.run(async (ctx) => {
			const productId = await ctx.db.insert("products", {
				name: "Other company product",
				shortDescription: "",
				longDescription: "",
				category: "job_listing",
				vatRate: 25,
				sortOrder: 0,
				active: true,
			});
			const orderId = await ctx.db.insert("jobListingOrders", {
				reference: "OTHER-1",
				submissionId: "other-company-history",
				status: "confirmed",
				companyId: otherCompanyId,
				productId,
				productName: "Other company private order",
				startup: false,
				quantity: 1,
				priceOre: 100_000,
				contact: { name: "Ada", email: "ada@example.test" },
			});
			await ctx.db.insert("companyUpdateRequests", {
				companyId: otherCompanyId,
				orderId,
				changes: {},
				previous: {},
				status: "approved",
				decidedAt: 100_000,
			});
		});

		const history = await asUser(t, admin).query(api.companies.history.getHistory, { companyId });

		expect(history.map(({ label }) => label)).toEqual(
			expect.arrayContaining([
				"Bedrift registrert",
				"Søknad, vår 2027: Søknadsstatus endret",
				"Arrangement: Vårarrangement",
				"Tilbakemeldingsrapport godkjent: Vårarrangement",
				"Annonsekjøp JOB-2027-01: Stillingsannonse",
				"Endring av bedriftsprofil godkjent",
			]),
		);
		expect(history.find(({ detail }) => detail === "Søkt → Bekreftet")?.detail).toBe(
			"Søkt → Bekreftet",
		);
		const listingPurchase = history.find(({ label }) => label.includes("JOB-2027-01"));
		expect(listingPurchase).toMatchObject({
			at: 7_000,
			label: "Annonsekjøp JOB-2027-01: Stillingsannonse",
			detail: "Bekreftet · 1 annonse",
			dateLabel: "Bekreftet",
		});
		expect(history.find(({ label }) => label.includes("JOB-published"))?.detail).toBe(
			"Publisert · 2 annonser",
		);
		expect(history.filter(({ label }) => label.includes("JOB-2027-01"))).toHaveLength(1);
		expect(history.find(({ label }) => label.startsWith("Arrangement:"))?.href).toBe(
			"/events/testarrangement",
		);
		expect(history.find(({ label }) => label.startsWith("Tilbakemeldingsrapport"))).toMatchObject({
			at: 9_000,
			href: "/events/testarrangement/report",
		});
		expect(history.find(({ at }) => at === 6_000)?.at).toBe(6_000);
		expect(history.find(({ at }) => at === 6_000)?.detail).toBe("Navn");
		expect(history.some(({ label }) => label.includes("Other company's event"))).toBe(false);
		expect(history.some(({ label }) => label.includes("Other company private order"))).toBe(false);
		expect(
			history.filter(({ label }) => label.startsWith("Endring av bedriftsprofil")),
		).toHaveLength(3);
		expect(history.map(({ at }) => at)).toEqual(
			[...history.map(({ at }) => at)].sort((a, b) => b - a),
		);
	});

	it("returns no history for a removed company", async () => {
		const { t, companyId } = await setup();
		const admin = await insertUser(t, "admin@example.test");
		await grantRole(t, admin._id, "admin");
		const student = await insertUser(t, "student@example.test");
		expect(
			await refusalMessageFrom(
				asUser(t, student).query(api.companies.history.getHistory, { companyId }),
			),
		).toContain("Unauthorized");
		await t.run((ctx) => ctx.db.delete(companyId));

		expect(await asUser(t, admin).query(api.companies.history.getHistory, { companyId })).toEqual(
			[],
		);
	});
});
