import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./betterAuth/_generated/dataModel.js";

export const migrations = new Migrations<DataModel>(components.migrations);
export const run = migrations.runner();

export const clerkConvexMigration = migrations.define({
	table: "user",
	migrateOne: async (ctx, doc) => {},
});
