import { migrations } from "../migrations";

// After deployment: pnpm --filter @workspace/backend exec convex run forms/migrations:backfillResponseUserId
export const backfillResponseUserId = migrations.define({
	table: "formResponses",
	migrateOne: (_ctx, response) => {
		if (
			"formId" in response &&
			response.userId === undefined &&
			typeof response.data.userId === "string"
		) {
			return { userId: response.data.userId };
		}
	},
});
