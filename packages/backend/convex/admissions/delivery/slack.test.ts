import { afterEach, describe, expect, it, vi } from "vitest";
import {
	archiveAdmissionsChannel,
	ensureAdmissionsChannel,
	postAdmissionsNotice,
	type Slack,
} from "./slack";

const period = {
	_id: "admissions-id",
	_creationTime: 1,
	title: "Høst 2026",
	applicationStartAt: Date.parse("2026-07-01T00:00:00Z"),
	slackManagedMemberIds: ["U-old"],
} as never;

function fakeSlack(overrides: Partial<Slack> = {}) {
	return {
		ensurePrivateChannel: vi.fn().mockResolvedValue("channel-id"),
		channelInfo: vi.fn().mockResolvedValue({ purpose: { value: "admissions:admissions-id" } }),
		setChannelPurpose: vi.fn().mockResolvedValue(undefined),
		lookupByEmail: vi.fn(async (email: string) =>
			email.startsWith("missing") ? null : `U-${email}`,
		),
		reconcileChannelMembers: vi.fn().mockResolvedValue(undefined),
		hasMessage: vi.fn().mockResolvedValue(false),
		postMessage: vi.fn().mockResolvedValue(undefined),
		archiveChannel: vi.fn().mockResolvedValue(undefined),
		findOwnedPrivateChannel: vi.fn().mockResolvedValue("channel-id"),
		...overrides,
	} as unknown as Slack;
}

afterEach(() => vi.restoreAllMocks());

describe("admissions Slack delivery", () => {
	it("creates a period channel and invites every interviewer by workspace email", async () => {
		const slack = fakeSlack();
		await expect(
			ensureAdmissionsChannel(
				slack,
				period,
				[{ email: "one@example.test" }, { email: "two@example.test" }],
				vi.fn(),
			),
		).resolves.toBe("channel-id");
		expect(slack.channelInfo).toHaveBeenCalledWith("channel-id");
		expect(slack.ensurePrivateChannel).toHaveBeenCalledWith(
			"h26-opptak",
			"admissions:admissions-id",
			expect.stringContaining("admissions-id"),
		);
		expect(slack.reconcileChannelMembers).toHaveBeenCalledWith(
			"channel-id",
			["U-one@example.test", "U-two@example.test"],
			["U-old"],
			expect.any(Function),
			true,
		);
	});

	it("persists managed membership before and after reconciliation", async () => {
		const persistManaged = vi.fn().mockResolvedValue(undefined);
		const slack = fakeSlack({
			reconcileChannelMembers: vi.fn(async (_channel, desired, managed, persist) => {
				await persist([...managed, ...desired]);
				await persist(desired);
			}),
		});
		await ensureAdmissionsChannel(slack, period, [{ email: "new@example.test" }], persistManaged);
		expect(slack.reconcileChannelMembers).toHaveBeenCalledWith(
			"channel-id",
			["U-new@example.test"],
			["U-old"],
			persistManaged,
			true,
		);
		expect(persistManaged).toHaveBeenNthCalledWith(1, ["U-old", "U-new@example.test"]);
		expect(persistManaged).toHaveBeenNthCalledWith(2, ["U-new@example.test"]);
	});

	it("fails visibly instead of leaving a selected interviewer out of the channel", async () => {
		const slack = fakeSlack();
		await expect(
			ensureAdmissionsChannel(slack, period, [{ email: "missing@example.test" }], vi.fn()),
		).rejects.toThrow("mangler en aktiv Slack-konto");
		expect(slack.reconcileChannelMembers).not.toHaveBeenCalled();
	});

	it("uses the durable notice key to avoid duplicates and surfaces provider failures for retry", async () => {
		const slack = fakeSlack();
		vi.mocked(slack.hasMessage).mockResolvedValueOnce(true);
		await postAdmissionsNotice(slack, "channel-id", "offer-declined:one", 10, "Tilbud avslått");
		expect(slack.postMessage).not.toHaveBeenCalled();

		vi.mocked(slack.postMessage).mockRejectedValueOnce(new Error("Slack unavailable"));
		await expect(
			postAdmissionsNotice(slack, "channel-id", "offer-declined:two", 10, "Tilbud avslått"),
		).rejects.toThrow("Slack unavailable");
	});

	it("keeps offer-declined notices free of applicant notes and answers", async () => {
		const slack = fakeSlack();
		const notice = "En søker takket nei til tilbudet. Kandidaten er tilgjengelig for ny vurdering.";
		await postAdmissionsNotice(slack, "channel-id", "offer-declined:one", 10, notice);
		expect(slack.postMessage).toHaveBeenCalledWith(
			"channel-id",
			notice,
			"offer-declined:one",
			true,
		);
		expect(notice).not.toContain("motivasjon");
		expect(notice).not.toContain("private notes");
	});

	it("finds the period channel by identity and uses the shared archive operation", async () => {
		const slack = fakeSlack();
		await archiveAdmissionsChannel(slack, period);
		expect(slack.findOwnedPrivateChannel).toHaveBeenCalledWith(
			["h26-opptak", "h26-opptak-admissions-id"],
			"admissions:admissions-id",
		);
		expect(slack.archiveChannel).toHaveBeenCalledWith("channel-id");
	});

	it("does not create or archive a missing period channel", async () => {
		const slack = fakeSlack({ findOwnedPrivateChannel: vi.fn().mockResolvedValue(null) });
		await archiveAdmissionsChannel(slack, period);
		expect(slack.ensurePrivateChannel).not.toHaveBeenCalled();
		expect(slack.archiveChannel).not.toHaveBeenCalled();
	});
});
