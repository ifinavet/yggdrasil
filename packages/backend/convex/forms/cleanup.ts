import type { AnyDataModel, GenericDatabaseWriter } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const PAGE_SIZE = 200;
const DELETES_PER_CALL = 500;

export const deleteLegacyBatch = internalMutation({
	args: {},
	returns: v.object({
		deletedResponses: v.number(),
		deletedForms: v.number(),
		done: v.boolean(),
	}),
	handler: async (ctx) => {
		let deletedResponses = 0;
		let after = -1;
		let responsesDone = false;
		while (!responsesDone && deletedResponses < DELETES_PER_CALL) {
			const page = await ctx.db
				.query("formResponses")
				.withIndex("by_creation_time", (q) => q.gt("_creationTime", after))
				.take(PAGE_SIZE);
			responsesDone = page.length < PAGE_SIZE;
			for (const response of page) {
				if (deletedResponses === DELETES_PER_CALL) {
					responsesDone = false;
					break;
				}
				if ("formId" in response) {
					await ctx.db.delete(response._id);
					deletedResponses++;
				}
				after = response._creationTime;
			}
		}

		const schemalessDb = ctx.db as unknown as GenericDatabaseWriter<AnyDataModel>;
		const forms = await schemalessDb.query("form").take(DELETES_PER_CALL);
		for (const form of forms) {
			await schemalessDb.delete(form._id);
		}

		return {
			deletedResponses,
			deletedForms: forms.length,
			done: responsesDone && forms.length < DELETES_PER_CALL,
		};
	},
});
