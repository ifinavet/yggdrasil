import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function runMigration() {
	const csvData = readFileSync("exported_users.csv", "utf-8");

	const result = await client.mutation(api.clerkMigration.migrateFromClerk, {
		csvData,
		clerkSecretKey: process.env.CLERK_SECRET_KEY!,
	});

	console.log("Migration completed:", result);
}

runMigration()
	.then(() => {
		console.log("Done");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Migration failed:", error);
		process.exit(1);
	});
