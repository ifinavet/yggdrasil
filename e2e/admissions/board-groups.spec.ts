import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./capture-screenshot";
import { bifrostUrl, clearCookieNotice, huginUrl, resetAdmissions } from "./production-helpers";

test("organization groups appear in the applicant form and referenced groups stay protected", async ({
	page,
}) => {
	await resetAdmissions("open");
	await page.goto(`${bifrostUrl}/organization`);
	await clearCookieNotice(page);
	await expect(page.getByRole("heading", { name: "Arbeidsgrupper" })).toBeVisible();

	const webGroup = page.getByRole("listitem").filter({ hasText: "Web" });
	await webGroup.getByRole("button", { name: "Rediger Web" }).click();
	const editDialog = page.getByRole("dialog");
	await editDialog.getByLabel("Navn").fill("Web endret");
	await editDialog.getByRole("button", { name: "Lagre endringer" }).click();
	await expect(editDialog.getByRole("alert")).toHaveText(
		"Gruppenavnet kan ikke endres mens medlemmer eller søkere bruker gruppen.",
	);
	await captureScreenshot(page, "board", "live-26-group-rename-protected.png", editDialog);
	await page.keyboard.press("Escape");

	await webGroup.getByRole("button", { name: "Slett Web" }).click();
	const deleteDialog = page.getByRole("alertdialog");
	await deleteDialog.getByRole("button", { name: "Slett arbeidsgruppe" }).click();
	await expect(
		page.getByText("Flytt medlemmer og søkere til en annen gruppe før du sletter den.", {
			exact: true,
		}),
	).toBeVisible();

	await captureScreenshot(page, "board", "live-27-group-delete-protected.png", deleteDialog);
	await deleteDialog.getByRole("button", { name: "Avbryt" }).click();
	const groupName = `Opptakstest ${Date.now()}`;
	await page.getByRole("button", { name: "Legg til arbeidsgruppe" }).click();
	const createDialog = page.getByRole("dialog");
	await createDialog.getByLabel("Navn").fill(groupName);
	await createDialog.getByLabel("Beskrivelse").fill("Opprettet for å verifisere opptaksvalgene.");
	await captureScreenshot(page, "board", "live-28-create-group.png", createDialog);
	await createDialog.getByRole("button", { name: "Opprett arbeidsgruppe" }).click();
	await expect(createDialog).toBeHidden();
	await expect(page.getByRole("listitem").filter({ hasText: groupName })).toBeVisible();

	await page.goto(`${huginUrl}/admissions`);
	await clearCookieNotice(page);
	await page.getByRole("combobox", { name: "Hvilken arbeidsgruppe vil du være med i?" }).click();
	await expect(page.getByRole("option", { name: groupName })).toBeVisible();
	await page.getByRole("option", { name: groupName }).click();
	await expect(
		page.getByRole("combobox", { name: "Hvilken arbeidsgruppe vil du være med i?" }),
	).toContainText(groupName);

	await page.goto(`${bifrostUrl}/organization`);
	const createdGroup = page.getByRole("listitem").filter({ hasText: groupName });
	await createdGroup.getByRole("button", { name: `Slett ${groupName}` }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Slett arbeidsgruppe" }).click();
	await expect(createdGroup).toHaveCount(0);
});
