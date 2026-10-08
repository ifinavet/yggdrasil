import { describe, expect, it } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import { defineReminder, type ReminderInput } from "./reminders";

const event = { _id: "event", eventStart: 1_000 } as unknown as Doc<"events">;
const input = (now: number): ReminderInput =>
	({ ctx: {}, event, campaign: null, now }) as unknown as ReminderInput;

const first = { at: 100, until: 150, text: (count: number) => `first ${count}` };
const last = { id: "last", at: 300, until: 400, text: (count: number) => `last ${count}` };
const steps = [first, { id: "second", at: 200, text: (count: number) => `second ${count}` }, last];
const chain = (stepList = steps, facts: number | null = 3) =>
	defineReminder<number>({
		name: "chain",
		audience: "leads",
		scold: true,
		steps: () => stepList,
		facts: () => facts,
	});

describe("defineReminder", () => {
	it("sends the latest started step until it ends or the next step starts", async () => {
		const reminder = chain();
		const due = async (now: number) => (await reminder.due(input(now)))?.key ?? null;
		expect(await due(99)).toBeNull();
		expect(await due(100)).toBe("chain");
		expect(await due(150)).toBeNull();
		expect(await due(200)).toBe("chain:second");
		expect(await due(299)).toBe("chain:second");
		expect(await due(300)).toBe("chain:last");
		expect(await due(400)).toBeNull();
	});

	it("returns the step text, schedule and recipients", async () => {
		expect(await chain().due(input(250))).toEqual({
			key: "chain:second",
			at: 200,
			text: "second 3",
			audience: "leads",
			scold: true,
		});
	});

	it("sends nothing when the facts say there is nothing to do", async () => {
		expect(await chain(steps, null).due(input(250))).toBeNull();
	});

	it("keeps the other steps' keys and texts when a step is removed", async () => {
		const reminder = chain([first, last]);
		expect((await reminder.due(input(100)))?.key).toBe("chain");
		expect(await reminder.due(input(250))).toBeNull();
		expect(await reminder.due(input(300))).toMatchObject({ key: "chain:last", text: "last 3" });
	});

	it("defaults to all organizers without scolding", async () => {
		const reminder = defineReminder({
			name: "plain",
			audience: "organizers",
			steps: () => [{ at: 0, text: () => "hi" }],
		});
		expect(await reminder.due(input(10))).toMatchObject({ key: "plain", scold: false });
	});
});
