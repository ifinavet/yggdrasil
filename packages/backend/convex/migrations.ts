import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";

export const migrations = new Migrations(components.migrations, {
	internalMutation,
});

export const run = migrations.runner();
