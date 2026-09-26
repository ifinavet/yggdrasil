import type { Id } from "@workspace/backend/convex/dataModel";
import { describe, expect, it } from "vitest";
import {
	type AccessAccount,
	type AccessDrift,
	accountStatus,
	driftText,
	missingIntegrations,
	prefillFromDrift,
} from "./access-status";

function account(overrides: Partial<AccessAccount>): AccessAccount {
	return {
		_id: "account1" as Id<"memberAccounts">,
		name: "Kari Nordmann",
		workspaceEmail: "kari.nordmann@ifinavet.no",
		uioEmail: "karinor@uio.no",
		stage: "onboarding",
		google: "pending",
		welcomeSent: false,
		slackLinked: false,
		slackChannelsRemoved: undefined,
		lastError: undefined,
		updatedAt: 0,
		...overrides,
	};
}

function drift(overrides: Partial<AccessDrift>): AccessDrift {
	return {
		_id: "drift1" as Id<"accessDrift">,
		kind: "google_without_member",
		email: "snik@ifinavet.no",
		name: undefined,
		...overrides,
	};
}

describe("accountStatus", () => {
	it("shows the error with retry and cancel while onboarding", () => {
		expect(accountStatus(account({ lastError: "Resend er nede." }))).toEqual({
			tone: "failed",
			text: "Resend er nede.",
			actions: ["retry", "cancel"],
		});
	});

	it("only offers retry for failures after onboarding", () => {
		expect(
			accountStatus(account({ stage: "offboarding", lastError: "Slack er nede." })).actions,
		).toEqual(["retry"]);
		expect(
			accountStatus(account({ stage: "cancelled", lastError: "Google er nede." })).actions,
		).toEqual(["retry"]);
	});

	it("follows onboarding from account creation to the first sign-in", () => {
		expect(accountStatus(account({}))).toMatchObject({ tone: "working", text: "Oppretter konto" });
		expect(accountStatus(account({ welcomeSent: true }))).toMatchObject({
			tone: "waiting",
			text: "Venter på første innlogging",
			actions: ["cancel"],
		});
	});

	it("asks for manual Slack deactivation once the rest is removed", () => {
		expect(accountStatus(account({ stage: "offboarded", slackLinked: true }))).toEqual({
			tone: "todo",
			text: "Deaktiver Slack-kontoen i Slack-admin",
			actions: ["slackDeactivated"],
		});
	});

	it("shows work in progress without actions while removing", () => {
		expect(accountStatus(account({ stage: "offboarding" }))).toEqual({
			tone: "working",
			text: "Fjerner tilgang",
			actions: [],
		});
		expect(accountStatus(account({ stage: "active" }))).toMatchObject({ actions: [] });
	});
});

describe("driftText", () => {
	it("describes each kind of drift", () => {
		expect(driftText(drift({}))).toBe("Har Google-konto, men er ikke medlem.");
		expect(driftText(drift({ kind: "member_google_suspended" }))).toBe(
			"Er intern, men Google-kontoen er suspendert.",
		);
		expect(driftText(drift({ kind: "slack_without_member" }))).toBe(
			"Er i Slack, men er ikke medlem.",
		);
	});
});

describe("prefillFromDrift", () => {
	it("splits the name and puts the address in the matching field", () => {
		expect(prefillFromDrift(drift({ name: "Kari Anne Nordmann" }))).toEqual({
			firstName: "Kari",
			lastName: "Anne Nordmann",
			uioEmail: "",
			workspaceEmail: "snik@ifinavet.no",
		});
		expect(
			prefillFromDrift(drift({ kind: "slack_without_member", email: "karinor@uio.no" })),
		).toEqual({ firstName: "", lastName: "", uioEmail: "karinor@uio.no", workspaceEmail: "" });
	});

	it("offers nothing to add for members who are already internal", () => {
		expect(prefillFromDrift(drift({ kind: "member_google_suspended" }))).toBeNull();
	});
});

describe("missingIntegrations", () => {
	it("lists what is not connected", () => {
		expect(missingIntegrations({ google: true, slack: true, slackInvite: true })).toEqual([]);
		expect(missingIntegrations({ google: false, slack: false, slackInvite: false })).toEqual([
			"Google Workspace",
			"Slack",
			"Slack-invitasjonslenken",
		]);
	});
});
