import { EVENT_GUIDE_STORAGE_KEY } from "@workspace/shared/events/guide";
import { ORGANIZATION_GUIDE_STORAGE_KEY } from "@workspace/shared/organization";
import { describe, expect, it } from "vitest";
import { asUser, insertUser, refusalMessageFrom, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";

const { seen } = api.users.guides.queries;
const { markSeen, reset } = api.users.guides.mutations;
const guide = EVENT_GUIDE_STORAGE_KEY;

async function setupUser() {
	const { t } = await setup();
	const user = await insertUser(t, "intern@example.test");
	return { t, user, as: asUser(t, user) };
}

describe("seen guide steps", () => {
	it("returns null when nobody is signed in", async () => {
		const { t } = await setup();
		expect(await t.query(seen, { guide })).toBeNull();
	});

	it("returns no steps before the user dismisses any", async () => {
		const { as } = await setupUser();
		expect(await as.query(seen, { guide })).toEqual([]);
	});

	it("stores each dismissed step once, in order", async () => {
		const { as } = await setupUser();
		await as.mutation(markSeen, { guide, step: "registrations" });
		await as.mutation(markSeen, { guide, step: "checklist" });
		await as.mutation(markSeen, { guide, step: "registrations" });
		expect(await as.query(seen, { guide })).toEqual(["registrations", "checklist"]);
	});

	it("refuses a step that is not part of the guide", async () => {
		const { as } = await setupUser();
		const message = await refusalMessageFrom(as.mutation(markSeen, { guide, step: "board" }));
		expect(message).toBe("Ukjent steg i veiledningen.");
		expect(await as.query(seen, { guide })).toEqual([]);
	});

	it("refuses to store steps for a signed out visitor", async () => {
		const { t } = await setup();
		const message = await refusalMessageFrom(t.mutation(markSeen, { guide, step: "checklist" }));
		expect(message).toContain("Unauthorized");
	});

	it("keeps guides and users apart", async () => {
		const { t, as } = await setupUser();
		const other = asUser(t, await insertUser(t, "annen@example.test"));
		await as.mutation(markSeen, { guide, step: "checklist" });
		expect(await as.query(seen, { guide: ORGANIZATION_GUIDE_STORAGE_KEY })).toEqual([]);
		expect(await other.query(seen, { guide })).toEqual([]);
	});

	it("shows the guide again after a reset", async () => {
		const { as } = await setupUser();
		await as.mutation(markSeen, { guide, step: "checklist" });
		await as.mutation(markSeen, { guide: ORGANIZATION_GUIDE_STORAGE_KEY, step: "add" });
		await as.mutation(reset, { guide });
		await as.mutation(reset, { guide });
		expect(await as.query(seen, { guide })).toEqual([]);
		expect(await as.query(seen, { guide: ORGANIZATION_GUIDE_STORAGE_KEY })).toEqual(["add"]);
	});
});
