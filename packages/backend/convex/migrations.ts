import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";

export const migrations = new Migrations(components.migrations, {
	internalMutation,
});

export const run = migrations.runner();

export const backfillExternalEvent = migrations.define({
	table: "events",
	migrateOne: (_ctx, event) => {
		if (event.externalEvent === undefined) {
			return {
				externalEvent: Boolean(event.externalUrl?.length),
			};
		}
	},
});
