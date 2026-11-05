import { HUGIN_URL } from "@workspace/shared/constants";
import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { describe, expect, it } from "vitest";
import { asUser, grantRole, insertUser, setup, type TestBackend } from "../../../test/fixtures";
import { api } from "../../_generated/api";

const previewCompanyEmail = api.semesterPlanning.semesters.emailPreview.previewCompanyEmail;

async function memberOf(t: TestBackend) {
	const member = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, member._id, "internal");
	return asUser(t, member);
}

describe("previewCompanyEmail", () => {
	it("renders the whole offer email with the details filled in and Navet's signature", async () => {
		const { t } = await setup();

		const preview = await (await memberOf(t)).action(previewCompanyEmail, {
			kind: "offer",
			subject: "Tilbud til {bedrift}",
			text: "Hei {navn}!\n\nVi kan tilby {dato}.",
		});

		expect(preview.subject).toBe("Tilbud til FJORDKODE AS");
		expect(preview.html).toContain("Hei Kari!");
		expect(preview.html).toContain("Vi kan tilby tirsdag 9. februar 2027.");
		expect(preview.html).toContain("Se tilbudet og svar");
		expect(preview.html).toContain(`${HUGIN_URL}/bestill-bedpres/tilbud/eksempel`);
		expect(preview.html).toContain("Med vennlig hilsen,");
		expect(preview.html).toContain(`mailto:${COMPANY_CONTACT_EMAIL}`);
	});

	it("renders the default confirm email when the text is empty", async () => {
		const { t } = await setup();

		const preview = await (await memberOf(t)).action(previewCompanyEmail, {
			kind: "confirm",
			subject: "",
			text: "",
		});

		expect(preview.subject).toBe("Bekreft søknaden deres om bedriftsarrangement");
		expect(preview.html).toContain("Så hyggelig at FJORDKODE AS");
		expect(preview.html).toContain("Bekreft søknaden");
		expect(preview.html).toContain("Med vennlig hilsen,");
	});

	it("is for internal members only", async () => {
		const { t } = await setup();
		const outsider = asUser(t, await insertUser(t, "ola@example.com"));

		await expect(
			outsider.action(previewCompanyEmail, { kind: "offer", subject: "", text: "" }),
		).rejects.toThrow();
	});
});
